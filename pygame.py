import streamlit as st
import time
import random
import pandas as pd
import altair as alt
from collections import deque

# --- CONFIGURACIÓ DE PÀGINA INICIAL ---
st.set_page_config(page_title="Terra-Expert", page_icon="🌱", layout="wide")

# --- ESTRUCTURES DE DADES ---

# Pla de Carrera en Edafologia (Certificacions)
CERTIFICACIONS_INFO = [
    {"id": 1, "nom": "Introducció a l'Edafologia", "cost": 0, "nivell_dificultat": 1, "icon": "🕵️‍♂️"},
    {"id": 2, "nom": "Certificat en Perfils Edàfics", "cost": 450, "nivell_dificultat": 2, "icon": "🏞️"},
    {"id": 3, "nom": "Diploma en Propietats Fisicoquímiques", "cost": 1200, "nivell_dificultat": 3, "icon": "🔬"},
    {"id": 4, "nom": "Avançat en Química del Sòl", "cost": 2800, "nivell_dificultat": 4, "icon": "🧪"},
    {"id": 5, "nom": "Màster en Formació i Gènesi del Sòl", "cost": 5500, "nivell_dificultat": 5, "icon": "🌍"},
    {"id": 6, "nom": "Postgrau en Cicles Biogeoquímics", "cost": 9000, "nivell_dificultat": 6, "icon": "👑"},
]

