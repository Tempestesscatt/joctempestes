import streamlit as st
import time
import random

# --- Configuración inicial ---
if 'saldo_eco' not in st.session_state:
    st.session_state.saldo_eco = 200  # Saldo inicial de ECO$
if 'puntuacio_habilitats' not in st.session_state:
    st.session_state.puntuacio_habilitats = 0 # Puntuación para llevar un registro de respuestas correctas
if 'multiplicador_eco' not in st.session_state:
    st.session_state.multiplicador_eco = 1 # Multiplicador de ECO$ per pregunta correcta
if 'pistes_extra' not in st.session_state:
    st.session_state.pistes_extra = 0 # Número de pistas extra disponibles
if 'pregunta_actual' not in st.session_state:
    st.session_state.pregunta_actual = None
if 'missatge_feedback' not in st.session_state:
    st.session_state.missatge_feedback = ""
if 'mostrar_pista' not in st.session_state:
    st.session_state.mostrar_pista = False

# --- Preguntes d'Habilitats Socials (en català) ---
preguntes_habilitats = [
    {
        "pregunta": "¿Quina és la millor manera d'escoltar activament?",
        "opcions": ["Interrompre per donar la teva opinió", "Mirar al mòbil mentre l'altre parla", "Fer contacte visual i assentir amb el cap", "Planificar la teva resposta abans que acabi"],
        "resposta_correcta": "Fer contacte visual i assentir amb el cap",
        "pista": "Implica atenció plena al que diu l'altra persona, tant verbalment com no verbalment.",
        "eco_guany": 10
    },
    {
        "pregunta": "¿Què NO és un component clau de la comunicació no verbal?",
        "opcions": ["El to de veu", "La postura corporal", "Les paraules que utilitzes", "El contacte visual"],
        "resposta_correcta": "Les paraules que utilitzes",
        "pista": "La comunicació no verbal no implica el llenguatge verbal.",
        "eco_guany": 10
    },
    {
        "pregunta": "Com expressaries una queixa de manera assertiva?",
        "opcions": ["Cridant i fent retrets", "Ignorant la situació i esperant que millori", "Descrivint el problema i expressant els teus sentiments sense agressivitat", "Parlar a l'esquena de la persona"],
        "resposta_correcta": "Descrivint el problema i expressant els teus sentiments sense agressivitat",
        "pista": "L'assertivitat és el punt mig entre la passivitat i l'agressivitat.",
        "eco_guany": 10
    },
    {
        "pregunta": "¿Quin dels següents és un signe d'empatia?",
        "opcions": ["Dir a algú que 'no és per tant'", "Intentar posar-te al lloc de l'altra persona", "Explicar la teva pròpia història sense escoltar la seva", "Jutjar ràpidament les seves emocions"],
        "resposta_correcta": "Intentar posar-te al lloc de l'altra persona",
        "pista": "L'empatia és la capacitat de comprendre els sentiments dels altres.",
        "eco_guany": 10
    },
    {
        "pregunta": "En una discussió, quina actitud afavoreix la resolució de conflictes?",
        "opcions": ["Imposar la teva opinió", "Evitar el tema completament", "Buscar un terreny comú i una solució satisfactòria per a ambdues parts", "Rendir-te immediatament per evitar enfrontaments"],
        "resposta_correcta": "Buscar un terreny comú i una solució satisfactòria per a ambdues parts",
        "pista": "La cooperació és clau per arribar a un acord.",
        "eco_guany": 10
    },
    {
        "pregunta": "¿Quina d'aquestes afirmacions fomenta una bona autoestima?",
        "opcions": ["'Sóc un inútil'", "'No sóc bo en res'", "'M'accepto tal com sóc, amb els meus defectes i virtuts'", "'Sempre ho faig tot malament'"],
        "resposta_correcta": "'M'accepto tal com sóc, amb els meus defectes i virtuts'",
        "pista": "La clau és l'acceptació personal i una visió equilibrada de tu mateix.",
        "eco_guany": 10
    },
    {
        "pregunta": "Com reaccionaries si algú et fa un elogi?",
        "opcions": ["Desviar el compliment o minimitzar-lo", "Acceptar-lo amb un 'gràcies' sincer", "Pensar que t'està prenent el pèl", "Respondre amb un elogi forçat"],
        "resposta_correcta": "Acceptar-lo amb un 'gràcies' sincer",
        "pista": "Permet-te rebre la valoració positiva dels altres sense complexos.",
        "eco_guany": 10
    },
]

