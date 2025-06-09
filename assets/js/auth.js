// assets/js/admin-auth.js

// 1) Lista de IDs permitidos (obtén aquí los visitorId de tus admins)
const adminVisitorIds = [
  // 'bc05714a6d6450c967d28e560d62aeaa',
  // agrega más IDs aquí...
  '429149680c8acf62b1b84f82f3e924a0'
];

// 2) Inicializar FingerprintJS y obtener el visitorId
async function initFingerprint() {
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const visitorId = result.visitorId;
    localStorage.setItem('visitorId', visitorId);
    console.log('Visitor ID:', visitorId);
    return visitorId;
  } catch (e) {
    console.error('Fingerprint error:', e);
    return null;
  }
}

// 3) Verificar si es admin
async function isAdmin() {
  const stored = localStorage.getItem('visitorId');
  const visitorId = stored || await initFingerprint();
  return adminVisitorIds.includes(visitorId);
}

// 4) Redirigir si no es admin
async function protectPage() {
  if (!await isAdmin()) {
    window.location.href = 'sistema-prestamos.html'; // tu "login"
  }
}

// 5) Mostrar/ocultar elementos con clase .admin-only
async function updateUIByRole() {
  const show = await isAdmin();
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = show ? '' : 'none';
  });
}

// 6) “Cerrar sesión” — simplemente limpia el visitorId
function logout() {
  localStorage.removeItem('visitorId');
  window.location.reload();
}

// 7) Inicialización al cargar DOM
document.addEventListener('DOMContentLoaded', async () => {
  await initFingerprint();
  protectPage();       // redirige si no es admin
  updateUIByRole();    // oculta enlaces/admin UI
  // enlazamos logoutBtn si existe:
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', e => {
    e.preventDefault();
    logout();
  });
});