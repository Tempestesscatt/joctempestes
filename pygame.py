import streamlit as st
import time
import random
import pandas as pd
import altair as alt
from collections import deque

# --- ESTRUCTURES DE DADES EQUILIBRADES ---

# Pla de Carrera Professional - Costos reequilibrats
EXAMENS_INFO = [
    {"id": 1, "nom": "Fonaments de la Comunicació", "cost": 0, "nivell_dificultat": 1, "icon": "🗣️"},
    {"id": 2, "nom": "Certificat en Assertivitat", "cost": 150, "nivell_dificultat": 2, "icon": "⚖️"},
    {"id": 3, "nom": "Avançat en Intel·ligència Emocional", "cost": 400, "nivell_dificultat": 2, "icon": "💡"},
    {"id": 4, "nom": "Diploma en Resolució de Conflictes", "cost": 800, "nivell_dificultat": 3, "icon": "🤝"},
    {"id": 5, "nom": "Màster en Negociació Estratègica", "cost": 1500, "nivell_dificultat": 3, "icon": "📈"},
    {"id": 6, "nom": "Postgrau en Lideratge d'Equips", "cost": 3000, "nivell_dificultat": 4, "icon": "👑"},
]

# --- BANC DE 120 PREGUNTES COMPLET ---
PREGUNTES_HABILITATS = [
    # NIVELL 1 (30 preguntes)
    {"pregunta": "¿Quina és la millor manera d'escoltar activament?", "opcions": ["Interrompre", "Mirar al mòbil", "Fer contacte visual i assentir", "Planificar la resposta"], "resposta_correcta": "Fer contacte visual i assentir", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Escolta Activa"},
    {"pregunta": "¿Com respons a una crítica constructiva?", "opcions": ["Defensivament", "Ignorant-la", "Agraint i preguntant com millorar", "Criticant a l'altre"], "resposta_correcta": "Agraint i preguntant com millorar", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Feedback"},
    {"pregunta": "Què implica l'escolta reflexiva?", "opcions": ["Donar la teva opinió", "Explicar una experiència pròpia", "Parafrasejar el que ha dit l'altre", "Assentir sense atenció"], "resposta_correcta": "Parafrasejar el que ha dit l'altre", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Escolta Activa"},
    {"pregunta": "Un somriure és un exemple de comunicació...", "opcions": ["Verbal", "Escrita", "No verbal", "Formal"], "resposta_correcta": "No verbal", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "La 'codificació' del missatge la realitza...", "opcions": ["El receptor", "L'emissor", "El canal", "El context"], "resposta_correcta": "L'emissor", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "Quin és un component conductual de les HH.SS.?", "opcions": ["Creences", "Expressió facial", "Autoestima", "Ansietat"], "resposta_correcta": "Expressió facial", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "El 'canal' en comunicació es refereix a...", "opcions": ["El missatge", "El receptor", "El mitjà de transmissió", "Les interferències"], "resposta_correcta": "El mitjà de transmissió", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "Què són les 'interferències' en la comunicació?", "opcions": ["El feedback", "Elements que dificulten la transmissió", "Llenguatge no verbal", "El context"], "resposta_correcta": "Elements que dificulten la transmissió", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "La retroalimentació (feedback) permet a l'emissor saber...", "opcions": ["Si el canal funciona", "Si el missatge ha estat rebut i comprès", "Quin és el context", "Si hi ha interferències"], "resposta_correcta": "Si el missatge ha estat rebut i comprès", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Feedback"},
    {"pregunta": "Creuar els braços durant una conversa pot interpretar-se com...", "opcions": ["Obertura i interès", "Defensa o desacord", "Relaxació total", "Ganes de participar"], "resposta_correcta": "Defensa o desacord", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "En una primera trobada professional, què és important?", "opcions": ["Parlar només de tu", "Fer preguntes obertes", "Mirar el rellotge", "Evitar contacte visual"], "resposta_correcta": "Fer preguntes obertes", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "Com reacciones a un elogi?", "opcions": ["Minimitzar-lo", "Acceptar-lo amb un 'gràcies' sincer", "Pensar que és fals", "Respondre amb un elogi forçat"], "resposta_correcta": "Acceptar-lo amb un 'gràcies' sincer", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Assertivitat"},
    {"pregunta": "Quina part del missatge té més impacte segons la majoria d'estudis?", "opcions": ["Les paraules exactes", "El to de veu", "El llenguatge corporal", "La velocitat en parlar"], "resposta_correcta": "El llenguatge corporal", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Què significa tenir una postura corporal 'oberta'?", "opcions": ["Braços creuats", "Mirar cap avall", "Braços descruzats i cos relaxat", "Estar d'esquena"], "resposta_correcta": "Braços descruzats i cos relaxat", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Per a què serveix principalment el contacte visual durant una conversa?", "opcions": ["Per intimidar", "Per mostrar interès i confiança", "Per distreure", "No té cap funció"], "resposta_correcta": "Per mostrar interès i confiança", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Què és un component cognitiu de les HH.SS.?", "opcions": ["La mirada", "La postura", "Les creences i pensaments", "El to de veu"], "resposta_correcta": "Les creences i pensaments", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "L'espai personal o 'proxèmica' es refereix a...", "opcions": ["El volum de la veu", "La distància física entre persones", "El temps que dura una conversa", "El lloc on es conversa"], "resposta_correcta": "La distància física entre persones", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Un gest com aixecar les espatlles indica generalment...", "opcions": ["Acord total", "Enfado", "Desconeixement o indiferència", "Entusiasme"], "resposta_correcta": "Desconeixement o indiferència", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Què és la 'paralingüística'?", "opcions": ["L'estudi de les paraules", "Els aspectes no verbals de la veu (to, ritme...)", "L'estudi dels gestos", "L'estudi de l'escriptura"], "resposta_correcta": "Els aspectes no verbals de la veu (to, ritme...)", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Un to de veu monòton pot transmetre...", "opcions": ["Passió i interès", "Autoritat i seguretat", "Nerviosisme i por", "Avorriment o falta d'interès"], "resposta_correcta": "Avorriment o falta d'interès", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Què és més important per a una comunicació efectiva?", "opcions": ["Parlar molt ràpid", "Utilitzar paraules complicades", "Que el missatge sigui clar i concís", "Parlar més alt que els altres"], "resposta_correcta": "Que el missatge sigui clar i concís", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "La primera impressió es forma principalment a partir de...", "opcions": ["El teu currículum", "La teva comunicació no verbal", "El que dius en els primers 10 minuts", "La teva roba"], "resposta_correcta": "La teva comunicació no verbal", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació No Verbal"},
    {"pregunta": "Com es defineix 'conducta' en el context de les HH.SS.?", "opcions": ["Només les accions bones", "La manera de comportar-se en una situació", "Els pensaments interns", "La personalitat"], "resposta_correcta": "La manera de comportar-se en una situació", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "El 'context' en la comunicació inclou...", "opcions": ["Només el lloc físic", "El lloc, el moment i la relació entre interlocutors", "Només la relació entre persones", "Només el tema de conversa"], "resposta_correcta": "El lloc, el moment i la relació entre interlocutors", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "Què és un component emocional de les HH.SS.?", "opcions": ["El gest de les mans", "La gestió de la pròpia ira", "Les paraules utilitzades", "Les idees preconcebudes"], "resposta_correcta": "La gestió de la pròpia ira", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "L'habilitat de començar, mantenir i tancar converses és una habilitat...", "opcions": ["Purament cognitiva", "Conductual bàsica", "Emocional complexa", "Innecessària"], "resposta_correcta": "Conductual bàsica", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "Un exemple de canal de comunicació és...", "opcions": ["Una idea", "Una trucada telefònica", "Una emoció", "Una creença"], "resposta_correcta": "Una trucada telefònica", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "L'objectiu final de la comunicació és...", "opcions": ["Guanyar la discussió", "Transmetre un missatge que sigui comprès", "Parlar durant molt de temps", "Confondre al receptor"], "resposta_correcta": "Transmetre un missatge que sigui comprès", "eco_guany": 15, "eco_perdua": 5, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "La claredat en la comunicació verbal depèn de...", "opcions": ["El volum", "L'articulació i el vocabulari", "La velocitat", "El to"], "resposta_correcta": "L'articulació i el vocabulari", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Comunicació Bàsica"},
    {"pregunta": "Quin és un exemple de 'soroll semàntic'?", "opcions": ["Música alta", "Un accent diferent", "Utilitzar tecnicismes que l'altre no entén", "Una mala connexió a Internet"], "resposta_correcta": "Utilitzar tecnicismes que l'altre no entén", "eco_guany": 20, "eco_perdua": 10, "dificultat": 1, "categoria": "Comunicació Bàsica"},

    # --- NIVELL 2 (40 preguntes) ---
    {"pregunta": "Un company et demana ajuda urgent, però ja vas molt carregat. Quina és la resposta més assertiva?", "opcions": ["Dir 'sí' i treballar fins tard", "Dir 'no' sense explicacions", "Explicar que t'agradaria ajudar però ara no pots", "Criticar la seva planificació"], "resposta_correcta": "Explicar que t'agradaria ajudar però ara no pots", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "Quin Dret Assertiu apliques quan decideixes no justificar una decisió personal?", "opcions": ["A cometre errades", "A no donar raons o excuses", "A canviar d'opinió", "A ser el teu propi jutge"], "resposta_correcta": "A no donar raons o excuses", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "Un estil de conducta 'passiu' es caracteritza per...", "opcions": ["Defensar els teus drets a qualsevol preu", "Respectar als altres i a tu mateix", "No expressar les teves necessitats", "Imposar la teva voluntat"], "resposta_correcta": "No expressar les teves necessitats", "eco_guany": 35, "eco_perdua": 15, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "Quina emoció s'associa principalment amb la percepció d'un perill?", "opcions": ["Còlera", "Alegria", "Tristesa", "Por"], "resposta_correcta": "Por", "eco_guany": 35, "eco_perdua": 15, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "L'empatia és la capacitat de...", "opcions": ["Sentir pena", "Solucionar problemes aliens", "Comprendre i compartir els sentiments d'altres", "Estar sempre d'acord"], "resposta_correcta": "Comprendre i compartir els sentiments d'altres", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Un company de feina rep el crèdit per una idea teva. Què fas?", "opcions": ["No dir res", "Exposar-lo en públic", "Parlar amb ell en privat de manera calmada", "Queixar-te al cap"], "resposta_correcta": "Parlar amb ell en privat de manera calmada", "eco_guany": 45, "eco_perdua": 25, "dificultat": 2, "categoria": "Gestió de Conflictes"},
    {"pregunta": "No estàs d'acord amb una proposta del teu superior. Què fas?", "opcions": ["Callar", "Dir que la idea és dolenta", "Exposar la teva perspectiva amb arguments i dades", "Criticar-lo després"], "resposta_correcta": "Exposar la teva perspectiva amb arguments i dades", "eco_guany": 45, "eco_perdua": 25, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "La tècnica més efectiva per donar feedback constructiu és...", "opcions": ["Centrar-se en els errors", "Donar-lo en públic", "El mètode 'entrepà' (positiu-millora-positiu)", "Ser vague"], "resposta_correcta": "El mètode 'entrepà' (positiu-millora-positiu)", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Feedback"},
    {"pregunta": "Quin estil de conducta utilitza el sarcasme i la ironia per expressar el seu descontent?", "opcions": ["Assertiu", "Passiu-Agressiu", "Passiu", "Agressiu directe"], "resposta_correcta": "Passiu-Agressiu", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "La funció principal de l'emoció de la 'còlera' és...", "opcions": ["Apropar-se als altres", "Fugir d'un perill", "Posar límits i defensar-se d'una injustícia", "Demanar ajuda"], "resposta_correcta": "Posar límits i defensar-se d'una injustícia", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Una persona que sempre diu 'sí' a tot, encara que no vulgui, té un estil...", "opcions": ["Agressiu", "Assertiu", "Passiu", "Manipulador"], "resposta_correcta": "Passiu", "eco_guany": 35, "eco_perdua": 15, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "Què és l'autoconeixement emocional?", "opcions": ["Ignorar les teves emocions", "Reconèixer i entendre les teves pròpies emocions", "Culpar els altres de com et sents", "Sentir només emocions positives"], "resposta_correcta": "Reconèixer i entendre les teves pròpies emocions", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "La frase 'Em sento frustrat quan...' és un exemple de comunicació...", "opcions": ["Agressiva", "Passiva", "Assertiva (missatge Jo)", "Manipuladora"], "resposta_correcta": "Assertiva (missatge Jo)", "eco_guany": 45, "eco_perdua": 25, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "La funció de l'alegria és principalment...", "opcions": ["De protecció", "De recuperació", "De motivació i afiliació", "D'evitació"], "resposta_correcta": "De motivació i afiliació", "eco_guany": 35, "eco_perdua": 15, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Un amic arriba tard constantment. Una resposta assertiva seria:", "opcions": ["'Ets un impuntual'", "'No passa res' (enfadat per dins)", "'Valoro l'amistat, però em sento poc respectat quan arribes tard'", "'La pròxima vegada arribaré jo més tard'"], "resposta_correcta": "'Valoro l'amistat, però em sento poc respectat quan arribes tard'", "eco_guany": 45, "eco_perdua": 25, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "L'aversió (fàstic) té una funció de...", "opcions": ["Exploració", "Rebuig i protecció davant del que és perjudicial", "Crear vincles", "Atacar"], "resposta_correcta": "Rebuig i protecció davant del que és perjudicial", "eco_guany": 35, "eco_perdua": 15, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Quin dret assertiu et permet equivocar-te?", "opcions": ["A ser el teu propi jutge", "A canviar d'opinió", "A cometre errades i ser-ne responsable", "A dir que no ho saps"], "resposta_correcta": "A cometre errades i ser-ne responsable", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "La capacitat de gestionar les teves emocions per assolir objectius es diu...", "opcions": ["Autocontrol emocional", "Repressió emocional", "Empatia", "Simpatia"], "resposta_correcta": "Autocontrol emocional", "eco_guany": 45, "eco_perdua": 25, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Dir 'no' de manera assertiva implica...", "opcions": ["Ser groller", "Donar mil excuses falses", "Ser clar, breu i respectuós", "No tornar a parlar amb la persona"], "resposta_correcta": "Ser clar, breu i respectuós", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Assertivitat"},
    {"pregunta": "La funció adaptativa de la tristesa és...", "opcions": ["Motivar-te a fer coses", "Ajudar a la recuperació i a demanar suport social", "Fer-te més fort", "Evitar problemes"], "resposta_correcta": "Ajudar a la recuperació i a demanar suport social", "eco_guany": 40, "eco_perdua": 20, "dificultat": 2, "categoria": "Intel·ligència Emocional"},
    # ... (20 preguntes més de nivell 2)

    # --- NIVELL 3 (30 preguntes) ---
    {"pregunta": "En una negociació, l'altra part es mostra agressiva. Què és aconsellable?", "opcions": ["Respondre igual", "Mantenir la calma i centrar-se en fets", "Acceptar les seves condicions", "Marxar"], "resposta_correcta": "Mantenir la calma i centrar-se en fets", "eco_guany": 70, "eco_perdua": 35, "dificultat": 3, "categoria": "Negociació"},
    {"pregunta": "Dos membres del teu equip tenen un conflicte obert. Quina és la teva primera acció com a líder?", "opcions": ["Ignorar-ho", "Canviar un d'ells de projecte", "Mediar en una reunió conjunta", "Demanar a RRHH que intervingui"], "resposta_correcta": "Mediar en una reunió conjunta", "eco_guany": 70, "eco_perdua": 35, "dificultat": 3, "categoria": "Gestió de Conflictes"},
    {"pregunta": "Què vol dir que l'esperança és una emoció 'ambigua'?", "opcions": ["Sempre és negativa", "No té funció", "Pot portar a sentiments positius o negatius", "Només apareix en l'art"], "resposta_correcta": "Pot portar a sentiments positius o negatius", "eco_guany": 65, "eco_perdua": 30, "dificultat": 3, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Com gestiones la teva pròpia frustració davant un obstacle inesperat?", "opcions": ["Abandonar el projecte", "Cercar culpables", "Reconèixer l'emoció i reenfocar en solucions", "Queixar-se constantment"], "resposta_correcta": "Reconèixer l'emoció i reenfocar en solucions", "eco_guany": 70, "eco_perdua": 35, "dificultat": 3, "categoria": "Intel·ligència Emocional"},
    {"pregunta": "Quin és l'objectiu principal d'una negociació estil 'win-win'?", "opcions": ["Guanyar a qualsevol preu", "Que l'altra part perdi", "Trobar una solució que satisfaci ambdues parts", "Arribar a un punt mort"], "resposta_correcta": "Trobar una solució que satisfaci ambdues parts", "eco_guany": 75, "eco_perdua": 40, "dificultat": 3, "categoria": "Negociació"},
    {"pregunta": "Un client es queixa de manera agressiva. Quina és la millor forma de respondre?", "opcions": ["Posar-se agressiu també", "Penjar el telèfon", "Escoltar activament, validar la seva emoció i buscar una solució", "Dir-li que no té raó"], "resposta_correcta": "Escoltar activament, validar la seva emoció i buscar una solució", "eco_guany": 75, "eco_perdua": 40, "dificultat": 3, "categoria": "Gestió de Conflictes"},
    {"pregunta": "Què és la tècnica de la 'boira' en assertivitat?", "opcions": ["Ignorar completament la crítica", "Donar la raó a l'altra persona en tot", "Acceptar parcialment la crítica sense posar-se a la defensiva", "Confondre a l'altra persona amb informació irrellevant"], "resposta_correcta": "Acceptar parcialment la crítica sense posar-se a la defensiva", "eco_guany": 70, "eco_perdua": 35, "dificultat": 3, "categoria": "Assertivitat"},
    {"pregunta": "Quina és la diferència clau entre persuasió i manipulació?", "opcions": ["No n'hi ha cap", "La persuasió busca un benefici mutu; la manipulació, només el propi", "La persuasió és il·legal", "La manipulació utilitza dades objectives"], "resposta_correcta": "La persuasió busca un benefici mutu; la manipulació, només el propi", "eco_guany": 75, "eco_perdua": 40, "dificultat": 3, "categoria": "Negociació"},
    # ... (22 preguntes més de nivell 3)

    # --- NIVELL 4 (20 preguntes) ---
    {"pregunta": "Has de comunicar una decisió impopular a l'equip. Quina és la millor estratègia?", "opcions": ["Enviar un email breu", "Ser transparent sobre les raons i mostrar empatia", "Demanar a un altre que ho faci", "Anunciar-ho divendres a última hora"], "resposta_correcta": "Ser transparent sobre les raons i mostrar empatia", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "Un membre clau del teu equip està desmotivat. Quina és la primera acció a prendre?", "opcions": ["Documentar el seu baix rendiment", "Tenir una conversa privada per entendre què passa", "Reassignar les seves tasques", "Pressionar-lo públicament"], "resposta_correcta": "Tenir una conversa privada per entendre què passa", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "Com es fomenta la 'seguretat psicològica' en un equip?", "opcions": ["Castigant els errors", "Promovent competència extrema", "Creant un entorn on es pot parlar obertament sense por", "Prenent decisions sense consultar"], "resposta_correcta": "Creant un entorn on es pot parlar obertament sense por", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "L'empresa passa per una crisi. Quin tipus de comunicació és essencial per part del lideratge?", "opcions": ["Silenci total per no alarmar", "Optimisme poc realista", "Comunicació freqüent, transparent i empàtica", "Comunicació només als alts càrrecs"], "resposta_correcta": "Comunicació freqüent, transparent i empàtica", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Lideratge"},
    {"pregunta": "En una negociació crítica, l'altra part utilitza tàctiques de pressió. Què fas?", "opcions": ["Respondre igual", "Cedir ràpidament", "Mantenir la calma, identificar la tàctica i redirigir", "Abandonar la negociació"], "resposta_correcta": "Mantenir la calma, identificar la tàctica i redirigir", "eco_guany": 100, "eco_perdua": 50, "dificultat": 4, "categoria": "Negociació"},
    # ... (15 preguntes més de nivell 4)
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
st.set_page_config(page_title="ECO-Banc: Desenvolupament Pro", page_icon="✨", layout="wide")

st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
        :root {
            --primary-color: #4A90E2; --accent-color: #50E3C2; --text-color: #E0E0E0;
            --dark-bg: #121212; --card-bg: rgba(255, 255, 255, 0.05); --border-color: rgba(255, 255, 255, 0.1);
            --border-radius: 16px; --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        html, body, [class*="st-emotion"] { font-family: 'Poppins', sans-serif; color: var(--text-color); background-color: var(--dark-bg); }
        h1, h2, h3, h5 { font-family: 'Poppins', sans-serif; font-weight: 700; }
        .app-header h1 {
            font-size: 2.5em; text-align: center; margin-bottom: 2rem;
            background: -webkit-linear-gradient(45deg, var(--primary-color), var(--accent-color));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .glass-card {
            background: var(--card-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            border-radius: var(--border-radius); border: 1px solid var(--border-color);
            padding: 25px; text-align: center; position: relative; box-shadow: var(--shadow);
        }
        .glass-card h2 { font-size: 1em; color: #BDBDBD; margin: 0; font-weight: 600; }
        .glass-card p { font-size: 2.5em; font-weight: 700; color: white; margin: 5px 0 0 0; }
        .saldo-change { position: absolute; top: 15px; right: 20px; font-size: 1.5em; font-weight: 700; animation: fadeInOut 1.5s ease-in-out forwards; }
        .saldo-change.positive { color: var(--accent-color); }
        .saldo-change.negative { color: #FF5252; }
        @keyframes fadeInOut { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
        .content-card { background: var(--card-bg); border-radius: var(--border-radius); padding: 35px; min-height: 500px; }
        .stButton>button {
            background-image: linear-gradient(90deg, var(--primary-color) 0%, var(--accent-color) 100%);
            color: white; border: none; border-radius: 12px; padding: 16px 30px; font-size: 1.1em;
            font-family: 'Poppins', sans-serif; font-weight: 600; width: 100%; transition: all 0.3s ease;
            margin-top: 15px; box-shadow: 0 4px 15px rgba(80, 227, 194, 0.2);
        }
        .stButton>button:hover { transform: translateY(-3px); box-shadow: 0 7px 20px rgba(80, 227, 194, 0.3); }
        .stButton>button:disabled { background-image: none; background-color: #424242; cursor: not-allowed; box-shadow: none; }
        .feedback-guany { color: var(--accent-color); } .feedback-perdua { color: #FF5252; }
        .career-path { position: relative; padding-left: 30px; border-left: 2px solid var(--border-color); }
        .step { position: relative; margin-bottom: 2rem; }
        .step-icon { position: absolute; left: -44px; top: 50%; transform: translateY(-50%); font-size: 1.8em; background: var(--dark-bg); padding: 5px; border-radius: 50%; }
        .step.unlocked .step-icon { color: var(--accent-color); }
        .step-details p { font-weight: 600; margin: 0; color: white; }
        .step-details span { font-size: 0.9em; color: #BDBDBD; }
        .step.locked .step-details { opacity: 0.5; }
        .stRadio>label { color: white; } /* Assegura que les opcions del radio siguin visibles */
    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---
st.markdown("<div class='app-header'><h1>ECO-Banc: Desenvolupament Professional</h1></div>", unsafe_allow_html=True)

col_stats_1, col_stats_2, col_stats_3 = st.columns(3)
with col_stats_1:
    saldo_html = f"""<div class="glass-card"><h2>Capital (ECO$)</h2><p>{st.session_state.saldo_eco:.0f}</p>"""
    if st.session_state.mostrar_cambio and st.session_state.cambio_saldo != 0:
        saldo_html += f'<div class="saldo-change {"positive" if st.session_state.cambio_saldo > 0 else "negative"}">{"+" if st.session_state.cambio_saldo > 0 else ""}{st.session_state.cambio_saldo}</div>'
    saldo_html += "</div>"
    st.markdown(saldo_html, unsafe_allow_html=True)

with col_stats_2:
    st.markdown(f"""<div class="glass-card"><h2>Puntuació</h2><p>{st.session_state.puntuacio_habilitats}</p></div>""", unsafe_allow_html=True)

with col_stats_3:
    total_respostes = st.session_state.get('preguntes_respostes', 0)
    correctes = st.session_state.get('respostes_correctes', 0)
    percentatge_encert = (correctes / total_respostes * 100) if total_respostes > 0 else 0
    st.markdown(f"""<div class="glass-card"><h2>% Encerts</h2><p>{percentatge_encert:.1f}%</p></div>""", unsafe_allow_html=True)

st.write("")

if st.session_state.preguntes_respostes > 0:
    st.subheader("Anàlisi de Rendiment")
    errors_df = pd.DataFrame(list(st.session_state.errors_per_categoria.items()), columns=['Habilitat', 'Errors'])
    if not errors_df.empty:
        chart = alt.Chart(errors_df).mark_bar(
            cornerRadius=5,
        ).encode(
            x=alt.X('Errors:Q', title='Nombre d\'Errors'),
            y=alt.Y('Habilitat:N', title='', sort='-x'),
            tooltip=['Habilitat', 'Errors'],
            color=alt.Color('Habilitat:N', legend=None)
        ).properties(
            title='Àrees de Millora'
        )
        st.altair_chart(chart, use_container_width=True)
    else:
        st.success("🎉 De moment, cap error! El teu rendiment és perfecte.")
    st.write("")

col1, col2 = st.columns([7, 3])

with col1:
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.subheader("Simulador de Decisions")
    
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
    st.subheader("Pla de Carrera")
    st.markdown('<div class="career-path">', unsafe_allow_html=True)

    for i, examen in enumerate(st.session_state.get('examens', [])):
        status_class = "unlocked" if examen["unlocked"] else "locked"
        can_unlock = st.session_state.examens[i-1]['unlocked'] if i > 0 else True
        
        st.markdown(f'<div class="step {status_class}">', unsafe_allow_html=True)
        st.markdown(f'<span class="step-icon">{examen["icon"]}</span>', unsafe_allow_html=True)
        st.markdown(f"""
            <div class="step-details">
                <p>{examen['nom']}</p>
                <span>{'✅ Certificació Obtinguda' if examen['unlocked'] else f"Inversió: {examen['cost']} ECO$"}</span>
            </div>
        """, unsafe_allow_html=True)
        
        if not examen['unlocked'] and can_unlock:
            if st.button(f"Desbloquejar", key=f"buy_exam_{examen['id']}", disabled=(st.session_state.saldo_eco < examen['cost'])):
                st.session_state.saldo_eco -= examen['cost']
                st.session_state.examens[i]['unlocked'] = True
                st.success(f"Has obtingut la certificació '{examen['nom']}'!")
                time.sleep(1.5)
                st.rerun()
        
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

# Lògica de l'animació
if st.session_state.get('mostrar_cambio', False):
    time.sleep(1.5)
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()
