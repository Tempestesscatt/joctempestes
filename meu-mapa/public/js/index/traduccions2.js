// ============================================================
// TRADUCCIONS2.JS - Traducciones para el visor AROME
// (Catalán / Castellano) CON BOTÓN DE IDIOMA
// + MutationObserver: traduce también contenido generado
//   dinámicamente por mapa.js (panell, graella d'hores, etc.)
// ============================================================

let idiomaActualVisor = localStorage.getItem('tempestes_idioma_visor') || 
    (navigator.language.startsWith('es') ? 'es' : 'ca');

const traduccionsVisor = {

    // ============================================================
    // ESTADOS DEL SISTEMA
    // ============================================================
    "✅ Tot funciona correctament": "✅ Todo funciona correctamente",
    "✅ Sistema operatiu": "✅ Sistema operativo",
    "⚠️ Atenció, dades amb retard": "⚠️ Atención, datos con retraso",
    "⚠️ Dades desactualitzades": "⚠️ Datos desactualizados",
    "❌ Error de connexió": "❌ Error de conexión",
    "❌ No s'han pogut carregar les dades": "❌ No se han podido cargar los datos",
    "❌ Alguna cosa no va bé, aviat ho arreglarem": "❌ Algo no va bien, pronto lo arreglaremos",
    "Generat:": "Generado:",
    "Estem treballant per resoldre-ho.": "Estamos trabajando para resolverlo.",
    "Actualitzar ara": "Actualizar ahora",
    "🔄 Carregant dades...": "🔄 Cargando datos...",
    "⏳ Sense dades": "⏳ Sin datos",
    "📡 Connectant amb el servidor...": "📡 Conectando con el servidor...",
    
    // ============================================================
    // MENÚS Y BOTONES DEL VISOR
    // ============================================================
    "Paràmetres": "Parámetros",
    "Configuració general": "Configuración general",
    "Cercar paràmetre...": "Buscar parámetro...",
    "Data del mapa:": "Fecha del mapa:",
    "Ctrl + Shift + R i clic dret de nou al mapa → Skew-T": "Ctrl + Shift + R y clic derecho de nuevo en el mapa → Skew-T",
    "Vent": "Viento",
    "Mode vent": "Modo viento",
    "Streamlines": "Streamlines",
    "Anterior": "Anterior",
    "Següent": "Siguiente",
    "Animació": "Animación",
    "Aturar": "Detener",
    "Reproduir": "Reproducir",
    "Inici": "Inicio",
    "Radar en temps real": "Radar en tiempo real",
    "Obrir menú de paràmetres": "Abrir menú de parámetros",
    "Tancar": "Cerrar",
    "◀ Anterior": "◀ Anterior",
    "▶ Animació": "▶ Animación",
    "Següent ▶": "Siguiente ▶",
    "〜 Streamlines": "〜 Streamlines",
    
    // ============================================================
    // RADAR
    // ============================================================
    "Radar Meteorològic — NE Península Ibèrica": "Radar Meteorológico — NE Península Ibérica",
    "Carregant radar en temps real...": "Cargando radar en tiempo real...",
    "Reflectivitat en temps real cada 10 min.": "Reflectividad en tiempo real cada 10 min.",
    
    // ============================================================
    // XAT
    // ============================================================
    "Xat en directe": "Chat en directo",
    "Escriu un missatge...": "Escribe un mensaje...",
    "Enviar": "Enviar",
    "Carregant missatges...": "Cargando mensajes...",
    "Encara no hi ha missatges": "Todavía no hay mensajes",
    "Error carregant xat": "Error cargando chat",
    "Has d'iniciar sessió per xatejar!": "¡Debes iniciar sesión para chatear!",
    "Error enviant missatge": "Error enviando mensaje",
    
    // ============================================================
    // PERFIL / LOGIN
    // ============================================================
    "El meu perfil": "Mi perfil",
    "Nom": "Nombre",
    "Email": "Email",
    "Desar nom": "Guardar nombre",
    "Sortir": "Salir",
    "Iniciar sessió": "Iniciar sesión",
    "Usuari": "Usuario",
    "Nom canviat correctament!": "¡Nombre cambiado correctamente!",
    "El nom ha de tenir mínim 3 caràcters": "El nombre debe tener mínimo 3 caracteres",
    "El nom ha de tenir màxim 20 caràcters": "El nombre debe tener máximo 20 caracteres",
    "Ja has canviat el nom. Només es pot canviar una vegada.": "Ya has cambiado el nombre. Solo se puede cambiar una vez.",
    "Escriu un nom": "Escribe un nombre",
    "Canviar foto de perfil": "Cambiar foto de perfil",
    "Desar foto": "Guardar foto",
    "Cancel·lar": "Cancelar",
    "Foto canviada correctament!": "¡Foto cambiada correctamente!",
    "Selecciona una imatge": "Selecciona una imagen",
    "Format no permès. Usa JPG, PNG, WEBP o GIF": "Formato no permitido. Usa JPG, PNG, WEBP o GIF",
    "La imatge ha de ser més petita de 2MB": "La imagen debe ser más pequeña de 2MB",
    "Has arribat al límit de 3 canvis de foto al mes.": "Has llegado al límite de 3 cambios de foto al mes.",
    "Et queden": "Te quedan",
    "canvis aquest mes": "cambios este mes",
    "(només es pot canviar una vegada)": "(solo se puede cambiar una vez)",
    "El nom ja no es pot canviar": "El nombre ya no se puede cambiar",
    
    // ============================================================
    // PARÀMETRES METEOROLÒGICS (títols que genera mapa.js)
    // ============================================================
    "Temperatura": "Temperatura",
    "Precipitació": "Precipitación",
    "Pressió": "Presión",
    "Humitat": "Humedad",
    "Nuvolositat": "Nubosidad",
    "Cobertura": "Cobertura",
    "CAPE": "CAPE",
    "CIN": "CIN",
    "Helicitat": "Helicidad",
    "Cisallament": "Cizallamiento",
    "Índex de convecció": "Índice de convección",
    "Nivell de congelació": "Nivel de congelación",
    "Cota de neu": "Cota de nieve",
    "Ratxa de vent": "Racha de viento",
    "Reflectivitat": "Reflectividad",
    "Precipitació acumulada": "Precipitación acumulada",
    "Temperatura aparent": "Temperatura aparente",
    "Punt de rosada": "Punto de rocío",
    "Altura": "Altura",
    "Nivell": "Nivel",
    "Superfície": "Superficie",
    "Model": "Modelo",
    "AROME 1.3km": "AROME 1.3km",
    "AROME-PI": "AROME-PI",
    "GFS": "GFS",
    "ECMWF": "ECMWF",

    // ─── Títols exactes generats per PALETES a mapa.js ─────────────
    "Temperatura 2m": "Temperatura 2m",
    "Punt rosada 2m": "Punto de rocío 2m",
    "Humitat 2m": "Humedad 2m",
    "Temp. mín. 2m": "Temp. mín. 2m",
    "Temp. màx. 2m": "Temp. máx. 2m",
    "Vent U 10m": "Viento U 10m",
    "Vent V 10m": "Viento V 10m",
    "Vent 10m": "Viento 10m",
    "Ratxa 10m": "Racha 10m",
    "Pressió superf.": "Presión superf.",
    "Pressió MSL": "Presión MSL",
    "Radar simulat": "Radar simulado",
    "Reflectivitat dBZ": "Reflectividad dBZ",
    "Llamps 1h": "Rayos 1h",
    "Núvols baixos": "Nubes bajas",
    "Núvols mitjans": "Nubes medias",
    "Núvols alts": "Nubes altas",
    "Precip. total acum.": "Precip. total acum.",
    "Neu total acum.": "Nieve total acum.",
    "BT 10.8µm": "BT 10.8µm",
    "BT 6.2µm (vapor)": "BT 6.2µm (vapor)",
    "Vent U": "Viento U",
    "Vent V": "Viento V",
    "Vel. vertical": "Vel. vertical",
    "Vort. potencial": "Vort. potencial",
    "LCL (alçada)": "LCL (altura)",
    "LFC (alçada)": "LFC (altura)",
    "Lifted Index": "Lifted Index",
    "Equilibrium Level": "Equilibrium Level",
    "SCP (càlcul local)": "SCP (cálculo local)",
    "SCP (Météo-France)": "SCP (Météo-France)",
    "STP (Météo-France)": "STP (Météo-France)",
    "Calamarsa (mida aprox.)": "Granizo (tamaño aprox.)",
    "EHI (SRH×CAPE)": "EHI (SRH×CAPE)",
    "SRH 0-1km": "SRH 0-1km",
    "SRH 0-3km": "SRH 0-3km",
    "Shear 0-3km": "Shear 0-3km",
    "Shear 0-6km": "Shear 0-6km",
    "Gel núvols 500hPa": "Hielo nubes 500hPa",
    "Pluja núvols 850hPa": "Lluvia nubes 850hPa",
    "Aigua precip. @700hPa": "Agua precip. @700hPa",
    "Aigua precip. @850hPa": "Agua precip. @850hPa",
    "Theta virtual 850hPa": "Theta virtual 850hPa",
    "Geopotencial 500hPa": "Geopotencial 500hPa",
    "Temperatura 500hPa": "Temperatura 500hPa",
    "Altitud": "Altitud",
    "Capa límit": "Capa límite",
    "Gruix de neu": "Grosor de nieve",
    "Equivalent aigua neu": "Equivalente agua nieve",
    "Tipus precip. 60min": "Tipo precip. 60min",
    "Tipus precip. severa 60min": "Tipo precip. severa 60min",
    "Tipus precip. 15min": "Tipo precip. 15min",
    "Tipus precip. severa 15min": "Tipo precip. severa 15min",
    "Reflectivitat màxima": "Reflectividad máxima",
    "Visibilitat 60min": "Visibilidad 60min",
    "Visibilitat sota precip. 60min": "Visibilidad bajo precip. 60min",
    "Visibilitat 15min": "Visibilidad 15min",
    "Visibilitat sota precip. 15min": "Visibilidad bajo precip. 15min",
    "Aigua precipitable (WCS)": "Agua precipitable (WCS)",
    "Temperatura superfície model": "Temperatura superficie modelo",
    "Nuvolositat total": "Nubosidad total",
    "CAPE mitjana": "CAPE media",
    "Calamarsa (WCS)": "Granizo (WCS)",
    "Intensitat precip.": "Intensidad precip.",
    "Gel núvols (mitjana)": "Hielo nubes (media)",
    "Pluja núvols (mitjana)": "Lluvia nubes (media)",
    "Aigua precipitable (mitjana)": "Agua precipitable (media)",
    "Geopotencial PV=1.5": "Geopotencial PV=1.5",
    "Geopotencial PV=2.0": "Geopotencial PV=2.0",
    "Theta PV=1.5": "Theta PV=1.5",
    "Theta PV=2.0": "Theta PV=2.0",
    "Vent U PV=1.5": "Viento U PV=1.5",
    "Vent U PV=2.0": "Viento U PV=2.0",
    "Vent V PV=1.5": "Viento V PV=1.5",
    "Vent V PV=2.0": "Viento V PV=2.0",
    "Vent total PV=1.5": "Viento total PV=1.5",
    "Vent total PV=2.0": "Viento total PV=2.0",
    "Altitud isoterma 0°C": "Altitud isoterma 0°C",
    "Altitud isoterma -10°C": "Altitud isoterma -10°C",
    "Isoterma 0°C": "Isoterma 0°C",
    "Iso TPW 0°C": "Iso TPW 0°C",
    "Iso TPW +1°C": "Iso TPW +1°C",
    "Iso TPW +1.5°C": "Iso TPW +1.5°C",
    "Base núvols": "Base nubes",
    "Sostre núvols": "Techo nubes",
    "Base Cumulonimbus": "Base Cumulonimbus",
    "Cim Cumulonimbus": "Cima Cumulonimbus",
    "Altura neu": "Altura nieve",
    "Neu superfície": "Nieve superficie",
    "Reserva neu": "Reserva nieve",
    "Pluja gelada": "Lluvia helada",
    "Precipitació 1h": "Precipitación 1h",
    "Neu 1h": "Nieve 1h",
    "Calamarsa (diag. WCS)": "Granizo (diag. WCS)",
    "Vent PV=1.5 (WCS)": "Viento PV=1.5 (WCS)",
    "Vent PV=2.0 (WCS)": "Viento PV=2.0 (WCS)",
    "Temperatura superfície": "Temperatura superficie",

    // ─── Grups del panell lateral (títols de secció) ───────────────
    "Temperatura i Humitat": "Temperatura y Humedad",
    "Vent en superfície": "Viento en superficie",
    "Vent en nivells (3D)": "Viento en niveles (3D)",
    "Velocitat vertical": "Velocidad vertical",
    "Shear i SRH": "Shear y SRH",
    "Neu": "Nieve",
    "Visibilitat": "Visibilidad",
    "Inestabilitat i Convecció": "Inestabilidad y Convección",
    "Tornados i Supercèl·lules": "Tornados y Supercélulas",
    "Cumulonimbus": "Cumulonimbus",
    "Reflectivitat (Radar)": "Reflectividad (Radar)",
    "Núvols": "Nubes",
    "Satèl·lit": "Satélite",
    "Geometria i Altitud": "Geometría y Altitud",
    "PV Superfícies": "PV Superficies",
    "Altres": "Otros",
    "Carregant dades...": "Cargando datos...",
    
    // ============================================================
    // CONTROLES DEL MAPA
    // ============================================================
    "Mapa": "Mapa",
    "Capa": "Capa",
    "Zoom": "Zoom",
    "Centrar": "Centrar",
    "Coordenades": "Coordenadas",
    "Latitud": "Latitud",
    "Longitud": "Longitud",
    "Apropar": "Acercar",
    "Allunyar": "Alejar",
    "Paràmetre bloquejat": "Parámetro bloqueado",
    "Aquest paràmetre requereix": "Este parámetro requiere",
    "iniciar sessió": "iniciar sesión",
    "per visualitzar-lo.": "para visualizarlo.",
    
    // ============================================================
    // SKEW-T
    // ============================================================
    "Obrir Skew-T": "Abrir Skew-T",
    "Skew-T": "Skew-T",
    "Diagrama Skew-T": "Diagrama Skew-T",
    "Perfil": "Perfil",
    "Dades sondeig": "Datos sondeo",
    "No hi ha dades disponibles per a aquest punt": "No hay datos disponibles para este punto",
    "Carregant Skew-T...": "Cargando Skew-T...",
    
    // ============================================================
    // ESTATS DEL SERVIDOR
    // ============================================================
    "Servidor connectat": "Servidor conectado",
    "Servidor desconnectat": "Servidor desconectado",
    "Darrera actualització": "Última actualización",
    "Actualitzant dades...": "Actualizando datos...",
    "Dades actualitzades": "Datos actualizados",
    "Temps d'actualització": "Tiempo de actualización",
    
    // ============================================================
    // MISSATGES D'ERROR
    // ============================================================
    "Error carregant el paràmetre": "Error cargando el parámetro",
    "Paràmetre no disponible": "Parámetro no disponible",
    "No s'han trobat dades": "No se han encontrado datos",
    "Error de connexió amb el servidor": "Error de conexión con el servidor",
    "Si us plau, torna-ho a intentar": "Por favor, inténtalo de nuevo",
    "Alguna cosa no va bé, aviat ho arreglarem": "Algo no va bien, pronto lo arreglaremos",
    
    // ============================================================
    // TEXTOS DEL ESTADO
    // ============================================================
    "Tot correcte": "Todo correcto",
    "Funciona correctament": "Funciona correctamente",
    "Atenció": "Atención",
    "Retard": "Retraso",
    "Error": "Error",
    "Sense dades": "Sin datos",
    "Carregant": "Cargando",
    "ℹ️ Sense dades": "ℹ️ Sin datos",
    
    // ============================================================
    // DIAS Y MESES
    // ============================================================
    "Diumenge": "Domingo",
    "Dilluns": "Lunes",
    "Dimarts": "Martes",
    "Dimecres": "Miércoles",
    "Dijous": "Jueves",
    "Divendres": "Viernes",
    "Dissabte": "Sábado",
    "Gener": "Enero",
    "Febrer": "Febrero",
    "Març": "Marzo",
    "Abril": "Abril",
    "Maig": "Mayo",
    "Juny": "Junio",
    "Juliol": "Julio",
    "Agost": "Agosto",
    "Setembre": "Septiembre",
    "Octubre": "Octubre",
    "Novembre": "Noviembre",
    "Desembre": "Diciembre",
    
    // ============================================================
    // BOTONES DE IDIOMA
    // ============================================================
    "Català": "Catalán",
    "Castellano": "Castellano",
    "Idioma": "Idioma",

    // ============================================================
    // PARÀMETRES METEOROLÒGICS - COMPLETS (etiquetes del panell)
    // ============================================================
    "Vent 10m ": "Viento 10m ",
    "Ratxa estimada 10m": "Racha estimada 10m",
    "Pressió (1)": "Presión (1)",
    "Vent en superfície (1)": "Viento en superficie (1)",
    "Ratxa real 10m (10fg)": "Racha real 10m (10fg)",
    "Vent en nivells (3D) (20)": "Viento en niveles (3D) (20)",
    "Vent @ 100hPa": "Viento @ 100hPa",
    "Vent @ 1000hPa": "Viento @ 1000hPa",
    "Vent @ 150hPa": "Viento @ 150hPa",
    "Vent @ 200hPa": "Viento @ 200hPa",
    "Vent @ 250hPa": "Viento @ 250hPa",
    "Vent @ 300hPa": "Viento @ 300hPa",
    "Vent @ 350hPa": "Viento @ 350hPa",
    "Vent @ 400hPa": "Viento @ 400hPa",
    "Vent @ 450hPa": "Viento @ 450hPa",
    "Vent @ 500hPa": "Viento @ 500hPa",
    "Vent @ 550hPa": "Viento @ 550hPa",
    "Vent @ 600hPa": "Viento @ 600hPa",
    "Vent @ 650hPa": "Viento @ 650hPa",
    "Vent @ 700hPa": "Viento @ 700hPa",
    "Vent @ 750hPa": "Viento @ 750hPa",
    "Vent @ 800hPa": "Viento @ 800hPa",
    "Vent @ 850hPa": "Viento @ 850hPa",
    "Vent @ 900hPa": "Viento @ 900hPa",
    "Vent @ 925hPa": "Viento @ 925hPa",
    "Vent @ 950hPa": "Viento @ 950hPa",
    "Velocitat vertical (5)": "Velocidad vertical (5)",
    "Velocitat vertical @ 300hPa": "Velocidad vertical @ 300hPa",
    "Velocitat vertical @ 500hPa": "Velocidad vertical @ 500hPa",
    "Velocitat vertical @ 700hPa": "Velocidad vertical @ 700hPa",
    "Velocitat vertical @ 850hPa": "Velocidad vertical @ 850hPa",
    "Velocitat vertical @ 925hPa": "Velocidad vertical @ 925hPa",
    "Shear i SRH (4)": "Shear y SRH (4)",
    "Precipitació (3)": "Precipitación (3)",
    "Neu acum.": "Nieve acum.",
    "Neu (4)": "Nieve (4)",
    "Alçada neu": "Altura nieve",
    "Reserva de neu": "Reserva de nieve",
    "Equivalent aigua de neu": "Equivalente agua de nieve",
    "Inestabilitat i Convecció (7)": "Inestabilidad y Convección (7)",
    "CAPE (aprox. sondeig)": "CAPE (aprox. sondeo)",
    "Tornados i Supercèl·lules (5)": "Tornados y Supercélulas (5)",
    "EHI (Tornados)": "EHI (Tornados)",
    "Mida potencial de Calamarsa": "Tamaño potencial de Granizo",
    "Núvols (5)": "Nubes (5)",
    "Glaç en núvols @500hPa": "Hielo en nubes @500hPa",
    "Pluja en núvols @850hPa": "Lluvia en nubes @850hPa",
    "Nuvols alts": "Nubes altas",
    "Nuvols baixos": "Nubes bajas",
    "Nuvols mitjans": "Nubes medias",
    "Satèl·lit (1)": "Satélite (1)",
    "Geometria i Altitud (5)": "Geometría y Altitud (5)",
    "Isoterma 0°C (límit neu/pluja)": "Isoterma 0°C (límite nieve/lluvia)",
    "Altitud on el Punt de Rosada és 0°C": "Altitud donde el Punto de Rocío es 0°C",
    "Altitud on el Punt de Rosada és +1°C": "Altitud donde el Punto de Rocío es +1°C",
    "Altitud on el Punt de Rosada és +1.5°C": "Altitud donde el Punto de Rocío es +1.5°C",
    "PV Superfícies (6)": "PV Superficies (6)",
    "Vorticitat potencial @ 200hPa": "Vorticidad potencial @ 200hPa",
    "Vorticitat potencial @ 300hPa": "Vorticidad potencial @ 300hPa",
    "Vorticitat potencial @ 500hPa": "Vorticidad potencial @ 500hPa",
    "Vorticitat potencial @ 700hPa": "Vorticidad potencial @ 700hPa",
    "Vorticitat potencial @ 850hPa": "Vorticidad potencial @ 850hPa",
    "Vorticitat potencial @ 925hPa": "Vorticidad potencial @ 925hPa",
    "Altres (1)": "Otros (1)",
    
    // UNITATS
    "(°C)": "(°C)",
    "(%)": "(%)",
    "(km/h)": "(km/h)",
    "(hPa)": "(hPa)",
    "(Pa/s)": "(Pa/s)",
    "(m/s)": "(m/s)",
    "(m²/s²)": "(m²/s²)",
    "(mm)": "(mm)",
    "(m)": "(m)",
    "(J/kg)": "(J/kg)",
    "(cm)": "(cm)",
    "(Index)": "(Índice)",
    "(g/kg)": "(g/kg)",
    "(PVU)": "(PVU)",
};

