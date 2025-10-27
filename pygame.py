import streamlit as st
import time
import random

# --- Configuración inicial ---
if 'saldo_eco' not in st.session_state:
    st.session_state.saldo_eco = 100  # Saldo inicial de ECO$
if 'multiplicador_ganancias' not in st.session_state:
    st.session_state.multiplicador_ganancias = 1
if 'ultima_recompensa_tiempo' not in st.session_state:
    st.session_state.ultima_recompensa_tiempo = time.time()
if 'pregunta_actual' not in st.session_state:
    st.session_state.pregunta_actual = None
if 'mensaje_feedback' not in st.session_state:
    st.session_state.mensaje_feedback = ""

# --- Preguntas del juego ---
preguntas = [
    {"pregunta": "¿Cuál es la capital de Francia?", "respuesta": "París", "costo_fallo": 20, "ganancia_acierto": 15},
    {"pregunta": "¿Cuántos planetas tiene el sistema solar (considerando 8 principales)?", "respuesta": "8", "costo_fallo": 25, "ganancia_acierto": 20},
    {"pregunta": "¿Cuál es el elemento químico con el símbolo 'O'?", "respuesta": "Oxígeno", "costo_fallo": 15, "ganancia_acierto": 10},
    {"pregunta": "¿Quién pintó la Mona Lisa?", "respuesta": "Leonardo da Vinci", "costo_fallo": 30, "ganancia_acierto": 25},
    {"pregunta": "¿Cuál es el río más largo del mundo?", "respuesta": "Amazonas", "costo_fallo": 22, "ganancia_acierto": 18},
]

# --- Función para generar una pregunta ---
def generar_pregunta():
    st.session_state.pregunta_actual = random.choice(preguntas)
    st.session_state.mensaje_feedback = ""

# --- Función para verificar respuesta ---
def verificar_respuesta(respuesta_usuario):
    if st.session_state.pregunta_actual:
        if respuesta_usuario.lower() == st.session_state.pregunta_actual["respuesta"].lower():
            ganancia = st.session_state.pregunta_actual["ganancia_acierto"] * st.session_state.multiplicador_ganancias
            st.session_state.saldo_eco += ganancia
            st.session_state.mensaje_feedback = f"¡Correcto! Ganaste {ganancia} ECO$. ¡Buen trabajo!"
            generar_pregunta() # Genera una nueva pregunta al acertar
        else:
            costo = st.session_state.pregunta_actual["costo_fallo"]
            st.session_state.saldo_eco -= costo
            st.session_state.mensaje_feedback = f"Incorrecto. Perdiste {costo} ECO$. La respuesta era: {st.session_state.pregunta_actual['respuesta']}"
            generar_pregunta() # Genera una nueva pregunta al fallar
    else:
        st.session_state.mensaje_feedback = "Por favor, genera una pregunta primero."

# --- Recompensa por tiempo ---
tiempo_actual = time.time()
if (tiempo_actual - st.session_state.ultima_recompensa_tiempo) >= 5:
    st.session_state.saldo_eco += 10
    st.session_state.ultima_recompensa_tiempo = tiempo_actual
    # st.experimental_rerun() # Esto puede ser agresivo, mejor confiar en el refresco natural de Streamlit

# --- Diseño de la interfaz al estilo BBVA ---

