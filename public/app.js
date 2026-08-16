// ── LOGOUT (shared across all pages) ──
async function logout() {
  const token = localStorage.getItem('token');
  if (token) {
    await fetch('/api/logout', {
      method: 'POST',
      headers: { 'Authorization': token }
    });
  }
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.location.href = 'index.html';
}