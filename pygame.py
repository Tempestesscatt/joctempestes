import streamlit as st
import time
import random
import pandas as pd
import altair as alt
from collections import deque

# --- ESTRUCTURES DE DADES EQUILIBRADES ---

# Pla de Carrera Professional - Costos reequilibrats
EXAMENS_INFO = [
    {"id": 1, "nom": "Fonaments de la Comunicació", "cost": 0, "nivell_dificultat": 1, "icon": "🗣️"},
    {"id": 2, "nom": "Certificat en Assertivitat", "cost": 150, "nivell_dificultat": 2, "icon": "⚖️"},
    {"id": 3, "nom": "Avançat en Intel·ligència Emocional", "cost": 400, "nivell_dificultat": 2, "icon": "💡"},
    {"id": 4, "nom": "Diploma en Resolució de Conflictes", "cost": 800, "nivell_dificultat": 3, "icon": "🤝"},
    {"id": 5, "nom": "Màster en Negociació Estratègica", "cost": 1500, "nivell_dificultat": 3, "icon": "📈"},
    {"id": 6, "nom": "Postgrau en Lideratge d'Equips", "cost": 3000, "nivell_dificultat": 4, "icon": "👑"},
]

# --- BANC DE 120 PREGUNTES COMPLET ---
PREGUNTES_HABILITATS = [
    # NIVELL 1
    {"pregunta": "¿Quina és la millor manera d'escoltar activament?", "opcions": ["Interrompre", "Mirar al mòbil", "Fer contacte visual i assentir", "Planificar la resposta"], "resposta_correcta": "Fer contacte visual i assentir", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Escolta Activa"},
    {"pregunta": "¿Com respons a una crítica constructiva?", "opcions": ["Defensivament", "Ignorant-la", "Agraint i preguntant com millorar", "Criticant a l'altre"], "resposta_correcta": "Agraint i preguntant com millorar", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Feedback"},
    # NIVELL 2
    {"pregunta": "Un company et demana ajuda urgent, però ja vas molt carregat. Quina és la resposta més assertiva?", "opcions": ["Dir 'sí' i treballar fins tard", "Dir 'no' sense explicacions", "Explicar que t'agradaria ajudar però ara no pots", "Criticar la seva planificació"], "resposta_correcta": "Explicar que t'agradaria ajudar però ara no pots", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "Què és l'empatia?", "opcions": ["Sentir pena", "Solucionar problemes aliens", "Comprendre i compartir els sentiments d'altres", "Estar sempre d'acord"], "resposta_correcta": "Comprendre i compartir els sentiments d'altres", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    # NIVELL 3
    {"pregunta": "En una negociació, l'altra part es mostra agressiva. Què és aconsellable?", "opcions": ["Respondre igual", "Mantenir la calma i centrar-se en fets", "Acceptar les seves condicions", "Marxar"], "resposta_correcta": "Mantenir la calma i centrar-se en fets", "eco_guany": 70, "eco_perdua": 35, "dificultat": 3, "categoria": "Negociació"},
    {"pregunta": "Dos membres del teu equip tenen un conflicte obert. Quina és la teva primera acció com a líder?", "opcions": ["Ignorar-ho", "Canviar un d'ells de projecte", "Mediar en una reunió conjunta", "Demanar a RRHH que intervingui"], "resposta_correcta": "Mediar en una reunió conjunta", "eco_guany": 70, "eco_perdua": 35, "dificultat": 3, "categoria": "Gestió de Conflictes"},
    # NIVELL 4
    {"pregunta": "Has de comunicar una decisió impopular a l'equip. Quina és la millor estratègia?", "opcions": ["Enviar un email breu", "Ser transparent sobre les raons i mostrar empatia", "Demanar a un altre que ho faci", "Anunciar-ho divendres a última hora"], "resposta_correcta": "Ser transparent sobre les raons i mostrar empatia", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "Com es fomenta la 'seguretat psicològica' en un equip?", "opcions": ["Castigant els errors", "Promovent competència extrema", "Creant un entorn on es pot parlar obertament sense por", "Prenent decisions sense consultar"], "resposta_correcta": "Creant un entorn on es pot parlar obertament sense por", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
]

# --- CONFIGURACIÓ INICIAL I D'ESTAT DE LA SESSIÓ ---
if 'saldo_eco' not in st.session_state:
    st.session_state.saldo_eco = 500
if 'puntuacio_habilitats' not in st.session_state:
    st.session_state.puntuacio_habilitats = 0
if 'pregunta_actual' not in st.session_state:
    st.session_state.pregunta_actual = None
if 'missatge_feedback' not in st.session_state:
    st.session_state.missatge_feedback = ""
if 'cambio_saldo' not in st.session_state:
    st.session_state.cambio_saldo = 0 
if 'mostrar_cambio' not in st.session_state:
    st.session_state.mostrar_cambio = False
if 'examens' not in st.session_state:
    examens_amb_estat = [dict(examen, unlocked=(examen['id'] == 1)) for examen in EXAMENS_INFO]
    st.session_state.examens = examens_amb_estat
if 'preguntes_respostes' not in st.session_state:
    st.session_state.preguntes_respostes = 0
if 'respostes_correctes' not in st.session_state:
    st.session_state.respostes_correctes = 0
if 'errors_per_categoria' not in st.session_state:
    st.session_state.errors_per_categoria = {}
if 'preguntes_recents' not in st.session_state:
    st.session_state.preguntes_recents = deque(maxlen=15)

# --- FUNCIONS DEL JOC ---
def generar_pregunta():
    nivell_maxim = max(ex['nivell_dificultat'] for ex in st.session_state.examens if ex['unlocked'])
    preguntes_disponibles = [
        (i, p) for i, p in enumerate(PREGUNTES_HABILITATS) 
        if p['dificultat'] <= nivell_maxim and i not in st.session_state.preguntes_recents
    ]
    if not preguntes_disponibles:
        st.session_state.preguntes_recents.clear()
        preguntes_disponibles = [(i, p) for i, p in enumerate(PREGUNTES_HABILITATS) if p['dificultat'] <= nivell_maxim]
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
    if resposta_usuari == pregunta["resposta_correcta"]:
        guany_eco = pregunta["eco_guany"]
        st.session_state.saldo_eco += guany_eco
        st.session_state.puntuacio_habilitats += 1
        st.session_state.respostes_correctes += 1
        st.session_state.missatge_feedback = f"🎉 Resposta Correcta! <span class='feedback-guany'>+{guany_eco} ECO$</span>"
        st.session_state.cambio_saldo = guany_eco
    else:
        perdua_eco = pregunta["eco_perdua"]
        st.session_state.saldo_eco -= perdua_eco
        st.session_state.missatge_feedback = f"😔 Resposta Incorrecta. <span class='feedback-perdua'>-{perdua_eco} ECO$</span>"
        st.session_state.cambio_saldo = -perdua_eco
        categoria_error = pregunta.get('categoria', 'General')
        st.session_state.errors_per_categoria[categoria_error] = st.session_state.errors_per_categoria.get(categoria_error, 0) + 1
    st.session_state.mostrar_cambio = True
    generar_pregunta()

# --- DISSENY DE LA INTERFÍCIE (UI) ---
st.set_page_config(page_title="ECO-Banc: Desenvolupament Pro", page_icon="✨", layout="wide")

st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
        :root {
            --primary-color: #4A90E2; --accent-color: #50E3C2; --text-color: #E0E0E0;
            --dark-bg: #121212; --card-bg: rgba(255, 255, 255, 0.05); --border-color: rgba(255, 255, 255, 0.1);
            --border-radius: 20px; --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        html, body, [class*="st-emotion"] { font-family: 'Poppins', sans-serif; color: var(--text-color); background-color: var(--dark-bg); }
        h1, h2, h3, h5 { font-family: 'Poppins', sans-serif; font-weight: 700; color: white; }
        .app-header h1 {
            font-size: 2.5em; text-align: center; margin-bottom: 2rem;
            background: -webkit-linear-gradient(45deg, var(--primary-color), var(--accent-color));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .glass-card {
            background: var(--card-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            border-radius: var(--border-radius); border: 1px solid var(--border-color);
            padding: 25px; text-align: center; position: relative; box-shadow: var(--shadow);
        }
        .glass-card h2 { font-size: 1em; color: #BDBDBD; margin: 0; font-weight: 600; }
        .glass-card p { font-size: 2.5em; font-weight: 700; color: white; margin: 5px 0 0 0; }
        .saldo-change { position: absolute; top: 15px; right: 20px; font-size: 1.5em; font-weight: 700; animation: fadeInOut 1.5s ease-in-out forwards; }
        .saldo-change.positive { color: var(--accent-color); }
        .saldo-change.negative { color: #FF5252; }
        @keyframes fadeInOut { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
        .stButton>button {
            background-image: linear-gradient(90deg, var(--primary-color) 0%, var(--accent-color) 100%);
            color: white; border: none; border-radius: 12px; padding: 16px 30px; font-size: 1.1em;
            font-family: 'Poppins', sans-serif; font-weight: 600; width: 100%; transition: all 0.3s ease;
            margin-top: 15px; box-shadow: 0 4px 15px rgba(80, 227, 194, 0.2);
        }
        .stButton>button:hover { transform: translateY(-3px); box-shadow: 0 7px 20px rgba(80, 227, 194, 0.3); }
        .stButton>button:disabled { background-image: none; background-color: #424242; cursor: not-allowed; box-shadow: none; }
        .feedback-guany { color: var(--accent-color); } .feedback-perdua { color: #FF5252; }
        .career-path { position: relative; padding-left: 30px; border-left: 2px solid var(--border-color); }
        .step { position: relative; margin-bottom: 2rem; }
        .step-icon { position: absolute; left: -44px; top: 50%; transform: translateY(-50%); font-size: 1.8em; background: var(--dark-bg); padding: 5px; border-radius: 50%; }
        .step.unlocked .step-icon { color: var(--accent-color); }
        .step-details p { font-weight: 600; margin: 0; color: white; }
        .step-details span { font-size: 0.9em; color: #BDBDBD; }
        .step.locked .step-details { opacity: 0.5; }
        .stRadio > label { color: white !important; } /* Assegura que les opcions del radio siguin visibles */
        .stExpander { border: 1px solid var(--border-color) !important; border-radius: var(--border-radius) !important; background: var(--card-bg) !important; }
    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---
st.markdown("<div class='app-header'><h1>ECO-Banc: Desenvolupament Professional</h1></div>", unsafe_allow_html=True)

col_stats_1, col_stats_2, col_stats_3 = st.columns(3)
with col_stats_1:
    saldo_html = f"""<div class="glass-card"><h2>Capital (ECO$)</h2><p>{st.session_state.saldo_eco:.0f}</p>"""
    if st.session_state.mostrar_cambio and st.session_state.cambio_saldo != 0:
        saldo_html += f'<div class="saldo-change {"positive" if st.session_state.cambio_saldo > 0 else "negative"}">{"+" if st.session_state.cambio_saldo > 0 else ""}{st.session_state.cambio_saldo}</div>'
    saldo_html += "</div>"
    st.markdown(saldo_html, unsafe_allow_html=True)

with col_stats_2:
    st.markdown(f"""<div class="glass-card"><h2>Puntuació</h2><p>{st.session_state.puntuacio_habilitats}</p></div>""", unsafe_allow_html=True)

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
        st.markdown(f"**Nivell de Certificació:** `{pregunta['dificultat']}`")
        st.markdown(f"#### {pregunta['pregunta']}")
        
        resposta_usuari = st.radio("Selecciona la teva decisió:", pregunta["opcions"], key="radio_respostes", label_visibility="collapsed")
        
        if st.button("Confirmar Decisió", key="btn_enviar_resposta", use_container_width=True):
            verificar_resposta(resposta_usuari)
            st.rerun()

        if st.session_state.missatge_feedback:
            st.markdown(f"<div style='margin-top: 20px; text-align: center; font-size: 1.1em;'>{st.session_state.missatge_feedback}</div>", unsafe_allow_html=True)

with tab2:
    st.subheader("El Teu Camí Professional")
    st.markdown('<div class="career-path">', unsafe_allow_html=True)

    for i, examen in enumerate(st.session_state.get('examens', [])):
        status_class = "unlocked" if examen["unlocked"] else "locked"
        can_unlock = st.session_state.examens[i-1]['unlocked'] if i > 0 else True
        
        st.markdown(f'<div class="step {status_class}">', unsafe_allow_html=True)
        st.markdown(f'<span class="step-icon">{examen["icon"]}</span>', unsafe_allow_html=True)
        st.markdown(f"""
            <div class="step-details">
                <p>{examen['nom']}</p>
                <span>{'✅ Certificació Obtinguda' if examen['unlocked'] else f"Inversió: {examen['cost']} ECO$"}</span>
            </div>
        """, unsafe_allow_html=True)
        
        if not examen['unlocked'] and can_unlock:
            if st.button(f"Desbloquejar", key=f"buy_exam_{examen['id']}", disabled=(st.session_state.saldo_eco < examen['cost'])):
                st.session_state.saldo_eco -= examen['cost']
                st.session_state.examens[i]['unlocked'] = True
                st.success(f"Has obtingut la certificació '{examen['nom']}'!")
                time.sleep(1.5)
                st.rerun()
        
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)

with tab3:
    st.subheader("Anàlisi de Rendiment")
    if st.session_state.preguntes_respostes > 0:
        st.markdown("<h5>Estadístiques Generals</h5>", unsafe_allow_html=True)
        st.markdown(f"""
            <div class="stat-item"><span class="stat-label">Percentatge d'Encerts</span><span class="stat-value">{percentatge_encert:.1f}%</span></div>
            <div class="stat-item"><span class="stat-label">Preguntes Respostes</span><span class="stat-value">{total_respostes}</span></div>
            <div class="stat-item"><span class="stat-label">Respostes Correctes</span><span class="stat-value" style="color: var(--accent-color);">{correctes}</span></div>
            <div class="stat-item"><span class="stat-label">Respostes Incorrectes</span><span class="stat-value" style="color: #FF5252;">{total_respostes - correctes}</span></div>
        """, unsafe_allow_html=True)
        
        st.write("")
        st.markdown("<h5>Àrees de Millora</h5>", unsafe_allow_html=True)
        if st.session_state.errors_per_categoria:
            errors_df = pd.DataFrame(list(st.session_state.errors_per_categoria.items()), columns=['Habilitat', 'Errors'])
            chart = alt.Chart(errors_df).mark_bar(
                cornerRadius=5,
                height=25
            ).encode(
                x=alt.X('Errors:Q', title="Nombre d'Errors"),
                y=alt.Y('Habilitat:N', title="", sort='-x'),
                tooltip=['Habilitat', 'Errors'],
                color=alt.Color('Habilitat:N', legend=None, scale=alt.Scale(scheme='blues', reverse=True))
            ).properties(
                title=alt.TitleParams(text='Errors per Categoria', anchor='start', color='#E0E0E0')
            ).configure_view(
                strokeWidth=0
            ).configure_axis(
                labelColor='#E0E0E0',
                titleColor='#BDBDBD',
                gridColor='rgba(255, 255, 255, 0.1)',
                domain=False
            ).configure(
                background='transparent'
            )
            st.altair_chart(chart, use_container_width=True)
        else:
            st.success("🎉 De moment, cap error! El teu rendiment és perfecte.")
    else:
        st.info("Comença el simulador per veure les teves estadístiques de rendiment.")

# Lògica de l'animació
if st.session_state.get('mostrar_cambio', False):
    time.sleep(1.5)
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()