st.set_page_config(
    page_title="BBVA ECO$ Bank - Tu Futuro Financiero",
    page_icon="🏦",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Estilo CSS para simular BBVA (colores, fuentes, etc.)
st.markdown("""
    <style>
        .bbva-header {
            background-color: #004481; /* Azul BBVA oscuro */
            color: white;
            padding: 20px;
            text-align: center;
            font-family: 'BBVA Web Sans', sans-serif;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .bbva-saldo {
            background-color: #007bff; /* Azul BBVA más claro */
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-size: 2em;
            text-align: center;
            margin-bottom: 20px;
            font-weight: bold;
        }
        .bbva-card {
            background-color: #f0f2f6; /* Fondo gris claro */
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
        }
        .bbva-button {
            background-color: #004481;
            color: white;
            border-radius: 5px;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            margin: 4px 2px;
            cursor: pointer;
            border: none;
        }
        .bbva-button:hover {
            background-color: #0056b3;
        }
        .bbva-small-text {
            font-size: 0.9em;
            color: #555;
        }
        .stButton>button { /* Esto es para aplicar el estilo a los botones de Streamlit */
            background-color: #004481;
            color: white;
            border-radius: 5px;
            padding: 10px 20px;
            border: none;
        }
        .stButton>button:hover {
            background-color: #0056b3;
            color: white;
        }
    </style>
""", unsafe_allow_html=True)

# --- Header ---
st.markdown('<div class="bbva-header"><h1>BBVA ECO$ Bank</h1><p>Tu futuro financiero en tus manos</p></div>', unsafe_allow_html=True)

col1, col2 = st.columns([2, 1])

with col1:
    st.markdown(f'<div class="bbva-saldo">Saldo Actual: {st.session_state.saldo_eco:.2f} ECO$</div>', unsafe_allow_html=True)

    st.subheader("Simulador de Inversiones y Conocimiento")
    st.markdown('<div class="bbva-card">', unsafe_allow_html=True)
    if st.session_state.pregunta_actual is None:
        st.write("Bienvenido al simulador. ¡Pon a prueba tus conocimientos y gestiona tus ECO$!")
        if st.button("Generar Nueva Pregunta", key="btn_generar_inicial"):
            generar_pregunta()
    else:
        st.write(f"**Pregunta:** {st.session_state.pregunta_actual['pregunta']}")
        st.write(f"💰 Costo al fallar: {st.session_state.pregunta_actual['costo_fallo']} ECO$")
        st.write(f"✅ Ganancia al acertar: {st.session_state.pregunta_actual['ganancia_acierto'] * st.session_state.multiplicador_ganancias} ECO$")

        respuesta_usuario = st.text_input("Tu respuesta:", key="input_respuesta")
        if st.button("Enviar Respuesta", key="btn_enviar_respuesta"):
            if respuesta_usuario:
                verificar_respuesta(respuesta_usuario)
            else:
                st.session_state.mensaje_feedback = "Por favor, escribe una respuesta."

        st.markdown(f"<p class='bbva-small-text'>{st.session_state.mensaje_feedback}</p>", unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

with col2:
    st.subheader("Tienda de Recompensas BBVA")
    st.markdown('<div class="bbva-card">', unsafe_allow_html=True)

    st.write(f"**Multiplicador de Ganancias Actual:** x{st.session_state.multiplicador_ganancias}")
    st.write("---")

    st.write("**Comprar Multiplicador de Ganancias x2 (Coste: 100 ECO$)**")
    if st.session_state.multiplicador_ganancias < 2:
        if st.button("Comprar x2", key="buy_x2"):
            if st.session_state.saldo_eco >= 100:
                st.session_state.saldo_eco -= 100
                st.session_state.multiplicador_ganancias = 2
                st.success("¡Has comprado el multiplicador x2!")
            else:
                st.error("No tienes suficientes ECO$ para esta compra.")
    else:
        st.info("Ya tienes el multiplicador x2.")

    st.write("---")
    st.write("**Comprar Multiplicador de Ganancias x3 (Coste: 250 ECO$)**")
    if st.session_state.multiplicador_ganancias < 3:
        if st.button("Comprar x3", key="buy_x3"):
            if st.session_state.saldo_eco >= 250:
                st.session_state.saldo_eco -= 250
                st.session_state.multiplicador_ganancias = 3
                st.success("¡Has comprado el multiplicador x3!")
            else:
                st.error("No tienes suficientes ECO$ para esta compra.")
    else:
        st.info("Ya tienes el multiplicador x3 (o superior).")

    # Puedes añadir más recompensas aquí
    st.markdown('</div>', unsafe_allow_html=True)

# --- Footer (Opcional) ---
st.markdown("""
    <hr>
    <p class="bbva-small-text" style="text-align: center;">BBVA ECO$ Bank - Un producto simulado con fines educativos.</p>
""", unsafe_allow_html=True)

# Esto es para forzar un refresco cada X segundos para que la recompensa por tiempo se active
# Ten en cuenta que st.rerun() puede causar problemas de rendimiento si se usa excesivamente.
# Para este juego simple, funciona bien.
time.sleep(1) # Espera 1 segundo para no hacer reruns instantáneos
st.rerun()
