import streamlit as st
import time
import random

# --- CONFIGURACIÓ INICIAL I D'ESTAT DE LA SESSIÓ ---
if 'saldo_eco' not in st.session_state:
    st.session_state.saldo_eco = 200
if 'puntuacio_habilitats' not in st.session_state:
    st.session_state.puntuacio_habilitats = 0
if 'multiplicador_eco' not in st.session_state:
    st.session_state.multiplicador_eco = 1
if 'pistes_extra' not in st.session_state:
    st.session_state.pistes_extra = 0
if 'pregunta_actual' not in st.session_state:
    st.session_state.pregunta_actual = None
if 'missatge_feedback' not in st.session_state:
    st.session_state.missatge_feedback = ""
if 'mostrar_pista' not in st.session_state:
    st.session_state.mostrar_pista = False
# Variables per a l'animació del saldo
if 'cambio_saldo' not in st.session_state:
    st.session_state.cambio_saldo = 0 
if 'mostrar_cambio' not in st.session_state:
    st.session_state.mostrar_cambio = False

# --- PREGUNTES D'HABILITATS SOCIALS ---
# (S'han afegit més preguntes per a més varietat)
preguntes_habilitats = [
    {
        "pregunta": "Estàs en una reunió i no estàs d'acord amb una proposta. Què fas?",
        "opcions": ["Callar per no crear conflicte", "Dir directament que la idea és dolenta", "Esperar el teu torn i exposar la teva perspectiva amb arguments", "Enviar un missatge a un company queixant-te"],
        "resposta_correcta": "Esperar el teu torn i exposar la teva perspectiva amb arguments",
        "pista": "L'assertivitat constructiva és clau en entorns professionals.",
        "eco_guany": 15,
        "eco_perdua": 10
    },
    {
        "pregunta": "Un company de feina rep el crèdit per una idea que era teva. Com reacciones?",
        "opcions": ["No dir res i sentir-te ressentit", "Exposar-lo davant de tothom a la següent reunió", "Parlar amb ell en privat de manera calmada", "Queixar-te al teu cap immediatament"],
        "resposta_correcta": "Parlar amb ell en privat de manera calmada",
        "pista": "Abordar el conflicte directament però amb discreció sol ser el més efectiu.",
        "eco_guany": 20,
        "eco_perdua": 10
    },
    {
        "pregunta": "Què és més important per construir una bona relació amb els clients?",
        "opcions": ["Oferir sempre el preu més baix", "Parlar constantment de les virtuts del producte", "Escoltar les seves necessitats i mostrar empatia", "Prometre coses que no estàs segur de poder complir"],
        "resposta_correcta": "Escoltar les seves necessitats i mostrar empatia",
        "pista": "La confiança es basa en la comprensió mútua.",
        "eco_guany": 10,
        "eco_perdua": 5
    },
    {
        "pregunta": "¿Com respons a una crítica constructiva sobre la teva feina?",
        "opcions": ["Posar-te a la defensiva i donar excuses", "Ignorar-la completament", "Agrair el feedback i preguntar com pots millorar", "Criticar la feina de l'altra persona"],
        "resposta_correcta": "Agrair el feedback i preguntar com pots millorar",
        "pista": "Veure la crítica com una oportunitat de creixement és un signe de maduresa professional.",
        "eco_guany": 15,
        "eco_perdua": 5
    }
]

# --- FUNCIONS DEL JOC ---
def generar_pregunta():
    st.session_state.pregunta_actual = random.choice(preguntes_habilitats)
    st.session_state.missatge_feedback = ""
    st.session_state.mostrar_pista = False

def verificar_resposta(resposta_usuari):
    if st.session_state.pregunta_actual:
        pregunta = st.session_state.pregunta_actual
        if resposta_usuari == pregunta["resposta_correcta"]:
            guany_eco = pregunta["eco_guany"] * st.session_state.multiplicador_eco
            st.session_state.saldo_eco += guany_eco
            st.session_state.puntuacio_habilitats += 1
            st.session_state.missatge_feedback = f"🎉 ¡Resposta Correcta!"
            st.session_state.cambio_saldo = guany_eco
        else:
            perdua_eco = pregunta["eco_perdua"]
            st.session_state.saldo_eco -= perdua_eco
            st.session_state.missatge_feedback = f"😔 Resposta Incorrecta."
            st.session_state.cambio_saldo = -perdua_eco
        
        st.session_state.mostrar_cambio = True
        generar_pregunta()

