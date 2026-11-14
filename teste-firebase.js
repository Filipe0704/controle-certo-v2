/* =========================================================
   CONTROLE CERTO v2 - teste-firebase.js
   Diagnóstico da configuração do Firebase.
   Cria uma conta temporária só para testar o login e a apaga
   em seguida. Não grava nenhum dado no banco.
   ========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, deleteUser }
    from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore, doc, getDoc }
    from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const lista = document.getElementById("resultados");
const botao = document.getElementById("repetir");
const TEMPO_LIMITE_MS = 12000;

function mostrar(tipo, titulo, detalhe) {
    const item = document.createElement("li");
    item.className = `alerta alerta--${tipo}`;
    const forte = document.createElement("strong");
    forte.textContent = titulo;
    item.append(forte, document.createElement("br"), document.createTextNode(detalhe));
    lista.append(item);
}

function comLimiteDeTempo(promessa) {
    return Promise.race([
        promessa,
        new Promise((_, rejeitar) => setTimeout(() => rejeitar({ code: "tempo-esgotado" }), TEMPO_LIMITE_MS))
    ]);
}

// 1) A configuração foi colada corretamente?
function testarConfiguracao() {
    const obrigatorios = ["apiKey", "authDomain", "projectId", "appId"];
    const faltando = obrigatorios.filter(chave => !firebaseConfig[chave]);
    if (faltando.length > 0) {
        mostrar("erro", "Configuração incompleta", `Faltam os campos: ${faltando.join(", ")}.`);
        return false;
    }
    mostrar("sucesso", "Configuração encontrada", `Projeto: ${firebaseConfig.projectId}.`);
    return true;
}

// 2) O login por e-mail e senha está ativo e a chave é válida?
async function testarAutenticacao(app) {
    const auth = getAuth(app);
    const email = `teste-${Date.now()}@example.com`;
    const senha = `T${Math.random().toString(36).slice(2, 12)}!9`;

    try {
        const credencial = await comLimiteDeTempo(createUserWithEmailAndPassword(auth, email, senha));
        await deleteUser(credencial.user);
        mostrar("sucesso", "Login por e-mail e senha funcionando",
            "Uma conta temporária foi criada e apagada com sucesso.");
    } catch (erro) {
        const dicas = {
            "auth/operation-not-allowed": "O login por E-mail/senha não está ativado. Vá em Authentication > Método de login e ative E-mail/senha.",
            "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "A apiKey está errada. Confira o bloco firebaseConfig.",
            "auth/invalid-api-key": "A apiKey está errada. Confira o bloco firebaseConfig.",
            "auth/network-request-failed": "Sem conexão com o Firebase. Verifique a internet.",
            "auth/configuration-not-found": "O Authentication ainda não foi iniciado. Abra Authentication e clique em Começar.",
            "tempo-esgotado": "O Firebase não respondeu a tempo. Verifique a internet e tente de novo."
        };
        mostrar("erro", "Problema no login", dicas[erro.code] || `Código do erro: ${erro.code || erro.message}`);
    }
}

// 3) O banco responde e está protegido?
async function testarFirestore(app) {
    const banco = getFirestore(app);

    try {
        await comLimiteDeTempo(getDoc(doc(banco, "_teste", "conexao")));
        mostrar("erro", "ATENÇÃO: o banco está aberto",
            "A leitura foi permitida sem login. Troque as regras do Firestore para o modo de produção (bloqueado) antes de continuar.");
    } catch (erro) {
        if (erro.code === "permission-denied") {
            mostrar("sucesso", "Banco de dados protegido",
                "O Firestore respondeu e recusou a leitura sem login. É exatamente o esperado agora.");
        } else if (erro.code === "tempo-esgotado" || erro.code === "unavailable") {
            mostrar("erro", "Não foi possível falar com o banco",
                "Verifique a internet. Se persistir, confirme que o Firestore foi criado (Firestore Database > Criar banco de dados).");
        } else if (erro.code === "failed-precondition" || erro.code === "not-found") {
            mostrar("erro", "O banco ainda não foi criado",
                "Abra Firestore Database no console do Firebase e clique em Criar banco de dados (modo de produção).");
        } else {
            mostrar("erro", "Erro no banco de dados", `Código do erro: ${erro.code || erro.message}`);
        }
    }
}

async function executar() {
    botao.disabled = true;
    lista.replaceChildren();

    mostrar("info", "Endereço desta página", `${location.origin}. Em Authentication > Configurações > Domínios autorizados, o domínio (sem o caminho) precisa estar na lista. O localhost já vem incluído.`);

    if (testarConfiguracao()) {
        try {
            const app = initializeApp(firebaseConfig, `teste-${Date.now()}`);
            await testarAutenticacao(app);
            await testarFirestore(app);
        } catch (erro) {
            mostrar("erro", "Falha ao iniciar o Firebase", String(erro.message || erro));
        }
    }

    botao.disabled = false;
}

botao.addEventListener("click", executar);
executar();
