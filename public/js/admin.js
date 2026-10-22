const estado = document.querySelector('#estado');
const boton = document.querySelector('#actualizar');
let cargando = false;
async function cargar() {
 if (cargando) return;
 cargando = true; boton.disabled = true;
 try {
  const respuesta = await fetch('/api/admin/resumen', { cache: 'no-store' });
  if (respuesta.status === 401) { location.replace('/admin-login.html'); return; }
  if (!respuesta.ok) throw new Error(respuesta.status === 401 ? 'Ingresá de nuevo con tu cuenta de administrador.' : 'No se pudieron cargar los datos. Revisá el servidor y MySQL.');
  const datos = await respuesta.json();
  document.querySelector('#panel-participantes').hidden = !['database','database_email'].includes(datos.modoParticipacion);
  if (['database','database_email'].includes(datos.modoParticipacion)) await cargarParticipantes();
  const cuestionario = document.querySelector('#cuestionario-estadisticas'); cuestionario.replaceChildren();
  const preguntaOrigen = {
   titulo: '1. ¿Creés que este mensaje fue elaborado de forma tradicional o con IA?',
   opciones: {tradicional:'Tradicional',ia:'Con inteligencia artificial'},
   filas: (datos.grupos || []).flatMap(g => [
    {variante:g.variante,respuesta:g.variante,cantidad:Number(g.aciertos)},
    {variante:g.variante,respuesta:g.variante==='ia'?'tradicional':'ia',cantidad:Number(g.respuestas)-Number(g.aciertos)}
   ])
  };
  const preguntaRazones = {
   titulo: '2. ¿Qué detalles te hicieron elegir esa opción?',
   opciones: datos.opcionesMotivos || {},
   base: (datos.razones || []).reduce((s,g)=>s+Number(g.respondieron),0),
   multiple: true,
   filas: (datos.razones || []).flatMap(g => Object.keys(datos.opcionesMotivos || {}).map(id=>({variante:g.variante,respuesta:id,cantidad:Number(g[id] || 0)})))
  };
  for (const pregunta of [preguntaOrigen,preguntaRazones,...(datos.cuestionario || [])]) {
   const seccion=document.createElement('section'); seccion.className='explicacion-item';
   const titulo=document.createElement('h3'); titulo.textContent=pregunta.titulo;
   const base=pregunta.base ?? pregunta.filas.reduce((s,f)=>s+Number(f.cantidad),0);
   const nota=document.createElement('p'); nota.className='muted'; nota.textContent=`Base: ${base} respuestas.${pregunta.multiple ? " Selección múltiple: los porcentajes pueden sumar más de 100 %." : ""}`;
   const contenedor=document.createElement('div'); contenedor.className='table-wrap';
   const tabla=document.createElement('table'); const thead=document.createElement('thead'); const cabecera=document.createElement('tr');
   for(const texto of ['Respuesta','Vieron IA','Vieron tradicional','Total','%']) {const th=document.createElement('th');th.textContent=texto;cabecera.append(th);}
   thead.append(cabecera);tabla.append(thead);const tbody=document.createElement('tbody');
   for(const [valor,etiqueta] of Object.entries(pregunta.opciones)) {
    const cantidad=variante=>Number(pregunta.filas.find(f=>f.respuesta===valor && f.variante===variante)?.cantidad || 0);
    const ia=cantidad('ia'),tradicional=cantidad('tradicional'),total=ia+tradicional;
    const tr=document.createElement('tr');
    for(const contenido of [etiqueta,ia,tradicional,total,base?(100*total/base).toFixed(1)+' %':'—']) {const td=document.createElement('td');td.textContent=contenido;tr.append(td);}
    tbody.append(tr);
   }
   tabla.append(tbody);contenedor.append(tabla);seccion.append(titulo,nota,contenedor);cuestionario.append(seccion);
  }
  const grupos = { ia: {vistas:0,clics:0,intentos:0,envios:0,respuestas:0,aciertos:0}, tradicional: {vistas:0,clics:0,intentos:0,envios:0,respuestas:0,aciertos:0} };
  for (const fila of datos.grupos) if (grupos[fila.variante]) for (const campo of ['vistas','clics','intentos','envios','respuestas','aciertos']) grupos[fila.variante][campo] = Number(fila[campo]);
  document.querySelector('#total').textContent = grupos.ia.envios + grupos.tradicional.envios;
  for (const clave of ['ia','tradicional']) document.querySelector('#'+clave).textContent = grupos[clave].envios;
  const tabla = document.querySelector('#tabla'); tabla.replaceChildren();
  for (const [campo,nombre] of [['vistas','Vieron el mensaje'],['clics','Revisar actividad'],['intentos','Abrieron el formulario'],['envios','Participaciones completadas'],['respuestas','Identificaron una versión'],['aciertos','Acertaron la versión']]) {
   const tr = document.createElement('tr');
   for (const valor of [nombre,grupos.ia[campo],grupos.tradicional[campo],grupos.ia[campo]+grupos.tradicional[campo]]) { const td = document.createElement('td'); td.textContent=valor; tr.append(td); }
   tabla.append(tr);
  }
  const respondieron = grupos.ia.respuestas + grupos.tradicional.respuestas; const acertaron = grupos.ia.aciertos + grupos.tradicional.aciertos; document.querySelector('#precision').textContent = respondieron ? (100*acertaron/respondieron).toFixed(1)+' %' : '—'; document.querySelector('#precision-detalle').textContent = acertaron+' aciertos de '+respondieron+' respuestas';
  const barras = document.querySelector('#barras'); barras.replaceChildren();
  for (const [clave,nombre] of [['ia','IA'],['tradicional','Tradicional']]) {
   const grupo = grupos[clave]; const porcentaje = grupo.vistas ? 100*grupo.envios/grupo.vistas : 0;
   const etiqueta = document.createElement('div'); etiqueta.className='bar-label';
   const titulo = document.createElement('span'); titulo.textContent=nombre;
   const valor = document.createElement('span'); valor.textContent=grupo.vistas ? porcentaje.toFixed(1)+' %' : 'Sin vistas';
   etiqueta.append(titulo,valor);
   const pista = document.createElement('div'); pista.className='track';
   const relleno = document.createElement('div'); relleno.className='fill '+clave; relleno.style.width=Math.min(100,porcentaje)+'%';
   pista.append(relleno); barras.append(etiqueta,pista);
  }
  document.querySelector('#historico').textContent = datos.anteriores ? `${datos.anteriores} sesiones históricas sin versión registrada, excluidas de esta comparación. Los envíos anteriores a este contador no se pueden reconstruir automáticamente.` : 'Los contadores por versión comienzan con esta actualización; no incluyen correos enviados anteriormente.';
  estado.textContent = 'Actualizado: '+new Date(datos.actualizado).toLocaleTimeString('es-PY');
 } catch (error) { estado.textContent=error.message+' Los valores mostrados pueden estar desactualizados.'; }
 finally { cargando=false;boton.disabled=false; }
}
boton.addEventListener('click',cargar);
setTimeout(cargar,0);setInterval(()=>{if (!document.hidden) cargar();},15000);


