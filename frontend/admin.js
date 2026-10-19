/* =========================================================
   Studio Equilibrio — area di gestione prenotazioni
   Elenco delle richieste, filtro per stato, "segna come richiamato".
   I dati dei clienti sono scritti con textContent, mai con innerHTML.
   ========================================================= */
'use strict';

const API_BASE_URL = 'http://localhost:5080';
const KEY_STORAGE = 'studio-admin-key';
const GIORNO_MS = 24 * 60 * 60 * 1000;

const STATI = { DaRichiamare: 'Da richiamare', Richiamato: 'Richiamato' };

/** Azione disponibile per ogni stato: [stato di destinazione, etichetta]. */
const AZIONI = {
  DaRichiamare: ['Richiamato', 'Segna come richiamato'],
  Richiamato: ['DaRichiamare', 'Rimetti da richiamare'],
};

/* ---------- Chiave admin (sessionStorage: sparisce alla chiusura della scheda) ---------- */
function loadKey() { try { return sessionStorage.getItem(KEY_STORAGE); } catch { return null; } }
function saveKey(key) { try { sessionStorage.setItem(KEY_STORAGE, key); } catch { /* resta in memoria */ } }
function clearKey() { try { sessionStorage.removeItem(KEY_STORAGE); } catch { /* ignorato */ } }

/* ---------- Riferimenti DOM ---------- */
const els = {
  login: document.getElementById('login'),
  loginForm: document.getElementById('login-form'),
  keyInput: document.getElementById('admin-key'),
  keyError: document.getElementById('admin-key-error'),
  dashboard: document.getElementById('dashboard'),
  logout: document.getElementById('logout'),
  refresh: document.getElementById('refresh'),
  chips: [...document.querySelectorAll('.chip')],
  status: document.getElementById('list-status'),
  list: document.getElementById('requests'),
  template: document.getElementById('row-template'),
  sumPending: document.getElementById('sum-pending'),
  sumLate: document.getElementById('sum-late'),
  sumTotal: document.getElementById('sum-total'),
};

let adminKey = loadKey();
let filtro = 'DaRichiamare'; // vista iniziale: chi è ancora da chiamare
let richieste = [];          // elenco filtrato mostrato a schermo
let tutte = [];              // elenco completo, per il riepilogo

/* ---------- Chiamate API ---------- */
class UnauthorizedError extends Error {}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'X-Admin-Key': adminKey ?? '',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.title ?? `HTTP ${response.status}`);
  }
  return response.json();
}

/* ---------- Formattazione ---------- */
const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

/** Il server invia date UTC senza "Z": va aggiunta, altrimenti JS le legge come ora locale. */
const parseUtc = (iso) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);

function formatReceived(date) {
  const oggi = new Date();
  const ieri = new Date(oggi.getTime() - GIORNO_MS);
  const giorno = date.toDateString() === oggi.toDateString() ? 'oggi'
    : date.toDateString() === ieri.toDateString() ? 'ieri'
      : dateFmt.format(date);
  return `Ricevuta ${giorno} alle ${timeFmt.format(date)}`;
}

const isLate = (r) => r.stato === 'DaRichiamare' && Date.now() - parseUtc(r.creataIl) > GIORNO_MS;

/* ---------- Rendering ---------- */
function renderRow(r) {
  const row = els.template.content.firstElementChild.cloneNode(true);
  row.dataset.id = r.id;
  row.classList.toggle('is-late', isLate(r));
  row.classList.toggle('is-done', r.stato === 'Richiamato');

  row.querySelector('.request__name').textContent = r.nome;

  const phone = row.querySelector('.request__phone');
  phone.textContent = r.telefono;
  phone.href = `tel:${r.telefono.replace(/[^\d+]/g, '')}`; // su smartphone: un tocco e parte la chiamata

  const quando = formatReceived(parseUtc(r.creataIl));
  row.querySelector('.request__when').textContent = isLate(r) ? `${quando} · oltre 24 ore` : quando;

  const badge = row.querySelector('.badge');
  badge.textContent = STATI[r.stato] ?? r.stato;
  badge.classList.add(`badge--${r.stato}`);

  const [nuovoStato, etichetta] = AZIONI[r.stato];
  const btn = row.querySelector('.action');
  btn.textContent = etichetta;
  btn.dataset.id = r.id;
  btn.dataset.stato = nuovoStato;
  btn.setAttribute('aria-label', `${etichetta}: ${r.nome}`);

  return row;
}

