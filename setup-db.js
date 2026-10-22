const mysql = require('mysql2/promise');

async function prepararBase() {
  const nombreBase = process.env.DB_NAME || 'phishing_estudio';
  if (!/^[a-zA-Z0-9_]+$/.test(nombreBase)) {
    throw new Error('DB_NAME solo puede contener letras, números y guiones bajos.');
  }

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    await conexion.query(`CREATE DATABASE IF NOT EXISTS \`${nombreBase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conexion.query(`USE \`${nombreBase}\``);
    await conexion.query(`
      CREATE TABLE IF NOT EXISTS respuestas (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        mensaje_id VARCHAR(50) NOT NULL,
        clasificacion ENUM('phishing', 'legitimo') NOT NULL,
        confianza TINYINT UNSIGNED NOT NULL,
        fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conexion.query(`
      CREATE TABLE IF NOT EXISTS eventos_demo (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        sesion_id CHAR(36) NOT NULL,
        evento ENUM('clic', 'intento') NOT NULL,
        fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY sesion_evento (sesion_id, evento)
      )
    `);
    console.log(`Base de datos ${nombreBase} preparada.`);
  } finally {
    await conexion.end();
  }
}

prepararBase().catch((error) => {
  console.error('No se pudo preparar MySQL:', error.message);
  process.exitCode = 1;
});
