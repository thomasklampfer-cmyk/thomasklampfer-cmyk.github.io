/* WP Optimeister – Scrollfilm: all-intra-MP4 wird direkt dekodiert (WebCodecs) und auf eine Zeichenfläche gemalt.
   Fehlt WebCodecs, springt das Video wie bisher. Ein gemeinsamer Takt (rAF) treibt Scrollen, Film und Texte. Keine Fremdbibliotheken außer Lenis. */
(function () {
  var ruhig = false; try { ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var d = document, wurzel = d.documentElement;
  if (!ruhig) wurzel.classList.add('bewegung');

  // Weiches Scrollen mit Mausrad (Lenis); am Handy bleibt das natürliche Scrollen
  var lenis = null;
  if (!ruhig && window.Lenis) lenis = new Lenis({ lerp: .1, wheelMultiplier: .9, smoothWheel: true, anchors: { offset: -84 } });

  // Reveal
  var els = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.style.transitionDelay = (e.target.dataset.v || 0) + 'ms'; e.target.classList.add('an'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  } else els.forEach(function (e) { e.classList.add('an'); });

  // Instrumente bewegen sich nur, solange sie sichtbar sind
  if ('IntersectionObserver' in window && !ruhig) {
    var ioK = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('sicht', e.isIntersecting); }); }, { rootMargin: '5% 0px' });
    d.querySelectorAll('.kachel').forEach(function (k) { ioK.observe(k); });
  }

  // Wort für Wort
  var wr = d.querySelector('.wort-reveal'), woerter = [], wortStand = -1;
  if (wr) {
    var inhalt = wr.textContent.trim().split(/\s+/);
    wr.setAttribute('aria-label', wr.textContent.trim());
    wr.textContent = '';
    inhalt.forEach(function (w, i) {
      var s = d.createElement('span'); s.className = 'wort'; s.setAttribute('aria-hidden', 'true'); s.textContent = w;
      wr.appendChild(s); if (i < inhalt.length - 1) wr.appendChild(d.createTextNode(' '));
    });
    woerter = wr.querySelectorAll('.wort');
  }
  function wortLage(h) {
    if (!woerter.length || ruhig) return;
    var r = wr.getBoundingClientRect();
    if (r.bottom < -h || r.top > h * 1.2) return;
    var n = Math.round(Math.max(0, Math.min(1, (h * .86 - r.top) / (r.height + h * .3))) * woerter.length);
    if (n === wortStand) return;
    wortStand = n;
    woerter.forEach(function (w, i) { w.classList.toggle('an', i < n); });
  }

  // Wärmekurve zeichnet sich beim Scrollen
  var kurve = d.querySelector('.kurve path'), kl = 0, kurveStand = -1;
  if (kurve) { kl = kurve.getTotalLength(); if (!ruhig) { kurve.style.strokeDasharray = kl; kurve.style.strokeDashoffset = kl; } }
  function kurveLage(h) {
    if (!kurve || ruhig) return;
    var r = kurve.ownerSVGElement.getBoundingClientRect();
    if (r.bottom < -h || r.top > h * 1.2) return;
    var p = Math.round(Math.max(0, Math.min(1, (h * .92 - r.top) / (h * .68))) * 400) / 400;
    if (p === kurveStand) return;
    kurveStand = p; kurve.style.strokeDashoffset = kl * (1 - p);
  }

  // Scrollfilm
  var film = d.querySelector('.film');
  var video = film && film.querySelector('video');
  var takte = film ? [].slice.call(film.querySelectorAll('.takt')).map(function (t) { return { el: t, von: +t.dataset.von, bis: +t.dataset.bis, o: -1, y: null }; }) : [];
  var balken = film && film.querySelector('.fortschritt i');
  var hinweis = film && film.querySelector('.scrollhinweis');
  var ende = film && film.querySelector('.film-ende');

  function setzeTakte(p) {
    takte.forEach(function (t) {
      var a = t.von, b = t.bis, f = .05;
      var o = p < a - f ? 0 : p < a ? (p - a + f) / f : p <= b ? 1 : p < b + f ? 1 - (p - b) / f : 0;
      if (a === 0 && p <= b) o = 1;
      if (b === 1 && p >= a) o = 1;
      o = o * o * (3 - 2 * o);
      o = Math.round(o * 200) / 200;
      if (o === t.o) return;           // nichts geändert: nichts anfassen
      t.o = o;
      var s = t.el.style;
      s.opacity = o;
      s.visibility = o > 0 ? 'visible' : 'hidden';
      s.pointerEvents = o > .6 ? 'auto' : 'none';
      // Volle Deckkraft: keine Verschiebung, Text liegt auf ganzen Pixeln und bleibt scharf
      s.transform = (ruhig || o >= 1 || o <= 0) ? 'none' : 'translate3d(0,' + ((1 - o) * (p < a ? 34 : -24)).toFixed(1) + 'px,0)';
    });
  }

  // ---- MP4 lesen: nur, was der Decoder braucht (Abtastwerte + avcC). Film ist all-intra, jedes Bild steht für sich.
  function leseMP4(puffer) {
    var v = new DataView(puffer), bytes = new Uint8Array(puffer);
    function kisten(von, bis) {
      var aus = [], o = von;
      while (o + 8 <= bis) {
        var g = v.getUint32(o), kopf = 8;
        if (g === 1) { g = Number(v.getBigUint64(o + 8)); kopf = 16; } else if (g === 0) g = bis - o;
        if (g < kopf) break;
        aus.push({ typ: String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]), von: o + kopf, bis: o + g });
        o += g;
      }
      return aus;
    }
    function finde(l, t) { for (var i = 0; i < l.length; i++) if (l[i].typ === t) return l[i]; return null; }
    var moov = finde(kisten(0, puffer.byteLength), 'moov'); if (!moov) throw new Error('kein moov');
    var spuren = kisten(moov.von, moov.bis).filter(function (k) { return k.typ === 'trak'; });
    for (var i = 0; i < spuren.length; i++) {
      var mdia = finde(kisten(spuren[i].von, spuren[i].bis), 'mdia');
      var minf = mdia && finde(kisten(mdia.von, mdia.bis), 'minf');
      var stbl = minf && finde(kisten(minf.von, minf.bis), 'stbl');
      if (!stbl) continue;
      var k = kisten(stbl.von, stbl.bis), stsd = finde(k, 'stsd');
      if (!stsd) continue;
      var e = stsd.von + 8, typ = String.fromCharCode(bytes[e + 4], bytes[e + 5], bytes[e + 6], bytes[e + 7]);
      if (typ !== 'avc1') continue;
      var breite = v.getUint16(e + 32), hoehe = v.getUint16(e + 34);
      var avcC = finde(kisten(e + 8 + 78, e + v.getUint32(e)), 'avcC');
      var beschr = bytes.slice(avcC.von, avcC.bis);
      var hex = function (b) { return ('0' + b.toString(16)).slice(-2); };
      var codec = 'avc1.' + hex(beschr[1]) + hex(beschr[2]) + hex(beschr[3]);
      var stsz = finde(k, 'stsz'), stsc = finde(k, 'stsc'), stco = finde(k, 'stco'), co64 = finde(k, 'co64');
      var einheit = v.getUint32(stsz.von + 4), n = v.getUint32(stsz.von + 8), groessen = [];
      for (var j = 0; j < n; j++) groessen.push(einheit || v.getUint32(stsz.von + 12 + j * 4));
      var teile = stco || co64, cn = v.getUint32(teile.von + 4), sn = v.getUint32(stsc.von + 4), bild = 0, abt = [];
      for (var c = 0; c < cn; c++) {
        var off = stco ? v.getUint32(stco.von + 8 + c * 4) : Number(v.getBigUint64(co64.von + 8 + c * 8));
        var je = 1;
        for (var q = 0; q < sn; q++) if (v.getUint32(stsc.von + 8 + q * 12) <= c + 1) je = v.getUint32(stsc.von + 12 + q * 12);
        for (var w = 0; w < je && bild < n; w++) { abt.push({ o: off, g: groessen[bild] }); off += groessen[bild]; bild++; }
      }
      return { codec: codec, beschr: beschr, breite: breite, hoehe: hoehe, abt: abt, bytes: bytes };
    }
    throw new Error('keine H.264-Spur');
  }

  // ---- Direkter Film: dekodiert immer nur das gerade gebrauchte Bild
  var maler = null;
  function starteMaler() {
    if (!video || ruhig || !('VideoDecoder' in window)) return;
    var quelle = video.currentSrc; if (!quelle) return;
    fetch(quelle).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(function (b) {
      var m = leseMP4(b);
      var cfg = { codec: m.codec, description: m.beschr, codedWidth: m.breite, codedHeight: m.hoehe, optimizeForLatency: true };
      return VideoDecoder.isConfigSupported(cfg).then(function (s) {
        if (!s.supported) throw new Error('Codec');
        var fl = d.createElement('canvas'); fl.width = m.breite; fl.height = m.hoehe; fl.className = 'film-bild'; fl.setAttribute('aria-hidden', 'true');
        var ctx = fl.getContext('2d', { alpha: false });
        // Hält nur wenige dekodierte Bilder rund um den Scrollstand; dazwischen wird überblendet.
        var z = { frames: new Map(), wartend: new Set(), pos: 0, anzahl: m.abt.length, echt: -1, an: false, gemalt: -1 };
        var aufraeumen = function () {
          var nah = Array.from(z.frames.keys()).sort(function (x, y) { return Math.abs(x - z.pos) - Math.abs(y - z.pos); });
          nah.slice(4).forEach(function (i) { z.frames.get(i).close(); z.frames.delete(i); });
        };
        var dec = new VideoDecoder({
          output: function (f) {
            var i = Math.round(f.timestamp / 33333);
            z.wartend.delete(i);
            if (z.frames.has(i)) z.frames.get(i).close();
            z.frames.set(i, f); aufraeumen(); z.gemalt = -1;
          },
          error: function (e) { window.__filmFehler = String(e); maler = null; if (fl.parentNode) fl.parentNode.removeChild(fl); video.style.visibility = ''; }
        });
        dec.configure(cfg);
        var hole = function (i) {
          if (i < 0 || i >= z.anzahl || z.frames.has(i) || z.wartend.has(i) || z.wartend.size >= 3 || dec.state !== 'configured') return;
          var a = m.abt[i]; z.wartend.add(i);
          dec.decode(new EncodedVideoChunk({ type: 'key', timestamp: i * 33333, data: m.bytes.subarray(a.o, a.o + a.g) }));
        };
        z.zeige = function (pos) {
          var richtung = pos >= z.pos ? 1 : -1;
          z.pos = pos;
          var u = Math.floor(pos), o = Math.min(u + 1, z.anzahl - 1), w = pos - u;
          hole(u); hole(o); hole(richtung > 0 ? o + 1 : u - 1);
          if (pos === z.gemalt) return;
          var A = z.frames.get(u), B = z.frames.get(o);
          if (!A || !B) {   // Noch nicht da: das nächste vorhandene Bild zeigen
            var beste = null, abst = 1e9;
            z.frames.forEach(function (f, i) { var q = Math.abs(i - pos); if (q < abst) { abst = q; beste = i; } });
            if (beste === null) return;
            ctx.globalAlpha = 1; ctx.drawImage(z.frames.get(beste), 0, 0, m.breite, m.hoehe); z.echt = beste;
          } else {
            ctx.globalAlpha = 1; ctx.drawImage(A, 0, 0, m.breite, m.hoehe);
            if (w > .004 && o !== u) { ctx.globalAlpha = w; ctx.drawImage(B, 0, 0, m.breite, m.hoehe); ctx.globalAlpha = 1; }
            z.gemalt = pos; z.echt = u;
          }
          window.__filmBilder = (window.__filmBilder || 0) + 1;
          if (!z.an) { z.an = true; video.parentNode.insertBefore(fl, video.nextSibling); video.style.visibility = 'hidden'; }
        };
        maler = z;
      });
    }).catch(function (e) { window.__filmFehler = String(e); });
  }
  if (video) {
    if (video.readyState >= 1) starteMaler(); else video.addEventListener('loadedmetadata', starteMaler, { once: true });
  }

  // ---- Ein gemeinsamer Takt
  var kopf = d.querySelector('.kopf'), kopfStand = null;
  var zuletzt = performance.now(), glatt = 0, letzte = -1;
  var fHoehe = 0, fOben = 0;
  function massFilm() { if (film) { fHoehe = film.offsetHeight - innerHeight; fOben = film.getBoundingClientRect().top + scrollY; } }
  massFilm(); addEventListener('resize', massFilm);

  function schritt(jetzt) {
    var dt = Math.min(.1, (jetzt - zuletzt) / 1000); zuletzt = jetzt;
    if (lenis) lenis.raf(jetzt);
    var y = scrollY, h = innerHeight;
    var fest = y > 40;
    if (fest !== kopfStand && kopf) { kopfStand = fest; kopf.classList.toggle('fest', fest); }
    if (film) {
      var roh = fHoehe > 0 ? Math.max(0, Math.min(1, (y - fOben) / fHoehe)) : 0;
      // Lenis glättet schon: nur leicht nachführen; ohne Lenis (Touch) etwas stärker
      glatt = ruhig ? roh : glatt + (roh - glatt) * (1 - Math.exp(-dt * (lenis ? 26 : 9)));
      if (Math.abs(roh - glatt) < .00005) glatt = roh;
      if (y < fOben + fHoehe + h) {
        if (glatt !== letzte) {
          letzte = glatt;
          setzeTakte(glatt);
          if (balken) balken.style.transform = 'scaleX(' + glatt.toFixed(4) + ')';
          if (hinweis) hinweis.style.opacity = glatt > .015 ? 0 : 1;
          if (ende) ende.style.opacity = Math.max(0, Math.min(1, (glatt - .955) / .045));
        }
        if (!ruhig) {
          if (maler) {
            var soll = glatt * (maler.anzahl - 1);
            maler.zeige(soll);
            if (window.__messLag) window.__messLag.push(Math.abs(soll - maler.echt));
          }
          else if (video && video.duration && !video.seeking) {
            var t = glatt * (video.duration - .05);
            if (Math.abs(video.currentTime - t) > .008) { try { video.currentTime = t; } catch (e) {} }
          }
        }
      }
    }
    wortLage(h); kurveLage(h);
    requestAnimationFrame(schritt);
  }
  if (film) setzeTakte(0);
  requestAnimationFrame(schritt);

  // Ersparnis-Rechner (Steuerung). Rechenweg steht auf der Seite unter „So rechnen wir“.
  var rS = d.getElementById('e-summe');
  if (rS) {
    var ids = ['r-haus', 'r-wp', 'r-p', 'r-e'], einz = {};
    ids.forEach(function (i) { einz[i] = d.getElementById(i); });
    var zahl = function (n) { return Math.round(n).toLocaleString('de-AT'); };
    var zehn = function (n) { return Math.max(0, Math.round(n / 10) * 10); };
    var spanne = function (a, b) { return a === b ? zahl(a) + ' €' : zahl(a) + ' bis ' + zahl(b) + ' €'; };
    var rechne = function () {
      var haus = +einz['r-haus'].value, wp = +einz['r-wp'].value, p = +einz['r-p'].value, e = +einz['r-e'].value;
      ids.forEach(function (i) {
        var el = einz[i], o = el.parentNode.querySelector('output');
        o.textContent = zahl(+el.value) + ' ' + o.dataset.e;
        el.style.setProperty('--w', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
      });
      var preis = Math.max(0, p - e) / 100;
      var pv = function (st) { return (haus + wp) * .30 * st * .8 * preis; };
      var fein = function (an) { return wp * .9 * an * p / 100; };
      var tief = zehn(pv(.25)), hoch = zehn(pv(.35) + fein(.05));   // Untergrenze ohne Heizkurve: die gilt nur bedingt
      rS.textContent = spanne(tief, hoch);
      var vz = function (n) { return (n < 0 ? '−' : '+') + zahl(Math.abs(n)) + ' €'; };
      d.getElementById('e-netto').textContent = vz(tief - 359) + ' bis ' + vz(hoch - 359);
      d.getElementById('e-pv').textContent = spanne(zehn(pv(.25)), zehn(pv(.35)));
      d.getElementById('e-fein').textContent = spanne(zehn(fein(.025)), zehn(fein(.05)));
    };
    ids.forEach(function (i) { einz[i].addEventListener('input', rechne); });
    rechne();
  }

  // Anfrage (Entwurf: sendet nichts)
  var form = d.querySelector('.formular');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = form.querySelector('.meldung');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    m.textContent = 'Entwurf: Das Formular sendet noch nicht. Es wurde nichts übertragen.';
  });
})();