def usar_pista():
    if st.session_state.pistes_extra > 0:
        st.session_state.pistes_extra -= 1
        st.session_state.mostrar_pista = True
    else:
        st.warning("No tens pistes extra disponibles.")

# --- DISSENY DE LA INTERFÍCIE (UI) ---

st.set_page_config(page_title="ECO-Banc Habilitats Pro", page_icon="🏦", layout="wide")

st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Montserrat:wght@600;700&display=swap');

        /* --- Variables de Disseny --- */
        :root {
            --primary-color: #004481;
            --accent-color: #1db954;
            --text-color: #333;
            --light-text-color: #777;
            --background-color: #f0f2f5;
            --card-bg: #ffffff;
            --border-radius: 16px;
            --shadow-sm: 0 4px 6px rgba(0,0,0,0.05);
            --shadow-md: 0 10px 20px rgba(0,0,0,0.07);
        }
        
        /* --- Estils Generals --- */
        html, body, [class*="st-emotion"] {
            font-family: 'Roboto', sans-serif;
            color: var(--text-color);
            background-color: var(--background-color);
        }
        h1, h2, h3 { font-family: 'Montserrat', sans-serif; color: var(--primary-color); }
        h1 { 
            font-size: 2.8em; 
            text-align: center; 
            margin-bottom: 25px;
            background: -webkit-linear-gradient(45deg, var(--primary-color), #007bff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        /* --- Targetes d'Estadístiques --- */
        .stat-card {
            background-color: var(--card-bg);
            border-radius: var(--border-radius);
            padding: 25px;
            box-shadow: var(--shadow-sm);
            position: relative;
            overflow: hidden;
            border-top: 5px solid var(--primary-color);
            transition: all 0.3s ease;
        }
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: var(--shadow-md);
        }
        .stat-card .icon { font-size: 3em; margin-right: 20px; line-height: 1; }
        .stat-card .details h2 { font-size: 1.1em; color: var(--light-text-color); margin: 0; }
        .stat-card .details p { font-size: 2.2em; font-weight: 700; color: var(--primary-color); margin: 0; }
        .saldo-change {
            position: absolute;
            top: 20px;
            right: 25px;
            font-size: 1.6em;
            font-weight: 700;
            animation: fadeInOut 1.5s ease-in-out forwards;
        }
        .saldo-change.positive { color: var(--accent-color); }
        .saldo-change.negative { color: #d9534f; }

        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(20px); }
            20% { opacity: 1; transform: translateY(0); }
            80% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }

        /* --- Targeta de Contingut Principal --- */
        .content-card {
            background-color: var(--card-bg);
            border-radius: var(--border-radius);
            padding: 35px;
            box-shadow: var(--shadow-sm);
            height: 100%;
        }
        
        /* --- Botons Professionals --- */
        .stButton>button {
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 14px 28px;
            font-size: 1.1em;
            font-family: 'Montserrat', sans-serif;
            font-weight: 600;
            width: 100%;
            transition: all 0.2s ease;
            margin-top: 15px;
            box-shadow: 0 4px 10px rgba(0, 68, 129, 0.2);
        }
        .stButton>button:hover {
            transform: translateY(-3px);
            box-shadow: 0 7px 15px rgba(0, 68, 129, 0.3);
        }
        .stButton>button:disabled {
            background-color: #a9cce3;
            opacity: 0.6;
            cursor: not-allowed;
            box-shadow: none;
        }

        /* --- Barra de Progrés --- */
        .progress-container { margin-top: 10px; }
        .progress-label { display: flex; justify-content: space-between; font-size: 0.9em; color: var(--light-text-color); margin-bottom: 5px; }
        .progress-bar-bg { background-color: #e9ecef; border-radius: 10px; height: 12px; }
        .progress-bar {
            background: linear-gradient(90deg, #1db954, #28a745);
            border-radius: 10px;
            height: 100%;
            transition: width 0.5s ease-in-out;
        }
        
        /* --- Botiga --- */
        .shop-item {
            display: grid;
            grid-template-columns: 50px 1fr auto;
            align-items: center;
            gap: 15px;
            padding: 20px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .shop-item:last-child { border-bottom: none; }
        .shop-icon { font-size: 2em; line-height: 1; }
        .shop-details p { font-weight: 700; margin: 0; }
        .shop-details span { font-size: 0.9em; color: var(--light-text-color); }
        .shop-item .stButton>button { width: auto; padding: 8px 20px; font-size: 0.9em; margin-top: 0; }

    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---

st.title("ECO-Banc Habilitats Pro")

# Secció de Saldo i Puntuació
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
    # Càlcul de la barra de progrés (ex: 10 punts per pujar de nivell)
    progress_percent = min(100, (st.session_state.puntuacio_habilitats / 10) * 100)
    st.markdown(f"""
        <div class="stat-card" style="border-top-color: var(--accent-color);">
            <div style="display: flex; align-items: center; width: 100%;">
                <span class="icon">🧠</span>
                <div class="details" style="width: 100%;">
                    <h2>Puntuació d'Habilitats</h2>
                    <p>{st.session_state.puntuacio_habilitats}</p>
                    <div class="progress-container">
                        <div class="progress-label">
                            <span>Nivell d'Expert</span>
                            <span>{int(progress_percent)}%</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar" style="width: {progress_percent}%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    """, unsafe_allow_html=True)

st.write("") 

col1, col2 = st.columns([6, 4])

with col1:
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.subheader("Simulador de Situacions")

    if st.session_state.pregunta_actual is None:
        st.info("Estàs preparat/da per posar a prova les teves habilitats socials i professionals?")
        if st.button("Començar Simulació", key="btn_generar_inicial"):
            generar_pregunta()
    else:
        pregunta = st.session_state.pregunta_actual
        st.write(f"**{pregunta['pregunta']}**")
        
        resposta_usuari = st.radio(
            "Selecciona la teva resposta:", pregunta["opcions"], key="radio_respostes", label_visibility="collapsed"
        )
        
        if st.button("Confirmar Decisió", key="btn_enviar_resposta", use_container_width=True):
            verificar_resposta(resposta_usuari)

        if st.session_state.mostrar_pista:
            st.info(f"Pista: {pregunta['pista']}")

        if st.session_state.missatge_feedback:
            if "Correcta" in st.session_state.missatge_feedback:
                st.success(st.session_state.missatge_feedback)
            else:
                st.error(st.session_state.missatge_feedback)

    st.markdown('</div>', unsafe_allow_html=True)

with col2:
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.subheader("Mercat de Recursos")

    # Item 1: Multiplicador
    st.markdown(f"""
        <div class="shop-item">
            <span class="shop-icon">🚀</span>
            <div class="shop-details">
                <p>Formació Avançada (x2)</p>
                <span>Duplica els guanys d'ECO$ per decisió correcta.<br><b>Cost: 150 ECO$</b></span>
            </div>
            {'<span style="align-self: center;">✅ Activat</span>' if st.session_state.multiplicador_eco >= 2 else ''}
        </div>
    """, unsafe_allow_html=True)
    if st.session_state.multiplicador_eco < 2:
        if st.button("Invertir", key="buy_multi_x2", disabled=(st.session_state.saldo_eco < 150)):
            st.session_state.saldo_eco -= 150
            st.session_state.multiplicador_eco = 2
            st.success("Has adquirit Formació Avançada!")
            st.rerun()

    # Item 2: Pistes
    st.markdown(f"""
        <div class="shop-item">
            <span class="shop-icon">💡</span>
            <div class="shop-details">
                <p>Consultoria (3 pistes)</p>
                <span>Obté consells per a situacions complexes.<br><b>Tens: {st.session_state.pistes_extra}</b> | <b>Cost: 75 ECO$</b></span>
            </div>
        </div>
    """, unsafe_allow_html=True)
    if st.button("Contractar", key="buy_pistes", disabled=(st.session_state.saldo_eco < 75)):
        st.session_state.saldo_eco -= 75
        st.session_state.pistes_extra += 3
        st.success("Has contractat 3 consultories!")
        st.rerun()

    if not st.session_state.mostrar_pista and st.session_state.pregunta_actual and st.session_state.pistes_extra > 0:
         if st.button(f"Utilitzar Consultoria ({st.session_state.pistes_extra})", key="use_pista_shop", type="secondary"):
            usar_pista()
            st.rerun()

    st.markdown('</div>', unsafe_allow_html=True)

# Lògica de l'animació
if st.session_state.mostrar_cambio:
    time.sleep(1.5)
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()
