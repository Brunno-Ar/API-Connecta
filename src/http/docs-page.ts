import type { FastifyInstance, FastifyReply } from 'fastify';

const docsPageHtml = String.raw`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#07111f" />
    <meta name="description" content="Documentação da integração entre Connecta CX, Grupo Azul e o site consumidor." />
    <title>Connecta CX API · Documentação</title>
    <style>
      :root {
        color-scheme: dark;
        --ink: #eaf2ff; --muted: #94a8c3; --faint: #60748f;
        --navy: #07111f; --panel: #0e1e32; --panel-2: #12263e; --line: #203752;
        --blue: #58a6ff; --cyan: #55d6be; --lime: #b7f36b; --amber: #f4c76b;
        --radius: 18px; --shadow: 0 24px 80px rgba(0, 0, 0, .24);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0; color: var(--ink); line-height: 1.65;
        background: radial-gradient(circle at 82% 3%, rgba(85,214,190,.08), transparent 25rem), var(--navy);
      }
      button, a { -webkit-tap-highlight-color: transparent; }
      a { color: inherit; }
      code, pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .shell { min-height: 100vh; }
      .sidebar {
        position: fixed; inset: 0 auto 0 0; z-index: 20; width: 286px; padding: 28px 22px;
        border-right: 1px solid var(--line); background: rgba(7,17,31,.94); backdrop-filter: blur(18px); overflow-y: auto;
      }
      .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 30px; text-decoration: none; }
      .brand-mark {
        display: grid; width: 42px; height: 42px; place-items: center; border: 1px solid rgba(85,214,190,.45);
        border-radius: 13px; background: #102a3d; color: var(--cyan); font-weight: 800; letter-spacing: -.05em;
      }
      .brand-copy strong, .brand-copy span { display: block; }
      .brand-copy strong { font-size: .96rem; }
      .brand-copy span { color: var(--muted); font-size: .77rem; }
      .nav-label { margin: 22px 10px 8px; color: var(--faint); font-size: .69rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      .nav { display: grid; gap: 3px; }
      .nav a { padding: 9px 11px; border-radius: 9px; color: var(--muted); font-size: .87rem; text-decoration: none; transition: 150ms ease; }
      .nav a:hover, .nav a.active { background: rgba(88,166,255,.1); color: var(--ink); }
      .nav a.active { box-shadow: inset 2px 0 var(--blue); }
      .sidebar-foot { margin-top: 28px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; color: var(--muted); font-size: .78rem; }
      .mobile-bar { display: none; }
      .main { margin-left: 286px; }
      .content { width: min(100% - 64px, 1040px); margin: 0 auto; padding: 64px 0 100px; }
      .hero {
        position: relative; padding: 52px; border: 1px solid var(--line); border-radius: 28px;
        background: linear-gradient(145deg, rgba(18,38,62,.94), rgba(9,23,39,.95)); box-shadow: var(--shadow); overflow: hidden;
      }
      .hero::after { content: ""; position: absolute; right: -80px; bottom: -110px; width: 300px; height: 300px; border: 46px solid rgba(85,214,190,.06); border-radius: 50%; }
      .eyebrow { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; color: var(--cyan); font-size: .76rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
      .eyebrow::before { content: ""; width: 20px; height: 1px; background: currentColor; }
      h1, h2, h3 { margin: 0; line-height: 1.15; letter-spacing: -.035em; }
      h1 { max-width: 720px; font-size: clamp(2.35rem, 5vw, 4.8rem); }
      h1 span { color: var(--cyan); }
      .hero-copy { max-width: 700px; margin: 22px 0 30px; color: var(--muted); font-size: 1.08rem; }
      .badges { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 10px; }
      .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 999px; background: rgba(7,17,31,.55); color: var(--muted); font-size: .78rem; font-weight: 700; }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 0 4px rgba(244,199,107,.1); }
      .dot.ok { background: var(--lime); box-shadow: 0 0 0 4px rgba(183,243,107,.1); }
      section { padding-top: 76px; scroll-margin-top: 20px; }
      .section-head { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
      .section-kicker { margin-bottom: 7px; color: var(--blue); font-size: .74rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      h2 { font-size: clamp(1.75rem, 3vw, 2.5rem); }
      h3 { font-size: 1.08rem; }
      .lede { max-width: 760px; margin: 12px 0 0; color: var(--muted); }
      .flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: stretch; gap: 12px; }
      .flow-card, .card { border: 1px solid var(--line); border-radius: var(--radius); background: rgba(14,30,50,.72); }
      .flow-card { padding: 22px; }
      .flow-num { color: var(--cyan); font-size: .72rem; font-weight: 800; letter-spacing: .1em; }
      .flow-card h3 { margin-top: 12px; }
      .flow-card p { margin: 8px 0 0; color: var(--muted); font-size: .88rem; }
      .arrow { align-self: center; color: var(--faint); font-size: 1.3rem; }
      .endpoint { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border: 1px solid rgba(85,214,190,.3); border-radius: 14px; background: rgba(85,214,190,.06); overflow: hidden; }
      .method { flex: 0 0 auto; padding: 5px 8px; border-radius: 7px; background: var(--cyan); color: #042018; font-size: .72rem; font-weight: 900; }
      .path { overflow: auto; color: var(--ink); font-size: .88rem; white-space: nowrap; }
      .copy { flex: 0 0 auto; margin-left: auto; padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-2); color: var(--muted); cursor: pointer; font: inherit; font-size: .74rem; font-weight: 700; }
      .copy:hover, .copy:focus-visible { border-color: var(--blue); color: var(--ink); outline: none; }
      .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; }
      .card { padding: 24px; }
      .card p { margin: 9px 0 0; color: var(--muted); font-size: .9rem; }
      .card.accent { border-color: rgba(183,243,107,.25); background: rgba(183,243,107,.035); }
      .card.warn { border-color: rgba(244,199,107,.3); background: rgba(244,199,107,.04); }
      .mini-label { display: inline-block; margin-bottom: 10px; color: var(--faint); font-size: .68rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .code-block { position: relative; margin-top: 18px; border: 1px solid var(--line); border-radius: 15px; background: #06101c; overflow: hidden; }
      .code-top { display: flex; align-items: center; justify-content: space-between; padding: 10px 13px; border-bottom: 1px solid var(--line); color: var(--faint); font-size: .72rem; }
      .code-top .copy { margin-left: 0; padding: 5px 8px; background: transparent; }
      pre { margin: 0; padding: 20px; overflow: auto; color: #d8e7fb; font-size: .83rem; line-height: 1.72; tab-size: 2; }
      .key { color: #8ec8ff; } .str { color: #b7f36b; } .num { color: #f4c76b; } .bool { color: #e5a4ff; }
      .table-wrap { margin-top: 18px; border: 1px solid var(--line); border-radius: 15px; overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; min-width: 620px; }
      th, td { padding: 14px 16px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: .84rem; }
      th { background: rgba(18,38,62,.65); color: var(--muted); font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; }
      tr:last-child td { border-bottom: 0; } td code { color: var(--cyan); }
      .required { color: var(--amber); font-size: .72rem; font-weight: 800; }
      .optional { color: var(--faint); font-size: .72rem; font-weight: 800; }
      .endpoint-list { display: grid; gap: 10px; margin-top: 18px; }
      .endpoint-row { display: grid; grid-template-columns: 54px minmax(280px,1fr) 1fr; align-items: center; gap: 16px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: rgba(14,30,50,.55); }
      .endpoint-row code { color: var(--ink); font-size: .8rem; }
      .endpoint-row span:last-child { color: var(--muted); font-size: .82rem; }
      .verb { width: fit-content; padding: 4px 7px; border-radius: 6px; background: rgba(88,166,255,.16); color: var(--blue); font-size: .68rem; font-weight: 900; }
      .callout { display: flex; gap: 15px; margin-top: 20px; padding: 18px; border: 1px solid rgba(244,199,107,.28); border-radius: 14px; background: rgba(244,199,107,.05); }
      .callout-mark { color: var(--amber); font-weight: 900; }
      .callout strong { display: block; margin-bottom: 3px; }
      .callout p { margin: 0; color: var(--muted); font-size: .87rem; }
      .check-list { display: grid; gap: 11px; margin: 18px 0 0; padding: 0; list-style: none; }
      .check-list li { position: relative; padding-left: 27px; color: var(--muted); font-size: .9rem; }
      .check-list li::before { content: "✓"; position: absolute; left: 0; color: var(--lime); font-weight: 900; }
      .footer { margin-top: 84px; padding-top: 26px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 20px; color: var(--faint); font-size: .78rem; }
      .footer a { color: var(--muted); text-decoration: none; } .footer a:hover { color: var(--ink); }
      @media (max-width: 980px) {
        .sidebar { transform: translateX(-100%); transition: transform 180ms ease; }
        .sidebar.open { transform: translateX(0); box-shadow: var(--shadow); }
        .main { margin-left: 0; }
        .mobile-bar { position: sticky; top: 0; z-index: 15; display: flex; align-items: center; justify-content: space-between; height: 60px; padding: 0 20px; border-bottom: 1px solid var(--line); background: rgba(7,17,31,.9); backdrop-filter: blur(16px); }
        .mobile-bar strong { font-size: .86rem; }
        .menu-button { padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--ink); cursor: pointer; }
        .content { width: min(100% - 36px, 900px); padding-top: 34px; }
      }
      @media (max-width: 720px) {
        .hero { padding: 32px 24px; border-radius: 22px; }
        .flow { grid-template-columns: 1fr; } .arrow { transform: rotate(90deg); justify-self: center; }
        .grid-2 { grid-template-columns: 1fr; }
        .endpoint-row { grid-template-columns: 48px 1fr; } .endpoint-row span:last-child { grid-column: 2; }
        .section-head, .footer { align-items: flex-start; flex-direction: column; } section { padding-top: 58px; }
      }
      @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition: none !important; } }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="sidebar" id="sidebar" aria-label="Navegação da documentação">
        <a class="brand" href="#inicio"><span class="brand-mark">GA</span><span class="brand-copy"><strong>Connecta CX API</strong><span>Grupo Azul · v1.0</span></span></a>
        <div class="nav-label">Começar</div>
        <nav class="nav"><a href="#inicio" class="active">Visão geral</a><a href="#fluxo">Como funciona</a><a href="#webhook">Webhook do Connecta</a></nav>
        <div class="nav-label">Referência</div>
        <nav class="nav"><a href="#contrato">Campos e regras</a><a href="#respostas">Respostas</a><a href="#consultas">Consultar no site</a><a href="#erros">Erros</a><a href="#limites">Limites da integração</a></nav>
        <div class="sidebar-foot"><strong>Ambiente de produção</strong><br />api-connecta.vercel.app</div>
      </aside>
      <div class="main">
        <div class="mobile-bar"><strong>Connecta CX API</strong><button class="menu-button" id="menuButton" type="button" aria-controls="sidebar" aria-expanded="false">Menu</button></div>
        <main class="content">
          <header class="hero" id="inicio">
            <div class="eyebrow">Documentação oficial</div>
            <h1>Uma URL para receber. <span>Uma API para consultar.</span></h1>
            <p class="hero-copy">O Connecta envia as escolhas feitas ao final da trilha do bot. A API valida, organiza e salva cada interação para o seu site consultar com segurança.</p>
            <div class="badges"><span class="badge"><span class="dot" id="statusDot"></span><span id="statusText">Verificando API...</span></span><span class="badge">JSON</span><span class="badge">HTTPS</span><span class="badge">PostgreSQL · Neon</span></div>
          </header>

          <section id="fluxo">
            <div class="section-head"><div><div class="section-kicker">Fluxo completo</div><h2>Como os dados chegam ao site</h2></div></div>
            <div class="flow">
              <article class="flow-card"><span class="flow-num">01 · ORIGEM</span><h3>Connecta CX</h3><p>Ao concluir a trilha, envia o contato e todas as opções selecionadas.</p></article><span class="arrow" aria-hidden="true">→</span>
              <article class="flow-card"><span class="flow-num">02 · REGISTRO</span><h3>Esta API</h3><p>Recebe o JSON, valida os campos e salva o payload original no Neon.</p></article><span class="arrow" aria-hidden="true">→</span>
              <article class="flow-card"><span class="flow-num">03 · CONSUMO</span><h3>Seu site</h3><p>O backend consulta interações e métricas usando a chave administrativa.</p></article>
            </div>
          </section>

          <section id="webhook">
            <div class="section-head"><div><div class="section-kicker">Integração de entrada</div><h2>URL para enviar ao Connecta</h2><p class="lede">Todos os contatos e bots usam o mesmo endereço. O bot é identificado pelo campo <code>botId</code>.</p></div></div>
            <div class="endpoint"><span class="method">POST</span><code class="path" id="webhookUrl">https://api-connecta.vercel.app/api/v1/integrations/connecta-cx/interactions</code><button class="copy" type="button" data-copy="webhookUrl">Copiar URL</button></div>
            <div class="grid-2" style="margin-top:18px">
              <article class="card accent"><span class="mini-label">Configuração atual</span><h3>Sem header de autenticação</h3><p>O Connecta precisa apenas chamar a URL por <strong>POST</strong> e enviar <strong>Content-Type: application/json</strong>.</p></article>
              <article class="card warn"><span class="mini-label">Importante</span><h3>Uma chamada por trilha concluída</h3><p>A chamada deve ocorrer quando o cliente chegar ao final da trilha. Reenvios com o mesmo <code>eventId</code> são recusados como duplicados.</p></article>
            </div>
            <div class="code-block"><div class="code-top"><span>JSON plano · recomendado para o Connecta</span><button class="copy" type="button" data-copy="flatJson">Copiar</button></div><pre id="flatJson"><code>{
  <span class="key">"eventId"</span>: <span class="str">"evt_123456"</span>,
  <span class="key">"contactId"</span>: <span class="str">"contato_789"</span>,
  <span class="key">"botId"</span>: <span class="str">"trilha_atendimento"</span>,
  <span class="key">"tour_visitacao"</span>: <span class="str">"sim"</span>,
  <span class="key">"tipo_evento"</span>: <span class="str">"casamento"</span>,
  <span class="key">"numero_convidados"</span>: <span class="num">100</span>,
  <span class="key">"precisa_hospedagem"</span>: <span class="bool">true</span>
}</code></pre></div>
            <div class="code-block"><div class="code-top"><span>JSON aninhado · também aceito</span><button class="copy" type="button" data-copy="nestedJson">Copiar</button></div><pre id="nestedJson"><code>{
  <span class="key">"eventId"</span>: <span class="str">"evt_123456"</span>,
  <span class="key">"contactId"</span>: <span class="str">"contato_789"</span>,
  <span class="key">"botId"</span>: <span class="str">"trilha_atendimento"</span>,
  <span class="key">"selections"</span>: {
    <span class="key">"tour_visitacao"</span>: <span class="str">"sim"</span>,
    <span class="key">"tipo_evento"</span>: <span class="str">"casamento"</span>
  }
}</code></pre></div>
          </section>

          <section id="contrato">
            <div class="section-head"><div><div class="section-kicker">Contrato do body</div><h2>Campos e regras</h2><p class="lede">Os nomes técnicos das seleções são abertos. Assim, novas opções do bot podem ser adicionadas sem alterar a API.</p></div></div>
            <div class="table-wrap"><table><thead><tr><th>Campo</th><th>Obrigatoriedade</th><th>Tipo</th><th>Descrição</th></tr></thead><tbody>
              <tr><td><code>contactId</code></td><td><span class="required">OBRIGATÓRIO</span></td><td>string</td><td>Identificador estável do contato no Connecta.</td></tr>
              <tr><td><code>botId</code></td><td><span class="required">OBRIGATÓRIO</span></td><td>string</td><td>Identificador da trilha ou bot que originou a interação.</td></tr>
              <tr><td><code>eventId</code></td><td><span class="optional">RECOMENDADO</span></td><td>string</td><td>ID único da execução. Impede que um reenvio seja contado duas vezes.</td></tr>
              <tr><td><code>qualquer_chave</code></td><td><span class="required">1 OU MAIS</span></td><td>string, número, boolean ou null</td><td>Uma opção selecionada pelo cliente. Use nomes estáveis em <code>snake_case</code>.</td></tr>
            </tbody></table></div>
            <ul class="check-list"><li>De 1 a 50 seleções por interação.</li><li>Chaves com até 100 caracteres no padrão <code>snake_case</code>.</li><li>Textos com até 500 caracteres; objetos e arrays internos não são aceitos.</li><li>O JSON completo recebido é preservado, além das seleções normalizadas.</li></ul>
          </section>

          <section id="respostas">
            <div class="section-head"><div><div class="section-kicker">Retorno do webhook</div><h2>Como confirmar o recebimento</h2></div></div>
            <div class="grid-2">
              <article class="card"><span class="mini-label">201 · Criado</span><h3>Interação salva</h3><div class="code-block"><pre><code>{
  <span class="key">"success"</span>: <span class="bool">true</span>,
  <span class="key">"data"</span>: { <span class="key">"interactionId"</span>: <span class="str">"8c597b72-..."</span> }
}</code></pre></div></article>
              <article class="card"><span class="mini-label">409 · Duplicado</span><h3>Evento já recebido</h3><div class="code-block"><pre><code>{
  <span class="key">"success"</span>: <span class="bool">false</span>,
  <span class="key">"error"</span>: { <span class="key">"code"</span>: <span class="str">"DUPLICATE_INTERACTION"</span> }
}</code></pre></div></article>
            </div>
          </section>

          <section id="consultas">
            <div class="section-head"><div><div class="section-kicker">Integração de saída</div><h2>Consultar os dados no seu site</h2><p class="lede">Estas chamadas devem sair do backend do site. Envie a chave administrativa no header <code>X-API-Key</code> e nunca exponha essa chave no navegador.</p></div></div>
            <div class="endpoint-list">
              <div class="endpoint-row"><span class="verb">GET</span><code>/api/v1/interactions</code><span>Lista paginada de interações recebidas.</span></div>
              <div class="endpoint-row"><span class="verb">GET</span><code>/api/v1/interactions/{id}</code><span>Detalhes, JSON original e seleções.</span></div>
              <div class="endpoint-row"><span class="verb">GET</span><code>/api/v1/metrics</code><span>Resumo e agrupamentos em uma resposta.</span></div>
              <div class="endpoint-row"><span class="verb">GET</span><code>/api/v1/metrics/summary</code><span>Totais gerais e contatos únicos.</span></div>
              <div class="endpoint-row"><span class="verb">GET</span><code>/api/v1/metrics/selections</code><span>Contagem por opção e valor.</span></div>
              <div class="endpoint-row"><span class="verb">GET</span><code>/api/v1/metrics/bots</code><span>Resultados agrupados por bot.</span></div>
            </div>
            <div class="code-block"><div class="code-top"><span>Exemplo no backend do site</span><button class="copy" type="button" data-copy="fetchExample">Copiar</button></div><pre id="fetchExample"><code><span class="key">const</span> response = <span class="key">await</span> fetch(
  <span class="str">"https://api-connecta.vercel.app/api/v1/metrics/summary"</span>,
  { headers: { <span class="str">"X-API-Key"</span>: process.env.ADMIN_API_KEY } }
);

<span class="key">const</span> result = <span class="key">await</span> response.json();</code></pre></div>
            <div class="callout"><span class="callout-mark">!</span><div><strong>Filtros disponíveis</strong><p><code>botId</code>, <code>contactId</code>, <code>selectionKey</code>, <code>selectionValue</code>, <code>from</code> e <code>to</code>. A listagem também aceita <code>page</code> e <code>limit</code>.</p></div></div>
          </section>

          <section id="erros">
            <div class="section-head"><div><div class="section-kicker">Diagnóstico</div><h2>Códigos de resposta</h2></div></div>
            <div class="table-wrap"><table><thead><tr><th>HTTP</th><th>Código / situação</th><th>O que fazer</th></tr></thead><tbody>
              <tr><td><code>201</code></td><td>Interação criada</td><td>Recebimento concluído.</td></tr><tr><td><code>400</code></td><td>JSON malformado</td><td>Corrigir a estrutura do body.</td></tr>
              <tr><td><code>401</code></td><td><code>UNAUTHORIZED</code></td><td>Informar a chave administrativa nas rotas privadas.</td></tr><tr><td><code>409</code></td><td><code>DUPLICATE_INTERACTION</code></td><td>O mesmo <code>eventId</code> já foi processado.</td></tr>
              <tr><td><code>422</code></td><td><code>INVALID_PAYLOAD</code></td><td>Conferir campos obrigatórios, chaves e tipos.</td></tr><tr><td><code>429</code></td><td>Limite de requisições</td><td>Aguardar antes de tentar novamente.</td></tr><tr><td><code>503</code></td><td>Banco indisponível</td><td>Tentar novamente e verificar o health.</td></tr>
            </tbody></table></div>
          </section>

          <section id="limites">
            <div class="section-head"><div><div class="section-kicker">Escopo confirmado</div><h2>O que o Connecta consegue enviar</h2></div></div>
            <div class="grid-2"><article class="card accent"><span class="mini-label">Incluído</span><h3>Seleções da trilha do bot</h3><p>Quando o cliente chega ao final, o Connecta chama a API e informa os pares de chave e valor selecionados durante o caminho.</p></article><article class="card warn"><span class="mini-label">Não incluído</span><h3>Tabulação final e filtros internos</h3><p>Segundo o suporte, esta integração não dispara com base na tabulação final do atendimento. Ela contempla somente as escolhas feitas na trilha concluída.</p></article></div>
            <div class="callout"><span class="callout-mark">→</span><div><strong>Resumo para enviar ao suporte</strong><p>“Configurar um POST para a URL do webhook ao final da trilha, com body JSON aberto contendo <code>contactId</code>, <code>botId</code>, um <code>eventId</code> único quando disponível e todas as opções selecionadas em pares de chave e valor.”</p></div></div>
          </section>
          <footer class="footer"><span>Connecta CX Metrics API · Grupo Azul</span><span><a href="/docs" target="_blank" rel="noreferrer">Abrir Swagger técnico ↗</a></span></footer>
        </main>
      </div>
    </div>
    <script>
      const sidebar = document.getElementById('sidebar');
      const menuButton = document.getElementById('menuButton');
      menuButton.addEventListener('click', function () {
        const open = sidebar.classList.toggle('open');
        menuButton.setAttribute('aria-expanded', String(open));
      });
      document.querySelectorAll('.nav a').forEach(function (link) {
        link.addEventListener('click', function () { sidebar.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); });
      });
      document.querySelectorAll('[data-copy]').forEach(function (button) {
        button.addEventListener('click', async function () {
          const target = document.getElementById(button.dataset.copy); if (!target) return;
          await navigator.clipboard.writeText(target.innerText); const original = button.textContent;
          button.textContent = 'Copiado'; setTimeout(function () { button.textContent = original; }, 1400);
        });
      });
      fetch('/api/v1/health').then(function (response) {
        if (!response.ok) throw new Error('unavailable'); document.getElementById('statusDot').classList.add('ok');
        document.getElementById('statusText').textContent = 'API operacional';
      }).catch(function () { document.getElementById('statusText').textContent = 'API indisponível'; });
      const links = Array.from(document.querySelectorAll('.nav a'));
      const sections = links.map(function (link) { return document.querySelector(link.getAttribute('href')); }).filter(Boolean);
      const observer = new IntersectionObserver(function (entries) { entries.forEach(function (entry) {
        if (!entry.isIntersecting) return; links.forEach(function (link) { link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id); });
      }); }, { rootMargin: '-20% 0px -65% 0px' });
      sections.forEach(function (section) { observer.observe(section); });
    </script>
  </body>
</html>`;

export function registerDocumentationPage(app: FastifyInstance) {
  const handler = async (_request: unknown, reply: FastifyReply) => {
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300')
      .send(docsPageHtml);
  };

  app.get('/doc', { schema: { hide: true } }, handler);
  app.get('/doc/', { schema: { hide: true } }, handler);
}
