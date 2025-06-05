// Verificación de autenticación específica para prestamos.html
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Starting auth verification...');
    
    // Ensure Firebase is initialized
    if (!firebase.apps.length) {
        console.error('Firebase not initialized');
        return;
    }

    // Esperar a que auth.js esté inicializado
    await new Promise(resolve => {
        if (window.auth) {
            resolve();
        } else {
            const checkAuth = setInterval(() => {
                if (window.auth) {
                    clearInterval(checkAuth);
                    resolve();
                }
            }, 100);
        }
    });

    // Ocultar contenido inicialmente con opacity para una transición suave
    document.body.style.opacity = '0';

    try {
        // Esperar a que Firebase se inicialice
        await new Promise((resolve) => {
            const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                unsubscribe();
                resolve(user);
            });
        });

        const user = firebase.auth().currentUser;
        const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';

        if (!user || !isAuthenticated) {
            window.location.href = 'sistema-prestamos.html';
            return;
        }

        // Verificar que el usuario existe en la base de datos
        const matricula = user.email.split('@')[0];
        const alumnoRef = firebase.database().ref('alumno/' + matricula);
        const snapshot = await alumnoRef.once('value');

        if (!snapshot.exists()) {
            // Si no existe en la base de datos, crear el registro
            await alumnoRef.set({
                matricula: matricula,
                nombre: user.displayName,
                correo: user.email,
                fecha_registro: new Date().toISOString(),
                provider: user.providerData[0]?.providerId || 'microsoft.com',
                ultimo_acceso: new Date().toISOString(),
                id_microsoft: user.uid,
                foto_perfil: user.photoURL || null
            });
        } else {
            // Actualizar último acceso
            await alumnoRef.update({
                ultimo_acceso: new Date().toISOString()
            });
        }        // Si todo está bien, mostrar el contenido con transición
        document.body.style.opacity = '1';
        
        // Mantener la verificación de sesión activa
        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                // Limpiar estados de autenticación
                sessionStorage.removeItem('isAuthenticated');
                sessionStorage.removeItem('userEmail');
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('userEmail');
                // Redireccionar al login
                window.location.href = 'sistema-prestamos.html';
            } else {
                // Actualizar UI con usuario actual
                window.auth.authState.user = user;
                window.auth.authState.isAuthenticated = true;
                if (typeof updateUI === 'function') {
                    updateUI(user);
                }
            }
        });

    } catch (error) {
        console.error('Error en la verificación:', error);
        window.location.href = 'sistema-prestamos.html';
    }
});