function render() {
  if (richieste.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = filtro === 'DaRichiamare'
      ? 'Nessuno da richiamare. Ottimo lavoro!'
      : 'Nessuna richiesta.';
    els.list.replaceChildren(empty);
  } else {
    els.list.replaceChildren(...richieste.map(renderRow));
  }

  els.sumPending.textContent = tutte.filter((r) => r.stato === 'DaRichiamare').length;
  els.sumLate.textContent = tutte.filter(isLate).length;
  els.sumTotal.textContent = tutte.length;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle('is-error', isError);
}

function syncChips() {
  els.chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.stato === filtro)));
}

/* ---------- Caricamento ---------- */
async function loadList() {
  setStatus('Caricamento…');
  try {
    // Un'unica richiesta: il filtro per stato si applica qui, così il riepilogo resta completo
    tutte = await api('/api/prenotazioni');
    richieste = filtro ? tutte.filter((r) => r.stato === filtro) : tutte;
    render();
    const n = richieste.length;
    setStatus(`${n} ${n === 1 ? 'richiesta' : 'richieste'}`);
  } catch (error) {
    handleError(error, 'Impossibile caricare le richieste.');
  }
}

async function changeStatus(button) {
  button.disabled = true;
  try {
    const aggiornata = await api(`/api/prenotazioni/${button.dataset.id}/stato`, {
      method: 'PATCH',
      body: JSON.stringify({ stato: button.dataset.stato }),
    });
    tutte = tutte.map((r) => (r.id === aggiornata.id ? aggiornata : r));
    richieste = filtro ? tutte.filter((r) => r.stato === filtro) : tutte;
    render();
    setStatus(`${aggiornata.nome}: ${STATI[aggiornata.stato].toLowerCase()}.`);
  } catch (error) {
    button.disabled = false;
    handleError(error, 'Impossibile aggiornare la richiesta.');
  }
}

function handleError(error, fallback) {
  if (error instanceof UnauthorizedError) {
    logout('La chiave non è più valida. Accedi di nuovo.');
    return;
  }
  console.error(error);
  setStatus(error instanceof TypeError
    ? 'Il server non è raggiungibile. Verifica che l\'API sia avviata.'
    : `${fallback} (${error.message})`, true);
}

/* ---------- Accesso / uscita ---------- */
function showDashboard() {
  els.login.hidden = true;
  els.dashboard.hidden = false;
  els.logout.hidden = false;
  syncChips();
  loadList();
}

function logout(message = '') {
  adminKey = null;
  clearKey();
  tutte = richieste = [];
  els.list.replaceChildren();
  els.dashboard.hidden = true;
  els.logout.hidden = true;
  els.login.hidden = false;
  els.keyInput.value = '';
  els.keyError.textContent = message;
  els.keyInput.setAttribute('aria-invalid', String(Boolean(message)));
  els.keyInput.focus();
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const key = els.keyInput.value.trim();
  if (!key) {
    els.keyError.textContent = 'Inserisci la chiave di accesso.';
    els.keyInput.setAttribute('aria-invalid', 'true');
    return;
  }

  adminKey = key;
  try {
    // Verifica la chiave con una richiesta reale prima di aprire la dashboard
    await api('/api/prenotazioni?stato=DaRichiamare');
    saveKey(key);
    els.keyError.textContent = '';
    els.keyInput.removeAttribute('aria-invalid');
    showDashboard();
  } catch (error) {
    adminKey = null;
    els.keyInput.setAttribute('aria-invalid', 'true');
    els.keyError.textContent = error instanceof UnauthorizedError
      ? 'Chiave non valida.'
      : error instanceof TypeError
        ? 'Il server non è raggiungibile. Verifica che l\'API sia avviata.'
        : error.message;
  }
});

els.logout.addEventListener('click', () => logout());
els.refresh.addEventListener('click', loadList);

els.chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    filtro = chip.dataset.stato;
    syncChips();
    richieste = filtro ? tutte.filter((r) => r.stato === filtro) : tutte;
    render();
    const n = richieste.length;
    setStatus(`${n} ${n === 1 ? 'richiesta' : 'richieste'}`);
  });
});

// Event delegation sui bottoni di stato
els.list.addEventListener('click', (event) => {
  const button = event.target.closest('.action');
  if (button && !button.disabled) changeStatus(button);
});

/* ---------- Avvio ---------- */
if (adminKey) showDashboard();
else els.keyInput.focus();
