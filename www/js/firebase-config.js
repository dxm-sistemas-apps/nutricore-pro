// www/js/firebase-config.js
// =========================================================================
// 1. FIREBASE (PLANO SPARK GRATUITO)
//    Mude USE_FIREBASE para true apos colar suas chaves abaixo.
// 2. MERCADO PAGO BACKEND (OPCAO 2 - PIX QR DINAMICO + CARTAO + WEBHOOK)
//    Em testes locais, mantenha http://localhost:3001 e rode a opcao [10] do menu.bat.
//    Em producao, troque pela URL gratuita da Vercel ou Render (ex: https://sua-api.onrender.com).
// =========================================================================

export const USE_FIREBASE = true;

export const PAYMENT_API_URL = "https://nutricore-pro.onrender.com";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB674YwAaO0eQh_CK2EO9o2v5bswUYKZCE",
  authDomain: "nutricore-pro-4ec57.firebaseapp.com",
  projectId: "nutricore-pro-4ec57",
  storageBucket: "nutricore-pro-4ec57.firebasestorage.app",
  messagingSenderId: "546612047437",
  appId: "1:546612047437:web:7e5bd2079595eaa0ebb604"
};