// ============================================================
// FUNCIÓN PARA TRADUCIR TEXTO
// ============================================================
function traduirTextVisor(text) {
    if (idiomaActualVisor === 'ca') return text;
    return traduccionsVisor[text] || text;
}

// ============================================================
// TRADUCCIÓN "difusa" para nodos con espacios/saltos de línea
// extra alrededor del texto (por ejemplo generado con plantillas
// que dejan indentación). Probamos el texto tal cual y, si falla,
// probamos con el texto "trim()".
// ============================================================
function _buscarTraduccio(text) {
    if (text === null || text === undefined) return null;
    if (traduccionsVisor[text] !== undefined) return traduccionsVisor[text];
    const t = text.trim();
    if (t && traduccionsVisor[t] !== undefined) {
        // Conservem espais/salts originals al voltant si n'hi havia
        return text.replace(t, traduccionsVisor[t]);
    }
    return null;
}

// ============================================================
// FUNCIÓN PARA TRADUCIR UN NODO CONCRETO (text, placeholders,
// title, aria-label, value...) — reutilitzada tant per la
// passada inicial com per l'observer.
// ============================================================
function _traduirNodeText(node) {
    if (node.nodeType !== 3) return; // Node.TEXT_NODE
    const original = node.textContent;
    const traduccio = _buscarTraduccio(original);
    if (traduccio !== null && traduccio !== original) {
        node.textContent = traduccio;
    }
}

