import { mountPatientPortal } from './patient-portal.js';
import { ClinicDB } from './db.js';
import { TACO_DB, calcMacros, getSubstitutes } from './taco.js';

let activeTab = 'prontuario';
let selectedPatientId = null;
let selectedAuthRole = 'PROFISSIONAL'; // 'PROFISSIONAL' | 'PACIENTE'
let formulaItems = [{ ativo: 'Magnesio Dimalato', dose: '300 mg' }];
let draftMeals = [
  { name: 'Cafe da Manha', time: '07:30', items: [{ foodId: 't23', grams: 100 }, { foodId: 't9', grams: 50 }, { foodId: 't36', grams: 150 }] },
  { name: 'Almoco', time: '12:30', items: [{ foodId: 't2', grams: 120 }, { foodId: 't13', grams: 86 }, { foodId: 't17', grams: 130 }, { foodId: 't48', grams: 80 }, { foodId: 't43', grams: 10 }] },
  { name: 'Lanche da Tarde', time: '16:00', items: [{ foodId: 't27', grams: 170 }, { foodId: 't7', grams: 30 }, { foodId: 't34', grams: 70 }] },
  { name: 'Jantar', time: '20:00', items: [{ foodId: 't3', grams: 120 }, { foodId: 't20', grams: 140 }, { foodId: 't49', grams: 50 }] }
];

// Registra Service Worker (Offline + Auto-Update)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

function updateNetworkBadge() {
  const el = document.getElementById('net-status');
  if (!el) return;
  const modeLabel = ClinicDB.isCloudMode ? 'Firebase Cloud' : 'Modo Local';
  if (navigator.onLine) {
    el.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Online • ${modeLabel}`;
    el.className = 'flex items-center gap-2 text-xs text-emerald-400';
  } else {
    el.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Offline • Cache Ativo`;
    el.className = 'flex items-center gap-2 text-xs text-amber-400';
  }
}
window.addEventListener('online', updateNetworkBadge);
window.addEventListener('offline', updateNetworkBadge);

// Seletor de Perfil na tela de Login / Cadastro
function setAuthRole(role) {
  selectedAuthRole = role;
  const isPatient = role === 'PACIENTE';

  document.querySelectorAll('.auth-role-btn').forEach((btn) => {
    const active = btn.dataset.authRole === role;
    btn.className = active
      ? 'auth-role-btn py-2 px-3 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow transition'
      : 'auth-role-btn py-2 px-3 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition';
  });

  const emailLabel = document.getElementById('login-email-label');
  const loginEmail = document.getElementById('login-email');
  const submitBtn = document.getElementById('login-submit-btn');
  const toggleReg = document.getElementById('toggle-register');
  const regPro = document.getElementById('register-form');
  const regPat = document.getElementById('register-patient-form');

  if (emailLabel) emailLabel.textContent = isPatient ? 'E-mail do Paciente' : 'E-mail Profissional';
  if (loginEmail && !ClinicDB.isCloudMode) {
    loginEmail.value = isPatient ? 'ana@paciente.com' : 'clara@nutri.com';
  }
  if (submitBtn) submitBtn.textContent = isPatient ? 'Entrar no Portal do Paciente' : 'Entrar no Consultorio';
  if (toggleReg) {
    toggleReg.textContent = isPatient
      ? 'Criar minha conta de paciente (autocadastro)'
      : 'Cadastrar novo profissional / clinica isolada';
  }

  // Se algum formulario de cadastro estiver aberto, alterna para o perfil escolhido
  if ((regPro && !regPro.classList.contains('hidden')) || (regPat && !regPat.classList.contains('hidden'))) {
    regPro?.classList.toggle('hidden', isPatient);
    regPat?.classList.toggle('hidden', !isPatient);
  }
}

// Inicializacao
async function bootstrap() {
  const badge = document.getElementById('auth-mode-badge');
  if (ClinicDB.isCloudMode) {
    badge.textContent = 'Firebase Auth + Firestore Offline-First';
    document.getElementById('demo-accounts-box').classList.add('hidden');
  } else {
    badge.textContent = 'Modo Local Offline • Pronto para Firebase';
  }

  document.querySelectorAll('.auth-role-btn').forEach((btn) => {
    btn.addEventListener('click', () => setAuthRole(btn.dataset.authRole));
  });
  setAuthRole('PROFISSIONAL');

  const session = await ClinicDB.init();
  if (session) {
    enterApp(session);
  } else {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    lucide.createIcons();
  }
}

function applyBranding(user) {
  document.documentElement.style.setProperty('--brand', user.primaryColor || '#059669');
  document.getElementById('nav-clinic-name').textContent = user.clinicName;
  document.getElementById('nav-prof-name').textContent = `${user.name} • ${user.crn}`;
  document.getElementById('mob-clinic-name').textContent = user.clinicName;
  document.getElementById('mob-prof-name').textContent = `${user.name} • ${user.crn}`;
}

async function enterApp(user) {
  // Bloqueio caso o paciente tenha criado conta e ainda aguarde aceite do profissional
  if (user.role === 'PACIENTE' && user.approvalStatus === 'PENDING') {
    alert('Seu cadastro foi criado e esta aguardando o aceite do profissional/clinica para liberar o acesso.');
    await ClinicDB.logout();
    location.reload();
    return;
  }

  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  if (user.role === 'PACIENTE') {
    mountPatientPortal({ printDocument, buildGoogleCalendarUrl, downloadICS, renderWeightChart });
    lucide.createIcons();
    return;
  }
  applyBranding(user);
  updateNetworkBadge();
  const patients = await ClinicDB.getAll('patients');
  if (!selectedPatientId && patients.length > 0) selectedPatientId = patients[0].id;
  renderTab(activeTab);
}

// Auth listeners
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const user = await ClinicDB.login(
      document.getElementById('login-email').value.trim(),
      document.getElementById('login-pass').value,
      selectedAuthRole
    );
    enterApp(user);
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('toggle-register').addEventListener('click', () => {
  if (selectedAuthRole === 'PACIENTE') {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('register-patient-form').classList.toggle('hidden');
  } else {
    document.getElementById('register-patient-form').classList.add('hidden');
    document.getElementById('register-form').classList.toggle('hidden');
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const user = await ClinicDB.registerTenant({
      clinicName: document.getElementById('reg-clinic').value.trim(),
      name: document.getElementById('reg-name').value.trim(),
      crn: document.getElementById('reg-crn').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-pass').value,
      primaryColor: document.getElementById('reg-color').value
    });
    enterApp(user);
  } catch (err) {
    alert(err.message);
  }
});

// Autocadastro do Paciente (cria login/senha no Firebase e envia solicitacao para aceite)
document.getElementById('register-patient-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (typeof ClinicDB.registerPatientSelf === 'function') {
      await ClinicDB.registerPatientSelf({
        clinicIdentifier: document.getElementById('reg-pat-clinic').value.trim(),
        name: document.getElementById('reg-pat-name').value.trim(),
        phone: document.getElementById('reg-pat-phone').value.trim(),
        email: document.getElementById('reg-pat-email').value.trim(),
        password: document.getElementById('reg-pat-pass').value
      });
    } else {
      await ClinicDB.registerPatientPortalAccess({
        patientName: document.getElementById('reg-pat-name').value.trim(),
        phone: document.getElementById('reg-pat-phone').value.trim(),
        email: document.getElementById('reg-pat-email').value.trim(),
        password: document.getElementById('reg-pat-pass').value,
        clinicIdentifier: document.getElementById('reg-pat-clinic').value.trim(),
        approvalStatus: 'PENDING'
      });
    }
    alert('Conta criada com sucesso! Aguarde o aceite do profissional para entrar no Portal do Paciente.');
    document.getElementById('register-patient-form').reset();
    document.getElementById('register-patient-form').classList.add('hidden');
  } catch (err) {
    alert(err.message);
  }
});

