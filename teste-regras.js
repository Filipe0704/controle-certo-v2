/* =========================================================
   CONTROLE CERTO v2 - teste-regras.js
   Testa as regras de segurança do Firestore usando a sua conta.
   Cada teste diz se o banco DEVE aceitar ou DEVE recusar:
     - "permitido": o que o site precisa fazer normalmente;
     - "recusado":  tentativas inválidas ou de acessar dados
                    de outra pessoa.
   Os dados de teste são apagados no final (exceto a mensagem de
   contato, que as regras não deixam apagar: ela aparece em
   "mensagens" com o texto [TESTE]).
   ========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection, addDoc, query, limit, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { firebaseConfig, ADMIN_UID } from "./firebase-config.js";

const TEMPO_LIMITE_MS = 12000;
const lista = document.getElementById("resultados");
const resumo = document.getElementById("resumo");
const botao = document.getElementById("repetir");
const avisoLogin = document.getElementById("aviso-login");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const banco = getFirestore(app);

let totalOk = 0;
let totalFalhas = 0;
let regrasAbertas = false;
let regrasBloqueiamTudo = 0;

function registrar(ok, titulo, detalhe, esperado) {
    if (ok) totalOk++; else totalFalhas++;

    const item = document.createElement("li");
    item.className = `alerta alerta--${ok ? "sucesso" : "erro"}`;
    const forte = document.createElement("strong");
    forte.textContent = `${ok ? "✔" : "✘"} ${titulo}`;
    item.append(
        forte,
        document.createElement("br"),
        document.createTextNode(`Esperado: ${esperado}. ${detalhe}`)
    );
    lista.append(item);
}

function comLimite(promessa) {
    return Promise.race([
        promessa,
        new Promise((_, rejeitar) => setTimeout(() => rejeitar({ code: "tempo-esgotado" }), TEMPO_LIMITE_MS))
    ]);
}

async function permitido(titulo, funcao) {
    try {
        await comLimite(funcao());
        registrar(true, titulo, "O banco aceitou.", "permitido");
    } catch (erro) {
        if (erro.code === "permission-denied") regrasBloqueiamTudo++;
        registrar(false, titulo,
            `O banco recusou (${erro.code || erro.message}). Confira se as regras foram publicadas.`, "permitido");
    }
}

async function recusado(titulo, funcao) {
    try {
        await comLimite(funcao());
        regrasAbertas = true;
        registrar(false, titulo, "O banco ACEITOU: as regras estão abertas demais.", "recusado");
    } catch (erro) {
        if (erro.code === "permission-denied") {
            registrar(true, titulo, "O banco recusou.", "recusado");
        } else {
            registrar(false, titulo, `Erro inesperado (${erro.code || erro.message}).`, "recusado");
        }
    }
}

async function executar(usuario) {
    botao.disabled = true;
    lista.replaceChildren();
    resumo.textContent = "Testando...";
    totalOk = 0;
    totalFalhas = 0;
    regrasAbertas = false;
    regrasBloqueiamTudo = 0;

    const uid = usuario.uid;
    const perfil = doc(banco, "usuarios", uid);
    const despesa = doc(banco, "usuarios", uid, "despesas", "teste-regras");
    const meta = doc(banco, "usuarios", uid, "metas", "teste-regras");
    const alheio = doc(banco, "usuarios", "uid-de-outra-pessoa", "despesas", "x");

    const despesaValida = () => ({
        data: "15/10/2026", mes: "2026-10", descricao: "Teste de regras",
        categoria: "outros", valor: 10.5, recorrente: false, criadoEm: serverTimestamp()
    });
    const metaValida = () => ({ nome: "Meta de teste", objetivo: 100, guardado: 10, criadoEm: serverTimestamp() });

    // ---- Perfil ----
    await permitido("Ler o próprio perfil", () => getDoc(perfil));
    await permitido("Gravar o próprio perfil (dados válidos)",
        () => setDoc(perfil, { renda: 0, atualizadoEm: serverTimestamp() }, { merge: true }));
    await recusado("Perfil com um campo que não existe (admin: true)",
        () => setDoc(perfil, { renda: 0, admin: true }, { merge: true }));
    await recusado("Perfil com renda negativa",
        () => setDoc(perfil, { renda: -5 }, { merge: true }));

    // ---- Despesas ----
    await permitido("Gravar uma despesa válida", () => setDoc(despesa, despesaValida()));
    await recusado("Despesa com valor negativo", () => setDoc(despesa, { ...despesaValida(), valor: -1 }));
    await recusado("Despesa com campo extra", () => setDoc(despesa, { ...despesaValida(), pago: true }));
    await recusado("Despesa com categoria inexistente", () => setDoc(despesa, { ...despesaValida(), categoria: "xyz" }));
    await recusado("Despesa com descrição acima de 40 caracteres",
        () => setDoc(despesa, { ...despesaValida(), descricao: "x".repeat(41) }));
    await permitido("Apagar a própria despesa de teste", () => deleteDoc(despesa));

    // ---- Metas ----
    await permitido("Gravar uma meta válida", () => setDoc(meta, metaValida()));
    await recusado("Meta com valor guardado maior que o objetivo",
        () => setDoc(meta, { ...metaValida(), guardado: 500 }));
    await permitido("Apagar a própria meta de teste", () => deleteDoc(meta));

    // ---- Dados de outras pessoas ----
    await recusado("Ler os dados de outra pessoa", () => getDoc(alheio));
    await recusado("Gravar nos dados de outra pessoa", () => setDoc(alheio, despesaValida()));

    // ---- Sem login (segundo app, sem usuário conectado) ----
    const appSemLogin = initializeApp(firebaseConfig, `sem-login-${Date.now()}`);
    const bancoSemLogin = getFirestore(appSemLogin);
    await recusado("Ler dados SEM estar logado", () => getDoc(doc(bancoSemLogin, "usuarios", uid)));

    // ---- Contato ----
    await permitido("Enviar uma mensagem de contato válida", () => addDoc(collection(banco, "mensagens"), {
        uid, nome: "Teste", email: usuario.email || "teste@exemplo.com",
        assunto: "duvida", mensagem: "[TESTE] Verificação das regras de segurança.",
        criadoEm: serverTimestamp()
    }));
    const souAdministrador = ADMIN_UID !== "" && usuario.uid === ADMIN_UID;
    if (souAdministrador) {
        await permitido("Ler as mensagens de contato (você é o administrador)",
            () => getDocs(query(collection(banco, "mensagens"), limit(1))));
    } else {
        await recusado("Ler as mensagens de contato (quem não é administrador)",
            () => getDocs(query(collection(banco, "mensagens"), limit(1))));
    }

    // ---- Limpeza dos dados de teste (ignora erros) ----
    await Promise.allSettled([deleteDoc(despesa), deleteDoc(meta)]);

    const total = totalOk + totalFalhas;
    resumo.className = "texto-suave";

    if (totalFalhas === 0) {
        resumo.textContent = `Tudo certo: ${totalOk} de ${total} testes conforme o esperado. As regras estão protegendo os dados.`;
    } else if (regrasAbertas) {
        resumo.textContent = `ATENÇÃO: ${totalFalhas} teste(s) falharam e o banco aceitou algo que deveria recusar. Não ligue os dados reais antes de corrigir as regras.`;
    } else if (regrasBloqueiamTudo > 0) {
        resumo.textContent = `${totalFalhas} teste(s) falharam: o banco está recusando até o que deveria aceitar. Provavelmente as regras novas ainda não foram publicadas.`;
    } else {
        resumo.textContent = `${totalFalhas} de ${total} testes falharam. Veja os detalhes abaixo.`;
    }

    botao.disabled = false;
}

let usuarioAtual = null;
let jaRodouAoEntrar = false;

onAuthStateChanged(auth, usuario => {
    usuarioAtual = usuario;
    avisoLogin.hidden = Boolean(usuario);
    botao.disabled = !usuario;

    if (usuario && !jaRodouAoEntrar) {
        jaRodouAoEntrar = true;
        executar(usuario);
    }
});

botao.addEventListener("click", () => {
    if (usuarioAtual) executar(usuarioAtual);
});
