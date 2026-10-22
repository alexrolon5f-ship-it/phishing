CREATE DATABASE IF NOT EXISTS phishing_estudio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE phishing_estudio;

CREATE TABLE IF NOT EXISTS respuestas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  mensaje_id VARCHAR(50) NOT NULL,
  clasificacion ENUM('phishing', 'legitimo') NOT NULL,
  confianza TINYINT UNSIGNED NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eventos_demo (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sesion_id CHAR(36) NOT NULL,
  evento ENUM('clic', 'intento') NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY sesion_evento (sesion_id, evento)
);
