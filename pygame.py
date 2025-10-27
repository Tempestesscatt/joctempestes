
import streamlit as st
import time
import random

# --- ESTRUCTURES DE DADES ---

# Llista d'exàmens desbloquejables
EXAMENS_INFO = [
    {"id": 1, "nom": "Fonaments de la Comunicació", "cost": 0, "nivell_dificultat": 1},
    {"id": 2, "nom": "Certificat en Assertivitat", "cost": 250, "nivell_dificultat": 2},
    {"id": 3, "nom": "Avançat en Intel·ligència Emocional", "cost": 500, "nivell_dificultat": 2},
    {"id": 4, "nom": "Diploma en Resolució de Conflictes", "cost": 1000, "nivell_dificultat": 3},
    {"id": 5, "nom": "Màster en Negociació Estratègica", "cost": 2000, "nivell_dificultat": 3},
    # Aquí es podrien afegir 5 exàmens més amb costos i dificultats creixents
]

# Banc de preguntes amb nivells de dificultat
PREGUNTES_HABILITATS = [
    # --- NIVELL 1 ---
    {"pregunta": "¿Quina és la millor manera d'escoltar activament?", "opcions": ["Interrompre per donar la teva opinió", "Mirar al mòbil mentre l'altre parla", "Fer contacte visual i assentir amb el cap", "Planificar la teva resposta abans que acabi"], "resposta_correcta": "Fer contacte visual i assentir amb el cap", "pista": "Implica atenció plena.", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "¿Com respons a una crítica constructiva sobre la teva feina?", "opcions": ["Posar-te a la defensiva", "Ignorar-la", "Agrair el feedback i preguntar com millorar", "Criticar a l'altra persona"], "resposta_correcta": "Agrair el feedback i preguntar com millorar", "pista": "És una oportunitat de creixement.", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1},
    
    # --- NIVELL 2 ---
    {"pregunta": "Un company de feina rep el crèdit per una idea que era teva. Com reacciones?", "opcions": ["No dir res i sentir-te ressentit", "Exposar-lo davant de tothom", "Parlar amb ell en privat de manera calmada", "Queixar-te al teu cap immediatament"], "resposta_correcta": "Parlar amb ell en privat de manera calmada", "pista": "La discreció i l'assertivitat són clau.", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2},
    {"pregunta": "Estàs en una reunió i no estàs d'acord amb una proposta del teu superior. Què fas?", "opcions": ["Callar per no crear conflicte", "Dir directament que la idea és dolenta", "Exposar la teva perspectiva amb arguments i dades", "Criticar la idea amb altres companys després"], "resposta_correcta": "Exposar la teva perspectiva amb arguments i dades", "pista": "Les dades i el respecte donen força a la teva opinió.", "eco_guany": 30, "eco_perdua": 15, "dificultat": 2},
    
    # --- NIVELL 3 ---
    {"pregunta": "Dos membres del teu equip tenen un conflicte obert que afecta la productivitat. Quina és la teva primera acció com a líder?", "opcions": ["Ignorar-ho esperant que se solucioni sol", "Canviar un d'ells de projecte immediatament", "Mediar en una reunió conjunta per entendre les dues parts", "Demanar a Recursos Humans que intervingui sense parlar amb ells"], "resposta_correcta": "Mediar en una reunió conjunta per entendre les dues parts", "pista": "Un bon líder afronta els problemes per entendre'ls abans d'actuar.", "eco_guany": 50, "eco_perdua": 20, "dificultat": 3},
    {"pregunta": "Has de comunicar una decisió impopular a l'equip (p. ex., cancel·lar un projecte esperat). Com ho fas?", "opcions": ["Enviar un correu electrònic breu i sense detalls", "Explicar les raons estratègiques amb transparència i empatia", "Demanar a un altre que doni la notícia", "Anunciar-ho al final del dia per evitar preguntes"], "resposta_correcta": "Explicar les raons estratègiques amb transparència i empatia", "pista": "La transparència i l'empatia generen confiança, fins i tot amb males notícies.", "eco_guany": 60, "eco_perdua": 25, "dificultat": 3},
]


# --- CONFIGURACIÓ INICIAL I D'ESTAT DE LA SESSIÓ ---
if 'saldo_eco' not in st.session_state:
    st.session_state.saldo_eco = 300
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

# --- FUNCIONS DEL JOC ---
def generar_pregunta():
    nivell_maxim_desbloquejat = max(ex['nivell_dificultat'] for ex in st.session_state.examens if ex['unlocked'])
    preguntes_disponibles = [p for p in PREGUNTES_HABILITATS if p['dificultat'] <= nivell_maxim_desbloquejat]
    st.session_state.pregunta_actual = random.choice(preguntes_disponibles)
    st.session_state.missatge_feedback = ""

