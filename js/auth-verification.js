// Verificación de autenticación para prestamos.html
document.addEventListener('DOMContentLoaded', async () => {
    // Esperar brevemente para asegurar que Firebase Auth esté inicializado
    await new Promise(resolve => setTimeout(resolve, 1000));

    const checkAuth = async () => {
        // Verificar el estado de autenticación
        const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
        const currentUser = firebase.auth().currentUser;

        // Intentar obtener el token de ID para verificar la autenticación
        let isValidToken = false;
        if (currentUser) {
            try {
                await currentUser.getIdToken(true);
                isValidToken = true;
            } catch (error) {
                console.error('Error validating token:', error);
            }
        }

        if (!isAuthenticated && !isValidToken) {
            // Si no está autenticado, redirigir al login
            sessionStorage.removeItem('isAuthenticated');
            sessionStorage.removeItem('userEmail');
            window.location.href = 'sistema-prestamos.html';
            return;
        }

        // Si está autenticado pero no está en sessionStorage, actualizarlo
        if (!isAuthenticated && isValidToken) {
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('userEmail', currentUser.email);
        }
    };

    // Verificar autenticación inicial
    await checkAuth();

    // Configurar listener de autenticación
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            // Si el usuario se desconecta, redirigir al login
            sessionStorage.removeItem('isAuthenticated');
            sessionStorage.removeItem('userEmail');
            window.location.href = 'sistema-prestamos.html';
        } else {
            // Actualizar sessionStorage cuando el usuario está autenticado
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('userEmail', user.email);
        }
    });
});
