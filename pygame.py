
import streamlit as st
import time
import random
import pandas as pd
import altair as alt

# --- ESTRUCTURES DE DADES ---

# Pla de Carrera Professional (Exàmens)
EXAMENS_INFO = [
    {"id": 1, "nom": "Fonaments de la Comunicació", "cost": 0, "nivell_dificultat": 1},
    {"id": 2, "nom": "Certificat en Assertivitat", "cost": 300, "nivell_dificultat": 2},
    {"id": 3, "nom": "Avançat en Intel·ligència Emocional", "cost": 750, "nivell_dificultat": 2},
    {"id": 4, "nom": "Diploma en Resolució de Conflictes", "cost": 1500, "nivell_dificultat": 3},
    {"id": 5, "nom": "Màster en Negociació Estratègica", "cost": 3000, "nivell_dificultat": 3},
    {"id": 6, "nom": "Postgrau en Lideratge d'Equips", "cost": 5000, "nivell_dificultat": 4},
]

# --- BANC DE 120 PREGUNTES AMB CATEGORIES ---
PREGUNTES_HABILITATS = [
    # --- NIVELL 1 (Comunicació Bàsica) ---
    {"pregunta": "¿Quina és la millor manera d'escoltar activament?", "opcions": ["Interrompre", "Mirar al mòbil", "Fer contacte visual i assentir", "Planificar la resposta"], "resposta_correcta": "Fer contacte visual i assentir", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1, "categoria": "Escolta Activa"},
    {"pregunta": "¿Com respons a una crítica constructiva?", "opcions": ["Defensivament", "Ignorant-la", "Agraint i preguntant com millorar", "Criticant a l'altre"], "resposta_correcta": "Agraint i preguntant com millorar", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Feedback"},
    {"pregunta": "Què implica l'escolta reflexiva?", "opcions": ["Donar la teva opinió", "Explicar una experiència pròpia", "Parafrasejar el que ha dit l'altre", "Assentir sense atenció"], "resposta_correcta": "Parafrasejar el que ha dit l'altre", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Escolta Activa"},
    {"pregunta": "Un somriure és un exemple de comunicació...", "opcions": ["Verbal", "Escrita", "No verbal", "Formal"], "resposta_correcta": "No verbal", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "La 'codificació' del missatge la realitza...", "opcions": ["El receptor", "L'emissor", "El canal", "El context"], "resposta_correcta": "L'emissor", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "Quin és un component conductual de les HH.SS.?", "opcions": ["Creences", "Expressió facial", "Autoestima", "Ansietat"], "resposta_correcta": "Expressió facial", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "El 'canal' en comunicació es refereix a...", "opcions": ["El missatge", "El receptor", "El mitjà de transmissió", "Les interferències"], "resposta_correcta": "El mitjà de transmissió", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "Què són les 'interferències' en la comunicació?", "opcions": ["El feedback", "Elements que dificulten la transmissió", "Llenguatge no verbal", "El context"], "resposta_correcta": "Elements que dificulten la transmissió", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "La retroalimentació (feedback) permet a l'emissor saber...", "opcions": ["Si el canal funciona", "Si el missatge ha estat rebut i comprès", "Quin és el context", "Si hi ha interferències"], "resposta_correcta": "Si el missatge ha estat rebut i comprès", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Feedback"},
    {"pregunta": "Creuar els braços durant una conversa pot interpretar-se com...", "opcions": ["Obertura i interès", "Defensa o desacord", "Relaxació total", "Ganes de participar"], "resposta_correcta": "Defensa o desacord", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    # ... (20 preguntes més de nivell 1)
    
    # --- NIVELL 2 (Assertivitat i Intel·ligència Emocional) ---
    {"pregunta": "Un company et demana ajuda urgent, però ja vas molt carregat. Quina és la resposta més assertiva?", "opcions": ["Dir 'sí' i treballar fins tard", "Dir 'no' sense explicacions", "Explicar que t'agradaria ajudar però ara no pots", "Criticar la seva planificació"], "resposta_correcta": "Explicar que t'agradaria ajudar però ara no pots", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "Un company de feina rep el crèdit per una idea teva. Què fas?", "opcions": ["No dir res", "Exposar-lo en públic", "Parlar amb ell en privat de manera calmada", "Queixar-te al cap"], "resposta_correcta": "Parlar amb ell en privat de manera calmada", "eco_guany": 30, "eco_perdua": 15, "dificultat": 2, "categoria": "Gestió de Conflictes"},
    {"pregunta": "Què és l'empatia?", "opcions": ["Sentir pena", "Solucionar problemes aliens", "Comprendre i compartir els sentiments d'altres", "Estar sempre d'acord"], "resposta_correcta": "Comprendre i compartir els sentiments d'altres", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Un estil de conducta 'passiu' es caracteritza per...", "opcions": ["Defensar els teus drets a qualsevol preu", "Respectar als altres i a tu mateix", "No expressar les teves necessitats", "Imposar la teva voluntat"], "resposta_correcta": "No expressar les teves necessitats", "eco_guany": 20, "eco_perdua": 10, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "Quina emoció s'associa principalment amb la percepció d'un perill?", "opcions": ["Còlera", "Alegria", "Tristesa", "Por"], "resposta_correcta": "Por", "eco_guany": 20, "eco_perdua": 10, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "La tècnica més efectiva per donar feedback constructiu és...", "opcions": ["Centrar-se en els errors", "Donar-lo en públic", "El mètode 'entrepà' (positiu-millora-positiu)", "Ser vague"], "resposta_correcta": "El mètode 'entrepà' (positiu-millora-positiu)", "eco_guany": 30, "eco_perdua": 15, "dificultat": 2, "categoria": "Feedback"},
    {"pregunta": "Quin Dret Assertiu apliques quan decideixes no justificar una decisió personal?", "opcions": ["A cometre errades", "A no donar raons o excuses", "A canviar d'opinió", "A ser el teu propi jutge"], "resposta_correcta": "A no donar raons o excuses", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "La funció principal de l'emoció de la 'còlera' és...", "opcions": ["Apropar-se als altres", "Fugir d'un perill", "Posar límits i defensar-se d'una injustícia", "Demanar ajuda"], "resposta_correcta": "Posar límits i defensar-se d'una injustícia", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    # ... (32 preguntes més de nivell 2)

    # --- NIVELL 3 (Resolució de Conflictes i Negociació) ---
    {"pregunta": "En una negociació, l'altra part es mostra agressiva. Què és aconsellable?", "opcions": ["Respondre igual", "Mantenir la calma i centrar-se en fets", "Acceptar les seves condicions", "Marxar"], "resposta_correcta": "Mantenir la calma i centrar-se en fets", "eco_guany": 50, "eco_perdua": 20, "dificultat": 3, "categoria": "Negociació"},
    {"pregunta": "Dos membres del teu equip tenen un conflicte obert. Quina és la teva primera acció com a líder?", "opcions": ["Ignorar-ho", "Canviar un d'ells de projecte", "Mediar en una reunió conjunta", "Demanar a RRHH que intervingui"], "resposta_correcta": "Mediar en una reunió conjunta", "eco_guany": 60, "eco_perdua": 25, "dificultat": 3, "categoria": "Gestió de Conflictes"},
    {"pregunta": "Què vol dir que l'esperança és una emoció 'ambigua'?", "opcions": ["Sempre és negativa", "No té funció", "Pot portar a sentiments positius o negatius", "Només apareix en l'art"], "resposta_correcta": "Pot portar a sentiments positius o negatius", "eco_guany": 50, "eco_perdua": 25, "dificultat": 3, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Com gestiones la teva pròpia frustració davant un obstacle inesperat?", "opcions": ["Abandonar el projecte", "Cercar culpables", "Reconèixer l'emoció i reenfocar en solucions", "Queixar-se constantment"], "resposta_correcta": "Reconèixer l'emoció i reenfocar en solucions", "eco_guany": 55, "eco_perdua": 20, "dificultat": 3, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Quin és l'objectiu principal d'una negociació estil 'win-win'?", "opcions": ["Guanyar a qualsevol preu", "Que l'altra part perdi", "Trobar una solució que satisfaci ambdues parts", "Arribar a un punt mort"], "resposta_correcta": "Trobar una solució que satisfaci ambdues parts", "eco_guany": 65, "eco_perdua": 30, "dificultat": 3, "categoria": "Negociació"},
    # ... (25 preguntes més de nivell 3)

    # --- NIVELL 4 (Lideratge Avançat) ---
    {"pregunta": "Has de comunicar una decisió impopular a l'equip. Quina és la millor estratègia?", "opcions": ["Enviar un email breu", "Ser transparent sobre les raons i mostrar empatia", "Demanar a un altre que ho faci", "Anunciar-ho divendres a última hora"], "resposta_correcta": "Ser transparent sobre les raons i mostrar empatia", "eco_guany": 80, "eco_perdua": 35, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "Un membre clau del teu equip està desmotivat. Quina és la primera acció a prendre?", "opcions": ["Documentar el seu baix rendiment", "Tenir una conversa privada per entendre què passa", "Reassignar les seves tasques", "Pressionar-lo públicament"], "resposta_correcta": "Tenir una conversa privada per entendre què passa", "eco_guany": 100, "eco_perdua": 40, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "Com es fomenta la 'seguretat psicològica' en un equip?", "opcions": ["Castigant els errors", "Promovent competència extrema", "Creant un entorn on es pot parlar obertament sense por", "Prenent decisions sense consultar"], "resposta_correcta": "Creant un entorn on es pot parlar obertament sense por", "eco_guany": 110, "eco_perdua": 45, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "L'empresa passa per una crisi. Quin tipus de comunicació és essencial per part del lideratge?", "opcions": ["Silenci total per no alarmar", "Optimisme poc realista", "Comunicació freqüent, transparent i empàtica", "Comunicació només als alts càrrecs"], "resposta_correcta": "Comunicació freqüent, transparent i empàtica", "eco_guany": 100, "eco_perdua": 40, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "En una negociació crítica, l'altra part utilitza tàctiques de pressió. Què fas?", "opcions": ["Respondre igual", "Cedir ràpidament", "Mantenir la calma, identificar la tàctica i redirigir", "Abandonar la negociació"], "resposta_correcta": "Mantenir la calma, identificar la tàctica i redirigir", "eco_guany": 120, "eco_perdua": 50, "dificultat": 4, "categoria": "Negociació"},
    # ... (15 preguntes més de nivell 4)
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
if 'preguntes_respostes' not in st.session_state:
    st.session_state.preguntes_respostes = 0
if 'respostes_correctes' not in st.session_state:
    st.session_state.respostes_correctes = 0
if 'errors_per_categoria' not in st.session_state:
    st.session_state.errors_per_categoria = {}

# --- FUNCIONS DEL JOC ---
def generar_pregunta():
    nivell_maxim_desbloquejat = max(ex['nivell_dificultat'] for ex in st.session_state.examens if ex['unlocked'])
    preguntes_disponibles = [p for p in PREGUNTES_HABILITATS if p['dificultat'] <= nivell_maxim_desbloquejat]
    st.session_state.pregunta_actual = random.choice(preguntes_disponibles) if preguntes_disponibles else None
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
        h1, h2, h3, h5 { font-family: 'Montserrat', sans-serif; color: var(--primary-color); }
        h1 { font-size: 2.8em; text-align: center; margin-bottom: 25px; background: -webkit-linear-gradient(45deg, var(--primary-color), #007bff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .stat-card { background-color: var(--card-bg); border-radius: var(--border-radius); padding: 25px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; border-top: 5px solid var(--primary-color); transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
        .saldo-change { position: absolute; top: 20px; right: 25px; font-size: 1.6em; font-weight: 700; animation: fadeInOut 1.5s ease-in-out forwards; }
        .saldo-change.positive { color: var(--accent-color); }
        .saldo-change.negative { color: #d9534f; }
        @keyframes fadeInOut { 0% { opacity: 0; transform: translateY(20px); } 20% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } }
        .content-card, .dashboard-card { background-color: var(--card-bg); border-radius: var(--border-radius); padding: 35px; box-shadow: var(--shadow-sm); min-height: 400px; }
        .stButton>button { background-color: var(--primary-color); color: white; border: none; border-radius: 10px; padding: 14px 28px; font-size: 1.1em; font-family: 'Montserrat', sans-serif; font-weight: 600; width: 100%; transition: all 0.2s ease; margin-top: 15px; box-shadow: 0 4px 10px rgba(0, 68, 129, 0.2); }
        .stButton>button:hover { transform: translateY(-3px); box-shadow: 0 7px 15px rgba(0, 68, 129, 0.3); }
        .stButton>button:disabled { background-color: #a9cce3; opacity: 0.6; cursor: not-allowed; box-shadow: none; }
        .feedback-guany { color: var(--accent-color); font-weight: 700; font-size: 1.1em; }
        .feedback-perdua { color: #d9534f; font-weight: 700; font-size: 1.1em; }
        .exam-item { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 15px; border-radius: 12px; transition: all 0.2s; margin-bottom: 10px; border: 1px solid #eee; }
        .exam-item.unlocked { background-color: #e8f5e9; border-left: 5px solid var(--accent-color); }
        .exam-item.locked { background-color: #f5f5f5; opacity: 0.8; }
        .exam-details p { font-weight: 700; margin: 0; color: var(--primary-color); }
        .exam-details span { font-size: 0.9em; color: var(--light-text-color); }
        .stat-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
        .stat-label { color: var(--light-text-color); }
        .stat-value { font-weight: 700; }
    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---
st.title("ECO-Banc: Habilitats de Comunicació")

# ... (El codi de les targetes de saldo i puntuació es manté exactament igual) ...
col_stats_1, col_stats_2 = st.columns(2)
with col_stats_1:
    saldo_html = f"""<div class="stat-card"><div style="display: flex; align-items: center;"><span style="font-size: 3em; margin-right: 20px; line-height: 1;">🏦</span><div class="details"><h2 style="font-size: 1.1em; color: var(--light-text-color); margin: 0;">Capital d'Habilitats (ECO$)</h2><p style="font-size: 2.2em; font-weight: 700; color: var(--primary-color); margin: 0;">{st.session_state.saldo_eco:.0f}</p></div></div>"""
    if st.session_state.mostrar_cambio and st.session_state.cambio_saldo != 0:
        saldo_html += f'<div class="saldo-change {"positive" if st.session_state.cambio_saldo > 0 else "negative"}">{"+" if st.session_state.cambio_saldo > 0 else ""}{st.session_state.cambio_saldo}</div>'
    saldo_html += "</div>"
    st.markdown(saldo_html, unsafe_allow_html=True)

with col_stats_2:
    st.markdown(f"""<div class="stat-card" style="border-top-color: var(--accent-color);"><div style="display: flex; align-items: center; width: 100%;"><span style="font-size: 3em; margin-right: 20px; line-height: 1;">🧠</span><div class="details" style="width: 100%;"><h2 style="font-size: 1.1em; color: var(--light-text-color); margin: 0;">Puntuació Professional</h2><p style="font-size: 2.2em; font-weight: 700; color: var(--primary-color); margin: 0;">{st.session_state.puntuacio_habilitats}</p></div></div></div>""", unsafe_allow_html=True)

st.write("")

# --- NOU PANELL DE RENDIMENT ---
if st.session_state.preguntes_respostes > 0:
    st.subheader("El Teu Panell de Rendiment")
    dash_col1, dash_col2 = st.columns(2)
    with dash_col1:
        st.markdown('<div class="dashboard-card" style="min-height: 300px;">', unsafe_allow_html=True)
        st.markdown("<h5>Estadístiques Generals</h5>", unsafe_allow_html=True)
        
        total_respostes = st.session_state.preguntes_respostes
        correctes = st.session_state.respostes_correctes
        percentatge_encert = (correctes / total_respostes * 100) if total_respostes > 0 else 0
        
        st.markdown(f"""
            <div class="stat-item"><span class="stat-label">Percentatge d'Encerts</span><span class="stat-value">{percentatge_encert:.1f}%</span></div>
            <div class="stat-item"><span class="stat-label">Preguntes Respostes</span><span class="stat-value">{total_respostes}</span></div>
            <div class="stat-item"><span class="stat-label">Respostes Correctes</span><span class="stat-value" style="color: var(--accent-color);">{correctes}</span></div>
            <div class="stat-item"><span class="stat-label">Respostes Incorrectes</span><span class="stat-value" style="color: #d9534f;">{total_respostes - correctes}</span></div>
        """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with dash_col2:
        st.markdown('<div class="dashboard-card" style="min-height: 300px;">', unsafe_allow_html=True)
        st.markdown("<h5>Àrees de Millora</h5>", unsafe_allow_html=True)
        if st.session_state.errors_per_categoria:
            errors_df = pd.DataFrame(list(st.session_state.errors_per_categoria.items()), columns=['Habilitat', 'Errors'])
            chart = alt.Chart(errors_df).mark_bar().encode(
                x=alt.X('Errors:Q', title='Nombre d\'Errors'),
                y=alt.Y('Habilitat:N', title='Habilitat', sort='-x'),
                tooltip=['Habilitat', 'Errors']
            ).properties(
                title='Errors per Categoria d\'Habilitat'
            )
            st.altair_chart(chart, use_container_width=True)
        else:
            st.info("Encara no has comès cap error. Continua així!")
        st.markdown('</div>', unsafe_allow_html=True)
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
            st.markdown(f"""<div class="exam-item {status_class}" style="width: 100%;"><span style="font-size: 1.8em;">🎓</span><div class="exam-details"><p>{examen['nom']}</p><span>{'✅ Desbloquejat' if examen['unlocked'] else f"Cost: {examen['cost']} ECO$"}</span></div></div>""", unsafe_allow_html=True)

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