function _traduirElement(el) {
    if (!el || el.nodeType !== 1) return; // Node.ELEMENT_NODE
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') return;

    // Textos directes (nodes fill de tipus text)
    el.childNodes.forEach(child => {
        if (child.nodeType === 3) _traduirNodeText(child);
    });

    // Placeholder
    if ('placeholder' in el && el.placeholder) {
        const trad = _buscarTraduccio(el.placeholder);
        if (trad !== null) el.placeholder = trad;
    }

    // Atributs title / aria-label / value (només si semblen text pla,
    // no toquem value d'inputs numèrics ni coses similars)
    ['title', 'aria-label'].forEach(attr => {
        if (el.hasAttribute && el.hasAttribute(attr)) {
            const val = el.getAttribute(attr);
            const trad = _buscarTraduccio(val);
            if (trad !== null) el.setAttribute(attr, trad);
        }
    });

    if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search') && el.value) {
        const trad = _buscarTraduccio(el.value);
        if (trad !== null) el.value = trad;
    }
}

// ============================================================
// FUNCIÓN PARA TRADUCIR TODOS LOS ELEMENTOS DEL VISOR
// (passada completa — s'usa a l'inici i com a fallback)
// ============================================================
function traduirVisor() {
    if (idiomaActualVisor === 'ca') return;

    function recorrerNodes(node) {
        if (node.nodeType === 3) {
            _traduirNodeText(node);
        } else if (node.nodeType === 1) {
            if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'TEXTAREA') return;
            _traduirElement(node);
            node.childNodes.forEach(recorrerNodes);
        }
    }

    document.body.childNodes.forEach(recorrerNodes);

    // Title de la pàgina
    if (document.title) {
        const trad = _buscarTraduccio(document.title);
        if (trad !== null) document.title = trad;
    }
}

