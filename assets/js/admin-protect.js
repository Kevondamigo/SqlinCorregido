// assets/js/admin-protect.js

// 1) Lista de IDs autorizados
const adminVisitorIds = [
  '429149680c8acf62b1b84f82f3e924a0',
  // 'otro-id-más',
];

// 2) Inicializa FingerprintJS
async function initFingerprint() {
  try {
    const fp = await FingerprintJS.load();
    const { visitorId } = await fp.get();
    console.log('%c[initFingerprint] Visitor ID:', 'color: #0b79d0', visitorId);
    localStorage.setItem('visitorId', visitorId);
    return visitorId;
  } catch (err) {
    console.error('[initFingerprint] Error:', err);
    return null;
  }
}

// 3) Comprueba si el visitorId está en tu lista de admins
async function checkIfAdmin() {
  const stored = localStorage.getItem('visitorId');
  const visitorId = stored || await initFingerprint();
  const isAdmin = adminVisitorIds.includes(visitorId);
  console.log('%c[checkIfAdmin] ID comparado:', 'color: #d05f0b', visitorId, '-> isAdmin?', isAdmin);
  localStorage.setItem('isAdmin', isAdmin);
  return isAdmin;
}

// 4) Redirige si NO es admin
async function protectAdminPage() {
  const isAdmin = await checkIfAdmin();
  if (!isAdmin) {
    console.warn('[protectAdminPage] No eres admin, redirigiendo...');
    return window.location.href = 'sistema-prestamos.html';
  }
  console.log('%c[protectAdminPage] Eres admin, bienvenido.', 'color: #0b8d3c');
}

// 5) Muestra/oculta elementos .admin-only
function updateUIByRole() {
  const show = localStorage.getItem('isAdmin') === 'true';
  console.log('[updateUIByRole] Mostrar elementos admin-only?', show);
  document.querySelectorAll('.admin-only')
          .forEach(el => el.style.display = show ? '' : 'none');
}

// 6) Logout
function setupLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) {
    console.log('[setupLogout] No existe #logoutBtn');
    return;
  }
  btn.addEventListener('click', e => {
    e.preventDefault();
    console.log('[setupLogout] Cerrando sesión, limpiando storage');
    localStorage.removeItem('visitorId');
    localStorage.removeItem('isAdmin');
    window.location.reload();
  });
}

// 7) Orquesta todo al cargar
document.addEventListener('DOMContentLoaded', async () => {
  console.log('%c[admin-protect] DOMContentLoaded arrancando...', 'font-weight:bold');
  await initFingerprint();    // Asegura que visitorId esté en localStorage
  await protectAdminPage();   // Redirige si no es admin
  updateUIByRole();           // Muestra el UI admin-only
  setupLogout();              // Engancha logout
  console.log('%c[admin-protect] Setup completo.', 'font-style:italic');
});