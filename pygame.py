

import streamlit as st
import time
import random
# Importem la nostra llista massiva de preguntes des de l'altre arxiu
from preguntes import PREGUNTES_HABILITATS

# --- ESTRUCTURES DE DADES ---
EXAMENS_INFO = [
    {"id": 1, "nom": "Fonaments de la Comunicació", "cost": 0, "nivell_dificultat": 1},
    {"id": 2, "nom": "Certificat en Assertivitat", "cost": 300, "nivell_dificultat": 2},
    {"id": 3, "nom": "Avançat en Intel·ligència Emocional", "cost": 750, "nivell_dificultat": 2},
    {"id": 4, "nom": "Diploma en Resolució de Conflictes", "cost": 1500, "nivell_dificultat": 3},
    {"id": 5, "nom": "Màster en Negociació Estratègica", "cost": 3000, "nivell_dificultat": 3},
    {"id": 6, "nom": "Postgrau en Lideratge d'Equips", "cost": 5000, "nivell_dificultat": 4},
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
    if preguntes_disponibles:
        st.session_state.pregunta_actual = random.choice(preguntes_disponibles)
    else:
        st.session_state.pregunta_actual = None # No hi ha preguntes per al nivell
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

st.set_page_config(page_title="ECO-Banc: Habilitats de Comunicació", page_icon="🏦", layout="wide")

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
        .content-card { background-color: var(--card-bg); border-radius: var(--border-radius); padding: 35px; box-shadow: var(--shadow-sm); min-height: 500px; }
        .stButton>button { background-color: var(--primary-color); color: white; border: none; border-radius: 10px; padding: 14px 28px; font-size: 1.1em; font-family: 'Montserrat', sans-serif; font-weight: 600; width: 100%; transition: all 0.2s ease; margin-top: 15px; box-shadow: 0 4px 10px rgba(0, 68, 129, 0.2); }
        .stButton>button:hover { transform: translateY(-3px); box-shadow: 0 7px 15px rgba(0, 68, 129, 0.3); }
        .stButton>button:disabled { background-color: #a9cce3; opacity: 0.6; cursor: not-allowed; box-shadow: none; }
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

st.title("ECO-Banc: Habilitats de Comunicació")

col_stats_1, col_stats_2 = st.columns(2)
# ... (El codi de les targetes de saldo i puntuació es manté exactament igual) ...
with col_stats_1:
    saldo_html = f"""
        <div class="stat-card">
            <div style="display: flex; align-items: center;">
                <span class="icon">🏦</span>
                <div class="details">
                    <h2>Capital d'Habilitats (ECO$)</h2>
                    <p>{st.session_state.saldo_eco:.0f}</p>
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
    st.markdown(f"""
        <div class="stat-card" style="border-top-color: var(--accent-color);">
            <div style="display: flex; align-items: center; width: 100%;">
                <span class="icon">🧠</span>
                <div class="details" style="width: 100%;">
                    <h2>Puntuació Professional</h2>
                    <p>{st.session_state.puntuacio_habilitats}</p>
                </div>
            </div>
        </div>
    """, unsafe_allow_html=True)

st.write("") 

col1, col2 = st.columns([6, 4])

with col1:
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.subheader("Simulador de Casos Pràctics")

    if st.session_state.pregunta_actual is None:
        if st.button("Començar Simulació", key="btn_generar_inicial"):
            generar_pregunta()
            st.rerun()
    else:
        pregunta = st.session_state.pregunta_actual
        st.markdown(f"**Certificació de Nivell:** `{pregunta['dificultat']}`")
        st.markdown(f"#### {pregunta['pregunta']}")
        
        resposta_usuari = st.radio("Selecciona la teva decisió:", pregunta["opcions"], key="radio_respostes", label_visibility="collapsed")
        
        if st.button("Confirmar Decisió", key="btn_enviar_resposta", use_container_width=True):
            verificar_resposta(resposta_usuari)
            st.rerun()

        if st.session_state.missatge_feedback:
            st.markdown(f"<div style='margin-top: 20px; text-align: center; font-size: 1.1em;'>{st.session_state.missatge_feedback}</div>", unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)

with col2:
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.subheader("Pla de Carrera Professional")

    for i, examen in enumerate(st.session_state.examens):
        status_class = "unlocked" if examen["unlocked"] else "locked"
        can_unlock = st.session_state.examens[i-1]['unlocked'] if i > 0 else True
        
        col_exam_1, col_exam_2 = st.columns([3, 1])

        with col_exam_1:
            st.markdown(f"""
                <div class="exam-item {status_class}" style="grid-template-columns: 40px 1fr; margin-bottom: 22px;">
                    <span class="exam-icon">🎓</span>
                    <div class="exam-details">
                        <p>{examen['nom']}</p>
                        <span>{'✅ Desbloquejat' if examen['unlocked'] else f"Cost: {examen['cost']} ECO$"}</span>
                    </div>
                </div>
            """, unsafe_allow_html=True)

        if not examen['unlocked'] and can_unlock:
            with col_exam_2:
                 if st.button(f"Invertir", key=f"buy_exam_{examen['id']}", disabled=(st.session_state.saldo_eco < examen['cost'])):
                    st.session_state.saldo_eco -= examen['cost']
                    st.session_state.examens[i]['unlocked'] = True
                    st.success(f"Has desbloquejat '{examen['nom']}'!")
                    time.sleep(1.5)
                    st.rerun()
    
    with st.expander("Recursos Addicionals del Curs"):
        st.markdown("""
        - **"Donde tus sueños te lleven"**: [Veure vídeo](https://www.youtube.com/watch?v=b2UyFJ_GMZc)
        - **"Optimismo Inteligente"**: [Veure vídeo](https://www.youtube.com/watch?v=4SnJjLc70E)
        - **Causa i funció de les emocions**: [Veure vídeo](https://www.youtube.com/watch?v=8LRkYJSSKK8)
        - **Test d'Assertivitat de Rathus**: [Fer test online](https://www.psicoactiva.com/test/test-de-asertividad-de-rathus.htm)
        """)

    st.markdown('</div>', unsafe_allow_html=True)

# Lògica de l'animació
if st.session_state.mostrar_cambio:
    time.sleep(1.5)
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()

