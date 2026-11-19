/* =========================================================
   CONTROLE CERTO v2 - firebase-config.js
   Configuração do projeto Firebase (controle-certo-ea53c).

   Estes valores NÃO são segredos: qualquer site que usa o
   Firebase os expõe no navegador. Quem protege os dados são as
   REGRAS DE SEGURANÇA do Firestore e o login (etapas seguintes).

   NUNCA coloque aqui senhas, chaves privadas ou arquivos JSON
   de "conta de serviço".
   ========================================================= */

export const VERSAO_SDK = "13.3.0";

// Código (UID) da conta de quem administra o site e lê as mensagens de contato.
// Onde achar: Firebase > Authentication > Usuários > coluna "UID do usuário".
// Este valor só controla o que aparece na tela. Quem realmente protege as
// mensagens são as REGRAS do Firestore (firestore.rules): coloque o MESMO UID lá.
export const ADMIN_UID = "COLE-AQUI-O-SEU-UID";

export const firebaseConfig = {
    apiKey: "AIzaSyBM9NyVEnFh_0oIqFMe0bAEh7iBWAs4_Xo",
    authDomain: "controle-certo-ea53c.firebaseapp.com",
    projectId: "controle-certo-ea53c",
    storageBucket: "controle-certo-ea53c.firebasestorage.app",
    messagingSenderId: "640033468787",
    appId: "1:640033468787:web:feffdb7d1ca884f3591506"
};
