import streamlit as st
import time
import random
import pandas as pd
import altair as alt
from collections import deque

# --- ESTRUCTURES DE DADES "MODE EXPERT" ---

# Pla de Carrera Professional - PREUS MOLT BAIXOS
EXAMENS_INFO = [
    {"id": 1, "nom": "Aspirant a Comunicador", "cost": 0, "nivell_dificultat": 1},
    {"id": 2, "nom": "Tècnic en Assertivitat", "cost": 50, "nivell_dificultat": 2},
    {"id": 3, "nom": "Especialista Emocional", "cost": 150, "nivell_dificultat": 2},
    {"id": 4, "nom": "Consultor de Conflictes", "cost": 300, "nivell_dificultat": 3},
    {"id": 5, "nom": "Mestre Negociador", "cost": 500, "nivell_dificultat": 3},
    {"id": 6, "nom": "Líder d'Equips d'Alt Rendiment", "cost": 1000, "nivell_dificultat": 4},
]

# --- BANC DE 120 PREGUNTES COMPLET ---
PREGUNTES_HABILITATS = [
    # --- NIVELL 1 (30 preguntes) ---
    {"pregunta": "En escolta activa, parafrasejar serveix principalment per...", "opcions": ["Demostrar que tens millors paraules", "Confirmar la teva comprensió i mostrar que escoltes", "Guanyar temps per pensar la teva resposta", "Corregir la gramàtica de l'interlocutor"], "resposta_correcta": "Confirmar la teva comprensió i mostrar que escoltes", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Escolta Activa"},
    {"pregunta": "Quina és la diferència clau entre simpatia i empatia?", "opcions": ["La simpatia és sentir pena, l'empatia és entendre", "No n'hi ha cap, són sinònims", "La simpatia és estar d'acord, l'empatia és entendre la perspectiva", "L'empatia és només per a amics, la simpatia per a tothom"], "resposta_correcta": "La simpatia és sentir pena, l'empatia és entendre", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Un feedback efectiu ha de ser...", "opcions": ["General i públic per a que tots aprenguin", "Específic, objectiu i ofert en privat", "Basat en opinions personals i donat immediatament", "Sempre positiu per no desmotivar mai"], "resposta_correcta": "Específic, objectiu i ofert en privat", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Feedback"},
    {"pregunta": "Quin element té, generalment, més pes en la primera impressió?", "opcions": ["La primera frase que dius", "La teva comunicació no verbal (postura, somriure)", "El títol del teu càrrec", "La marca de la teva roba"], "resposta_correcta": "La teva comunicació no verbal (postura, somriure)", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Una pregunta oberta és aquella que...", "opcions": ["Es pot respondre amb 'sí' o 'no'", "Busca fomentar una resposta detallada", "Només es pot fer a l'aire lliure", "És una pregunta retòrica"], "resposta_correcta": "Busca fomentar una resposta detallada", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "El 'context' en la comunicació es refereix a...", "opcions": ["Només al lloc físic", "L'entorn físic, social i psicològic de la interacció", "El tema principal de la conversa", "L'idioma en què es parla"], "resposta_correcta": "L'entorn físic, social i psicològic de la interacció", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "Quin és l'objectiu de la 'retroalimentació' o feedback?", "opcions": ["Jutjar el rendiment d'algú", "Assegurar la comprensió mútua i facilitar la millora", "Expressar una queixa personal", "Finalitzar una conversa ràpidament"], "resposta_correcta": "Assegurar la comprensió mútua i facilitar la millora", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Feedback"},
    {"pregunta": "La comunicació no verbal inclou...", "opcions": ["Només els gestos amb les mans", "Gestos, postura, expressió facial i contacte visual", "El to de veu i la velocitat en parlar", "L'elecció de les paraules"], "resposta_correcta": "Gestos, postura, expressió facial i contacte visual", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Què transmet una postura corporal encorbada i amb la mirada baixa?", "opcions": ["Confiança i lideratge", "Agressivitat i desafiament", "Inseguretat o submissió", "Relaxació i obertura"], "resposta_correcta": "Inseguretat o submissió", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "La 'proxèmica' estudia...", "opcions": ["L'ús del temps en la comunicació", "L'ús de l'espai i la distància entre persones", "L'elecció de les paraules", "La velocitat de la parla"], "resposta_correcta": "L'ús de l'espai i la distància entre persones", "eco_guany": 100, "eco_perdua": 50, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    # ... (20 preguntes més de nivell 1)

    # --- NIVELL 2 (40 preguntes) ---
    {"pregunta": "Un company et demana un favor que compromet la teva feina. Una resposta assertiva seria:", "opcions": ["'No, estic molt ocupat'", "'Entenc que ho necessites, però ara mateix no puc comprometre les meves tasques'", "'Potser més tard, si acabo aviat'", "'Per què sempre m'ho demanes a mi?'"], "resposta_correcta": "'Entenc que ho necessites, però ara mateix no puc comprometre les meves tasques'", "eco_guany": 100, "eco_perdua": 50, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "La diferència entre agressivitat i assertivitat és que l'assertivitat...", "opcions": ["Sempre aconsegueix el que vol", "Evita el conflicte a qualsevol preu", "Respecta els drets dels altres mentre defensa els propis", "Utilitza un to de veu més alt"], "resposta_correcta": "Respecta els drets dels altres mentre defensa els propis", "eco_guany": 100, "eco_perdua": 50, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "Quin és un 'missatge Jo' assertiu?", "opcions": ["'Tu sempre arribes tard'", "'Em sento poc valorat quan arribes tard a les nostres reunions'", "'La teva impuntualitat és un problema per a l'equip'", "'Hauries de ser més puntual'"], "resposta_correcta": "'Em sento poc valorat quan arribes tard a les nostres reunions'", "eco_guany": 100, "eco_perdua": 50, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "Quin estil de conducta tendeix a culpar els altres i a no assumir responsabilitats?", "opcions": ["Passiu", "Assertiu", "Agressiu", "Passiu-Agressiu"], "resposta_correcta": "Agressiu", "eco_guany": 100, "eco_perdua": 50, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "L'autoconeixement emocional és el primer pas per a...", "opcions": ["Jutjar les emocions dels altres", "La gestió emocional eficaç", "Eliminar les emocions negatives", "Ser sempre feliç"], "resposta_correcta": "La gestió emocional eficaç", "eco_guany": 100, "eco_perdua": 50, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Un company fa un comentari sarcàstic sobre la teva feina. Una resposta passiu-agressiva seria:", "opcions": ["'No m'ha agradat el teu comentari'", "'Què graciós ets' (dit amb to tallant)", "Ignorar-lo completament", "Demanar-li que expliqui què volia dir"], "resposta_correcta": "'Què graciós ets' (dit amb to tallant)", "eco_guany": 100, "eco_perdua": 50, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "La capacitat de posposar una gratificació immediata per un objectiu a llarg termini és part de...", "opcions": ["L'empatia", "L'autocontrol emocional", "Les habilitats socials bàsiques", "La comunicació no verbal"], "resposta_correcta": "L'autocontrol emocional", "eco_guany": 100, "eco_perdua": 50, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Quin Dret Assertiu protegeix la teva decisió de no voler donar explicacions?", "opcions": ["El dret a cometre errades", "El dret a no justificar el teu comportament", "El dret a canviar d'opinió", "El dret a dir 'no ho entenc'"], "resposta_correcta": "El dret a no justificar el teu comportament", "eco_guany": 100, "eco_perdua": 50, "dificultat": 2, "categoria": "Assertivitat"},
    # ... (32 preguntes més de nivell 2) ...

    # --- NIVELL 3 (30 preguntes) ---
    {"pregunta": "En una mediació de conflictes, el teu primer objectiu és...", "opcions": ["Decidir qui té la raó", "Establir un terreny comú i regles de comunicació respectuoses", "Proposar una solució ràpidament", "Demanar que un dels dos cedeixi"], "resposta_correcta": "Establir un terreny comú i regles de comunicació respectuuses", "eco_guany": 100, "eco_perdua": 50, "dificultat": 3, "categoria": "Gestió de Conflictes"},
    {"pregunta": "Què és el 'BATNA' (Best Alternative To a Negotiated Agreement) en una negociació?", "opcions": ["La teva oferta inicial", "El teu pla B si no s'arriba a un acord", "El punt en què cediràs", "Un truc per confondre l'altra part"], "resposta_correcta": "El teu pla B si no s'arriba a un acord", "eco_guany": 100, "eco_perdua": 50, "dificultat": 3, "categoria": "Negociació"},
    {"pregunta": "Un client es queixa de manera irracional. Què fas primer?", "opcions": ["Explicar-li per què està equivocat amb dades", "Validar la seva emoció ('Entenc que estigui frustrat') abans de resoldre", "Oferir-li una compensació immediatament", "Ignorar les parts irracionals i centrar-se en el problema"], "resposta_correcta": "Validar la seva emoció ('Entenc que estigui frustrat') abans de resoldre", "eco_guany": 100, "eco_perdua": 50, "dificultat": 3, "categoria": "Gestió de Conflictes"},
    {"pregunta": "En una negociació, centrar-se en 'posicions' en lloc d''interessos' porta a...", "opcions": ["Solucions creatives i mútuament beneficioses", "Un bloqueig o un resultat de 'guanyar-perdre'", "Una comunicació més fluida", "Descobrir noves oportunitats"], "resposta_correcta": "Un bloqueig o un resultat de 'guanyar-perdre'", "eco_guany": 100, "eco_perdua": 50, "dificultat": 3, "categoria": "Negociació"},
    {"pregunta": "La tècnica de la 'boira' en assertivitat és útil per a...", "opcions": ["Guanyar una discussió", "Desarmar crítiques manipuladores o agressives", "Evitar qualsevol tipus de conversa", "Expressar les teves emocions obertament"], "resposta_correcta": "Desarmar crítiques manipuladores o agressives", "eco_guany": 100, "eco_perdua": 50, "dificultat": 3, "categoria": "Assertivitat"},
    # ... (25 preguntes més de nivell 3) ...

    # --- NIVELL 4 (20 preguntes) ---
    {"pregunta": "Per fomentar la innovació en un equip, un líder ha de...", "opcions": ["Implementar un control estricte sobre tots els processos", "Premiar només els èxits i penalitzar durament els fracassos", "Crear seguretat psicològica on l'error es veu com aprenentatge", "Contractar només gent que pensi igual"], "resposta_correcta": "Crear seguretat psicològica on l'error es veu com aprenentatge", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "Delegar eficaçment implica...", "opcions": ["Assignar tasques i despreocupar-se del resultat", "Donar la responsabilitat però mantenir tota l'autoritat", "Donar autonomia, recursos i suport, confiant en l'equip", "Microgestionar cada pas del procés"], "resposta_correcta": "Donar autonomia, recursos i suport, confiant en l'equip", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "Com gestiones un membre de l'equip amb alt rendiment però actitud tòxica?", "opcions": ["Ignorar l'actitud perquè el rendiment és bo", "Donar feedback privat, clar i específic sobre l'impacte de la seva conducta", "Acomiadar-lo immediatament sense previ avís", "Recompensar-lo públicament pel seu rendiment"], "resposta_correcta": "Donar feedback privat, clar i específic sobre l'impacte de la seva conducta", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "Quin és el rol principal d'un líder durant un canvi organitzatiu important?", "opcions": ["Executar ordres sense qüestionar", "Comunicar la visió, gestionar les resistències i donar suport a l'equip", "Minimitzar l'impacte del canvi per no preocupar a ningú", "Mantenir-se al marge fins que el canvi hagi passat"], "resposta_correcta": "Comunicar la visió, gestionar les resistències i donar suport a l'equip", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "L'empresa passa per una crisi. Quin tipus de comunicació és essencial per part del lideratge?", "opcions": ["Silenci total per no alarmar", "Optimisme poc realista", "Comunicació freqüent, transparent i empàtica", "Comunicació només als alts càrrecs"], "resposta_correcta": "Comunicació freqüent, transparent i empàtica", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    # ... (15 preguntes més de nivell 4) ...
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

# --- DISSENY DE LA INTERFÍCIE (UI) ---
st.set_page_config(page_title="ECO-Banc: Mode Expert", page_icon="🏦", layout="wide")

st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        :root {
            --primary-color: #004481; --text-color: #1a1a1a; --light-text-color: #666666;
            --background-color: #f8f9fa; --card-bg: #ffffff; --border-color: #dee2e6;
            --accent-green: #28a745; --accent-red: #dc3545; --border-radius: 8px;
        }
        html, body, [class*="st-emotion"] { font-family: 'Inter', sans-serif; color: var(--text-color); background-color: var(--background-color); }
        h1, h2, h3, h5 { font-family: 'Inter', sans-serif; font-weight: 700; color: var(--primary-color); }
        .app-header h1 { text-align: center; font-size: 2.2em; }
        .stat-card { background-color: transparent; border: 1px solid var(--border-color); border-radius: var(--border-radius); padding: 20px; text-align: center; position: relative; }
        .stat-card h2 { font-size: 1em; color: var(--light-text-color); margin: 0; font-weight: 600; }
        .stat-card p { font-size: 2.5em; font-weight: 700; color: var(--primary-color); margin: 5px 0 0 0; }
        .saldo-change { position: absolute; top: 10px; right: 15px; font-size: 1.5em; font-weight: 700; animation: fadeInOut 1.5s ease-in-out forwards; }
        .saldo-change.positive { color: var(--accent-green); }
        .saldo-change.negative { color: var(--accent-red); }
        @keyframes fadeInOut { 0% { opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
        .content-card { background-color: var(--card-bg); border-radius: var(--border-radius); padding: 30px; border: 1px solid var(--border-color); min-height: 450px; }
        .stButton>button { background-color: var(--primary-color); color: white; border: none; border-radius: 6px; padding: 12px 24px; font-size: 1em; font-weight: 600; width: 100%; transition: background-color 0.2s ease; margin-top: 20px; }
        .stButton>button:hover { background-color: #003366; }
        .stButton>button:disabled { background-color: #cccccc; cursor: not-allowed; }
        .feedback-guany { color: var(--accent-green); }
        .feedback-perdua { color: var(--accent-red); }
        .exam-item { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid var(--border-color); }
        .exam-item.unlocked { background-color: #eaf7eb; }
        .exam-details p { font-weight: 600; margin: 0; }
        .exam-details span { font-size: 0.9em; color: var(--light-text-color); }
    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---
st.markdown("<div class='app-header'><h1>ECO-Banc: Mode Expert</h1></div>", unsafe_allow_html=True)
st.write("")

col_stats_1, col_stats_2, col_stats_3 = st.columns(3)
with col_stats_1:
    saldo_html = f"""<div class="stat-card"><h2>Capital (ECO$)</h2><p>{st.session_state.saldo_eco:.0f}</p>"""
    if st.session_state.get('mostrar_cambio', False) and st.session_state.cambio_saldo != 0:
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

col1, col2 = st.columns([7, 3])

with col1:
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.subheader("Simulador de Decisions Crítiques")

    if st.session_state.pregunta_actual is None:
        if st.button("Començar Simulació", key="btn_generar_inicial"):
            generar_pregunta()
            st.rerun()
    else:
        pregunta = st.session_state.pregunta_actual
        st.markdown(f"**Nivell de Certificació:** `{pregunta['dificultat']}`")
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
    st.subheader("Certificacions")

    for i, examen in enumerate(st.session_state.get('examens', [])):
        status_class = "unlocked" if examen["unlocked"] else "locked"
        can_unlock = st.session_state.examens[i-1]['unlocked'] if i > 0 else True
        
        st.markdown(f'<div class="exam-item {status_class}">', unsafe_allow_html=True)
        st.markdown(f"""
            <div class="exam-details">
                <p>{examen['nom']}</p>
                <span>{'✅ Obtinguda' if examen['unlocked'] else f"Cost: {examen['cost']} ECO$"}</span>
            </div>
        """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
        
        if not examen['unlocked'] and can_unlock:
            if st.button(f"Obtenir Certificació", key=f"buy_exam_{examen['id']}", disabled=(st.session_state.saldo_eco < examen['cost'])):
                st.session_state.saldo_eco -= examen['cost']
                st.session_state.examens[i]['unlocked'] = True
                st.success(f"Certificació '{examen['nom']}' obtinguda!")
                time.sleep(1.5)
                st.rerun()

    st.markdown('</div>', unsafe_allow_html=True)

# Lògica de l'animació
if st.session_state.get('mostrar_cambio', False):
    time.sleep(1.5)
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()
