# Controle Certo (v2, em desenvolvimento)

Sistema web de **controle financeiro pessoal**, desenvolvido como projeto acadêmico (Avaliação A2) com **HTML5, CSS3 e JavaScript puro**.

🔗 **Site publicado:** https://filipe0704.github.io/controle-certo-v2/login.html *(versão em desenvolvimento com dados na nuvem; a versão estável está em https://filipe0704.github.io/controle-certo/login.html)*

## O que o sistema faz

- **Login e cadastro** com validação; a senha é guardada com hash (PBKDF2 + salt), nunca em texto puro.
- **Painel:** renda mensal, despesas por categoria, filtro por mês, saldo e gráfico.
- **Metas:** objetivos com barra de progresso e depósitos.
- **Relatórios:** gastos por categoria e comparação com a regra **50/30/20**.
- **Galeria:** 12 ilustrações com filtro por categoria e visualização ampliada, navegável pelo teclado.
- **Sobre:** informações do projeto, formulário de contato e edição de conta (nome e foto).

## Tecnologias

HTML5 semântico · CSS3 (variáveis, grid, flexbox, media queries) · JavaScript (ES6+) · [Chart.js](https://www.chartjs.org/) · [Font Awesome](https://fontawesome.com/)

## Páginas

| Arquivo | Página |
|---|---|
| `login.html` | Entrar e criar conta |
| `index.html` | Painel |
| `metas.html` | Minhas metas |
| `relatorios.html` | Relatórios e regra 50/30/20 |
| `galeria.html` | Galeria de imagens |
| `sobre.html` | Sobre, contato e conta |

Código: `cc.css` (estilos), `cc.js` (código comum) e um script por página (`login.js`, `painel.js`, `metas.js`, `relatorios.js`, `galeria.js`, `sobre.js`). Logotipo: `assets/logo.png`.

## Como executar

1. Acesse o link do site publicado acima, **ou**
2. Baixe o projeto e abra a pasta no VS Code com a extensão **Live Server** (botão *Go Live*), **ou**
3. No terminal, dentro da pasta: `python -m http.server` e abra `http://localhost:8000/login.html`.

> O login usa a API de criptografia do navegador, que exige **HTTPS ou localhost**. Gráficos e ícones vêm de CDN e precisam de internet.

## Observações

- Projeto 100% front-end: os dados ficam no `localStorage` do navegador de quem usa, sem servidor ou banco de dados.
- Existe uma conta por navegador.
- O formulário de contato é uma demonstração (a mensagem fica salva só no navegador).

## Equipe

[Nome(s) · Curso · Disciplina · Professor]