['btn-logout', 'btn-logout-mob'].forEach(id => {
  document.getElementById(id).addEventListener('click', async () => {
    await ClinicDB.logout();
    location.reload();
  });
});

// Modal White-Label
['btn-whitelabel', 'btn-whitelabel-mob'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    const u = ClinicDB.currentSession;
    document.getElementById('wl-clinic').value = u.clinicName || '';
    document.getElementById('wl-name').value = u.name || '';
    document.getElementById('wl-crn').value = u.crn || '';
    document.getElementById('wl-color').value = u.primaryColor || '#059669';
    document.getElementById('wl-modal').classList.remove('hidden');
  });
});
document.getElementById('wl-close').addEventListener('click', () => {
  document.getElementById('wl-modal').classList.add('hidden');
});
document.getElementById('wl-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const updated = await ClinicDB.updateProfile({
    clinicName: document.getElementById('wl-clinic').value.trim(),
    name: document.getElementById('wl-name').value.trim(),
    crn: document.getElementById('wl-crn').value.trim(),
    primaryColor: document.getElementById('wl-color').value
  });
  applyBranding(updated);
  document.getElementById('wl-modal').classList.add('hidden');
});

// Navegacao
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    renderTab(activeTab);
  });
});

function highlightNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.tab === activeTab;
    btn.classList.toggle('bg-brand', isActive && !!btn.closest('aside'));
    btn.classList.toggle('text-white', isActive && !!btn.closest('aside'));
    btn.classList.toggle('text-brand', isActive && !btn.closest('aside'));
    btn.classList.toggle('font-bold', isActive);
  });
}

async function renderTab(tab) {
  highlightNav();
  if (tab === 'prontuario') await renderProntuario();
  if (tab === 'plano') await renderPlanoAlimentar();
  if (tab === 'manipulados') await renderManipulados();
  if (tab === 'financeiro') await renderFinanceiro();
  if (tab === 'agenda') await renderAgenda();
  if (tab === 'chat') await renderChat();
  lucide.createIcons();
}

