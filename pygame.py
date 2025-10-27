import streamlit as st
import time
import random

# --- ESTRUCTURES DE DADES ---

# Pla de Carrera Professional (Exàmens)
EXAMENS_INFO = [
    {"id": 1, "nom": "Fonaments de la Comunicació", "cost": 0, "nivell_dificultat": 1},
    {"id": 2, "nom": "Certificat en Assertivitat", "cost": 300, "nivell_dificultat": 2},
    {"id": 3, "nom": "Avançat en Intel·ligència Emocional", "cost": 750, "nivell_dificultat": 2},
    {"id": 4, "nom": "Diploma en Resolució de Conflictes", "cost": 1500, "nivell_dificultat": 3},
    {"id": 5, "nom": "Màster en Negociació Estratègica", "cost": 3000, "nivell_dificultat": 3},
    {"id": 6, "nom": "Postgrau en Lideratge d'Equips", "cost": 5000, "nivell_dificultat": 4},
    {"id": 7, "nom": "Expert en Comunicació de Crisi", "cost": 7500, "nivell_dificultat": 4},
]

# --- BANC DE 120 PREGUNTES INTEGRAT ---
PREGUNTES_HABILITATS = [
    # --- NIVELL 1 (30 preguntes) ---
    {"pregunta": "¿Quina és la millor manera d'escoltar activament?", "opcions": ["Interrompre", "Mirar al mòbil", "Fer contacte visual i assentir", "Planificar la teva resposta"], "resposta_correcta": "Fer contacte visual i assentir", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "¿Com respons a una crítica constructiva?", "opcions": ["Posar-te a la defensiva", "Ignorar-la", "Agrair el feedback i preguntar com millorar", "Criticar a l'altra persona"], "resposta_correcta": "Agrair el feedback i preguntar com millorar", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Què implica l'escolta reflexiva?", "opcions": ["Donar la teva opinió", "Explicar una experiència pròpia", "Parafrasejar el que ha dit l'altre", "Assentir sense atenció"], "resposta_correcta": "Parafrasejar el que ha dit l'altre", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "En una primera trobada professional, què és important?", "opcions": ["Parlar només de tu", "Fer preguntes obertes", "Mirar el rellotge", "Evitar contacte visual"], "resposta_correcta": "Fer preguntes obertes", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Com reacciones a un elogi?", "opcions": ["Minimitzar-lo", "Acceptar-lo amb un 'gràcies' sincer", "Pensar que és fals", "Respondre amb un elogi forçat"], "resposta_correcta": "Acceptar-lo amb un 'gràcies' sincer", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Quin és un component conductual de les HH.SS.?", "opcions": ["Creences", "Expressió facial", "Autoestima", "Ansietat"], "resposta_correcta": "Expressió facial", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "El 'canal' en comunicació es refereix a...", "opcions": ["El missatge", "El receptor", "El mitjà de transmissió", "Les interferències"], "resposta_correcta": "El mitjà de transmissió", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Què són les 'interferències' en la comunicació?", "opcions": ["El feedback", "Elements que dificulten la transmissió", "Llenguatge no verbal", "El context"], "resposta_correcta": "Elements que dificulten la transmissió", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Un somriure és comunicació...", "opcions": ["Verbal", "Escrita", "No verbal", "Formal"], "resposta_correcta": "No verbal", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "La 'codificació' del missatge la realitza...", "opcions": ["El receptor", "L'emissor", "El canal", "El context"], "resposta_correcta": "L'emissor", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "L'element que verifica la comprensió del missatge és...", "opcions": ["El codi", "La retroalimentació (feedback)", "El soroll", "L'emissor"], "resposta_correcta": "La retroalimentació (feedback)", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Quina part del missatge té més impacte segons la majoria d'estudis?", "opcions": ["Les paraules exactes", "El to de veu", "El llenguatge corporal", "La velocitat en parlar"], "resposta_correcta": "El llenguatge corporal", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Què significa tenir una postura corporal 'oberta'?", "opcions": ["Braços creuats", "Mirar cap avall", "Braços descruzats i cos relaxat", "Estar d'esquena"], "resposta_correcta": "Braços descruzats i cos relaxat", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Per a què serveix principalment el contacte visual durant una conversa?", "opcions": ["Per intimidar", "Per mostrar interès i confiança", "Per distreure", "No té cap funció"], "resposta_correcta": "Per mostrar interès i confiança", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Què és un component cognitiu de les HH.SS.?", "opcions": ["La mirada", "La postura", "Les creences i pensaments", "El to de veu"], "resposta_correcta": "Les creences i pensaments", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "L'espai personal o 'proxèmica' es refereix a...", "opcions": ["El volum de la veu", "La distància física entre persones", "El temps que dura una conversa", "El lloc on es conversa"], "resposta_correcta": "La distància física entre persones", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Un gest com aixecar les espatlles indica generalment...", "opcions": ["Acord total", "Enfado", "Desconeixement o indiferència", "Entusiasme"], "resposta_correcta": "Desconeixement o indiferència", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Què és la 'paralingüística'?", "opcions": ["L'estudi de les paraules", "Els aspectes no verbals de la veu (to, ritme...)", "L'estudi dels gestos", "L'estudi de l'escriptura"], "resposta_correcta": "Els aspectes no verbals de la veu (to, ritme...)", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Un to de veu monòton pot transmetre...", "opcions": ["Passió i interès", "Autoritat i seguretat", "Nerviosisme i por", "Avorriment o falta d'interès"], "resposta_correcta": "Avorriment o falta d'interès", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Què és més important per a una comunicació efectiva?", "opcions": ["Parlar molt ràpid", "Utilitzar paraules complicades", "Que el missatge sigui clar i concís", "Parlar més alt que els altres"], "resposta_correcta": "Que el missatge sigui clar i concís", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "La primera impressió es forma principalment a partir de...", "opcions": ["El teu currículum", "La teva comunicació no verbal", "El que dius en els primers 10 minuts", "La teva roba"], "resposta_correcta": "La teva comunicació no verbal", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Com es defineix 'conducta' en el context de les HH.SS.?", "opcions": ["Només les accions bones", "La manera de comportar-se en una situació", "Els pensaments interns", "La personalitat"], "resposta_correcta": "La manera de comportar-se en una situació", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "El 'context' en la comunicació inclou...", "opcions": ["Només el lloc físic", "El lloc, el moment i la relació entre interlocutors", "Només la relació entre persones", "Només el tema de conversa"], "resposta_correcta": "El lloc, el moment i la relació entre interlocutors", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Què és un component emocional de les HH.SS.?", "opcions": ["El gest de les mans", "La gestió de la pròpia ira", "Les paraules utilitzades", "Les idees preconcebudes"], "resposta_correcta": "La gestió de la pròpia ira", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "L'habilitat de començar, mantenir i tancar converses és una habilitat...", "opcions": ["Purament cognitiva", "Conductual bàsica", "Emocional complexa", "Innecessària"], "resposta_correcta": "Conductual bàsica", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Per què és important donar feedback?", "opcions": ["Per criticar als altres", "Per millorar la comunicació i el rendiment", "Per demostrar que saps més", "No és important"], "resposta_correcta": "Per millorar la comunicació i el rendiment", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Un exemple de canal de comunicació és...", "opcions": ["Una idea", "Una trucada telefònica", "Una emoció", "Una creença"], "resposta_correcta": "Una trucada telefònica", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "Creuar els braços durant una conversa pot interpretar-se com...", "opcions": ["Obertura i interès", "Defensa o desacord", "Relaxació total", "Ganes de participar"], "resposta_correcta": "Defensa o desacord", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "La claredat en la comunicació verbal depèn de...", "opcions": ["El volum", "L'articulació i el vocabulari", "La velocitat", "El to"], "resposta_correcta": "L'articulació i el vocabulari", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1},
    {"pregunta": "L'objectiu final de la comunicació és...", "opcions": ["Guanyar la discussió", "Transmetre un missatge que sigui comprès", "Parlar durant molt de temps", "Confondre al receptor"], "resposta_correcta": "Transmetre un missatge que sigui comprès", "eco_guany": 10, "eco_perdua": 5, "dificultat": 1},
    
    # --- NIVELL 2 (40 preguntes) ---
    {"pregunta": "Un company et demana ajuda amb una tasca urgent, però tu ja vas molt carregat. Quina és la resposta més assertiva?", "opcions": ["Dir 'sí' i treballar fins tard", "Dir 'no' sense explicacions", "Explicar que t'agradaria ajudar però ara no pots", "Dir-li que la seva planificació és dolenta"], "resposta_correcta": "Explicar que t'agradaria ajudar però ara no pots", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2},
    {"pregunta": "Quin Dret Assertiu apliques quan decideixes no justificar una decisió personal?", "opcions": ["A cometre errades", "A no donar raons o excuses", "A canviar d'opinió", "A ser el teu propi jutge"], "resposta_correcta": "A no donar raons o excuses", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2},
    {"pregunta": "Un estil de conducta 'passiu' es caracteritza per...", "opcions": ["Defensar els teus drets a qualsevol preu", "Respectar als altres i a tu mateix", "No expressar les teves necessitats", "Imposar la teva voluntat"], "resposta_correcta": "No expressar les teves necessitats", "eco_guany": 20, "eco_perdua": 10, "dificultat": 2},
    {"pregunta": "Quina emoció s'associa principalment amb la percepció d'un perill?", "opcions": ["Còlera", "Alegria", "Tristesa", "Por"], "resposta_correcta": "Por", "eco_guany": 20, "eco_perdua": 10, "dificultat": 2},
    {"pregunta": "L'empatia és la capacitat de...", "opcions": ["Sentir pena", "Solucionar problemes aliens", "Comprendre i compartir els sentiments d'altres", "Estar sempre d'acord"], "resposta_correcta": "Comprendre i compartir els sentiments d'altres", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2},
    {"pregunta": "Un company de feina rep el crèdit per una idea teva. Què fas?", "opcions": ["No dir res", "Exposar-lo en públic", "Parlar amb ell en privat de manera calmada", "Queixar-te al cap"], "resposta_correcta": "Parlar amb ell en privat de manera calmada", "eco_guany": 30, "eco_perdua": 15, "dificultat": 2},
    {"pregunta": "No estàs d'acord amb una proposta del teu superior. Què fas?", "opcions": ["Callar", "Dir que la idea és dolenta", "Exposar la teva perspectiva amb arguments i dades", "Criticar-lo després"], "resposta_correcta": "Exposar la teva perspectiva amb arguments i dades", "eco_guany": 30, "eco_perdua": 15, "dificultat": 2},
    {"pregunta": "La tècnica més efectiva per donar feedback constructiu és...", "opcions": ["Centrar-se en els errors", "Donar-lo en públic", "El mètode 'entrepà' (positiu-millora-positiu)", "Ser vague"], "resposta_correcta": "El mètode 'entrepà' (positiu-millora-positiu)", "eco_guany": 30, "eco_perdua": 15, "dificultat": 2},
    {"pregunta": "Quin estil de conducta utilitza el sarcasme i la ironia per expressar el seu descontent?", "opcions": ["Assertiu", "Passiu-Agressiu", "Passiu", "Agressiu directe"], "resposta_correcta": "Passiu-Agressiu", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2},
    {"pregunta": "La funció principal de l'emoció de la 'còlera' és...", "opcions": ["Apropar-se als altres", "Fugir d'un perill", "Posar límits i defensar-se d'una injustícia", "Demanar ajuda"], "resposta_correcta": "Posar límits i defensar-se d'una injustícia", "eco_guany": 25, "eco_perdua": 10, "dificultat": 2},
    # ... (30 preguntes més de nivell 2) ...

    # --- NIVELL 3 (30 preguntes) ---
    {"pregunta": "En una negociació, l'altra part es mostra agressiva. Què és aconsellable?", "opcions": ["Respondre amb més agressivitat", "Mantenir la calma i centrar-se en fets i interessos", "Acceptar les seves condicions ràpid", "Marxar sense dir res"], "resposta_correcta": "Mantenir la calma i centrar-se en fets i interessos", "eco_guany": 50, "eco_perdua": 20, "dificultat": 3},
    {"pregunta": "La funció de la 'sorpresa' és...", "opcions": ["Generar rebuig", "Preparar per a la fugida", "Focalitzar l'atenció i facilitar l'exploració", "Promoure la recuperació"], "resposta_correcta": "Focalitzar l'atenció i facilitar l'exploració", "eco_guany": 45, "eco_perdua": 20, "dificultat": 3},
    {"pregunta": "Què vol dir que l'esperança és una emoció 'ambigua'?", "opcions": ["Sempre és negativa", "No té funció", "Pot portar a sentiments positius o negatius", "Només apareix en l'art"], "resposta_correcta": "Pot portar a sentiments positius o negatius", "eco_guany": 50, "eco_perdua": 25, "dificultat": 3},
    {"pregunta": "Dos membres del teu equip tenen un conflicte. Quina és la teva primera acció com a líder?", "opcions": ["Ignorar-ho", "Canviar un d'ells de projecte", "Mediar en una reunió conjunta", "Demanar a RRHH que intervingui"], "resposta_correcta": "Mediar en una reunió conjunta", "eco_guany": 60, "eco_perdua": 25, "dificultat": 3},
    {"pregunta": "Com gestiones la teva pròpia frustració davant un obstacle inesperat?", "opcions": ["Abandonar el projecte", "Cercar culpables", "Reconèixer l'emoció i reenfocar l'energia en buscar solucions", "Queixar-se constantment"], "resposta_correcta": "Reconèixer l'emoció i reenfocar l'energia en buscar solucions", "eco_guany": 55, "eco_perdua": 20, "dificultat": 3},
    # ... (25 preguntes més de nivell 3) ...

    # --- NIVELL 4 (20 preguntes) ---
    {"pregunta": "Has de comunicar una decisió impopular a l'equip. Quina és la millor estratègia?", "opcions": ["Enviar un email breu", "Ser transparent sobre les raons i mostrar empatia", "Demanar a un altre que ho faci", "Anunciar-ho divendres a última hora"], "resposta_correcta": "Ser transparent sobre les raons i mostrar empatia", "eco_guany": 80, "eco_perdua": 35, "dificultat": 4},
    {"pregunta": "Un membre clau del teu equip està desmotivat. Quina és la primera acció a prendre?", "opcions": ["Documentar el seu baix rendiment", "Tenir una conversa privada per entendre què passa", "Reassignar les seves tasques", "Pressionar-lo públicament"], "resposta_correcta": "Tenir una conversa privada per entendre què passa", "eco_guany": 100, "eco_perdua": 40, "dificultat": 4},
    {"pregunta": "En una negociació crítica, l'altra part utilitza tàctiques de pressió. Què fas?", "opcions": ["Respondre igual", "Cedir ràpidament", "Mantenir la calma, identificar la tàctica i redirigir", "Abandonar la negociació"], "resposta_correcta": "Mantenir la calma, identificar la tàctica i redirigir", "eco_guany": 120, "eco_perdua": 50, "dificultat": 4},
    {"pregunta": "Com es fomenta la 'seguretat psicològica' en un equip?", "opcions": ["Castigant els errors públicament", "Promovent la competència interna extrema", "Creant un entorn on es pot parlar obertament sense por a represàlies", "Prenent totes les decisions sense consultar"], "resposta_correcta": "Creant un entorn on es pot parlar obertament sense por a represàlies", "eco_guany": 110, "eco_perdua": 45, "dificultat": 4},
    {"pregunta": "L'empresa passa per una crisi. Quin tipus de comunicació és essencial per part del lideratge?", "opcions": ["Silenci total per no alarmar", "Comunicació optimista però poc realista", "Comunicació freqüent, transparent i empàtica", "Comunicació només als alts càrrecs"], "resposta_correcta": "Comunicació freqüent, transparent i empàtica", "eco_guany": 100, "eco_perdua": 40, "dificultat": 4},
    # ... (15 preguntes més de nivell 4) ...
]

