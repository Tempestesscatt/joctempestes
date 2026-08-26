// ============================================================
// AVIS.JS - Carrega el mapa d'outbreak automàticament
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ avis.js carregat');
    carregarOutbreak();
});

function carregarOutbreak() {
    const img = document.getElementById('outbreakImage');
    const dateSpan = document.getElementById('outbreakDate');
    const wrapper = document.getElementById('outbreakWrapper');
    const loadingContainer = document.getElementById('loadingContainer');
    
    if (!img) {
        console.error('❌ No es troba #outbreakImage');
        return;
    }
    
    // Mostrar loading
    if (loadingContainer) {
        loadingContainer.style.display = 'flex';
    }
    
    // Obtenir data actual a Madrid
    const ara = new Date();
    const any = ara.getFullYear();
    const mes = String(ara.getMonth() + 1).padStart(2, '0');
    const dia = String(ara.getDate()).padStart(2, '0');
    const hora = ara.getHours();
    
    console.log(`📅 Data: ${any}/${mes}/${dia} - Hora: ${hora}h`);
    
    // Determinar quin dia buscar (avui o demà)
    // Si són més de les 21h (Madrid), buscar demà
    let anyBuscar = any;
    let mesBuscar = mes;
    let diaBuscar = dia;
    let esDema = false;
    
    if (hora >= 21) {
        const dema = new Date(ara);
        dema.setDate(dema.getDate() + 1);
        anyBuscar = dema.getFullYear();
        mesBuscar = String(dema.getMonth() + 1).padStart(2, '0');
        diaBuscar = String(dema.getDate()).padStart(2, '0');
        esDema = true;
        console.log(`📅 Són més de les 21h - Buscant DEMÀ (${anyBuscar}/${mesBuscar}/${diaBuscar})`);
    } else {
        console.log(`📅 Buscant AVUI (${anyBuscar}/${mesBuscar}/${diaBuscar})`);
    }
    
    // Generar llistat de fitxers a provar
    // Primer les hores més recents (18Z, 12Z, etc.)
    const hores = ['18Z', '12Z', '10Z', '11Z', '13Z', '14Z', '15Z', '16Z', '17Z', '19Z', '20Z', '21Z'];
    
    const fitxers = [];
    
    // Afegir fitxers del dia (avui o demà)
    hores.forEach(h => {
        fitxers.push({
            nom: `outbreak_catalunya_${anyBuscar}${mesBuscar}${diaBuscar}_${h}.png`,
            label: `${esDema ? 'demà' : 'avui'} ${h}`,
            data: `${anyBuscar}/${mesBuscar}/${diaBuscar}`,
            esDema: esDema
        });
    });
    
    // Si no troba res, provar amb el dia anterior
    const ahir = new Date(ara);
    ahir.setDate(ahir.getDate() - 1);
    const anyA = ahir.getFullYear();
    const mesA = String(ahir.getMonth() + 1).padStart(2, '0');
    const diaA = String(ahir.getDate()).padStart(2, '0');
    
    hores.forEach(h => {
        fitxers.push({
            nom: `outbreak_catalunya_${anyA}${mesA}${diaA}_${h}.png`,
            label: `ahir ${h}`,
            data: `${anyA}/${mesA}/${diaA}`,
            esDema: false
        });
    });
    
    // Fallback: imatge fixa
    fitxers.push({
        nom: 'outbreak_catalunya_20260826_12Z.png',
        label: 'fallback',
        data: '26/08/2026',
        esDema: false
    });
    
    let intent = 0;
    
    function provarProper() {
        if (intent >= fitxers.length) {
            console.log('❌ Cap imatge trobada');
            mostrarError(wrapper, loadingContainer);
            return;
        }
        
        const fitxer = fitxers[intent];
        const ruta = `avis/${fitxer.nom}`;
        
        console.log(`🔍 [${intent+1}/${fitxers.length}] Provant: ${ruta} (${fitxer.label})`);
        
        fetch(ruta, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    console.log(`✅ Trobat: ${ruta}`);
                    
                    // Carregar la imatge
                    img.src = ruta;
                    img.style.display = 'block';
                    img.style.width = '100%';
                    img.style.height = 'auto';
                    
                    // Amagar loading
                    if (loadingContainer) {
                        loadingContainer.style.display = 'none';
                    }
                    
                    // Actualitzar data
                    if (dateSpan) {
                        const dataMatch = fitxer.nom.match(/(\d{4})(\d{2})(\d{2})/);
                        if (dataMatch) {
                            const d = new Date(dataMatch[1], parseInt(dataMatch[2])-1, parseInt(dataMatch[3]));
                            let text = d.toLocaleDateString('ca-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            });
                            
                            // Comprovar si és avui o demà
                            if (fitxer.esDema) {
                                text += ' (demà)';
                            } else if (dataMatch[1] == any && dataMatch[2] == mes && dataMatch[3] == dia) {
                                text += ' (avui)';
                            }
                            
                            // Afegir hora
                            const horaMatch = fitxer.nom.match(/_(\d{2})Z/);
                            if (horaMatch) {
                                text += ` ${horaMatch[1]}:00h`;
                            }
                            
                            dateSpan.textContent = 'Actualitzat: ' + text;
                        }
                    }
                    
                    // Actualitzar l'status del badge
                    const statusBadge = document.querySelector('.outbreak-status');
                    if (statusBadge) {
                        const horaMatch = fitxer.nom.match(/_(\d{2})Z/);
                        if (horaMatch) {
                            statusBadge.innerHTML = `<i class="fa-solid fa-circle" style="font-size:8px;animation:pulse-dot 1.5s ease-in-out infinite;"></i> Últim Run: ${horaMatch[1]}:00h`;
                        }
                    }
                    
                } else {
                    intent++;
                    provarProper();
                }
            })
            .catch(() => {
                intent++;
                provarProper();
            });
    }
    
    provarProper();
}

function mostrarError(wrapper, loadingContainer) {
    if (!wrapper) return;
    if (loadingContainer) {
        loadingContainer.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;background:#152c44;color:#f5c842;font-size:18px;text-align:center;padding:40px;border-radius:12px;">
                <i class="fa-solid fa-cloud-bolt" style="font-size:48px;display:block;margin-bottom:16px;color:#f5c842;"></i>
                No hi ha mapa d'outbreak disponible
                <span style="font-size:14px;color:#8aa3be;margin-top:8px;">El mapa es generarà automàticament</span>
                <button onclick="carregarOutbreak()" style="margin-top:20px;background:#f5c842;color:#152c44;border:none;padding:10px 30px;border-radius:30px;font-weight:700;font-size:14px;cursor:pointer;transition:all 0.2s;">
                    <i class="fa-solid fa-rotate"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// Recarregar cada 10 minuts
setInterval(carregarOutbreak, 10 * 60 * 1000);

// Recarregar quan la pàgina torni a ser visible
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('🔄 Pàgina visible - Recarregant outbreak...');
        carregarOutbreak();
    }
});

console.log('✅ avis.js: Buscant imatge automàticament (avui/demà segons hora)');