// =========================================================================
// MODULO 1: PRONTUARIO + ANTROPOMETRIA + GRAFICO DE EVOLUCAO + ACEITE PACIENTE
// =========================================================================
async function renderProntuario() {
  const patients = await ClinicDB.getAll('patients');
  const pendingRequests = typeof ClinicDB.getPendingPatientRequests === 'function'
    ? await ClinicDB.getPendingPatientRequests()
    : patients.filter(p => p.approvalStatus === 'PENDING');

  if (!selectedPatientId && patients.length > 0) selectedPatientId = patients[0].id;
  const patient = patients.find(p => p.id === selectedPatientId) || patients[0];
  const allEvals = await ClinicDB.getAll('evaluations');
  const evals = patient ? allEvals.filter(e => e.patientId === patient.id).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const lastEval = evals[evals.length - 1];

  // Calculos clinicos (IMC, RCQ, TMB Mifflin-St Jeor, GET)
  let imc = '-', imcClass = '', tmb = '-', get = '-', rcq = '-';
  if (patient && lastEval) {
    const hM = (lastEval.height || patient.height || 170) / 100;
    const w = Number(lastEval.weight);
    const imcVal = w / (hM * hM);
    imc = imcVal.toFixed(1);
    imcClass = imcVal < 18.5 ? 'Baixo peso' : imcVal < 25 ? 'Eutrofia' : imcVal < 30 ? 'Sobrepeso' : 'Obesidade';

    const age = Number(patient.age) || 30;
    const hCm = Number(lastEval.height || patient.height || 170);
    const tmbVal = patient.sex === 'M'
      ? (10 * w) + (6.25 * hCm) - (5 * age) + 5
      : (10 * w) + (6.25 * hCm) - (5 * age) - 161;
    tmb = Math.round(tmbVal);
    get = Math.round(tmbVal * (Number(lastEval.activity) || 1.375));
    if (lastEval.waist && lastEval.hip) rcq = (lastEval.waist / lastEval.hip).toFixed(2);
  }

  document.getElementById('main-view').innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Prontuario & Antropometria</h1>
          <p class="text-sm text-slate-500">Cadastro clinico, anamnese, gasto energetico (Mifflin-St Jeor) e evolucao</p>
        </div>
        <button id="toggle-new-patient" class="bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90">
          + Novo Paciente
        </button>
      </div>

      <!-- SOLICITACOES DE ACESSO CRIADAS PELOS PROPRIOS PACIENTES -->
      ${pendingRequests.length > 0 ? `
        <div class="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-amber-900">Novos Cadastros de Pacientes Aguardando Aceite (${pendingRequests.length})</h2>
            <span class="text-[11px] font-semibold text-amber-700">Autocadastro via Firebase</span>
          </div>
          <div class="space-y-2">
            ${pendingRequests.map(req => `
              <div class="bg-white p-3 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="font-bold text-sm text-slate-900">${req.name || req.patientName}</p>
                  <p class="text-xs text-slate-500">${req.email} ${req.phone ? '• ' + req.phone : ''}</p>
                </div>
                <div class="flex gap-2">
                  <button data-approve-pat="${req.uid || req.id}" class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">
                    ✓ Aceitar Paciente
                  </button>
                  <button data-reject-pat="${req.uid || req.id}" class="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300">
                    Recusar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- FORMULARIO NOVO PACIENTE -->
      <form id="new-patient-form" class="hidden bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        <input id="np-name" placeholder="Nome completo" required class="md:col-span-2 px-3 py-2 rounded-xl border text-sm" />
        <input id="np-phone" placeholder="WhatsApp (ex: 21999990000)" class="px-3 py-2 rounded-xl border text-sm" />
        <select id="np-sex" class="px-3 py-2 rounded-xl border text-sm">
          <option value="F">Feminino</option>
          <option value="M">Masculino</option>
        </select>
        <input id="np-age" type="number" placeholder="Idade" required class="px-3 py-2 rounded-xl border text-sm" />
        <input id="np-height" type="number" placeholder="Altura (cm)" required class="px-3 py-2 rounded-xl border text-sm" />
        <input id="np-goal" placeholder="Objetivo (ex: Emagrecimento)" class="px-3 py-2 rounded-xl border text-sm" />
        <input id="np-allergies" placeholder="Alergias / Restricoes" class="px-3 py-2 rounded-xl border text-sm" />
        <textarea id="np-anamnesis" rows="2" placeholder="Anamnese inicial (habitos, sono, intestino, treinos, medicamentos)..." class="md:col-span-3 px-3 py-2 rounded-xl border text-sm"></textarea>
        <button type="submit" class="bg-slate-900 text-white rounded-xl font-semibold text-sm py-2">Salvar Paciente</button>
      </form>

      <!-- SELETOR DE PACIENTE -->
      <div class="flex gap-2 overflow-x-auto pb-1">
        ${patients.map(p => `
          <button data-select-p="${p.id}" class="px-4 py-2 rounded-xl text-sm border shrink-0 transition ${p.id === patient?.id ? 'bg-brand text-white border-transparent font-semibold shadow' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}">
            ${p.name} <span class="opacity-75 text-xs">• ${p.goal || 'Clinico'}</span>
          </button>
        `).join('')}
      </div>

      ${!patient ? '<div class="bg-white p-8 rounded-2xl border text-center text-slate-500">Cadastre seu primeiro paciente acima ou aceite um cadastro pendente para iniciar o prontuario.</div>' : `
        <!-- KPIs CLINICOS -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p class="text-xs font-semibold text-slate-500 uppercase">Peso / IMC</p>
            <p class="text-xl font-bold text-slate-900 mt-1">${lastEval ? lastEval.weight + ' kg' : '-'} <span class="text-sm font-normal text-brand">(${imc})</span></p>
            <p class="text-xs text-slate-400">${imcClass}</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p class="text-xs font-semibold text-slate-500 uppercase">% Gordura / RCQ</p>
            <p class="text-xl font-bold text-slate-900 mt-1">${lastEval?.bodyFat ? lastEval.bodyFat + '%' : '-'} <span class="text-xs font-normal text-slate-500">RCQ: ${rcq}</span></p>
            <p class="text-xs text-slate-400">Cintura: ${lastEval?.waist || '-'}cm</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p class="text-xs font-semibold text-slate-500 uppercase">TMB (Mifflin)</p>
            <p class="text-xl font-bold text-slate-900 mt-1">${tmb} kcal</p>
            <p class="text-xs text-slate-400">Taxa Metabolica Basal</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p class="text-xs font-semibold text-slate-500 uppercase">GET Estimado</p>
            <p class="text-xl font-bold text-brand mt-1">${get} kcal</p>
            <p class="text-xs text-slate-400">Gasto Energetico Total</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- ANAMNESE EDITAVEL -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-slate-800">Anamnese & Alergias</h2>
              <span class="text-xs text-slate-500">${patient.sex === 'M' ? 'Masc' : 'Fem'} • ${patient.age} anos • ${patient.height} cm</span>
            </div>
            <div class="text-xs bg-amber-50 text-amber-800 px-3 py-2 rounded-xl border border-amber-200">
              <b>Alergias / Restricoes:</b> ${patient.allergies || 'Nenhuma relatada'}
            </div>
            <textarea id="edit-anamnesis" rows="5" class="w-full p-3 rounded-xl border text-sm">${patient.anamnesis || ''}</textarea>
            <div class="flex justify-between items-center">
              <button id="btn-go-diet" class="text-xs font-semibold text-brand hover:underline">Abrir Plano Alimentar →</button>
              <button id="save-anamnesis" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold">Salvar Anamnese</button>
            </div>
          </div>

          <!-- NOVA AVALIACAO ANTROPOMETRICA -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 class="font-bold text-slate-800">Registrar Nova Avaliacao Fisica</h2>
            <form id="eval-form" class="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              <input id="ev-date" type="date" value="${new Date().toISOString().slice(0,10)}" required class="px-3 py-2 rounded-xl border text-sm" />
              <input id="ev-weight" type="number" step="0.1" placeholder="Peso (kg)" required class="px-3 py-2 rounded-xl border text-sm" />
              <input id="ev-bf" type="number" step="0.1" placeholder="% Gordura" class="px-3 py-2 rounded-xl border text-sm" />
              <input id="ev-waist" type="number" step="0.5" placeholder="Cintura (cm)" class="px-3 py-2 rounded-xl border text-sm" />
              <input id="ev-hip" type="number" step="0.5" placeholder="Quadril (cm)" class="px-3 py-2 rounded-xl border text-sm" />
              <select id="ev-act" class="px-2 py-2 rounded-xl border text-xs">
                <option value="1.2">Sedentario (1.2)</option>
                <option value="1.375">Leve 1-3x (1.375)</option>
                <option value="1.55" selected>Moderado 3-5x (1.55)</option>
                <option value="1.725">Intenso 6-7x (1.725)</option>
              </select>
              <button type="submit" class="col-span-2 md:col-span-3 bg-brand text-white py-2.5 rounded-xl font-semibold text-sm">
                + Registrar Avaliacao no Historico
              </button>
            </form>

            <!-- GRAFICO DE EVOLUCAO SVG NATIVO (OFFLINE) -->
            <div class="pt-2 border-t">
              <p class="text-xs font-semibold text-slate-500 uppercase mb-2">Evolucao de Peso (kg)</p>
              ${renderWeightChart(evals)}
            </div>
          </div>
        </div>
      `}
    </div>
  `;

  document.getElementById('toggle-new-patient').addEventListener('click', () => {
    document.getElementById('new-patient-form').classList.toggle('hidden');
  });

  document.querySelectorAll('[data-approve-pat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.approvePat;
      if (typeof ClinicDB.approvePatientRequest === 'function') {
        await ClinicDB.approvePatientRequest(uid, 'APPROVED');
      } else {
        await ClinicDB.update('patients', uid, { approvalStatus: 'APPROVED' });
      }
      alert('Paciente aceito! O acesso ao Portal do Paciente foi liberado.');
      renderProntuario();
    });
  });

  document.querySelectorAll('[data-reject-pat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.rejectPat;
      if (typeof ClinicDB.approvePatientRequest === 'function') {
        await ClinicDB.approvePatientRequest(uid, 'REJECTED');
      } else {
        await ClinicDB.remove('patients', uid);
      }
      renderProntuario();
    });
  });

  document.getElementById('new-patient-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const created = await ClinicDB.add('patients', {
      name: document.getElementById('np-name').value.trim(),
      phone: document.getElementById('np-phone').value.trim(),
      sex: document.getElementById('np-sex').value,
      age: Number(document.getElementById('np-age').value),
      height: Number(document.getElementById('np-height').value),
      goal: document.getElementById('np-goal').value.trim(),
      allergies: document.getElementById('np-allergies').value.trim(),
      anamnesis: document.getElementById('np-anamnesis').value.trim()
    });
    selectedPatientId = created.id;
    renderProntuario();
  });

  document.querySelectorAll('[data-select-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPatientId = btn.dataset.selectP;
      renderProntuario();
    });
  });

  if (patient) {
    document.getElementById('save-anamnesis').addEventListener('click', async () => {
      await ClinicDB.update('patients', patient.id, { anamnesis: document.getElementById('edit-anamnesis').value });
      alert('Anamnese atualizada com sucesso!');
    });

    document.getElementById('btn-go-diet').addEventListener('click', () => {
      activeTab = 'plano';
      renderTab('plano');
    });

    document.getElementById('eval-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await ClinicDB.add('evaluations', {
        patientId: patient.id,
        date: document.getElementById('ev-date').value,
        weight: parseFloat(document.getElementById('ev-weight').value),
        height: patient.height,
        bodyFat: parseFloat(document.getElementById('ev-bf').value) || null,
        waist: parseFloat(document.getElementById('ev-waist').value) || null,
        hip: parseFloat(document.getElementById('ev-hip').value) || null,
        activity: parseFloat(document.getElementById('ev-act').value)
      });
      renderProntuario();
    });
  }
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

// =========================================================================
// MODULO 2: PLANO ALIMENTAR (TABELA TACO + SUBSTITUICOES + PDF)
// =========================================================================
async function renderPlanoAlimentar() {
  const patients = await ClinicDB.getAll('patients');
  const patient = patients.find(p => p.id === selectedPatientId) || patients[0];
  const savedPlans = (await ClinicDB.getAll('mealPlans')).filter(pl => !patient || pl.patientId === patient.id);

  let totalKcal = 0, totalPtn = 0, totalCho = 0, totalLip = 0, totalFib = 0;
  draftMeals.forEach(m => m.items.forEach(it => {
    const food = TACO_DB.find(f => f.id === it.foodId);
    if (!food) return;
    const mc = calcMacros(food, it.grams);
    totalKcal += mc.kcal; totalPtn += mc.ptn; totalCho += mc.cho; totalLip += mc.lip; totalFib += mc.fib;
  }));

  const ptnPct = totalKcal ? Math.round((totalPtn * 4 / totalKcal) * 100) : 0;
  const choPct = totalKcal ? Math.round((totalCho * 4 / totalKcal) * 100) : 0;
  const lipPct = totalKcal ? Math.round((totalLip * 9 / totalKcal) * 100) : 0;

  document.getElementById('main-view').innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Plano Alimentar (Tabela TACO)</h1>
          <p class="text-sm text-slate-500">Paciente ativo: <b class="text-slate-800">${patient?.name || 'Selecione no Prontuario'}</b></p>
        </div>
        <div class="flex gap-2">
          <button id="btn-add-meal" class="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-semibold">+ Refeicao</button>
          <button id="btn-save-plan" class="px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold shadow">Salvar e Gerar PDF</button>
        </div>
      </div>

      <div class="bg-slate-900 text-white p-5 rounded-2xl grid grid-cols-2 md:grid-cols-5 gap-4 shadow-md">
        <div>
          <p class="text-[11px] text-slate-400 uppercase">Energia Total</p>
          <p class="text-2xl font-bold text-emerald-400">${Math.round(totalKcal)} <span class="text-xs font-normal">kcal</span></p>
        </div>
        <div>
          <p class="text-[11px] text-slate-400 uppercase">Proteinas (${ptnPct}%)</p>
          <p class="text-xl font-bold">${totalPtn.toFixed(1)}g</p>
        </div>
        <div>
          <p class="text-[11px] text-slate-400 uppercase">Carboidratos (${choPct}%)</p>
          <p class="text-xl font-bold">${totalCho.toFixed(1)}g</p>
        </div>
        <div>
          <p class="text-[11px] text-slate-400 uppercase">Gorduras (${lipPct}%)</p>
          <p class="text-xl font-bold">${totalLip.toFixed(1)}g</p>
        </div>
        <div>
          <p class="text-[11px] text-slate-400 uppercase">Fibras</p>
          <p class="text-xl font-bold">${totalFib.toFixed(1)}g</p>
        </div>
      </div>

      <div class="space-y-4">
        ${draftMeals.map((meal, mIdx) => {
          let mKcal = 0;
          meal.items.forEach(it => {
            const f = TACO_DB.find(x => x.id === it.foodId);
            if (f) mKcal += calcMacros(f, it.grams).kcal;
          });
          return `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <input data-meal-name="${mIdx}" value="${meal.name}" class="font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-emerald-500 outline-none text-sm" />
                  <input data-meal-time="${mIdx}" type="time" value="${meal.time}" class="text-xs border rounded-lg px-2 py-1 bg-white" />
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-xs font-bold text-brand">${mKcal} kcal</span>
                  <button data-rm-meal="${mIdx}" class="text-xs text-rose-500 hover:underline">Remover</button>
                </div>
              </div>

              <div class="p-4 space-y-2.5">
                ${meal.items.map((it, iIdx) => {
                  const food = TACO_DB.find(f => f.id === it.foodId) || TACO_DB[0];
                  const mc = calcMacros(food, it.grams);
                  const subs = getSubstitutes(food.id, it.grams);
                  return `
                    <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <select data-food-sel="${mIdx}-${iIdx}" class="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-lg border bg-white text-sm">
                          ${TACO_DB.map(t => `<option value="${t.id}" ${t.id === it.foodId ? 'selected' : ''}>${t.name} (${t.cat})</option>`).join('')}
                        </select>
                        <div class="flex items-center gap-1">
                          <input data-grams="${mIdx}-${iIdx}" type="number" value="${it.grams}" class="w-20 px-2 py-1.5 rounded-lg border bg-white text-sm text-center font-semibold" />
                          <span class="text-xs text-slate-500">g</span>
                        </div>
                        <span class="text-xs text-slate-600 font-medium">${mc.kcal} kcal • P:${mc.ptn} C:${mc.cho} G:${mc.lip}</span>
                        <button data-rm-item="${mIdx}-${iIdx}" class="text-rose-500 text-xs font-bold px-2">X</button>
                      </div>
                      <p class="text-[11px] text-slate-500">
                        <b>Substituicoes equivalentes (TACO):</b> ${subs.join(' ou ') || 'Livre'}
                      </p>
                    </div>
                  `;
                }).join('')}

                <button data-add-item="${mIdx}" class="text-xs font-semibold text-brand hover:underline pt-1">+ Adicionar alimento da tabela TACO</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${savedPlans.length > 0 ? `
        <div class="space-y-2">
          <h2 class="text-sm font-bold text-slate-600 uppercase">Planos Salvos no Prontuario</h2>
          ${savedPlans.map(pl => `
            <div class="bg-white p-4 rounded-xl border flex items-center justify-between">
              <div>
                <p class="font-bold text-sm text-slate-800">${pl.title} (${pl.totalKcal} kcal)</p>
                <p class="text-xs text-slate-500">Salvo em ${pl.createdAt.slice(0,10)} • P:${pl.totalPtn}g C:${pl.totalCho}g G:${pl.totalLip}g</p>
              </div>
              <button data-print-plan="${pl.id}" class="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold">Imprimir PDF</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('btn-add-meal').addEventListener('click', () => {
    draftMeals.push({ name: 'Nova Refeicao', time: '10:00', items: [{ foodId: 't35', grams: 130 }] });
    renderPlanoAlimentar();
  });

  document.querySelectorAll('[data-meal-name]').forEach(inp => {
    inp.addEventListener('change', () => { draftMeals[inp.dataset.mealName].name = inp.value; });
  });
  document.querySelectorAll('[data-meal-time]').forEach(inp => {
    inp.addEventListener('change', () => { draftMeals[inp.dataset.mealTime].time = inp.value; });
  });
  document.querySelectorAll('[data-rm-meal]').forEach(btn => {
    btn.addEventListener('click', () => { draftMeals.splice(btn.dataset.rmMeal, 1); renderPlanoAlimentar(); });
  });
  document.querySelectorAll('[data-add-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      draftMeals[btn.dataset.addItem].items.push({ foodId: 't1', grams: 100 });
      renderPlanoAlimentar();
    });
  });
  document.querySelectorAll('[data-rm-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [m, i] = btn.dataset.rmItem.split('-').map(Number);
      draftMeals[m].items.splice(i, 1);
      renderPlanoAlimentar();
    });
  });
  document.querySelectorAll('[data-food-sel]').forEach(sel => {
    sel.addEventListener('change', () => {
      const [m, i] = sel.dataset.foodSel.split('-').map(Number);
      const food = TACO_DB.find(f => f.id === sel.value);
      draftMeals[m].items[i].foodId = sel.value;
      if (food) draftMeals[m].items[i].grams = food.pesoMedida;
      renderPlanoAlimentar();
    });
  });
  document.querySelectorAll('[data-grams]').forEach(inp => {
    inp.addEventListener('change', () => {
      const [m, i] = inp.dataset.grams.split('-').map(Number);
      draftMeals[m].items[i].grams = Number(inp.value) || 0;
      renderPlanoAlimentar();
    });
  });

  document.getElementById('btn-save-plan').addEventListener('click', async () => {
    const plan = await ClinicDB.add('mealPlans', {
      patientId: patient?.id || 'geral',
      patientName: patient?.name || 'Paciente',
      title: `Plano Alimentar - ${patient?.name || 'Paciente'}`,
      totalKcal: Math.round(totalKcal),
      totalPtn: +totalPtn.toFixed(1),
      totalCho: +totalCho.toFixed(1),
      totalLip: +totalLip.toFixed(1),
      meals: JSON.parse(JSON.stringify(draftMeals))
    });
    printMealPlan(plan);
    renderPlanoAlimentar();
  });

  document.querySelectorAll('[data-print-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pl = savedPlans.find(x => x.id === btn.dataset.printPlan);
      if (pl) printMealPlan(pl);
    });
  });
}

