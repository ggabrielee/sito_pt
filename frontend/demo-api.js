/* =========================================================
   Studio Equilibrio — modalità demo
   Su GitHub Pages non c'è il backend .NET: qui le chiamate a API_BASE_URL
   vengono intercettate e servite da un'API finta che salva in localStorage.
   Replica gli stessi endpoint, codici di stato e validazioni di StudioApi,
   così script.js e admin.js funzionano senza modifiche.
   Si attiva su *.github.io oppure aggiungendo ?demo all'indirizzo.
   ========================================================= */
(() => {
  'use strict';

  const DEMO = location.hostname.endsWith('github.io') || new URLSearchParams(location.search).has('demo');
  if (!DEMO) return;

  const API_PREFIX = 'http://localhost:5080/api/prenotazioni';
  const STORAGE = 'studio-demo-prenotazioni';
  const ADMIN_KEY = 'demo';
  const STATI = ['DaRichiamare', 'Richiamato'];
  const ORA_MS = 60 * 60 * 1000;

  /* ---------- Archivio ---------- */
  function seed() {
    const ago = (ore) => new Date(Date.now() - ore * ORA_MS).toISOString();
    return [
      { id: 1, nome: 'Chiara Galli', telefono: '+393401234567', stato: 'DaRichiamare', creataIl: ago(2) },
      { id: 2, nome: 'Davide Moretti', telefono: '3479876543', stato: 'DaRichiamare', creataIl: ago(30) },
      { id: 3, nome: 'Elena Ricci', telefono: '+393331112223', stato: 'Richiamato', creataIl: ago(52) },
    ];
  }

  let memoria = null; // usata se localStorage non è disponibile
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) return JSON.parse(raw);
    } catch { /* storage bloccato o dati corrotti: si riparte dai dati di esempio */ }
    return memoria ?? (memoria = seed());
  }
  function save(list) {
    memoria = list;
    try { localStorage.setItem(STORAGE, JSON.stringify(list)); } catch { /* resta in memoria */ }
  }

  /* ---------- Risposte HTTP finte ---------- */
  const json = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  const validationProblem = (errors) => json(400, { title: 'One or more validation errors occurred.', status: 400, errors });
  const problem = (status, title) => json(status, { title, status });

  const parseStato = (v) => STATI.find((s) => s.toLowerCase() === String(v ?? '').toLowerCase());

  /* ---------- Endpoint ---------- */
  function creaPrenotazione(req) {
    const errori = {};
    const nome = String(req.nome ?? '').trim();
    const telefono = String(req.telefono ?? '');

    if (!nome) errori.Nome = ['Il nome è obbligatorio.'];
    else if (nome.length < 2 || nome.length > 100) errori.Nome = ['Il nome deve avere tra 2 e 100 caratteri.'];

    if (!telefono.trim()) errori.Telefono = ['Il telefono è obbligatorio.'];
    else if (!/^\s*\+?[\d\s]{7,20}\s*$/.test(telefono)) errori.Telefono = ['Numero di telefono non valido.'];

    if (Object.keys(errori).length > 0) return validationProblem(errori);

    const list = load();
    const prenotazione = {
      id: list.reduce((max, r) => Math.max(max, r.id), 0) + 1,
      nome,
      telefono: telefono.replace(/\s/g, ''),
      stato: 'DaRichiamare',
      creataIl: new Date().toISOString(),
    };
    save([...list, prenotazione]);
    return json(201, prenotazione);
  }

  function elencoPrenotazioni(params) {
    let list = load();
    const stato = params.get('stato');
    if (stato) {
      const filtro = parseStato(stato);
      if (!filtro) return validationProblem({ Stato: [`Stato '${stato}' non valido. Valori ammessi: ${STATI.join(', ')}.`] });
      list = list.filter((r) => r.stato === filtro);
    }
    list.sort((a, b) => b.creataIl.localeCompare(a.creataIl));
    return json(200, list);
  }

  function cambiaStato(id, req) {
    const nuovoStato = parseStato(req.stato);
    if (!nuovoStato) return validationProblem({ Stato: [`Stato '${req.stato}' non valido. Valori ammessi: ${STATI.join(', ')}.`] });

    const list = load();
    const prenotazione = list.find((r) => r.id === id);
    if (!prenotazione) return problem(404, 'Not Found');

    prenotazione.stato = nuovoStato;
    save(list);
    return json(200, prenotazione);
  }

  /* ---------- Intercettazione di fetch ---------- */
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith(API_PREFIX)) return realFetch(input, init);

    // Piccola attesa per simulare la rete e mostrare gli stati "Invio in corso…"
    await new Promise((resolve) => setTimeout(resolve, 350));

    const { pathname, searchParams } = new URL(url);
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : {};
    const headers = new Headers(init.headers);
    const rest = pathname.replace('/api/prenotazioni', '').replace(/\/$/, '');

    if (method === 'POST' && rest === '') return creaPrenotazione(body);

    // Endpoint di gestione: stessa protezione con chiave del server vero
    if (headers.get('X-Admin-Key') !== ADMIN_KEY) return problem(401, 'Chiave di accesso mancante o non valida.');

    if (method === 'GET' && rest === '') return elencoPrenotazioni(searchParams);

    const match = rest.match(/^\/(\d+)\/stato$/);
    if (method === 'PATCH' && match) return cambiaStato(Number(match[1]), body);

    return problem(404, 'Not Found');
  };

  /* ---------- Avviso visibile ---------- */
  const isAdmin = Boolean(document.getElementById('login-form'));
  const keepDemo = location.hostname.endsWith('github.io') ? '' : '?demo';

  const banner = document.createElement('aside');
  banner.setAttribute('aria-label', 'Modalità demo');
  banner.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)', 'z-index:9999',
    'width:max-content', 'max-width:calc(100% - 32px)', 'padding:10px 16px', 'border-radius:999px',
    'background:#1f2a24', 'color:#f6f3ee', 'box-shadow:0 8px 24px rgba(0,0,0,.25)',
    'font:500 13px/1.4 Inter,system-ui,sans-serif', 'text-align:center',
  ].join(';');

  const link = document.createElement('a');
  link.style.cssText = 'color:#f0a77f;font-weight:600;margin-left:6px';
  if (isAdmin) {
    banner.textContent = 'Demo: le richieste sono salvate solo nel tuo browser. Chiave di accesso: demo.';
    link.href = `index.html${keepDemo}#prenota`;
    link.textContent = 'Prova a prenotare';
  } else {
    banner.textContent = 'Demo: prenota una prova, poi guardala nell\'area gestione.';
    link.href = `admin.html${keepDemo}`;
    link.textContent = 'Apri area gestione →';
  }
  banner.append(link);
  document.body.append(banner);
  document.body.style.paddingBottom = '88px'; // il banner fisso non copre la fine della pagina

  // Nella pagina admin la chiave demo è già compilata: basta premere "Accedi"
  if (isAdmin) {
    const keyInput = document.getElementById('admin-key');
    keyInput.type = 'text';
    keyInput.value = ADMIN_KEY;
  }
})();