# --- BANC DE PREGUNTES COMPLET D'EDAFOLOGIA ---
PREGUNTES_EDAFOLOGIA = [
    # --- NIVELL 1 (Introducció) ---
    {"pregunta": "Què estudia principalment l'edafologia?", "opcions": ["Les roques i minerals", "El sòl des de tots els punts de vista", "El clima i l'atmosfera", "Els rius i oceans"], "resposta_correcta": "El sòl des de tots els punts de vista", "gc_guany": 20, "gc_perdua": 10, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "Quina d'aquestes NO és una funció principal del sòl en els ecosistemes?", "opcions": ["Hàbitat per a organismes", "Medi per al creixement de les plantes", "Generació d'energia eòlica", "Sistema de reciclatge de matèria orgànica"], "resposta_correcta": "Generació d'energia eòlica", "gc_guany": 25, "gc_perdua": 10, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "El sòl es considera la capa superior de la superfície, formada principalment per...", "opcions": ["Sedimentació marina", "Activitat volcànica", "Meteorització de les roques", "Compactació de residus"], "resposta_correcta": "Meteorització de les roques", "gc_guany": 20, "gc_perdua": 10, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "En la composició del sòl, què ocupa els 'forats' o porus?", "opcions": ["Només sòlids", "Roques petites", "Aire i aigua", "Matèria orgànica compactada"], "resposta_correcta": "Aire i aigua", "gc_guany": 20, "gc_perdua": 10, "dificultat": 1, "categoria": "Composició"},
    {"pregunta": "Per a què serveix principalment el sòl com a 'sistema de reciclatge'?", "opcions": ["Per crear nous tipus de roques", "Per filtrar la llum solar", "Per descompondre matèria orgànica i depurar", "Per emmagatzemar plàstics"], "resposta_correcta": "Per descompondre matèria orgànica i depurar", "gc_guany": 25, "gc_perdua": 15, "dificultat": 1, "categoria": "Funcions del Sòl"},

    # --- NIVELL 2 (Perfils Edàfics) ---
    {"pregunta": "Quin horitzó del sòl està format principalment per fullaraca i restes orgàniques sense transformar?", "opcions": ["Horitzó A", "Horitzó B", "Horitzó O", "Horitzó R"], "resposta_correcta": "Horitzó O", "gc_guany": 40, "gc_perdua": 20, "dificultat": 2, "categoria": "Perfil del Sòl"},
    {"pregunta": "L'horitzó A, també anomenat 'de rentatge', és ric en...", "opcions": ["Fragments de roca mare", "Humus i matèria orgànica", "Argila acumulada", "Sals minerals pures"], "resposta_correcta": "Humus i matèria orgànica", "gc_guany": 45, "gc_perdua": 20, "dificultat": 2, "categoria": "Perfil del Sòl"},
    {"pregunta": "Quin horitzó es coneix com la 'roca mare' no alterada?", "opcions": ["Horitzó C", "Horitzó A", "Horitzó B", "Horitzó R"], "resposta_correcta": "Horitzó R", "gc_guany": 40, "gc_perdua": 20, "dificultat": 2, "categoria": "Perfil del Sòl"},
    {"pregunta": "L'horitzó B, o 'de precipitació', es caracteritza per una acumulació de...", "opcions": ["Matèria orgànica fresca", "Fullaraca", "Argila, òxids de Fe i Al", "Arrels superficials"], "resposta_correcta": "Argila, òxids de Fe i Al", "gc_guany": 50, "gc_perdua": 25, "dificultat": 2, "categoria": "Perfil del Sòl"},
    {"pregunta": "Com es denomina un horitzó amb característiques intermèdies entre l'horitzó A i el B?", "opcions": ["Horitzó C", "Horitzó de transició AB", "Horitzó R", "No existeix"], "resposta_correcta": "Horitzó de transició AB", "gc_guany": 45, "gc_perdua": 25, "dificultat": 2, "categoria": "Perfil del Sòl"},

    # --- NIVELL 3 (Propietats Fisicoquímiques) ---
    {"pregunta": "La 'textura' del sòl es refereix a la proporció de partícules de diàmetre inferior a...", "opcions": ["2 cm", "2 mm", "0.2 mm", "20 mm"], "resposta_correcta": "2 mm", "gc_guany": 65, "gc_perdua": 30, "dificultat": 3, "categoria": "Textura i Partícules"},
    {"pregunta": "Quina partícula del sòl té la major capacitat de retenció d'aigua i nutrients?", "opcions": ["Sorra", "Graveta", "Llim", "Argila"], "resposta_correcta": "Argila", "gc_guany": 70, "gc_perdua": 35, "dificultat": 3, "categoria": "Textura i Partícules"},
    {"pregunta": "Un sòl amb partícules de 2 a 6 mm de diàmetre es classifica com a...", "opcions": ["Argila", "Llim", "Graveta", "Sorra"], "resposta_correcta": "Graveta", "gc_guany": 60, "gc_perdua": 30, "dificultat": 3, "categoria": "Textura i Partícules"},
    {"pregunta": "La 'porositat' del sòl es defineix com...", "opcions": ["La quantitat d'aigua que pot retenir", "El volum de sòl ocupat pels forats", "La duresa de les partícules sòlides", "El color del material"], "resposta_correcta": "El volum de sòl ocupat pels forats", "gc_guany": 65, "gc_perdua": 35, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Per determinar la textura 'al tacte', un sòl que se sent aspre i no forma una bola coherent és principalment...", "opcions": ["Argilós", "Llimós", "Humífer", "Sorrós"], "resposta_correcta": "Sorrós", "gc_guany": 75, "gc_perdua": 40, "dificultat": 3, "categoria": "Textura i Partícules"},

    # --- NIVELL 4 (Química del Sòl) ---
    {"pregunta": "Un interval de pH òptim per a la majoria de les plantes es troba entre...", "opcions": ["4-5", "9-10", "6-8", "2-4"], "resposta_correcta": "6-8", "gc_guany": 80, "gc_perdua": 40, "dificultat": 4, "categoria": "Química del Sòl"},
    {"pregunta": "La presència de carbonats en un sòl tendeix a fer-lo...", "opcions": ["Més àcid", "Més bàsic (alcalí)", "Neutre", "No afecta el pH"], "resposta_correcta": "Més bàsic (alcalí)", "gc_guany": 85, "gc_perdua": 45, "dificultat": 4, "categoria": "Química del Sòl"},
    {"pregunta": "Què indica un color de sòl molt fosc o negre?", "opcions": ["Alt contingut en sorra", "Alt contingut en matèria orgànica", "Absència total d'aigua", "Presència de sals"], "resposta_correcta": "Alt contingut en matèria orgànica", "gc_guany": 80, "gc_perdua": 40, "dificultat": 4, "categoria": "Propietats Físiques"},
    {"pregunta": "L'addició de HCl a una mostra de sòl produeix efervescència. Això indica la presència de...", "opcions": ["Quars", "Argila", "Carbonats (CaCO₃)", "Sofre"], "resposta_correcta": "Carbonats (CaCO₃)", "gc_guany": 90, "gc_perdua": 45, "dificultat": 4, "categoria": "Química del Sòl"},
    {"pregunta": "Quina és una funció clau de la matèria orgànica per a la 'fertilitat física' del sòl?", "opcions": ["Augmentar el pH", "Dissoldre les roques", "Millorar l'estructura i la infiltració", "Canviar el color a blanc"], "resposta_correcta": "Millorar l'estructura i la infiltració", "gc_guany": 85, "gc_perdua": 40, "dificultat": 4, "categoria": "Química del Sòl"},

    # --- NIVELL 5 (Edafogènesi) ---
    {"pregunta": "El procés de formació del sòl s'anomena...", "opcions": ["Sedimentació", "Edafogènesi", "Litificació", "Metamorfisme"], "resposta_correcta": "Edafogènesi", "gc_guany": 100, "gc_perdua": 50, "dificultat": 5, "categoria": "Formació del Sòl"},
    {"pregunta": "La fragmentació de roques per canvis de temperatura o acció del gel és un exemple de meteorització...", "opcions": ["Química", "Biològica", "Física o mecànica", "Orgànica"], "resposta_correcta": "Física o mecànica", "gc_guany": 110, "gc_perdua": 55, "dificultat": 5, "categoria": "Formació del Sòl"},
    {"pregunta": "Quin factor de formació del sòl condiciona directament el tipus de meteorització i els fluxos d'aigua verticals?", "opcions": ["El temps", "Els organismes", "La roca mare", "El clima"], "resposta_correcta": "El clima", "gc_guany": 105, "gc_perdua": 50, "dificultat": 5, "categoria": "Formació del Sòl"},
    {"pregunta": "La dissolució de minerals per l'aigua és un procés de meteorització...", "opcions": ["Física", "Química", "Mecànica", "Tectònica"], "resposta_correcta": "Química", "gc_guany": 110, "gc_perdua": 55, "dificultat": 5, "categoria": "Formació del Sòl"},
    {"pregunta": "Per què es considera el sòl un recurs NO renovable?", "opcions": ["Perquè no es pot reciclar", "Perquè el seu temps de formació és extremadament lent", "Perquè està format per materials finits", "Perquè només es troba en certs planetes"], "resposta_correcta": "Perquè el seu temps de formació és extremadament lent", "gc_guany": 120, "gc_perdua": 60, "dificultat": 5, "categoria": "Formació del Sòl"},
    
    # --- NIVELL 6 (Cicles Biogeoquímics) ---
    {"pregunta": "Quin procés del cicle del nitrogen converteix el nitrogen gas (N₂) en formes aprofitables per les plantes?", "opcions": ["Desnitrificació", "Nitrificació", "Fixació", "Amonificació"], "resposta_correcta": "Fixació", "gc_guany": 140, "gc_perdua": 70, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "La descomposició de cadàvers i excrements allibera nitrogen en forma d'amoni. Aquest procés s'anomena...", "opcions": ["Assimilació", "Amonificació o mineralització", "Fixació biòtica", "Desnitrificació"], "resposta_correcta": "Amonificació o mineralització", "gc_guany": 150, "gc_perdua": 75, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "La 'desnitrificació' és el procés on els nitrats es redueixen a...", "opcions": ["Amoni", "Nitrogen gas (N₂)", "Proteïnes", "Àcid nítric"], "resposta_correcta": "Nitrogen gas (N₂)", "gc_guany": 140, "gc_perdua": 70, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "La principal reserva de fòsfor en el seu cicle biogeoquímic es troba en...", "opcions": ["L'atmosfera", "Els oceans", "Els minerals i roques", "Els éssers vius"], "resposta_correcta": "Els minerals i roques", "gc_guany": 160, "gc_perdua": 80, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "Com absorbeixen les plantes el nitrogen del sòl principalment?", "opcions": ["En forma de N₂ gas", "En forma d'ions nitrat (NO₃⁻) o amoni (NH₄⁺)", "Directament de la matèria orgànica", "A través de les fulles"], "resposta_correcta": "En forma d'ions nitrat (NO₃⁻) o amoni (NH₄⁺)", "gc_guany": 150, "gc_perdua": 75, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
]

# --- CONFIGURACIÓ INICIAL I D'ESTAT DE LA SESSIÓ ---
if 'saldo_gc' not in st.session_state:
    st.session_state.saldo_gc = 500
if 'puntuacio_coneixement' not in st.session_state:
    st.session_state.puntuacio_coneixement = 0
if 'pregunta_actual' not in st.session_state:
    st.session_state.pregunta_actual = None
if 'missatge_feedback' not in st.session_state:
    st.session_state.missatge_feedback = ""
if 'cambio_saldo' not in st.session_state:
    st.session_state.cambio_saldo = 0 
if 'mostrar_cambio' not in st.session_state:
    st.session_state.mostrar_cambio = False
if 'certificacions' not in st.session_state:
    certs_amb_estat = [dict(cert, unlocked=(cert['id'] == 1)) for cert in CERTIFICACIONS_INFO]
    st.session_state.certificacions = certs_amb_estat
if 'preguntes_respostes' not in st.session_state:
    st.session_state.preguntes_respostes = 0
if 'respostes_correctes' not in st.session_state:
    st.session_state.respostes_correctes = 0
if 'errors_per_categoria' not in st.session_state:
    st.session_state.errors_per_categoria = {}
if 'preguntes_recents' not in st.session_state:
    st.session_state.preguntes_recents = deque(maxlen=15)
# Estat dels potenciadors
if 'bonus_gc_turns' not in st.session_state:
    st.session_state.bonus_gc_turns = 0

# --- FUNCIONS DEL JOC ---
def generar_pregunta():
    nivell_maxim = max(ex['nivell_dificultat'] for ex in st.session_state.certificacions if ex['unlocked'])
    
    preguntes_disponibles = [
        (i, p) for i, p in enumerate(PREGUNTES_EDAFOLOGIA) 
        if p['dificultat'] <= nivell_maxim and i not in st.session_state.preguntes_recents
    ]
    
    if not preguntes_disponibles:
        st.session_state.preguntes_recents.clear()
        preguntes_disponibles = [(i, p) for i, p in enumerate(PREGUNTES_EDAFOLOGIA) if p['dificultat'] <= nivell_maxim]

    if preguntes_disponibles:
        idx, pregunta_seleccionada = random.choice(preguntes_disponibles)
        st.session_state.pregunta_actual = pregunta_seleccionada
        st.session_state.preguntes_recents.append(idx)
    else:
        st.session_state.pregunta_actual = None
    
    st.session_state.missatge_feedback = ""

def verificar_resposta(resposta_usuari):
    pregunta = st.session_state.pregunta_actual
    st.session_state.preguntes_respostes += 1
    
    multiplicador = 2 if st.session_state.bonus_gc_turns > 0 else 1

    if resposta_usuari == pregunta["resposta_correcta"]:
        guany_gc = pregunta["gc_guany"] * multiplicador
        st.session_state.saldo_gc += guany_gc
        st.session_state.puntuacio_coneixement += pregunta['dificultat']
        st.session_state.respostes_correctes += 1
        feedback_extra = " (Bono x2 Actiu!)" if multiplicador > 1 else ""
        st.session_state.missatge_feedback = f"🎉 Resposta Correcta! <span class='feedback-guany'>+{guany_gc} GC</span>{feedback_extra}"
        st.session_state.cambio_saldo = guany_gc
    else:
        perdua_gc = pregunta["gc_perdua"]
        st.session_state.saldo_gc -= perdua_gc
        st.session_state.missatge_feedback = f"😔 Resposta Incorrecta. <span class='feedback-perdua'>-{perdua_gc} GC</span>"
        st.session_state.cambio_saldo = -perdua_gc
        categoria_error = pregunta.get('categoria', 'General')
        st.session_state.errors_per_categoria[categoria_error] = st.session_state.errors_per_categoria.get(categoria_error, 0) + 1

    if st.session_state.bonus_gc_turns > 0:
        st.session_state.bonus_gc_turns -= 1
        if st.session_state.bonus_gc_turns == 0:
            st.toast("El teu Bono x2 ha acabat!", icon="🌱")

    st.session_state.mostrar_cambio = True
    generar_pregunta()

# --- DISSENY DE LA INTERFÍCIE (UI) ---
st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
        :root {
            --primary-color: #8D6E63; --accent-color: #795548; --text-color: #E0E0E0;
            --dark-bg: #1a1a1a; --card-bg: rgba(255, 255, 255, 0.05); --border-color: rgba(255, 255, 255, 0.1);
            --border-radius: 16px; --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        html, body, [class*="st-emotion"] { font-family: 'Poppins', sans-serif; color: var(--text-color); background-color: var(--dark-bg); }
        h1, h2, h3, h5 { font-family: 'Poppins', sans-serif; font-weight: 700; color: white; }
        .app-header h1 {
            font-size: 2.5em; text-align: center; margin-bottom: 2rem;
            background: -webkit-linear-gradient(45deg, #A1887F, #FFAB91);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .glass-card {
            background: var(--card-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            border-radius: var(--border-radius); border: 1px solid var(--border-color);
            padding: 25px; text-align: center; position: relative; box-shadow: var(--shadow);
        }
        .glass-card h2 { font-size: 1em; color: #BDBDBD; margin: 0; font-weight: 600; text-transform: uppercase; }
        .glass-card p { font-size: 2.5em; font-weight: 700; color: white; margin: 5px 0 0 0; }
        .saldo-change { position: absolute; top: 15px; right: 20px; font-size: 1.5em; font-weight: 700; animation: fadeInOut 1.5s ease-in-out forwards; }
        .saldo-change.positive { color: #81C784; } .saldo-change.negative { color: #E57373; }
        @keyframes fadeInOut { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
        .stButton>button {
            background-image: linear-gradient(90deg, var(--primary-color) 0%, var(--accent-color) 100%);
            color: white; border: none; border-radius: 12px; padding: 16px 30px; font-size: 1.1em;
            font-family: 'Poppins', sans-serif; font-weight: 600; width: 100%; transition: all 0.3s ease;
            margin-top: 15px; box-shadow: 0 4px 15px rgba(121, 85, 72, 0.2);
        }
        .stButton>button:hover { transform: translateY(-3px); box-shadow: 0 7px 20px rgba(121, 85, 72, 0.4); }
        .stButton>button:disabled { background-image: none; background-color: #424242; cursor: not-allowed; box-shadow: none; }
        .feedback-guany { color: #81C784; } .feedback-perdua { color: #E57373; }
        .career-path { position: relative; padding-left: 30px; border-left: 2px solid var(--border-color); }
        .step { position: relative; margin-bottom: 2rem; }
        .step-icon { position: absolute; left: -44px; top: 50%; transform: translateY(-50%); font-size: 1.8em; background: var(--dark-bg); padding: 5px; border-radius: 50%; }
        .step.unlocked .step-icon { color: #A1887F; }
        .step-details p { font-weight: 600; margin: 0; color: white; }
        .step-details span { font-size: 0.9em; color: #BDBDBD; }
        .step.locked .step-details { opacity: 0.5; }
        div[data-baseweb="tab-list"] { background: var(--card-bg); border-radius: var(--border-radius); padding: 10px; border: 1px solid var(--border-color); }
        button[data-baseweb="tab"] { background-color: transparent; color: var(--text-color); border-radius: 10px; font-family: 'Poppins', sans-serif; font-weight: 600; }
        button[data-baseweb="tab"][aria-selected="true"] { background-image: linear-gradient(90deg, var(--primary-color) 0%, var(--accent-color) 100%); color: white; }
    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---
st.markdown("<div class='app-header'><h1>🌱 Terra-Expert: El Repte de l'Edafologia</h1></div>", unsafe_allow_html=True)

col_stats_1, col_stats_2, col_stats_3 = st.columns(3)
with col_stats_1:
    saldo_html = f"""<div class="glass-card"><h2>Capital (GC)</h2><p>{st.session_state.saldo_gc:.0f}</p>"""
    if st.session_state.mostrar_cambio and st.session_state.cambio_saldo != 0:
        saldo_html += f'<div class="saldo-change {"positive" if st.session_state.cambio_saldo > 0 else "negative"}">{"+" if st.session_state.cambio_saldo > 0 else ""}{st.session_state.cambio_saldo}</div>'
    saldo_html += "</div>"
    st.markdown(saldo_html, unsafe_allow_html=True)

with col_stats_2:
    st.markdown(f"""<div class="glass-card"><h2>Punts Coneixement</h2><p>{st.session_state.puntuacio_coneixement}</p></div>""", unsafe_allow_html=True)

with col_stats_3:
    total_respostes = st.session_state.get('preguntes_respostes', 0)
    correctes = st.session_state.get('respostes_correctes', 0)
    percentatge_encert = (correctes / total_respostes * 100) if total_respostes > 0 else 0
    st.markdown(f"""<div class="glass-card"><h2>% Encerts</h2><p>{percentatge_encert:.1f}%</p></div>""", unsafe_allow_html=True)

st.write("")

tab1, tab2, tab3 = st.tabs(["🚀 Simulador", "🎓 Pla de Carrera", "📊 El Teu Rendiment"])

with tab1:
    if st.session_state.pregunta_actual is None:
        if st.button("Començar Simulació", key="btn_generar_inicial"):
            generar_pregunta()
            st.rerun()
    else:
        pregunta = st.session_state.pregunta_actual
        st.markdown(f"**Nivell de Certificació:** `{pregunta['dificultat']}` | **Categoria:** `{pregunta['categoria']}`")
        st.markdown(f"#### {pregunta['pregunta']}")
        
        opcions = pregunta["opcions"]
        if 'opcions_filtrades' in st.session_state:
            opcions = st.session_state['opcions_filtrades']

        resposta_usuari = st.radio("Selecciona la teva resposta:", opcions, key="radio_respostes", label_visibility="collapsed")
        
        if st.button("Confirmar Resposta", key="btn_enviar_resposta", use_container_width=True):
            if 'opcions_filtrades' in st.session_state:
                del st.session_state['opcions_filtrades'] # Netejar per la pròxima pregunta
            verificar_resposta(resposta_usuari)
            st.rerun()

        if st.session_state.missatge_feedback:
            st.markdown(f"<div style='margin-top: 20px; text-align: center; font-size: 1.1em;'>{st.session_state.missatge_feedback}</div>", unsafe_allow_html=True)
        
        st.markdown("---")
        st.subheader("⚡ Potenciadors")
        if st.session_state.bonus_gc_turns > 0:
            st.info(f"Bono x2 actiu durant {st.session_state.bonus_gc_turns} torns més!")

        p_col1, p_col2, p_col3 = st.columns(3)
        with p_col1:
            if st.button("💧 Pipeta (-2 opcions) | 300 GC", key="pipeta", use_container_width=True, disabled=(st.session_state.saldo_gc < 300)):
                st.session_state.saldo_gc -= 300
                incorrectes = [opt for opt in pregunta['opcions'] if opt != pregunta['resposta_correcta']]
                random.shuffle(incorrectes)
                opcions_a_mantenir = [pregunta['resposta_correcta']] + incorrectes[2:]
                random.shuffle(opcions_a_mantenir)
                st.session_state['opcions_filtrades'] = opcions_a_mantenir
                st.toast("Dues opcions incorrectes eliminades!", icon="💧")
                st.rerun()

        with p_col2:
            if st.button("🌱 Fertilitzant (Bono x2) | 800 GC", key="fertilitzant", use_container_width=True, disabled=(st.session_state.saldo_gc < 800 or st.session_state.bonus_gc_turns > 0)):
                st.session_state.saldo_gc -= 800
                st.session_state.bonus_gc_turns = 3
                st.toast("Bono x2 activat per 3 preguntes!", icon="🌱")
                st.rerun()
        
        with p_col3:
            if st.button("🛰️ Anàlisi Sàtrapa | 1500 GC", key="satrap", use_container_width=True, disabled=(st.session_state.saldo_gc < 1500)):
                 st.session_state.saldo_gc -= 1500
                 verificar_resposta(pregunta["resposta_correcta"])
                 st.toast("Resposta correcta automàtica!", icon="🛰️")
                 st.rerun()


with tab2:
    st.subheader("El Teu Camí a l'Expertesa")
    st.markdown('<div class="career-path">', unsafe_allow_html=True)

    for i, cert in enumerate(st.session_state.get('certificacions', [])):
        status_class = "unlocked" if cert["unlocked"] else "locked"
        can_unlock = st.session_state.certificacions[i-1]['unlocked'] if i > 0 else True
        
        st.markdown(f'<div class="step {status_class}">', unsafe_allow_html=True)
        st.markdown(f'<span class="step-icon">{cert["icon"]}</span>', unsafe_allow_html=True)
        st.markdown(f"""
            <div class="step-details">
                <p>{cert['nom']}</p>
                <span>{'✅ Certificació Obtinguda' if cert['unlocked'] else f"Inversió: {cert['cost']} GC"}</span>
            </div>
        """, unsafe_allow_html=True)
        
        if not cert['unlocked'] and can_unlock:
            if st.button(f"Desbloquejar Nivell {cert['id']}", key=f"buy_cert_{cert['id']}", disabled=(st.session_state.saldo_gc < cert['cost'])):
                st.session_state.saldo_gc -= cert['cost']
                st.session_state.certificacions[i]['unlocked'] = True
                st.success(f"Has obtingut la certificació '{cert['nom']}'!")
                time.sleep(1.5)
                st.rerun()
        
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)

with tab3:
    st.subheader("Anàlisi de Rendiment")
    if st.session_state.preguntes_respostes > 0:
        st.markdown("<h5>Estadístiques Generals</h5>", unsafe_allow_html=True)
        st.markdown(f"""
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #BDBDBD;">Percentatge d'Encerts</span><span style="font-weight: 600;">{percentatge_encert:.1f}%</span></div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #BDBDBD;">Preguntes Respostes</span><span style="font-weight: 600;">{total_respostes}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #BDBDBD;">Respostes Correctes</span><span style="font-weight: 600; color: #81C784;">{correctes}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #BDBDBD;">Respostes Incorrectes</span><span style="font-weight: 600; color: #E57373;">{total_respostes - correctes}</span></div>
        """, unsafe_allow_html=True)
        
        st.write("")
        st.markdown("<h5>Àrees de Millora (Errors per Categoria)</h5>", unsafe_allow_html=True)
        if st.session_state.errors_per_categoria:
            errors_df = pd.DataFrame(list(st.session_state.errors_per_categoria.items()), columns=['Categoria', 'Errors'])
            chart = alt.Chart(errors_df).mark_bar(cornerRadius=5, height=25).encode(
                x=alt.X('Errors:Q', title="Nombre d'Errors"),
                y=alt.Y('Categoria:N', title="", sort='-x'),
                tooltip=['Categoria', 'Errors'],
                color=alt.Color('Categoria:N', legend=None, scale=alt.Scale(scheme='browns', reverse=True))
            ).configure_axis(labelColor='#E0E0E0', titleColor='#BDBDBD', gridColor='rgba(255, 255, 255, 0.1)', domain=False
            ).configure_view(strokeWidth=0).configure(background='transparent')
            st.altair_chart(chart, use_container_width=True)
        else:
            st.success("🎉 De moment, cap error! El teu rendiment és perfecte.")
    else:
        st.info("Comença el simulador per veure les teves estadístiques de rendiment.")

# Lògica de l'animació del saldo
if st.session_state.get('mostrar_cambio', False):
    time.sleep(1.5)
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()