function printMealPlan(plan) {
  const u = ClinicDB.currentSession;
  printDocument(`
    <div class="space-y-5">
      <div class="flex justify-between items-center border-b-2 border-slate-800 pb-4">
        <div>
          <h1 class="text-2xl font-bold">${u.clinicName}</h1>
          <p class="text-sm text-slate-600">${u.name} • ${u.crn}</p>
        </div>
        <div class="text-right text-xs text-slate-600">
          <p class="font-bold text-sm text-slate-900">${plan.patientName}</p>
          <p>Meta: ${plan.totalKcal} kcal (P:${plan.totalPtn}g | C:${plan.totalCho}g | G:${plan.totalLip}g)</p>
        </div>
      </div>

      ${plan.meals.map(m => `
        <div class="border rounded-xl p-4 break-inside-avoid">
          <h2 class="font-bold text-base border-b pb-1 mb-2">${m.time} — ${m.name}</h2>
          <ul class="space-y-2 text-sm">
            ${m.items.map(it => {
              const f = TACO_DB.find(x => x.id === it.foodId);
              if (!f) return '';
              const subs = getSubstitutes(f.id, it.grams);
              return `
                <li>
                  <b>${f.name}</b> — ${it.grams}g <span class="text-xs text-slate-500">(${f.medida})</span>
                  ${subs.length ? `<br/><span class="text-xs text-slate-600">↳ Opcoes de substituicao: ${subs.join(' ou ')}</span>` : ''}
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      `).join('')}

      <div class="pt-10 text-center text-xs text-slate-600">
        <div class="w-64 border-t border-slate-800 mx-auto pt-2">
          <b>${u.name}</b> • ${u.crn}
        </div>
      </div>
    </div>
  `);
}

// =========================================================================
// MODULO 3: PRESCRICAO DE MANIPULADOS + PDF
// =========================================================================
async function renderManipulados() {
  const saved = await ClinicDB.getAll('prescriptions');
  const patients = await ClinicDB.getAll('patients');
  const activeP = patients.find(p => p.id === selectedPatientId) || patients[0];

  document.getElementById('main-view').innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Prescricao de Manipulados</h1>
        <p class="text-sm text-slate-500">Formulas magistrais personalizadas com receituario timbrado</p>
      </div>

      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-semibold text-slate-500 uppercase">Paciente</label>
            <input id="rx-patient" list="patients-list" class="w-full mt-1 px-3 py-2 rounded-xl border text-sm" value="${activeP?.name || ''}" />
            <datalist id="patients-list">${patients.map(p => `<option value="${p.name}">`).join('')}</datalist>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-500 uppercase">Forma Farmaceutica</label>
            <input id="rx-form-type" value="60 capsulas vegetais (Uso Oral)" class="w-full mt-1 px-3 py-2 rounded-xl border text-sm" />
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-slate-500 uppercase">Ativos da Formula</label>
            <button id="add-ativo" type="button" class="text-xs font-semibold text-brand hover:underline">+ Adicionar Ativo</button>
          </div>
          <div class="space-y-2">
            ${formulaItems.map((f, idx) => `
              <div class="flex gap-2">
                <input data-idx="${idx}" data-field="ativo" value="${f.ativo}" placeholder="Ex: Ashwagandha KSM-66" class="flex-1 px-3 py-2 rounded-xl border text-sm" />
                <input data-idx="${idx}" data-field="dose" value="${f.dose}" placeholder="Ex: 300 mg" class="w-32 px-3 py-2 rounded-xl border text-sm" />
                <button data-rm-ativo="${idx}" type="button" class="px-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold">X</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-500 uppercase">Posologia</label>
          <textarea id="rx-posologia" rows="2" class="w-full mt-1 px-3 py-2 rounded-xl border text-sm">Tomar 1 dose (2 capsulas) apos o jantar, por 30 dias.</textarea>
        </div>

        <button id="save-rx" class="bg-brand text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90">
          Salvar e Imprimir Receituario (PDF)
        </button>
      </div>

      <div class="space-y-2">
        <h2 class="text-sm font-bold text-slate-600 uppercase">Historico de Prescricoes</h2>
        ${saved.map(rx => `
          <div class="bg-white p-4 rounded-xl border flex items-center justify-between">
            <div>
              <p class="font-bold text-sm text-slate-800">${rx.patient} — <span class="font-normal text-slate-500">${rx.formType}</span></p>
              <p class="text-xs text-slate-500">${rx.items.map(i => `${i.ativo} (${i.dose})`).join(' • ')}</p>
            </div>
            <button data-print-rx="${rx.id}" class="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold">Imprimir</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.querySelectorAll('[data-field]').forEach(inp => {
    inp.addEventListener('input', () => { formulaItems[inp.dataset.idx][inp.dataset.field] = inp.value; });
  });
  document.getElementById('add-ativo').addEventListener('click', () => { formulaItems.push({ ativo: '', dose: '' }); renderManipulados(); });
  document.querySelectorAll('[data-rm-ativo]').forEach(btn => {
    btn.addEventListener('click', () => { formulaItems.splice(btn.dataset.rmAtivo, 1); renderManipulados(); });
  });
  document.getElementById('save-rx').addEventListener('click', async () => {
    const rx = await ClinicDB.add('prescriptions', {
      patient: document.getElementById('rx-patient').value || 'Paciente',
      formType: document.getElementById('rx-form-type').value,
      posologia: document.getElementById('rx-posologia').value,
      items: JSON.parse(JSON.stringify(formulaItems.filter(i => i.ativo.trim())))
    });
    printRx(rx);
    renderManipulados();
  });
  document.querySelectorAll('[data-print-rx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rx = saved.find(r => r.id === btn.dataset.printRx);
      if (rx) printRx(rx);
    });
  });
}

function printRx(rx) {
  const u = ClinicDB.currentSession;
  printDocument(`
    <div class="border p-8 rounded-xl">
      <div class="flex justify-between items-start border-b pb-4 mb-6">
        <div>
          <h1 class="text-xl font-bold">${u.clinicName}</h1>
          <p class="text-sm text-slate-600">${u.name} — ${u.crn}</p>
        </div>
        <p class="text-xs text-slate-500">Data: ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>
      <p class="mb-4"><b>Paciente:</b> ${rx.patient}</p>
      <h2 class="font-bold uppercase text-sm mb-3">Prescricao Magistral (${rx.formType})</h2>
      <ul class="space-y-2 mb-6 pl-4 list-disc">
        ${rx.items.map(i => `<li><b>${i.ativo}</b> ........................................ ${i.dose}</li>`).join('')}
      </ul>
      <div class="p-4 bg-slate-50 rounded-lg border mb-12">
        <p class="text-xs font-bold uppercase text-slate-500">Posologia:</p>
        <p class="text-sm mt-1">${rx.posologia}</p>
      </div>
      <div class="text-center mt-14">
        <div class="w-64 border-t border-slate-800 mx-auto pt-2 text-sm"><b>${u.name}</b><br/>${u.crn}</div>
      </div>
    </div>
  `);
}

// =========================================================================
// MODULO 4: FINANCEIRO COMPLETO + VALORES DOS PLANOS + SALDO MERCADO PAGO
// =========================================================================
async function renderFinanceiro() {
  const list = await ClinicDB.getAll('finance');
  const cfg = await ClinicDB.getScheduleConfig();
  const pricing = {
    consulta: Number(cfg.priceConsulta ?? 250),
    planoTri: Number(cfg.pricePlanoTri ?? 650),
    planoSemestral: Number(cfg.pricePlanoSemestral ?? 1150)
  };

  const receitasPagas = list.filter(i => i.type === 'RECEITA' && i.status === 'PAGO').reduce((s, i) => s + Number(i.amount), 0);
  const aReceber = list.filter(i => i.type === 'RECEITA' && i.status === 'PENDENTE').reduce((s, i) => s + Number(i.amount), 0);
  const despesas = list.filter(i => i.type === 'DESPESA').reduce((s, i) => s + Number(i.amount), 0);
  const saldo = receitasPagas - despesas;
  const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  document.getElementById('main-view').innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Financeiro Completo & Tabela de Planos</h1>
        <p class="text-sm text-slate-500">Valores de consulta/planos sincronizados com o Portal do Paciente, fluxo de caixa e recibos</p>
      </div>

      <!-- TABELA DE VALORES CONFIGURAVEL PELO PROFISSIONAL -->
      <form id="pricing-form" class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-slate-800 text-sm uppercase">Tabela de Valores (Carrega no App e Portal do Paciente)</h2>
          <span class="text-xs text-emerald-600 font-semibold">Sincronizacao Automatica</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label class="text-[11px] font-bold text-slate-500 uppercase">Consulta Avulsa (R$)</label>
            <input id="pr-consulta" type="number" step="0.01" value="${pricing.consulta}" required class="w-full mt-1 px-3 py-2 rounded-xl border text-sm font-semibold" />
          </div>
          <div>
            <label class="text-[11px] font-bold text-slate-500 uppercase">Plano Trimestral (R$)</label>
            <input id="pr-tri" type="number" step="0.01" value="${pricing.planoTri}" required class="w-full mt-1 px-3 py-2 rounded-xl border text-sm font-semibold" />
          </div>
          <div>
            <label class="text-[11px] font-bold text-slate-500 uppercase">Plano Semestral (R$)</label>
            <input id="pr-semestral" type="number" step="0.01" value="${pricing.planoSemestral}" required class="w-full mt-1 px-3 py-2 rounded-xl border text-sm font-semibold" />
          </div>
          <button type="submit" class="self-end bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl py-2.5 text-sm">
            Salvar Valores
          </button>
        </div>
      </form>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded-2xl border shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase">Saldo em Caixa</p>
          <p class="text-xl font-bold mt-1 ${saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}">${fmt(saldo)}</p>
        </div>
        <div class="bg-white p-4 rounded-2xl border shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase">Recebido</p>
          <p class="text-xl font-bold mt-1 text-slate-900">${fmt(receitasPagas)}</p>
        </div>
        <div class="bg-white p-4 rounded-2xl border shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase">A Receber</p>
          <p class="text-xl font-bold mt-1 text-amber-600">${fmt(aReceber)}</p>
        </div>
        <div class="bg-white p-4 rounded-2xl border shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase">Despesas</p>
          <p class="text-xl font-bold mt-1 text-rose-600">${fmt(despesas)}</p>
        </div>
      </div>

      <!-- LANCAMENTO FINANCEIRO COM SELECAO DE PLANO E SALDO MERCADO PAGO -->
      <form id="fin-form" class="bg-white p-5 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-7 gap-3">
        <select id="fin-plan-preset" class="px-3 py-2 rounded-xl border text-sm bg-slate-50">
          <option value="consulta">Consulta (${fmt(pricing.consulta)})</option>
          <option value="planoTri">Plano Tri (${fmt(pricing.planoTri)})</option>
          <option value="planoSemestral">Plano Semestral (${fmt(pricing.planoSemestral)})</option>
          <option value="custom">Outro / Personalizado</option>
        </select>
        <input id="fin-desc" value="Consulta Nutricional" placeholder="Descricao" required class="md:col-span-2 px-3 py-2 rounded-xl border text-sm" />
        <select id="fin-type" class="px-3 py-2 rounded-xl border text-sm">
          <option value="RECEITA">Receita (+)</option>
          <option value="DESPESA">Despesa (-)</option>
        </select>
        <input id="fin-amount" type="number" step="0.01" value="${pricing.consulta}" placeholder="Valor R$" required class="px-3 py-2 rounded-xl border text-sm" />
        <select id="fin-method" class="px-3 py-2 rounded-xl border text-sm">
          <option value="PIX">PIX</option>
          <option value="CARTAO">Cartao</option>
          <option value="SALDO_MP">Saldo do Mercado Pago</option>
          <option value="DINHEIRO">Dinheiro / Transferencia</option>
        </select>
        <div class="flex gap-2">
          <select id="fin-status" class="px-2 py-2 rounded-xl border text-xs flex-1">
            <option value="PAGO">Pago</option>
            <option value="PENDENTE">Pendente</option>
          </select>
          <button type="submit" class="bg-brand text-white font-semibold rounded-xl px-4 py-2 text-sm">+ Lancar</button>
        </div>
      </form>

      <div class="bg-white rounded-2xl border shadow-sm overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-slate-500 text-xs uppercase border-b">
            <tr>
              <th class="p-4">Descricao</th>
              <th class="p-4">Meio</th>
              <th class="p-4">Data</th>
              <th class="p-4">Valor</th>
              <th class="p-4">Status</th>
              <th class="p-4 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${list.map(item => `
              <tr class="hover:bg-slate-50">
                <td class="p-4 font-medium">${item.desc}</td>
                <td class="p-4 text-xs font-semibold text-slate-600">${item.paymentMethod || 'PIX'}</td>
                <td class="p-4 text-slate-500">${item.date}</td>
                <td class="p-4 font-semibold ${item.type === 'RECEITA' ? 'text-emerald-600' : 'text-rose-600'}">
                  ${item.type === 'RECEITA' ? '+' : '-'} ${fmt(Number(item.amount))}
                </td>
                <td class="p-4">
                  <button data-toggle-fin="${item.id}" class="px-2.5 py-1 rounded-full text-xs font-semibold ${item.status === 'PAGO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                    ${item.status}
                  </button>
                </td>
                <td class="p-4 text-right space-x-2">
                  ${item.type === 'RECEITA' ? `<button data-receipt="${item.id}" class="text-xs text-brand font-semibold hover:underline">Recibo PDF</button>` : ''}
                  <button data-del-fin="${item.id}" class="text-xs text-rose-500 hover:underline">Excluir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('pricing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await ClinicDB.saveScheduleConfig({
      ...cfg,
      priceConsulta: parseFloat(document.getElementById('pr-consulta').value) || 0,
      pricePlanoTri: parseFloat(document.getElementById('pr-tri').value) || 0,
      pricePlanoSemestral: parseFloat(document.getElementById('pr-semestral').value) || 0
    });
    alert('Valores da Consulta, Plano Trimestral e Plano Semestral salvos e sincronizados!');
    renderFinanceiro();
  });

  document.getElementById('fin-plan-preset').addEventListener('change', (e) => {
    const val = e.target.value;
    const descEl = document.getElementById('fin-desc');
    const amountEl = document.getElementById('fin-amount');
    if (val === 'consulta') {
      descEl.value = 'Consulta Nutricional';
      amountEl.value = pricing.consulta;
    } else if (val === 'planoTri') {
      descEl.value = 'Plano Trimestral';
      amountEl.value = pricing.planoTri;
    } else if (val === 'planoSemestral') {
      descEl.value = 'Plano Semestral';
      amountEl.value = pricing.planoSemestral;
    }
  });

  document.getElementById('fin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await ClinicDB.add('finance', {
      desc: document.getElementById('fin-desc').value,
      type: document.getElementById('fin-type').value,
      amount: parseFloat(document.getElementById('fin-amount').value),
      paymentMethod: document.getElementById('fin-method').value,
      status: document.getElementById('fin-status').value,
      date: new Date().toISOString().slice(0, 10)
    });
    renderFinanceiro();
  });

  document.querySelectorAll('[data-toggle-fin]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = list.find(i => i.id === btn.dataset.toggleFin);
      await ClinicDB.update('finance', item.id, { status: item.status === 'PAGO' ? 'PENDENTE' : 'PAGO' });
      renderFinanceiro();
    });
  });

  document.querySelectorAll('[data-del-fin]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await ClinicDB.remove('finance', btn.dataset.delFin);
      renderFinanceiro();
    });
  });

  document.querySelectorAll('[data-receipt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = list.find(i => i.id === btn.dataset.receipt);
      const u = ClinicDB.currentSession;
      printDocument(`
        <div class="border-2 border-slate-800 p-8 rounded-xl">
          <h1 class="text-2xl font-bold text-center uppercase mb-2">Recibo de Honorarios Nutricionais</h1>
          <p class="text-center text-sm text-slate-600 mb-8">${u.clinicName} • ${u.name} (${u.crn})</p>
          <p class="text-lg leading-relaxed mb-6">
            Recebi a importancia de <b>${fmt(Number(item.amount))}</b> referente a <b>${item.desc}</b> (${item.paymentMethod || 'PIX'}), na data de <b>${item.date}</b>.
          </p>
          <div class="mt-16 text-center">
            <div class="w-64 border-t border-slate-800 mx-auto pt-2 text-sm"><b>${u.name}</b><br/>${u.crn}</div>
          </div>
        </div>
      `);
    });
  });
}

