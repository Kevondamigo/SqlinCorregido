// Script para manejar la redirección basada en fingerprint en sistema-prestamos.html
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkIfAdmin();
    
    if (isAdmin) {
        // Si es admin, redirigir directamente a la página de administración
        window.location.href = 'lista-prestamos.html';
    } else {
        // Si no es admin, mostrar la interfaz de login
        document.querySelector('.section').style.display = 'block';
        
        // Verificar autenticación de Firebase
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                window.location.href = 'prestamos.html';
            }
        });
    }
});
