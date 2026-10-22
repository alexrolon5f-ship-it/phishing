const { configurarCorreoHttp } = require('./correo-http');
const express = require('express');
const path = require('node:path');
const { crearBase } = require('./database');
const { crearManejadorParticipacion } = require('./participacion');
const { crearManejadorCorreo, configurarCorreo } = require('./correo');
const { crearProteccion, prepararContadores, registrarContador } = require('./admin');
const preguntasEncuesta = require('./preguntas-encuesta.json');

function crearApp(database, env = process.env) {
const app = express();
const modo = env.PARTICIPATION_MODE || (env.DATABASE_URL ? 'database' : 'email');
if (!['database','database_email','email'].includes(modo)) throw new Error('PARTICIPATION_MODE no válido');
app.disable('x-powered-by');
if (env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use((req,res,next) => {
  res.set('X-Content-Type-Options','nosniff');
  res.set('Referrer-Policy','same-origin');
  res.set('X-Frame-Options','DENY');
  if (req.path.startsWith('/api/')) res.set('Cache-Control','no-store');
  if (env.NODE_ENV === 'production' && !req.secure && req.path !== '/healthz') return res.status(400).send('Usá la dirección HTTPS del sitio.');
  next();
});
app.get('/healthz', async (_req,res) => { try { await database.query('SELECT 1'); res.json({ok:true}); } catch (_) { res.status(503).json({ok:false}); } });
app.get('/api/configuracion', (_req,res) => res.json({ modoParticipacion: modo }));
app.use(express.json({ limit: '4kb' }));
const protegerAdmin = crearProteccion(env);
app.post('/api/admin/login', protegerAdmin.login);
app.post('/api/admin/logout', protegerAdmin.logout);
app.use(['/admin.html', '/demo-resultados.html', '/api/demo-resumen', '/api/admin/resumen', '/api/admin/participaciones'], protegerAdmin);
app.use(express.static(path.join(__dirname, 'public')));
app.post('/api/participacion-voluntaria', async (req, res, next) => {
  if (req.body?.destinoConsentido !== modo) return res.status(400).json({error:'La información sobre el destino de los datos cambió. Recargá la página y revisá el consentimiento.'});
  const { sesionId, variante } = req.body ?? {};
  if (typeof sesionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sesionId)) return res.status(400).json({ error: 'Volvé al mensaje para iniciar la sesión.' });
  try {
    const [filas] = await database.execute('SELECT variante FROM sesiones_demo WHERE sesion_id=?', [sesionId]);
    if (!filas.length || filas[0].variante !== variante) return res.status(400).json({ error: 'Volvé al mensaje y recargá la página para registrar tu sesión.' });
    next();
  } catch (_) { res.status(503).json({ error: 'No se pudo verificar la sesión. Intentá nuevamente.' }); }
}, modo !== 'email' ? crearManejadorParticipacion(database, {modo, notificar: configurarCorreoHttp(env)}) : crearManejadorCorreo({ ...configurarCorreo(env), registrarEnvio: (body) => registrarContador(database, body.sesionId, body.variante, 'enviado') }));

app.post('/api/respuestas', async (request, response) => {
  const { mensajeId, clasificacion, confianza } = request.body ?? {};
  const confianzaNumero = Number(confianza);

  if (
    mensajeId !== 'demo-01' ||
    !['phishing', 'legitimo'].includes(clasificacion) ||
    !Number.isInteger(confianzaNumero) ||
    confianzaNumero < 1 ||
    confianzaNumero > 5
  ) {
    return response.status(400).json({ error: 'Respuesta no válida.' });
  }

  try {
    const [resultado] = await database.execute(
      'INSERT INTO respuestas (mensaje_id, clasificacion, confianza) VALUES (?, ?, ?)',
      [mensajeId, clasificacion, confianzaNumero],
    );
    return response.status(201).json({ id: resultado.insertId });
  } catch (error) {
    console.error('Error al guardar la respuesta:', error);
    return response.status(500).json({ error: 'No se pudo guardar la respuesta.' });
  }
});

app.post('/api/demo-eventos', async (request, response) => {
  const { sesionId, evento, variante } = request.body ?? {};
  if (
    typeof sesionId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sesionId) ||
    !['vista', 'clic', 'intento'].includes(evento) || !['ia', 'tradicional'].includes(variante)
  ) {
    return response.status(400).json({ error: 'Evento no válido.' });
  }

  try {
    await registrarContador(database, sesionId, variante, evento);
    if (evento === 'vista') return response.json({ guardado: true });
    const [resultado] = await database.execute(
      'INSERT IGNORE INTO eventos_demo (sesion_id, evento) VALUES (?, ?)',
      [sesionId, evento],
    );
    return response.status(resultado.affectedRows ? 201 : 200).json({ guardado: true });
  } catch (error) {
    console.error('Error al guardar el evento de la demo:', error);
    return response.status(500).json({ error: 'No se pudo registrar la acción.' });
  }
});

