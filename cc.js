/* =========================================================
   CONTROLE CERTO - cc.js
   Código COMUM a todas as páginas. Cada página carrega este
   arquivo primeiro e depois o seu próprio script (login.js,
   painel.js, metas.js, relatorios.js, galeria.js, sobre.js).

   Atributos esperados no <body>:
     data-pagina="nome"        identifica a página
     data-protegida="true"     exige login para abrir a página

   Tudo o que as outras páginas usam fica em window.CC.
   ========================================================= */
(function () {
    "use strict";

    // ==========================================
    // 1. CONSTANTES
    // ==========================================
    // IMPORTANTE: a v1 e a v2 ficam no mesmo domínio (github.io) e, por isso,
    // compartilham o localStorage. A v2 usa o prefixo "v2_" para NUNCA ler,
    // alterar ou apagar os dados da versão estável.
    // Na v2 os dados financeiros ficam no Firestore (nuvem). No navegador
    // guardamos só o nome para exibir. Prefixo "v2_" para nunca tocar na v1.
    const CHAVES = {
        sessao: "v2_sessao"
    };

    const LIMITE_TEXTO = 40;
    const PAGINA_LOGIN = "login.html";
    const PAGINA_INICIO = "index.html";
    const REGEX_FOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

    // ==========================================
    // 2. ARMAZENAMENTO (localStorage com proteção)
    // ==========================================
    function lerTexto(chave, padrao = "") {
        try {
            const valor = localStorage.getItem(chave);
            return valor === null ? padrao : valor;
        } catch (erro) {
            return padrao;
        }
    }

    function salvarTexto(chave, valor) {
        try {
            localStorage.setItem(chave, String(valor));
            return true;
        } catch (erro) {
            console.warn(`Não foi possível salvar "${chave}".`, erro);
            return false;
        }
    }

    function remover(chave) {
        try {
            localStorage.removeItem(chave);
        } catch (erro) {
            console.warn(`Não foi possível remover "${chave}".`, erro);
        }
    }

    function lerJSON(chave, padrao) {
        try {
            const bruto = localStorage.getItem(chave);
            if (bruto === null) return padrao;
            const dado = JSON.parse(bruto);
            if (Array.isArray(padrao) && !Array.isArray(dado)) return padrao;
            return dado;
        } catch (erro) {
            console.warn(`Dados inválidos em "${chave}". Usando o valor padrão.`, erro);
            return padrao;
        }
    }

    function salvarJSON(chave, valor) {
        return salvarTexto(chave, JSON.stringify(valor));
    }

    // ==========================================
    // 3. VALIDAÇÃO E FORMATAÇÃO
    // ==========================================
    const formatadorBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

    function formatarMoeda(numero) {
        return formatadorBRL.format(Number.isFinite(numero) ? numero : 0);
    }

    const REGEX_VALOR_BR = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/;

    // "1.500,50" -> 1500.5  (devolve null se o texto for inválido)
    function parseValor(texto) {
        const limpo = String(texto).replace(/R\$|\s/g, "");
        if (!REGEX_VALOR_BR.test(limpo)) return null;

        const numero = parseFloat(limpo.replace(/\./g, "").replace(",", "."));
        return numero > 0 && numero < 1e9 ? numero : null;
    }

    // Aceita número ou texto (dados antigos guardavam o valor como texto)
    function paraNumero(valor) {
        if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
        return parseValor(valor) || 0;
    }

    const REGEX_DATA_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

    // "5/3/2026" -> "05/03/2026"  (devolve null se a data não existir)
    function parseData(texto) {
        const partes = REGEX_DATA_BR.exec(String(texto).trim());
        if (!partes) return null;

        const dia = Number(partes[1]);
        const mes = Number(partes[2]);
        const ano = Number(partes[3]);

        const data = new Date(ano, mes - 1, dia);
        const existe = data.getFullYear() === ano
            && data.getMonth() === mes - 1
            && data.getDate() === dia;

        if (!existe || ano < 2000 || ano > 2100) return null;

        return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
    }

    function limparTexto(texto, maximo = LIMITE_TEXTO) {
        const limpo = String(texto).replace(/\s+/g, " ").trim();
        return limpo.length > 0 && limpo.length <= maximo ? limpo : null;
    }

    function normalizarEmail(email) {
        return String(email).trim().toLowerCase();
    }

    function validarEmail(email) {
        const texto = String(email).trim();
        return texto.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto);
    }

    // ==========================================
    // 4. CRIAÇÃO SEGURA DE ELEMENTOS (sem innerHTML)
    // ==========================================
    function criarElemento(tag, opcoes = {}, filhos = []) {
        const el = document.createElement(tag);
        if (opcoes.classe) el.className = opcoes.classe;
        if (opcoes.texto !== undefined) el.textContent = opcoes.texto;
        if (opcoes.attrs) {
            Object.entries(opcoes.attrs).forEach(([nome, valor]) => el.setAttribute(nome, valor));
        }
        filhos.forEach(filho => el.append(filho));
        return el;
    }

    function criarIcone(classes) {
        return criarElemento("i", { classe: classes, attrs: { "aria-hidden": "true" } });
    }

    // ==========================================
    // 5. SESSÃO
    // ==========================================
    function usuarioAtual() {
        return lerTexto(CHAVES.sessao, "");
    }

    function estaLogado() {
        return usuarioAtual() !== "";
    }

    async function sair() {
        try {
            // Nada pode impedir a pessoa de sair: espera no máximo 3 segundos no total
            const limite = new Promise(resolver => setTimeout(() => resolver(null), 3000));
            const nuvem = await Promise.race([obterNuvem(), limite]);
            if (nuvem) await Promise.race([nuvem.sair(), limite]);
        } catch (erro) {
            console.warn("Não foi possível encerrar a sessão na nuvem.", erro);
        }
        remover(CHAVES.sessao);
        window.CC.irPara(PAGINA_LOGIN, false);
    }

    // ==========================================
    // 5.1 DADOS FINANCEIROS (despesas, metas e renda)
    // Camada única de leitura/gravação usada por todas as páginas.
    // Converte dados antigos (valor em texto, sem id/categoria).
    // ==========================================
    const CATEGORIAS = [
        { id: "moradia", nome: "Moradia", grupo: "necessidade" },
        { id: "alimentacao", nome: "Alimentação", grupo: "necessidade" },
        { id: "transporte", nome: "Transporte", grupo: "necessidade" },
        { id: "saude", nome: "Saúde", grupo: "necessidade" },
        { id: "educacao", nome: "Educação", grupo: "necessidade" },
        { id: "lazer", nome: "Lazer", grupo: "desejo" },
        { id: "compras", nome: "Compras", grupo: "desejo" },
        { id: "outros", nome: "Outros", grupo: "desejo" }
    ];

    const MESES = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];

    function gerarId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function buscarCategoria(id) {
        return CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
    }

    // Aceita "2026-10-15" (campo de data) ou "15/10/2026" e devolve "15/10/2026"
    function lerCampoData(valor) {
        const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor).trim());
        return parseData(iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : valor);
    }

    function hojeISO() {
        const hoje = new Date();
        const mes = String(hoje.getMonth() + 1).padStart(2, "0");
        const dia = String(hoje.getDate()).padStart(2, "0");
        return `${hoje.getFullYear()}-${mes}-${dia}`;
    }

    // "15/10/2026" -> "2026-10"
    function chaveMes(dataBR) {
        const [, mes, ano] = String(dataBR).split("/");
        return `${ano}-${mes}`;
    }

    // "15/10/2026" -> "20261015" (serve para ordenar)
    function chaveOrdem(dataBR) {
        const [dia, mes, ano] = String(dataBR).split("/");
        return `${ano}${mes}${dia}`;
    }

    // "2026-10" -> "Outubro de 2026"
    function rotuloMes(chave) {
        const [ano, mes] = String(chave).split("-");
        const nome = MESES[Number(mes) - 1] || "";
        return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
    }

    function normalizarDespesa(item) {
        if (!item || typeof item !== "object") return null;

        const data = parseData(item.data);
        const descricao = limparTexto(item.descricao);
        const valor = paraNumero(item.valor);
        if (!data || !descricao || valor <= 0) return null;

        return {
            id: typeof item.id === "string" && item.id ? item.id : gerarId(),
            data,
            descricao,
            categoria: buscarCategoria(item.categoria).id,
            valor,
            recorrente: Boolean(item.recorrente)
        };
    }

    // ---- Dados da pessoa logada, carregados do Firestore ao abrir cada página ----
    const dados = { renda: 0, foto: "", despesas: [], metas: [] };
    let promessaDados = null;

    function mensagemDeErroDeGravacao(erro) {
        const codigo = erro && erro.code;
        if (codigo === "sem-conexao" || (typeof navigator !== "undefined" && navigator.onLine === false)) {
            return "Sem conexão com a internet. Verifique e tente de novo.";
        }
        if (codigo === "tempo-esgotado") {
            return "Não foi possível confirmar o salvamento. Recarregue a página para ver o que foi salvo.";
        }
        if (codigo === "permission-denied") return "Sem permissão para salvar. Entre na sua conta de novo.";
        return "Não foi possível salvar. Tente de novo.";
    }

    // Executa uma gravação na nuvem; avisa a pessoa e devolve true ou false.
    // Offline não grava (o site exige internet), para nada ficar "na fila" escondido.
    async function gravarNaNuvem(operacao) {
        try {
            if (typeof navigator !== "undefined" && navigator.onLine === false) throw { code: "sem-conexao" };
            const nuvem = await obterNuvem();
            await operacao(nuvem);
            return true;
        } catch (erro) {
            console.warn("Falha ao gravar na nuvem.", erro);
            mostrarToast(mensagemDeErroDeGravacao(erro), "erro");
            return false;
        }
    }

    // O que mudou entre a lista antiga e a nova (para gravar só a diferença)
    function diferenca(antigos, novos) {
        const porId = new Map(antigos.map(item => [item.id, JSON.stringify(item)]));
        const idsNovos = new Set(novos.map(item => item.id));
        return {
            gravar: novos.filter(item => porId.get(item.id) !== JSON.stringify(item)),
            apagar: antigos.filter(item => !idsNovos.has(item.id)).map(item => item.id)
        };
    }

    async function carregarDadosDaNuvem() {
        const nuvem = await obterNuvem();
        const recebidos = await nuvem.carregarDados();

        dados.renda = Number.isFinite(recebidos.renda) && recebidos.renda > 0 ? recebidos.renda : 0;
        dados.foto = typeof recebidos.foto === "string" && REGEX_FOTO.test(recebidos.foto) ? recebidos.foto : "";
        dados.despesas = (recebidos.despesas || []).map(normalizarDespesa).filter(Boolean);
        dados.metas = (recebidos.metas || []).map(normalizarMeta).filter(Boolean);
    }

    // Carrega uma única vez por página (todos os chamadores esperam a mesma promessa)
    function garantirDados() {
        if (!promessaDados) {
            promessaDados = carregarDadosDaNuvem().catch(erro => {
                promessaDados = null;
                throw erro;
            });
        }
        return promessaDados;
    }

    function lerDespesas() {
        return dados.despesas.map(item => ({ ...item }));
    }

    async function salvarDespesas(lista) {
        const novas = lista.map(normalizarDespesa).filter(Boolean);
        const { gravar, apagar } = diferenca(dados.despesas, novas);
        if (gravar.length === 0 && apagar.length === 0) return true;

        const gravou = await gravarNaNuvem(nuvem => nuvem.gravarDespesas(gravar, apagar));
        if (gravou) dados.despesas = novas;
        return gravou;
    }

    function normalizarMeta(item) {
        if (!item || typeof item !== "object") return null;

        const nome = limparTexto(item.nome);
        const objetivo = Number(item.objetivo);
        const guardado = Number(item.guardado);
        if (!nome || !Number.isFinite(objetivo) || objetivo <= 0) return null;

        return {
            id: typeof item.id === "string" && item.id ? item.id : gerarId(),
            nome,
            objetivo,
            guardado: Number.isFinite(guardado) && guardado > 0 ? guardado : 0
        };
    }

    function lerMetas() {
        return dados.metas.map(item => ({ ...item }));
    }

    async function salvarMetas(lista) {
        const novas = lista.map(normalizarMeta).filter(Boolean);
        const { gravar, apagar } = diferenca(dados.metas, novas);
        if (gravar.length === 0 && apagar.length === 0) return true;

        const gravou = await gravarNaNuvem(nuvem => nuvem.gravarMetas(gravar, apagar));
        if (gravou) dados.metas = novas;
        return gravou;
    }

    function lerRenda() {
        return dados.renda;
    }

    async function salvarRenda(valor) {
        const gravou = await gravarNaNuvem(nuvem => nuvem.salvarRenda(valor));
        if (gravou) dados.renda = valor;
        return gravou;
    }

    function fotoAtual() {
        return dados.foto;
    }

    async function salvarFoto(foto) {
        const gravou = await gravarNaNuvem(nuvem => nuvem.salvarFoto(foto));
        if (gravou) dados.foto = foto;
        return gravou;
    }

    async function apagarDadosFinanceiros() {
        const gravou = await gravarNaNuvem(nuvem => nuvem.apagarDadosFinanceiros());
        if (gravou) {
            dados.renda = 0;
            dados.despesas = [];
            dados.metas = [];
        }
        return gravou;
    }

    // ==========================================
    // 6. INICIALIZAÇÃO E PROTEÇÃO DE PÁGINA
    // ==========================================
    const protegida = document.body.dataset.protegida === "true";
    const TEMPO_LIMITE_SESSAO_MS = 12000;
    const TEMPO_LIMITE_DADOS_MS = 15000;
    let ativo = true;

    // Navegação em uma função própria (facilita testar e manter)
    function irPara(endereco, substituir = true) {
        if (substituir) window.location.replace(endereco);
        else window.location.href = endereco;
    }

    // ---- Ponte com o Firebase: o nuvem.js registra a API e informa a sessão ----
    let apiNuvem = null;
    const esperandoNuvem = [];
    let usuarioDaNuvem;            // undefined = ainda não sabemos | null = sem login | objeto = logado
    const esperandoSessao = [];

    function registrarNuvem(api) {
        apiNuvem = api;
        esperandoNuvem.splice(0).forEach(resolver => resolver(api));
    }

    function obterNuvem() {
        return apiNuvem
            ? Promise.resolve(apiNuvem)
            : new Promise(resolver => esperandoNuvem.push(resolver));
    }

    function aguardarSessao() {
        return usuarioDaNuvem !== undefined
            ? Promise.resolve(usuarioDaNuvem)
            : new Promise(resolver => esperandoSessao.push(resolver));
    }

    function comLimiteDeTempo(promessa, milissegundos) {
        return Promise.race([
            promessa,
            new Promise((_, rejeitar) => setTimeout(() => rejeitar({ code: "tempo-esgotado" }), milissegundos))
        ]);
    }

    function mostrarErroConexao(
        titulo = "Sem conexão com o serviço",
        texto = "Não foi possível verificar o seu login. Confira a internet e tente de novo."
    ) {
        document.documentElement.classList.remove("aguardando-sessao");
        if (document.querySelector(".erro-conexao")) return;

        const botao = criarElemento("button", { classe: "btn", texto: "Tentar de novo", attrs: { type: "button" } });
        botao.addEventListener("click", () => window.location.reload());

        document.body.append(criarElemento("div", { classe: "erro-conexao", attrs: { role: "alert" } }, [
            criarElemento("h1", { texto: titulo }),
            criarElemento("p", { texto }),
            botao
        ]));
    }

    // Só mostra a página depois que os dados da pessoa chegaram do banco
    function liberarPaginaQuandoPronta() {
        comLimiteDeTempo(garantirDados(), TEMPO_LIMITE_DADOS_MS)
            .then(() => document.documentElement.classList.remove("aguardando-sessao"))
            .catch(() => mostrarErroConexao(
                "Não foi possível carregar seus dados",
                "Confira a internet e tente de novo."
            ));
    }

    // Chamada pelo nuvem.js sempre que o estado de login muda.
    // usuario = { uid, nome, email } ou null
    function sessaoResolvida(usuario) {
        const uidAnterior = usuarioDaNuvem ? usuarioDaNuvem.uid : null;
        usuarioDaNuvem = usuario || null;
        const uidNovo = usuarioDaNuvem ? usuarioDaNuvem.uid : null;

        // Outra pessoa (ou saída): descarta os dados que estavam na memória
        if (uidAnterior !== uidNovo) {
            promessaDados = null;
            dados.renda = 0;
            dados.foto = "";
            dados.despesas = [];
            dados.metas = [];
        }

        if (usuarioDaNuvem) salvarTexto(CHAVES.sessao, usuarioDaNuvem.nome);
        else remover(CHAVES.sessao);

        document.querySelectorAll(".erro-conexao").forEach(caixa => caixa.remove());

        if (protegida && !usuarioDaNuvem) {
            ativo = false;                       // a página continua escondida
            window.CC.irPara(PAGINA_LOGIN);
        } else if (protegida) {
            liberarPaginaQuandoPronta();
        }

        if (usuarioDaNuvem && document.readyState !== "loading") aplicarNome();

        esperandoSessao.splice(0).forEach(resolver => resolver(usuarioDaNuvem));
    }

    // Páginas protegidas ficam escondidas até o Firebase confirmar o login
    if (protegida) {
        document.documentElement.classList.add("aguardando-sessao");
        setTimeout(() => {
            if (usuarioDaNuvem === undefined) mostrarErroConexao();
        }, TEMPO_LIMITE_SESSAO_MS);
    }

    // Executa a função quando o DOM estiver pronto e, nas páginas protegidas,
    // só depois que o login for confirmado e os dados carregados.
    function aoCarregar(funcao) {
        if (!ativo) return;

        const executar = () => {
            if (!protegida) {
                funcao();
                return;
            }
            aguardarSessao().then(usuario => {
                if (usuario) garantirDados().then(funcao, () => {});
            });
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", executar);
        } else {
            executar();
        }
    }

    // Botão "voltar" do navegador pode mostrar página protegida guardada em cache
    window.addEventListener("pageshow", evento => {
        if (protegida && evento.persisted && !estaLogado()) {
            window.CC.irPara(PAGINA_LOGIN);
        }
    });

    // ==========================================
    // 7. AVISOS (toast)
    // ==========================================
    let elementoToast = null;
    let temporizadorToast = null;

    function prepararToast() {
        if (elementoToast) return;
        elementoToast = criarElemento("div", {
            classe: "toast",
            attrs: { role: "status", "aria-live": "polite" }
        });
        document.body.appendChild(elementoToast);
    }

    function mostrarToast(mensagem, tipo = "info") {
        prepararToast();
        elementoToast.textContent = mensagem;
        elementoToast.classList.toggle("toast--erro", tipo === "erro");

        elementoToast.classList.remove("visivel");
        void elementoToast.offsetWidth; // reinicia a animação
        elementoToast.classList.add("visivel");

        clearTimeout(temporizadorToast);
        temporizadorToast = setTimeout(() => {
            elementoToast.classList.remove("visivel");
        }, 4000);
    }

    // ==========================================
    // 8. FOTO E NOME DO USUÁRIO NA INTERFACE
    // ==========================================
    // Atualiza todos os elementos [data-avatar] com a foto (ou o ícone padrão)
    function aplicarFoto(foto = dados.foto) {
        const valida = Boolean(foto) && REGEX_FOTO.test(foto);

        document.querySelectorAll("[data-avatar]").forEach(alvo => {
            if (valida) {
                const img = criarElemento("img", { attrs: { src: foto, alt: "" } });
                alvo.replaceChildren(img);
            } else {
                alvo.replaceChildren(criarIcone("fa-solid fa-user"));
            }
        });
    }

    function aplicarNome(nome = usuarioAtual()) {
        document.querySelectorAll("[data-nome-usuario]").forEach(el => {
            el.textContent = nome || "Visitante";
        });
    }

    // ==========================================
    // 9. LOGOTIPO (usa um ícone se assets/logo.png não existir)
    // ==========================================
    function iniciarLogo() {
        document.querySelectorAll(".marca").forEach(marca => {
            const img = marca.querySelector(".marca__img");
            if (!img) return;

            const falhou = () => marca.classList.add("marca--sem-imagem");

            if (img.complete && img.naturalWidth === 0) {
                falhou();
            } else {
                img.addEventListener("error", falhou);
            }
        });
    }

    // ==========================================
    // 10. MENU RESPONSIVO
    // ==========================================
    function iniciarMenu() {
        const botao = document.getElementById("menu-btn");
        const menu = document.getElementById("menu-principal");
        const overlay = document.getElementById("overlay");
        const botaoFechar = document.getElementById("menu-fechar");
        if (!botao || !menu) return;

        const telaPequena = window.matchMedia("(max-width: 900px)");
        const aberto = () => menu.classList.contains("aberto");

        function abrir() {
            menu.classList.add("aberto");
            if (overlay) overlay.classList.add("visivel");
            document.body.classList.add("menu-aberto");
            botao.setAttribute("aria-expanded", "true");
            botao.setAttribute("aria-label", "Fechar menu");

            const primeiroLink = menu.querySelector(".menu__link");
            if (primeiroLink) primeiroLink.focus();
        }

        function fechar(devolverFoco) {
            menu.classList.remove("aberto");
            if (overlay) overlay.classList.remove("visivel");
            document.body.classList.remove("menu-aberto");
            botao.setAttribute("aria-expanded", "false");
            botao.setAttribute("aria-label", "Abrir menu");
            if (devolverFoco) botao.focus();
        }

        botao.addEventListener("click", () => (aberto() ? fechar(true) : abrir()));
        if (botaoFechar) botaoFechar.addEventListener("click", () => fechar(true));
        if (overlay) overlay.addEventListener("click", () => fechar(false));

        menu.querySelectorAll(".menu__link").forEach(link => {
            link.addEventListener("click", () => fechar(false));
        });

        document.addEventListener("keydown", evento => {
            if (!aberto()) return;

            if (evento.key === "Escape") {
                fechar(true);
                return;
            }

            // Mantém o foco do teclado dentro do menu enquanto ele está aberto
            if (evento.key === "Tab") {
                const focaveis = Array.from(menu.querySelectorAll("a[href], button:not([disabled])"));
                if (focaveis.length === 0) return;

                const primeiro = focaveis[0];
                const ultimo = focaveis[focaveis.length - 1];

                if (evento.shiftKey && document.activeElement === primeiro) {
                    evento.preventDefault();
                    ultimo.focus();
                } else if (!evento.shiftKey && document.activeElement === ultimo) {
                    evento.preventDefault();
                    primeiro.focus();
                }
            }
        });

        // Ao ampliar a janela, o menu volta ao modo horizontal
        telaPequena.addEventListener("change", evento => {
            if (!evento.matches) fechar(false);
        });
    }

    // ==========================================
    // 11. INICIALIZAÇÃO COMUM
    // ==========================================
    aoCarregar(() => {
        iniciarLogo();
        prepararToast();
        iniciarMenu();
        aplicarNome();
        aplicarFoto();

        document.querySelectorAll("[data-acao='sair']").forEach(botao => {
            botao.addEventListener("click", sair);
        });

        document.querySelectorAll("[data-ano]").forEach(el => {
            el.textContent = new Date().getFullYear();
        });
    });

    // ==========================================
    // 12. API PÚBLICA (usada pelos scripts de cada página)
    // ==========================================
    window.CC = {
        CHAVES,
        LIMITE_TEXTO,
        PAGINA_INICIO,
        PAGINA_LOGIN,
        REGEX_FOTO,
        CATEGORIAS,
        aoCarregar,
        lerTexto,
        salvarTexto,
        remover,
        lerJSON,
        salvarJSON,
        formatarMoeda,
        parseValor,
        paraNumero,
        parseData,
        limparTexto,
        normalizarEmail,
        validarEmail,
        criarElemento,
        criarIcone,
        usuarioAtual,
        estaLogado,
        sair,
        irPara,
        registrarNuvem,
        obterNuvem,
        aguardarSessao,
        sessaoResolvida,
        usuarioNuvem: () => usuarioDaNuvem || null,
        mostrarToast,
        aplicarFoto,
        aplicarNome,
        buscarCategoria,
        lerCampoData,
        hojeISO,
        chaveMes,
        chaveOrdem,
        rotuloMes,
        gerarId,
        lerDespesas,
        salvarDespesas,
        lerMetas,
        salvarMetas,
        lerRenda,
        salvarRenda,
        fotoAtual,
        salvarFoto,
        apagarDadosFinanceiros
    };
})();
