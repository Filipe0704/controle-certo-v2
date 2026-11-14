/* =========================================================
   CONTROLE CERTO v2 - login.js
   Tela de Entrar / Criar conta / Recuperar senha.
   A autenticação é feita pelo Firebase (ver nuvem.js): este
   arquivo valida os campos, mostra as mensagens e chama a nuvem.
   Nenhuma senha é guardada pelo site.
   ========================================================= */
(function () {
    "use strict";

    if (!window.CC) return;

    const {
        LIMITE_TEXTO, PAGINA_INICIO,
        aoCarregar, limparTexto, normalizarEmail, validarEmail
    } = window.CC;

    const SENHA_MIN = 8;
    const SENHA_MAX = 128;
    const TEMPO_NUVEM_MS = 10000;
    const MSG_SEM_CONEXAO =
        "Não foi possível conectar ao serviço de login. Verifique a internet e recarregue a página.";

    // ==========================================
    // MENSAGENS E ERROS DE CAMPO
    // ==========================================
    let elMensagem = null;

    function mostrarMensagem(texto, tipo) {
        elMensagem.className = `alerta alerta--${tipo}`;
        elMensagem.textContent = texto;
        elMensagem.hidden = false;
    }

    function limparMensagem() {
        elMensagem.hidden = true;
        elMensagem.textContent = "";
    }

    function definirErro(input, texto) {
        const elErro = document.getElementById(`${input.id}-erro`);
        if (elErro) elErro.textContent = texto;
        input.setAttribute("aria-invalid", texto ? "true" : "false");
    }

    function limparErros(formulario) {
        formulario.querySelectorAll("input").forEach(input => definirErro(input, ""));
    }

    // Guarda o primeiro campo com erro para dar foco nele
    function criarValidador() {
        let primeiro = null;
        return {
            invalidar(input, texto) {
                definirErro(input, texto);
                if (!primeiro) primeiro = input;
            },
            finalizar() {
                if (primeiro) primeiro.focus();
                return primeiro === null;
            }
        };
    }

    // Espera a nuvem carregar, mas não para sempre (internet ruim ou bloqueio)
    function obterNuvemComLimite() {
        return Promise.race([
            window.CC.obterNuvem(),
            new Promise(resolver => setTimeout(() => resolver(null), TEMPO_NUVEM_MS))
        ]);
    }

    // ==========================================
    // FORÇA DA SENHA
    // ==========================================
    function avaliarSenha(senha) {
        if (senha.length === 0) return { nivel: 0, texto: `Use no mínimo ${SENHA_MIN} caracteres.` };
        if (senha.length < SENHA_MIN) return { nivel: 1, texto: "Senha muito curta." };

        let pontos = 0;
        if (senha.length >= 12) pontos++;
        if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
        if (/\d/.test(senha)) pontos++;
        if (/[^A-Za-z0-9]/.test(senha)) pontos++;

        if (pontos <= 1) return { nivel: 2, texto: "Força da senha: razoável." };
        if (pontos === 2) return { nivel: 3, texto: "Força da senha: boa." };
        return { nivel: 4, texto: "Força da senha: forte." };
    }

    function atualizarForcaSenha(senha) {
        const { nivel, texto } = avaliarSenha(senha);
        const barra = document.getElementById("forca-barra");
        barra.dataset.nivel = String(nivel);
        barra.style.width = `${nivel * 25}%`;
        document.getElementById("forca-texto").textContent = texto;
    }

    // ==========================================
    // ABAS (Entrar / Criar conta) e tela de recuperação
    // ==========================================
    const abas = [];
    let painelRecuperar = null;
    let listaDeAbas = null;

    function selecionarAba(nome, focar) {
        limparMensagem();
        painelRecuperar.hidden = true;
        listaDeAbas.hidden = false;

        abas.forEach(item => {
            const ativa = item.nome === nome;
            item.aba.setAttribute("aria-selected", String(ativa));
            item.aba.tabIndex = ativa ? 0 : -1;
            item.painel.hidden = !ativa;
            if (ativa && focar) item.aba.focus();
        });
    }

    function abrirRecuperacao() {
        limparMensagem();
        abas.forEach(item => { item.painel.hidden = true; });
        listaDeAbas.hidden = true;
        painelRecuperar.hidden = false;

        // Aproveita o e-mail que a pessoa já digitou
        const campo = document.getElementById("rec-email");
        campo.value = document.getElementById("login-email").value;
        campo.focus();
    }

    function iniciarAbas() {
        listaDeAbas = document.querySelector(".abas");
        painelRecuperar = document.getElementById("painel-recuperar");

        [
            { nome: "entrar", aba: "aba-entrar", painel: "painel-entrar" },
            { nome: "cadastro", aba: "aba-cadastro", painel: "painel-cadastro" }
        ].forEach(item => {
            abas.push({
                nome: item.nome,
                aba: document.getElementById(item.aba),
                painel: document.getElementById(item.painel)
            });
        });

        abas.forEach((item, indice) => {
            item.aba.addEventListener("click", () => selecionarAba(item.nome, false));

            item.aba.addEventListener("keydown", evento => {
                let destino = null;
                if (evento.key === "ArrowRight") destino = (indice + 1) % abas.length;
                if (evento.key === "ArrowLeft") destino = (indice - 1 + abas.length) % abas.length;
                if (evento.key === "Home") destino = 0;
                if (evento.key === "End") destino = abas.length - 1;

                if (destino !== null) {
                    evento.preventDefault();
                    selecionarAba(abas[destino].nome, true);
                }
            });
        });

        document.getElementById("abrir-recuperar").addEventListener("click", abrirRecuperacao);
        document.getElementById("voltar-entrar").addEventListener("click", () => selecionarAba("entrar", false));

        // Permite abrir direto na aba de cadastro: login.html?aba=cadastro
        const aba = new URLSearchParams(window.location.search).get("aba");
        if (aba === "cadastro") selecionarAba("cadastro", false);
    }

    // ==========================================
    // MOSTRAR / OCULTAR SENHA
    // ==========================================
    function iniciarBotoesSenha() {
        document.querySelectorAll(".campo-senha__ver").forEach(botao => {
            botao.addEventListener("click", () => {
                const input = document.getElementById(botao.dataset.alvo);
                const mostrar = input.type === "password";

                input.type = mostrar ? "text" : "password";
                botao.setAttribute("aria-pressed", String(mostrar));
                botao.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
                botao.querySelector("i").className = mostrar ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
            });
        });
    }

    // ==========================================
    // CADASTRO
    // ==========================================
    async function aoCadastrar(evento) {
        evento.preventDefault();
        const form = evento.currentTarget;
        limparMensagem();
        limparErros(form);

        const campoNome = document.getElementById("cad-nome");
        const campoEmail = document.getElementById("cad-email");
        const campoSenha = document.getElementById("cad-senha");
        const campoConfirma = document.getElementById("cad-confirma");

        const nome = limparTexto(campoNome.value);
        const email = normalizarEmail(campoEmail.value);
        const senha = campoSenha.value;
        const confirma = campoConfirma.value;

        const validador = criarValidador();
        if (nome === null) {
            validador.invalidar(campoNome, `Informe seu nome com até ${LIMITE_TEXTO} caracteres.`);
        }
        if (!validarEmail(email)) {
            validador.invalidar(campoEmail, "Informe um e-mail válido, como nome@exemplo.com.");
        }
        if (senha.length < SENHA_MIN || senha.length > SENHA_MAX) {
            validador.invalidar(campoSenha, `A senha deve ter de ${SENHA_MIN} a ${SENHA_MAX} caracteres.`);
        } else if (confirma !== senha) {
            validador.invalidar(campoConfirma, "As senhas não são iguais.");
        }
        if (!validador.finalizar()) return;

        const botao = form.querySelector("button[type='submit']");
        botao.disabled = true;

        try {
            const nuvem = await obterNuvemComLimite();
            if (!nuvem) {
                mostrarMensagem(MSG_SEM_CONEXAO, "erro");
                return;
            }

            try {
                await nuvem.cadastrar(nome, email, senha);
            } catch (erro) {
                mostrarMensagem(nuvem.traduzirErro(erro), "erro");
                return;
            }

            window.CC.irPara(PAGINA_INICIO, false);
        } finally {
            botao.disabled = false;
        }
    }

    // ==========================================
    // LOGIN
    // ==========================================
    async function aoEntrar(evento) {
        evento.preventDefault();
        const form = evento.currentTarget;
        limparMensagem();
        limparErros(form);

        const campoEmail = document.getElementById("login-email");
        const campoSenha = document.getElementById("login-senha");
        const email = normalizarEmail(campoEmail.value);
        const senha = campoSenha.value;

        const validador = criarValidador();
        if (!validarEmail(email)) {
            validador.invalidar(campoEmail, "Informe um e-mail válido, como nome@exemplo.com.");
        }
        if (senha.length === 0) {
            validador.invalidar(campoSenha, "Digite sua senha.");
        }
        if (!validador.finalizar()) return;

        const botao = form.querySelector("button[type='submit']");
        botao.disabled = true;

        try {
            const nuvem = await obterNuvemComLimite();
            if (!nuvem) {
                mostrarMensagem(MSG_SEM_CONEXAO, "erro");
                return;
            }

            try {
                await nuvem.entrar(email, senha);
            } catch (erro) {
                campoSenha.value = "";
                mostrarMensagem(nuvem.traduzirErro(erro), "erro");
                campoSenha.focus();
                return;
            }

            window.CC.irPara(PAGINA_INICIO, false);
        } finally {
            botao.disabled = false;
        }
    }

    // ==========================================
    // RECUPERAR SENHA
    // ==========================================
    async function aoRecuperar(evento) {
        evento.preventDefault();
        const form = evento.currentTarget;
        limparMensagem();
        limparErros(form);

        const campoEmail = document.getElementById("rec-email");
        const email = normalizarEmail(campoEmail.value);

        if (!validarEmail(email)) {
            definirErro(campoEmail, "Informe um e-mail válido, como nome@exemplo.com.");
            campoEmail.focus();
            return;
        }

        const botao = form.querySelector("button[type='submit']");
        botao.disabled = true;

        try {
            const nuvem = await obterNuvemComLimite();
            if (!nuvem) {
                mostrarMensagem(MSG_SEM_CONEXAO, "erro");
                return;
            }

            try {
                await nuvem.recuperarSenha(email);
            } catch (erro) {
                // Não revelamos se o e-mail existe: o aviso é igual nos dois casos
                if (!erro || erro.code !== "auth/user-not-found") {
                    mostrarMensagem(nuvem.traduzirErro(erro), "erro");
                    return;
                }
            }

            mostrarMensagem(
                "Se existir uma conta com este e-mail, enviamos um link para redefinir a senha. " +
                "Confira também a caixa de spam.",
                "sucesso"
            );
        } finally {
            botao.disabled = false;
        }
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    aoCarregar(() => {
        elMensagem = document.getElementById("mensagem");

        iniciarAbas();
        iniciarBotoesSenha();

        document.getElementById("painel-entrar").addEventListener("submit", aoEntrar);
        document.getElementById("painel-cadastro").addEventListener("submit", aoCadastrar);
        painelRecuperar.addEventListener("submit", aoRecuperar);
        document.getElementById("cad-senha").addEventListener("input", evento => {
            atualizarForcaSenha(evento.target.value);
        });

        // Quem já está logado vai direto para o painel
        window.CC.aguardarSessao().then(usuario => {
            if (usuario) window.CC.irPara(PAGINA_INICIO);
        });
    });
})();