def verificar_resposta(resposta_usuari):
    pregunta = st.session_state.pregunta_actual
    if resposta_usuari == pregunta["resposta_correcta"]:
        guany_eco = pregunta["eco_guany"]
        st.session_state.saldo_eco += guany_eco
        st.session_state.puntuacio_habilitats += 1
        st.session_state.missatge_feedback = f"🎉 Resposta Correcta! <span class='feedback-guany'>+{guany_eco} ECO$</span>"
        st.session_state.cambio_saldo = guany_eco
    else:
        perdua_eco = pregunta["eco_perdua"]
        st.session_state.saldo_eco -= perdua_eco
        st.session_state.missatge_feedback = f"😔 Resposta Incorrecta. <span class='feedback-perdua'>-{perdua_eco} ECO$</span>"
        st.session_state.cambio_saldo = -perdua_eco
    
    st.session_state.mostrar_cambio = True
    generar_pregunta()

# --- DISSENY DE LA INTERFÍCIE (UI) ---

st.set_page_config(page_title="ECO-Banc Habilitats Pro", page_icon="🏦", layout="wide")

st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Montserrat:wght@600;700&display=swap');
        :root {
            --primary-color: #004481; --accent-color: #1db954; --text-color: #333;
            --light-text-color: #777; --background-color: #f0f2f5; --card-bg: #ffffff;
            --border-radius: 16px; --shadow-sm: 0 4px 6px rgba(0,0,0,0.05); --shadow-md: 0 10px 20px rgba(0,0,0,0.07);
        }
        html, body, [class*="st-emotion"] { font-family: 'Roboto', sans-serif; color: var(--text-color); background-color: var(--background-color); }
        h1, h2, h3 { font-family: 'Montserrat', sans-serif; color: var(--primary-color); }
        h1 { font-size: 2.8em; text-align: center; margin-bottom: 25px; background: -webkit-linear-gradient(45deg, var(--primary-color), #007bff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .stat-card { background-color: var(--card-bg); border-radius: var(--border-radius); padding: 25px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; border-top: 5px solid var(--primary-color); transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
        .stat-card .icon { font-size: 3em; margin-right: 20px; line-height: 1; }
        .stat-card .details h2 { font-size: 1.1em; color: var(--light-text-color); margin: 0; }
        .stat-card .details p { font-size: 2.2em; font-weight: 700; color: var(--primary-color); margin: 0; }
        .saldo-change { position: absolute; top: 20px; right: 25px; font-size: 1.6em; font-weight: 700; animation: fadeInOut 1.5s ease-in-out forwards; }
        .saldo-change.positive { color: var(--accent-color); }
        .saldo-change.negative { color: #d9534f; }
        @keyframes fadeInOut { 0% { opacity: 0; transform: translateY(20px); } 20% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } }
        .content-card { background-color: var(--card-bg); border-radius: var(--border-radius); padding: 35px; box-shadow: var(--shadow-sm); height: 100%; }
        .stButton>button { background-color: var(--primary-color); color: white; border: none; border-radius: 10px; padding: 14px 28px; font-size: 1.1em; font-family: 'Montserrat', sans-serif; font-weight: 600; width: 100%; transition: all 0.2s ease; margin-top: 15px; box-shadow: 0 4px 10px rgba(0, 68, 129, 0.2); }
        .stButton>button:hover { transform: translateY(-3px); box-shadow: 0 7px 15px rgba(0, 68, 129, 0.3); }
        .stButton>button:disabled { background-color: #a9cce3; opacity: 0.6; cursor: not-allowed; box-shadow: none; }
        .progress-container { margin-top: 10px; }
        .progress-label { display: flex; justify-content: space-between; font-size: 0.9em; color: var(--light-text-color); margin-bottom: 5px; }
        .progress-bar-bg { background-color: #e9ecef; border-radius: 10px; height: 12px; }
        .progress-bar { background: linear-gradient(90deg, #1db954, #28a745); border-radius: 10px; height: 100%; transition: width 0.5s ease-in-out; }
        .feedback-guany { color: var(--accent-color); font-weight: 700; font-size: 1.1em; }
        .feedback-perdua { color: #d9534f; font-weight: 700; font-size: 1.1em; }
        .exam-item { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 15px; padding: 15px; border-radius: 12px; transition: all 0.2s; margin-bottom: 10px; border: 1px solid #eee; }
        .exam-item.unlocked { background-color: #e8f5e9; border-left: 5px solid var(--accent-color); }
        .exam-item.locked { background-color: #f5f5f5; opacity: 0.8; }
        .exam-icon { font-size: 1.8em; }
        .exam-details p { font-weight: 700; margin: 0; color: var(--primary-color); }
        .exam-details span { font-size: 0.9em; color: var(--light-text-color); }
        .exam-item .stButton>button { width: auto; padding: 6px 18px; font-size: 0.9em; margin-top: 0; }
    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---

st.title("ECO-Banc Desenvolupament Professional")

col_stats_1, col_stats_2 = st.columns(2)
with col_stats_1:
    saldo_html = f"""
        <div class="stat-card">
            <div style="display: flex; align-items: center;">
                <span class="icon">🏦</span>
                <div class="details">
                    <h2>Saldo Actual</h2>
                    <p>{st.session_state.saldo_eco:.2f} ECO$</p>
                </div>
            </div>
    """
    if st.session_state.mostrar_cambio and st.session_state.cambio_saldo != 0:
        if st.session_state.cambio_saldo > 0:
            saldo_html += f'<div class="saldo-change positive">+{st.session_state.cambio_saldo}</div>'
        else:
            saldo_html += f'<div class="saldo-change negative">{st.session_state.cambio_saldo}</div>'
    saldo_html += "</div>"
    st.markdown(saldo_html, unsafe_allow_html=True)

with col_stats_2:
    progress_percent = min(100, (st.session_state.puntuacio_habilitats / 10) * 100)
    st.markdown(f"""
        <div class="stat-card" style="border-top-color: var(--accent-color);">
            <div style="display: flex; align-items: center; width: 100%;">
                <span class="icon">🧠</span>
                <div class="details" style="width: 100%;">
                    <h2>Puntuació d'Habilitats</h2>
                    <p>{st.session_state.puntuacio_habilitats}</p>
                    <div class="progress-container">
                        <div class="progress-label"><span>Nivell d'Expert</span><span>{int(progress_percent)}%</span></div>
                        <div class="progress-bar-bg"><div class="progress-bar" style="width: {progress_percent}%;"></div></div>
                    </div>
                </div>
            </div>
        </div>
    """, unsafe_allow_html=True)

st.write("") 

col1, col2 = st.columns([6, 4])

with col1:
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.subheader("Simulador de Situacions Professionals")

    if st.session_state.pregunta_actual is None:
        if st.button("Començar Simulació", key="btn_generar_inicial"):
            generar_pregunta()
            st.rerun()
    else:
        pregunta = st.session_state.pregunta_actual
        st.markdown(f"**Nivell de Dificultat:** `{pregunta['dificultat']}`")
        st.markdown(f"#### {pregunta['pregunta']}")
        
        resposta_usuari = st.radio("Selecciona la teva decisió:", pregunta["opcions"], key="radio_respostes", label_visibility="collapsed")
        
        if st.button("Confirmar Decisió", key="btn_enviar_resposta", use_container_width=True):
            verificar_resposta(resposta_usuari)
            st.rerun()

        if st.session_state.missatge_feedback:
            st.markdown(f"<div style='margin-top: 20px; text-align: center;'>{st.session_state.missatge_feedback}</div>", unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)

with col2:
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.subheader("Pla de Formació Professional")

    for i, examen in enumerate(st.session_state.examens):
        status_class = "unlocked" if examen["unlocked"] else "locked"
        can_unlock = st.session_state.examens[i-1]['unlocked'] if i > 0 else True

        button_html = ""
        if not examen['unlocked'] and can_unlock:
            # Creamos un placeholder para el botón
            button_placeholder = st.empty()
            # El botón de Streamlit no se puede poner dentro del markdown, lo ponemos fuera
            if button_placeholder.button(f"Invertir", key=f"buy_exam_{examen['id']}", disabled=(st.session_state.saldo_eco < examen['cost'])):
                st.session_state.saldo_eco -= examen['cost']
                st.session_state.examens[i]['unlocked'] = True
                st.success(f"Has desbloquejat '{examen['nom']}'! Nous reptes t'esperen.")
                time.sleep(1)
                st.rerun()

        st.markdown(f"""
            <div class="exam-item {status_class}">
                <span class="exam-icon">🎓</span>
                <div class="exam-details">
                    <p>{examen['nom']}</p>
                    <span>{'✅ Desbloquejat' if examen['unlocked'] else f"Cost: {examen['cost']} ECO$"}</span>
                </div>
            </div>
        """, unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)

# Lògica de l'animació
if st.session_state.mostrar_cambio:
    time.sleep(1.5)
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()

