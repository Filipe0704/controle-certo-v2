/* =========================================================
   CONTROLE CERTO v2 - conta.js
   Página "Minha conta":
   1) foto de perfil (recortada e reduzida no aparelho);
   2) nome de exibição;
   3) apagar os dados financeiros.
   Depende de cc.js (window.CC) e nuvem.js (Firebase).
   ========================================================= */
(function () {
    "use strict";

    if (!window.CC) return;

    const {
        LIMITE_TEXTO, REGEX_FOTO,
        aoCarregar, limparTexto, mostrarToast,
        aplicarFoto, aplicarNome, usuarioAtual,
        salvarFoto, fotoAtual, apagarDadosFinanceiros
    } = window.CC;

    const FOTO_ARQUIVO_MAX_BYTES = 5 * 1024 * 1024;   // arquivo escolhido
    const FOTO_LADO = 256;                            // a foto é reduzida para 256 x 256
    const FOTO_MAX_CARACTERES = 150000;               // limite das regras do banco: 200000
    const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];

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
    // 1) FOTO DE PERFIL
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
    // 2) NOME DE EXIBIÇÃO
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
    // 3) APAGAR DADOS FINANCEIROS
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
        el.fotoErro = document.getElementById("foto-erro");
        el.removerFoto = document.getElementById("foto-remover");
        el.nomeConta = document.getElementById("editar-nome");
        el.apagarDados = document.getElementById("apagar-dados");

        const usuario = window.CC.usuarioNuvem();
        el.nomeConta.value = usuarioAtual();
        document.getElementById("conta-email").value = usuario && usuario.email ? usuario.email : "";
        atualizarBotaoRemoverFoto();

        // Só quem administra o site vê o atalho para as mensagens
        window.CC.obterNuvem().then(nuvem => {
            if (nuvem.ehAdministrador()) document.getElementById("area-admin").hidden = false;
        });

        document.getElementById("foto-input").addEventListener("change", aoEscolherFoto);
        el.removerFoto.addEventListener("click", aoRemoverFoto);
        document.getElementById("form-conta").addEventListener("submit", aoSalvarNome);
        el.apagarDados.addEventListener("click", aoApagarDados);
    });
})();
