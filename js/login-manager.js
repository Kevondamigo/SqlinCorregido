// Script para manejar la redirección basada en fingerprint en sistema-prestamos.html
document.addEventListener('DOMContentLoaded', async () => {
    // Esperar brevemente para asegurar que Firebase Auth esté inicializado
    await new Promise(resolve => setTimeout(resolve, 1000));

    const isAdmin = await checkIfAdmin();
    
    // Verificar el estado de autenticación actual
    const currentUser = firebase.auth().currentUser;
    let isValidAuth = false;

    if (currentUser) {
        try {
            await currentUser.getIdToken(true);
            isValidAuth = true;
        } catch (error) {
            console.error('Error validating token:', error);
        }
    }

    if (isAdmin) {
        // Si es admin, redirigir directamente a la página de administración
        window.location.href = 'lista-prestamos.html';
    } else if (isValidAuth) {
        // Si ya está autenticado, redirigir a la página de préstamos
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('userEmail', currentUser.email);
        window.location.href = 'prestamos.html';
    } else {
        // Si no está autenticado, mostrar la interfaz de login
        document.querySelector('.section').style.display = 'block';
        
        // Configurar listener de autenticación
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    await user.getIdToken(true);
                    sessionStorage.setItem('isAuthenticated', 'true');
                    sessionStorage.setItem('userEmail', user.email);
                    window.location.href = 'prestamos.html';
                } catch (error) {
                    console.error('Error validating token after login:', error);
                }
            }
        });
    }
});
