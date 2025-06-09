// assets/js/admin-protect.js

// ——————————————————————————————
// 1) Define aquí los visitorId autorizados
// ——————————————————————————————
const adminVisitorIds = [
  '429149680c8acf62b1b84f82f3e924a0',
  // 'otro-id-más',
];

// ——————————————————————————————
// 2) Inicializa FingerprintJS y devuelve el visitorId
// ——————————————————————————————
async function initFingerprint() {
  try {
    const fp = await FingerprintJS.load();
    const { visitorId } = await fp.get();
    localStorage.setItem('visitorId', visitorId);
    console.log('🔑 Visitor ID:', visitorId);
    return visitorId;
  } catch (err) {
    console.error('❌ Error FingerprintJS:', err);
    return null;
  }
}

// ——————————————————————————————
// 3) Comprueba si el visitorId actual está en la lista
// ——————————————————————————————
async function checkIfAdmin() {
  const stored = localStorage.getItem('visitorId');
  const visitorId = stored || await initFingerprint();
  const isAdmin = adminVisitorIds.includes(visitorId);
  localStorage.setItem('isAdmin', isAdmin);
  console.log('👮‍♂️ ¿Es admin?', isAdmin);
  return isAdmin;
}

// ——————————————————————————————
// 4) Redirige si NO es admin
// ——————————————————————————————
async function protectAdminPage() {
  const isAdmin = await checkIfAdmin();
  if (!isAdmin) {
    window.location.href = 'sistema-prestamos.html';
  }
}

// ——————————————————————————————
// 5) Muestra/oculta elementos .admin-only
// ——————————————————————————————
function updateUIByRole() {
  const show = localStorage.getItem('isAdmin') === 'true';
  document.querySelectorAll('.admin-only')
          .forEach(el => el.style.display = show ? '' : 'none');
}

// ——————————————————————————————
// 6) “Cerrar sesión”: borra el visitorId y recarga
// ——————————————————————————————
function setupLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', e => {
    e.preventDefault();
    localStorage.removeItem('visitorId');
    localStorage.removeItem('isAdmin');
    window.location.reload();
  });
}

// ——————————————————————————————
// 7) Al cargar la página, ejecuta la protección
// ——————————————————————————————
document.addEventListener('DOMContentLoaded', async () => {
  await initFingerprint();      // Garantiza que visitorId esté en localStorage
  await protectAdminPage();     // Redirige si no es admin
  updateUIByRole();             // Muestra los .admin-only si es admin
  setupLogout();                // Engancha el botón de logout
});

