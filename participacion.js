function crearManejadorParticipacion(db) {
  return async (req, res) => {
    const { nombre, apellido, consentimiento, sesionId, variante, destinoConsentido } = req.body || {};
    const valido = valor => typeof valor === 'string' && valor.trim().length > 0 && valor.length <= 80 && !/[\r\n\x00-\x1f\x7f]/.test(valor);
    if (!valido(nombre) || !valido(apellido) || consentimiento !== true || destinoConsentido !== 'database') return res.status(400).json({error:'Aceptá el guardado de nombre y apellido en la base de datos del estudio.'});
    try {
      await db.transaction(async tx => {
        const [filas] = await tx.execute('SELECT variante FROM sesiones_demo WHERE sesion_id=? FOR UPDATE', [sesionId]);
        if (!filas.length || filas[0].variante !== variante) throw new Error('Sesión no válida');
        await tx.execute('INSERT IGNORE INTO participaciones (sesion_id,nombre,apellido,consentimiento_version) VALUES (?,?,?,?)', [sesionId,nombre.trim(),apellido.trim(),'database-v1']);
        await tx.execute('UPDATE sesiones_demo SET enviado=1 WHERE sesion_id=?', [sesionId]);
      });
      return res.json({enviado:true, guardado:true, mensaje:'Tu participación se guardó en la base de datos del estudio con tu consentimiento. No se envió ningún correo ni se modificó ninguna cuenta.'});
    } catch (_) { return res.status(503).json({error:'No se pudo guardar la participación. Intentá nuevamente.'}); }
  };
}
module.exports = { crearManejadorParticipacion };
