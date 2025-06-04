// Firebase Authentication Utilities
const auth = {
    isRedirecting: false,
    authState: {
        isAuthenticated: false,
        isAdmin: false,
        user: null
    },

    // Verificar si es admin
    async checkIfAdmin() {
        try {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            const visitorId = result.visitorId;
            const adminIds = ['bc05714a6d6450c967d28e560d62aeaa'];
            return adminIds.includes(visitorId);
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    },

    // Obtener nombre amigable del proveedor
    getProviderName(providerId) {
        if (!providerId) return 'método desconocido';
        
        const providers = {
            'password': 'correo y contraseña',
            'google.com': 'Google',
            'microsoft.com': 'Microsoft (cuenta institucional)',
            'github.com': 'GitHub',
            'facebook.com': 'Facebook',
            'apple.com': 'Apple'
        };
        
        // If the provider is in our map, return its friendly name
        if (providers[providerId]) {
            return providers[providerId];
        }
        
        // If not in our map, make the providerId more readable
        return providerId.split('.')[0].charAt(0).toUpperCase() + 
               providerId.split('.')[0].slice(1);
    },

    // Obtener métodos de inicio de sesión para un email
    async getSignInMethodsForEmail(email) {
        if (!email) {
            console.warn('Email no proporcionado para verificar métodos de inicio de sesión');
            return [];
        }

        try {
            const methods = await firebase.auth().fetchSignInMethodsForEmail(email);
            
            // Log available methods for debugging (in development)
            if (location.hostname === 'localhost') {
                console.log('Métodos disponibles para', email, ':', methods);
            }
            
            return methods;
        } catch (error) {
            // Handle specific error cases
            if (error.code === 'auth/invalid-email') {
                console.error('Email inválido:', email);
                return [];
            }
            
            // Log other errors but don't break the flow
            console.error('Error al obtener métodos de inicio de sesión:', error);
            return [];
        }
    },

    // Manejar inicio de sesión con Microsoft
    async handleMicrosoftSignIn() {
        if (this.isRedirecting) return;
        this.isRedirecting = true;

        try {
            // Primero, verificar si el usuario ya ha iniciado sesión
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
                await firebase.auth().signOut();
            }

            const provider = new firebase.auth.OAuthProvider('microsoft.com');
            provider.setCustomParameters({
                tenant: 'common',
                prompt: 'select_account',
                login_hint: '@ulsa.mx'  // Sugerir dominio ULSA
            });

            const result = await firebase.auth().signInWithPopup(provider);
            
            // Verificar si este es un nuevo usuario
            if (result.additionalUserInfo.isNewUser) {
                // Obtener partes del correo del usuario
                const email = result.user.email;
                const matricula = email.split('@')[0];
                
                // Crear registro de usuario en la base de datos
                await firebase.database().ref('alumno/' + matricula).set({
                    matricula: matricula,
                    nombre: result.user.displayName,
                    correo: email,
                    fecha_registro: new Date().toISOString(),
                    provider: 'microsoft.com'
                });
            }
            
            return result;
        } catch (error) {
            if (error.code === 'auth/account-exists-with-different-credential') {
                const email = error.email;
                const methods = await this.getSignInMethodsForEmail(email);
                
                if (methods && methods.length > 0) {
                    const providerName = this.getProviderName(methods[0]);
                    throw new Error(`Esta cuenta ya está registrada con ${providerName}. Por favor usa ese método para iniciar sesión. Si necesitas ayuda, contacta a soporte.`);
                }
                throw new Error('Esta cuenta ya existe con otro método de inicio de sesión. Por favor usa ese método o contacta a soporte si necesitas ayuda.');
            }
            
            // Manejar otros errores comunes
            if (error.code === 'auth/popup-blocked') {
                throw new Error('El navegador bloqueó la ventana emergente. Por favor permite ventanas emergentes para este sitio.');
            } else if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Proceso cancelado. Por favor intenta de nuevo.');
            } else if (error.code === 'auth/cancelled-popup-request') {
                // Este es un caso normal al abrir múltiples ventanas emergentes, podemos ignorarlo
                console.log('Solicitud de ventana emergente cancelada');
                return null;
            }
            
            throw error;
        } finally {
            this.isRedirecting = false;
        }
    },

    // Login con matrícula y contraseña
    async handleLoginWithMatricula(matricula, password) {
        if (this.isRedirecting) return;
        this.isRedirecting = true;

        try {
            const email = `${matricula}@ulsa.mx`;
            
            // Verificar métodos de inicio de sesión disponibles
            const methods = await this.getSignInMethodsForEmail(email);
            
            if (methods.length > 0 && !methods.includes('password')) {
                const providerName = this.getProviderName(methods[0]);
                throw new Error(`Esta cuenta está registrada con ${providerName}. Por favor, usa ese método para iniciar sesión.`);
            }

            const result = await firebase.auth().signInWithEmailAndPassword(email, password);
            return result;
        } catch (error) {
            throw error;
        } finally {
            this.isRedirecting = false;
        }
    },

    // Registro nuevo
    async handleRegister(userData) {
        if (this.isRedirecting) return;
        this.isRedirecting = true;

        try {
            // Verificar métodos de inicio de sesión existentes
            const methods = await this.getSignInMethodsForEmail(userData.correo);
            
            if (methods.length > 0) {
                const providerName = this.getProviderName(methods[0]);
                throw new Error(`Ya existe una cuenta con este correo usando ${providerName}. Por favor, inicia sesión con ese método.`);
            }

            // Verificar matrícula existente
            const matriculaSnapshot = await firebase.database()
                .ref('alumno')
                .orderByChild('matricula')
                .equalTo(userData.matricula)
                .once('value');

            if (matriculaSnapshot.exists()) {
                throw new Error('Esta matrícula ya está registrada');
            }

            // Crear usuario en Firebase Auth
            const authResult = await firebase.auth().createUserWithEmailAndPassword(
                userData.correo,
                userData.password
            );

            // Guardar datos en Realtime Database
            await firebase.database().ref('alumno/' + userData.matricula).set({
                ...userData,
                fecha_registro: new Date().toISOString(),
                provider: 'password'
            });

            return authResult;
        } catch (error) {
            throw error;
        } finally {
            this.isRedirecting = false;
        }
    }
};

// Inicialización y manejo de estado de autenticación
firebase.auth().onAuthStateChanged(async (user) => {
    auth.authState.user = user;
    auth.authState.isAuthenticated = !!user;
    
    if (user && location.hostname !== "localhost") {
        const isAdmin = await auth.checkIfAdmin();
        if (isAdmin) {
            window.location.href = 'lista-prestamos.html';
        } else {
            window.location.href = 'prestamos.html';
        }
    } else if (requiresAuth() && location.hostname !== "localhost") {
        window.location.href = 'sistema-prestamos.html';
    }
});

// Verificar si la ruta requiere autenticación
function requiresAuth() {
    const path = window.location.pathname;
    const protectedPages = [
        'prestamos.html',
        'lista-prestamos.html',
        'lista-adeudos.html',
        'adeudo.html'
    ];
    return protectedPages.some(page => path.endsWith(page));
}

// Exportar auth para uso global
window.auth = auth;