// ============================================================
// MUTATION OBSERVER — tradueix automàticament qualsevol node
// nou o qualsevol canvi de text que faci mapa.js (o qualsevol
// altre script) DESPRÉS de la càrrega inicial.
// ============================================================
let _observerVisor = null;
let _observerVisorActiu = false;
let _traduccioTimeoutId = null;

function _processarNodeAfegit(node) {
    if (node.nodeType === 3) {
        _traduirNodeText(node);
    } else if (node.nodeType === 1) {
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'TEXTAREA') return;
        _traduirElement(node);
        node.childNodes.forEach(_processarNodeAfegit);
    }
}

function _gestionarMutacions(mutations) {
    if (idiomaActualVisor === 'ca') return;

    for (const mut of mutations) {
        if (mut.type === 'childList') {
            mut.addedNodes.forEach(_processarNodeAfegit);
        } else if (mut.type === 'characterData') {
            // Canvi directe de textContent d'un node de text existent
            const node = mut.target;
            const original = node.textContent;
            const traduccio = _buscarTraduccio(original);
            // Evitem loop infinit: només canviem si el nou valor
            // no és ja una traducció coneguda (valor final del diccionari)
            if (traduccio !== null && traduccio !== original) {
                const esJaUnaTraduccio = Object.values(traduccionsVisor).includes(original);
                if (!esJaUnaTraduccio) {
                    node.textContent = traduccio;
                }
            }
        } else if (mut.type === 'attributes') {
            const el = mut.target;
            if (mut.attributeName === 'placeholder' && el.placeholder) {
                const trad = _buscarTraduccio(el.placeholder);
                if (trad !== null && trad !== el.placeholder) el.placeholder = trad;
            }
            if ((mut.attributeName === 'title' || mut.attributeName === 'aria-label') && el.hasAttribute(mut.attributeName)) {
                const val = el.getAttribute(mut.attributeName);
                const trad = _buscarTraduccio(val);
                if (trad !== null && trad !== val) el.setAttribute(mut.attributeName, trad);
            }
        }
    }
}

