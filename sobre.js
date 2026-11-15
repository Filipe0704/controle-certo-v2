/* =========================================================
   CONTROLE CERTO v2 - sobre.js
   Página "Sobre":
   1) formulário de contato (a mensagem vai para o banco);
   2) edição da conta: foto e nome de exibição;
   3) apagar os dados financeiros.
   Depende de cc.js (window.CC) e nuvem.js (Firebase).
   ========================================================= */
(function () {
    "use strict";

    if (!window.CC) return;

    const {
        LIMITE_TEXTO, REGEX_FOTO,
        aoCarregar, limparTexto, validarEmail, normalizarEmail, mostrarToast,
        aplicarFoto, aplicarNome, usuarioAtual,
        salvarFoto, fotoAtual, apagarDadosFinanceiros
    } = window.CC;

    const MENSAGEM_MIN = 10;
    const MENSAGEM_MAX = 500;
    const FOTO_ARQUIVO_MAX_BYTES = 5 * 1024 * 1024;   // arquivo escolhido
    const FOTO_LADO = 256;                            // a foto é reduzida para 256 x 256
    const FOTO_MAX_CARACTERES = 150000;               // limite das regras do banco: 200000
    const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
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
    // 1) CONTATO
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
    // 2) FOTO DE PERFIL
    // ==========================================
    function atualizarBotaoRemoverFoto() {
        el.removerFoto.disabled = fotoAtual() === "";
    }

    function lerComoDataUrl(arquivo) {
        return new Promise((resolver, rejeitar) => {
            const leitor = new FileReader();
            leitor.onload = () => resolver(String(leitor.result));
            leitor.onerror = () => rejeitar(new Error("leitura"));
            leitor.readAsDataURL(arquivo);
        });
    }

    // Recorta o centro, reduz para 256 x 256 e converte em JPEG (poucos KB)
    function reduzirImagem(dataUrl) {
        return new Promise((resolver, rejeitar) => {
            const imagem = new Image();

            imagem.onload = () => {
                const menor = Math.min(imagem.width, imagem.height);
                if (!menor) {
                    rejeitar(new Error("imagem vazia"));
                    return;
                }

                const tela = document.createElement("canvas");
                tela.width = FOTO_LADO;
                tela.height = FOTO_LADO;

                const contexto = tela.getContext("2d");
                contexto.fillStyle = "#1E293B";      // fundo para imagens com transparência
                contexto.fillRect(0, 0, FOTO_LADO, FOTO_LADO);
                contexto.drawImage(
                    imagem,
                    (imagem.width - menor) / 2, (imagem.height - menor) / 2, menor, menor,
                    0, 0, FOTO_LADO, FOTO_LADO
                );
                resolver(tela.toDataURL("image/jpeg", 0.82));
            };

            imagem.onerror = () => rejeitar(new Error("imagem inválida"));
            imagem.src = dataUrl;
        });
    }

    async function aoEscolherFoto(evento) {
        const entrada = evento.target;
        const arquivo = entrada.files && entrada.files[0];
        el.fotoErro.textContent = "";
        if (!arquivo) return;
        entrada.value = "";   // permite escolher o mesmo arquivo de novo

        if (!TIPOS_FOTO.includes(arquivo.type)) {
            el.fotoErro.textContent = "Escolha uma imagem JPG, PNG ou WebP.";
            return;
        }
        if (arquivo.size > FOTO_ARQUIVO_MAX_BYTES) {
            el.fotoErro.textContent = "A imagem deve ter até 5 MB. Escolha uma menor.";
            return;
        }

        let reduzida;
        try {
            reduzida = await reduzirImagem(await lerComoDataUrl(arquivo));
        } catch (erro) {
            el.fotoErro.textContent = "Não foi possível usar esta imagem. Tente outra.";
            return;
        }

        if (!REGEX_FOTO.test(reduzida) || reduzida.length > FOTO_MAX_CARACTERES) {
            el.fotoErro.textContent = "Não foi possível usar esta imagem. Tente outra.";
            return;
        }

        if (!(await salvarFoto(reduzida))) return;   // o cc.js já avisou o motivo

        aplicarFoto(reduzida);
        atualizarBotaoRemoverFoto();
        mostrarToast("Foto atualizada.");
    }

    async function aoRemoverFoto() {
        el.fotoErro.textContent = "";
        el.removerFoto.disabled = true;

        if (!(await salvarFoto(""))) {
            atualizarBotaoRemoverFoto();
            return;
        }

        aplicarFoto("");
        atualizarBotaoRemoverFoto();
        mostrarToast("Foto removida.");
    }

    // ==========================================
    // 3) NOME DE EXIBIÇÃO
    // ==========================================
    async function aoSalvarNome(evento) {
        evento.preventDefault();
        definirErro(el.nomeConta, "");

        const nome = limparTexto(el.nomeConta.value);
        if (nome === null) {
            definirErro(el.nomeConta, `Informe um nome de 1 a ${LIMITE_TEXTO} caracteres.`);
            el.nomeConta.focus();
            return;
        }

        const botao = evento.currentTarget.querySelector("button[type='submit']");
        botao.disabled = true;

        try {
            // O nome é guardado na conta do Firebase (e acompanha a pessoa em qualquer aparelho)
            const nuvem = await window.CC.obterNuvem();
            await nuvem.atualizarNome(nome);
        } catch (erro) {
            console.warn(erro);
            mostrarToast("Não foi possível salvar o nome. Verifique a conexão e tente de novo.", "erro");
            return;
        } finally {
            botao.disabled = false;
        }

        el.nomeConta.value = nome;
        aplicarNome(nome);
        mostrarToast("Nome atualizado.");
    }

    // ==========================================
    // 4) APAGAR DADOS FINANCEIROS
    // ==========================================
    async function aoApagarDados() {
        const confirmou = window.confirm(
            "Apagar a renda, as despesas e as metas da sua conta? Essa ação não pode ser desfeita."
        );
        if (!confirmou) return;

        el.apagarDados.disabled = true;
        const apagou = await apagarDadosFinanceiros();
        el.apagarDados.disabled = false;

        if (apagou) mostrarToast("Dados financeiros apagados.");
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
        el.fotoErro = document.getElementById("foto-erro");
        el.removerFoto = document.getElementById("foto-remover");
        el.nomeConta = document.getElementById("editar-nome");
        el.apagarDados = document.getElementById("apagar-dados");

        preencherDadosDoContato();
        el.nomeConta.value = usuarioAtual();
        atualizarBotaoRemoverFoto();

        document.getElementById("form-contato").addEventListener("submit", aoEnviarContato);
        el.mensagem.addEventListener("input", atualizarContador);

        document.getElementById("foto-input").addEventListener("change", aoEscolherFoto);
        el.removerFoto.addEventListener("click", aoRemoverFoto);
        document.getElementById("form-conta").addEventListener("submit", aoSalvarNome);
        el.apagarDados.addEventListener("click", aoApagarDados);
    });
})();
