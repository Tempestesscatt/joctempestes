import streamlit as st
import time
import random

# --- Configuración inicial ---
if 'saldo_eco' not in st.session_state:
    st.session_state.saldo_eco = 500  # Saldo inicial de ECO$ para inversiones
if 'propiedades' not in st.session_state:
    st.session_state.propiedades = [] # Lista de propiedades invertidas
if 'multiplicador_ganancias' not in st.session_state:
    st.session_state.multiplicador_ganancias = 1
if 'mensaje_feedback' not in st.session_state:
    st.session_state.mensaje_feedback = ""
if 'oportunidad_actual' not in st.session_state:
    st.session_state.oportunidad_actual = None

# --- Oportunidades de Inversión ---
oportunidades = [
    {"nombre": "Apartamento Urbano", "costo": 100, "min_ganancia": 120, "max_ganancia": 180, "prob_exito": 0.7, "icono": "🏢"},
    {"nombre": "Terreno Rural", "costo": 150, "min_ganancia": 150, "max_ganancia": 250, "prob_exito": 0.6, "icono": "🏞️"},
    {"nombre": "Local Comercial", "costo": 200, "min_ganancia": 200, "max_ganancia": 350, "prob_exito": 0.5, "icono": "🏪"},
    {"nombre": "Chalet de Lujo", "costo": 300, "min_ganancia": 300, "max_ganancia": 500, "prob_exito": 0.4, "icono": "别墅"},
    {"nombre": "Piso en el centro", "costo": 80, "min_ganancia": 90, "max_ganancia": 130, "prob_exito": 0.8, "icono": "🏠"},
]

# --- Función para generar una oportunidad de inversión ---
def generar_oportunidad():
    st.session_state.oportunidad_actual = random.choice(oportunidades)
    st.session_state.mensaje_feedback = ""

# --- Función para invertir ---
def invertir_en_propiedad(oportunidad):
    if st.session_state.saldo_eco >= oportunidad["costo"]:
        st.session_state.saldo_eco -= oportunidad["costo"]
        
        # Simular el éxito o fracaso de la inversión
        if random.random() < oportunidad["prob_exito"]:
            ganancia = random.randint(oportunidad["min_ganancia"], oportunidad["max_ganancia"])
            ganancia_con_multiplicador = ganancia * st.session_state.multiplicador_ganancias
            st.session_state.saldo_eco += ganancia_con_multiplicador
            st.session_state.propiedades.append(oportunidad["nombre"])
            st.session_state.mensaje_feedback = f"🎉 ¡Éxito! Tu inversión en '{oportunidad['nombre']}' fue rentable. Ganaste {ganancia_con_multiplicador} ECO$."
        else:
            st.session_state.mensaje_feedback = f"😔 ¡Lo siento! Tu inversión en '{oportunidad['nombre']}' no fue rentable. Perdiste los {oportunidad['costo']} ECO$ invertidos."
        
        # Generar una nueva oportunidad después de invertir
        generar_oportunidad() 
    else:
        st.session_state.mensaje_feedback = "💰 No tienes suficientes ECO$ para esta inversión."

# --- Diseño de la interfaz al estilo ECOCAIXA ---