function iniciarObserverTraduccio() {
    if (_observerVisorActiu) return;
    if (!document.body) {
        // Si encara no existeix body, reintentem al DOMContentLoaded
        document.addEventListener('DOMContentLoaded', iniciarObserverTraduccio, { once: true });
        return;
    }

    _observerVisor = new MutationObserver(function(mutations) {
        // Debounce lleuger: mapa.js sovint fa moltes mutacions seguides
        // (per exemple reconstruint tota la graella d'hores). Processar-les
        // una a una és car; ho agrupem en un sol pas per tanda d'esdeveniments.
        _gestionarMutacions(mutations);
    });

    _observerVisor.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'title', 'aria-label']
    });

    _observerVisorActiu = true;
}

function aturarObserverTraduccio() {
    if (_observerVisor) {
        _observerVisor.disconnect();
        _observerVisorActiu = false;
    }
}

// ============================================================
// FUNCIÓN PARA CAMBIAR IDIOMA
// ============================================================
function canviarIdiomaVisor(idioma) {
    if (!idioma) {
        idioma = idiomaActualVisor === 'ca' ? 'es' : 'ca';
    }
    
    idiomaActualVisor = idioma;
    localStorage.setItem('tempestes_idioma_visor', idioma);
    
    // Actualizar el texto del botón
    actualitzarBotoIdiomaVisor();
    
    // Recargar la página para aplicar cambios
    location.reload();
}

