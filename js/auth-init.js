// Firebase Auth Initialization Manager

// Global initialization state
let isFirebaseReady = false;
let isAuthReady = false;

// Helper function to wait for Firebase availability
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = 500;
        
        console.log('Waiting for Firebase initialization...');
        
        const checkFirebase = setInterval(() => {
            attempts++;
            if (typeof firebase !== 'undefined' && firebase.app) {
                clearInterval(checkFirebase);
                isFirebaseReady = true;
                console.log('Firebase is available');
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkFirebase);
                const error = new Error('Firebase initialization timeout');
                console.error(error);
                reject(error);
            }
        }, checkInterval);
    });
}

// Helper function to wait for auth completion
function waitForAuth() {
    return new Promise((resolve) => {
        if (isAuthReady) {
            resolve();
            return;
        }
        
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            unsubscribe();
            isAuthReady = true;
            resolve();
        });
    });
}

// Clean up any stale auth states
function cleanupAuthStates() {
    // Reset auth state on login page
    if (window.location.pathname.endsWith('sistema-prestamos.html')) {
        sessionStorage.removeItem('isAuthenticated');
        localStorage.removeItem('isAuthenticated');
        console.log('Auth states cleaned up');
    }
}

// Helper function for retrying operations
async function retryOperation(operation, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Initialize Firebase Auth with proper sequence
async function initializeAuth() {
    if (!isFirebaseReady) {
        await waitForFirebase();
    }
    
    console.log('Starting Firebase Auth initialization...');
    
    try {
        cleanupAuthStates();
        
        // Configure persistence first
        await retryOperation(() => 
            firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        );
        console.log('Auth persistence configured');

        // Initialize the auth state
        if (!window.auth) {
            window.auth = {
                authState: {
                    isAuthenticated: false,
                    user: null
                }
            };
        }

        // Single source of truth for auth state
        const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
            // Update global auth state
            window.auth.authState.isAuthenticated = !!user;
            window.auth.authState.user = user;
            
            // Sync storage state
            if (user) {
                sessionStorage.setItem('isAuthenticated', 'true');
                sessionStorage.setItem('userEmail', user.email);
                
                // Update user data in database if needed
                try {
                    const matricula = user.email.split('@')[0];
                    const userRef = firebase.database().ref(`alumno/${matricula}`);
                    const snapshot = await userRef.once('value');
                    
                    if (!snapshot.exists()) {
                        await userRef.set({
                            matricula: matricula,
                            nombre: user.displayName,
                            correo: user.email,
                            fecha_registro: new Date().toISOString(),
                            provider: user.providerData[0]?.providerId || 'microsoft.com',
                            ultimo_acceso: new Date().toISOString()
                        });
                    } else {
                        await userRef.update({
                            ultimo_acceso: new Date().toISOString()
                        });
                    }
                } catch (dbError) {
                    console.error('Error updating user data:', dbError);
                }
            } else {
                sessionStorage.removeItem('isAuthenticated');
                sessionStorage.removeItem('userEmail');
            }
        });

        // Wait for initial auth state
        await waitForAuth();
        
        // Handle any pending redirect result
        const result = await firebase.auth().getRedirectResult();
        if (result.user) {
            console.log('Redirect sign-in completed');
        }
          console.log('Auth initialization completed');
        return true;
    } catch (error) {
        console.error('Auth initialization error:', error);
        // Clean up on error
        sessionStorage.removeItem('isAuthenticated');
        localStorage.removeItem('isAuthenticated');
        throw error;
    }
}

// Initialize auth when the DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeAuth();
        console.log('Authentication system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize authentication system:', error);
    }
});