# --- Funció per generar una pregunta ---
def generar_pregunta():
    st.session_state.pregunta_actual = random.choice(preguntes_habilitats)
    st.session_state.missatge_feedback = ""
    st.session_state.mostrar_pista = False # Resetejar la pista

# --- Funció per verificar resposta ---
def verificar_resposta(resposta_usuari):
    if st.session_state.pregunta_actual:
        if resposta_usuari == st.session_state.pregunta_actual["resposta_correcta"]:
            guany_eco = st.session_state.pregunta_actual["eco_guany"] * st.session_state.multiplicador_eco
            st.session_state.saldo_eco += guany_eco
            st.session_state.puntuacio_habilitats += 1
            st.session_state.missatge_feedback = f"🎉 ¡Correcte! Has guanyat {guany_eco} ECO$. La teva puntuació d'habilitats és {st.session_state.puntuacio_habilitats}."
            generar_pregunta() # Genera una nova pregunta en encertar
        else:
            st.session_state.missatge_feedback = f"😔 Incorrecte. La resposta correcta era: '{st.session_state.pregunta_actual['resposta_correcta']}'."
            # En aquest mode, no perdem ECO$ per fallar, només no en guanyem.
            generar_pregunta() # Genera una nova pregunta en fallar
    else:
        st.session_state.missatge_feedback = "Per favor, genera una pregunta primer."

# --- Botó de pista ---
def usar_pista():
    if st.session_state.pistes_extra > 0:
        st.session_state.pistes_extra -= 1
        st.session_state.mostrar_pista = True
        st.info("Has utilitzat una pista extra.")
    else:
        st.warning("No tens pistes extra disponibles. Compra-les a la botiga!")

# --- Disseny de la interfície al estil ECOCAIXA (ara en català) ---

st.set_page_config(
    page_title="ECOCAIXA - Habilitats Socials",
    page_icon="🧠", # Icona de cervell per habilitats
    layout="wide",
    initial_sidebar_state="expanded"
)