// ============================================================
// FUNCIÓN PARA ACTUALIZAR EL BOTÓN DE IDIOMA
// ============================================================
function actualitzarBotoIdiomaVisor() {
    const btn = document.getElementById('botoIdiomaVisor');
    if (!btn) return;
    
    if (idiomaActualVisor === 'ca') {
        btn.innerHTML = '<i class="fa-solid fa-language"></i> <span>Castellano</span>';
        btn.setAttribute('data-idioma', 'es');
        btn.title = 'Canviar a castellano';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-language"></i> <span>Català</span>';
        btn.setAttribute('data-idioma', 'ca');
        btn.title = 'Cambiar a catalán';
    }
}

// ============================================================
// CREAR BOTÓN DE IDIOMA
// ============================================================
function crearBotoIdioma() {
    // Buscar donde poner el botón (en la topnav o en el área de estado)
    let target = document.querySelector('#topnav .topnav-right');
    if (!target) {
        target = document.querySelector('#topnav');
    }
    if (!target) {
        target = document.querySelector('#fh_valid_outer');
    }
    if (!target) {
        target = document.querySelector('#body-row');
    }
    
    if (!target) return;
    
    // Crear el botón
    const btn = document.createElement('button');
    btn.id = 'botoIdiomaVisor';
    btn.style.cssText = `
        background: rgba(255, 215, 0, 0.1);
        border: 1px solid rgba(255, 215, 0, 0.2);
        border-radius: 6px;
        color: #FFD700;
        padding: 4px 12px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        white-space: nowrap;
        margin-left: 8px;
    `;
    btn.onmouseover = function() {
        this.style.background = 'rgba(255, 215, 0, 0.2)';
        this.style.borderColor = 'rgba(255, 215, 0, 0.4)';
    };
    btn.onmouseout = function() {
        this.style.background = 'rgba(255, 215, 0, 0.1)';
        this.style.borderColor = 'rgba(255, 215, 0, 0.2)';
    };
    btn.onclick = function() {
        canviarIdiomaVisor();
    };
    
    // Insertar en el target
    if (target.id === 'topnav') {
        // Si es la topnav, añadir al final
        target.appendChild(btn);
    } else {
        // Si es otro elemento, añadir al principio o al final según convenga
        target.insertBefore(btn, target.firstChild);
    }
    
    // Actualizar el texto del botón
    actualitzarBotoIdiomaVisor();
}

