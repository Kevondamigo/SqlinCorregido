// La lógica de autenticación se ha movido a auth.js

// Inicialización de Firebase Auth
document.addEventListener('DOMContentLoaded', () => {
    // Configurar persistencia local
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch(error => {
            console.error('Error setting persistence:', error);
        });
});
