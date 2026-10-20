// MKA – Scroll-Bewegung (GSAP + ScrollTrigger + Lenis). Wird nur geladen, wenn Bewegung erlaubt ist.
// Ruhig und gezielt: Startbühne in Schichten (Schrift, Auto, Boden), Laufband mit Scroll-Tempo, Showroom-Film,
// Leistungen waagrecht gepinnt, Ablauf-Linie, Zeiger „Ansehen“ und magnetische Knöpfe (nur Maus).
// gsap.matchMedia setzt alles automatisch zurück, wenn „Bewegung reduzieren“ eingeschaltet wird.
(() => {
  'use strict';
  const { gsap, ScrollTrigger, Lenis } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const html = document.documentElement;
  html.classList.add('gsap');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let lenis = null;
  const mm = gsap.matchMedia();

  mm.add({ bewegt: '(prefers-reduced-motion: no-preference)', breit: '(min-width: 900px)', hoch: '(min-height: 640px)', fein: '(hover: hover) and (pointer: fine)' }, (ctx) => {
    const { bewegt, breit, hoch, fein } = ctx.conditions;
    if (!bewegt) return undefined;
    const aufraeumen = [];
    const springe = (y) => (lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y));

    // Weiches Scrollen nur mit Maus/Trackpad – auf Touch-Geräten bleibt das native Scrollen unangetastet
    if (Lenis && fein) {
      lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3), smoothWheel: true, anchors: { offset: -100 } });
      window.mkaLenis = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      const tick = (t) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      aufraeumen.push(() => { gsap.ticker.remove(tick); lenis?.destroy(); lenis = null; window.mkaLenis = null; });
    }

    // 1) Startbühne: Schichten laufen beim Wegscrollen verschieden schnell (Schrift bleibt zurück, Auto kommt nach vorn, Boden sinkt)
    const held = $('[data-held]');
    if (held && breit) {
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: held, start: 'top top', end: 'bottom top', scrub: 0.5 } });
      tl.to($('[data-held-wort]', held), { y: 150, opacity: 0.5 }, 0)
        .to($('[data-held-auto]', held), { y: -120, scale: 0.97 }, 0)
        .to($('[data-held-boden]', held), { y: 80 }, 0)
        .to($('[data-held-inhalt]', held), { y: -60, autoAlpha: 0, duration: 0.7 }, 0);
    }

    // 2) Laufband: läuft langsam, beim Scrollen leicht schneller, danach wieder gemächlich
    const band = $('[data-band]');
    if (band) {
      const lauf = gsap.to(band, { xPercent: -50, ease: 'none', duration: 48, repeat: -1 });
      let ruhe;
      let tween = null;
      ScrollTrigger.create({
        onUpdate: (self) => {
          tween?.kill();
          lauf.timeScale(1 + Math.min(2.4, Math.abs(self.getVelocity()) / 800));
          clearTimeout(ruhe);
          ruhe = setTimeout(() => { tween = gsap.to(lauf, { timeScale: 1, duration: 1.4, ease: 'power2.out' }); }, 100);
        },
      });
      aufraeumen.push(() => clearTimeout(ruhe));
    }

    // 3) Showroom: Bühne klebt (CSS sticky), jedes Auto rollt mit leichter Bewegungsunschärfe in den Lichtkegel,
    //    der Modellname zieht dahinter langsamer mit, Eckdaten zählen einmal hoch, dann kommt das nächste.
    const showroom = $('[data-showroom]');
    if (showroom && breit && hoch) {
      const slides = $$('[data-sr-slide]', showroom);
      const nr = $('[data-sr-nr]', showroom);
      const n = slides.length;
      gsap.set(slides, { visibility: 'visible' }); // CSS hält sie bis hierher verborgen
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: showroom, start: 'top top', end: 'bottom bottom', scrub: 0.8,
          onUpdate: (st) => { if (nr) nr.textContent = Math.min(n, Math.floor(st.progress * n * 0.999) + 1); },
        },
      });
      slides.forEach((s, i) => {
        const auto = $('.sr-auto', s);
        const wort = $('[data-sr-wort]', s);
        const zeilen = $$('[data-sr-zeile]', s);
        const kante = $('[data-sr-kante]', s);
        const info = $('[data-sr-info]', s);
        const t = i;
        gsap.set(auto, { xPercent: 85, autoAlpha: 0, filter: 'blur(14px)' });
        if (wort) gsap.set(wort, { xPercent: 14, autoAlpha: 0 });
        // Text nur über opacity ausblenden (bleibt per Tab erreichbar), Klicks nur auf der aktiven Folie
        gsap.set(zeilen, { y: 22, opacity: 0 });
        gsap.set(info, { pointerEvents: 'none' });
        tl.to(auto, { xPercent: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.34, ease: 'power2.out' }, t)
          .to(zeilen, { y: 0, opacity: 1, duration: 0.14, stagger: 0.035, ease: 'power2.out' }, t + 0.2)
          .set(info, { pointerEvents: 'auto' }, t + 0.2)
          .call(() => window.mkaZaehlen?.(s), null, t + 0.24)
          .fromTo(kante, { backgroundPosition: '85% 0' }, { backgroundPosition: '15% 0', duration: 0.7 }, t);
        if (wort) tl.to(wort, { xPercent: 0, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, t);
        if (i < n - 1) {
          tl.to(zeilen, { opacity: 0, y: -12, duration: 0.1 }, t + 0.8)
            .set(info, { pointerEvents: 'none' }, t + 0.8)
            .to(auto, { xPercent: -95, autoAlpha: 0, filter: 'blur(10px)', duration: 0.2, ease: 'power2.in' }, t + 0.8);
          if (wort) tl.to(wort, { xPercent: -10, autoAlpha: 0, duration: 0.2, ease: 'power2.in' }, t + 0.8);
        } else {
          tl.to({}, { duration: 0.2 }, t + 0.8); // letztes Auto bleibt stehen (Höhepunkt)
        }
      });
      // Tastatur: Fokus auf „Zum Fahrzeug“ einer Folie -> zu dieser Folie scrollen, damit sie sichtbar ist
      const st = tl.scrollTrigger;
      const fokus = (ev) => {
        const s = ev.target.closest('[data-sr-slide]');
        if (!s) return;
        const i = slides.indexOf(s);
        springe(st.start + ((i + 0.55) / n) * (st.end - st.start));
      };
      showroom.addEventListener('focusin', fokus);
      aufraeumen.push(() => showroom.removeEventListener('focusin', fokus));
    }

    // 4) Leistungen: am PC klebt die Bühne, die vier Karten fahren waagrecht durch (01–04)
    const leist = $('[data-leistungen]');
    const spur = leist && $('[data-stapel]', leist);
    if (leist && spur && breit && hoch) {
      const weg = () => Math.max(0, spur.scrollWidth - innerWidth);
      const fahrt = gsap.to(spur, { x: () => -weg(), ease: 'none', scrollTrigger: { trigger: leist, start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true } });
      const karten = $$('[data-stapel-karte]', leist);
      const st = fahrt.scrollTrigger;
      const fokus = (ev) => {
        const k = ev.target.closest('[data-stapel-karte]');
        if (!k) return;
        const i = karten.indexOf(k);
        springe(st.start + (i / Math.max(1, karten.length - 1)) * (st.end - st.start));
      };
      leist.addEventListener('focusin', fokus);
      aufraeumen.push(() => leist.removeEventListener('focusin', fokus));
    } else {
      $$('[data-stapel-bild] > img').forEach((img) => {
        gsap.fromTo(img, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'center center', scrub: true } });
      });
    }

    // 5) Ablauf: Linie zeichnet sich mit dem Scrollen
    const linie = $('[data-ablauf-linie]');
    if (linie) {
      gsap.fromTo(linie, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '[data-ablauf]', start: 'top 75%', end: 'center 45%', scrub: true } });
    }

    // 6) Nur mit Maus: Zeiger „Ansehen“ über Fahrzeugkarten, magnetische Knöpfe
    if (fein && breit) {
      const karten = $$('.karte-link');
      if (karten.length) {
        const z = document.createElement('div');
        z.className = 'zeiger'; z.textContent = 'Ansehen'; z.setAttribute('aria-hidden', 'true');
        document.body.appendChild(z);
        const zx = gsap.quickTo(z, 'x', { duration: 0.3, ease: 'power3' });
        const zy = gsap.quickTo(z, 'y', { duration: 0.3, ease: 'power3' });
        const bewege = (ev) => { zx(ev.clientX); zy(ev.clientY); };
        gsap.set(z, { scale: 0.4 });
        const an = (ev) => { bewege(ev); html.classList.add('zeiger-an'); gsap.to(z, { scale: 1, duration: 0.4, ease: 'power3.out' }); };
        const aus = () => { html.classList.remove('zeiger-an'); gsap.to(z, { scale: 0.4, duration: 0.3, ease: 'power3.out' }); };
        addEventListener('pointermove', bewege, { passive: true });
        karten.forEach((k) => { k.addEventListener('pointerenter', an); k.addEventListener('pointerleave', aus); });
        aufraeumen.push(() => { removeEventListener('pointermove', bewege); karten.forEach((k) => { k.removeEventListener('pointerenter', an); k.removeEventListener('pointerleave', aus); }); aus(); z.remove(); });
      }
      $$('[data-magnet], .galerie-pfeil, .sr-link').forEach((k) => {
        const mx = gsap.quickTo(k, 'x', { duration: 0.45, ease: 'power3' });
        const my = gsap.quickTo(k, 'y', { duration: 0.45, ease: 'power3' });
        const zieh = (ev) => { const r = k.getBoundingClientRect(); mx((ev.clientX - r.left - r.width / 2) * 0.32); my((ev.clientY - r.top - r.height / 2) * 0.32); };
        const los = () => gsap.to(k, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
        k.addEventListener('pointermove', zieh);
        k.addEventListener('pointerleave', los);
        aufraeumen.push(() => { k.removeEventListener('pointermove', zieh); k.removeEventListener('pointerleave', los); gsap.set(k, { clearProps: 'x,y' }); });
      });
    }

    // Bilder, die später geladen werden, verändern Höhen -> neu messen
    const neu = () => ScrollTrigger.refresh();
    addEventListener('load', neu, { once: true });
    return () => aufraeumen.forEach((f) => f());
  });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