st.set_page_config(
    page_title="ECOCAIXA - Tu Banco del Futuro",
    page_icon="🌿",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Estilo CSS para simular ECOCAIXA (colores verdes/azules, fuentes, tarjetas)
st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Open+Sans:wght@400;600&display=swap');

        html, body, [class*="css"] {
            font-family: 'Open Sans', sans-serif;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
            font-family: 'Montserrat', sans-serif;
            color: #007bff; /* Azul primario para títulos */
        }
        .ecocaixa-header {
            background: linear-gradient(135deg, #007bff, #28a745); /* Degradado azul a verde */
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
            background-color: #f8f9fa; /* Fondo blanco-gris */
            border-left: 8px solid #007bff; /* Borde azul */
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
            color: #28a745; /* Verde para el saldo */
        }
        .ecocaixa-section-card {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
            margin-bottom: 25px;
            border: 1px solid #e0e0e0;
        }
        .ecocaixa-button {
            background-color: #28a745; /* Verde para acciones positivas */
            color: white;
            border-radius: 8px;
            padding: 12px 25px;
            font-size: 1.1em;
            font-weight: bold;
            border: none;
            transition: background-color 0.3s ease;
            cursor: pointer;
        }
        .ecocaixa-button:hover {
            background-color: #218838;
            color: white;
        }
        .ecocaixa-button.secondary {
            background-color: #007bff; /* Azul para acciones secundarias */
        }
        .ecocaixa-button.secondary:hover {
            background-color: #0056b3;
        }
        .stButton>button { /* Esto es para aplicar el estilo a los botones de Streamlit */
            background-color: #28a745;
            color: white;
            border-radius: 8px;
            padding: 12px 25px;
            font-size: 1.1em;
            font-weight: bold;
            border: none;
            transition: background-color 0.3s ease;
        }
        .stButton>button:hover {
            background-color: #218838;
            color: white;
        }
        .stTextInput>div>div>input {
            border-radius: 8px;
            border: 1px solid #ced4da;
            padding: 10px;
        }
        .stAlert {
            border-radius: 8px;
        }
        .oportunidad-item {
            background-color: #e9ecef;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            border: 1px dashed #adb5bd;
            font-weight: bold;
        }
        .propiedad-lista {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        .propiedad-tag {
            background-color: #e0f7fa;
            color: #007bff;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            border: 1px solid #b2ebf2;
        }
    </style>
""", unsafe_allow_html=True)

# --- Header ECOCAIXA ---
st.markdown('<div class="ecocaixa-header"><h1>ECOCAIXA</h1><p>Invierte, crece, prospera.</p></div>', unsafe_allow_html=True)

# --- Saldo Actual ---
st.markdown(f"""
    <div class="ecocaixa-saldo-card">
        <span class="icon">🏦</span>
        <div class="details">
            <h2>Tu Saldo</h2>
            <p>{st.session_state.saldo_eco:.2f} ECO$</p>
        </div>
    </div>
""", unsafe_allow_html=True)

col1, col2 = st.columns([3, 2])

with col1:
    st.markdown('<div class="ecocaixa-section-card">', unsafe_allow_html=True)
    st.subheader("Oportunidades de Inversión Inmobiliaria 📈")
    st.markdown("Invierte en bienes raíces y haz crecer tu capital ECO$.")

    if st.session_state.oportunidad_actual is None:
        st.info("Haz clic para descubrir una nueva oportunidad de inversión.")
        if st.button("Buscar Oportunidad", key="btn_buscar_oportunidad_inicial", help="Genera una nueva propiedad para invertir."):
            generar_oportunidad()
    else:
        oportunidad = st.session_state.oportunidad_actual
        st.markdown(f"""
            <div class="oportunidad-item">
                <span style="font-size: 1.5em;">{oportunidad['icono']}</span> <strong>{oportunidad['nombre']}</strong><br>
                💰 Costo de Inversión: <span style="color: #dc3545;">{oportunidad['costo']} ECO$</span><br>
                📈 Ganancia Estimada: <span style="color: #28a745;">{oportunidad['min_ganancia'] * st.session_state.multiplicador_ganancias} - {oportunidad['max_ganancia'] * st.session_state.multiplicador_ganancias} ECO$</span> (con tu multiplicador)<br>
                📊 Probabilidad de Éxito: {(oportunidad['prob_exito'] * 100):.0f}%
            </div>
        """, unsafe_allow_html=True)

        st.write("") # Espacio
        if st.button(f"Invertir en {oportunidad['nombre']}", key="btn_invertir", help="Invierte tus ECO$ en esta propiedad."):
            invertir_en_propiedad(oportunidad)
        
        if st.button("Buscar Otra Oportunidad", key="btn_otra_oportunidad", help="Descartar esta y buscar una nueva.", type="secondary"):
            generar_oportunidad()

    if st.session_state.mensaje_feedback:
        if "Éxito" in st.session_state.mensaje_feedback:
            st.success(st.session_state.mensaje_feedback)
        elif "No tienes suficientes" in st.session_state.mensaje_feedback:
            st.warning(st.session_state.mensaje_feedback)
        else:
            st.error(st.session_state.mensaje_feedback)
    
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="ecocaixa-section-card">', unsafe_allow_html=True)
    st.subheader("Tus Propiedades Adquiridas 🏡")
    if st.session_state.propiedades:
        st.markdown("<div class='propiedad-lista'>", unsafe_allow_html=True)
        for prop in st.session_state.propiedades:
            st.markdown(f"<span class='propiedad-tag'>{prop}</span>", unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.info("Aún no tienes propiedades en tu cartera. ¡Empieza a invertir!")
    st.markdown('</div>', unsafe_allow_html=True)


with col2:
    st.markdown('<div class="ecocaixa-section-card">', unsafe_allow_html=True)
    st.subheader("Centro de Mejora de Inversiones ✨")
    st.markdown("Mejora tus herramientas para maximizar tus ganancias en cada operación.")

    st.markdown(f"**Multiplicador de Ganancias Actual:** **x{st.session_state.multiplicador_ganancias}**")
    st.markdown("---")

    st.markdown("### 🚀 Multiplicador x2")
    st.write("Aumenta el rendimiento de tus inversiones al doble. **Coste: 300 ECO$**")
    if st.session_state.multiplicador_ganancias < 2:
        if st.button("Comprar Multiplicador x2", key="buy_x2", use_container_width=True):
            if st.session_state.saldo_eco >= 300:
                st.session_state.saldo_eco -= 300
                st.session_state.multiplicador_ganancias = 2
                st.success("¡Has activado el multiplicador x2! Tus ganancias ahora serán el doble.")
            else:
                st.error("Necesitas 300 ECO$ para comprar este multiplicador.")
    else:
        st.info("Ya tienes el multiplicador x2 (o superior) activado.")

    st.markdown("---")
    st.markdown("### 🌟 Multiplicador x3")
    st.write("Triple el potencial de tus ganancias en cada inversión. **Coste: 700 ECO$**")
    if st.session_state.multiplicador_ganancias < 3:
        if st.button("Comprar Multiplicador x3", key="buy_x3", use_container_width=True):
            if st.session_state.saldo_eco >= 700:
                st.session_state.saldo_eco -= 700
                st.session_state.multiplicador_ganancias = 3
                st.success("¡Has activado el multiplicador x3! Tus ganancias ahora serán el triple.")
            else:
                st.error("Necesitas 700 ECO$ para comprar este multiplicador.")
    else:
        st.info("Ya tienes el multiplicador x3 (o superior) activado.")

    st.markdown('</div>', unsafe_allow_html=True)

# --- Footer (Opcional) ---
st.markdown("""
    <hr style="margin-top: 40px; border-color: #e0e0e0;">
    <p style="text-align: center; color: #6c757d; font-size: 0.9em;">
        ECOCAIXA © 2023 - Un producto simulado con fines lúdicos y educativos. Invierte con responsabilidad.
    </p>
""", unsafe_allow_html=True)
