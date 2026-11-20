// backend/server.js
// Servidor Node.js - API Oficial de ORDERS do Mercado Pago (PIX + Checkout Pro + Webhook)
// Compativel com NutriCore Pro v4.0 (sem precisar alterar o frontend)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const DEFAULT_MP_TOKEN = (process.env.MP_ACCESS_TOKEN || '').trim();
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// =========================================================================
// FIREBASE ADMIN (OPCIONAL: BAIXA AUTOMATICA NO FIRESTORE VIA WEBHOOK)
// =========================================================================
let firestore = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firestore = admin.firestore();
    console.log('[OK] Firebase Admin conectado para baixa automatica via Webhook.');
  } catch (err) {
    console.warn('[AVISO] FIREBASE_SERVICE_ACCOUNT_JSON invalido:', err.message);
  }
} else {
  console.log('[INFO] Rodando sem Firebase Admin (baixa automatica via polling no app continua ativa).');
}

// Cache em memoria para correlacionar Order ID -> { clinicId, appointmentId, financeId }
const orderMetaCache = new Map();

// Resolve Access Token da clinica (Multi-Tenant) ou padrao do .env
async function getClinicMpToken(clinicId) {
  if (firestore && clinicId) {
    try {
      const snap = await firestore.doc(`clinics/${clinicId}/private/mpConfig`).get();
      if (snap.exists && snap.data().accessToken) {
        return String(snap.data().accessToken).trim();
      }
    } catch (e) {
      console.warn('Falha ao ler token da clinica:', e.message);
    }
  }
  return DEFAULT_MP_TOKEN;
}

// Sanitiza strings para o padrao aceito pela API de Orders (apenas letras, numeros, _ e -)
function cleanId(str) {
  return String(str || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function cleanText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Empacota e desempacota external_reference (sem caractere "|", maximo 64 chars)
function encodeRef({ clinicId, appointmentId, financeId }) {
  const c = cleanId(clinicId);
  const a = cleanId(appointmentId);
  const f = cleanId(financeId);
  const compact = `${c}__${a}__${f}`;
  return compact.length <= 64 ? compact : `ag_${a || Date.now()}`.slice(0, 64);
}

function decodeRef(ref, orderId) {
  if (orderId && orderMetaCache.has(String(orderId))) {
    return orderMetaCache.get(String(orderId));
  }
  if (!ref) return null;
  if (ref.startsWith('{')) {
    try { return JSON.parse(ref); } catch { return null; }
  }
  if (ref.includes('__')) {
    const [clinicId, appointmentId, financeId] = ref.split('__');
    return { clinicId, appointmentId, financeId };
  }
  return null;
}

// Formata erro detalhado da API de Orders para facilitar diagnostico
function formatMpError(data, fallback) {
  const errObj = data?.errors?.[0];
  if (errObj) {
    const details = Array.isArray(errObj.details) ? errObj.details.join(' | ') : (errObj.details || '');
    return details ? `${errObj.message} (${details})` : (errObj.message || fallback);
  }
  return data?.message || fallback;
}

// Atualiza Agenda e Financeiro no Firestore quando o pagamento for aprovado
async function settleOrderInFirestore(meta, externalId) {
  if (!firestore || !meta || !meta.clinicId) return;
  const { clinicId, appointmentId, financeId } = meta;
  const now = new Date().toISOString();

  if (appointmentId) {
    await firestore.doc(`clinics/${clinicId}/agenda/${appointmentId}`).set({
      status: 'CONFIRMADO',
      paymentStatus: 'PAGO',
      mpOrderId: String(externalId),
      paidAt: now
    }, { merge: true }).catch(err => console.error('Erro ao atualizar agenda:', err.message));
  }

  if (financeId) {
    await firestore.doc(`clinics/${clinicId}/finance/${financeId}`).set({
      status: 'PAGO',
      mpOrderId: String(externalId),
      paidAt: now
    }, { merge: true }).catch(err => console.error('Erro ao atualizar financeiro:', err.message));
  }
}

// =========================================================================
// 1. HEALTH CHECK
// =========================================================================
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    apiMode: 'Mercado Pago Orders API (v1/orders)',
    service: 'NutriCore Pro - Mercado Pago API',
    tokenConfigured: Boolean(DEFAULT_MP_TOKEN && !DEFAULT_MP_TOKEN.includes('COLE_SEU')),
    firebaseAdmin: Boolean(firestore)
  });
});

// =========================================================================
// 2. GERAR PIX DINAMICO VIA API DE ORDERS (POST /v1/orders)
// =========================================================================
app.post('/api/payments/pix', async (req, res) => {
  try {
    const { clinicId, appointmentId, financeId, amount, description, payerEmail } = req.body;
    const token = await getClinicMpToken(clinicId);

    if (!token || token.includes('COLE_SEU')) {
      return res.status(400).json({
        error: 'MP_ACCESS_TOKEN nao configurado no arquivo backend/.env'
      });
    }

    const amountStr = Number(amount).toFixed(2);
    const meta = { clinicId, appointmentId, financeId };
    const externalRef = encodeRef(meta);
    const idempotencyKey = crypto.randomUUID();

    const payload = {
      type: 'online',
      total_amount: amountStr,
      external_reference: externalRef,
      processing_mode: 'automatic',
      description: cleanText(description || 'Consulta Nutricional').slice(0, 100),
      payer: {
        email: (payerEmail || 'paciente@nutricore.com').trim()
      },
      transactions: {
        payments: [
          {
            amount: amountStr,
            payment_method: {
              id: 'pix',
              type: 'bank_transfer'
            }
          }
        ]
      }
    };

    const mpRes = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error('[MP ORDERS PIX ERRO]', JSON.stringify(data, null, 2));
      const msg = formatMpError(data, 'Erro ao criar Order PIX no Mercado Pago');
      return res.status(mpRes.status).json({ error: msg, details: data });
    }

    const firstPayment = data.transactions?.payments?.[0] || {};
    const pm = firstPayment.payment_method || {};
    const qrCode = pm.qr_code || firstPayment.point_of_interaction?.transaction_data?.qr_code || '';
    const qrCodeBase64 = pm.qr_code_base64 || firstPayment.point_of_interaction?.transaction_data?.qr_code_base64 || '';
    const ticketUrl = pm.ticket_url || '';

    orderMetaCache.set(String(data.id), meta);

    const isPaid = data.status === 'processed' || firstPayment.status === 'processed' || firstPayment.status === 'approved';

    res.json({
      paymentId: String(data.id),
      status: isPaid ? 'approved' : (data.status || 'pending'),
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: ticketUrl
    });
  } catch (err) {
    console.error('Erro /api/payments/pix (Orders):', err);
    res.status(500).json({ error: 'Falha interna ao criar PIX (Orders): ' + err.message });
  }
});

