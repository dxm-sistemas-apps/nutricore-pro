// www/js/patient-portal.js
// Portal Completo do Cliente (Paciente): Dieta + Substituicoes + Check-in + Agua + Lista de Compras
// + Autoagendamento (Valores Configurados + Saldo Mercado Pago + Remarcar/Excluir) + Evolucao + Docs + Chat

import { ClinicDB } from './db.js';
import { PAYMENT_API_URL } from './firebase-config.js';
import { TACO_DB, getSubstitutes } from './taco.js';

let pTab = 'dieta';
let selectedBookingDate = new Date().toISOString().slice(0, 10);
let selectedSlot = null;
let showShoppingList = false;
let activePixCharge = null;
let pixPollTimer = null;

export function mountPatientPortal({ printDocument, buildGoogleCalendarUrl, downloadICS, renderWeightChart }) {
  const ctx = { printDocument, buildGoogleCalendarUrl, downloadICS, renderWeightChart };
  const u = ClinicDB.currentSession;

  document.documentElement.style.setProperty('--brand', u.primaryColor || '#059669');

  document.getElementById('app-shell').innerHTML = `
    <aside class="hidden md:flex md:w-64 bg-slate-900 text-slate-200 flex-col justify-between p-5 shrink-0">
      <div>
        <div class="flex items-center gap-3 pb-5 border-b border-slate-800">
          <div class="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center font-bold">P</div>
          <div class="overflow-hidden">
            <h2 class="font-bold text-white text-sm truncate">${u.clinicName}</h2>
            <p class="text-xs text-slate-400 truncate">Ola, ${u.userName || u.name}</p>
          </div>
        </div>
        <nav class="mt-5 space-y-1">
          <button data-ptab="dieta" class="pnav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition">
            <i data-lucide="utensils" class="w-5 h-5"></i> Minha Dieta & Rotina
          </button>
          <button data-ptab="agendar" class="pnav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition">
            <i data-lucide="calendar-plus" class="w-5 h-5"></i> Agendar Consulta
          </button>
          <button data-ptab="evolucao" class="pnav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition">
            <i data-lucide="trending-up" class="w-5 h-5"></i> Minha Evolucao
          </button>
          <button data-ptab="docs" class="pnav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition">
            <i data-lucide="file-text" class="w-5 h-5"></i> Receitas & Recibos
          </button>
          <button data-ptab="chat" class="pnav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition">
            <i data-lucide="message-circle" class="w-5 h-5"></i> Falar com Nutri
          </button>
        </nav>
      </div>
      <div class="pt-4 border-t border-slate-800 space-y-2">
        <p class="text-[11px] text-slate-400">${u.name} • ${u.crn}</p>
        <button id="p-logout" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-red-950 hover:text-red-300 text-xs">
          <i data-lucide="log-out" class="w-4 h-4"></i> Sair da Conta
        </button>
      </div>
    </aside>

    <div class="flex-1 flex flex-col min-h-screen pb-20 md:pb-0">
      <header class="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h2 class="font-bold text-sm">${u.clinicName}</h2>
          <p class="text-[11px] text-slate-400">Portal do Paciente • ${u.userName || u.name}</p>
        </div>
        <button id="p-logout-mob" class="p-2 rounded-lg bg-slate-800 text-slate-300"><i data-lucide="log-out" class="w-4 h-4"></i></button>
      </header>
      <main id="patient-view" class="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto"></main>
    </div>

    <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 grid grid-cols-5 py-1.5 z-30 shadow-lg">
      <button data-ptab="dieta" class="pnav-btn flex flex-col items-center text-[10px] text-slate-500 py-1"><i data-lucide="utensils" class="w-4 h-4 mb-0.5"></i>Dieta</button>
      <button data-ptab="agendar" class="pnav-btn flex flex-col items-center text-[10px] text-slate-500 py-1"><i data-lucide="calendar-plus" class="w-4 h-4 mb-0.5"></i>Agendar</button>
      <button data-ptab="evolucao" class="pnav-btn flex flex-col items-center text-[10px] text-slate-500 py-1"><i data-lucide="trending-up" class="w-4 h-4 mb-0.5"></i>Evolucao</button>
      <button data-ptab="docs" class="pnav-btn flex flex-col items-center text-[10px] text-slate-500 py-1"><i data-lucide="file-text" class="w-4 h-4 mb-0.5"></i>Docs</button>
      <button data-ptab="chat" class="pnav-btn flex flex-col items-center text-[10px] text-slate-500 py-1"><i data-lucide="message-circle" class="w-4 h-4 mb-0.5"></i>Chat</button>
    </nav>
  `;

  ['p-logout', 'p-logout-mob'].forEach(id => {
    document.getElementById(id).addEventListener('click', async () => { await ClinicDB.logout(); location.reload(); });
  });

  document.querySelectorAll('.pnav-btn').forEach(btn => {
    btn.addEventListener('click', () => { pTab = btn.dataset.ptab; renderPatientTab(ctx); });
  });

  renderPatientTab(ctx);
}

