// Page de connexion : envoie le code au serveur, qui pose un cookie de session.
const form = document.getElementById('login');
const error = document.getElementById('error');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  error.textContent = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: form.code.value }),
    });
    if (res.ok) return location.replace('/');
    error.textContent = res.status === 401 ? 'Code incorrect.' : 'Erreur du serveur, réessaie.';
    form.code.value = '';
    form.code.focus();
  } catch {
    error.textContent = 'Pas de connexion internet.';
  } finally {
    button.disabled = false;
  }
});
