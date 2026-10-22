function configurarCorreoHttp(env = process.env, fetchImpl = fetch) {
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_TO) return null;
  return async ({sesionId, nombre, apellido, variante}) => {
    const etiqueta = variante === 'ia' ? 'IA' : 'Tradicional';
    const respuesta = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `participacion/${sesionId}`},
      body: JSON.stringify({from: env.RESEND_FROM || 'onboarding@resend.dev', to: [env.NOTIFICATION_TO], subject: `[${etiqueta}] Participación voluntaria en el estudio`, text: `Versión: ${etiqueta}\n\nNombre: ${nombre}\nApellido: ${apellido}`}),
      signal: AbortSignal.timeout(15000),
    });
    if (!respuesta.ok) throw new Error(`Proveedor de correo: HTTP ${respuesta.status}`);
    const resultado = await respuesta.json();
    if (!resultado.id) throw new Error('El proveedor no confirmó el correo');
    return resultado.id;
  };
}
module.exports = {configurarCorreoHttp};
