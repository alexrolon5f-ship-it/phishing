const estadoDemo = document.querySelector('#estado-demo');
const claveSesion = 'sesion-demo-phishing';
let sesionId = sessionStorage.getItem(claveSesion);

if (!sesionId) {
  sesionId = crypto.randomUUID();
  sessionStorage.setItem(claveSesion, sesionId);
}

async function registrarEvento(evento) {
  const respuesta = await fetch('/api/demo-eventos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sesionId, evento, variante: sessionStorage.getItem('variante-demo') }),
  });
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    throw new Error(respuesta.status === 400
      ? 'La página necesita actualizarse. Volvé al mensaje inicial y presioná Ctrl + F5.'
      : (datos.error || 'No se pudo registrar la acción.'));
  }
}

const botonRevisar = document.querySelector('#revisar-actividad');
if (botonRevisar) {
  let variante = sessionStorage.getItem('variante-demo');
  if (!['tradicional', 'ia'].includes(variante)) {
    variante = crypto.getRandomValues(new Uint32Array(1))[0] < 2147483648 ? 'tradicional' : 'ia';
    sessionStorage.setItem('variante-demo', variante);
  }
  if (variante === 'tradicional') {
    document.querySelector('#asunto-mensaje').textContent = 'Revisión de actividad de tu cuenta académica';
    document.querySelector('#demo-asunto').textContent = 'Revisión de actividad de tu cuenta académica';
    document.querySelector('#texto-mensaje').textContent = 'Se registro un acceso desde un dispossitivo diferente al habitual. Te invitamos a revisar la actividad para comprobar si reconoces ese acceso por favor.';
    document.querySelector('#firma-mensaje').textContent = 'Equipo del campus de práctica, gracias desde ya.';
  }
  document.querySelector('.message-card').hidden = false;
  registrarEvento('vista').catch(() => { estadoDemo.textContent = 'No se pudo registrar la vista. Comprobá la conexión antes de continuar.'; });
  // También se ejecuta al volver con Atrás desde la caché del navegador.
  window.addEventListener('pageshow', () => {
    botonRevisar.disabled = false;
    estadoDemo.textContent = '';
  });
  botonRevisar.addEventListener('click', async () => {
    botonRevisar.disabled = true;
    estadoDemo.textContent = 'Registrando el clic…';
    try {
      await registrarEvento('clic');
      sessionStorage.setItem('clic-demo-registrado', '1');
      location.assign('/demo-restablecer.html');
    } catch (error) {
      estadoDemo.textContent = `${error.message} Intentá de nuevo.`;
      botonRevisar.disabled = false;
    }
  });
}

