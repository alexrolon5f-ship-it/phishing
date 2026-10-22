# Simulación educativa de phishing

Aplicación de investigación universitaria para comparar dos variantes de un mensaje, registrar interacciones y analizar un cuestionario de seis preguntas. No solicita contraseñas de los participantes. El envío o guardado de nombre y apellido requiere consentimiento.

## Requisitos

- Node.js 24 y npm.
- MariaDB 10.4 o posterior (por ejemplo, XAMPP). Las migraciones usan sintaxis de MariaDB.
- Una cuenta SMTP si se desea probar el envío voluntario de datos.

## Instalación en Windows

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Completá `.env` con la conexión a MariaDB y la configuración SMTP. Este archivo es privado y no se debe subir a GitHub.

Con MariaDB encendido:

```powershell
npm.cmd run setup-db
npm.cmd run setup-admin
npm.cmd start
```

`setup-admin` genera una contraseña aleatoria y la muestra una sola vez. Guardala en un lugar privado. En `.env` se guarda su hash, no la contraseña. Si ya existe una cuenta, el comando no la reemplaza.

- Simulación: http://localhost:3000/demo.html
- Acceso de administrador: http://localhost:3000/admin-login.html
- Vista previa tradicional (sin interacción): http://localhost:3000/demo-tradicional.html

Mantené la terminal abierta mientras uses la aplicación. Apache no es necesario. Para detener Node, presioná Ctrl+C; detené MariaDB desde XAMPP antes de apagar el equipo.

## Funcionamiento y datos

- La versión se asigna al azar con probabilidad del 50 % y se conserva en `sessionStorage`. No garantiza grupos de igual tamaño ni identifica alumnos únicos.
- Los conteos se deduplican por sesión y acción. Se distinguen vistas, clics, apertura del formulario y correos aceptados por SMTP.
- La aceptación SMTP no garantiza la entrega en la bandeja de entrada.
- El cuestionario es voluntario; si se envía, deben responderse sus seis preguntas.
- El dashboard muestra estadísticas agregadas, separado por la versión asignada. Las sesiones del administrador caducan a las ocho horas o al reiniciar Node.
- Las respuestas antiguas se conservan sin atribuirles versiones o preguntas que no tenían registradas.
- En modo `email`, nombre y apellido se envían al destinatario SMTP_TO (o SMTP_USER). En modo `database`, se guardan con consentimiento y se consultan desde el panel privado. La versión de nube usa `database`.
- Las etiquetas IA y Tradicional identifican variantes del estudio. La variante denominada tradicional partió de un borrador asistido por IA y fue editada por el autor; debe documentarse esa procedencia en la metodología.

La actividad y el uso del nombre/logo institucional deben ajustarse a la autorización del estudio. Las páginas conservan avisos de simulación y consentimiento.

## Pruebas

```powershell
npm.cmd test
```

Las pruebas de correo usan un transporte simulado y no envían correos reales.

## GitHub y publicación

GitHub almacena el código; GitHub Pages no ejecuta este backend. La configuración incluida usa Render para Node y Neon para PostgreSQL. Consultá [DEPLOY.md](DEPLOY.md). Las tablas PostgreSQL se crean al iniciar; no se transfieren datos locales. XAMPP sigue disponible para uso local.

No publiques `.env`, contraseñas, bases de datos exportadas, datos de participantes ni `.local-backups/`. El repositorio incluye `.env.example` con campos vacíos.
