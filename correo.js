const nodemailer = require('nodemailer');

function crearManejadorCorreo({ enviar, remitente, destinatario, registrarEnvio }) {
  let ventana = Date.now();
  let intentos = 0;
  return async (req, res) => {
    const { nombre, apellido, consentimiento, variante } = req.body ?? {};
    const valido = (valor) => typeof valor === 'string' && valor.trim().length > 0 &&
      valor.length <= 80 && !/[\r\n\x00-\x1f\x7f]/.test(valor);
    if (consentimiento !== true || !valido(nombre) || !valido(apellido)) {
      return res.status(400).json({ error: 'Completá nombre y apellido y aceptá el envío voluntario.' });
    }
    if (!['tradicional', 'ia'].includes(variante)) {
      return res.status(400).json({ error: 'Volvé al mensaje y pulsá Revisar actividad para identificar la versión.' });
    }
    const etiqueta = variante === 'tradicional' ? 'Tradicional' : 'IA';
    if (!enviar || !remitente || !destinatario) {
      return res.status(503).json({ error: 'El administrador todavía debe configurar el correo remitente. No se enviaron los datos.' });
    }
    if (Date.now() - ventana >= 60000) { ventana = Date.now(); intentos = 0; }
    if (intentos >= 10) return res.status(429).json({ error: 'Esperá un minuto antes de volver a enviar.' });
    intentos += 1;
    try {
      const resultado = await enviar({
        from: remitente,
        to: destinatario,
        subject: `[${etiqueta}] Participación voluntaria en la simulación educativa`,
        text: `Versión: ${etiqueta}\n\nNombre: ${nombre.trim()}\nApellido: ${apellido.trim()}`,
      });
      if (!resultado.accepted?.includes(destinatario)) throw new Error('Destinatario no aceptado');
      if (registrarEnvio) {
        try { await registrarEnvio(req.body); }
        catch (_) {
          console.error('Correo aceptado, pero no se pudo actualizar el contador.');
          return res.json({ enviado: true, advertencia: 'El correo fue aceptado, pero no se pudo actualizar el contador. No repitas el envío.' });
        }
      }
      return res.json({ enviado: true, mensaje: 'El servidor de correo aceptó el envío de tu nombre y apellido al administrador del estudio con tu consentimiento. No se modificó ninguna cuenta.' });
    } catch (_error) {
      return res.status(502).json({ error: 'No se pudo confirmar el envío. Consultá al administrador antes de reintentarlo.' });
    }
  };
}

function configurarCorreo(env = process.env) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return {};
  const port = Number(env.SMTP_PORT || 465);
  const transporte = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return { enviar: (mensaje) => transporte.sendMail(mensaje), remitente: env.SMTP_USER, destinatario: env.SMTP_TO || env.SMTP_USER };
}

module.exports = { crearManejadorCorreo, configurarCorreo };
