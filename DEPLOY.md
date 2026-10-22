# Publicación con Render y Neon

1. Creá un proyecto PostgreSQL en Neon y copiá su cadena de conexión desde Connect directamente a las variables privadas de Render.
2. En Render, creá un Web Service conectado a este repositorio. Usá Node, rama main, directorio raíz vacío, build `npm ci --omit=dev`, start `npm start` e instancia Free.
3. Configurá estas ocho variables en Environment:

| Nombre | Valor |
| --- | --- |
| NODE_ENV | production |
| NODE_VERSION | 24 |
| TRUST_PROXY | 1 |
| PARTICIPATION_MODE | database |
| DATABASE_URL | Conexión PostgreSQL de Neon, sin comando psql ni comillas |
| ADMIN_USER | admin |
| ADMIN_SALT | Valor generado localmente |
| ADMIN_HASH | Valor generado localmente |

Para generar las credenciales administrativas, ejecutá `npm run setup-cloud-admin`. El archivo privado `.local-backups/acceso-render.txt` contiene la contraseña del panel y los valores ADMIN_SALT/ADMIN_HASH. No se sube a GitHub. La contraseña del panel no es una variable de entorno.

4. Configurá el health check `/healthz`, desplegá y esperá a que Render indique que está activo.
5. Abrí `/demo.html` en la dirección HTTPS asignada por Render. El panel está en `/admin-login.html`.

La nube guarda las participaciones consentidas en PostgreSQL y las muestra en el panel privado; no envía correos. La base empieza vacía y no copia los participantes de XAMPP. Las sesiones administrativas se pierden al reiniciar el proceso; los registros de PostgreSQL permanecen.

No publiques archivos .env, cadenas de conexión, archivos privados de acceso ni datos de participantes. Si una credencial se divulga, reemplazala en el proveedor y actualizá Render.

Las pruebas `npm test` usan PostgreSQL en memoria y correo simulado, sin enviar mensajes ni conectarse a Neon.

## Notificaciones por correo

Para conservar el registro y enviar nombre/apellido y variante al administrador, cambiá PARTICIPATION_MODE a `database_email` y agregá RESEND_API_KEY y NOTIFICATION_TO en Render. RESEND_FROM es opcional; por defecto es `onboarding@resend.dev`, limitado a pruebas hacia el correo de la propia cuenta Resend. Para otros destinatarios o un remitente propio, verificá un dominio en Resend y configurá RESEND_FROM. No uses una contraseña Gmail como API key.

El formulario informa que los datos se guardan y se envían por correo. Los registros anteriores que solo autorizaron almacenamiento no se envían. La aceptación del proveedor no garantiza entrega en la bandeja de entrada. Si falla el envío, los datos permanecen en el panel y el formulario informa el fallo. La clave de idempotencia del proveedor y el identificador guardado evitan duplicados en reintentos normales. Las seis preguntas siguen disponibles en el panel; el correo contiene nombre, apellido y variante.

Documentación: [Render Web Services](https://render.com/docs/web-services), [condiciones del plan gratuito](https://render.com/docs/free), [conexiones de Neon](https://neon.com/docs/connect/connect-from-any-app).