# Estil CSS per simular ECOCAIXA (colors verds/blaus, fonts, targetes)
st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Open+Sans:wght@400;600&display=swap');

        html, body, [class*="st-emotion"] { /* Actualitzat per Streamlit 1.x */
            font-family: 'Open Sans', sans-serif;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
            font-family: 'Montserrat', sans-serif;
            color: #007bff; /* Blau primari per títols */
        }
        .ecocaixa-header {
            background: linear-gradient(135deg, #007bff, #28a745); /* Degradat blau a verd */
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        }
        .ecocaixa-header h1 {
            color: white;
            font-size: 3.5em;
            margin-bottom: 5px;
        }
        .ecocaixa-header p {
            color: rgba(255, 255, 255, 0.8);
            font-size: 1.2em;
        }
        .ecocaixa-saldo-card {
            background-color: #f8f9fa; /* Fons blanc-gris */
            border-left: 8px solid #007bff; /* Vora blava */
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
        }
        .ecocaixa-saldo-card .icon {
            font-size: 3em;
            margin-right: 20px;
            color: #007bff;
        }
        .ecocaixa-saldo-card .details h2 {
            margin-bottom: 5px;
            color: #007bff;
        }
        .ecocaixa-saldo-card .details p {
            font-size: 2.2em;
            font-weight: bold;
            color: #28a745; /* Verd per al saldo */
        }
        .ecocaixa-section-card {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
            margin-bottom: 25px;
            border: 1px solid #e0e0e0;
        }
        .stButton>button { /* Estil per tots els botons de Streamlit */
            background-color: #28a745; /* Verd per accions positives */
            color: white;
            border-radius: 8px;
            padding: 12px 25px;
            font-size: 1.1em;
            font-weight: bold;
            border: none;
            transition: background-color 0.3s ease;
            cursor: pointer;
        }
        .stButton>button:hover {
            background-color: #218838;
            color: white;
        }
        .stButton>button[kind="secondary"] { /* Estil per botons secundaris (pistes, etc.) */
            background-color: #007bff; /* Blau per accions secundaries */
        }
        .stButton>button[kind="secondary"]:hover {
            background-color: #0056b3;
        }
        .stRadio>label {
            font-size: 1.1em;
            margin-bottom: 5px;
        }
        .stRadio div[role="radiogroup"] {
            padding-left: 10px;
        }
        .pista-box {
            background-color: #fff3cd; /* Groc clar */
            border-left: 5px solid #ffc107; /* Vora groga */
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
            color: #856404;
        }
    </style>
""", unsafe_allow_html=True)

# --- Header ECOCAIXA ---
st.markdown('<div class="ecocaixa-header"><h1>ECOCAIXA</h1><p>Desenvolupa les teves habilitats socials, guanya ECO$!</p></div>', unsafe_allow_html=True)

# --- Saldo Actual i Puntuació Habilitats ---
col_stats_1, col_stats_2 = st.columns(2)
with col_stats_1:
    st.markdown(f"""
        <div class="ecocaixa-saldo-card">
            <span class="icon">💰</span>
            <div class="details">
                <h2>El teu Saldo</h2>
                <p>{st.session_state.saldo_eco:.2f} ECO$</p>
            </div>
        </div>
    """, unsafe_allow_html=True)
with col_stats_2:
    st.markdown(f"""
        <div class="ecocaixa-saldo-card" style="border-left: 8px solid #28a745;">
            <span class="icon" style="color: #28a745;">🧠</span>
            <div class="details">
                <h2>Puntuació d'Habilitats</h2>
                <p>{st.session_state.puntuacio_habilitats}</p>
            </div>
        </div>
    """, unsafe_allow_html=True)

col1, col2 = st.columns([3, 2])

with col1:
    st.markdown('<div class="ecocaixa-section-card">', unsafe_allow_html=True)
    st.subheader("Preguntes d'Habilitats Socials 🤔")
    st.markdown("Posa a prova els teus coneixements i guanya ECO$ per millorar les teves eines.")

    if st.session_state.pregunta_actual is None:
        st.info("Fes clic per començar amb una pregunta d'habilitats socials!")
        if st.button("Generar Nova Pregunta", key="btn_generar_inicial", help="Genera una nova pregunta per respondre."):
            generar_pregunta()
    else:
        pregunta = st.session_state.pregunta_actual
        st.write(f"**{pregunta['pregunta']}**")
        st.markdown(f"<p style='color:#28a745;'>Guanyaràs {pregunta['eco_guany'] * st.session_state.multiplicador_eco} ECO$ per resposta correcta.</p>", unsafe_allow_html=True)

        resposta_usuari = st.radio(
            "Selecciona la teva resposta:",
            pregunta["opcions"],
            key="radio_respostes"
        )
        
        col_btns_pregunta_1, col_btns_pregunta_2 = st.columns(2)
        with col_btns_pregunta_1:
            if st.button("Enviar Resposta", key="btn_enviar_resposta", use_container_width=True):
                verificar_resposta(resposta_usuari)
        with col_btns_pregunta_2:
            if st.session_state.pistes_extra > 0:
                if st.button(f"Usar Pista ({st.session_state.pistes_extra} disponibles)", key="btn_usar_pista", use_container_width=True, type="secondary"):
                    usar_pista()
            elif st.session_state.pistes_extra == 0:
                st.button(f"Usar Pista (0 disponibles)", key="btn_usar_pista_disabled", use_container_width=True, disabled=True)

        if st.session_state.mostrar_pista and st.session_state.pregunta_actual:
            st.markdown(f"<div class='pista-box'>Pista: {st.session_state.pregunta_actual['pista']}</div>", unsafe_allow_html=True)

    if st.session_state.missatge_feedback:
        if "Correcte" in st.session_state.missatge_feedback:
            st.success(st.session_state.missatge_feedback)
        elif "Incorrecte" in st.session_state.missatge_feedback:
            st.error(st.session_state.missatge_feedback)
        else:
            st.info(st.session_state.missatge_feedback)
    
    st.markdown('</div>', unsafe_allow_html=True)

with col2:
    st.markdown('<div class="ecocaixa-section-card">', unsafe_allow_html=True)
    st.subheader("Botiga de Potenciadors ⚡")
    st.markdown("Compra eines per millorar el teu aprenentatge i guanyar més ECO$.")

    st.markdown(f"**Multiplicador ECO$ actual:** **x{st.session_state.multiplicador_eco}**")
    st.markdown(f"**Pistes extra disponibles:** **{st.session_state.pistes_extra}**")
    st.markdown("---")

    st.markdown("### 📚 Multiplicador ECO$ x2")
    st.write("Duplica els ECO$ que guanyes per cada resposta correcta. **Cost: 150 ECO$**")
    if st.session_state.multiplicador_eco < 2:
        if st.button("Comprar Multiplicador x2", key="buy_multi_x2", use_container_width=True):
            if st.session_state.saldo_eco >= 150:
                st.session_state.saldo_eco -= 150
                st.session_state.multiplicador_eco = 2
                st.success("¡Has activat el multiplicador x2! Ara guanyes el doble d'ECO$ per cada encert.")
            else:
                st.error("No tens suficients ECO$ per aquesta compra.")
    else:
        st.info("Ja tens el multiplicador x2 (o superior) activat.")

    st.markdown("---")
    st.markdown("### 🌟 Multiplicador ECO$ x3")
    st.write("Triplica els ECO$ que guanyes per cada resposta correcta. **Cost: 350 ECO$**")
    if st.session_state.multiplicador_eco < 3:
        if st.button("Comprar Multiplicador x3", key="buy_multi_x3", use_container_width=True):
            if st.session_state.saldo_eco >= 350:
                st.session_state.saldo_eco -= 350
                st.session_state.multiplicador_eco = 3
                st.success("¡Has activat el multiplicador x3! Ara guanyes el triple d'ECO$ per cada encert.")
            else:
                st.error("No tens suficients ECO$ per aquesta compra.")
    else:
        st.info("Ja tens el multiplicador x3 (o superior) activat.")

    st.markdown("---")
    st.markdown("### 💡 Paquet de 3 Pistes Extra")
    st.write("Obtén 3 pistes per a les preguntes més complexes. **Cost: 75 ECO$**")
    if st.button("Comprar Pistes Extra", key="buy_pistes", use_container_width=True):
        if st.session_state.saldo_eco >= 75:
            st.session_state.saldo_eco -= 75
            st.session_state.pistes_extra += 3
            st.success("¡Has comprat 3 pistes extra!")
        else:
            st.error("No tens suficients ECO$ per comprar pistes.")

    st.markdown('</div>', unsafe_allow_html=True)

# --- Footer (en català) ---
st.markdown("""
    <hr style="margin-top: 40px; border-color: #e0e0e0;">
    <p style="text-align: center; color: #6c757d; font-size: 0.9em;">
        ECOCAIXA © 2023 - Una eina lúdica i educativa per al desenvolupament d'habilitats socials.
    </p>
""", unsafe_allow_html=True)
