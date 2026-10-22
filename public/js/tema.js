(() => {
  const clave = 'preferencia-tema';
  const sistema = window.matchMedia('(prefers-color-scheme: dark)');
  let guardado = null;
  let boton;
  try { guardado = localStorage.getItem(clave); } catch (_) {}
  if (!['claro', 'oscuro'].includes(guardado)) guardado = null;
  function aplicar(tema) {
    document.documentElement.dataset.tema = tema;
    if (boton) {
      const oscuro = tema === 'oscuro';
      boton.textContent = oscuro ? '☀ Modo claro' : '☾ Modo oscuro';
      boton.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
  }
  aplicar(guardado || (sistema.matches ? 'oscuro' : 'claro'));
  document.addEventListener('DOMContentLoaded', () => {
    const barra = document.createElement('div');
    barra.className = 'barra-tema';
    boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton-tema';
    boton.addEventListener('click', () => {
      guardado = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
      try { localStorage.setItem(clave, guardado); } catch (_) {}
      aplicar(guardado);
    });
    barra.append(boton);
    document.body.prepend(barra);
    aplicar(document.documentElement.dataset.tema);
  });
  sistema.addEventListener('change', () => {
    if (!guardado) aplicar(sistema.matches ? 'oscuro' : 'claro');
  });
  window.addEventListener('storage', (evento) => {
    if (evento.key !== clave && evento.key !== null) return;
    guardado = ['claro','oscuro'].includes(evento.newValue) ? evento.newValue : null;
    aplicar(guardado || (sistema.matches ? 'oscuro' : 'claro'));
  });
})();
