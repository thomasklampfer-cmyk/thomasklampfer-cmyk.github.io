/* Loindl – Entwurf. Bewegung: Scroll-Film (Canvas-Bildfolge statt <video>, damit iPhone/Safari
   zuverlässig mitläuft), GSAP ScrollTrigger, Lenis nur bei Maus/Trackpad.
   Schalter: ?off=lenis,film,lauf,…  ?capture=1 (für die Videoaufnahme: ohne Glättung). */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const off = new Set((params.get("off") || "").split(","));
  const capture = params.has("capture");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Menü + Kopf (ohne GSAP) ---------- */
  const menueKnopf = document.querySelector("[data-menue]");
  const menue = document.getElementById("handymenue");
  if (menueKnopf && menue) {
    const setze = (auf) => { menueKnopf.setAttribute("aria-expanded", String(auf)); menue.hidden = !auf; };
    menueKnopf.addEventListener("click", () => setze(menue.hidden));
    menue.addEventListener("click", (e) => { if (e.target.closest("a")) setze(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") setze(false); });
  }
  const kopf = document.querySelector("[data-kopf]");
  const kopfCheck = () => kopf && kopf.classList.toggle("ist-gerollt", scrollY > 10);
  addEventListener("scroll", kopfCheck, { passive: true });
  kopfCheck();

  /* ---------- Formular-Attrappe ---------- */
  const form = document.querySelector("[data-attrappe]");
  if (form) {
    const thema = params.get("thema");
    if (thema) {
      const radio = form.querySelector(`input[name="thema"][value="${CSS.escape(thema)}"]`);
      if (radio) radio.checked = true;
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      form.classList.add("ist-gesendet");
      form.querySelector(".formular__ok")?.focus();
    });
  }

  /* ---------- Scroll-Film ---------- */
  const film = document.querySelector("[data-film]");
  const filmApi = film && !off.has("film") ? baueFilm(film) : null;

  function baueFilm(film) {
    const canvas = film.querySelector("[data-leinwand]");
    const ctx = canvas.getContext("2d");
    const kapitel = [...film.querySelectorAll("[data-kapitel]")];
    const stationen = [...film.querySelectorAll("[data-station]")];
    const balken = film.querySelector("[data-fortschritt]");
    const ETAPPEN = 4, JE = 60, GESAMT = ETAPPEN * JE;
    const HALT = 0.6; // Verweilen an jeder Station (in Etappen-Längen)
    const EINHEITEN = 5 * HALT + ETAPPEN;
    // Ein Bildsatz für alle Geräte (16:9). Hochkant wird je Station auf das Wichtige ausgerichtet:
    const FOKUS = [0.58, 0.47, 0.5, 0.6, 0.35]; // x-Anteil: Haus, Kesselflamme, Dach, Wanne, Wärmepumpe
    const ordner = "d";
    let bilder = new Array(GESAMT);
    let geladen = 0;
    let aktuellesBild = -1, zielBild = 0, aktivesKapitel = 0;

    const pfad = (i) => `film/${ordner}/e${Math.floor(i / JE) + 1}_${String((i % JE) + 1).padStart(2, "0")}.webp`;

    function lade() {
      bilder = new Array(GESAMT);
      geladen = 0;
      // Reihenfolge: erst die Stationsbilder, dann Etappe für Etappe.
      const reihe = [0, 59, 119, 179, 239];
      for (let i = 0; i < GESAMT; i++) if (!reihe.includes(i)) reihe.push(i);
      let laufend = 0, pos = 0;
      const weiter = () => {
        while (laufend < 6 && pos < reihe.length) {
          const i = reihe[pos++];
          const img = new Image();
          img.decoding = "async";
          laufend++;
          img.onload = () => { bilder[i] = img; geladen++; laufend--; if (Math.abs(i - zielBild) < 3 || aktuellesBild < 0) male(true); weiter(); };
          img.onerror = () => { laufend--; weiter(); };
          img.src = pfad(i);
        }
      };
      weiter();
    }

    function groesse() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      male(true);
    }

    function kopfHoehe() {
      const k = document.querySelector("[data-kopf]");
      return k ? k.getBoundingClientRect().bottom : 0;
    }

    function naechstesGeladenes(i) {
      for (let d = 0; d < GESAMT; d++) {
        if (bilder[i - d]) return bilder[i - d];
        if (bilder[i + d]) return bilder[i + d];
      }
      return null;
    }

    function male(erzwingen) {
      const i = Math.max(0, Math.min(GESAMT - 1, Math.round(zielBild)));
      if (i === aktuellesBild && !erzwingen) return;
      const img = bilder[i] || naechstesGeladenes(i);
      if (!img) return;
      aktuellesBild = bilder[i] ? i : aktuellesBild;
      const cw = canvas.width, ch = canvas.height;
      const st = Math.min(4, (i + 1) / JE);
      const a = Math.floor(st), f = st - a;
      const fx = FOKUS[a] + (FOKUS[Math.min(4, a + 1)] - FOKUS[a]) * f;
      if (cw / ch < 0.8) {
        // Hochkant (Handy): Bild oben unter dem Kopf, darunter ruhiger dunkler Grund für die Karte.
        // So bleibt deutlich mehr vom Motiv sichtbar als bei vollflächigem Zuschnitt.
        const oben = kopfHoehe() * (canvas.width / canvas.clientWidth);
        const s = Math.max(cw / img.naturalWidth, (ch * 0.64) / img.naturalHeight);
        const w = img.naturalWidth * s, h = img.naturalHeight * s;
        const x = Math.min(0, Math.max(cw - w, cw / 2 - w * fx));
        ctx.fillStyle = "#121a2b";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, x, oben, w, h);
        const g = ctx.createLinearGradient(0, oben + h * 0.62, 0, oben + h);
        g.addColorStop(0, "rgba(18,26,43,0)");
        g.addColorStop(1, "rgba(18,26,43,1)");
        ctx.fillStyle = g;
        ctx.fillRect(0, oben + h * 0.62 - 1, cw, h * 0.38 + 2);
        return;
      }
      const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      const x = Math.min(0, Math.max(cw - w, cw / 2 - w * fx));
      ctx.drawImage(img, x, (ch - h) / 2, w, h);
    }

    // Fortschritt 0..1 → Bild + Kapitel (mit Verweilen an den Stationen)
    function setze(p) {
      const u = p * EINHEITEN;
      const k = Math.floor(u / (HALT + 1));
      const r = u - k * (HALT + 1);
      let bild, kap, steht;
      if (k >= 4) { bild = GESAMT - 1; kap = 4; steht = true; }
      else if (r <= HALT) { bild = k === 0 ? 0 : k * JE - 1; kap = k; steht = true; }
      else {
        const m = r - HALT; // 0..1 innerhalb der Kamerafahrt
        bild = k * JE + m * (JE - 1);
        kap = m < 0.5 ? k : k + 1;
        steht = m < 0.08 || m > 0.92;
      }
      zielBild = bild;
      male(false);
      const sichtbar = steht ? kap : -1;
      if (sichtbar !== aktivesKapitel) {
        aktivesKapitel = sichtbar;
        kapitel.forEach((el) => el.classList.toggle("ist-aktiv", Number(el.dataset.kapitel) === sichtbar));
      }
      stationen.forEach((el) => el.classList.toggle("ist-aktiv", Number(el.dataset.station) === kap));
      if (balken) balken.style.transform = `scaleX(${p})`;
    }

    // Ohne GSAP (oder reduzierte Bewegung): einfacher Scroll-Abgleich.
    function rohFortschritt() {
      const r = film.getBoundingClientRect();
      const weg = film.offsetHeight - innerHeight;
      return Math.max(0, Math.min(1, -r.top / weg));
    }

    lade();
    groesse();
    addEventListener("resize", groesse);
    window.__film = { bereit: () => geladen >= GESAMT, geladen: () => geladen };
    return { setze, rohFortschritt, film };
  }

  /* ---------- GSAP ---------- */
  const start = () => {
    const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger || reduce || off.has("all")) {
      if (filmApi) {
        const f = () => filmApi.setze(filmApi.rohFortschritt());
        addEventListener("scroll", f, { passive: true });
        f();
      }
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    const isDesktop = matchMedia("(min-width: 761px)").matches;

    let lenis = null;
    if (finePointer && !capture && !off.has("lenis") && window.Lenis) {
      lenis = new window.Lenis({ autoRaf: false, lerp: 0.1, wheelMultiplier: 0.95 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    // Anker weich anfahren
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href*="#"]');
      if (!a) return;
      const url = new URL(a.href);
      if (url.pathname !== location.pathname) return;
      const ziel = document.getElementById(url.hash.slice(1));
      if (!ziel) return;
      e.preventDefault();
      let y;
      if (filmApi && ziel.closest("[data-film]")) {
        // Kapitel im Film: an die passende Station scrollen
        const k = Number(ziel.dataset.kapitel || 0);
        const weg = filmApi.film.offsetHeight - innerHeight;
        y = filmApi.film.offsetTop + weg * ((k * 1.6 + 0.3) / 7); // Mitte des Verweilens an Station k
      } else {
        y = ziel.getBoundingClientRect().top + scrollY - 110;
      }
      if (lenis) lenis.scrollTo(y, { duration: 1.6 });
      else scrollTo({ top: y, behavior: "smooth" });
    });

    const scrub = capture ? true : 0.5;

    if (filmApi) {
      ScrollTrigger.create({
        trigger: filmApi.film, start: "top top", end: "bottom bottom", scrub: capture ? true : 0.35,
        onUpdate: (st) => filmApi.setze(st.progress),
      });
      filmApi.setze(0);
    }

    if (!off.has("heben")) {
      gsap.utils.toArray("[data-heben]").forEach((el) => {
        gsap.fromTo(el, { y: 40, skewY: 2.5, transformOrigin: "left bottom" },
          { y: 0, skewY: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 98%", end: "top 62%", scrub } });
      });
    }

    if (!off.has("lauf")) {
      gsap.utils.toArray("[data-lauf]").forEach((row, i) => {
        gsap.fromTo(row, { xPercent: i % 2 ? -28 : 0 }, { xPercent: i % 2 ? 0 : -28, ease: "none",
          scrollTrigger: { trigger: row.parentElement, start: "top bottom", end: "bottom top", scrub } });
      });
    }

    if (!off.has("leitung")) {
      const l = document.querySelector("[data-leitung]");
      if (l) gsap.fromTo(l, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: l.closest(".schritte"), start: "top 70%", end: "bottom 70%", scrub } });
      gsap.utils.toArray(".schritte li").forEach((li) => {
        ScrollTrigger.create({ trigger: li, start: "top 70%", onEnter: () => li.classList.add("ist-da"), onLeaveBack: () => li.classList.remove("ist-da") });
      });
    }

    if (!off.has("parallax")) {
      gsap.utils.toArray("[data-parallax]").forEach((img) => {
        gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
      });
    }

    if (!off.has("spur")) {
      const spur = document.querySelector("[data-spur]");
      const pin = document.querySelector(".projekte");
      const weg = () => (spur ? Math.max(0, spur.scrollWidth - innerWidth) : 0);
      if (spur && pin && isDesktop && weg() > 80) {
        gsap.to(spur, { x: () => -weg(), ease: "none",
          scrollTrigger: { trigger: pin, start: "top top", end: () => `+=${weg()}`, pin: true, scrub: capture ? true : 0.6, invalidateOnRefresh: true, anticipatePin: 1 } });
      }
    }

    if (!off.has("fuss")) {
      const w = document.querySelector("[data-fuss-wort]");
      if (w) gsap.fromTo(w, { xPercent: 0 }, { xPercent: -22, ease: "none", scrollTrigger: { trigger: w, start: "top bottom", end: "bottom top", scrub } });
      const sk = document.querySelector(".seitenkopf__bild");
      if (sk) gsap.fromTo(sk, { yPercent: 0 }, { yPercent: 10, ease: "none", scrollTrigger: { trigger: sk.parentElement, start: "top top", end: "bottom top", scrub: true } });
    }

    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh).catch(() => {});
  };
  // Alle Skripte sind "defer" und laufen in Reihenfolge – GSAP ist hier schon da.
  start();
  addEventListener("load", () => window.ScrollTrigger?.refresh(), { once: true });
})();
