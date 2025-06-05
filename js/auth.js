// Firebase Authentication Utilities
const auth = {
    isRedirecting: false,
    authInitialized: false,
    
    // Central auth state object
    authState: {
        isAuthenticated: false,
        isAdmin: false,
        user: null,
        initialized: false
    },

    // Initialize auth system
    async initialize() {
        if (this.authInitialized) return;
        
        try {
            // Wait for Firebase to be ready
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Firebase Auth not available');
            }

            // Set up persistence
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            
            // Setup auth state listener
            firebase.auth().onAuthStateChanged(async (user) => {
                this.authState.user = user;
                this.authState.isAuthenticated = !!user;
                this.authState.initialized = true;
                
                if (user) {
                    // Update user state in sessionStorage
                    sessionStorage.setItem('isAuthenticated', 'true');
                    sessionStorage.setItem('userEmail', user.email);
                    
                    // Check admin status
                    this.authState.isAdmin = await this.checkIfAdmin();
                } else {
                    // Clear session storage
                    sessionStorage.removeItem('isAuthenticated');
                    sessionStorage.removeItem('userEmail');
                    this.authState.isAdmin = false;
                }
            });

            this.authInitialized = true;
        } catch (error) {
            console.error('Auth initialization error:', error);
            throw error;
        }
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
    },    // Manejar inicio de sesión con Microsoft
    async handleMicrosoftSignIn() {
        // Prevent multiple concurrent sign-in attempts
        if (this.isRedirecting) {
            console.log('Sign-in already in progress');
            return;
        }

        // Ensure auth is initialized
        if (!this.authInitialized) {
            await this.initialize();
        }

        this.isRedirecting = true;

        try {
            if (!firebase.auth) {
                throw new Error('Firebase Auth not initialized');
            }

            // Configure Microsoft provider
            const provider = new firebase.auth.OAuthProvider('microsoft.com');
            provider.setCustomParameters({
                tenant: 'common',
                prompt: 'select_account',
                login_hint: '@ulsa.mx',
                scopes: ['User.Read', 'profile', 'email']
            });

            // Configurar persistencia local primero
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

            // Usar signInWithPopup
            const result = await firebase.auth().signInWithPopup(provider);
            
            // Actualizar estado de autenticación
            this.authState.isAuthenticated = true;
            this.authState.user = result.user;
            
            // Guardar el estado de autenticación en sessionStorage y localStorage
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('userEmail', result.user.email);
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('userEmail', result.user.email);

            const email = result.user.email;
            const matricula = email.split('@')[0];
            
            // Verificar si el alumno ya existe en la base de datos
            const alumnoRef = firebase.database().ref('alumno/' + matricula);
            const snapshot = await alumnoRef.once('value');
            
            if (!snapshot.exists()) {
                // Si no existe, crear el registro
                await alumnoRef.set({
                    matricula: matricula,
                    nombre: result.user.displayName,
                    correo: email,
                    fecha_registro: new Date().toISOString(),
                    provider: 'microsoft.com',
                    ultimo_acceso: new Date().toISOString(),
                    id_microsoft: result.user.uid,
                    foto_perfil: result.user.photoURL || null
                });
            } else {
                // Si existe, actualizar último acceso
                await alumnoRef.update({
                    ultimo_acceso: new Date().toISOString(),
                    nombre: result.user.displayName,
                    foto_perfil: result.user.photoURL || null
                });
            }

            return result;
        } catch (error) {
            console.error('Error en inicio de sesión Microsoft:', error);
            
            // Limpiar estados de autenticación en caso de error
            sessionStorage.removeItem('isAuthenticated');
            localStorage.removeItem('isAuthenticated');
            this.authState.isAuthenticated = false;
            this.authState.user = null;
            
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
    },
    
    // Verificar el estado de autenticación
    async checkAuthState() {
        // Ensure auth is initialized
        if (!this.authInitialized) {
            await this.initialize();
        }
        
        // Return current user state if already initialized
        if (this.authState.initialized) {
            return this.authState;
        }
        
        // Wait for auth state to be determined
        return new Promise((resolve) => {
            const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
                unsubscribe(); // Remove listener after first response
                
                this.authState.user = user;
                this.authState.isAuthenticated = !!user;
                this.authState.initialized = true;
                
                if (user) {
                    sessionStorage.setItem('isAuthenticated', 'true');
                    sessionStorage.setItem('userEmail', user.email);
                    
                    // Update user info in database
                    const matricula = user.email.split('@')[0];
                    const alumnoRef = firebase.database().ref('alumno/' + matricula);
                    
                    try {
                        const snapshot = await alumnoRef.once('value');
                        if (!snapshot.exists()) {
                            // Create new user record
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
                                ultimo_acceso: new Date().toISOString(),
                                nombre: user.displayName,
                                foto_perfil: user.photoURL || null
                            });
                        }
                    } catch (error) {
                        console.error('Error al verificar/actualizar datos del alumno:', error);
                    }
                }
                resolve(user);
            });
        });
    }
};

// Inicialización y manejo de estado de autenticación
let authInitialized = false;

firebase.auth().onAuthStateChanged(async (user) => {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
    
    // Update auth state
    auth.authState.user = user;
    auth.authState.isAuthenticated = !!user;
    
    // Handle first initialization
    if (!authInitialized) {
        authInitialized = true;
        console.log('First auth initialization completed');
        
        if (user) {
            try {
                // Verificar si el usuario existe en la base de datos
                const matricula = user.email.split('@')[0];
                const alumnoRef = firebase.database().ref('alumno/' + matricula);
                const snapshot = await alumnoRef.once('value');
                
                if (!snapshot.exists()) {
                    // Si no existe, crear el registro
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
                }

                // Verificar si es admin y redirigir
                if (location.hostname !== "localhost") {
                    const isAdmin = await auth.checkIfAdmin();
                    if (isAdmin) {
                        window.location.href = 'lista-prestamos.html';
                    } else {
                        window.location.href = 'prestamos.html';
                    }
                }
            } catch (error) {
                console.error('Error en la verificación de autenticación:', error);
                sessionStorage.removeItem('isAuthenticated');
                if (location.hostname !== "localhost") {
                    window.location.href = 'sistema-prestamos.html';
                }
            }
        } else if (requiresAuth() && location.hostname !== "localhost") {
            window.location.href = 'sistema-prestamos.html';
        }    }
});

// Exportar auth para uso global
window.auth = auth;
