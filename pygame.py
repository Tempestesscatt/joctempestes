import streamlit as st
import time
import random
import pandas as pd
import altair as alt
from collections import deque

# --- ESTRUCTURES DE DADES BASADES EN EL TEMARI D'EDAFOLOGIA ---

# Itinerari Formatiu en Edafologia
EXAMENS_INFO = [
    {"id": 1, "nom": "Introducció a l'Edafologia", "cost": 0, "nivell_dificultat": 1, "icon": "🌍"},
    {"id": 2, "nom": "Anàlisi de Perfils del Sòl", "cost": 200, "nivell_dificultat": 2, "icon": "📏"},
    {"id": 3, "nom": "Propietats Fisicoquímiques", "cost": 500, "nivell_dificultat": 3, "icon": "🔬"},
    {"id": 4, "nom": "Expert en Edafogènesi", "cost": 1000, "nivell_dificultat": 4, "icon": "🌱"},
]

# --- NOU BANC DE PREGUNTES D'EDAFOLOGIA ---
PREGUNTES_HABILITATS = [
    # --- NIVELL 1: Concepte de Sòl i Funcions ---
    {"pregunta": "Què és l'edafologia?", "opcions": ["L'estudi de les roques", "La ciència que estudia el sòl des de tots els punts de vista", "L'estudi del clima", "La ciència de les plantes"], "resposta_correcta": "La ciència que estudia el sòl des de tots els punts de vista", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "El sòl es defineix com la capa superior de la superfície, formada per...", "opcions": ["Sedimentació marina", "Activitat volcànica", "Meteorització de les roques", "Compactació artificial"], "resposta_correcta": "Meteorització de les roques", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "Quina d'aquestes NO és una funció del sòl en els ecosistemes?", "opcions": ["Hàbitat per a organismes", "Regulador del subministrament d'aigua", "Generador principal d'oxigen atmosfèric", "Sistema de reciclatge de matèria orgànica"], "resposta_correcta": "Generador principal d'oxigen atmosfèric", "eco_guany": 25, "eco_perdua": 10, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "El sòl actua com a medi per al creixement de...", "opcions": ["Només arbres", "Només fongs", "Les plantes", "Els animals marins"], "resposta_correcta": "Les plantes", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "La funció de 'depurador' del sòl es refereix a la seva capacitat de...", "opcions": ["Emmagatzemar aigua de pluja", "Filtrar i reciclar nutrients i matèria orgànica", "Servir de base per a la construcció", "Reflectir la llum solar"], "resposta_correcta": "Filtrar i reciclar nutrients i matèria orgànica", "eco_guany": 25, "eco_perdua": 10, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "El sòl és considerat un recurs...", "opcions": ["Renovable a curt termini", "Infinit", "No renovable pel seu lent temps de formació", "Artificial"], "resposta_correcta": "No renovable pel seu lent temps de formació", "eco_guany": 25, "eco_perdua": 10, "dificultat": 1, "categoria": "Conceptes Bàsics"},

    # --- NIVELL 2: Perfil del Sòl i Horitzons ---
    {"pregunta": "Quin horitzó del sòl està format per fullaraca i restes orgàniques sense transformar?", "opcions": ["Horitzó A", "Horitzó B", "Horitzó O", "Horitzó C"], "resposta_correcta": "Horitzó O", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Perfil del Sòl"},
    {"pregunta": "L'horitzó A, o de rentatge, es caracteritza per ser ric en...", "opcions": ["Fragments de roca mare", "Argila i minerals precipitats", "Humus i matèria orgànica", "Sals solubles"], "resposta_correcta": "Humus i matèria orgànica", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Perfil del Sòl"},
    {"pregunta": "Quin horitzó es coneix com a 'de precipitació' i té un enriquiment en argila i òxids?", "opcions": ["Horitzó A", "Horitzó B", "Horitzó C", "Horitzó R"], "resposta_correcta": "Horitzó B", "eco_guany": 45, "eco_perdua": 20, "dificultat": 2, "categoria": "Perfil del Sòl"},
    {"pregunta": "L'horitzó C o subsòl està format principalment per...", "opcions": ["Humus negre", "La roca mare no alterada", "Fullaraca", "Fragments meteoritzats de la roca mare"], "resposta_correcta": "Fragments meteoritzats de la roca mare", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Perfil del Sòl"},
    {"pregunta": "La roca no alterada que es troba a la part inferior del perfil es denomina...", "opcions": ["Horitzó C", "Horitzó A", "Subsòl", "Horitzó R (roca mare)"], "resposta_correcta": "Horitzó R (roca mare)", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Perfil del Sòl"},
    {"pregunta": "Un horitzó de transició amb característiques intermèdies entre A i B es representaria com...", "opcions": ["A/B", "A+B", "AB", "B-A"], "resposta_correcta": "AB", "eco_guany": 45, "eco_perdua": 25, "dificultat": 2, "categoria": "Perfil del Sòl"},

    # --- NIVELL 3: Composició i Propietats del Sòl ---
    {"pregunta": "Els forats del sòl estan ocupats per...", "opcions": ["Només aigua", "Només matèria orgànica", "Aire i aigua", "Fragments de roca"], "resposta_correcta": "Aire i aigua", "eco_guany": 60, "eco_perdua": 30, "dificultat": 3, "categoria": "Composició"},
    {"pregunta": "La 'porositat' del sòl es defineix com...", "opcions": ["El pes total del sòl", "El volum de sòl ocupat pels forats respecte al volum total", "La quantitat de matèria orgànica", "El color del sòl"], "resposta_correcta": "El volum de sòl ocupat pels forats respecte al volum total", "eco_guany": 65, "eco_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Quina fracció de la terra fina té les partícules més petites (< 0,002 mm)?", "opcions": ["Sorra", "Llim", "Argila", "Graveta"], "resposta_correcta": "Argila", "eco_guany": 60, "eco_perdua": 30, "dificultat": 3, "categoria": "Textura"},
    {"pregunta": "Un sòl amb un 50% d'argila, 25% de llim i 25% de sorra té una textura...", "opcions": ["Sorrenca", "Llimosa", "Franca", "Argilosa"], "resposta_correcta": "Argilosa", "eco_guany": 70, "eco_perdua": 35, "dificultat": 3, "categoria": "Textura"},
    {"pregunta": "Un pH entre 6 i 8 generalment representa les millors condicions per a...", "opcions": ["La formació de roques", "L'erosió del sòl", "El desenvolupament de les plantes", "La compactació del sòl"], "resposta_correcta": "El desenvolupament de les plantes", "eco_guany": 65, "eco_perdua": 30, "dificultat": 3, "categoria": "Propietats Químiques"},
    {"pregunta": "La matèria orgànica al sòl millora la fertilitat...", "opcions": ["Només la física", "Només la química", "La física, la química i la biològica", "No afecta la fertilitat"], "resposta_correcta": "La física, la química i la biològica", "eco_guany": 70, "eco_perdua": 35, "dificultat": 3, "categoria": "Composició"},
    {"pregunta": "Quin ió fa efervescència amb HCl si hi ha carbonats al sòl?", "opcions": ["CO2", "O2", "H2", "N2"], "resposta_correcta": "CO2", "eco_guany": 65, "eco_perdua": 30, "dificultat": 3, "categoria": "Propietats Químiques"},
    {"pregunta": "El color fosc o negre d'un sòl sol indicar una alta presència de...", "opcions": ["Sorra", "Argila", "Carbonats", "Matèria orgànica"], "resposta_correcta": "Matèria orgànica", "eco_guany": 60, "eco_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},

    # --- NIVELL 4: Edafogènesi i Cicles Biogeoquímics ---
    {"pregunta": "El procés de formació del sòl s'anomena...", "opcions": ["Fotosíntesi", "Edafogènesi", "Sedimentació", "Compactació"], "resposta_correcta": "Edafogènesi", "eco_guany": 90, "eco_perdua": 45, "dificultat": 4, "categoria": "Edafogènesi"},
    {"pregunta": "La 'meteorització' es diferencia de l'erosió en què...", "opcions": ["La meteorització implica moviment", "La meteorització no implica moviment", "Són exactament el mateix", "La meteorització només és química"], "resposta_correcta": "La meteorització no implica moviment", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Edafogènesi"},
    {"pregunta": "Quin cicle biogeoquímic inclou processos com la nitrificació i la desnitrificació?", "opcions": ["Cicle del Carboni", "Cicle del Nitrogen", "Cicle de l'Aigua", "Cicle del Fòsfor"], "resposta_correcta": "Cicle del Nitrogen", "eco_guany": 90, "eco_perdua": 45, "dificultat": 4, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "Quin factor condiciona el tipus de meteorització i els fluxos verticals d'aigua (lixiviació)?", "opcions": ["El temps", "La roca mare", "El clima", "Els organismes"], "resposta_correcta": "El clima", "eco_guany": 95, "eco_perdua": 45, "dificultat": 4, "categoria": "Edafogènesi"},
    {"pregunta": "Els sòls formats amb materials transportats des d'altres llocs s'anomenen...", "opcions": ["Sòls autòctons", "Sòls primaris", "Sòls al·lòctons", "Sòls residuals"], "resposta_correcta": "Sòls al·lòctons", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Edafogènesi"},
    {"pregunta": "La conversió de nitrogen gas (N2) en formes aprofitables per les plantes s'anomena...", "opcions": ["Desnitrificació", "Amonificació", "Fixació", "Nitrificació"], "resposta_correcta": "Fixació", "eco_guany": 95, "eco_perdua": 45, "dificultat": 4, "categoria": "Cicles Biogeoquímics"},
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

# --- DISSENY DE LA INTERFÍCIE (UI) "NATURA I CIÈNCIA" ---
st.set_page_config(page_title="ECO-Sòl: Simulador d'Edafologia", page_icon="🌱", layout="wide")

st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap');
        :root {
            --primary-color: #2c5d3d; --accent-color: #6a994e; --text-color: #333;
            --light-text-color: #6c757d; --background-color: #f4f1e9; --card-bg: #ffffff;
            --border-radius: 12px; --shadow: 0 6px 20px rgba(0,0,0,0.08);
        }
        html, body, [class*="st-emotion"] { font-family: 'Lato', sans-serif; color: var(--text-color); background-color: var(--background-color); }
        h1, h2, h3, h5 { font-family: 'Lato', sans-serif; font-weight: 700; color: var(--primary-color); }
        .app-header h1 {
            font-size: 2.5em; text-align: center; margin-bottom: 2rem;
            background: -webkit-linear-gradient(45deg, var(--primary-color), var(--accent-color));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .stat-card {
            background: var(--card-bg); border-radius: var(--border-radius);
            padding: 25px; text-align: center; position: relative; box-shadow: var(--shadow);
            border-top: 4px solid var(--primary-color);
        }
        .stat-card h2 { font-size: 1em; color: var(--light-text-color); margin: 0; }
        .stat-card p { font-size: 2.5em; font-weight: 700; color: var(--primary-color); margin: 5px 0 0 0; }
        .saldo-change { position: absolute; top: 15px; right: 20px; font-size: 1.5em; font-weight: 700; animation: fadeInOut 1.5s ease-in-out forwards; }
        .saldo-change.positive { color: var(--accent-color); }
        .saldo-change.negative { color: #d9534f; }
        @keyframes fadeInOut { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
        .stButton>button {
            background-color: var(--accent-color);
            color: white; border: none; border-radius: 8px; padding: 16px 30px; font-size: 1.1em;
            font-weight: 700; width: 100%; transition: all 0.3s ease;
            margin-top: 15px; box-shadow: 0 4px 15px rgba(106, 153, 78, 0.3);
        }
        .stButton>button:hover { background-color: var(--primary-color); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(44, 93, 61, 0.3); }
        .stButton>button:disabled { background-color: #a5b89c; box-shadow: none; cursor: not-allowed; }
        .feedback-guany { color: var(--accent-color); } .feedback-perdua { color: #d9534f; }
        .career-path { position: relative; padding-left: 30px; border-left: 2px solid #ddd; }
        .step { position: relative; margin-bottom: 2rem; }
        .step-icon { position: absolute; left: -44px; top: 50%; transform: translateY(-50%); font-size: 1.8em; background: var(--background-color); padding: 5px; border-radius: 50%; }
        .step.unlocked .step-icon { color: var(--accent-color); }
        .step-details p { font-weight: 700; color: var(--primary-color); margin: 0; }
        .step-details span { font-size: 0.9em; color: var(--light-text-color); }
        .step.locked .step-details { opacity: 0.6; }
        .stTabs { border-radius: var(--border-radius); }
        div[data-baseweb="tab-list"] { background-color: #e9e5d9; border-radius: 10px; padding: 5px; }
        button[data-baseweb="tab"] { background-color: transparent; color: var(--primary-color); border-radius: 8px; font-family: 'Lato', sans-serif; font-weight: 700; }
        button[data-baseweb="tab"][aria-selected="true"] { background-color: var(--primary-color); color: white; }
    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---
st.markdown("<div class='app-header'><h1>ECO-Sòl: Simulador d'Edafologia</h1></div>", unsafe_allow_html=True)

col_stats_1, col_stats_2, col_stats_3 = st.columns(3)
with col_stats_1:
    saldo_html = f"""<div class="stat-card"><h2>Capital (ECO$)</h2><p>{st.session_state.saldo_eco:.0f}</p>"""
    if st.session_state.mostrar_cambio and st.session_state.cambio_saldo != 0:
        saldo_html += f'<div class="saldo-change {"positive" if st.session_state.cambio_saldo > 0 else "negative"}">{"+" if st.session_state.cambio_saldo > 0 else ""}{st.session_state.cambio_saldo}</div>'
    saldo_html += "</div>"
    st.markdown(saldo_html, unsafe_allow_html=True)

with col_stats_2:
    st.markdown(f"""<div class="stat-card"><h2>Puntuació</h2><p>{st.session_state.puntuacio_habilitats}</p></div>""", unsafe_allow_html=True)

with col_stats_3:
    total_respostes = st.session_state.get('preguntes_respostes', 0)
    correctes = st.session_state.get('respostes_correctes', 0)
    percentatge_encert = (correctes / total_respostes * 100) if total_respostes > 0 else 0
    st.markdown(f"""<div class="stat-card"><h2>% Encerts</h2><p>{percentatge_encert:.1f}%</p></div>""", unsafe_allow_html=True)

st.write("")

tab1, tab2, tab3 = st.tabs(["🚀 Simulador de Camp", "🎓 Itinerari Formatiu", "📊 Laboratori d'Anàlisi"])

with tab1:
    if st.session_state.pregunta_actual is None:
        if st.button("Començar Avaluació", key="btn_generar_inicial"):
            generar_pregunta()
            st.rerun()
    else:
        pregunta = st.session_state.pregunta_actual
        st.markdown(f"**Nivell de Coneixement:** `{pregunta['dificultat']}`")
        st.markdown(f"#### {pregunta['pregunta']}")
        
        resposta_usuari = st.radio("Selecciona la teva resposta:", pregunta["opcions"], key="radio_respostes", label_visibility="collapsed")
        
        if st.button("Confirmar Resposta", key="btn_enviar_resposta", use_container_width=True):
            verificar_resposta(resposta_usuari)
            st.rerun()

        if st.session_state.missatge_feedback:
            st.markdown(f"<div style='margin-top: 20px; text-align: center; font-size: 1.1em;'>{st.session_state.missatge_feedback}</div>", unsafe_allow_html=True)

with tab2:
    st.subheader("El Teu Itinerari en Edafologia")
    st.markdown('<div class="career-path">', unsafe_allow_html=True)

    for i, examen in enumerate(st.session_state.get('examens', [])):
        status_class = "unlocked" if examen["unlocked"] else "locked"
        can_unlock = st.session_state.examens[i-1]['unlocked'] if i > 0 else True
        
        st.markdown(f'<div class="step {status_class}">', unsafe_allow_html=True)
        st.markdown(f'<span class="step-icon">{examen["icon"]}</span>', unsafe_allow_html=True)
        st.markdown(f"""
            <div class="step-details">
                <p>{examen['nom']}</p>
                <span>{'✅ Completat' if examen['unlocked'] else f"Inversió: {examen['cost']} ECO$"}</span>
            </div>
        """, unsafe_allow_html=True)
        
        if not examen['unlocked'] and can_unlock:
            if st.button(f"Iniciar Formació", key=f"buy_exam_{examen['id']}", disabled=(st.session_state.saldo_eco < examen['cost'])):
                st.session_state.saldo_eco -= examen['cost']
                st.session_state.examens[i]['unlocked'] = True
                st.success(f"Has completat '{examen['nom']}'!")
                time.sleep(1.5)
                st.rerun()
        
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)

with tab3:
    st.subheader("Anàlisi de Rendiment")
    if st.session_state.preguntes_respostes > 0:
        st.markdown("<h5>Estadístiques Generals</h5>", unsafe_allow_html=True)
        # (Codi de les estadístiques)
        
        st.write("")
        st.markdown("<h5>Àrees de Millora</h5>", unsafe_allow_html=True)
        if st.session_state.errors_per_categoria:
            errors_df = pd.DataFrame(list(st.session_state.errors_per_categoria.items()), columns=['Categoria', 'Errors'])
            chart = alt.Chart(errors_df).mark_bar(
                cornerRadius=5,
            ).encode(
                x=alt.X('Errors:Q', title="Nombre d'Errors"),
                y=alt.Y('Categoria:N', title="", sort='-x'),
                tooltip=['Categoria', 'Errors'],
                color=alt.Color('Categoria:N', legend=None, scale=alt.Scale(scheme='greens'))
            )
            st.altair_chart(chart, use_container_width=True)
        else:
            st.success("🎉 De moment, cap error! El teu rendiment és perfecte.")
    else:
        st.info("Comença el simulador per veure les teves estadístiques.")
    
    with st.expander("Recursos Multimèdia del Curs"):
        st.markdown("""
        - **Què és el sòl?**: [Veure vídeo](https://www.youtube.com/watch?v=Qp9M7mMzbbc)
        - **Determinació de la textura**: [Veure vídeo](https://www.youtube.com/watch?v=V4uSq6lH5TM)
        - **Cicle de la matèria orgànica**: [Veure vídeo](https://www.youtube.com/watch?v=YvodHGDvyPw&t=11s)
        - **La roca al sòl**: [Veure animació](http://www.edafologia.net/introeda/tema06/granitos/imagenes/deLaRocaAlSuelo.gif)
        - **Formació del sòl**: [Veure vídeo](https://www.youtube.com/watch?v=PmuPt1pPzWo)
        - **Repàs Edafogènesi**: [Veure vídeo](https://www.youtube.com/watch?v=F1Lyr9iCyBc)
        - **El sòl és un organisme vivent**: [Veure vídeo](https://www.youtube.com/watch?v=gJOiEbdFURE)
        """)

# Lògica de l'animació
if st.session_state.get('mostrar_cambio', False):
    time.sleep(1.5)
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()
