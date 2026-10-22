const form = document.querySelector('#login');
form.addEventListener('submit', async (event) => {
 event.preventDefault();
 const button = form.querySelector('button');
 if (button.disabled || !form.reportValidity()) return;
 button.disabled = true;
 const status = document.querySelector('#estado-login');
 status.textContent = 'Ingresando…';
 try {
  const response = await fetch('/api/admin/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:document.querySelector('#usuario').value.trim(),clave:document.querySelector('#clave').value})});
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Reiniciá Node para activar la nueva pantalla de acceso.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');
  document.querySelector('#clave').value = '';
  location.replace('/admin.html');
 } catch (error) { status.textContent = error.message; button.disabled = false; }
});
