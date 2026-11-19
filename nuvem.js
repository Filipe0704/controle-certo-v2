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
import {
    getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, addDoc, writeBatch,
    query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { firebaseConfig, ADMIN_UID } from "./firebase-config.js";

const LIMITE_NOME = 40;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const banco = getFirestore(app);
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
    "auth/requires-recent-login": "Por segurança, entre de novo para fazer essa alteração.",
    "permission-denied": "Sem permissão para essa ação. Entre na sua conta de novo.",
    "tempo-esgotado": "O serviço demorou a responder. Tente de novo."
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
// DADOS (Firestore): usuarios/{uid}, .../despesas, .../metas, mensagens
// As regras de segurança (firestore.rules) deixam cada pessoa
// acessar somente o que está sob o próprio uid.
// ==========================================
const TEMPO_LIMITE_MS = 12000;
const TAMANHO_LOTE = 400;          // o Firestore aceita até 500 operações por lote

function comLimite(promessa) {
    return Promise.race([
        promessa,
        new Promise((_, rejeitar) => setTimeout(() => rejeitar({ code: "tempo-esgotado" }), TEMPO_LIMITE_MS))
    ]);
}

function uidAtual() {
    if (!auth.currentUser) throw { code: "sem-login" };
    return auth.currentUser.uid;
}

function caminhoDe(uid, ...partes) {
    return doc(banco, "usuarios", uid, ...partes);
}

// "15/10/2026" -> "2026-10"
function mesDaData(data) {
    return `${data.slice(6, 10)}-${data.slice(3, 5)}`;
}

function camposDaDespesa(d) {
    return {
        data: d.data,
        mes: mesDaData(d.data),
        descricao: d.descricao,
        categoria: d.categoria,
        valor: d.valor,
        recorrente: Boolean(d.recorrente)
    };
}

function camposDaMeta(m) {
    return { nome: m.nome, objetivo: m.objetivo, guardado: m.guardado };
}

async function executarEmLotes(operacoes) {
    for (let i = 0; i < operacoes.length; i += TAMANHO_LOTE) {
        const lote = writeBatch(banco);
        operacoes.slice(i, i + TAMANHO_LOTE).forEach(operacao => operacao(lote));
        await comLimite(lote.commit());
    }
}

async function carregarDados() {
    const uid = uidAtual();
    const [perfil, despesas, metas] = await comLimite(Promise.all([
        getDoc(caminhoDe(uid)),
        getDocs(collection(banco, "usuarios", uid, "despesas")),
        getDocs(collection(banco, "usuarios", uid, "metas"))
    ]));

    const dadosDoPerfil = perfil.exists() ? perfil.data() : {};
    return {
        renda: typeof dadosDoPerfil.renda === "number" ? dadosDoPerfil.renda : 0,
        foto: typeof dadosDoPerfil.foto === "string" ? dadosDoPerfil.foto : "",
        despesas: despesas.docs.map(item => ({ id: item.id, ...item.data() })),
        metas: metas.docs.map(item => ({ id: item.id, ...item.data() }))
    };
}

async function salvarRenda(valor) {
    await comLimite(setDoc(caminhoDe(uidAtual()), { renda: valor, atualizadoEm: serverTimestamp() }, { merge: true }));
}

async function salvarFoto(foto) {
    await comLimite(setDoc(caminhoDe(uidAtual()), { foto, atualizadoEm: serverTimestamp() }, { merge: true }));
}

async function gravarDespesas(gravar, apagar) {
    const uid = uidAtual();
    const operacoes = [
        ...gravar.map(d => lote => lote.set(caminhoDe(uid, "despesas", d.id), camposDaDespesa(d))),
        ...apagar.map(id => lote => lote.delete(caminhoDe(uid, "despesas", id)))
    ];
    await executarEmLotes(operacoes);
}

async function gravarMetas(gravar, apagar) {
    const uid = uidAtual();
    const operacoes = [
        ...gravar.map(m => lote => lote.set(caminhoDe(uid, "metas", m.id), camposDaMeta(m))),
        ...apagar.map(id => lote => lote.delete(caminhoDe(uid, "metas", id)))
    ];
    await executarEmLotes(operacoes);
}

async function apagarDadosFinanceiros() {
    const uid = uidAtual();
    const [despesas, metas] = await comLimite(Promise.all([
        getDocs(collection(banco, "usuarios", uid, "despesas")),
        getDocs(collection(banco, "usuarios", uid, "metas"))
    ]));

    await executarEmLotes([
        ...despesas.docs.map(item => lote => lote.delete(item.ref)),
        ...metas.docs.map(item => lote => lote.delete(item.ref))
    ]);
    await salvarRenda(0);
}

async function enviarContato({ nome, email, assunto, mensagem }) {
    await comLimite(addDoc(collection(banco, "mensagens"), {
        uid: uidAtual(), nome, email, assunto, mensagem, criadoEm: serverTimestamp()
    }));
}

// ==========================================
// ADMINISTRAÇÃO: mensagens do "Fale com a gente"
// O acesso é decidido pelas regras do banco (firestore.rules).
// ehAdministrador() serve só para mostrar ou esconder botões.
// ==========================================
function ehAdministrador() {
    return Boolean(auth.currentUser) && ADMIN_UID !== "" && auth.currentUser.uid === ADMIN_UID;
}

async function listarMensagens() {
    const resultado = await comLimite(getDocs(
        query(collection(banco, "mensagens"), orderBy("criadoEm", "desc"), limit(200))
    ));

    return resultado.docs.map(item => {
        const d = item.data();
        return {
            id: item.id,
            nome: String(d.nome || ""),
            email: String(d.email || ""),
            assunto: String(d.assunto || ""),
            mensagem: String(d.mensagem || ""),
            lida: d.lida === true,
            criadoEm: d.criadoEm && typeof d.criadoEm.toMillis === "function" ? d.criadoEm.toMillis() : 0
        };
    });
}

async function marcarMensagemLida(id, lida) {
    await comLimite(updateDoc(doc(banco, "mensagens", id), { lida: Boolean(lida) }));
}

async function excluirMensagem(id) {
    await comLimite(deleteDoc(doc(banco, "mensagens", id)));
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
    traduzirErro,
    carregarDados,
    salvarRenda,
    salvarFoto,
    gravarDespesas,
    gravarMetas,
    apagarDadosFinanceiros,
    enviarContato,
    ehAdministrador,
    listarMensagens,
    marcarMensagemLida,
    excluirMensagem
});

onAuthStateChanged(auth, usuario => {
    window.CC.sessaoResolvida(usuario ? resumoDoUsuario(usuario) : null);
});
