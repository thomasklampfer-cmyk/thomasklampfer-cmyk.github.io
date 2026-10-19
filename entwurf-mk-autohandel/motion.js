// MKA – Scroll-Bewegung (GSAP + ScrollTrigger + Lenis). Wird nur geladen, wenn Bewegung erlaubt ist.
// Ruhig und gezielt: Startbild wird gerahmt, Bestand fährt waagrecht vorbei, Leistungen stapeln sich, Ablauf-Linie zeichnet sich.
// gsap.matchMedia setzt alles automatisch zurück, wenn „Bewegung reduzieren“ eingeschaltet wird.
(() => {
  'use strict';
  const { gsap, ScrollTrigger, Lenis } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let lenis = null;
  const mm = gsap.matchMedia();

  mm.add({ bewegt: '(prefers-reduced-motion: no-preference)', breit: '(min-width: 900px)', hoch: '(min-height: 700px)' }, (ctx) => {
    const { bewegt, breit, hoch } = ctx.conditions;
    if (!bewegt) return undefined;
    const aufraeumen = [];

    // Weiches Scrollen nur mit Maus/Trackpad – auf Touch-Geräten bleibt das native Scrollen unangetastet
    if (Lenis && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3), smoothWheel: true, anchors: { offset: -100 } });
      window.mkaLenis = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      const tick = (t) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      aufraeumen.push(() => { gsap.ticker.remove(tick); lenis?.destroy(); lenis = null; window.mkaLenis = null; });
    }

    // 1) Startbild: zoomt heraus und wird gerahmt; Text weicht, Bildzeile kommt
    const held = $('[data-held]');
    if (held) {
      const rahmen = $('[data-held-rahmen]', held);
      const bild = $('[data-held-bild]', held);
      const inhalt = $('[data-held-inhalt]', held);
      const zeile = $('[data-held-zeile]', held);
      if (breit) {
        // PC: Bühne klebt, Bild zoomt heraus und wird gerahmt, am Ende kommt die Bildzeile
        const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: held, start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
        tl.fromTo(bild, { scale: 1.16 }, { scale: 1, duration: 1 }, 0)
          .fromTo(rahmen, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(14% 6% 18% 6%)', duration: 1 }, 0)
          .to(inhalt, { autoAlpha: 0, y: -60, duration: 0.42 }, 0.04)
          .to($('[data-held-schleier]', held), { opacity: 0.35, duration: 0.6 }, 0.2);
        if (zeile) tl.fromTo(zeile, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 0.68);
      } else {
        // Handy: kein Kleben (kein Leerraum), nur ein ruhiges Herauszoomen beim Wegscrollen
        gsap.fromTo(bild, { scale: 1.06 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: held, start: 'top top', end: 'bottom top', scrub: true } });
      }
    }

    // 2) Showroom: Bühne klebt (CSS sticky), jedes Auto rollt von rechts in den Lichtkegel,
    //    Name/Eckdaten/Preis bauen sich daneben auf, dann fährt es links hinaus und das nächste kommt.
    const showroom = $('[data-showroom]');
    if (showroom && breit && innerHeight >= 640) {
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
        const zeilen = $$('[data-sr-zeile]', s);
        const kante = $('[data-sr-kante]', s);
        const info = $('[data-sr-info]', s);
        const t = i;
        gsap.set(auto, { xPercent: 85, autoAlpha: 0 });
        // Text nur über opacity ausblenden (bleibt per Tab erreichbar), Klicks nur auf der aktiven Folie
        gsap.set(zeilen, { y: 22, opacity: 0 });
        gsap.set(info, { pointerEvents: 'none' });
        tl.to(auto, { xPercent: 0, autoAlpha: 1, duration: 0.34, ease: 'power2.out' }, t)
          .to(zeilen, { y: 0, opacity: 1, duration: 0.14, stagger: 0.035, ease: 'power2.out' }, t + 0.2)
          .set(info, { pointerEvents: 'auto' }, t + 0.2)
          .fromTo(kante, { backgroundPosition: '85% 0' }, { backgroundPosition: '15% 0', duration: 0.7 }, t);
        if (i < n - 1) {
          tl.to(zeilen, { opacity: 0, y: -12, duration: 0.1 }, t + 0.8)
            .set(info, { pointerEvents: 'none' }, t + 0.8)
            .to(auto, { xPercent: -95, autoAlpha: 0, duration: 0.2, ease: 'power2.in' }, t + 0.8);
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
        const y = st.start + ((i + 0.55) / n) * (st.end - st.start);
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
      };
      showroom.addEventListener('focusin', fokus);
      aufraeumen.push(() => showroom.removeEventListener('focusin', fokus));
    }

    // 3) Leistungen: Karten liegen direkt hintereinander (CSS sticky, kein Pin-Abstand).
    //    Die vordere Karte bleibt voll lesbar und tritt erst zurück, wenn die nächste sie überschiebt.
    const karten = $$('[data-stapel-karte]');
    if (karten.length && breit && hoch) {
      karten.forEach((k, i) => {
        const naechste = karten[i + 1];
        if (!naechste) return;
        gsap.fromTo($('.stapel-innen', k), { scale: 1, filter: 'brightness(1)' }, {
          scale: 0.96, filter: 'brightness(0.72)', ease: 'none',
          scrollTrigger: { trigger: naechste, start: 'top 62%', end: 'top 18%', scrub: true },
        });
      });
    }
    $$('[data-stapel-bild] > img').forEach((img) => {
      gsap.fromTo(img, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'center center', scrub: true } });
    });

    // 4) Ablauf: Linie zeichnet sich mit dem Scrollen
    const linie = $('[data-ablauf-linie]');
    if (linie) {
      gsap.fromTo(linie, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '[data-ablauf]', start: 'top 75%', end: 'center 45%', scrub: true } });
    }

    // Bilder, die später geladen werden, verändern Höhen -> neu messen
    const neu = () => ScrollTrigger.refresh();
    addEventListener('load', neu, { once: true });
    return () => aufraeumen.forEach((f) => f());
  });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
