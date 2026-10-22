const formulario = document.querySelector('#formulario-respuesta');
const estadoRespuesta = document.querySelector('#estado-respuesta');

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  if (!formulario.reportValidity()) return;

  const datos = new FormData(formulario);
  const clasificacion = datos.get('clasificacion');
  const confianza = Number(datos.get('confianza'));
  const boton = formulario.querySelector('button[type="submit"]');

  boton.disabled = true;
  estadoRespuesta.textContent = 'Guardando respuesta…';

  try {
    const respuesta = await fetch('/api/respuestas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensajeId: 'demo-01', clasificacion, confianza }),
    });

    if (!respuesta.ok) throw new Error('No se pudo guardar la respuesta.');

    estadoRespuesta.textContent = 'Respuesta guardada correctamente.';
  } catch (error) {
    estadoRespuesta.textContent = `${error.message} Intentá de nuevo.`;
  } finally {
    boton.disabled = false;
  }
});
