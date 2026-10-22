const mysql = require('mysql2/promise');
const { Pool } = require('pg');

// Los placeholders '?' se usan solo en consultas internas parametrizadas.
function sqlPostgres(sql) {
  let posicion = 0;
  let texto = sql.replace(/\?/g, () => '$' + (++posicion));
  if (/^INSERT IGNORE INTO/i.test(texto.trim())) {
    texto = texto.replace(/INSERT IGNORE INTO/i, 'INSERT INTO') + ' ON CONFLICT DO NOTHING';
  }
  if (/^INSERT INTO respuestas\s/i.test(texto.trim())) texto += ' RETURNING id';
  return texto;
}
function adaptarPostgres(cliente) {
  const consulta = async (sql, valores = []) => {
    const resultado = await cliente.query(sqlPostgres(sql), valores);
    if (/^\s*(SELECT|WITH)/i.test(sql)) return [resultado.rows];
    return [{ affectedRows: resultado.rowCount ?? resultado.affectedRows ?? 0, insertId: resultado.rows?.[0]?.id }];
  };
  return { dialect: 'postgres', query: consulta, execute: consulta };
}
function crearBase(env = process.env) {
  if (env.DATABASE_URL) {
    const url = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL debe ser una conexión PostgreSQL.');
    if (env.NODE_ENV === 'production') {
      // Conserva la validación del certificado y nombre del servidor.
      url.searchParams.set('sslmode', 'verify-full');
    }
    const pool = new Pool({ connectionString: url.toString(), max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000 });
    pool.on('error', () => console.error('Se interrumpió una conexión inactiva con la base de datos.'));
    const db = adaptarPostgres(pool);
    db.end = () => pool.end();
    db.transaction = async (operacion) => {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await operacion(adaptarPostgres(cliente));
        await cliente.query('COMMIT');
        return resultado;
      } catch (error) { await cliente.query('ROLLBACK'); throw error; }
      finally { cliente.release(); }
    };
    return db;
  }
  if (env.NODE_ENV === 'production') throw new Error('Falta DATABASE_URL para la versión publicada.');
  const pool = mysql.createPool({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER || 'root', password: env.DB_PASSWORD || '', database: env.DB_NAME || 'phishing_estudio', waitForConnections: true, connectionLimit: 5 });
  pool.dialect = 'mysql';
  pool.transaction = async (operacion) => {
    const cliente = await pool.getConnection();
    try { await cliente.beginTransaction(); const resultado = await operacion(cliente); await cliente.commit(); return resultado; }
    catch (error) { await cliente.rollback(); throw error; }
    finally { cliente.release(); }
  };
  return pool;
}
module.exports = { crearBase, adaptarPostgres, sqlPostgres };