app.get('/api/demo-resumen', async (_request, response) => {
  try {
    const [filas] = await database.query(`
      SELECT
        COUNT(DISTINCT CASE WHEN evento = 'clic' THEN sesion_id END) AS clics,
        COUNT(DISTINCT CASE WHEN evento = 'intento' THEN sesion_id END) AS intentos
      FROM eventos_demo
    `);
    return response.json({
      clics: Number(filas[0].clics),
      intentos: Number(filas[0].intentos),
    });
  } catch (error) {
    console.error('Error al consultar el resumen de la demo:', error);
    return response.status(500).json({ error: 'No se pudo consultar el resumen.' });
  }
});

const opcionesMotivos = { ortografia: 'Ortografía y puntuación', vocabulario: 'Palabras utilizadas', tono: 'Tono o formalidad', estructura: 'Organización del mensaje', detalle: 'Nivel de detalle', intuicion: 'Intuición, sin una señal concreta' };
app.post('/api/demo-opinion', async (req, res) => {
  const { sesionId, opinion, motivos, encuesta } = req.body ?? {};
  if (typeof sesionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sesionId) || !['ia','tradicional'].includes(opinion)) return res.status(400).json({ error: 'Elegí una de las dos opciones.' });
  if (!Array.isArray(motivos) || motivos.length < 1 || motivos.length > 6 || motivos.some(m => typeof m !== 'string' || !Object.hasOwn(opcionesMotivos,m)) || new Set(motivos).size !== motivos.length) return res.status(400).json({ error: 'Marcá al menos una de las razones disponibles, sin repetir opciones.' });
  if (!encuesta || typeof encuesta !== 'object' || Array.isArray(encuesta) || preguntasEncuesta.some(p => typeof encuesta[p.id] !== 'string' || !Object.hasOwn(p.opciones, encuesta[p.id]))) return res.status(400).json({ error: 'Respondé las seis preguntas antes de guardar. Si no aparecen todas, recargá con Ctrl + F5.' });
  const respuestasEncuesta = Object.fromEntries(preguntasEncuesta.map(p => [p.id, encuesta[p.id]]));
  respuestasEncuesta.version = 2;
  try {
    const [resultado] = await database.execute('UPDATE sesiones_demo SET opinion=?, motivos=?, encuesta=? WHERE sesion_id=? AND enviado=1 AND opinion IS NULL', [opinion,JSON.stringify(motivos),JSON.stringify(respuestasEncuesta),sesionId]);
    if (!resultado.affectedRows) return res.status(409).json({ error: 'La respuesta ya fue registrada o todavía no completaste el envío.' });
    res.json({ guardado: true });
  } catch (_) { res.status(503).json({ error: 'No se pudo guardar tu respuesta. Intentá nuevamente.' }); }
});