document.querySelector('#salir').addEventListener('click',async()=>{
 try {
  const res=await fetch('/api/admin/logout',{method:'POST'});
  if (!res.ok) throw new Error('No se pudo cerrar la sesión.');
  location.replace('/admin-login.html');
 } catch(error){estado.textContent=error.message;}
});




let paginaParticipantes=1;
async function cargarParticipantes(){
 const estado=document.querySelector('#estado-participantes');
 try {
  const r=await fetch('/api/admin/participaciones?pagina='+paginaParticipantes,{cache:'no-store'});
  if(r.status===401){location.replace('/admin-login.html');return;}
  if(!r.ok)throw new Error('No se pudieron cargar los participantes.');
  const datos=await r.json();const tabla=document.querySelector('#participantes');tabla.replaceChildren();
  for(const fila of datos.filas){const tr=document.createElement('tr');for(const v of [fila.nombre,fila.apellido,fila.variante==='ia'?'IA':'Tradicional',new Date(fila.fecha).toLocaleString('es-PY')]){const td=document.createElement('td');td.textContent=v;tr.append(td);}tabla.append(tr);}
  const paginas=Math.max(1,Math.ceil(datos.total/50));
  document.querySelector('#pagina-participantes').textContent='Página '+paginaParticipantes+' de '+paginas;
  document.querySelector('#pagina-anterior').disabled=paginaParticipantes<=1;
  document.querySelector('#pagina-siguiente').disabled=paginaParticipantes>=paginas;
  estado.textContent=datos.total ? datos.total+' participaciones registradas.' : 'Todavía no hay participaciones registradas.';
 }catch(error){estado.textContent=error.message;}
}
document.querySelector('#pagina-anterior').addEventListener('click',()=>{if(paginaParticipantes>1){paginaParticipantes--;cargarParticipantes();}});
document.querySelector('#pagina-siguiente').addEventListener('click',()=>{paginaParticipantes++;cargarParticipantes();});
