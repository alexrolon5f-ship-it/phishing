const fs = require('node:fs');
const { randomBytes, scryptSync } = require('node:crypto');
if (!fs.existsSync('.env')) {
  console.error('Primero copiá .env.example a .env y configurá la conexión.');
  process.exitCode = 1;
} else {
  let contenido = fs.readFileSync('.env', 'utf8');
  if (/^ADMIN_HASH=\S+/m.test(contenido)) {
    console.log('La cuenta de administrador ya está configurada. Se conservó su contraseña.');
  } else {
    const clave = randomBytes(18).toString('base64url');
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(clave, salt, 64).toString('hex');
    for (const [campo, valor] of Object.entries({ ADMIN_USER: 'admin', ADMIN_SALT: salt, ADMIN_HASH: hash })) {
      const patron = new RegExp('^' + campo + '=.*$', 'm');
      contenido = patron.test(contenido) ? contenido.replace(patron, campo + '=' + valor) : contenido + '\n' + campo + '=' + valor + '\n';
    }
    fs.writeFileSync('.env', contenido);
    console.log('Usuario: admin\nContraseña generada: ' + clave + '\nGuardala en privado. Reiniciá Node si estaba en ejecución.');
  }
}
