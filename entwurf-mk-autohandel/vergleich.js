// Umschalter für vergleich.html (PC- oder Handy-Bildschirmfoto der alten Seite)
document.querySelectorAll('[data-alt]').forEach((a) => a.addEventListener('click', (ev) => {
  ev.preventDefault();
  document.getElementById('alt').src = a.dataset.alt;
}));
