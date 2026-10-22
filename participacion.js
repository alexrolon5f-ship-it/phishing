function crearManejadorParticipacion(db, {modo = 'database', notificar = null} = {}) {
  return async (req, res) => {
    const { nombre, apellido, consentimiento, sesionId, variante, destinoConsentido } = req.body || {};
    const valido = valor => typeof valor === 'string' && valor.trim().length > 0 && valor.length <= 80 && !/[\r\n\x00-\x1f\x7f]/.test(valor);
    if (!valido(nombre) || !valido(apellido) || consentimiento !== true || destinoConsentido !== modo) return res.status(400).json({error:'Revisá y aceptá el destino de nombre y apellido indicado en el formulario.'});
    if (modo === 'database_email' && !notificar) return res.status(503).json({error:'El administrador debe configurar las notificaciones por correo.'});
    try {
      await db.transaction(async tx => {
        const [filas] = await tx.execute('SELECT variante FROM sesiones_demo WHERE sesion_id=? FOR UPDATE', [sesionId]);
        if (!filas.length || filas[0].variante !== variante) throw new Error('Sesión no válida');
        await tx.execute('INSERT IGNORE INTO participaciones (sesion_id,nombre,apellido,consentimiento_version) VALUES (?,?,?,?)', [sesionId,nombre.trim(),apellido.trim(),modo === 'database_email' ? 'database-email-v1' : 'database-v1']);
        await tx.execute('UPDATE sesiones_demo SET enviado=1 WHERE sesion_id=?', [sesionId]);
      });
    } catch (_) { return res.status(503).json({error:'No se pudo guardar la participación. Intentá nuevamente.'}); }
    if (modo === 'database_email') {
      try {
        await db.transaction(async tx => {
          const [[registro]] = await tx.execute('SELECT nombre,apellido,consentimiento_version,correo_id FROM participaciones WHERE sesion_id=? FOR UPDATE', [sesionId]);
          // No reenviar registros antiguos cuyo consentimiento solo incluía almacenamiento.
          if (registro.consentimiento_version !== 'database-email-v1') throw new Error('Consentimiento anterior');
          if (registro.correo_id) return;
          const correoId = await notificar({sesionId, nombre:registro.nombre, apellido:registro.apellido, variante});
          await tx.execute('UPDATE participaciones SET correo_id=? WHERE sesion_id=?', [correoId,sesionId]);
        });
        return res.json({enviado:true,guardado:true,mensaje:'Tu participación quedó guardada y el proveedor aceptó el correo al administrador. No se modificó ninguna cuenta.'});
      } catch (_) { return res.status(502).json({guardado:true,error:'Tu participación quedó guardada, pero no se confirmó el correo. Consultá al administrador.'}); }
    }
    return res.json({enviado:true, guardado:true, mensaje:'Tu participación se guardó en la base de datos del estudio con tu consentimiento. No se envió ningún correo ni se modificó ninguna cuenta.'});
  };
}
module.exports = { crearManejadorParticipacion };
