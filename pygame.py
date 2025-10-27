import streamlit as st
import random
import time
import math
from streamlit.components.v1 import html

# --- CONFIGURACIÓ INICIAL DE LA PÀGINA ---
st.set_page_config(
    page_title="ECA Quest: Vida Sostenible",
    page_icon="🌍",
    layout="wide"
)

# --- ESTILS CSS AVANÇATS I ADAPTATIUS ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
    
    html, body, [class*="st-"] {
        font-family: 'Poppins', sans-serif;
    }

    /* === TEMA FOSC PER DEFECTE === */
    .stApp { 
        background-color: #0f172a;
        background-image: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
    }
    [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"],
    [data-testid="stVerticalBlock"] {
        background-color: rgba(30, 41, 59, 0.7);
        border: 1px solid #334155;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        backdrop-filter: blur(8px);
        transition: box-shadow 0.3s ease-in-out, transform 0.3s ease-in-out;
        border-radius: 12px;
    }
    [data-testid="stVerticalBlock"]:hover {
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        transform: translateY(-3px);
    }
    h1, h2, h3, .st-emotion-cache-nahz7x, p, .st-emotion-cache-16idsys p { color: #f8fafc; }
    .stButton > button { 
        border-color: #38bdf8; 
        color: #38bdf8; 
        background-color: transparent;
        transition: all 0.3s ease-in-out;
    }
    .stButton > button:hover { 
        background-color: #38bdf8; 
        color: #0f172a; 
        box-shadow: 0 0 15px rgba(56, 189, 248, 0.5);
    }
    .stButton[aria-label*="Confirmar"], 
    .stButton[aria-label*="Jugar"],
    .stButton[aria-label*="Començar"],
    .stButton[aria-label*="Invertir"],
    .stButton[aria-label*="Retirar"],
    .stButton[aria-label*="Desbloquejar"] {
        border-color: #34d399;
        background-color: #34d399;
        color: #0f172a;
    }
    .stButton[aria-label*="Confirmar"]:hover, 
    .stButton[aria-label*="Jugar"]:hover,
    .stButton[aria-label*="Començar"]:hover,
    .stButton[aria-label*="Invertir"]:hover,
    .stButton[aria-label*="Retirar"]:hover,
    .stButton[aria-label*="Desbloquejar"]:hover {
        background-color: #6ee7b7;
        border-color: #6ee7b7;
        transform: scale(1.03);
        box-shadow: 0 0 15px rgba(110, 231, 183, 0.5);
    }
    [data-testid="stAlert"] {
        background-color: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
    }
    [data-testid="stMetric"] {
        background-color: rgba(45, 55, 72, 0.5);
        border: 1px solid #4a5568;
        border-radius: 12px;
        padding: 1rem;
    }
    /* Amagar la barra lateral */
    [data-testid="stSidebar"] {
        display: none;
    }
    [data-testid="stProgressBar"] > div > div > div > div { background-color: #38bdf8; }
</style>
""", unsafe_allow_html=True)

# --- BANC DE PREGUNTES ---
PREGUNTES = [
    # ... (Enganxa aquí la teva llista completa de 120 preguntes) ...
    # Exemple de com ha de ser la llista:
    {'pregunta': 'Què és el "desenvolupament sostenible"?', 'tipus': 'opcions', 'opcions': {'a': 'Creixement econòmic il·limitat', 'b': 'Satisfer les necessitats actuals sense comprometre les futures', 'c': 'Conservar la natura sense tocar-la', 'd': 'Prioritzar les necessitats humanes sobre les ambientals'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'El desenvolupament sostenible busca l\'equilibri entre economia, societat i medi ambient per a les generacions presents i futures.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'L\'educació que rebem a l\'escola o a la universitat s\'anomena...', 'tipus': 'opcions', 'opcions': {'a': 'Educació Informal', 'b': 'Educació No Formal', 'c': 'Educació Formal', 'd': 'Autoaprenentatge'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'L\'educació formal és la reglada, estructurada i que condueix a una titulació oficial.', 'ambit': 'Tipus d\'Educació'},
    # Assegura't que tens prous preguntes per cada nivell (mínim 10)
]

# --- DADES DEL SIMULADOR DE VIDA ---
VIDA = {
    'base_avatar': [
        {'nom': 'Home', 'icon': '🧑'}, {'nom': 'Dona', 'icon': '👩'}, {'nom': 'Persona', 'icon': '👤'}
    ],
    'skin_tones': [
        {'modifier': '🏻', 'color': '#F7D3AC'}, {'modifier': '🏼', 'color': '#E0BB95'},
        {'modifier': '🏽', 'color': '#BF8F68'}, {'modifier': '🏾', 'color': '#8B6851'},
        {'modifier': '🏿', 'color': '#5C443A'}
    ],
    'professions': [
        {'nom': 'Principiant', 'icon': '‍🦱', 'cost': 0}, {'nom': 'Estudiant', 'icon': '‍🎓', 'cost': 20000},
        {'nom': 'Professional', 'icon': '‍💼', 'cost': 100000},
        {'nom': 'Director/a de Projectes', 'icon': '‍📈', 'cost': 350000},
        {'nom': 'Expert/a', 'icon': '‍⚖️', 'cost': 900000},
        {'nom': 'Consultor/a Internacional', 'icon': '‍🌐', 'cost': 2500000},
        {'nom': 'Savi/a', 'icon': '‍🧘', 'cost': 7000000},
        {'nom': 'Guardià del Planeta', 'icon': '‍🌍', 'cost': 20000000},
    ],
    'casa': [
        {'nom': 'Caixa de Cartró', 'icon': '📦', 'cost': 0}, {'nom': 'Pis de Lloguer', 'icon': '🏢', 'cost': 80000},
        {'nom': 'Apartament en Propietat', 'icon': '🏬', 'cost': 250000},
        {'nom': 'Casa Adossada', 'icon': '🏡', 'cost': 700000},
        {'nom': 'Xalet amb Jardí', 'icon': '🏘️', 'cost': 1500000},
        {'nom': 'Vil·la Sostenible', 'icon': '🏰', 'cost': 4000000},
        {'nom': 'Mansió Autosuficient', 'icon': '🏞️', 'cost': 10000000},
        {'nom': 'Eco-gratacel Personal', 'icon': '🏙️', 'cost': 25000000},
        {'nom': 'Ciutat Submarina Privada', 'icon': '🌊', 'cost': 100000000},
    ],
    'vehicle': [
        {'nom': 'Caminant', 'icon': '🚶', 'cost': 0}, {'nom': 'Bicicleta', 'icon': '🚲', 'cost': 15000},
        {'nom': 'Abonament Transport Públic', 'icon': '🚇', 'cost': 40000},
        {'nom': 'Moto Elèctrica', 'icon': '🛵', 'cost': 90000},
        {'nom': 'Cotxe Elèctric', 'icon': '🚗', 'cost': 300000},
        {'nom': 'Iot Elèctric', 'icon': '⛵', 'cost': 1000000},
        {'nom': 'Jet Privat Sostenible', 'icon': '✈️', 'cost': 5000000},
        {'nom': 'Hyperloop Personal', 'icon': '🚄', 'cost': 15000000},
        {'nom': 'Coet Espacial Reutilitzable', 'icon': '🚀', 'cost': 50000000},
        {'nom': 'Teletransportador Quàntic', 'icon': '✨', 'cost': 250000000},
    ],
    'habilitats': [
        {'id': 'hab01', 'nom': 'Llegir un Article', 'icon': '📄', 'cost': 50, 'multiplicador': 1.2},
        {'id': 'hab02', 'nom': 'Veure un Documental', 'icon': '📺', 'cost': 150, 'multiplicador': 1.3},
        {'id': 'hab03', 'nom': 'Assistir a una Xerrada', 'icon': '🗣️', 'cost': 450, 'multiplicador': 1.5},
        {'id': 'hab04', 'nom': 'Subscripció a Revista Científica', 'icon': '🔬', 'cost': 900, 'multiplicador': 1.4},
        {'id': 'hab05', 'nom': 'Curs Bàsic de Finances', 'icon': '🪙', 'cost': 2500, 'multiplicador': 1.6},
        {'id': 'hab06', 'nom': 'Taller de Reciclatge', 'icon': '♻️', 'cost': 8000, 'multiplicador': 1.5},
        {'id': 'hab07', 'nom': 'Seminari d\'Ecologia', 'icon': '🌱', 'cost': 18000, 'multiplicador': 1.8},
        {'id': 'hab08', 'nom': 'Certificat d\'Eficiència Energètica', 'icon': '💡', 'cost': 40000, 'multiplicador': 1.7},
        {'id': 'hab09', 'nom': 'Bootcamp de Borsa Verda', 'icon': '💹', 'cost': 90000, 'multiplicador': 2.0},
        {'id': 'hab10', 'nom': 'Postgrau en Polítiques Ambientals', 'icon': '🏛️', 'cost': 220000, 'multiplicador': 2.2},
        {'id': 'hab11', 'nom': 'Màster en Sostenibilitat', 'icon': '🎓', 'cost': 550000, 'multiplicador': 2.5},
        {'id': 'hab12', 'nom': 'Doctorat en Ciències del Clima', 'icon': '🌪️', 'cost': 1200000, 'multiplicador': 3.0},
        {'id': 'hab13', 'nom': 'Publicar un Paper Científic', 'icon': '✍️', 'cost': 2800000, 'multiplicador': 3.5},
        {'id': 'hab14', 'nom': 'Premi Nobel de la Sostenibilitat', 'icon': '🏆', 'cost': 6000000, 'multiplicador': 5.0},
    ]
}

# --- FUNCIONS DEL JOC ---
def go_to_state(new_state):
    """Funció centralitzada per canviar d'estat i netejar variables de sessió."""
    # Guardem els guanys de l'examen al saldo principal si n'hi ha
    if 'guanys_sessio' in st.session_state and st.session_state.guanys_sessio is not None:
        st.session_state.ecos += st.session_state.guanys_sessio

    # Llista de claus temporals d'una sessió de joc
    session_keys_to_delete = ['preguntes', 'guanys_sessio', 'pregunta_actual_idx', 'resposta_enviada', 'resposta_correcta', 'session_correctes', 'session_performance_ambit', 'timer_start', 'guanys_processats']
    for key in session_keys_to_delete:
        if key in st.session_state:
            del st.session_state[key]
    
    st.session_state.estat_joc = new_state
    st.rerun()

def get_current_avatar():
    base = VIDA['base_avatar'][st.session_state.base_avatar_idx]['icon']
    skin = VIDA['skin_tones'][st.session_state.skin_tone_idx]['modifier']
    profession = VIDA['professions'][st.session_state.professions_idx]['icon']
    return f"{base}{skin}{profession}"

def iniciar_joc(nivell):
    st.session_state.session_correctes = 0
    st.session_state.session_performance_ambit = {}
    preguntes_filtrades = [p for p in PREGUNTES if p.get('nivell') == nivell]
    st.session_state.preguntes = random.sample(preguntes_filtrades, 10)
    st.session_state.guanys_sessio = 0
    st.session_state.pregunta_actual_idx = 0
    go_to_state('jugant')

def comprovar_resposta_multiple(respostes_usuari, respostes_correctes):
    return sorted(respostes_usuari) == sorted(respostes_correctes)

def calcular_multiplicador_total():
    multiplicador = 1.0
    for hab_id in st.session_state.get('habilitats_comprades', []):
        habilitat = next((h for h in VIDA['habilitats'] if h['id'] == hab_id), None)
        if habilitat: multiplicador *= habilitat['multiplicador']
    return multiplicador

# --- INICIALITZACIÓ DE L'ESTAT DE LA SESSIÓ ---
if 'estat_joc' not in st.session_state:
    st.session_state.estat_joc = 'inici'
    st.session_state.ecos = 10
    st.session_state.nivells_desbloquejats = ['principiant']
    st.session_state.base_avatar_idx = 0
    st.session_state.skin_tone_idx = 2
    st.session_state.professions_idx = 0
    st.session_state.casa_idx = 0
    st.session_state.vehicle_idx = 0
    st.session_state.habilitats_comprades = []
    st.session_state.stats = {'total_preguntes': 0, 'total_correctes': 0, 'total_guanyat': 0, 'total_perdut': 0, 'rendiment_ambit': {}}

# --- PANELL DE CONTROL SUPERIOR (PERSISTENT) ---
if st.session_state.estat_joc != 'inici':
    cols_header = st.columns([1, 2, 1])
    with cols_header[0]:
        st.metric("Saldo", f"{st.session_state.ecos} ECO$")
    with cols_header[1]:
        st.markdown(f"<p style='font-size: 4rem; text-align: center; margin-bottom: -20px;'>{get_current_avatar()}</p>", unsafe_allow_html=True)
        st.markdown(f"<p style='text-align: center;'>{st.session_state.get('nom_jugador', 'Jugador/a')}</p>", unsafe_allow_html=True)
    with cols_header[2]:
        st.metric("Multiplicador de Guanys", f"x{calcular_multiplicador_total():.2f}")
    st.markdown("---")

# --- LÒGICA PRINCIPAL DE L'APLICACIÓ ---

if st.session_state.estat_joc == 'inici':
    st.title("🌍 Benvingut/da a ECA Quest!")
    st.header("El teu coneixement és la teva riquesa.")
    
    with st.container(border=True):
        st.write("En aquest simulador, començaràs amb 10 ECO$ i el coneixement bàsic. Respon correctament a les preguntes per guanyar més ECO$, compra millores per multiplicar els teus guanys i desbloqueja exàmens més difícils per a demostrar que ets un/a autèntic/a expert/a en sostenibilitat.")
        
        nom = st.text_input("Com et dius, aspirant a savi/a?")
        if st.button("Començar la meva Aventura", use_container_width=True):
            if nom:
                st.session_state.nom_jugador = nom
                go_to_state('seleccion_nivell')
            else:
                st.warning("Necessites un nom per a començar!")

elif st.session_state.estat_joc == 'seleccion_nivell':
    st.title("🎓 Borsa del Saber")
    st.header("Selecciona un examen per posar a prova els teus coneixements")

    COSTOS_NIVELL = {'principiant': 0, 'avançat': 1000, 'expert': 5000, 'llegenda': 20000}
    nivells_info = {
        'principiant': ("🌱 Examen de Principiant", "10 preguntes fonamentals."),
        'avançat': ("🧠 Examen Avançat", "10 preguntes de detalls específics."),
        'expert': ("🔥 Examen d'Expert", "10 preguntes complexes."),
        'llegenda': ("👑 Examen de Llegenda", "10 preguntes amb múltiples respostes.")
    }

    cols = st.columns(len(nivells_info))
    for i, (nivell, (titol, desc)) in enumerate(nivells_info.items()):
        with cols[i]:
            with st.container(border=True):
                st.subheader(titol)
                st.write(desc)
                if nivell in st.session_state.nivells_desbloquejats:
                    if st.button(f"Jugar Examen", key=f"btn_jugar_{nivell}", use_container_width=True):
                        iniciar_joc(nivell)
                else:
                    cost = COSTOS_NIVELL[nivell]
                    if st.button(f"Desbloquejar ({cost} ECO$)", key=f"btn_desbloquejar_{nivell}", use_container_width=True):
                        if st.session_state.ecos >= cost:
                            st.session_state.ecos -= cost
                            st.session_state.nivells_desbloquejats.append(nivell)
                            st.toast(f"Has desbloquejat l'examen '{titol}'!", icon="🎉"); st.rerun()
                        else:
                            st.warning("No tens suficients ECO$!")
    
    st.markdown("---")
    if st.button("🛍️ Anar a la Botiga de Millores", use_container_width=True):
        go_to_state('botiga')

elif st.session_state.estat_joc == 'jugant':
    if 'preguntes' not in st.session_state or st.session_state.pregunta_actual_idx >= len(st.session_state.preguntes):
        go_to_state('resultats')
    else:
        pregunta_actual = st.session_state.preguntes[st.session_state.pregunta_actual_idx]
        
        guanys = st.session_state.get('guanys_sessio', 0)
        color = "#34d399" if guanys >= 0 else "#f87171"
        st.markdown(f"<p style='text-align: center; font-size: 5rem; font-weight: 600; color: {color}; line-height: 1;'>{guanys} ECO$</p>", unsafe_allow_html=True)
        st.progress(st.session_state.pregunta_actual_idx / len(st.session_state.preguntes), text=f"Pregunta {st.session_state.pregunta_actual_idx + 1} de 10")
        
        with st.container(border=True):
            st.markdown(f"#### {pregunta_actual['pregunta']}")
            disabled = st.session_state.get('resposta_enviada', False)
            
            if pregunta_actual['tipus'] == 'opcions':
                st.radio("Tria la teva inversió:", options=pregunta_actual['opcions'].keys(), format_func=lambda k: f"{k.upper()}) {pregunta_actual['opcions'][k]}", index=None, key="widget", disabled=disabled)
            elif pregunta_actual['tipus'] == 'multiple':
                st.multiselect("Selecciona TOTES les inversions correctes:", options=pregunta_actual['opcions'].keys(), format_func=lambda k: f"{k.upper()}) {pregunta_actual['opcions'][k]}", key="widget", disabled=disabled)
        
        if st.session_state.get('resposta_enviada', False):
            if st.session_state.get('resposta_correcta', False): 
                st.success("✅ Resposta Correcta!")
            else: 
                st.error(f"❌ Resposta Incorrecta! Has perdut 50 ECO$.")
            st.info(f"💡 **Anàlisi:** {pregunta_actual['feedback']}")
            if st.button("Següent Pregunta →", use_container_width=True):
                st.session_state.pregunta_actual_idx += 1
                st.session_state.resposta_enviada = False
                del st.session_state.resposta_correcta
                st.rerun()
        else:
            if 'timer_start' not in st.session_state: st.session_state['timer_start'] = time.time()

            if st.button("Confirmar Resposta", use_container_width=True):
                resposta = st.session_state.get("widget")
                if resposta:
                    st.session_state.resposta_enviada = True
                    correcta = (pregunta_actual['tipus'] == 'opcions' and resposta == pregunta_actual['correcta']) or \
                               (pregunta_actual['tipus'] == 'multiple' and sorted(resposta) == sorted(pregunta_actual['correcta']))
                    
                    temps = time.time() - st.session_state.timer_start
                    del st.session_state.timer_start
                    
                    ambit = pregunta_actual.get('ambit', 'General')
                    if ambit not in st.session_state.stats['rendiment_ambit']: st.session_state.stats['rendiment_ambit'][ambit] = {'correctes': 0, 'total': 0}
                    if ambit not in st.session_state.session_performance_ambit: st.session_state.session_performance_ambit[ambit] = {'correctes': 0, 'total': 0}

                    st.session_state.stats['total_preguntes'] += 1; st.session_state.stats['rendiment_ambit'][ambit]['total'] += 1
                    st.session_state.session_performance_ambit[ambit]['total'] += 1
                    
                    if correcta:
                        st.session_state.session_correctes += 1
                        valor_final = max(0, 100 - (temps * 5))
                        guany = math.ceil(valor_final * calcular_multiplicador_total())
                        st.session_state.guanys_sessio += guany
                        st.session_state.stats['total_correctes'] += 1; st.session_state.stats['rendiment_ambit'][ambit]['correctes'] += 1
                        st.session_state.session_performance_ambit[ambit]['correctes'] += 1
                        st.session_state.stats['total_guanyat'] = st.session_state.stats.get('total_guanyat', 0) + guany
                    else:
                        penalitzacio = 50; st.session_state.guanys_sessio -= penalitzacio
                        st.session_state.stats['total_perdut'] = st.session_state.stats.get('total_perdut', 0) + penalitzacio
                    
                    st.session_state.resposta_correcta = correcta
                    st.rerun()
                else: 
                    st.warning("Has de seleccionar una opció.")

elif st.session_state.estat_joc == 'resultats':
    st.title("📊 Resultats de l'Examen")
    
    # Lògica per processar els guanys només una vegada
    session_earnings = st.session_state.get('guanys_sessio', 0)
    if 'guanys_processats' not in st.session_state:
        st.session_state.ecos += session_earnings
        st.session_state.guanys_processats = True

    if session_earnings > 0:
        st.balloons(); st.success(f"Excel·lent sessió! Has guanyat {session_earnings} ECO$.")
    else:
        st.error(f"Aquesta sessió ha generat pèrdues de {session_earnings} ECO$. Més sort la propera vegada!")

    col1, col2, col3 = st.columns(3)
    col1.metric("Balanç de la Sessió", f"{session_earnings} ECO$")
    session_correctes = st.session_state.get('session_correctes', 0)
    col2.metric("Respostes Correctes", f"{session_correctes} de 10")
    col3.metric("Precisió", f"{(session_correctes / 10) * 100:.0f}%")
    
    st.markdown("---"); st.header("Rendiment per Àmbit")
    
    performance = st.session_state.get('session_performance_ambit', {})
    if not performance:
        st.info("No s'han registrat dades de rendiment en aquesta sessió.")
    else:
        for ambit, dades in performance.items():
            correctes = dades.get('correctes', 0); total = dades.get('total', 0)
            if total > 0:
                st.write(f"**{ambit}:** {correctes} de {total} correctes"); st.progress(correctes / total)
    
    st.markdown("---")
    
    col_btn1, col_btn2 = st.columns(2)
    if col_btn1.button("Tornar a Jugar", use_container_width=True): go_to_state('seleccion_nivell')
    if col_btn2.button("Anar a la Botiga", use_container_width=True): go_to_state('botiga')

elif st.session_state.estat_joc == 'botiga':
    st.title("🛍️ Botiga de Millores")
    
    tabs_icons = ["✏️", "🎓", "🏡", "🚗", "💹"]
    tabs_names = ["Perfil", "Estil de Vida", "Llar", "Transport", "Habilitats"]
    tab1, tab2, tab3, tab4, tab5 = st.tabs([f"{icon} {name}" for icon, name in zip(tabs_icons, tabs_names)])
    
    with tab1:
        st.subheader("Personalitza el teu Avatar")
        col1, col2 = st.columns([2,3])
        with col1:
            st.session_state.base_avatar_idx = st.radio("Gènere", range(len(VIDA['base_avatar'])), format_func=lambda i: VIDA['base_avatar'][i]['nom'], horizontal=True, key="base_avatar_selector")
            st.write("To de pell:")
            cols_tones = st.columns(len(VIDA['skin_tones']))
            for i, tone in enumerate(VIDA['skin_tones']):
                with cols_tones[i]:
                    selected_border = "2px solid #38bdf8" if st.session_state.skin_tone_idx == i else "2px solid grey"
                    st.markdown(f"<div style='width:30px; height:30px; background-color:{tone['color']}; border-radius:50%; margin: 5px auto; border: {selected_border};'></div>", unsafe_allow_html=True)
            st.session_state.skin_tone_idx = st.radio("Selector de to de pell", range(len(VIDA['skin_tones'])), format_func=lambda i: "", horizontal=True, key="skin_tone_selector", label_visibility="collapsed")
        with col2:
            st.markdown("**Resultat:**"); st.markdown(f"<div style='width:100%; text-align:center;'><p style='font-size: 8rem; line-height: 1;'>{get_current_avatar()}</p></div>", unsafe_allow_html=True)

    with tab2:
        for i in range(st.session_state.professions_idx + 1, len(VIDA['professions'])):
            item = VIDA['professions'][i]; st.markdown(f"### {get_current_avatar().split('‍')[0]}‍{item['icon']} {item['nom']}")
            if st.button(f"Comprar per {item['cost']} ECO$", key=f"buy_prof_{i}"):
                if st.session_state.ecos >= item['cost']: st.session_state.ecos -= item['cost']; st.session_state.professions_idx = i; st.toast("Estil millorat!", icon="🎉"); st.rerun()
                else: st.warning("Saldo insuficient!")
            st.markdown("---")
        if st.session_state.professions_idx == len(VIDA['professions']) - 1: st.success("Has assolit el màxim nivell d'estil!")
    
    with tab3:
        for i in range(st.session_state.casa_idx + 1, len(VIDA['casa'])):
            item = VIDA['casa'][i]; st.markdown(f"### {item['icon']} {item['nom']}")
            if st.button(f"Comprar per {item['cost']} ECO$", key=f"buy_casa_{i}"):
                if st.session_state.ecos >= item['cost']: st.session_state.ecos -= item['cost']; st.session_state.casa_idx = i; st.toast("Llar millorada!", icon="🎉"); st.rerun()
                else: st.warning("Saldo insuficient!")
            st.markdown("---")
        if st.session_state.casa_idx == len(VIDA['casa']) - 1: st.success("Tens la millor llar possible!")

    with tab4:
        for i in range(st.session_state.vehicle_idx + 1, len(VIDA['vehicle'])):
            item = VIDA['vehicle'][i]; st.markdown(f"### {item['icon']} {item['nom']}")
            if st.button(f"Comprar per {item['cost']} ECO$", key=f"buy_vehicle_{i}"):
                if st.session_state.ecos >= item['cost']: st.session_state.ecos -= item['cost']; st.session_state.vehicle_idx = i; st.toast("Transport millorat!", icon="🎉"); st.rerun()
                else: st.warning("Saldo insuficient!")
            st.markdown("---")
        if st.session_state.vehicle_idx == len(VIDA['vehicle']) - 1: st.success("Tens el millor transport del joc!")
        
    with tab5:
        for hab in VIDA['habilitats']:
            if hab['id'] not in st.session_state.habilitats_comprades:
                st.markdown(f"### {hab['icon']} {hab['nom']}")
                st.write(f"Afegeix un multiplicador de: **x{hab['multiplicador']}**")
                if st.button(f"Comprar per {hab['cost']} ECO$", key=hab['id']):
                    if st.session_state.ecos >= hab['cost']: st.session_state.ecos -= hab['cost']; st.session_state.habilitats_comprades.append(hab['id']); st.toast(f"Has adquirit {hab['nom']}!", icon="💡"); st.rerun()
                    else: st.warning("Saldo insuficient!")
            else:
                st.markdown(f"### ✅ ~~{hab['icon']} {hab['nom']}~~"); st.success(f"ADQUIRIT (Multiplicador x{hab['multiplicador']} actiu)")
            st.markdown("---")
    
    if st.button("Tornar a la Selecció d'Examen", use_container_width=True):
        go_to_state('seleccion_nivell')

# Comprovació de la condició de victòria
if st.session_state.professions_idx == len(VIDA['professions']) - 1 and \
   st.session_state.casa_idx == len(VIDA['casa']) - 1 and \
   st.session_state.vehicle_idx == len(VIDA['vehicle']) - 1:
    
    st.balloons()
    st.title("🏆 ENHORABONA, MESTRE DE LA SOSTENIBILITAT! 🏆")
    st.header("Has completat la teva Vida Sostenible a ECA Quest.")
    st.markdown("Has demostrat un coneixement excepcional i has assolit el màxim nivell de progrés. Has passat de no tenir res a dominar el coneixement i construir un futur millor. El planeta t'ho agraeix!")
    if st.button("Tornar a començar una nova vida"):
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.rerun()
