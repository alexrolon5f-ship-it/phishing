const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, scryptSync } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { adaptarPostgres } = require('./database');
const { prepararContadores } = require('./admin');
const { crearApp } = require('./index');
const { crearManejadorParticipacion } = require('./participacion');
const { configurarCorreoHttp } = require('./correo-http');

test('Correo HTTPS: destino fijo, consentimiento, persistencia y sin duplicados', async () => {
  const pg = new PGlite();
  const db = adaptarPostgres(pg);
  db.transaction = fn => pg.transaction(tx => fn(adaptarPostgres(tx)));
  try {
    await prepararContadores(db);
    let llamadas = 0, fallo = false;
    const notificar = configurarCorreoHttp({RESEND_API_KEY:'clave-ficticia',NOTIFICATION_TO:'admin@example.invalid'}, async (url, opts) => {
      llamadas++;
      assert.equal(url,'https://api.resend.com/emails');
      const body = JSON.parse(opts.body);
      assert.deepEqual(body.to,['admin@example.invalid']);
      assert.match(body.subject,/IA|Tradicional/);
      assert.match(body.text,/Nombre: Persona/);
      assert.match(opts.headers['Idempotency-Key'],/^participacion\//);
      return {ok:!fallo,status:fallo?429:200,json:async()=>({id:'correo-ficticio'})};
    });
    const handler = crearManejadorParticipacion(db,{modo:'database_email',notificar});
    const ejecutar = async body => {
      const res={code:200,status(c){this.code=c;return this},json(data){this.data=data;return this}};
      await handler({body},res); return res;
    };
    const sesionId=randomUUID();
    await db.execute('INSERT INTO sesiones_demo (sesion_id,variante) VALUES (?,?)',[sesionId,'ia']);
    const body={sesionId,variante:'ia',nombre:'Persona',apellido:'Ficticia',consentimiento:true,destinoConsentido:'database_email'};
    assert.equal((await ejecutar({...body,destinoConsentido:'database'})).code,400);
    assert.equal(llamadas,0);
    fallo=true;
    assert.equal((await ejecutar(body)).code,502);
    assert.equal((await db.query('SELECT * FROM participaciones'))[0].length,1);
    fallo=false;
    assert.equal((await ejecutar(body)).code,200);
    assert.equal((await ejecutar(body)).code,200);
    assert.equal(llamadas,2);
    const anterior=randomUUID();
    await db.execute('INSERT INTO sesiones_demo (sesion_id,variante) VALUES (?,?)',[anterior,'ia']);
    await db.execute('INSERT INTO participaciones (sesion_id,nombre,apellido,consentimiento_version) VALUES (?,?,?,?)',[anterior,'Persona','Ficticia','database-v1']);
    assert.equal((await ejecutar({...body,sesionId:anterior})).code,502);
    assert.equal(llamadas,2);
  } finally {await pg.close();}
});

test('PostgreSQL: recorrido completo sin SMTP, privacidad, duplicados y seis preguntas', async () => {
  const pg = new PGlite();
  const db = adaptarPostgres(pg);
  db.transaction = fn => pg.transaction(tx => fn(adaptarPostgres(tx)));
  let server;
  try {
    await prepararContadores(db);
    await prepararContadores(db);
    const env = { NODE_ENV:'production', TRUST_PROXY:'1', PARTICIPATION_MODE:'database', ADMIN_USER:'admin', ADMIN_SALT:'sal-de-prueba', ADMIN_HASH:scryptSync('ClaveDePruebas','sal-de-prueba',64).toString('hex') };
    const app = crearApp(db,env);
    server = app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const get=(ruta,headers={})=>fetch(base+ruta,{headers:{'X-Forwarded-Proto':'https',...headers},redirect:'manual'});
    const post=(ruta,body,headers={})=>fetch(base+ruta,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-Proto':'https',...headers},body:JSON.stringify(body)});
    assert.equal((await fetch(base+'/healthz')).status,200);
    assert.equal((await fetch(base+'/demo.html')).status,400);
    assert.deepEqual(await (await get('/api/configuracion')).json(),{modoParticipacion:'database'});
    for (const ruta of ['/api/admin/resumen','/api/admin/participaciones','/api/demo-resumen']) assert.equal((await get(ruta)).status,401);
    const encuesta={realismo:'acuerdo',credibilidad:'poco',accion:'oficial',preparacion:'bastante'};
    for (const variante of ['ia','tradicional']) {
      const sesionId=randomUUID();
      for (const evento of ['vista','vista','clic','intento']) assert.ok((await post('/api/demo-eventos',{sesionId,variante,evento})).ok);
      const body={sesionId,variante,nombre:'Persona',apellido:'Ficticia',consentimiento:true,destinoConsentido:'database'};
      assert.equal((await post('/api/participacion-voluntaria',{...body,consentimiento:false})).status,400);
      assert.equal((await post('/api/participacion-voluntaria',{...body,destinoConsentido:'email'})).status,400);
      const [antes]=await db.query('SELECT COUNT(*) n FROM participaciones WHERE sesion_id=?',[sesionId]);assert.equal(Number(antes[0].n),0);
      assert.equal((await post('/api/demo-opinion',{sesionId,opinion:'ia',motivos:['tono'],encuesta})).status,409);
      for(let i=0;i<2;i++){const result=await post('/api/participacion-voluntaria',body);assert.equal(result.status,200);assert.equal((await result.json()).guardado,true);}
      assert.equal((await post('/api/demo-opinion',{sesionId,opinion:'ia',motivos:['tono'],encuesta:{}})).status,400);
      assert.equal((await post('/api/demo-opinion',{sesionId,opinion:'ia',motivos:['tono','ortografia'],encuesta})).status,200);
      assert.equal((await post('/api/demo-opinion',{sesionId,opinion:'ia',motivos:['tono'],encuesta})).status,409);
    }
    // Los registros históricos sin esta pregunta no entran en su denominador.
    await db.execute("INSERT INTO sesiones_demo(sesion_id,variante,opinion,encuesta) VALUES (?,'ia','ia',?)",[randomUUID(),JSON.stringify({seguridad:'muy'})]);
    const login=await post('/api/admin/login',{usuario:'admin',clave:'ClaveDePruebas'});
    assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/Secure/);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const resumen=await (await get('/api/admin/resumen',{Cookie:cookie})).json();
    assert.equal(resumen.grupos.reduce((s,g)=>s+Number(g.envios),0),2);
    assert.equal(resumen.cuestionario.length,4);
    for(const p of resumen.cuestionario) assert.equal(p.filas.reduce((s,f)=>s+Number(f.cantidad),0),2);
    assert.equal(resumen.razones.reduce((s,g)=>s+Number(g.tono),0),2);
    const lista=await(await get('/api/admin/participaciones',{Cookie:cookie})).json();assert.equal(lista.total,2);assert.equal(lista.filas[0].nombre,'Persona');
    assert.equal((await post('/api/admin/logout',{}, {Cookie:cookie})).status,200);
    assert.equal((await get('/api/admin/participaciones',{Cookie:cookie})).status,401);
    // Una transacción fallida no deja filas parciales.
    const fallo=randomUUID();
    await assert.rejects(db.transaction(async tx=>{await tx.execute("INSERT INTO sesiones_demo(sesion_id,variante) VALUES (?,'ia')",[fallo]);throw new Error('simulado');}));
    const [rows]=await db.execute('SELECT * FROM sesiones_demo WHERE sesion_id=?',[fallo]);assert.equal(rows.length,0);
  } finally {
    if(server){server.close();server.closeAllConnections();}
    await pg.close();
  }
});