// =========================================================================
// MODULO 5: AGENDA + GOOGLE CALENDAR + .ICS + REMARCAR / EXCLUIR CONSULTAS
// =========================================================================
async function renderAgenda() {
  const events = await ClinicDB.getAll('agenda');
  const cfg = await ClinicDB.getScheduleConfig();
  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const priceConsulta = Number(cfg.priceConsulta ?? 250);
  const priceTri = Number(cfg.pricePlanoTri ?? 650);
  const priceSem = Number(cfg.pricePlanoSemestral ?? 1150);

  document.getElementById('main-view').innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Agenda & Autoagendamento</h1>
          <p class="text-sm text-slate-500">Gerencie consultas, aprove solicitacoes do Portal do Cliente, remarque ou exclua agendamentos</p>
        </div>
        <button id="toggle-sched-cfg" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold">Configurar Horarios & PIX</button>
      </div>

      <form id="sched-cfg-form" class="hidden bg-white p-5 rounded-2xl border-2 border-slate-800 shadow-sm grid grid-cols-2 md:grid-cols-5 gap-3">
        <div><label class="text-[11px] font-bold text-slate-500">Inicio</label><input id="sc-start" type="time" value="${cfg.startHour}" class="w-full px-2 py-1.5 rounded-lg border text-sm" /></div>
        <div><label class="text-[11px] font-bold text-slate-500">Fim</label><input id="sc-end" type="time" value="${cfg.endHour}" class="w-full px-2 py-1.5 rounded-lg border text-sm" /></div>
        <div><label class="text-[11px] font-bold text-slate-500">Almoco Inicio</label><input id="sc-ls" type="time" value="${cfg.lunchStart}" class="w-full px-2 py-1.5 rounded-lg border text-sm" /></div>
        <div><label class="text-[11px] font-bold text-slate-500">Almoco Fim</label><input id="sc-le" type="time" value="${cfg.lunchEnd}" class="w-full px-2 py-1.5 rounded-lg border text-sm" /></div>
        <div><label class="text-[11px] font-bold text-slate-500">Duracao (min)</label><input id="sc-min" type="number" value="${cfg.slotMinutes}" class="w-full px-2 py-1.5 rounded-lg border text-sm" /></div>
        <div class="col-span-2 md:col-span-2"><label class="text-[11px] font-bold text-slate-500">URL Backend Mercado Pago</label><input id="sc-mp-url" value="${cfg.mpApiUrl || 'https://nutricore-backend.onrender.com'}" placeholder="https://sua-api.onrender.com" class="w-full px-3 py-1.5 rounded-lg border text-sm" /></div>
        <div class="col-span-2 md:col-span-2"><label class="text-[11px] font-bold text-slate-500">Chave PIX Reserva</label><input id="sc-pix" value="${cfg.pixKey || ''}" class="w-full px-3 py-1.5 rounded-lg border text-sm" /></div>
        <button type="submit" class="col-span-2 md:col-span-1 self-end bg-brand text-white py-2 rounded-xl text-xs font-bold">Salvar Grade</button>
      </form>

      <form id="agenda-form" class="bg-white p-5 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3">
        <input id="ag-patient" placeholder="Nome do Paciente" required class="md:col-span-2 px-3 py-2 rounded-xl border text-sm" />
        <input id="ag-date" type="date" value="${new Date().toISOString().slice(0,10)}" required class="px-3 py-2 rounded-xl border text-sm" />
        <input id="ag-time" type="time" value="15:00" required class="px-3 py-2 rounded-xl border text-sm" />
        <select id="ag-plan" class="px-3 py-2 rounded-xl border text-sm bg-slate-50">
          <option value="Consulta (${fmt(priceConsulta)})" data-amount="${priceConsulta}">Consulta (${fmt(priceConsulta)})</option>
          <option value="Plano Trimestral (${fmt(priceTri)})" data-amount="${priceTri}">Plano Tri (${fmt(priceTri)})</option>
          <option value="Plano Semestral (${fmt(priceSem)})" data-amount="${priceSem}">Plano Semestral (${fmt(priceSem)})</option>
        </select>
        <button type="submit" class="bg-brand text-white font-semibold rounded-xl py-2 text-sm">+ Agendar</button>
        <input id="ag-phone" placeholder="WhatsApp (ex: 21999990000)" class="px-3 py-2 rounded-xl border text-sm" />
        <select id="ag-pay-method" class="px-3 py-2 rounded-xl border text-sm">
          <option value="PIX">PIX</option>
          <option value="CARTAO">Cartao</option>
          <option value="SALDO_MP">Saldo do Mercado Pago</option>
        </select>
        <input id="ag-notes" placeholder="Observacoes / Link chamada" class="md:col-span-4 px-3 py-2 rounded-xl border text-sm" />
      </form>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${events.map(ev => {
          const waMsg = encodeURIComponent(`Ola ${ev.patientName}! Confirmando sua consulta (${ev.type}) em ${ev.date} as ${ev.time} na ${ClinicDB.currentSession.clinicName}.`);
          const waLink = ev.phone ? `https://wa.me/55${ev.phone.replace(/\D/g, '')}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;
          return `
            <div class="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between gap-4">
              <div>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">${ev.date} as ${ev.time}</span>
                    ${ev.status ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${ev.status === 'CONFIRMADO' ? 'bg-emerald-100 text-emerald-700' : ev.status === 'REMARCADO' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${ev.status}</span>` : ''}
                    ${ev.status && ev.status !== 'CONFIRMADO' ? `<button data-approve-ag="${ev.id}" class="text-xs font-bold text-brand hover:underline">✓ Aprovar</button>` : ''}
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button data-reschedule-ag="${ev.id}" class="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold">
                      Remarcar
                    </button>
                    <button data-del-ag="${ev.id}" class="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold">
                      Excluir
                    </button>
                  </div>
                </div>
                <h3 class="font-bold text-lg text-slate-900 mt-2">${ev.patientName}</h3>
                <p class="text-sm text-slate-600">${ev.type || 'Consulta Nutricional'} ${ev.amount ? `• <b>${fmt(ev.amount)}</b>` : ''} ${ev.paymentMethod ? `(${ev.paymentMethod})` : ''}</p>
                ${ev.notes ? `<p class="text-xs text-slate-400 mt-1">${ev.notes}</p>` : ''}
              </div>
              <div class="flex flex-wrap gap-2 pt-3 border-t">
                <a href="${buildGoogleCalendarUrl(ev)}" target="_blank" class="flex-1 text-center px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
                  Google Calendar
                </a>
                <a href="${waLink}" target="_blank" class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                  WhatsApp
                </a>
                <button data-ics="${ev.id}" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">
                  .ICS
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  document.getElementById('agenda-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const planSel = document.getElementById('ag-plan');
    const selectedOpt = planSel.options[planSel.selectedIndex];
    const amount = Number(selectedOpt?.dataset?.amount || priceConsulta);

    await ClinicDB.add('agenda', {
      patientName: document.getElementById('ag-patient').value,
      phone: document.getElementById('ag-phone').value,
      date: document.getElementById('ag-date').value,
      time: document.getElementById('ag-time').value,
      type: planSel.value,
      amount,
      paymentMethod: document.getElementById('ag-pay-method').value,
      notes: document.getElementById('ag-notes').value,
      status: 'CONFIRMADO'
    });
    renderAgenda();
  });

  document.getElementById('toggle-sched-cfg').addEventListener('click', () => {
    document.getElementById('sched-cfg-form').classList.toggle('hidden');
  });
  document.getElementById('sched-cfg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await ClinicDB.saveScheduleConfig({
      ...cfg,
      startHour: document.getElementById('sc-start').value,
      endHour: document.getElementById('sc-end').value,
      lunchStart: document.getElementById('sc-ls').value,
      lunchEnd: document.getElementById('sc-le').value,
      slotMinutes: Number(document.getElementById('sc-min').value) || 60,
      mpApiUrl: document.getElementById('sc-mp-url').value.trim(),
      pixKey: document.getElementById('sc-pix').value.trim()
    });
    alert('Grade de horarios e chave PIX atualizadas!');
    renderAgenda();
  });
  document.querySelectorAll('[data-approve-ag]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await ClinicDB.update('agenda', btn.dataset.approveAg, { status: 'CONFIRMADO' });
      renderAgenda();
    });
  });
  document.querySelectorAll('[data-reschedule-ag]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ev = events.find(e => e.id === btn.dataset.rescheduleAg);
      if (!ev) return;
      const newDate = prompt('Nova data da consulta (AAAA-MM-DD):', ev.date);
      if (!newDate) return;
      const newTime = prompt('Novo horario (HH:MM):', ev.time);
      if (!newTime) return;
      await ClinicDB.update('agenda', ev.id, {
        date: newDate.trim(),
        time: newTime.trim(),
        status: 'REMARCADO'
      });
      renderAgenda();
    });
  });
  document.querySelectorAll('[data-del-ag]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Deseja realmente excluir esta consulta?')) return;
      await ClinicDB.remove('agenda', btn.dataset.delAg);
      renderAgenda();
    });
  });
  document.querySelectorAll('[data-ics]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = events.find(e => e.id === btn.dataset.ics);
      if (ev) downloadICS(ev);
    });
  });
}

function buildGoogleCalendarUrl(ev) {
  const start = `${ev.date.replace(/-/g, '')}T${ev.time.replace(':', '')}00`;
  const [h, m] = ev.time.split(':').map(Number);
  const endHour = String((h + 1) % 24).padStart(2, '0');
  const end = `${ev.date.replace(/-/g, '')}T${endHour}${String(m).padStart(2, '0')}00`;
  const title = encodeURIComponent(`Consulta: ${ev.patientName} (${ev.type})`);
  const details = encodeURIComponent(`${ev.notes || ''} — Agendado via ${ClinicDB.currentSession.clinicName}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
}

function downloadICS(ev) {
  const start = `${ev.date.replace(/-/g, '')}T${ev.time.replace(':', '')}00`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${start}`, `SUMMARY:Consulta - ${ev.patientName}`,
    `DESCRIPTION:${ev.type} ${ev.notes || ''}`, 'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `consulta-${ev.patientName.replace(/\s+/g, '_')}.ics`;
  a.click();
}

// =========================================================================
// MODULO 6: CHAT INTERNO ISOLADO POR CLINICA
// =========================================================================
async function renderChat() {
  const patients = await ClinicDB.getAll('patients');
  if (!selectedPatientId && patients.length > 0) selectedPatientId = patients[0].id;
  const activePatient = patients.find(p => p.id === selectedPatientId) || patients[0];
  const messages = (await ClinicDB.getAll('chat'))
    .filter(m => activePatient && m.patientId === activePatient.id)
    .reverse();

  document.getElementById('main-view').innerHTML = `
    <div class="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col md:flex-row h-[75vh]">
      <div class="md:w-64 border-b md:border-b-0 md:border-r p-3 flex md:flex-col gap-2 overflow-x-auto">
        ${patients.map(p => `
          <button data-chat-p="${p.id}" class="text-left px-3 py-2.5 rounded-xl text-sm shrink-0 ${p.id === activePatient?.id ? 'bg-brand text-white font-semibold' : 'hover:bg-slate-100 text-slate-700'}">
            <p class="truncate">${p.name}</p>
            <p class="text-[11px] opacity-80">${p.goal || 'Paciente'}</p>
          </button>
        `).join('')}
      </div>

      <div class="flex-1 flex flex-col bg-slate-50">
        <div class="bg-white px-4 py-3 border-b flex items-center justify-between">
          <div>
            <p class="font-bold text-slate-800 text-sm">${activePatient?.name || 'Paciente'}</p>
            <p class="text-xs text-emerald-600">Canal direto isolado da clinica</p>
          </div>
          <select id="chat-sender-role" class="text-xs border rounded-lg px-2 py-1 bg-slate-50">
            <option value="PROFISSIONAL">Enviar como Profissional</option>
            <option value="PACIENTE">Simular Paciente</option>
          </select>
        </div>

        <div id="chat-scroll" class="flex-1 p-4 space-y-3 overflow-y-auto">
          ${messages.map(m => `
            <div class="flex ${m.sender === 'PROFISSIONAL' ? 'justify-end' : 'justify-start'}">
              <div class="max-w-xs md:max-w-md px-4 py-2.5 rounded-2xl text-sm shadow-sm ${m.sender === 'PROFISSIONAL' ? 'bg-brand text-white rounded-br-none' : 'bg-white text-slate-800 border rounded-bl-none'}">
                <p>${m.text}</p>
                <p class="text-[10px] mt-1 opacity-70 text-right">${m.time}</p>
              </div>
            </div>
          `).join('')}
        </div>

        <form id="chat-form" class="p-3 bg-white border-t flex gap-2">
          <input id="chat-input" placeholder="Digite sua mensagem..." required class="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none" />
          <button type="submit" class="bg-brand text-white px-5 rounded-xl font-semibold text-sm">Enviar</button>
        </form>
      </div>
    </div>
  `;

  const scroll = document.getElementById('chat-scroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;

  document.querySelectorAll('[data-chat-p]').forEach(btn => {
    btn.addEventListener('click', () => { selectedPatientId = btn.dataset.chatP; renderChat(); });
  });

  document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('chat-input').value.trim();
    if (!text || !activePatient) return;
    await ClinicDB.add('chat', {
      patientId: activePatient.id,
      sender: document.getElementById('chat-sender-role').value,
      text,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    renderChat();
  });
}

function printDocument(html) {
  document.getElementById('print-area').innerHTML = html;
  window.print();
}

bootstrap();