app.get('/api/admin/resumen', async (_req, res) => {
  try {
    const [grupos] = await database.query(`SELECT variante, SUM(vista) vistas, SUM(clic) clics, SUM(intento) intentos, SUM(enviado) envios, COUNT(opinion) respuestas, SUM(CASE WHEN opinion=variante THEN 1 ELSE 0 END) aciertos FROM sesiones_demo GROUP BY variante`);
    const [anteriores] = await database.query(`SELECT COUNT(DISTINCT e.sesion_id) total FROM eventos_demo e LEFT JOIN sesiones_demo s ON s.sesion_id=e.sesion_id WHERE s.sesion_id IS NULL`);
    const [explicaciones] = await database.query('SELECT variante, opinion, motivo FROM sesiones_demo WHERE opinion IS NOT NULL AND motivo IS NOT NULL ORDER BY fecha DESC, sesion_id DESC LIMIT 100');
    const columnasMotivosMysql = Object.keys(opcionesMotivos).map(m => `SUM(JSON_CONTAINS(motivos, '\"${m}\"')) AS ${m}`).join(', ');
    const columnasMotivos = database.dialect === 'postgres'
      ? Object.keys(opcionesMotivos).map(m => `SUM(CASE WHEN motivos::jsonb @> '["${m}"]'::jsonb THEN 1 ELSE 0 END) AS ${m}`).join(', ')
      : columnasMotivosMysql;
    const [razones] = await database.query(`SELECT variante, COUNT(*) respondieron, ${columnasMotivos} FROM sesiones_demo WHERE opinion IS NOT NULL AND motivos IS NOT NULL GROUP BY variante`);
    const cuestionario = await Promise.all(preguntasEncuesta.map(async pregunta => {
      const [filas] = database.dialect === 'postgres'
        ? await database.execute('SELECT variante, encuesta::jsonb ->> ? AS respuesta, COUNT(*) cantidad FROM sesiones_demo WHERE encuesta IS NOT NULL AND encuesta::jsonb ->> ? IS NOT NULL GROUP BY variante, respuesta', [pregunta.id,pregunta.id])
        : await database.execute('SELECT variante, JSON_UNQUOTE(JSON_EXTRACT(encuesta, ?)) respuesta, COUNT(*) cantidad FROM sesiones_demo WHERE encuesta IS NOT NULL AND JSON_EXTRACT(encuesta, ?) IS NOT NULL GROUP BY variante, respuesta', ['$.'+pregunta.id, '$.'+pregunta.id]);
      return { ...pregunta, filas };
    }));
    res.json({ grupos, explicaciones, razones, opcionesMotivos, cuestionario, modoParticipacion: modo, anteriores: Number(anteriores[0].total), actualizado: new Date().toISOString() });
  } catch (_) { res.status(503).json({ error: 'No se pudieron cargar los contadores. Revisá la conexión con la base de datos.' }); }
});

app.get('/api/admin/participaciones', async (req,res) => {
  const pagina = Math.max(1, Math.min(100000, Number.parseInt(req.query.pagina,10) || 1));
  try {
    const [filas] = await database.execute('SELECT p.nombre,p.apellido,p.fecha,s.variante FROM participaciones p JOIN sesiones_demo s ON s.sesion_id=p.sesion_id ORDER BY p.fecha DESC,p.sesion_id LIMIT 50 OFFSET ?', [(pagina-1)*50]);
    const [cuenta] = await database.query('SELECT COUNT(*) AS total FROM participaciones');
    res.json({filas,pagina,total:Number(cuenta[0].total)});
  } catch (_) {res.status(503).json({error:'No se pudieron consultar las participaciones.'});}
});
return app;
}

async function iniciar() {
  let database;
  try {
    if (process.env.NODE_ENV === 'production' && (!/^[a-f0-9]{128}$/i.test(process.env.ADMIN_HASH || '') || !process.env.ADMIN_SALT)) throw new Error('Configurá ADMIN_HASH y ADMIN_SALT antes de publicar.');
    database = crearBase();
    await database.query('SELECT 1');
    await prepararContadores(database);
    const app = crearApp(database);
    const port = Number(process.env.PORT || 3000);
    const server = app.listen(port,'0.0.0.0',()=>console.log(`Proyecto disponible en http://localhost:${port}`));
    const cerrar = () => { server.close(()=>database.end().then(()=>process.exit(0))); setTimeout(()=>process.exit(1),10000).unref(); };
    process.once('SIGTERM',cerrar); process.once('SIGINT',cerrar);
  } catch (error) {
    console.error('No se pudo iniciar el servidor. Revisá las variables privadas y la conexión con la base de datos.');
    console.error(error.code || 'CONFIGURACION_O_CONEXION');
    process.exitCode=1;
    if(database) await database.end();
  }
}
if(require.main===module) iniciar();
module.exports={crearApp};