const botonIntentar = document.querySelector('#intentar-restablecer');
const formularioOpinion = document.querySelector('#formulario-opinion');
if (formularioOpinion) {
  formularioOpinion.addEventListener('change', (evento) => {
    if (evento.target.name !== 'opinion') return;
    document.querySelector('#etiqueta-motivo').textContent = evento.target.value === 'ia'
      ? '2. ¿Qué detalles te hicieron pensar que el mensaje fue elaborado con IA?'
      : '2. ¿Qué detalles te hicieron pensar que el mensaje fue elaborado de forma tradicional?';
  });
  formularioOpinion.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = formularioOpinion.querySelector('button');
    if (boton.disabled || !formularioOpinion.reportValidity()) return;
    const estado = document.querySelector('#estado-opinion');
    const datosOpinion = new FormData(formularioOpinion);
    const motivos = datosOpinion.getAll('motivos');
    if (!motivos.length) {
      estado.textContent = 'Marcá al menos una razón para guardar tu respuesta.';
      formularioOpinion.querySelector('[name="motivos"]').focus();
      return;
    }
    boton.disabled = true;
    estado.textContent = 'Guardando respuesta…';
    try {
      const encuesta = Object.fromEntries(['realismo','credibilidad','accion','preparacion'].map(id => [id,datosOpinion.get(id)]));
      const respuesta = await fetch('/api/demo-opinion', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sesionId,opinion:datosOpinion.get('opinion'),motivos,encuesta}) });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo guardar la respuesta.');
      estado.textContent = '¡Gracias! Tu respuesta quedó registrada.';
      formularioOpinion.querySelector('fieldset').disabled = true;
    } catch (error) { estado.textContent = error.message; boton.disabled = false; }
  });
}
if (botonIntentar) {
  const variante = sessionStorage.getItem('variante-demo');
  const varianteValida = ['tradicional', 'ia'].includes(variante);
  const volver = document.querySelector('a[href="/demo.html"]');
  if (volver) volver.href = '/demo.html';
  const modal = document.querySelector('#modal-datos');
  const formulario = document.querySelector('#formulario-demo');
  const estadoEnvio = document.querySelector('#estado-envio');
  const enviar = document.querySelector('#enviar-participacion');
  const cerrarModal = document.querySelector('#cerrar-modal');
  let enviando = false;
  let modoParticipacion = null;
  enviar.disabled = true;
  fetch('/api/configuracion', {cache:'no-store'}).then(async respuesta => {
    if (!respuesta.ok) throw new Error('No se pudo cargar la información del estudio. Recargá la página.');
    const config = await respuesta.json();
    if (!['database','email'].includes(config.modoParticipacion)) throw new Error('Configuración de participación no válida.');
    modoParticipacion = config.modoParticipacion;
    const destino = modoParticipacion === 'database'
      ? 'se guardarán en la base de datos del estudio y podrán ser consultados por su administrador'
      : 'se enviarán al correo del administrador del estudio';
    document.querySelector('#aviso-modal').textContent = 'Actividad académica voluntaria. Si aceptás, tu nombre y apellido ' + destino + ' para identificar tu participación. Podés cerrar con la X o Escape sin enviar datos.';
    document.querySelector('#texto-consentimiento').textContent = modoParticipacion === 'database'
      ? 'Acepto que mi nombre y apellido se guarden en la base de datos del estudio para identificar mi participación y sean consultados por su administrador.'
      : 'Acepto enviar mi nombre y apellido al correo del administrador del estudio para identificar mi participación.';
    enviar.disabled = false;
  }).catch(error => { estadoEnvio.textContent=error.message; });
  cerrarModal.addEventListener('click', () => {
    if (!enviando) modal.close('cancelar');
  });
  modal.addEventListener('cancel', (evento) => {
    if (enviando) evento.preventDefault();
  });
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando || !modoParticipacion || !formulario.reportValidity()) return;
    if (!varianteValida) {
      estadoEnvio.textContent = 'Volvé al mensaje y pulsá Revisar actividad para identificar la versión.';
      return;
    }
    enviando = true;
    enviar.disabled = true;
    cerrarModal.disabled = true;
    estadoEnvio.textContent = 'Enviando los datos autorizados…';
    try {
      const respuesta = await fetch('/api/participacion-voluntaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: document.querySelector('#nombre-demo').value.trim(),
          apellido: document.querySelector('#apellido-demo').value.trim(),
          consentimiento: document.querySelector('#consentimiento-demo').checked,
          variante,
          sesionId,
          destinoConsentido: modoParticipacion,
        }),
      });
      if (!respuesta.headers.get('content-type')?.includes('application/json')) {
        throw new Error(respuesta.status === 404
          ? 'El servidor todavía usa una versión anterior. Reinicialo en VS Code y recargá la página. No se confirmó el registro de los datos.'
          : 'El servidor devolvió una respuesta inesperada. No se pudo confirmar el envío.');
      }
      const datos = await respuesta.json();
      if (!respuesta.ok || !datos.enviado) throw new Error(datos.error || 'No se pudo confirmar el envío.');
      document.querySelector('#resultado-envio').textContent = datos.mensaje || 'Tu participación se registró con tu consentimiento. No se modificó ninguna cuenta.';
      if (datos.advertencia) document.querySelector('#resultado-envio').textContent += ` ${datos.advertencia}`;
      modal.close('continuar');
    } catch (error) {
      estadoEnvio.textContent = error.message;
    } finally {
      enviando = false;
      enviar.disabled = false;
      cerrarModal.disabled = false;
    }
  });
  modal.addEventListener('close', () => {
    if (modal.returnValue === 'continuar') {
      document.querySelector('#explicacion-demo').hidden = false;
      document.querySelector('#titulo-explicacion').focus();
    }
    formulario.reset();
    estadoEnvio.textContent = '';
  });
  if (sessionStorage.getItem('clic-demo-registrado') !== '1') {
    location.replace('/demo.html');
  }
  botonIntentar.addEventListener('click', async () => {
    modal.returnValue = '';
    modal.showModal();
    botonIntentar.disabled = true;
    estadoDemo.textContent = 'Registrando la acción…';
    try {
      await registrarEvento('intento');
      estadoDemo.textContent = 'Acción registrada.';
    } catch (error) {
      estadoDemo.textContent = `${error.message} Intentá de nuevo.`;
    } finally {
      botonIntentar.disabled = false;
    }
  });
}