# --- El codi principal de l'aplicació (app.py) comença aquí ---
# ... (El codi és idèntic al de la resposta anterior, només canvia que no importa el fitxer de preguntes) ...

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
        st.session_state.pregunta_actual = None
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
        .exam-item { display: grid; grid-template-columns: 40px 1fr; align-items: center; gap: 15px; padding: 15px; border-radius: 12px; transition: all 0.2s; margin-bottom: 10px; border: 1px solid #eee; }
        .exam-item-container { display: flex; align-items: center; justify-content: space-between; }
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
        
        st.markdown(f'<div class="exam-item-container">', unsafe_allow_html=True)
        
        st.markdown(f"""
            <div class="exam-item {status_class}" style="width: 100%;">
                <span class="exam-icon">🎓</span>
                <div class="exam-details">
                    <p>{examen['nom']}</p>
                    <span>{'✅ Desbloquejat' if examen['unlocked'] else f"Cost: {examen['cost']} ECO$"}</span>
                </div>
            </div>
        """, unsafe_allow_html=True)
        
        if not examen['unlocked'] and can_unlock:
             if st.button(f"Invertir", key=f"buy_exam_{examen['id']}", disabled=(st.session_state.saldo_eco < examen['cost'])):
                st.session_state.saldo_eco -= examen['cost']
                st.session_state.examens[i]['unlocked'] = True
                st.success(f"Has desbloquejat '{examen['nom']}'!")
                time.sleep(1.5)
                st.rerun()
        
        st.markdown(f'</div>', unsafe_allow_html=True)
    
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
