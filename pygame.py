
Model
ThinkingThoughts
Manual: 8192
Expand to view model thoughts

chevron_right
¡Absolutament! Entenc perfectament. Anem a fer una transformació total per donar-li l'aspecte professional, net i corporatiu d'un banc com el BBVA. A més, implementarem l'efecte visual perquè els diners "pugin" o "baixin" amb cada resposta.

Per aconseguir-ho, farem servir un CSS molt més avançat i un petit truc amb `st.session_state` i `st.rerun` per simular l'animació del saldo.

Aquí tens el codi completament renovat. Copia'l i enganxa'l sencer.

```python
import streamlit as st
import time
import random

# --- CONFIGURACIÓ INICIAL I D'ESTAT ---
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
    st.session_state.cambio_saldo = 0 # Guardarà +10, -5, etc.
if 'mostrar_cambio' not in st.session_state:
    st.session_state.mostrar_cambio = False # Flag per mostrar l'animació

# --- PREGUNTES D'HABILITATS SOCIALS ---
preguntes_habilitats = [
    {
        "pregunta": "¿Quina és la millor manera d'escoltar activament?",
        "opcions": ["Interrompre per donar la teva opinió", "Mirar al mòbil mentre l'altre parla", "Fer contacte visual i assentir amb el cap", "Planificar la teva resposta abans que acabi"],
        "resposta_correcta": "Fer contacte visual i assentir amb el cap",
        "pista": "Implica atenció plena al que diu l'altra persona, tant verbalment com no verbalment.",
        "eco_guany": 10,
        "eco_perdua": 5 # Afegim una pèrdua per fallar
    },
    {
        "pregunta": "¿Què NO és un component clau de la comunicació no verbal?",
        "opcions": ["El to de veu", "La postura corporal", "Les paraules que utilitzes", "El contacte visual"],
        "resposta_correcta": "Les paraules que utilitzes",
        "pista": "La comunicació no verbal no implica el llenguatge verbal.",
        "eco_guany": 10,
        "eco_perdua": 5
    },
    {
        "pregunta": "Com expressaries una queixa de manera assertiva?",
        "opcions": ["Cridant i fent retrets", "Ignorant la situació i esperant que millori", "Descrivint el problema i expressant els teus sentiments sense agressivitat", "Parlar a l'esquena de la persona"],
        "resposta_correcta": "Descrivint el problema i expressant els teus sentiments sense agressivitat",
        "pista": "L'assertivitat és el punt mig entre la passivitat i l'agressivitat.",
        "eco_guany": 15,
        "eco_perdua": 10
    },
    {
        "pregunta": "¿Quin dels següents és un signe d'empatia?",
        "opcions": ["Dir a algú que 'no és per tant'", "Intentar posar-te al lloc de l'altra persona", "Explicar la teva pròpia història sense escoltar la seva", "Jutjar ràpidament les seves emocions"],
        "resposta_correcta": "Intentar posar-te al lloc de l'altra persona",
        "pista": "L'empatia és la capacitat de comprendre els sentiments dels altres.",
        "eco_guany": 15,
        "eco_perdua": 5
    },
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
            st.session_state.missatge_feedback = f"🎉 ¡Correcte!"
            st.session_state.cambio_saldo = guany_eco
        else:
            perdua_eco = pregunta["eco_perdua"]
            st.session_state.saldo_eco -= perdua_eco
            st.session_state.missatge_feedback = f"😔 Incorrecte. La resposta correcta era: '{pregunta['resposta_correcta']}'"
            st.session_state.cambio_saldo = -perdua_eco
        
        st.session_state.mostrar_cambio = True # Activa l'animació
        generar_pregunta()

def usar_pista():
    if st.session_state.pistes_extra > 0:
        st.session_state.pistes_extra -= 1
        st.session_state.mostrar_pista = True
    else:
        st.warning("No tens pistes extra disponibles. Compra-les a la botiga!")

# --- DISSENY DE LA INTERFÍCIE (UI) ---

st.set_page_config(page_title="ECO-Banc Habilitats", page_icon="🏦", layout="wide")

# CSS AMB ESTIL BBVA I ANIMACIONS
st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Montserrat:wght@600;700&display=swap');

        /* --- Variables de Color Estil BBVA --- */
        :root {
            --bbva-dark-blue: #004481;
            --bbva-light-blue: #007bff;
            --bbva-accent-green: #28a745;
            --text-color: #333;
            --background-light: #f5f7fa;
            --card-background: #ffffff;
            --shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
        }
        
        /* --- Estils Generals --- */
        html, body, [class*="st-emotion"] {
            font-family: 'Lato', sans-serif;
            color: var(--text-color);
            background-color: var(--background-light);
        }
        h1, h2, h3 { font-family: 'Montserrat', sans-serif; color: var(--bbva-dark-blue); }
        h1 { font-size: 2.5em; text-align: center; margin-bottom: 20px; }

        /* --- Targetes d'Estadístiques (Saldo i Puntuació) --- */
        .stat-card {
            background-color: var(--card-background);
            border-radius: 12px;
            padding: 20px 25px;
            box-shadow: var(--shadow);
            display: flex;
            align-items: center;
            position: relative;
            overflow: hidden;
            border-top: 4px solid var(--bbva-light-blue);
        }
        .stat-card .icon { font-size: 2.5em; margin-right: 20px; }
        .stat-card .details h2 { font-size: 1.1em; color: #555; margin: 0; }
        .stat-card .details p { font-size: 2em; font-weight: 700; color: var(--bbva-dark-blue); margin: 0; }
        .stat-card .saldo-change {
            position: absolute;
            top: 20px;
            right: 25px;
            font-size: 1.5em;
            font-weight: 700;
            animation: fadeInOut 1.5s ease-in-out forwards;
        }
        .saldo-change.positive { color: var(--bbva-accent-green); }
        .saldo-change.negative { color: #d9534f; }

        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(20px); }
            20% { opacity: 1; transform: translateY(0); }
            80% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }

        /* --- Targeta Principal (Preguntes i Botiga) --- */
        .bbva-card {
            background-color: var(--card-background);
            border-radius: 12px;
            padding: 30px;
            box-shadow: var(--shadow);
            height: 100%;
        }
        
        /* --- Botons Estil BBVA --- */
        .stButton>button {
            background-color: var(--bbva-light-blue);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 25px;
            font-size: 1.1em;
            font-weight: 700;
            width: 100%;
            transition: all 0.2s ease;
            margin-top: 10px;
        }
        .stButton>button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
        }
        .stButton>button:disabled {
            background-color: #a9cce3;
            opacity: 0.7;
        }
        
        /* --- Estils de la Botiga --- */
        .shop-item {
            display: flex;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .shop-item:last-child { border-bottom: none; }
        .shop-item-icon { font-size: 2em; margin-right: 15px; }
        .shop-item-details p { margin: 0; font-weight: 700; }
        .shop-item-details span { font-size: 0.9em; color: #666; }

    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---

st.title("ECO-Banc Habilitats")

# Secció de Saldo i Puntuació amb animació
col_stats_1, col_stats_2 = st.columns(2)
with col_stats_1:
    saldo_html = f"""
        <div class="stat-card">
            <span class="icon">🏦</span>
            <div class="details">
                <h2>El teu Saldo</h2>
                <p>{st.session_state.saldo_eco:.2f} ECO$</p>
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
        <div class="stat-card" style="border-top-color: var(--bbva-accent-green);">
            <span class="icon">🧠</span>
            <div class="details">
                <h2>Puntuació d'Habilitats</h2>
                <p>{st.session_state.puntuacio_habilitats}</p>
            </div>
        </div>
    """, unsafe_allow_html=True)

st.write("") # Espaiador

col1, col2 = st.columns([6, 4]) # Donem més espai a les preguntes

with col1:
    st.markdown('<div class="bbva-card">', unsafe_allow_html=True)
    st.subheader("Preguntes d'Habilitats Socials 🤔")

    if st.session_state.pregunta_actual is None:
        if st.button("Començar", key="btn_generar_inicial"):
            generar_pregunta()
    else:
        pregunta = st.session_state.pregunta_actual
        st.write(f"**{pregunta['pregunta']}**")
        
        resposta_usuari = st.radio(
            "Selecciona la teva resposta:", pregunta["opcions"], key="radio_respostes", label_visibility="collapsed"
        )
        
        if st.button("Enviar Resposta", key="btn_enviar_resposta", use_container_width=True):
            verificar_resposta(resposta_usuari)

        if st.session_state.pistes_extra > 0:
            if st.button(f"Usar Pista ({st.session_state.pistes_extra} disponibles)", key="btn_usar_pista"):
                usar_pista()
        
        if st.session_state.mostrar_pista:
            st.info(f"Pista: {pregunta['pista']}")

        if st.session_state.missatge_feedback:
            if "Correcte" in st.session_state.missatge_feedback:
                st.success(st.session_state.missatge_feedback)
            else:
                st.error(st.session_state.missatge_feedback)

    st.markdown('</div>', unsafe_allow_html=True)

with col2:
    st.markdown('<div class="bbva-card">', unsafe_allow_html=True)
    st.subheader("Botiga de Potenciadors ⚡")

    st.markdown(f"""
        <div class="shop-item">
            <span class="shop-item-icon">📚</span>
            <div class="shop-item-details">
                <p>Multiplicador ECO$ x2</p>
                <span>Duplica els teus guanys per resposta correcta. <b>Cost: 150 ECO$</b></span>
            </div>
        </div>
    """, unsafe_allow_html=True)
    if st.session_state.multiplicador_eco < 2:
        if st.button("Comprar Multiplicador x2", key="buy_multi_x2", disabled=(st.session_state.saldo_eco < 150)):
            st.session_state.saldo_eco -= 150
            st.session_state.multiplicador_eco = 2
            st.success("Multiplicador x2 activat!")
            st.rerun()
    else:
        st.info("Ja tens un multiplicador igual o superior.")

    st.markdown(f"""
        <div class="shop-item">
            <span class="shop-item-icon">💡</span>
            <div class="shop-item-details">
                <p>Paquet de 3 Pistes Extra</p>
                <span>Obté ajuda per a les preguntes complexes. <b>Cost: 75 ECO$</b></span>
            </div>
        </div>
    """, unsafe_allow_html=True)
    if st.button("Comprar Pistes Extra", key="buy_pistes", disabled=(st.session_state.saldo_eco < 75)):
        st.session_state.saldo_eco -= 75
        st.session_state.pistes_extra += 3
        st.success("Has comprat 3 pistes extra!")
        st.rerun()
    
    st.markdown('</div>', unsafe_allow_html=True)

# Lògica de l'animació: si s'ha de mostrar, espera i reinicia
if st.session_state.mostrar_cambio:
    time.sleep(1.5) # Temps per a què l'animació es completi
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()
