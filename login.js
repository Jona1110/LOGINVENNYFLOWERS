/* ==========================================================================
   Lógica de Autenticación - Venny Flowers
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    const form = document.getElementById('login-form');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const eyeOpen = document.getElementById('eye-icon-open');
    const eyeClosed = document.getElementById('eye-icon-closed');

    // CONTRASENAS DEL SISTEMA (Puedes cambiarlas aquí)
    const CREDENCIALES = {
        pos: "caja2026",
        admin: "admin2026"
    };

    // Alternar visibilidad de contraseña
    togglePasswordBtn.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeOpen.classList.add('hidden');
            eyeClosed.classList.remove('hidden');
        } else {
            passwordInput.type = 'password';
            eyeOpen.classList.remove('hidden');
            eyeClosed.classList.add('hidden');
        }
    });

    // Limpiar error al escribir
    passwordInput.addEventListener('input', () => {
        errorMessage.classList.add('hidden');
        errorMessage.classList.remove('animate-shake');
    });

    // Cambiar de rol limpia la contraseña
    document.querySelectorAll('input[name="role"]').forEach(radio => {
        radio.addEventListener('change', () => {
            passwordInput.value = '';
            errorMessage.classList.add('hidden');
            passwordInput.focus();
        });
    });

    // Lógica de validación y redirección
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const selectedRole = document.querySelector('input[name="role"]:checked').value;
        const passwordEntered = passwordInput.value.trim();
        const btnLogin = document.getElementById('btn-login');

        // Validar credenciales
        if (passwordEntered === CREDENCIALES[selectedRole]) {
            
            // Efecto de carga en el botón
            const originalText = btnLogin.innerHTML;
            btnLogin.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btnLogin.disabled = true;

            // Guardar sesión temporal en el navegador
            sessionStorage.setItem('vf_logged_in', 'true');
            sessionStorage.setItem('vf_role', selectedRole);

            // Redirección simulando una pequeña carga para que se vea la animación
            setTimeout(() => {
                if (selectedRole === 'admin') {
                    window.location.href = 'admin/admin.html';
                } else if (selectedRole === 'pos') {
                    window.location.href = 'POS/pos.html';
                }
            }, 600);

        } else {
            // Mostrar error con animación
            errorMessage.classList.remove('hidden');
            
            // Reiniciar la animación de shake
            errorMessage.classList.remove('animate-shake');
            void errorMessage.offsetWidth; // Trigger reflow
            errorMessage.classList.add('animate-shake');
            
            passwordInput.value = '';
            passwordInput.focus();
        }
    });
});