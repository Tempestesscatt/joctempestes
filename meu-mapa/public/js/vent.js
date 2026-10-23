// js/vent.js
document.addEventListener('DOMContentLoaded', () => {
    const btnVent = document.getElementById('btnVent');
    const menu = document.getElementById('ventMenu');
    const btnOn = document.getElementById('btnVentOn');
    const btnOff = document.getElementById('btnVentOff');
    const btnAnim = document.getElementById('btnVentAnim');

    if (!btnVent || !menu) return;

    // Abrir/Cerrar menú flotante
    btnVent.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = menu.classList.toggle('active');
        
        if (isActive) {
            const rect = btnVent.getBoundingClientRect();
            menu.style.left = rect.left + 'px';
            menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px'; 
        }
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', () => {
        menu.classList.remove('active');
    });

    // Función para limpiar estados visuales (comprueba que existan)
    function netejarEstats() {
        if (btnOn) btnOn.classList.remove('actiu');
        if (btnOff) btnOff.classList.remove('actiu');
        if (btnAnim) btnAnim.classList.remove('actiu');
        menu.classList.remove('active');
    }

    // Acción ON
    if (btnOn) {
        btnOn.addEventListener('click', () => {
            window.MOSTRAR_VENT = true;
            window.VENT_ANIMAT = false;
            if (typeof refrescarVentIsolines === 'function') refrescarVentIsolines();
            if (typeof programarRedibuix === 'function') programarRedibuix(['vent']);
            
            netejarEstats();
            btnOn.classList.add('actiu');
            
            if (typeof guardarCapes === 'function') guardarCapes();
            if (typeof actualitzarControlsDock === 'function') actualitzarControlsDock();
        });
    }

    // Acción ANIMAT
    if (btnAnim) {
        btnAnim.addEventListener('click', () => {
            window.MOSTRAR_VENT = true;
            window.VENT_ANIMAT = true;
            if (typeof refrescarVentIsolines === 'function') refrescarVentIsolines();
            if (typeof programarRedibuix === 'function') programarRedibuix(['vent']);
            
            netejarEstats();
            btnAnim.classList.add('actiu');
            
            if (typeof guardarCapes === 'function') guardarCapes();
            if (typeof actualitzarControlsDock === 'function') actualitzarControlsDock();
            
            if (typeof window.iniciarAnimacioVent === 'function') window.iniciarAnimacioVent();
        });
    }

    // Acción OFF
    if (btnOff) {
        btnOff.addEventListener('click', () => {
            window.MOSTRAR_VENT = false;
            window.VENT_ANIMAT = false;
            if (typeof programarRedibuix === 'function') programarRedibuix(['vent']);
            
            netejarEstats();
            btnOff.classList.add('actiu');
            
            if (typeof guardarCapes === 'function') guardarCapes();
            if (typeof actualitzarControlsDock === 'function') actualitzarControlsDock();
            
            if (typeof window.aturarAnimacioVent === 'function') window.aturarAnimacioVent();
        });
    }
    
    // Sincronizar estado inicial
    setTimeout(() => {
        if (window.MOSTRAR_VENT) {
            if (window.VENT_ANIMAT && btnAnim) {
                btnAnim.classList.add('actiu');
            } else if (btnOn) {
                btnOn.classList.add('actiu');
            }
        } else if (btnOff) {
            btnOff.classList.add('actiu');
        }
    }, 1000);
});