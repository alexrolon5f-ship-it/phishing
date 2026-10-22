async function cargarResultados() {
  try {
    const respuesta = await fetch('/api/demo-resumen');
    if (!respuesta.ok) throw new Error('No se pudieron cargar los conteos.');
    const datos = await respuesta.json();
    document.querySelector('#total-clics').textContent = datos.clics;
    document.querySelector('#total-intentos').textContent = datos.intentos;
  } catch (error) {
    document.querySelector('#estado-resultados').textContent = error.message;
  }
}

cargarResultados();
