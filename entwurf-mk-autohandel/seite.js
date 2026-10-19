// MKA – Grundfunktionen ohne Bibliotheken: Menü, Einblendungen, Zähler, Filter, Galerie, Formulare.
// Bewegung (GSAP/Lenis) wird erst nach dem Laden nachgeholt (motion.js).
(() => {
  'use strict';
  const html = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)');

  const setzeBewegung = () => {
    html.classList.toggle('bewegung', !ruhig.matches);
    html.classList.toggle('bewegt', !ruhig.matches);
  };
  setzeBewegung();
  ruhig.addEventListener('change', () => { setzeBewegung(); if (ruhig.matches) $$('[data-zeige]').forEach((x) => x.classList.add('sichtbar')); });

  /* ---------- Kopf: über dem Startbild durchsichtig, danach fest ---------- */
  const kopf = $('[data-kopf]');
  if (kopf?.classList.contains('kopf-ueber')) {
    const fuehler = document.createElement('div');
    fuehler.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:70vh;pointer-events:none';
    document.body.prepend(fuehler);
    new IntersectionObserver(([e]) => kopf.classList.toggle('kopf-fest', !e.isIntersecting)).observe(fuehler);
  }

  /* ---------- Menü (Handy) ---------- */
  const knopf = $('[data-menue-knopf]');
  const menue = $('[data-menue]');
  if (knopf && menue) {
    const draussen = () => [$('main'), $('.fuss'), $('.marke'), $('.kopf-tel')].filter(Boolean);
    const zu = (fokus = true) => {
      menue.classList.remove('offen');
      knopf.setAttribute('aria-expanded', 'false');
      knopf.querySelector('span').textContent = 'Menü';
      draussen().forEach((x) => (x.inert = false));
      document.body.style.overflow = '';
      if (fokus) knopf.focus();
    };
    const auf = () => {
      menue.classList.add('offen');
      knopf.setAttribute('aria-expanded', 'true');
      knopf.querySelector('span').textContent = 'Schließen';
      draussen().forEach((x) => (x.inert = true));
      document.body.style.overflow = 'hidden';
      $('a', menue)?.focus();
    };
    knopf.addEventListener('click', () => (menue.classList.contains('offen') ? zu() : auf()));
    menue.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') zu();
      if (ev.key === 'Tab') {
        const f = [...$$('a,button', menue), knopf];
        const i = f.indexOf(document.activeElement);
        if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); }
      }
    });
    knopf.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && menue.classList.contains('offen')) zu(); });
    $$('a', menue).forEach((a) => a.addEventListener('click', () => zu(false)));
    matchMedia('(min-width: 1100px)').addEventListener('change', (m) => m.matches && menue.classList.contains('offen') && zu(false));
  }

  /* ---------- Einblendungen (einmalig, auch bei Tastatur-Fokus) ---------- */
  const zeige = $$('[data-zeige]');
  if (zeige.length) {
    if (!('IntersectionObserver' in window) || ruhig.matches) zeige.forEach((x) => x.classList.add('sichtbar'));
    else {
      // Masken-Elemente sind selbst weggeschnitten (clip-path) -> den Elternblock beobachten
      const ziel = new Map();
      const io = new IntersectionObserver((eintraege) => eintraege.forEach((e) => {
        if (e.isIntersecting) { (ziel.get(e.target) || []).forEach((x) => x.classList.add('sichtbar')); io.unobserve(e.target); }
      }), { rootMargin: '0px 0px -8% 0px', threshold: 0 });
      zeige.forEach((x) => {
        const beob = x.dataset.zeige === 'maske' ? x.parentElement : x;
        if (!ziel.has(beob)) ziel.set(beob, []);
        ziel.get(beob).push(x);
        io.observe(beob);
      });
      document.addEventListener('focusin', (ev) => ev.target.closest?.('[data-zeige]')?.classList.add('sichtbar'));
    }
  }

  /* ---------- Zähler: einmal von 0 hochzählen ---------- */
  const zaehler = $$('[data-zaehler]');
  if (zaehler.length && !ruhig.matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((eintraege) => eintraege.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const ziel = Number(e.target.dataset.zaehler);
      const t0 = performance.now(), dauer = 1100;
      const schritt = (t) => {
        const p = Math.min(1, (t - t0) / dauer);
        e.target.textContent = Math.round(ziel * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    }), { threshold: 0.6 });
    zaehler.forEach((x) => io.observe(x));
  }

  /* ---------- Fahrzeugliste: Filter ohne Neuladen (gleiche Regeln wie der Server) ---------- */
  const fform = $('[data-filter-form]');
  if (fform) {
    const liste = $('[data-karten]');
    const items = $$(':scope > li', liste).filter((li) => $('[data-karte]', li)); // nur die Karten, nicht die Eckdaten-Listen darin
    const anzahl = $('[data-anzahl]');
    const leer = $('[data-leer]');
    const filterBox = $('[data-filter]');
    const breit = matchMedia('(min-width: 1000px)');
    const oeffnen = () => { if (breit.matches) filterBox.open = true; };
    oeffnen(); breit.addEventListener('change', oeffnen);
    const anwenden = () => {
      const q = new FormData(fform);
      const n = (k) => (q.get(k) === '' || q.get(k) === null ? null : Number(q.get(k)));
      const fi = { marke: q.get('marke'), pv: n('preis_von'), pb: n('preis_bis'), km: n('km_bis'), jahr: n('jahr_ab'), ks: q.get('kraftstoff'), gt: q.get('getriebe'), sort: q.get('sort') };
      const num = (w) => (w === '' ? null : Number(w));
      const daten = items.map((li) => { const k = $('[data-karte]', li).dataset; return { li, marke: k.marke, preis: num(k.preis), km: num(k.km), jahr: num(k.jahr), ks: k.kraftstoff, gt: k.getriebe, verkauft: k.status === 'verkauft', erstellt: k.erstellt, foto: k.foto === '1' ? 0 : 1 }; });
      const passt = (d) => (!fi.marke || d.marke === fi.marke) && (fi.pv == null || (d.preis != null && d.preis >= fi.pv)) && (fi.pb == null || (d.preis != null && d.preis <= fi.pb))
        && (fi.km == null || (d.km != null && d.km <= fi.km)) && (fi.jahr == null || (d.jahr != null && d.jahr >= fi.jahr)) && (!fi.ks || d.ks === fi.ks) && (!fi.gt || d.gt === fi.gt);
      const leerHinten = (a, b) => (a == null) - (b == null);
      const sort = { neu: (a, b) => b.erstellt.localeCompare(a.erstellt), preis_auf: (a, b) => leerHinten(a.preis, b.preis) || a.preis - b.preis,
        preis_ab: (a, b) => leerHinten(a.preis, b.preis) || b.preis - a.preis, km_auf: (a, b) => leerHinten(a.km, b.km) || a.km - b.km }[fi.sort] || ((a, b) => b.erstellt.localeCompare(a.erstellt));
      daten.sort((a, b) => a.verkauft - b.verkauft || a.foto - b.foto || sort(a, b));
      let treffer = 0, aktiv = 0;
      daten.forEach((d) => { const ok = passt(d); d.li.hidden = !ok; if (ok) { treffer++; if (!d.verkauft) aktiv++; } liste.appendChild(d.li); });
      const gefiltert = ['marke', 'preis_von', 'preis_bis', 'km_bis', 'jahr_ab', 'kraftstoff', 'getriebe'].filter((k) => q.get(k)).length;
      anzahl.textContent = `${aktiv} ${aktiv === 1 ? 'Fahrzeug' : 'Fahrzeuge'} im Angebot${gefiltert ? ' (gefiltert)' : ''}`;
      leer.hidden = treffer > 0;
      const sum = $('summary span', filterBox); if (sum) sum.textContent = `Filter${gefiltert ? ` (${gefiltert})` : ''}`;
      const p = new URLSearchParams();
      for (const [k, w] of q) if (w && !(k === 'sort' && w === 'neu')) p.set(k, w);
      history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
    };
    let t;
    fform.addEventListener('input', () => { clearTimeout(t); t = setTimeout(anwenden, 180); });
    fform.addEventListener('submit', (ev) => { ev.preventDefault(); anwenden(); });
    const zuruecksetzen = (ev) => { ev.preventDefault(); fform.reset(); $$('input', fform).forEach((i) => (i.value = '')); $$('select', fform).forEach((s) => (s.selectedIndex = 0)); anwenden(); };
    $('[data-filter-reset]', fform)?.addEventListener('click', zuruecksetzen);
    $('[data-filter-reset2]')?.addEventListener('click', zuruecksetzen);
  }

  /* ---------- Galerie + Vollbild ---------- */
  const galerie = $('[data-galerie]');
  if (galerie && $('[data-galerie-spur]', galerie)) {
    const spur = $('[data-galerie-spur]', galerie);
    const bilder = $$('.galerie-bild', spur);
    const nr = $('[data-galerie-nr]', galerie);
    const daumen = $$('[data-daumen]');
    let aktuell = 0;
    const geheZu = (i, glatt = true) => { aktuell = Math.max(0, Math.min(bilder.length - 1, i)); spur.scrollTo({ left: aktuell * spur.clientWidth, behavior: glatt && !ruhig.matches ? 'smooth' : 'auto' }); };
    spur.addEventListener('scroll', () => {
      const i = Math.round(spur.scrollLeft / spur.clientWidth);
      if (i !== aktuell || nr.textContent !== String(i + 1)) { aktuell = i; nr.textContent = i + 1; daumen.forEach((d, j) => (j === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'))); }
    }, { passive: true });
    $('[data-galerie-zurueck]', galerie)?.addEventListener('click', () => geheZu(aktuell - 1));
    $('[data-galerie-weiter]', galerie)?.addEventListener('click', () => geheZu(aktuell + 1));
    spur.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowRight') { ev.preventDefault(); geheZu(aktuell + 1); } if (ev.key === 'ArrowLeft') { ev.preventDefault(); geheZu(aktuell - 1); } });
    daumen.forEach((d) => d.addEventListener('click', () => geheZu(Number(d.dataset.daumen))));

    const dlg = $('[data-vollbild-dialog]');
    const vspur = $('[data-vollbild-spur]', dlg);
    const vbilder = $$('img', vspur);
    const vnr = $('[data-vollbild-nr]', dlg);
    let vakt = 0;
    const laden = (i) => { const im = vbilder[i]; if (im && !im.src) { im.srcset = im.dataset.srcset; im.src = im.dataset.src; } };
    const vgehe = (i, glatt = true) => { vakt = Math.max(0, Math.min(vbilder.length - 1, i)); [vakt - 1, vakt, vakt + 1].forEach(laden); vspur.scrollTo({ left: vakt * vspur.clientWidth, behavior: glatt && !ruhig.matches ? 'smooth' : 'auto' }); vnr.textContent = vakt + 1; };
    let ausloeser = null;
    $$('[data-vollbild]').forEach((b) => b.addEventListener('click', () => {
      ausloeser = b;
      dlg.showModal();
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => { vgehe(b.dataset.vollbild === '0' && b.classList.contains('galerie-voll') ? aktuell : Number(b.dataset.vollbild), false); vspur.focus(); });
    }));
    vspur.addEventListener('scroll', () => { const i = Math.round(vspur.scrollLeft / vspur.clientWidth); if (i !== vakt) { vakt = i; vnr.textContent = i + 1; [i - 1, i, i + 1].forEach(laden); } }, { passive: true });
    $('[data-vollbild-zurueck]', dlg)?.addEventListener('click', () => vgehe(vakt - 1));
    $('[data-vollbild-weiter]', dlg)?.addEventListener('click', () => vgehe(vakt + 1));
    $('[data-vollbild-zu]', dlg).addEventListener('click', () => dlg.close());
    dlg.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowRight') { ev.preventDefault(); vgehe(vakt + 1); } if (ev.key === 'ArrowLeft') { ev.preventDefault(); vgehe(vakt - 1); } });
    dlg.addEventListener('close', () => { document.body.style.overflow = ''; geheZu(vakt, false); ausloeser?.focus(); });
  }

  /* ---------- Aktionsleiste (Handy): nur zeigen, wenn die Knöpfe im Kasten weg sind
     und weder Probefahrt-Formular noch Fuß im Bild sind (sonst doppelte Knöpfe) ---------- */
  const leiste = $('[data-aktionsleiste]');
  if (leiste && 'IntersectionObserver' in window) {
    const ziele = [$('[data-detail-knoepfe]'), $('#probefahrt-bereich'), $('.fuss')].filter(Boolean);
    const sichtbar = new Set(ziele.slice(0, 1)); // beim Laden sind die Knöpfe im Kasten sichtbar
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? sichtbar.add(e.target) : sichtbar.delete(e.target)));
      leiste.classList.toggle('weg', sichtbar.size > 0);
    });
    ziele.forEach((z) => io.observe(z));
  } else if (leiste) leiste.classList.remove('weg');

  /* ---------- Formulare in Schritten, ohne Versand ---------- */
  const heute = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $$('[data-ab-heute]').forEach((i) => (i.min = heute));
  $$('[data-formular]').forEach((form) => {
    const schritte = $$('.schritt', form);
    const stand = $$('[data-stand]', form);
    const ergebnis = $('[data-ergebnis]', form);
    let akt = 0;
    const zeigeSchritt = (i, fokus = true) => {
      akt = i;
      schritte.forEach((s, j) => s.classList.toggle('aktiv', j === i));
      stand.forEach((s, j) => { s.classList.toggle('erledigt', j < i); j === i ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current'); });
      if (fokus) { const erstes = $('input:not([type=hidden]),select,textarea', schritte[i]); (erstes || schritte[i]).focus({ preventScroll: true }); schritte[i].scrollIntoView({ block: 'nearest', behavior: ruhig.matches ? 'auto' : 'smooth' }); }
    };
    const fehlerWeg = (el) => { el.removeAttribute('aria-invalid'); const f = el.closest('.feld')?.querySelector('.feld-fehler'); f?.remove(); };
    const fehler = (el, text) => {
      el.setAttribute('aria-invalid', 'true');
      const feld = el.closest('.feld, .feld-radio');
      let f = feld?.querySelector('.feld-fehler');
      if (!f && feld) { f = document.createElement('p'); f.className = 'feld-fehler'; f.id = `${el.id || el.name}-fehler`; feld.appendChild(f); if (el.id) el.setAttribute('aria-describedby', `${el.getAttribute('aria-describedby') || ''} ${f.id}`.trim()); }
      if (f) f.textContent = text;
    };
    const pruefe = (schritt) => {
      let erstes = null;
      $$('input,select,textarea', schritt).forEach((el) => {
        if (el.type === 'hidden' || el.closest('.hp')) return;
        fehlerWeg(el);
        let meldung = '';
        if (el.type === 'radio') { if (el.required && !$$(`[name="${el.name}"]`, schritt).some((r) => r.checked)) meldung = 'Bitte eine Möglichkeit wählen.'; }
        else if (el.validity.valueMissing) meldung = 'Bitte ausfüllen.';
        else if (el.validity.typeMismatch) meldung = el.type === 'email' ? 'Bitte eine gültige E-Mail-Adresse eingeben.' : 'Bitte prüfen.';
        else if (el.validity.rangeUnderflow) meldung = el.type === 'date' ? 'Bitte ein Datum ab heute wählen.' : `Mindestens ${el.min}.`;
        else if (el.validity.rangeOverflow) meldung = `Höchstens ${el.max}.`;
        else if (!el.validity.valid) meldung = 'Bitte prüfen.';
        if (!meldung && el.dataset.nichtVor) { const vor = $(`[name="${el.dataset.nichtVor}"]`, form); if (vor?.value && el.value && el.value < vor.value) meldung = 'Die Rückgabe kann nicht vor der Abholung liegen.'; }
        if (meldung) { fehler(el, meldung); erstes ||= el; }
      });
      const einsVon = $$('[data-eins-von]', schritt);
      if (einsVon.length && !einsVon.some((x) => x.value.trim())) { fehler(einsVon[0], 'Bitte Telefon oder E-Mail angeben, damit wir Sie erreichen.'); erstes ||= einsVon[0]; }
      if (erstes) { erstes.focus({ preventScroll: true }); (erstes.closest('.feld, .feld-radio') || erstes).scrollIntoView({ block: 'center', behavior: ruhig.matches ? 'auto' : 'smooth' }); } // Beschriftung nie unter dem festen Kopf
      return !erstes;
    };
    schritte.forEach((s, i) => {
      $('[data-weiter]', s)?.addEventListener('click', () => { if (pruefe(s)) zeigeSchritt(i + 1); });
      $('[data-zurueck]', s)?.addEventListener('click', () => zeigeSchritt(i - 1));
      s.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && i < schritte.length - 1) { ev.preventDefault(); if (pruefe(s)) zeigeSchritt(i + 1); } });
    });
    form.addEventListener('input', (ev) => { if (ev.target.getAttribute('aria-invalid')) fehlerWeg(ev.target); });
    $('[data-absenden]', form).disabled = false;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!pruefe(schritte[akt])) return;
      const daten = new FormData(form);
      if (daten.get('firma_feld')) return; // Honeypot: Bots bekommen nichts
      const zeilen = [];
      for (const [k, w] of daten) {
        if (!w || k === 'firma_feld') continue;
        const el = form.elements[k];
        const lbl = (el?.length && !el.tagName) ? el[0].closest('fieldset')?.querySelector('legend')?.firstChild?.textContent : (el?.labels?.[0]?.firstChild?.textContent);
        zeilen.push([(lbl || k).trim(), String(w)]);
      }
      ergebnis.replaceChildren();
      const t = document.createElement('p'); t.innerHTML = '<strong>Demo: Nichts wurde gesendet.</strong> So würde Ihre Anfrage bei MKA ankommen:';
      const dl = document.createElement('dl');
      zeilen.forEach(([k, w]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = w; dl.append(dt, dd); });
      ergebnis.append(t, dl);
      ergebnis.hidden = false;
      ergebnis.focus();
    });
    zeigeSchritt(0, false);
  });

  /* ---------- Waagrechte Reihen: Showroom (Handy: Wischen) und Bestand – Pfeile, Zähler, Tastatur ---------- */
  const reihe = (spur, zurueck, weiter, nr) => {
    if (!spur) return;
    const breite = () => (spur.firstElementChild?.getBoundingClientRect().width || spur.clientWidth) + (parseFloat(getComputedStyle(spur).columnGap) || 0);
    const blaettern = (r) => spur.scrollBy({ left: r * breite(), behavior: ruhig.matches ? 'auto' : 'smooth' });
    zurueck?.addEventListener('click', () => blaettern(-1));
    weiter?.addEventListener('click', () => blaettern(1));
    spur.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowRight') { ev.preventDefault(); blaettern(1); } if (ev.key === 'ArrowLeft') { ev.preventDefault(); blaettern(-1); } });
    if (nr) spur.addEventListener('scroll', () => { nr.textContent = Math.round(spur.scrollLeft / breite()) + 1; }, { passive: true });
  };
  reihe($('[data-sr-spur]'), $('[data-sr-zurueck]'), $('[data-sr-weiter]'), $('[data-sr-nr]'));
  reihe($('[data-bestand-fenster]'), $('[data-bestand-zurueck]'), $('[data-bestand-weiter]'));

  /* ---------- Bewegung nachladen (nach dem Laden der Seite) ---------- */
  const brauchtBewegung = $('[data-held], [data-showroom], [data-stapel], [data-ablauf]');
  if (brauchtBewegung) {
    const skript = (src) => new Promise((ok, fehl) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fehl; document.head.appendChild(s); });
    const start = () => {
      if (ruhig.matches) return;
      skript('C:/Program Files/Git/entwurf-mk-autohandel/vendor/gsap.min.js').then(() => skript('C:/Program Files/Git/entwurf-mk-autohandel/vendor/ScrollTrigger.min.js')).then(() => skript('C:/Program Files/Git/entwurf-mk-autohandel/vendor/lenis.min.js')).then(() => skript('C:/Program Files/Git/entwurf-mk-autohandel/motion.js?v=3')).catch(() => {});
    };
    const los = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 200));
    if (document.readyState === 'complete') los(); else addEventListener('load', los, { once: true });
    ruhig.addEventListener('change', () => { if (!ruhig.matches && !window.gsap) start(); });
  }
})();