// ============================================================
// FUNCIÓN PARA ACTUALIZAR EL BOTÓN DE ESTADO (junto al mensaje)
// ============================================================
function actualitzarBotoEstat(estat, missatge) {
    const container = document.getElementById('estatVisorContainer');
    if (!container) return;
    
    // Buscar o crear el botón de estado
    let btn = document.getElementById('botoEstatVisor');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'botoEstatVisor';
        btn.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: #8899bb;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 28px;
            white-space: nowrap;
        `;
        btn.onmouseover = function() {
            this.style.background = 'rgba(255,255,255,0.1)';
            this.style.color = '#e0e8f0';
        };
        btn.onmouseout = function() {
            this.style.background = 'rgba(255,255,255,0.05)';
            this.style.color = '#8899bb';
        };
        container.prepend(btn);
    }
    
    // Actualizar el botón según el estado
    const estatText = traduirTextVisor(estat || 'ℹ️ Sense dades');
    const colorMap = {
        '✅': '#43e97b',
        '⚠️': '#ffaa2b', 
        '❌': '#ff5e5e',
        '🔄': '#6fc3ff',
        'ℹ️': '#8899bb'
    };
    
    const icon = estat ? estat.split(' ')[0] : 'ℹ️';
    const color = colorMap[icon] || '#8899bb';
    const text = missatge || estat || 'Sense dades';
    
    btn.innerHTML = `<span style="color:${color}">${icon}</span> ${traduirTextVisor(text)}`;
    
    // Cambiar el borde según el estado
    if (icon === '✅') {
        btn.style.borderColor = 'rgba(67, 233, 123, 0.3)';
        btn.style.background = 'rgba(67, 233, 123, 0.08)';
    } else if (icon === '⚠️') {
        btn.style.borderColor = 'rgba(255, 170, 43, 0.3)';
        btn.style.background = 'rgba(255, 170, 43, 0.08)';
    } else if (icon === '❌') {
        btn.style.borderColor = 'rgba(255, 94, 94, 0.3)';
        btn.style.background = 'rgba(255, 94, 94, 0.08)';
    } else {
        btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        btn.style.background = 'rgba(255, 255, 255, 0.05)';
    }
}

// ============================================================
// CREAR CONTENEDOR DEL BOTÓN DE ESTADO (junto al mensaje)
// ============================================================
function crearContainerEstat() {
    // Buscar donde está el mensaje de estado/error
    let targetContainer = null;
    
    // Buscar en varios lugares posibles
    const possibleContainers = document.querySelectorAll('#fh_valid_outer, .status-badge, [class*="error"], [class*="status"]');
    
    for (const container of possibleContainers) {
        if (container.textContent.includes('Alguna cosa no va bé') || 
            container.textContent.includes('tot funciona') ||
            container.textContent.includes('error') ||
            container.textContent.includes('carregant')) {
            targetContainer = container;
            break;
        }
    }
    
    // Si no se encuentra, usar fh_valid_outer
    if (!targetContainer) {
        targetContainer = document.querySelector('#fh_valid_outer');
    }
    
    if (!targetContainer) return;
    
    // Verificar si ya existe el contenedor
    if (document.getElementById('estatVisorContainer')) return;
    
    // Crear el contenedor para el estado
    const estatContainer = document.createElement('div');
    estatContainer.id = 'estatVisorContainer';
    estatContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-right: 10px;
    `;
    
    // Insertar al principio del contenedor
    targetContainer.prepend(estatContainer);
    
    // Inicializar con estado por defecto
  
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initVisorIdioma() {
    const guardat = localStorage.getItem('tempestes_idioma_visor');
    if (guardat && (guardat === 'ca' || guardat === 'es')) {
        idiomaActualVisor = guardat;
    } else {
        const navLang = navigator.language || navigator.language;
        idiomaActualVisor = navLang.startsWith('es') ? 'es' : 'ca';
    }
    
    // Crear botón de idioma
    crearBotoIdioma();
    
    // Crear contenedor de estado
    setTimeout(crearContainerEstat, 300);
    
    // Si el idioma es castellano, traducir
    if (idiomaActualVisor === 'es') {
        setTimeout(traduirVisor, 100);
        // Passades extra: mapa.js triga a construir el panell,
        // la graella d'hores i altres elements — repassem uns
        // quants cops mentre l'app encara s'està inicialitzant.
        setTimeout(traduirVisor, 600);
        setTimeout(traduirVisor, 1500);
        setTimeout(traduirVisor, 3000);
    }
    
    // Actualitzar botó de idioma
    actualitzarBotoIdiomaVisor();

    // A partir d'aquí, l'observer s'encarrega de qualsevol
    // contingut nou o modificat, vingui d'on vingui.
    if (idiomaActualVisor === 'es') {
        iniciarObserverTraduccio();
    }
}

// ============================================================
// EXPORTAR FUNCIONES PARA USO EXTERNO
// ============================================================
window.traduirTextVisor = traduirTextVisor;
window.traduirVisor = traduirVisor;
window.canviarIdiomaVisor = canviarIdiomaVisor;
window.actualitzarBotoIdiomaVisor = actualitzarBotoIdiomaVisor;
window.actualitzarBotoEstat = actualitzarBotoEstat;
window.crearContainerEstat = crearContainerEstat;
window.crearBotoIdioma = crearBotoIdioma;
window.idiomaActualVisor = idiomaActualVisor;
window.iniciarObserverTraduccio = iniciarObserverTraduccio;
window.aturarObserverTraduccio = aturarObserverTraduccio;

// ============================================================
// EJECUTAR AL CARGAR
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVisorIdioma);
} else {
    initVisorIdioma();
}

// También ejecutar cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    // Si hay algún mensaje de error, actualizar el estado
    setTimeout(() => {
        const errorMsg = document.querySelector('[class*="error"]');
        if (errorMsg && errorMsg.textContent.includes('Alguna cosa no va bé')) {
            actualitzarBotoEstat('❌', 'Error');
        }
    }, 1000);
});