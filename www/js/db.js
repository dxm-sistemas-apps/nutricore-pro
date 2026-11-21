// www/js/db.js
// Camada Multi-Tenant Hibrida (LocalStorage Offline + Firebase Firestore Offline-First)
import { USE_FIREBASE, FIREBASE_CONFIG } from './firebase-config.js';

const DB_PREFIX = 'nutricore_v3_';
let fb = null;

async function initFirebaseIfNeeded() {
  if (!USE_FIREBASE || fb) return fb;
  const [appMod, authMod, fsMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const auth = authMod.getAuth(app);
  const db = fsMod.initializeFirestore(app, {
    localCache: fsMod.persistentLocalCache({
      tabManager: fsMod.persistentMultipleTabManager()
    })
  });
  fb = { app, auth, db, authMod, fsMod };
  return fb;
}

export const DEFAULT_SCHEDULE = {
  days: [1, 2, 3, 4, 5], // Seg a Sex
  startHour: '08:00',
  endHour: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  slotMinutes: 60,
  pixKey: 'clinica@pix.com.br',
  services: [
    { id: 'srv1', name: 'Consulta Inicial (Presencial)', price: 350 },
    { id: 'srv2', name: 'Retorno / Reavaliacao', price: 220 },
    { id: 'srv3', name: 'Consulta Online (Telemedicina)', price: 280 }
  ]
};

export const ClinicDB = {
  currentSession: null,
  isCloudMode: USE_FIREBASE,

  async init() {
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      return new Promise((resolve) => {
        const unsub = fb.authMod.onAuthStateChanged(fb.auth, async (user) => {
          unsub();
          if (!user) { this.currentSession = null; return resolve(null); }
          try {
            const snap = await fb.fsMod.getDoc(fb.fsMod.doc(fb.db, 'users', user.uid));
            if (snap.exists()) {
              this.currentSession = { uid: user.uid, ...snap.data() };
              resolve(this.currentSession);
            } else resolve(null);
          } catch { resolve(null); }
        });
      });
    } else {
      this._seedLocalAccounts();
      const saved = localStorage.getItem(`${DB_PREFIX}session`);
      if (saved) {
        this.currentSession = JSON.parse(saved);
        return this.currentSession;
      }
      return null;
    }
  },

  async login(email, password) {
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      const cred = await fb.authMod.signInWithEmailAndPassword(fb.auth, email, password);
      const snap = await fb.fsMod.getDoc(fb.fsMod.doc(fb.db, 'users', cred.user.uid));
      if (!snap.exists()) throw new Error('Perfil nao encontrado.');
      this.currentSession = { uid: cred.user.uid, ...snap.data() };
      return this.currentSession;
    } else {
      this._seedLocalAccounts();
      const accounts = JSON.parse(localStorage.getItem(`${DB_PREFIX}accounts`) || '[]');
      const user = accounts.find(a => a.email.toLowerCase() === email.toLowerCase() && a.password === password);
      if (!user) throw new Error('E-mail ou senha invalidos.');
      this._ensureClinicSeed(user.clinicId);
      // Carrega branding atualizado da clinica
      const clinic = this._getClinicMetaLocal(user.clinicId);
      const session = { ...user, ...clinic, role: user.role, patientId: user.patientId || null, userName: user.name };
      this.currentSession = session;
      localStorage.setItem(`${DB_PREFIX}session`, JSON.stringify(session));
      return session;
    }
  },

  async registerTenant({ clinicName, name, crn, email, password, primaryColor, phone }) {
    const clinicId = 'clinic_' + Date.now();
    const profile = {
      clinicId, email, name, crn, clinicName,
      phone: phone || '', primaryColor: primaryColor || '#059669',
      role: 'NUTRICIONISTA', createdAt: new Date().toISOString()
    };
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      const cred = await fb.authMod.createUserWithEmailAndPassword(fb.auth, email, password);
      await fb.fsMod.setDoc(fb.fsMod.doc(fb.db, 'users', cred.user.uid), profile);
      await fb.fsMod.setDoc(fb.fsMod.doc(fb.db, 'clinics', clinicId), {
        clinicName, name, crn, phone: profile.phone, primaryColor: profile.primaryColor, ownerUid: cred.user.uid
      });
      this.currentSession = { uid: cred.user.uid, ...profile };
      return this.currentSession;
    } else {
      this._seedLocalAccounts();
      const accounts = JSON.parse(localStorage.getItem(`${DB_PREFIX}accounts`) || '[]');
      if (accounts.find(a => a.email.toLowerCase() === email.toLowerCase())) throw new Error('E-mail ja cadastrado.');
      const acc = { ...profile, password };
      accounts.push(acc);
      localStorage.setItem(`${DB_PREFIX}accounts`, JSON.stringify(accounts));
      localStorage.setItem(`${DB_PREFIX}meta_${clinicId}`, JSON.stringify({ clinicName, name, crn, phone: profile.phone, primaryColor: profile.primaryColor }));
      this._ensureClinicSeed(clinicId);
      this.currentSession = acc;
      localStorage.setItem(`${DB_PREFIX}session`, JSON.stringify(acc));
      return acc;
    }
  },

  // Profissional libera acesso ao Portal do Cliente para um paciente
  async registerPatientPortalAccess({ patientId, patientName, email, password }) {
    const u = this.currentSession;
    if (!email || !password) return;
    if (USE_FIREBASE) {
      // Em producao Firebase, recomenda-se criar via secondaryApp para nao deslogar o profissional
      throw new Error('No modo Firebase, cadastre o e-mail do paciente no Console Auth ou use o modo Local para testes.');
    } else {
      const accounts = JSON.parse(localStorage.getItem(`${DB_PREFIX}accounts`) || '[]');
      const idx = accounts.findIndex(a => a.email.toLowerCase() === email.toLowerCase());
      const rec = {
        clinicId: u.clinicId,
        patientId,
        name: patientName,
        email,
        password,
        role: 'PACIENTE'
      };
      if (idx >= 0) accounts[idx] = rec; else accounts.push(rec);
      localStorage.setItem(`${DB_PREFIX}accounts`, JSON.stringify(accounts));
    }
  },

  async updateProfile(patch) {
    if (!this.currentSession) return;
    const updated = { ...this.currentSession, ...patch };
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      await fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, 'users', this.currentSession.uid), patch);
      await fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, 'clinics', this.currentSession.clinicId), patch).catch(() => {});
    } else {
      const cid = this.currentSession.clinicId;
      const meta = { ...this._getClinicMetaLocal(cid), ...patch };
      localStorage.setItem(`${DB_PREFIX}meta_${cid}`, JSON.stringify(meta));
      localStorage.setItem(`${DB_PREFIX}session`, JSON.stringify(updated));
    }
    this.currentSession = updated;
    return updated;
  },

  async logout() {
    if (USE_FIREBASE && fb) await fb.authMod.signOut(fb.auth);
    else localStorage.removeItem(`${DB_PREFIX}session`);
    this.currentSession = null;
  },

  // Configuracao de Agenda & Horarios da Clinica
  async getScheduleConfig() {
    const cid = this.currentSession.clinicId;
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      const snap = await fb.fsMod.getDoc(fb.fsMod.doc(fb.db, 'clinics', cid, 'scheduleConfig', 'default'));
      return snap.exists() ? { ...DEFAULT_SCHEDULE, ...snap.data() } : DEFAULT_SCHEDULE;
    } else {
      const raw = localStorage.getItem(`${DB_PREFIX}${cid}_scheduleConfig`);
      return raw ? { ...DEFAULT_SCHEDULE, ...JSON.parse(raw) } : DEFAULT_SCHEDULE;
    }
  },

  async saveScheduleConfig(cfg) {
    const cid = this.currentSession.clinicId;
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      await fb.fsMod.setDoc(fb.fsMod.doc(fb.db, 'clinics', cid, 'scheduleConfig', 'default'), cfg);
    } else {
      localStorage.setItem(`${DB_PREFIX}${cid}_scheduleConfig`, JSON.stringify(cfg));
    }
  },

  // CRUD Multi-Tenant
  _localKey(col) {
    return `${DB_PREFIX}${this.currentSession.clinicId}_${col}`;
  },

  async getAll(col) {
    if (!this.currentSession) return [];
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      const colRef = fb.fsMod.collection(fb.db, 'clinics', this.currentSession.clinicId, col);
      const snap = await fb.fsMod.getDocs(colRef);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } else {
      return JSON.parse(localStorage.getItem(this._localKey(col)) || '[]');
    }
  },

  async add(col, item) {
    const record = { clinicId: this.currentSession.clinicId, createdAt: new Date().toISOString(), ...item };
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      const colRef = fb.fsMod.collection(fb.db, 'clinics', this.currentSession.clinicId, col);
      const docRef = await fb.fsMod.addDoc(colRef, record);
      return { id: docRef.id, ...record };
    } else {
      const list = JSON.parse(localStorage.getItem(this._localKey(col)) || '[]');
      const localRec = { id: 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ...record };
      list.unshift(localRec);
      localStorage.setItem(this._localKey(col), JSON.stringify(list));
      return localRec;
    }
  },

  async update(col, id, patch) {
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      await fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, 'clinics', this.currentSession.clinicId, col, id), patch);
    } else {
      const list = JSON.parse(localStorage.getItem(this._localKey(col)) || '[]').map(i => i.id === id ? { ...i, ...patch } : i);
      localStorage.setItem(this._localKey(col), JSON.stringify(list));
    }
  },

  async remove(col, id) {
    if (USE_FIREBASE) {
      await initFirebaseIfNeeded();
      await fb.fsMod.deleteDoc(fb.fsMod.doc(fb.db, 'clinics', this.currentSession.clinicId, col, id));
    } else {
      const list = JSON.parse(localStorage.getItem(this._localKey(col)) || '[]').filter(i => i.id !== id);
      localStorage.setItem(this._localKey(col), JSON.stringify(list));
    }
  },

  // Helpers locais
  _getClinicMetaLocal(clinicId) {
    const raw = localStorage.getItem(`${DB_PREFIX}meta_${clinicId}`);
    if (raw) return JSON.parse(raw);
    if (clinicId === 'clinica_performance') {
      return { clinicName: 'Instituto Performance Esportiva', name: 'Dr. Marcos Silva', crn: 'CRN-4 1988210', phone: '21988887777', primaryColor: '#2563eb' };
    }
    return { clinicName: 'Clinica Equilibrio Nutricao', name: 'Dra. Clara Mendes', crn: 'CRN-4 2410098', phone: '21999998888', primaryColor: '#059669' };
  },

  _seedLocalAccounts() {
    const key = `${DB_PREFIX}accounts`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify([
        { clinicId: 'clinica_dra_clara', email: 'clara@nutri.com', password: '123', name: 'Dra. Clara Mendes', role: 'NUTRICIONISTA' },
        { clinicId: 'clinica_dra_clara', email: 'ana@paciente.com', password: '123', name: 'Ana Beatriz Souza', role: 'PACIENTE', patientId: 'p1' },
        { clinicId: 'clinica_performance', email: 'marcos@nutri.com', password: '123', name: 'Dr. Marcos Silva', role: 'NUTRICIONISTA' }
      ]));
    }
  },

  _ensureClinicSeed(clinicId) {
    const flag = `${DB_PREFIX}${clinicId}_seeded`;
    if (localStorage.getItem(flag)) return;
    const save = (col, data) => localStorage.setItem(`${DB_PREFIX}${clinicId}_${col}`, JSON.stringify(data));
    const today = new Date().toISOString().slice(0, 10);

    save('patients', [
      { id: 'p1', name: 'Ana Beatriz Souza', email: 'ana@paciente.com', phone: '21999990001', sex: 'F', age: 31, height: 165, goal: 'Emagrecimento', allergies: 'Intolerancia leve a lactose', anamnesis: 'Treina musculacao 4x/semana. Meta hidrica 2,5L/dia.', createdAt: new Date().toISOString() },
      { id: 'p2', name: 'Rafael Oliveira', email: 'rafael@paciente.com', phone: '21999990002', sex: 'M', age: 28, height: 179, goal: 'Hipertrofia', allergies: 'Nenhuma', anamnesis: 'Treina as 7h. Foco em proteina no almoco.', createdAt: new Date().toISOString() }
    ]);

    save('evaluations', [
      { id: 'ev1', patientId: 'p1', date: '2026-09-15', weight: 72.4, height: 165, bodyFat: 31.2, waist: 82, hip: 104, activity: 1.55, createdAt: '2026-09-15T10:00:00Z' },
      { id: 'ev2', patientId: 'p1', date: '2026-10-18', weight: 70.1, height: 165, bodyFat: 29.4, waist: 79, hip: 102, activity: 1.55, createdAt: '2026-10-18T10:00:00Z' },
      { id: 'ev3', patientId: 'p1', date: today, weight: 68.5, height: 165, bodyFat: 27.8, waist: 77, hip: 101, activity: 1.55, createdAt: new Date().toISOString() }
    ]);

    save('mealPlans', [
      {
        id: 'mp1', patientId: 'p1', patientName: 'Ana Beatriz Souza', title: 'Plano Emagrecimento Fase 1',
        totalKcal: 1645, totalPtn: 128.4, totalCho: 176.2, totalLip: 45.8, createdAt: new Date().toISOString(),
        meals: [
          { name: 'Cafe da Manha', time: '07:30', items: [{ foodId: 't23', grams: 100 }, { foodId: 't9', grams: 50 }, { foodId: 't36', grams: 150 }] },
          { name: 'Almoco', time: '12:30', items: [{ foodId: 't2', grams: 120 }, { foodId: 't13', grams: 86 }, { foodId: 't17', grams: 130 }, { foodId: 't48', grams: 80 }, { foodId: 't43', grams: 10 }] },
          { name: 'Lanche da Tarde', time: '16:00', items: [{ foodId: 't27', grams: 170 }, { foodId: 't7', grams: 30 }, { foodId: 't34', grams: 70 }] },
          { name: 'Jantar', time: '20:00', items: [{ foodId: 't3', grams: 120 }, { foodId: 't20', grams: 140 }, { foodId: 't49', grams: 50 }] }
        ]
      }
    ]);

    save('prescriptions', [
      {
        id: 'rx1', patientId: 'p1', patient: 'Ana Beatriz Souza', formType: '60 capsulas vegetais (Uso Oral)',
        posologia: 'Tomar 1 dose (2 capsulas) apos o jantar, por 30 dias.',
        items: [{ ativo: 'Magnesio Dimalato', dose: '300 mg' }, { ativo: 'Ashwagandha KSM-66', dose: '300 mg' }],
        createdAt: new Date().toISOString()
      }
    ]);

    save('finance', [
      { id: 'f1', patientId: 'p1', desc: 'Consulta Inicial - Ana Beatriz', type: 'RECEITA', amount: 350, date: today, status: 'PAGO', createdAt: new Date().toISOString() },
      { id: 'f2', patientId: 'p2', desc: 'Retorno - Rafael Oliveira', type: 'RECEITA', amount: 220, date: today, status: 'PENDENTE', createdAt: new Date().toISOString() },
      { id: 'f3', desc: 'Aluguel Consultorio', type: 'DESPESA', amount: 180, date: today, status: 'PAGO', createdAt: new Date().toISOString() }
    ]);

    save('agenda', [
      { id: 'a1', patientId: 'p1', patientName: 'Ana Beatriz Souza', phone: '21999990001', date: today, time: '14:00', type: 'Retorno / Reavaliacao', status: 'CONFIRMADO', checkoutMode: 'Pagar na Clinica', amount: 220, notes: 'Trazer exames de sangue', createdAt: new Date().toISOString() }
    ]);

    save('busySlots', [
      { id: 'bs1', date: today, time: '14:00', createdAt: new Date().toISOString() }
    ]);

    save('chat', [
      { id: 'c2', patientId: 'p1', sender: 'PROFISSIONAL', text: 'Oi Ana! Pode sim, mantenha a mesma medida de 170g.', time: '09:22', createdAt: new Date().toISOString() },
      { id: 'c1', patientId: 'p1', sender: 'PACIENTE', text: 'Ola Dra.! Posso substituir o iogurte natural por kefir no lanche da tarde?', time: '09:15', createdAt: new Date(Date.now() - 60000).toISOString() }
    ]);

    localStorage.setItem(flag, 'true');
  }
};