async function renderPatientTab(ctx) {
  document.querySelectorAll('.pnav-btn').forEach(btn => {
    const active = btn.dataset.ptab === pTab;
    btn.classList.toggle('bg-brand', active && !!btn.closest('aside'));
    btn.classList.toggle('text-white', active && !!btn.closest('aside'));
    btn.classList.toggle('text-brand', active && !btn.closest('aside'));
    btn.classList.toggle('font-bold', active);
  });

  if (pTab === 'dieta') await renderMinhaDieta(ctx);
  if (pTab === 'agendar') await renderAutoAgendamento(ctx);
  if (pTab === 'evolucao') await renderMinhaEvolucao(ctx);
  if (pTab === 'docs') await renderMeusDocs(ctx);
  if (pTab === 'chat') await renderMeuChat();
  lucide.createIcons();
}

// =========================================================================
// 1. MINHA DIETA + CHECK-IN + HIDRATACAO + LISTA DE COMPRAS
// =========================================================================
async function renderMinhaDieta(ctx) {
  const u = ClinicDB.currentSession;
  const today = new Date().toISOString().slice(0, 10);
  const plans = (await ClinicDB.getAll('mealPlans')).filter(p => p.patientId === u.patientId);
  const plan = plans[0];

  const stateKey = `nutricore_daily_${u.clinicId}_${u.patientId}_${today}`;
  const daily = JSON.parse(localStorage.getItem(stateKey) || '{"checkedMeals":[],"waterMl":0,"bought":[]}');
  const saveDaily = () => localStorage.setItem(stateKey, JSON.stringify(daily));

  const totalMeals = plan ? plan.meals.length : 0;
  const doneMeals = daily.checkedMeals.length;
  const progress = totalMeals ? Math.round((doneMeals / totalMeals) * 100) : 0;
  const waterGoal = 2500;
  const waterPct = Math.min(100, Math.round((daily.waterMl / waterGoal) * 100));

  const shoppingItems = [];
  if (plan) {
    const map = {};
    plan.meals.forEach(m => m.items.forEach(it => {
      const f = TACO_DB.find(x => x.id === it.foodId);
      if (f) map[f.name] = (map[f.name] || 0) + Number(it.grams);
    }));
    Object.entries(map).forEach(([name, g]) => shoppingItems.push({ name, weeklyG: g * 7 }));
  }

  document.getElementById('patient-view').innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Minha Dieta & Rotina</h1>
          <p class="text-sm text-slate-500">Acompanhe suas refeicoes, substituicoes e hidratacao de hoje (${today})</p>
        </div>
        ${plan ? `
          <div class="flex gap-2">
            <button id="toggle-shop" class="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-semibold">
              ${showShoppingList ? 'Ocultar' : 'Lista de Compras'}
            </button>
            <button id="p-print-plan" class="px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold shadow">Baixar PDF</button>
          </div>
        ` : ''}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white p-5 rounded-2xl border shadow-sm">
          <div class="flex justify-between text-xs font-bold uppercase text-slate-500 mb-2">
            <span>Adesao do Dia</span>
            <span class="text-brand">${doneMeals}/${totalMeals} refeicoes (${progress}%)</span>
          </div>
          <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-brand transition-all" style="width:${progress}%"></div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-2xl border shadow-sm">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold uppercase text-slate-500">Hidratacao (${daily.waterMl} / ${waterGoal} ml)</span>
            <div class="flex gap-1.5">
              <button id="add-water" class="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-bold">+250ml</button>
              <button id="rst-water" class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs">Zerar</button>
            </div>
          </div>
          <div class="w-full h-3 bg-sky-100 rounded-full overflow-hidden">
            <div class="h-full bg-sky-500 transition-all" style="width:${waterPct}%"></div>
          </div>
        </div>
      </div>

      ${showShoppingList && plan ? `
        <div class="bg-white p-5 rounded-2xl border-2 border-brand shadow-sm space-y-3">
          <h2 class="font-bold text-slate-800">Lista de Compras Semanal (Automatica)</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${shoppingItems.map((it, idx) => `
              <label class="flex items-center gap-2 text-sm p-2 rounded-lg bg-slate-50 cursor-pointer">
                <input type="checkbox" data-shop="${idx}" ${daily.bought.includes(idx) ? 'checked' : ''} class="w-4 h-4 accent-emerald-600" />
                <span class="${daily.bought.includes(idx) ? 'line-through text-slate-400' : 'text-slate-700'}"><b>${it.name}</b> (~${it.weeklyG}g/sem)</span>
              </label>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${!plan ? '<div class="bg-white p-8 rounded-2xl border text-center text-slate-500">Sua nutricionista ainda nao liberou um plano alimentar.</div>' : `
        <div class="space-y-4">
          ${plan.meals.map((meal, idx) => {
            const isDone = daily.checkedMeals.includes(idx);
            return `
              <div class="bg-white rounded-2xl border shadow-sm overflow-hidden ${isDone ? 'ring-2 ring-emerald-400' : ''}">
                <div class="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
                  <div>
                    <span class="text-xs font-bold text-brand">${meal.time}</span>
                    <h3 class="font-bold text-slate-800">${meal.name}</h3>
                  </div>
                  <button data-check-meal="${idx}" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${isDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}">
                    ${isDone ? '✓ Concluida' : 'Marcar Check-in'}
                  </button>
                </div>
                <div class="p-4 space-y-3">
                  ${meal.items.map(it => {
                    const f = TACO_DB.find(x => x.id === it.foodId);
                    if (!f) return '';
                    const subs = getSubstitutes(f.id, it.grams);
                    return `
                      <div class="text-sm border-b last:border-b-0 pb-2.5 last:pb-0">
                        <p class="font-semibold text-slate-800">${f.name} — <span class="text-brand">${it.grams}g</span> <span class="text-xs text-slate-400 font-normal">(${f.medida})</span></p>
                        ${subs.length ? `<details class="mt-1 text-xs text-slate-500 cursor-pointer"><summary class="font-medium text-slate-600">Ver opcoes de substituicao (TACO)</summary><p class="mt-1 pl-3 text-slate-600">• ${subs.join('<br/>• ')}</p></details>` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  document.getElementById('add-water')?.addEventListener('click', () => { daily.waterMl += 250; saveDaily(); renderMinhaDieta(ctx); });
  document.getElementById('rst-water')?.addEventListener('click', () => { daily.waterMl = 0; saveDaily(); renderMinhaDieta(ctx); });
  document.getElementById('toggle-shop')?.addEventListener('click', () => { showShoppingList = !showShoppingList; renderMinhaDieta(ctx); });

  document.querySelectorAll('[data-shop]').forEach(cb => {
    cb.addEventListener('change', () => {
      const i = Number(cb.dataset.shop);
      if (cb.checked) daily.bought.push(i); else daily.bought = daily.bought.filter(x => x !== i);
      saveDaily(); renderMinhaDieta(ctx);
    });
  });

  document.querySelectorAll('[data-check-meal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.checkMeal);
      if (daily.checkedMeals.includes(i)) daily.checkedMeals = daily.checkedMeals.filter(x => x !== i);
      else daily.checkedMeals.push(i);
      saveDaily(); renderMinhaDieta(ctx);
    });
  });

  document.getElementById('p-print-plan')?.addEventListener('click', () => {
    ctx.printDocument(`
      <div class="space-y-4">
        <h1 class="text-2xl font-bold">${u.clinicName} — Plano Alimentar</h1>
        <p class="text-sm text-slate-600">Paciente: <b>${u.userName || u.name}</b> • Profissional: ${u.name} (${u.crn})</p>
        ${plan.meals.map(m => `
          <div class="border rounded-xl p-4">
            <h2 class="font-bold border-b pb-1 mb-2">${m.time} — ${m.name}</h2>
            <ul class="space-y-1 text-sm">${m.items.map(it => {
              const f = TACO_DB.find(x => x.id === it.foodId);
              return f ? `<li><b>${f.name}</b> — ${it.grams}g (${f.medida})</li>` : '';
            }).join('')}</ul>
          </div>
        `).join('')}
      </div>
    `);
  });
}

// =========================================================================
// 2. AUTOAGENDAMENTO (VALORES DO PROFISSIONAL + SALDO MP + REMARCAR/EXCLUIR)
// =========================================================================
function generateSlots(cfg) {
  const slots = [];
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const start = toMin(cfg.startHour || '08:00');
  const end = toMin(cfg.endHour || '18:00');
  const lStart = toMin(cfg.lunchStart || '12:00');
  const lEnd = toMin(cfg.lunchEnd || '13:00');
  const step = Number(cfg.slotMinutes) || 60;

  for (let cur = start; cur + step <= end; cur += step) {
    if (cur >= lStart && cur < lEnd) continue;
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

async function renderAutoAgendamento(ctx) {
  const u = ClinicDB.currentSession;
  const cfg = await ClinicDB.getScheduleConfig();
  const busy = await ClinicDB.getAll('busySlots');
  const myEvents = (await ClinicDB.getAll('agenda')).filter(e => e.patientId === u.patientId);

  const priceConsulta = Number(cfg.priceConsulta ?? 250);
  const priceTri = Number(cfg.pricePlanoTri ?? 650);
  const priceSem = Number(cfg.pricePlanoSemestral ?? 1150);

  const optionsList = [
    { id: 'consulta', name: 'Consulta Nutricional', price: priceConsulta },
    { id: 'planoTri', name: 'Plano Trimestral', price: priceTri },
    { id: 'planoSemestral', name: 'Plano Semestral', price: priceSem },
    ...(cfg.services || [])
  ];

  const dayOfWeek = new Date(selectedBookingDate + 'T12:00:00').getDay();
  const isOpenDay = (cfg.days || [1, 2, 3, 4, 5]).includes(dayOfWeek);
  const busyTimes = busy.filter(b => b.date === selectedBookingDate).map(b => b.time);
  const allSlots = isOpenDay ? generateSlots(cfg) : [];
  const freeSlots = allSlots.filter(s => !busyTimes.includes(s));

  document.getElementById('patient-view').innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Agendar Consulta & Planos</h1>
        <p class="text-sm text-slate-500">Escolha uma data e um horario disponivel na agenda da ${u.clinicName}</p>
      </div>

      <!-- TABELA DE VALORES DEFINIDOS PELO PROFISSIONAL -->
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-white p-3.5 rounded-2xl border shadow-sm">
          <p class="text-[11px] font-bold uppercase text-slate-400">Consulta</p>
          <p class="text-lg font-bold text-slate-900">R$ ${priceConsulta.toFixed(2)}</p>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border shadow-sm">
          <p class="text-[11px] font-bold uppercase text-slate-400">Plano Trimestral</p>
          <p class="text-lg font-bold text-brand">R$ ${priceTri.toFixed(2)}</p>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border shadow-sm">
          <p class="text-[11px] font-bold uppercase text-slate-400">Plano Semestral</p>
          <p class="text-lg font-bold text-slate-900">R$ ${priceSem.toFixed(2)}</p>
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl border shadow-sm space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-bold uppercase text-slate-500">1. Escolha a Data</label>
            <input id="bk-date" type="date" value="${selectedBookingDate}" min="${new Date().toISOString().slice(0,10)}"
              class="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm font-medium" />
          </div>
          <div>
            <label class="text-xs font-bold uppercase text-slate-500">2. Tipo de Atendimento / Plano</label>
            <select id="bk-service" class="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm">
              ${optionsList.map(s => `<option value="${s.id}" data-price="${s.price}" data-name="${s.name}">${s.name} — R$ ${Number(s.price).toFixed(2)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div>
          <label class="text-xs font-bold uppercase text-slate-500">3. Horarios Livres (${selectedBookingDate})</label>
          <div class="mt-2 flex flex-wrap gap-2">
            ${!isOpenDay ? '<p class="text-sm text-amber-600">A clinica nao atende neste dia da semana. Selecione outra data.</p>' :
              freeSlots.length === 0 ? '<p class="text-sm text-rose-500">Todos os horarios desta data estao ocupados.</p>' :
              freeSlots.map(slot => `
                <button type="button" data-pick-slot="${slot}" class="px-4 py-2 rounded-xl text-sm font-bold border transition ${selectedSlot === slot ? 'bg-brand text-white border-transparent shadow' : 'bg-slate-50 hover:bg-emerald-50 text-slate-700'}">
                  ${slot}
                </button>
              `).join('')}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
          <div>
            <label class="text-xs font-bold uppercase text-slate-500">4. Forma de Pagamento (Checkout)</label>
            <select id="bk-pay" class="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm font-medium">
              <option value="MP_PIX">PIX Dinamico (Mercado Pago — Aprovacao Automatica)</option>
              <option value="MP_BALANCE">Saldo do Mercado Pago (Conta Mercado Pago)</option>
              <option value="MP_CARD">Cartao de Credito / Debito (Mercado Pago)</option>
              <option value="Pagar na Clinica">Pagar na Clinica (No dia da consulta)</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold uppercase text-slate-500">Observacao (Opcional)</label>
            <input id="bk-notes" placeholder="Ex: Vou levar exames recentes" class="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm" />
          </div>
        </div>

        <button id="bk-confirm" class="w-full md:w-auto px-6 py-3 rounded-xl bg-brand text-white font-bold text-sm shadow hover:opacity-90">
          Continuar para Pagamento / Confirmar
        </button>

        ${activePixCharge ? `
          <div class="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 space-y-4">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 class="font-bold text-emerald-900">PIX Gerado via Mercado Pago (R$ ${Number(activePixCharge.amount).toFixed(2)})</h3>
                <p class="text-xs text-emerald-700">A confirmacao da consulta e a baixa financeira acontecem automaticamente apos o pagamento.</p>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-bold ${activePixCharge.status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'}">
                ${activePixCharge.status === 'approved' ? '✓ PAGO E CONFIRMADO' : 'AGUARDANDO PAGAMENTO...'}
              </span>
            </div>

            ${activePixCharge.status !== 'approved' ? `
              <div class="flex flex-col md:flex-row items-center gap-5">
                ${activePixCharge.qr_code_base64 ? `<img src="data:image/png;base64,${activePixCharge.qr_code_base64}" alt="QR Code PIX" class="w-44 h-44 rounded-xl border bg-white p-2 shadow" />` : ''}
                <div class="flex-1 w-full space-y-2">
                  <label class="text-xs font-bold uppercase text-emerald-800">PIX Copia e Cola:</label>
                  <textarea readonly rows="3" id="mp-pix-code" class="w-full p-2.5 rounded-xl border bg-white font-mono text-xs">${activePixCharge.qr_code}</textarea>
                  <div class="flex flex-wrap gap-2">
                    <button id="btn-copy-pix" type="button" class="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold">Copiar Codigo PIX</button>
                    <button id="btn-check-pix" type="button" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">Ja Paguei • Verificar Agora</button>
                  </div>
                </div>
              </div>
            ` : `
              <p class="text-sm font-semibold text-emerald-800">Pagamento aprovado! Sua consulta ja esta confirmada e o recibo liberado na aba Docs.</p>
            `}
          </div>
        ` : ''}
      </div>

      <!-- MEUS AGENDAMENTOS COM REMARCAR E EXCLUIR -->
      <div class="space-y-3">
        <h2 class="text-sm font-bold uppercase text-slate-600">Meus Agendamentos</h2>
        ${myEvents.length === 0 ? '<p class="text-sm text-slate-400">Voce ainda nao possui consultas agendadas.</p>' : myEvents.map(ev => `
          <div class="bg-white p-4 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${ev.status === 'CONFIRMADO' ? 'bg-emerald-100 text-emerald-700' : ev.status === 'REMARCADO' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${ev.status || 'AGUARDANDO'}</span>
                <span class="text-xs font-semibold text-slate-500">${ev.date} as ${ev.time}</span>
              </div>
              <p class="font-bold text-slate-800 mt-1">${ev.type}</p>
              <p class="text-xs text-slate-500">${ev.checkoutMode || 'Pagar na Clinica'} ${ev.amount ? '• R$ ' + Number(ev.amount).toFixed(2) : ''}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button data-p-reschedule="${ev.id}" class="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold">Remarcar</button>
              <button data-p-delete="${ev.id}" class="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold">Excluir</button>
              <a href="${ctx.buildGoogleCalendarUrl(ev)}" target="_blank" class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold">Google Calendar</a>
              <button data-p-ics="${ev.id}" class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">.ICS</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('bk-date').addEventListener('change', (e) => {
    selectedBookingDate = e.target.value;
    selectedSlot = null;
    renderAutoAgendamento(ctx);
  });

  document.querySelectorAll('[data-pick-slot]').forEach(btn => {
    btn.addEventListener('click', () => { selectedSlot = btn.dataset.pickSlot; renderAutoAgendamento(ctx); });
  });

  const apiBase = (cfg.mpApiUrl || PAYMENT_API_URL || 'http://localhost:3001').replace(/\/$/, '');

  async function verifyPixStatus() {
    if (!activePixCharge || activePixCharge.status === 'approved') return;
    try {
      const r = await fetch(`${apiBase}/api/payments/status/${activePixCharge.paymentId}?clinicId=${encodeURIComponent(u.clinicId)}`);
      const st = await r.json();
      if (st.status === 'approved') {
        activePixCharge.status = 'approved';
        if (pixPollTimer) { clearInterval(pixPollTimer); pixPollTimer = null; }
        await ClinicDB.update('agenda', activePixCharge.appointmentId, { status: 'CONFIRMADO', paymentStatus: 'PAGO' });
        await ClinicDB.update('finance', activePixCharge.financeId, { status: 'PAGO' });
        renderAutoAgendamento(ctx);
      }
    } catch {}
  }

  document.getElementById('btn-copy-pix')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(activePixCharge.qr_code);
    alert('Codigo PIX copiado! Cole no aplicativo do seu banco.');
  });
  document.getElementById('btn-check-pix')?.addEventListener('click', async () => {
    await verifyPixStatus();
    if (activePixCharge?.status !== 'approved') alert('Pagamento ainda pendente no Mercado Pago. Aguarde alguns segundos e tente novamente.');
  });

  document.getElementById('bk-confirm').addEventListener('click', async () => {
    if (!selectedSlot) return alert('Selecione um horario livre primeiro.');
    const srvSel = document.getElementById('bk-service');
    const opt = srvSel.options[srvSel.selectedIndex];
    const srvName = opt?.dataset?.name || 'Consulta Nutricional';
    const srvPrice = Number(opt?.dataset?.price || priceConsulta);
    const payMode = document.getElementById('bk-pay').value;
    const notes = document.getElementById('bk-notes').value.trim();

    const modeLabel =
      payMode === 'MP_PIX'
        ? 'PIX Mercado Pago'
        : payMode === 'MP_BALANCE'
        ? 'Saldo do Mercado Pago'
        : payMode === 'MP_CARD'
        ? 'Cartao Mercado Pago'
        : 'Pagar na Clinica';

    await ClinicDB.add('busySlots', { date: selectedBookingDate, time: selectedSlot });
    const ag = await ClinicDB.add('agenda', {
      patientId: u.patientId,
      patientName: u.userName || u.name,
      date: selectedBookingDate,
      time: selectedSlot,
      type: srvName,
      amount: srvPrice,
      checkoutMode: modeLabel,
      status: payMode === 'Pagar na Clinica' ? 'AGUARDANDO CONFIRMACAO' : 'AGUARDANDO PAGAMENTO',
      notes
    });
    const fin = await ClinicDB.add('finance', {
      patientId: u.patientId,
      appointmentId: ag.id,
      desc: `${srvName} - ${u.userName || u.name}`,
      type: 'RECEITA',
      amount: srvPrice,
      date: selectedBookingDate,
      status: 'PENDENTE'
    });

    if (payMode === 'Pagar na Clinica') {
      selectedSlot = null;
      alert('Solicitacao enviada! Sua consulta foi reservada e aguarda confirmacao da clinica.');
      return renderAutoAgendamento(ctx);
    }

    const btn = document.getElementById('bk-confirm');
    btn.disabled = true;
    btn.textContent = 'Conectando ao Mercado Pago...';

    try {
      const endpoint = payMode === 'MP_PIX' ? '/api/payments/pix' : '/api/payments/checkout';
      const resp = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: u.clinicId,
          appointmentId: ag.id,
          financeId: fin.id,
          amount: srvPrice,
          paymentMethod: payMode === 'MP_BALANCE' ? 'mp_balance' : payMode === 'MP_PIX' ? 'pix' : 'credit_card',
          description: `${srvName} - ${u.clinicName}`,
          payerEmail: u.email,
          payerName: u.userName || u.name
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao comunicar com Mercado Pago');

      selectedSlot = null;
      if (payMode === 'MP_PIX') {
        activePixCharge = { ...data, amount: srvPrice, appointmentId: ag.id, financeId: fin.id };
        if (pixPollTimer) clearInterval(pixPollTimer);
        pixPollTimer = setInterval(verifyPixStatus, 5000);
        renderAutoAgendamento(ctx);
      } else {
        const url = data.init_point || data.sandbox_init_point;
        if (url) window.open(url, '_blank');
        alert(
          payMode === 'MP_BALANCE'
            ? 'Checkout aberto! Escolha seu Saldo do Mercado Pago para concluir o pagamento.'
            : 'Checkout do Mercado Pago aberto! Assim que o pagamento for aprovado, sua consulta sera confirmada automaticamente.'
        );
        renderAutoAgendamento(ctx);
      }
    } catch (err) {
      alert(`Nao foi possivel conectar ao servidor Mercado Pago (${apiBase}):\n${err.message}\n\nVerifique o servidor no Render e o MP_ACCESS_TOKEN.`);
      btn.disabled = false;
      btn.textContent = 'Continuar para Pagamento / Confirmar';
    }
  });

  document.querySelectorAll('[data-p-reschedule]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ev = myEvents.find(x => x.id === btn.dataset.pReschedule);
      if (!ev) return;
      const newDate = prompt('Nova data da consulta (AAAA-MM-DD):', ev.date);
      if (!newDate) return;
      const newTime = prompt('Novo horario (HH:MM):', ev.time);
      if (!newTime) return;
      await ClinicDB.update('agenda', ev.id, { date: newDate.trim(), time: newTime.trim(), status: 'REMARCADO' });
      renderAutoAgendamento(ctx);
    });
  });

  document.querySelectorAll('[data-p-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Deseja realmente excluir este agendamento?')) return;
      await ClinicDB.remove('agenda', btn.dataset.pDelete);
      renderAutoAgendamento(ctx);
    });
  });

  document.querySelectorAll('[data-p-ics]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = myEvents.find(x => x.id === btn.dataset.pIcs);
      if (ev) ctx.downloadICS(ev);
    });
  });
}

// =========================================================================
// 3. MINHA EVOLUCAO (SOMENTE LEITURA)
// =========================================================================
async function renderMinhaEvolucao(ctx) {
  const u = ClinicDB.currentSession;
  const evals = (await ClinicDB.getAll('evaluations'))
    .filter(e => e.patientId === u.patientId)
    .sort((a, b) => a.date.localeCompare(b.date));

  document.getElementById('patient-view').innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Minha Evolucao</h1>
        <p class="text-sm text-slate-500">Acompanhe seus resultados de avaliacao fisica ao longo do acompanhamento</p>
      </div>
      <div class="bg-white p-5 rounded-2xl border shadow-sm">
        <p class="text-xs font-bold uppercase text-slate-500 mb-3">Curva de Peso (kg)</p>
        ${ctx.renderWeightChart(evals)}
      </div>
      <div class="bg-white rounded-2xl border shadow-sm overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 border-b">
            <tr><th class="p-4">Data</th><th class="p-4">Peso</th><th class="p-4">% Gordura</th><th class="p-4">Cintura</th><th class="p-4">Quadril</th></tr>
          </thead>
          <tbody class="divide-y">
            ${evals.slice().reverse().map(e => `
              <tr>
                <td class="p-4 font-semibold">${e.date}</td>
                <td class="p-4">${e.weight} kg</td>
                <td class="p-4">${e.bodyFat ? e.bodyFat + '%' : '-'}</td>
                <td class="p-4">${e.waist ? e.waist + ' cm' : '-'}</td>
                <td class="p-4">${e.hip ? e.hip + ' cm' : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =========================================================================
// 4. RECEITAS DE MANIPULADOS & RECIBOS EM PDF
// =========================================================================
async function renderMeusDocs(ctx) {
  const u = ClinicDB.currentSession;
  const rxs = (await ClinicDB.getAll('prescriptions')).filter(r => r.patientId === u.patientId || r.patient === (u.userName || u.name));
  const receipts = (await ClinicDB.getAll('finance')).filter(f => f.patientId === u.patientId && f.type === 'RECEITA' && f.status === 'PAGO');
  const fmt = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  document.getElementById('patient-view').innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Receitas & Recibos</h1>
        <p class="text-sm text-slate-500">Baixe suas formulas de manipulados e recibos de consultas pagas</p>
      </div>

      <div class="space-y-3">
        <h2 class="text-sm font-bold uppercase text-slate-600">Prescricoes de Manipulados</h2>
        ${rxs.length === 0 ? '<p class="text-sm text-slate-400">Nenhuma formula prescrita ainda.</p>' : rxs.map(rx => `
          <div class="bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between gap-3">
            <div>
              <p class="font-bold text-slate-800">${rx.formType}</p>
              <p class="text-xs text-slate-500">${rx.items.map(i => `${i.ativo} (${i.dose})`).join(' • ')}</p>
            </div>
            <button data-prx="${rx.id}" class="px-3.5 py-2 rounded-xl bg-brand text-white text-xs font-semibold">PDF Farmacia</button>
          </div>
        `).join('')}
      </div>

      <div class="space-y-3">
        <h2 class="text-sm font-bold uppercase text-slate-600">Recibos de Consultas Pagas</h2>
        ${receipts.length === 0 ? '<p class="text-sm text-slate-400">Nenhum recibo disponivel.</p>' : receipts.map(r => `
          <div class="bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between gap-3">
            <div>
              <p class="font-bold text-slate-800">${r.desc}</p>
              <p class="text-xs text-slate-500">${r.date} • ${fmt(r.amount)}</p>
            </div>
            <button data-prec="${r.id}" class="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold">Recibo PDF</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.querySelectorAll('[data-prx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rx = rxs.find(x => x.id === btn.dataset.prx);
      ctx.printDocument(`
        <div class="border p-8 rounded-xl">
          <h1 class="text-xl font-bold">${u.clinicName}</h1>
          <p class="text-sm text-slate-600 mb-6">${u.name} — ${u.crn}</p>
          <p class="mb-4"><b>Paciente:</b> ${u.userName || u.name}</p>
          <h2 class="font-bold uppercase text-sm mb-3">Prescricao Magistral (${rx.formType})</h2>
          <ul class="space-y-2 mb-6 pl-4 list-disc">${rx.items.map(i => `<li><b>${i.ativo}</b> — ${i.dose}</li>`).join('')}</ul>
          <p class="text-sm"><b>Posologia:</b> ${rx.posologia}</p>
        </div>
      `);
    });
  });

  document.querySelectorAll('[data-prec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = receipts.find(x => x.id === btn.dataset.prec);
      ctx.printDocument(`
        <div class="border-2 border-slate-800 p-8 rounded-xl">
          <h1 class="text-2xl font-bold text-center uppercase mb-2">Recibo de Honorarios</h1>
          <p class="text-center text-sm text-slate-600 mb-6">${u.clinicName} • ${u.name} (${u.crn})</p>
          <p class="text-lg">Recebi a importancia de <b>${fmt(r.amount)}</b> referente a <b>${r.desc}</b>, em <b>${r.date}</b>.</p>
        </div>
      `);
    });
  });
}

// =========================================================================
// 5. CHAT DIRETO COM A NUTRICIONISTA + ATALHO WHATSAPP
// =========================================================================
async function renderMeuChat() {
  const u = ClinicDB.currentSession;
  const messages = (await ClinicDB.getAll('chat')).filter(m => m.patientId === u.patientId).reverse();
  const waLink = u.phone ? `https://wa.me/55${u.phone.replace(/\D/g, '')}` : null;

  document.getElementById('patient-view').innerHTML = `
    <div class="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[75vh]">
      <div class="bg-white px-4 py-3 border-b flex items-center justify-between">
        <div>
          <p class="font-bold text-slate-800 text-sm">${u.name}</p>
          <p class="text-xs text-emerald-600">${u.clinicName} • ${u.crn}</p>
        </div>
        ${waLink ? `<a href="${waLink}" target="_blank" class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">WhatsApp</a>` : ''}
      </div>
      <div id="pchat-scroll" class="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-50">
        ${messages.map(m => `
          <div class="flex ${m.sender === 'PACIENTE' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-xs md:max-w-md px-4 py-2.5 rounded-2xl text-sm shadow-sm ${m.sender === 'PACIENTE' ? 'bg-brand text-white rounded-br-none' : 'bg-white text-slate-800 border rounded-bl-none'}">
              <p>${m.text}</p>
              <p class="text-[10px] mt-1 opacity-70 text-right">${m.time}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <form id="pchat-form" class="p-3 bg-white border-t flex gap-2">
        <input id="pchat-in" placeholder="Escreva sua duvida para a nutri..." required class="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none" />
        <button type="submit" class="bg-brand text-white px-5 rounded-xl font-semibold text-sm">Enviar</button>
      </form>
    </div>
  `;

  const sc = document.getElementById('pchat-scroll');
  if (sc) sc.scrollTop = sc.scrollHeight;

  document.getElementById('pchat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('pchat-in').value.trim();
    if (!text) return;
    await ClinicDB.add('chat', {
      patientId: u.patientId,
      sender: 'PACIENTE',
      text,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    renderMeuChat();
  });
}