const test = require('node:test');
const assert = require('node:assert/strict');
const { crearManejadorCorreo, configurarCorreo } = require('./correo');

function respuesta() {
  return { codigo: 200, status(codigo) { this.codigo = codigo; return this; }, json(body) { this.body = body; return this; } };
}
const valido = { nombre: ' Ana ', apellido: ' Pérez ', consentimiento: true, variante: 'ia' };

test('rechaza datos sin consentimiento y nombres vacíos', async () => {
  let llamadas = 0;
  const handler = crearManejadorCorreo({ destinatario: 'admin@example.invalid', enviar: async () => { llamadas += 1; }, remitente: 'demo@example.invalid' });
  for (const body of [{ ...valido, consentimiento: false }, { ...valido, consentimiento: 'true' }, { ...valido, nombre: ' ' }]) {
    const res = respuesta();
    await handler({ body }, res);
    assert.equal(res.codigo, 400);
  }
  assert.equal(llamadas, 0);
});

test('sin SMTP no anuncia un envío exitoso', async () => {
  const res = respuesta();
  await crearManejadorCorreo(configurarCorreo({}))({ body: valido }, res);
  assert.equal(res.codigo, 503);
});

test('envía la versión y los nombres al destinatario fijo para ambas variantes', async () => {
  let mensaje;
  const handler = crearManejadorCorreo({ destinatario: 'admin@example.invalid',
    remitente: 'demo@example.invalid',
    enviar: async (valor) => { mensaje = valor; return { accepted: ['admin@example.invalid'] }; },
  });
  for (const [variante, etiqueta] of [['ia', 'IA'], ['tradicional', 'Tradicional']]) {
    const res = respuesta();
    await handler({ body: { ...valido, variante, to: 'otro@example.invalid', password: 'ignorar' } }, res);
    assert.equal(res.codigo, 200);
    assert.equal(mensaje.to, 'admin@example.invalid');
    assert.equal(mensaje.text, `Versión: ${etiqueta}\n\nNombre: Ana\nApellido: Pérez`);
    assert.ok(mensaje.subject.startsWith(`[${etiqueta}]`));
    assert.equal(res.body.enviado, true);
  }
});

test('rechaza versiones ausentes o desconocidas sin enviar correo', async () => {
  let llamadas = 0;
  const handler = crearManejadorCorreo({ destinatario: 'admin@example.invalid', remitente: 'demo@example.invalid', enviar: async () => { llamadas++; } });
  for (const variante of [undefined, 'otra', 'ia\r\nOtro encabezado']) {
    const res = respuesta();
    await handler({ body: { ...valido, variante } }, res);
    assert.equal(res.codigo, 400);
  }
  assert.equal(llamadas, 0);
});

test('un fallo SMTP no se presenta como éxito', async () => {
  const handler = crearManejadorCorreo({ destinatario: 'admin@example.invalid', remitente: 'demo@example.invalid', enviar: async () => { throw new Error('SMTP'); } });
  const res = respuesta();
  await handler({ body: valido }, res);
  assert.equal(res.codigo, 502);
  assert.equal(res.body.enviado, undefined);
});

test('solo cuenta un correo aceptado y no sugiere reenviar si falla el contador', async () => {
  let contados = 0;
  const exitoso = crearManejadorCorreo({ destinatario: 'admin@example.invalid', remitente: 'demo@example.invalid', enviar: async () => ({accepted:['admin@example.invalid']}), registrarEnvio: async () => { contados++; } });
  await exitoso({body:valido}, respuesta());
  assert.equal(contados, 1);
  const fallido = crearManejadorCorreo({ destinatario: 'admin@example.invalid', remitente: 'demo@example.invalid', enviar: async () => ({accepted:[]}), registrarEnvio: async () => { contados++; } });
  await fallido({body:valido}, respuesta());
  assert.equal(contados, 1);
  const contadorCaido = crearManejadorCorreo({ destinatario: 'admin@example.invalid', remitente: 'demo@example.invalid', enviar: async () => ({accepted:['admin@example.invalid']}), registrarEnvio: async () => { throw new Error('DB'); } });
  const res = respuesta();
  await contadorCaido({body:valido},res);
  assert.equal(res.body.enviado,true);
  assert.ok(res.body.advertencia);
});
