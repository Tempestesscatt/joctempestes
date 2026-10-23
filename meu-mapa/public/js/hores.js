// js/hores.js
(function () {
    'use strict';

    // Función para comprobar si una hora tiene datos reales
    function horaTeDades(hora, dia, variables) {
        // Si no tiene la lista de variables o está vacía, no hay datos
        if (!variables || !Array.isArray(variables) || variables.length === 0) {
            return false;
        }
        // Podemos añadir más comprobaciones si quieres (por ejemplo, que no sea solo "su" y "sv")
        return true;
    }

    // Función principal que revisa los botones de la barra y oculta los vacíos
    function filtrarHores() {
        const grid = document.getElementById('fh_grid');
        if (!grid) return;

        const items = grid.querySelectorAll('.fh-item');
        if (!items.length) return;

        let visibles = 0;

        items.forEach((item, index) => {
            // Accedemos a la información de la hora desde el manifest global
            const info = window.totesLesHores ? window.totesLesHores[index] : null;
            
            if (info) {
                // Comprobamos si tiene datos
                const teDades = horaTeDades(info.hora, info.dia, info.variables);
                
                if (!teDades) {
                    // Si no tiene datos, lo ocultamos y lo bloqueamos
                    item.style.display = 'none';
                    item.classList.add('sense-dades');
                    item.title = 'Sense dades disponibles per aquesta hora';
                    item.setAttribute('aria-disabled', 'true');
                } else {
                    item.style.display = '';
                    item.classList.remove('sense-dades');
                    visibles++;
                }
            }
        });

        // Si no queda ninguna hora visible, mostramos un aviso
        if (visibles === 0) {
            const buit = document.createElement('div');
            buit.className = 'pp-buit';
            buit.style.color = 'var(--muted)';
            buit.style.padding = '4px 10px';
            buit.style.fontSize = '11px';
            buit.textContent = 'No hi ha hores amb dades disponibles.';
            grid.appendChild(buit);
        }
    }

    // Observador para saber cuándo mapapngs.js ha creado la barra
    function observarGrid() {
        const grid = document.getElementById('fh_grid');
        if (!grid) return;

        // Vigilamos cambios en el contenedor de horas
        const observer = new MutationObserver((mutations) => {
            // Si se han añadido nodos (horas), filtramos
            const hiHaCanvis = mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0);
            if (hiHaCanvis) {
                // Pequeño delay para asegurar que mapapngs ha terminado de pintar
                setTimeout(filtrarHores, 100);
            }
        });

        observer.observe(grid, { childList: true, subtree: true });
        
        // Ejecutamos una primera vez por si ya estaban cargadas
        setTimeout(filtrarHores, 500);
        setTimeout(filtrarHores, 1500);
        setTimeout(filtrarHores, 3000);
    }

    // Cuando cargue el DOM, buscamos el grid
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observarGrid);
    } else {
        observarGrid();
    }

    // También escuchamos el evento de carga del manifest si existe
    window.addEventListener('tc:manifest-carregat', () => {
        setTimeout(filtrarHores, 200);
    });

})();