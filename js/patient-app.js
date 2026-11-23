import { ClinicDB } from './db.js';
import { mountPatientPortal } from './patient-portal.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
  });
}

function printDocument(html) {
  document.getElementById('print-area').innerHTML = html;
  window.print();
}

function buildGoogleCalendarUrl(ev) {
  const start = `${ev.date.replace(/-/g, '')}T${ev.time.replace(':', '')}00`;
  const [h, m] = ev.time.split(':').map(Number);
  const endHour = String((h + 1) % 24).padStart(2, '0');
  const end = `${ev.date.replace(/-/g, '')}T${endHour}${String(m).padStart(2, '0')}00`;
  const title = encodeURIComponent(`Consulta: ${ev.patientName} (${ev.modalityLabel || ev.type})`);
  const details = encodeURIComponent(`${ev.notes || ''} — Agendado via ${ClinicDB.currentSession.clinicName}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
}

function downloadICS(ev) {
  const start = `${ev.date.replace(/-/g, '')}T${ev.time.replace(':', '')}00`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${start}`, `SUMMARY:Consulta - ${ev.patientName} (${ev.modalityLabel || ev.type})`,
    `DESCRIPTION:${ev.type} ${ev.notes || ''}`, 'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `consulta-${ev.patientName.replace(/\s+/g, '_')}.ics`;
  a.click();
}

function renderWeightChart(evals) {
  if (evals.length < 2) {
    return `<p class="text-xs text-slate-400">Registre pelo menos 2 avaliacoes para gerar o grafico de evolucao.</p>`;
  }
  const weights = evals.map(e => Number(e.weight));
  const minW = Math.min(...weights) - 2;
  const maxW = Math.max(...weights) + 2;
  const w = 400, h = 110, pad = 25;
  const pts = evals.map((e, i) => {
    const x = pad + (i * (w - pad * 2)) / (evals.length - 1);
    const y = h - pad - ((Number(e.weight) - minW) / (maxW - minW || 1)) * (h - pad * 2);
    return { x, y, weight: e.weight, date: e.date.slice(5) };
  });
  const path = pts.map(p => `${p.x},${p.y}`).join(' ');
  return `
    <svg viewBox="0 0 ${w} ${h}" class="w-full h-28 bg-slate-50 rounded-xl border">
      <polyline fill="none" stroke="var(--brand)" stroke-width="3" points="${path}" />
      ${pts.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="var(--brand)" />
        <text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="10" font-weight="bold" fill="#0f172a">${p.weight}kg</text>
        <text x="${p.x}" y="${h - 6}" text-anchor="middle" font-size="9" fill="#64748b">${p.date}</text>
      `).join('')}
    </svg>
  `;
}

async function openPatientPortal(user) {
  if (user.role !== 'PACIENTE') {
    alert('Esta conta pertence a um Profissional/Clinica. Utilize o aplicativo NutriCore Pro (Clinica).');
    await ClinicDB.logout();
    location.reload();
    return;
  }

  if (user.approvalStatus === 'PENDING') {
    alert('Seu cadastro foi criado e esta aguardando o aceite do profissional/clinica para liberar o acesso.');
    await ClinicDB.logout();
    location.reload();
    return;
  }

  if (user.approvalStatus === 'REJECTED') {
    alert('Seu cadastro nao foi aprovado pela clinica. Entre em contato com o consultorio.');
    await ClinicDB.logout();
    location.reload();
    return;
  }

  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  mountPatientPortal({ printDocument, buildGoogleCalendarUrl, downloadICS, renderWeightChart });
  lucide.createIcons();
}

async function bootstrapPatientApp() {
  const badge = document.getElementById('auth-mode-badge');
  if (ClinicDB.isCloudMode) {
    badge.textContent = 'Sincronizado em Tempo Real com sua Clinica';
    document.getElementById('demo-pat-box').classList.add('hidden');
  } else {
    document.getElementById('pat-login-email').value = 'ana@paciente.com';
    document.getElementById('pat-login-pass').value = '123';
  }

  const session = await ClinicDB.init();
  if (session) {
    await openPatientPortal(session);
  } else {
    lucide.createIcons();
  }
}

document.getElementById('patient-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const user = await ClinicDB.login(
      document.getElementById('pat-login-email').value.trim(),
      document.getElementById('pat-login-pass').value,
      'PACIENTE'
    );
    await openPatientPortal(user);
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('toggle-pat-register').addEventListener('click', () => {
  document.getElementById('patient-register-form').classList.toggle('hidden');
});

document.getElementById('patient-register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await ClinicDB.registerPatientSelf({
      clinicIdentifier: document.getElementById('reg-pat-clinic').value.trim(),
      name: document.getElementById('reg-pat-name').value.trim(),
      phone: document.getElementById('reg-pat-phone').value.trim(),
      email: document.getElementById('reg-pat-email').value.trim(),
      password: document.getElementById('reg-pat-pass').value
    });
    alert('Conta criada com sucesso! Seu pedido foi enviado para o profissional liberar seu acesso.');
    document.getElementById('patient-register-form').reset();
    document.getElementById('patient-register-form').classList.add('hidden');
  } catch (err) {
    alert(err.message);
  }
});

bootstrapPatientApp();
