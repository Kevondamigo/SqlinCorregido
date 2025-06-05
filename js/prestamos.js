// UI initialization
let isInitialized = false;
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing prestamos.js...');
    // Ensure body is initially hidden
    document.body.style.opacity = '0';
    
    // Set up auth state listener
    firebase.auth().onAuthStateChanged(user => {
        console.log('Auth state changed:', user ? 'user logged in' : 'no user');
        window.auth.authState.user = user;
        
        if (!isInitialized) {
            isInitialized = true;
            console.log('First time initialization');
        }

        updateUI(user);
        
        if (user) {
            cargarMateriales()
                .then(() => {
                    console.log('Materials loaded successfully');
                    // Show page content with animation once everything is loaded
                    document.body.classList.add('loaded');
                })
                .catch(error => {
                    console.error('Error loading materials:', error);
                    mostrarEstado('Error al cargar materiales: ' + error.message, 'error');
                    // Still show the page even if materials fail to load
                    document.body.classList.add('loaded');
                });
        } else {
            // Show page content even if not authenticated
            document.body.classList.add('loaded');
        }
    }, error => {
        console.error('Auth state observer error:', error);
        mostrarEstado('Error en la autenticación', 'error');
        // Show page even on error
        document.body.classList.add('loaded');
    });
});

// Update UI elements based on auth state
function updateUI(user) {
    if (user) {
        document.getElementById('login').style.display = 'none';
        document.getElementById('userInfo').style.display = 'block';
        document.querySelector('.form-content').style.display = 'block';
        document.getElementById('userName').textContent = user.displayName || user.email;
        document.getElementById('userEmail').textContent = user.email;
    } else {
        document.getElementById('login').style.display = 'block';
        document.getElementById('userInfo').style.display = 'none';
        document.querySelector('.form-content').style.display = 'none';
        document.getElementById('qrContainer').style.display = 'none';
    }
}

// Función para mostrar mensajes de estado
function mostrarEstado(mensaje, tipo) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    statusDiv.textContent = mensaje;
    statusDiv.className = 'status ' + tipo;
    statusDiv.style.display = 'block';

    if (tipo !== 'loading') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Función para cargar materiales desde Firebase
async function cargarMateriales() {
    const selectMaterial = document.getElementById('objeto');
    selectMaterial.innerHTML = '<option value="">Selecciona un material</option>';

    try {
        mostrarEstado('Cargando materiales...', 'loading');
        const materialesRef = firebase.database().ref('materiales');
        const snapshot = await materialesRef.once('value');
        const materiales = snapshot.val();

        if (materiales) {
            Object.entries(materiales).forEach(([id, material]) => {
                if (material.cantidad > 0) { // Solo mostrar materiales disponibles
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = `${material.nombre} (${material.cantidad} disponibles)`;
                    selectMaterial.appendChild(option);
                }
            });
            mostrarEstado('Materiales cargados exitosamente', 'success');
        } else {
            console.log('No hay materiales disponibles');
            selectMaterial.innerHTML += '<option disabled>No hay materiales disponibles</option>';
            mostrarEstado('No hay materiales disponibles', 'warning');
        }
    } catch (error) {
        console.error('Error al cargar materiales:', error);
        selectMaterial.innerHTML += '<option disabled>Error al cargar materiales</option>';
        mostrarEstado('Error al cargar materiales', 'error');
    }
}

// Función para solicitar préstamo
async function solicitarPrestamo() {
    const currentUser = window.auth?.authState?.user;
    if (!currentUser) {
        mostrarEstado('Por favor inicia sesión primero', 'error');
        return;
    }

    const id_material = document.getElementById('objeto').value;
    const materia = document.getElementById('materia').value;
    const fecha_limite = document.getElementById('fecha_limite').value;

    if (!id_material || !materia || !fecha_limite) {
        mostrarEstado('Por favor completa todos los campos', 'error');
        return;
    }

    // Validar que la fecha límite no sea anterior a hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaLimite = new Date(fecha_limite);
    if (fechaLimite < hoy) {
        mostrarEstado('La fecha límite no puede ser anterior a hoy', 'error');
        return;
    }

    try {
        mostrarEstado('Procesando solicitud...', 'loading');

        // Obtener datos del alumno
        const alumnoSnapshot = await firebase.database()
            .ref('alumno')
            .orderByChild('correo')
            .equalTo(currentUser.email)
            .once('value');

        const alumnoData = alumnoSnapshot.val();
        if (!alumnoData) {
            mostrarEstado('No se encontró registro de estudiante con este correo', 'error');
            return;
        }

        const alumno = Object.values(alumnoData)[0];

        // Verificar disponibilidad del material
        const materialRef = firebase.database().ref(`materiales/${id_material}`);
        const materialSnapshot = await materialRef.once('value');
        const material = materialSnapshot.val();

        if (!material || material.cantidad <= 0) {
            mostrarEstado('Este material no está disponible actualmente', 'error');
            return;
        }

        // Verificar si el alumno ya tiene préstamos activos del mismo material
        const prestamosActivosSnapshot = await firebase.database()
            .ref('prestamos')
            .orderByChild('matricula_alumno')
            .equalTo(alumno.matricula)
            .once('value');
        
        const prestamosActivos = prestamosActivosSnapshot.val();
        if (prestamosActivos) {
            const tieneMaterialPrestado = Object.values(prestamosActivos).some(
                prestamo => prestamo.id_material === id_material && prestamo.estado === 'activo'
            );
            
            if (tieneMaterialPrestado) {
                mostrarEstado('Ya tienes un préstamo activo de este material', 'error');
                return;
            }
        }

        // Crear préstamo
        const prestamosRef = firebase.database().ref('prestamos');
        const nuevoPrestamo = prestamosRef.push();
        
        const prestamoData = {
            id_prestamo: nuevoPrestamo.key,
            matricula_alumno: alumno.matricula,
            nombre_alumno: `${alumno.nombre} ${alumno.apellido_p} ${alumno.apellido_m}`,
            id_material: id_material,
            nombre_material: material.nombre,
            materia: materia,
            fecha_prestamo: new Date().toISOString().split('T')[0],
            fecha_limite: fecha_limite,
            estado: 'activo'
        };

        // Actualizar cantidad de material
        await materialRef.update({
            cantidad: material.cantidad - 1
        });

        // Guardar préstamo
        await nuevoPrestamo.set(prestamoData);

        // Actualizar lista de materiales
        await cargarMateriales();

        // Mostrar código QR con solo la información esencial
        const qrData = {
            id: prestamoData.id_prestamo,
            mat: prestamoData.matricula_alumno,
            mat_id: prestamoData.id_material,
            fecha: prestamoData.fecha_limite
        };
        
        document.getElementById('qrContainer').style.display = 'block';
        document.getElementById('codigo-qr').innerHTML = '';
        new QRCode(document.getElementById('codigo-qr'), {
            text: JSON.stringify(qrData),
            width: 128,
            height: 128,
            correctLevel: QRCode.CorrectLevel.L
        });

        document.getElementById('mensajeQR').textContent = 
            `Préstamo registrado exitosamente. ID: ${prestamoData.id_prestamo}`;

        // Limpiar formulario
        document.getElementById('formPrestamo').reset();
        mostrarEstado('Préstamo registrado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarEstado('Error al registrar el préstamo: ' + error.message, 'error');
    }
}

// Cerrar sesión
function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = 'sistema-prestamos.html';
    }).catch((error) => {
        console.error('Error al cerrar sesión:', error);
        mostrarEstado('Error al cerrar sesión', 'error');
    });
}