// =========================================================================
// 3. GERAR CHECKOUT PRO (CARTAO DE CREDITO / DEBITO)
// =========================================================================
app.post('/api/payments/checkout', async (req, res) => {
  try {
    const { clinicId, appointmentId, financeId, amount, description, payerEmail } = req.body;
    const token = await getClinicMpToken(clinicId);

    if (!token || token.includes('COLE_SEU')) {
      return res.status(400).json({
        error: 'MP_ACCESS_TOKEN nao configurado no arquivo backend/.env'
      });
    }

    const meta = { clinicId, appointmentId, financeId };
    const externalRef = encodeRef(meta);

    const payload = {
      items: [
        {
          title: cleanText(description || 'Consulta Nutricional').slice(0, 100),
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(Number(amount).toFixed(2))
        }
      ],
      payer: { email: (payerEmail || 'paciente@nutricore.com').trim() },
      external_reference: externalRef,
      back_urls: {
        success: `${FRONTEND_URL}/?mp_status=approved&ag=${encodeURIComponent(appointmentId || '')}`,
        pending: `${FRONTEND_URL}/?mp_status=pending&ag=${encodeURIComponent(appointmentId || '')}`,
        failure: `${FRONTEND_URL}/?mp_status=failure&ag=${encodeURIComponent(appointmentId || '')}`
      }
    };

    if (FRONTEND_URL.startsWith('https://')) {
      payload.auto_return = 'approved';
    }
    if (PUBLIC_URL.startsWith('https://')) {
      payload.notification_url = `${PUBLIC_URL}/api/payments/webhook?clinicId=${encodeURIComponent(clinicId || '')}`;
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      return res.status(mpRes.status).json({
        error: formatMpError(data, 'Erro ao criar Checkout Pro'),
        details: data
      });
    }

    res.json({
      preferenceId: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point
    });
  } catch (err) {
    console.error('Erro /api/payments/checkout:', err);
    res.status(500).json({ error: 'Falha interna ao criar Checkout Pro: ' + err.message });
  }
});

// =========================================================================
// 4. CONSULTAR STATUS DA ORDER (GET /v1/orders/:id)
// =========================================================================
app.get('/api/payments/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { clinicId } = req.query;
    const token = await getClinicMpToken(clinicId);

    const mpRes = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await mpRes.json();

    if (!mpRes.ok) {
      return res.status(mpRes.status).json({ error: formatMpError(data, 'Order nao encontrada') });
    }

    const firstPayment = data.transactions?.payments?.[0] || {};
    const isPaid = data.status === 'processed' || firstPayment.status === 'processed' || firstPayment.status === 'approved';

    if (isPaid) {
      const meta = decodeRef(data.external_reference, data.id);
      await settleOrderInFirestore(meta, data.id);
    }

    res.json({
      paymentId: String(data.id),
      status: isPaid ? 'approved' : data.status,
      status_detail: data.status_detail || firstPayment.status_detail || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 5. WEBHOOK OFICIAL (SUPORTA ORDERS API E PAYMENTS API)
// =========================================================================
app.post('/api/payments/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const topic = req.body?.type || req.query?.topic || req.body?.topic || '';
    const resourceId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
    const clinicId = req.query?.clinicId || '';

    if (!resourceId) return;
    const token = await getClinicMpToken(clinicId);
    if (!token) return;

    if (topic === 'order' || String(req.body?.action || '').startsWith('order.')) {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(resourceId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const order = await mpRes.json();
      const firstPayment = order.transactions?.payments?.[0] || {};
      const isPaid = order.status === 'processed' || firstPayment.status === 'processed';

      if (mpRes.ok && isPaid) {
        const meta = decodeRef(order.external_reference, order.id);
        console.log(`[WEBHOOK ORDER] Order ${resourceId} PAGA! Clinica: ${meta?.clinicId}`);
        await settleOrderInFirestore(meta, order.id);
      }
      return;
    }

    if (topic === 'payment') {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(resourceId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payment = await mpRes.json();
      if (mpRes.ok && payment.status === 'approved') {
        const meta = decodeRef(payment.external_reference, payment.id);
        console.log(`[WEBHOOK PAYMENT] Pagamento ${resourceId} APROVADO! Clinica: ${meta?.clinicId}`);
        await settleOrderInFirestore(meta, payment.id);
      }
    }
  } catch (err) {
    console.error('[WEBHOOK ERRO]', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`=========================================================`);
  console.log(` NutriCore Pro - Backend Mercado Pago (API DE ORDERS)`);
  console.log(` Rodando na porta ${PORT} -> http://localhost:${PORT}/api/health`);
  console.log(`=========================================================`);
});
