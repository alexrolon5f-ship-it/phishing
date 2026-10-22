const { scrypt, timingSafeEqual, randomBytes } = require('node:crypto');
const { promisify } = require('node:util');
const derivar = promisify(scrypt);

function crearProteccion(env = process.env) {
  const intentos = new Map();
  const sesiones = new Map();
  const duracion = 8 * 60 * 60 * 1000;
  const cookieOpciones = (req) => ({ httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production' || req.secure, path: '/' });
  const tokenDe = (req) => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('admin_session='))?.slice(14);
  const mismoOrigen = (req) => !req.headers.origin || req.headers.origin === req.protocol + '://' + req.get('host');
  function proteger(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const token = tokenDe(req);
    if (token && (sesiones.get(token) || 0) > Date.now()) return next();
    if (token) sesiones.delete(token);
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Iniciá sesión para ver los resultados.' });
    return res.redirect('/admin-login.html');
  }
  proteger.login = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!mismoOrigen(req)) return res.status(403).json({ error: 'Origen no permitido.' });
    if (!env.ADMIN_HASH || !env.ADMIN_SALT) return res.status(503).json({ error: 'La cuenta de administrador no está configurada.' });
    const ahora = Date.now();
    for (const [ip, item] of intentos) if (item.hasta <= ahora) intentos.delete(ip);
    for (const [token, hasta] of sesiones) if (hasta <= ahora) sesiones.delete(token);
    const registro = intentos.get(req.ip) || { cantidad: 0, hasta: ahora + 60000 };
    if (registro.cantidad >= 10) return res.status(429).json({ error: 'Esperá un minuto antes de volver a intentar.' });
    registro.cantidad++; intentos.set(req.ip, registro);
    const { usuario, clave } = req.body || {};
    if (typeof usuario !== 'string' || typeof clave !== 'string' || clave.length > 256 || usuario.length > 80) return res.status(400).json({ error: 'Completá usuario y contraseña.' });
    try {
      const hash = await derivar(clave, env.ADMIN_SALT, 64);
      const esperado = Buffer.from(env.ADMIN_HASH, 'hex');
      if (esperado.length !== hash.length || !timingSafeEqual(hash, esperado) || usuario !== (env.ADMIN_USER || 'admin')) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      intentos.delete(req.ip);
      const previo = tokenDe(req); if (previo) sesiones.delete(previo);
      const token = randomBytes(32).toString('hex');
      sesiones.set(token, Date.now() + duracion);
      res.cookie('admin_session', token, { ...cookieOpciones(req), maxAge: duracion });
      return res.json({ ok: true });
    } catch (_) { return res.status(500).json({ error: 'No se pudo iniciar sesión.' }); }
  };
  proteger.logout = (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!mismoOrigen(req)) return res.status(403).json({ error: 'Origen no permitido.' });
    sesiones.delete(tokenDe(req));
    res.clearCookie('admin_session', cookieOpciones(req));
    return res.json({ ok: true });
  };
  return proteger;
}

async function prepararContadores(db) {
  if (db.dialect === 'postgres') {
    const sql = require('node:fs').readFileSync(require('node:path').join(__dirname, 'migrations/postgres.sql'), 'utf8');
    for (const sentencia of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.query(sentencia);
    return;
  }
  await db.query(`CREATE TABLE IF NOT EXISTS sesiones_demo (
    sesion_id CHAR(36) PRIMARY KEY,
    variante ENUM('ia','tradicional') NOT NULL,
    vista TINYINT NOT NULL DEFAULT 0,
    clic TINYINT NOT NULL DEFAULT 0,
    intento TINYINT NOT NULL DEFAULT 0,
    enviado TINYINT NOT NULL DEFAULT 0,
    opinion ENUM('ia','tradicional') NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query("ALTER TABLE sesiones_demo ADD COLUMN IF NOT EXISTS opinion ENUM('ia','tradicional') NULL");
  await db.query("ALTER TABLE sesiones_demo ADD COLUMN IF NOT EXISTS motivo VARCHAR(500) NULL");
  await db.query("ALTER TABLE sesiones_demo ADD COLUMN IF NOT EXISTS motivos TEXT NULL");
  await db.query("ALTER TABLE sesiones_demo ADD COLUMN IF NOT EXISTS encuesta TEXT NULL");
  await db.query(`CREATE TABLE IF NOT EXISTS participaciones (
    sesion_id CHAR(36) PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL, apellido VARCHAR(80) NOT NULL,
    consentimiento_version VARCHAR(30) NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sesion_id) REFERENCES sesiones_demo(sesion_id)
  )`);
}

async function registrarContador(db, sesionId, variante, evento) {
  if (!['vista','clic','intento','enviado'].includes(evento)) throw new Error('Evento inválido');
  await db.execute('INSERT IGNORE INTO sesiones_demo (sesion_id,variante) VALUES (?,?)', [sesionId,variante]);
  const [filas] = await db.execute('SELECT variante FROM sesiones_demo WHERE sesion_id=?', [sesionId]);
  if (filas[0].variante !== variante) throw new Error('La versión de esta sesión no coincide.');
  await db.execute(`UPDATE sesiones_demo SET ${evento}=1 WHERE sesion_id=?`, [sesionId]);
}

module.exports = { crearProteccion, prepararContadores, registrarContador };
