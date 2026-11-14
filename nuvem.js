/* =========================================================
   CONTROLE CERTO v2 - nuvem.js
   Ponte entre o site e o Firebase (Authentication).
   - cadastro, entrada, saída e recuperação de senha;
   - informa ao cc.js quando a pessoa entra ou sai;
   - traduz os erros do Firebase para português.

   Carregado como módulo, DEPOIS do cc.js:
     <script src="cc.js"></script>
     <script type="module" src="nuvem.js"></script>

   As senhas são tratadas pelo próprio Firebase: este código
   nunca guarda nem registra senhas.
   ========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {
    getAuth, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const LIMITE_NOME = 40;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "pt-BR";   // e-mails de redefinição de senha em português

// ==========================================
// DADOS DA PESSOA LOGADA (formato usado pelo cc.js)
// ==========================================
function nomeParaExibir(usuario) {
    const nome = (usuario.displayName || "").trim()
        || String(usuario.email || "").split("@")[0]
        || "Usuário";
    return nome.slice(0, LIMITE_NOME);
}

function resumoDoUsuario(usuario) {
    return { uid: usuario.uid, nome: nomeParaExibir(usuario), email: usuario.email || "" };
}

// ==========================================
// TRADUÇÃO DOS ERROS
// ==========================================
const MENSAGENS_DE_ERRO = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Informe um e-mail válido, como nome@exemplo.com.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail. Entre ou use \"Esqueci minha senha\".",
    "auth/weak-password": "A senha é muito fraca. Use pelo menos 8 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos ou redefina a sua senha.",
    "auth/network-request-failed": "Sem conexão com a internet. Verifique e tente de novo.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/operation-not-allowed": "O login por e-mail e senha não está ativado no Firebase.",
    "auth/missing-password": "Digite sua senha.",
    "auth/requires-recent-login": "Por segurança, entre de novo para fazer essa alteração."
};

export function traduzirErro(erro) {
    const codigo = erro && erro.code ? erro.code : "";
    return MENSAGENS_DE_ERRO[codigo] || "Não foi possível concluir a operação. Tente novamente.";
}

// ==========================================
// OPERAÇÕES
// ==========================================
async function cadastrar(nome, email, senha) {
    const credencial = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(credencial.user, { displayName: nome });

    // O Firebase não avisa a mudança de nome sozinho: atualiza a sessão do site
    window.CC.sessaoResolvida(resumoDoUsuario(credencial.user));
    return resumoDoUsuario(credencial.user);
}

async function entrar(email, senha) {
    const credencial = await signInWithEmailAndPassword(auth, email, senha);
    return resumoDoUsuario(credencial.user);
}

async function sair() {
    await signOut(auth);
}

async function recuperarSenha(email) {
    await sendPasswordResetEmail(auth, email);
}

async function atualizarNome(nome) {
    if (!auth.currentUser) throw { code: "auth/requires-recent-login" };
    await updateProfile(auth.currentUser, { displayName: nome });
    window.CC.sessaoResolvida(resumoDoUsuario(auth.currentUser));
}

// ==========================================
// INICIALIZAÇÃO: entrega a API e acompanha o login
// ==========================================
window.CC.registrarNuvem({
    auth,
    cadastrar,
    entrar,
    sair,
    recuperarSenha,
    atualizarNome,
    traduzirErro
});

onAuthStateChanged(auth, usuario => {
    window.CC.sessaoResolvida(usuario ? resumoDoUsuario(usuario) : null);
});
