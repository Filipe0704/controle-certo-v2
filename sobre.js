/* =========================================================
   CONTROLE CERTO v2 - sobre.js
   Página "Sobre": formulário "Fale com a gente".
   A mensagem é gravada no banco (coleção "mensagens").
   Depende de cc.js (window.CC) e nuvem.js (Firebase).
   ========================================================= */
(function () {
    "use strict";

    if (!window.CC) return;

    const {
        LIMITE_TEXTO,
        aoCarregar, limparTexto, validarEmail, normalizarEmail, mostrarToast, usuarioAtual
    } = window.CC;

    const MENSAGEM_MIN = 10;
    const MENSAGEM_MAX = 500;
    const ASSUNTOS = ["duvida", "sugestao", "problema", "elogio"];

    const el = {};

    // ==========================================
    // ERROS DE CAMPO
    // ==========================================
    function definirErro(campo, texto) {
        const elErro = document.getElementById(`${campo.id}-erro`);
        if (elErro) elErro.textContent = texto;
        campo.setAttribute("aria-invalid", texto ? "true" : "false");
    }

    // ==========================================
    // CONTATO
    // ==========================================
    function atualizarContador() {
        el.contador.textContent = `${el.mensagem.value.length}/${MENSAGEM_MAX} caracteres`;
    }

    function preencherDadosDoContato() {
        const usuario = window.CC.usuarioNuvem();
        el.contatoNome.value = usuarioAtual().slice(0, LIMITE_TEXTO);
        el.contatoEmail.value = usuario && usuario.email ? usuario.email : "";
        atualizarContador();
    }

    async function aoEnviarContato(evento) {
        evento.preventDefault();
        const form = evento.currentTarget;

        [el.contatoNome, el.contatoEmail, el.assunto, el.mensagem].forEach(campo => definirErro(campo, ""));
        el.msgContato.hidden = true;

        const nome = limparTexto(el.contatoNome.value);
        const email = normalizarEmail(el.contatoEmail.value);
        const assunto = el.assunto.value;
        const mensagem = el.mensagem.value.trim();

        let primeiroInvalido = null;
        const invalidar = (campo, texto) => {
            definirErro(campo, texto);
            if (!primeiroInvalido) primeiroInvalido = campo;
        };

        if (nome === null) invalidar(el.contatoNome, `Informe seu nome com até ${LIMITE_TEXTO} caracteres.`);
        if (!validarEmail(email)) invalidar(el.contatoEmail, "Informe um e-mail válido, como nome@exemplo.com.");
        if (!ASSUNTOS.includes(assunto)) invalidar(el.assunto, "Escolha um assunto.");
        if (mensagem.length < MENSAGEM_MIN) {
            invalidar(el.mensagem, `Escreva pelo menos ${MENSAGEM_MIN} caracteres.`);
        } else if (mensagem.length > MENSAGEM_MAX) {
            invalidar(el.mensagem, `A mensagem pode ter no máximo ${MENSAGEM_MAX} caracteres.`);
        }

        if (primeiroInvalido) {
            primeiroInvalido.focus();
            return;
        }

        const botao = form.querySelector("button[type='submit']");
        botao.disabled = true;

        try {
            const nuvem = await window.CC.obterNuvem();
            await nuvem.enviarContato({ nome, email, assunto, mensagem });
        } catch (erro) {
            console.warn(erro);
            mostrarToast("Não foi possível enviar a mensagem. Verifique a conexão e tente de novo.", "erro");
            return;
        } finally {
            botao.disabled = false;
        }

        form.reset();
        preencherDadosDoContato();
        el.msgContato.textContent = "Mensagem enviada! Obrigado pelo contato.";
        el.msgContato.hidden = false;
        mostrarToast("Mensagem enviada.");
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    aoCarregar(() => {
        el.contatoNome = document.getElementById("contato-nome");
        el.contatoEmail = document.getElementById("contato-email");
        el.assunto = document.getElementById("contato-assunto");
        el.mensagem = document.getElementById("contato-mensagem");
        el.contador = document.getElementById("contato-contador");
        el.msgContato = document.getElementById("msg-contato");

        preencherDadosDoContato();

        document.getElementById("form-contato").addEventListener("submit", aoEnviarContato);
        el.mensagem.addEventListener("input", atualizarContador);
    });
})();
