const fs=require('node:fs');const crypto=require('node:crypto');
fs.mkdirSync('.local-backups',{recursive:true});
const destino='.local-backups/acceso-render.txt';
if(fs.existsSync(destino)){console.log('Se conservó la configuración privada existente.');}
else {
 const clave=crypto.randomBytes(18).toString('base64url');const salt=crypto.randomBytes(16).toString('hex');const hash=crypto.scryptSync(clave,salt,64).toString('hex');
 fs.writeFileSync(destino,`CONFIGURACIÓN PRIVADA PARA RENDER\nNo subir este archivo a GitHub.\n\nUsuario del panel: admin\nContraseña del panel: ${clave}\n\nVariables para copiar en Render > Environment:\nADMIN_USER=admin\nADMIN_SALT=${salt}\nADMIN_HASH=${hash}\n\nDATABASE_URL: copiar directamente desde Neon a Render. No pegar en el chat ni en GitHub.\n`);
 console.log('Acceso de nube creado en .local-backups/acceso-render.txt. La cuenta local no cambió.');
}
