/* =========================================================
   CONTROLE CERTO v2 - mensagens.js
   Caixa de entrada das mensagens do "Fale com a gente".
   Só quem administra o site consegue ler: o acesso é decidido
   pelas regras do banco (firestore.rules). Para as demais
   pessoas, o banco recusa a leitura e a página mostra o aviso
   de acesso restrito.
   Depende de cc.js (window.CC) e nuvem.js (Firebase).
   ========================================================= */
(function () {
    "use strict";

    if (!window.CC) return;

    const { aoCarregar, criarElemento, criarIcone, mostrarToast } = window.CC;

    const ROTULOS_ASSUNTO = {
        duvida: "Dúvida",
        sugestao: "Sugestão",
        problema: "Problema",
        elogio: "Elogio"
    };

    const formatadorData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

    let mensagens = [];
    let nuvem = null;
    const el = {};

    // ==========================================
    // AUXILIARES
    // ==========================================
    function dataFormatada(milissegundos) {
        return milissegundos ? formatadorData.format(new Date(milissegundos)) : "sem data";
    }

    // Só vira link de e-mail se o endereço for simples e seguro
    function emailValido(email) {
        return /^[^\s@?&#:]+@[^\s@?&#:]+\.[^\s@?&#:]+$/.test(email);
    }

    function enderecoParaResponder(mensagem) {
        const assunto = `Re: Controle Certo - ${ROTULOS_ASSUNTO[mensagem.assunto] || "Contato"}`;
        return `mailto:${mensagem.email}?subject=${encodeURIComponent(assunto)}`;
    }

    function mensagensFiltradas() {
        const status = el.filtroStatus.value;
        const assunto = el.filtroAssunto.value;

        return mensagens.filter(m =>
            (status !== "nao-lidas" || !m.lida) && (assunto === "todos" || m.assunto === assunto)
        );
    }

    // ==========================================
    // RENDERIZAÇÃO
    // ==========================================
    function criarBotao(acao, id, icone, texto, classe) {
        return criarElemento("button", {
            classe: `btn btn--pequeno ${classe}`,
            attrs: { type: "button", "data-acao": acao, "data-id": id }
        }, [criarIcone(`fa-solid ${icone}`), document.createTextNode(` ${texto}`)]);
    }

    function criarCartao(mensagem) {
        const topo = criarElemento("div", { classe: "mensagem-item__topo" }, [
            criarElemento("strong", { texto: mensagem.nome || "Sem nome" }),
            criarElemento("span", { classe: "etiqueta", texto: ROTULOS_ASSUNTO[mensagem.assunto] || "Contato" })
        ]);
        if (!mensagem.lida) {
            topo.append(criarElemento("span", { classe: "etiqueta etiqueta--destaque", texto: "Nova" }));
        }
        topo.append(criarElemento("span", { classe: "mensagem-item__data", texto: dataFormatada(mensagem.criadoEm) }));

        const email = criarElemento("p", { classe: "mensagem-item__email" }, [
            criarIcone("fa-solid fa-envelope"),
            document.createTextNode(` ${mensagem.email}`)
        ]);

        const acoes = criarElemento("div", { classe: "mensagem-item__acoes" });
        if (emailValido(mensagem.email)) {
            const responder = criarElemento("a", {
                classe: "btn btn--pequeno",
                attrs: { href: enderecoParaResponder(mensagem) }
            }, [criarIcone("fa-solid fa-reply"), document.createTextNode(" Responder por e-mail")]);
            acoes.append(responder);
        }
        acoes.append(
            mensagem.lida
                ? criarBotao("lida", mensagem.id, "fa-envelope", "Marcar como não lida", "btn--secundario")
                : criarBotao("lida", mensagem.id, "fa-envelope-open", "Marcar como lida", "btn--secundario"),
            criarBotao("excluir", mensagem.id, "fa-trash", "Excluir", "btn--perigo")
        );

        return criarElemento("article", {
            classe: mensagem.lida ? "mensagem-item" : "mensagem-item mensagem-item--nova",
            attrs: { "data-id": mensagem.id }
        }, [
            topo,
            email,
            criarElemento("p", { classe: "mensagem-item__texto", texto: mensagem.mensagem }),
            acoes
        ]);
    }

    function renderizar() {
        const visiveis = mensagensFiltradas();
        const naoLidas = mensagens.filter(m => !m.lida).length;

        el.lista.replaceChildren(...visiveis.map(criarCartao));
        el.vazio.hidden = visiveis.length > 0;
        el.vazio.textContent = mensagens.length === 0
            ? "Ainda não chegou nenhuma mensagem."
            : "Nenhuma mensagem com esses filtros.";

        el.resumo.textContent = mensagens.length === 0
            ? ""
            : `${naoLidas} ${naoLidas === 1 ? "não lida" : "não lidas"} · ${mensagens.length} no total`;
    }

    // ==========================================
    // ESTADOS DA PÁGINA
    // ==========================================
    function mostrarEstado(estado) {
        el.carregando.hidden = estado !== "carregando";
        el.erro.hidden = estado !== "erro";
        el.principal.hidden = estado === "restrito";
        el.restrito.hidden = estado !== "restrito";
    }

    function mostrarAcessoRestrito() {
        const usuario = window.CC.usuarioNuvem();
        el.uid.textContent = usuario ? usuario.uid : "";
        mostrarEstado("restrito");
    }

    async function carregar() {
        mostrarEstado("carregando");

        try {
            nuvem = await window.CC.obterNuvem();
            mensagens = await nuvem.listarMensagens();
        } catch (erro) {
            if (erro && erro.code === "permission-denied") {
                mostrarAcessoRestrito();
            } else {
                console.warn(erro);
                mostrarEstado("erro");
            }
            return;
        }

        mostrarEstado("pronto");
        renderizar();
    }

    // ==========================================
    // AÇÕES
    // ==========================================
    async function alternarLida(mensagem, botao) {
        botao.disabled = true;
        try {
            await nuvem.marcarMensagemLida(mensagem.id, !mensagem.lida);
        } catch (erro) {
            console.warn(erro);
            mostrarToast("Não foi possível atualizar a mensagem. Tente de novo.", "erro");
            botao.disabled = false;
            return;
        }

        mensagem.lida = !mensagem.lida;
        renderizar();
    }

    async function excluir(mensagem, botao) {
        const confirmou = window.confirm(`Excluir a mensagem de ${mensagem.nome || "sem nome"}? Essa ação não pode ser desfeita.`);
        if (!confirmou) return;

        botao.disabled = true;
        try {
            await nuvem.excluirMensagem(mensagem.id);
        } catch (erro) {
            console.warn(erro);
            mostrarToast("Não foi possível excluir a mensagem. Tente de novo.", "erro");
            botao.disabled = false;
            return;
        }

        mensagens = mensagens.filter(m => m.id !== mensagem.id);
        renderizar();
        mostrarToast("Mensagem excluída.");
    }

    function aoClicarLista(evento) {
        const botao = evento.target.closest("button[data-acao]");
        if (!botao) return;

        const mensagem = mensagens.find(m => m.id === botao.dataset.id);
        if (!mensagem) return;

        if (botao.dataset.acao === "lida") alternarLida(mensagem, botao);
        if (botao.dataset.acao === "excluir") excluir(mensagem, botao);
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    aoCarregar(() => {
        el.principal = document.querySelector("[aria-labelledby='titulo-lista']");
        el.restrito = document.getElementById("estado-restrito");
        el.carregando = document.getElementById("estado-carregando");
        el.erro = document.getElementById("estado-erro");
        el.lista = document.getElementById("lista-mensagens");
        el.vazio = document.getElementById("vazio-mensagens");
        el.resumo = document.getElementById("resumo-mensagens");
        el.filtroStatus = document.getElementById("filtro-status");
        el.filtroAssunto = document.getElementById("filtro-assunto");
        el.uid = document.getElementById("meu-uid");

        el.filtroStatus.addEventListener("change", renderizar);
        el.filtroAssunto.addEventListener("change", renderizar);
        el.lista.addEventListener("click", aoClicarLista);
        document.getElementById("tentar-de-novo").addEventListener("click", carregar);

        carregar();
    });
})();
