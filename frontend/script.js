/* =========================================================
   Studio Equilibrio — interazioni
   JavaScript vanilla, nessuna dipendenza.
   ========================================================= */
(() => {
  'use strict';

  /** Endpoint della Web API ASP.NET Core (vedi backend/StudioApi). */
  const API_BASE_URL = 'http://localhost:5080';

  // Segnala al CSS che JS è attivo: solo allora gli elementi .reveal
  // partono nascosti (progressive enhancement).
  document.documentElement.classList.add('js');

  /* ---------- 1. Animazioni on-scroll (Intersection Observer) ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || reduceMotion) {
    // Fallback: mostra tutto subito
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target); // anima una sola volta, poi smetti di osservare
        });
      },
      {
        threshold: 0.15,                 // almeno il 15% dell'elemento visibile
        rootMargin: '0px 0px -60px 0px', // si attiva poco prima del bordo inferiore
      }
    );
    revealEls.forEach((el) => observer.observe(el));
  }

  /* ---------- 2. Header: sfondo al primo scroll ---------- */
  const header = document.getElementById('header');
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;height:24px;width:1px;';
  document.body.prepend(sentinel);

  new IntersectionObserver(([entry]) => {
    header.classList.toggle('is-scrolled', !entry.isIntersecting);
  }).observe(sentinel);

  /* ---------- 3. Menu mobile ---------- */
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');

  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    nav.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggle.addEventListener('click', () => {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
  });

  /* ---------- 4. Form di prenotazione → API → database ---------- */
  const form = document.getElementById('ctaForm');
  const feedback = document.getElementById('ctaFeedback');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.elements.name;
    const phone = form.elements.phone;
    const nameOk = name.value.trim().length >= 2;
    const phoneOk = /^\+?[\d\s]{7,20}$/.test(phone.value.trim());

    name.classList.toggle('is-invalid', !nameOk);
    phone.classList.toggle('is-invalid', !phoneOk);

    if (!nameOk || !phoneOk) {
      feedback.textContent = 'Inserisci nome e un numero di telefono valido.';
      return;
    }

    // Aperta con doppio clic (file://) la pagina non può contattare il server
    if (window.location.origin === 'null') {
      feedback.textContent = `Avvia l'API ("dotnet run") e apri il sito da ${API_BASE_URL}`;
      return;
    }

    submitBtn.disabled = true;
    feedback.textContent = 'Invio in corso…';

    try {
      const response = await fetch(`${API_BASE_URL}/api/prenotazioni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ nome: name.value.trim(), telefono: phone.value.trim() }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      feedback.textContent = `Grazie ${name.value.trim()}! Ti richiameremo entro 24 ore.`;
      form.reset();
    } catch (error) {
      console.error('Errore durante la prenotazione:', error);
      feedback.textContent = 'Invio non riuscito. Riprova tra poco o chiamaci direttamente.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ---------- 5. Anno nel footer ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();
})();
