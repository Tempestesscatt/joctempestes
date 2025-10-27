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

# --- BANC DE PREGUNTES 100% COMPLET (120 PREGUNTES) ---
PREGUNTES = [
    # =================== PRINCIPIANT (30 PREGUNTES) =====================
    {'pregunta': 'Què és el "desenvolupament sostenible"?', 'tipus': 'opcions', 'opcions': {'a': 'Creixement econòmic il·limitat', 'b': 'Satisfer les necessitats actuals sense comprometre les futures', 'c': 'Conservar la natura sense tocar-la', 'd': 'Prioritzar les necessitats humanes sobre les ambientals'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'El desenvolupament sostenible busca l\'equilibri entre economia, societat i medi ambient per a les generacions presents i futures.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'L\'educació que rebem a l\'escola o a la universitat s\'anomena...', 'tipus': 'opcions', 'opcions': {'a': 'Educació Informal', 'b': 'Educació No Formal', 'c': 'Educació Formal', 'd': 'Autoaprenentatge'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'L\'educació formal és la reglada, estructurada i que condueix a una titulació oficial.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'El llibre "Primavera Silenciosa" de Rachel Carson va ser fonamental per conscienciar sobre els perills dels...', 'tipus': 'opcions', 'opcions': {'a': 'Residus nuclears', 'b': 'Plàstics als oceans', 'c': 'Pesticides com el DDT', 'd': 'Gasos d\'efecte hivernacle'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'Aquesta obra és considerada una de les precursores del moviment ecologista modern.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Els 17 Objectius de Desenvolupament Sostenible (ODS) formen part de...', 'tipus': 'opcions', 'opcions': {'a': 'L\'Agenda 2030', 'b': 'El Protocol de Kyoto', 'c': 'La Conferència d\'Estocolm', 'd': 'L\'Informe Brundtland'}, 'correcta': 'a', 'nivell': 'principiant', 'feedback': 'L\'Agenda 2030, adoptada per l\'ONU el 2015, és el pla d\'acció global actual.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'Quina d\'aquestes accions correspon a l\'enfocament d\'educació "en" el medi?', 'tipus': 'opcions', 'opcions': {'a': 'Llegir un llibre sobre ecosistemes', 'b': 'Veure un documental sobre el canvi climàtic', 'c': 'Fer una excursió per identificar plantes en un bosc', 'd': 'Debatre a classe sobre una llei ambiental'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'L\'educació "en" el medi implica aprendre a través del contacte directe i l\'experiència a la natura.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'Quin és el significat del valor "Ambientalment NETA" en una societat sostenible?', 'tipus': 'opcions', 'opcions': {'a': 'No embrutar mai els carrers', 'b': 'Utilitzar els recursos sense superar la capacitat dels ecosistemes', 'c': 'Tenir moltes empreses de neteja', 'd': 'Que tots els productes siguin blancs'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'Significa gestionar els recursos de manera sostenible per no esgotar-los ni degradar el medi.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'L\'educació que s\'aprèn de manera espontània en la vida diària (família, amics, mitjans) és la...', 'tipus': 'opcions', 'opcions': {'a': 'Formal', 'b': 'Informal', 'c': 'No Formal', 'd': 'Ambiental'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'L\'educació informal és l\'aprenentatge constant i no planificat que fem cada dia.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'Quina famosa ONG ecologista, fundada el 1971, és coneguda per les seves accions directes i campanyes mediàtiques?', 'tipus': 'opcions', 'opcions': {'a': 'WWF', 'b': 'IUCN', 'c': 'Greenpeace', 'd': 'PNUMA'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'Greenpeace es caracteritza per les seves protestes visibles i accions directes per defensar el medi ambient.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'L\'enfocament de l\'EA que se centra en adquirir coneixements a través de llibres o a l\'escola és "Educació..."', 'tipus': 'opcions', 'opcions': {'a': '"sobre" el medi', 'b': '"en" el medi', 'c': '"per al" medi', 'd': '"amb" el medi'}, 'correcta': 'a', 'nivell': 'principiant', 'feedback': 'L\'educació "sobre" el medi es basa en la transmissió de coneixements teòrics.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'Un dels objectius principals de l\'EA és promoure...', 'tipus': 'opcions', 'opcions': {'a': 'La competència entre països', 'b': 'Un model de societat sostenible', 'c': 'El turisme massiu', 'd': 'La construcció de grans ciutats'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'L\'EA és una eina clau per avançar cap a un model de societat més just i sostenible.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quina d\'aquestes és una de les 3R fonamentals del consum responsable?', 'tipus': 'opcions', 'opcions': {'a': 'Repetir', 'b': 'Recordar', 'c': 'Reutilitzar', 'd': 'Reclamar'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'Les 3R són Reduir, Reutilitzar i Reciclar, pilars d\'un estil de vida sostenible.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'L\'Acord de París de 2015 busca lluitar contra...', 'tipus': 'opcions', 'opcions': {'a': 'La pobresa extrema', 'b': 'La pèrdua de biodiversitat', 'c': 'El canvi climàtic', 'd': 'La contaminació dels plàstics'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'El seu objectiu principal és limitar l\'escalfament global reduint les emissions de gasos d\'efecte hivernacle.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'Quin és el rol principal d\'un educador/a ambiental?', 'tipus': 'opcions', 'opcions': {'a': 'Només vigilar parcs naturals', 'b': 'Transmetre valors, coneixement i sensibilització sobre el medi', 'c': 'Redactar lleis ambientals', 'd': 'Fer anàlisis químics de l\'aigua'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'L\'educador/a ambiental utilitza la pedagogia per connectar les persones amb el seu entorn.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'L\'educació que es realitza en cursos, tallers o activitats extraescolars, de forma organitzada però fora del sistema reglat, s\'anomena...', 'tipus': 'opcions', 'opcions': {'a': 'Educació Informal', 'b': 'Educació No Formal', 'c': 'Educació Formal', 'd': 'Educació lliure'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'L\'educació no formal és intencionada i planificada, però flexible i fora del currículum oficial.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'L\'enfocament de l\'EA que busca fomentar canvis d\'hàbits i accions quotidianes és "Educació..."', 'tipus': 'opcions', 'opcions': {'a': '"sobre" el medi', 'b': '"en" el medi', 'c': '"per al" medi', 'd': '"dins" del medi'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'L\'educació "per al" medi té una clara vocació d\'acció i transformació social.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'Què significa que una societat sostenible ha de ser "Econòmicament VIABLE"?', 'tipus': 'opcions', 'opcions': {'a': 'Que tothom ha de ser ric', 'b': 'Que la bona gestió ambiental pot reduir costos econòmics', 'c': 'Que només les grans empreses poden ser sostenibles', 'd': 'Que s\'ha d\'evitar el progrés econòmic'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'La sostenibilitat demostra que cuidar el medi ambient no està renyit amb l\'eficiència econòmica.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Una de les finalitats de l\'EA és promoure una... ambiental.', 'tipus': 'opcions', 'opcions': {'a': 'Competició', 'b': 'Indiferència', 'c': 'Ètica', 'd': 'Burocràcia'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'Fomentar una ètica ambiental ajuda a desenvolupar valors de respecte, equitat i solidaritat.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'La Conferència d\'Estocolm de 1972 va ser la primera gran trobada mundial sobre...', 'tipus': 'opcions', 'opcions': {'a': 'Drets Humans', 'b': 'Desarmament nuclear', 'c': 'Medi Ambient', 'd': 'Economia global'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'Va ser el punt de partida per a la cooperació internacional en matèria ambiental.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quin d\'aquestes desastres va ser una catàstrofe nuclear que va augmentar la consciència ambiental?', 'tipus': 'opcions', 'opcions': {'a': 'Prestige', 'b': 'Exxon Valdez', 'c': 'Bhopal', 'd': 'Txernòbil'}, 'correcta': 'd', 'nivell': 'principiant', 'feedback': 'L\'accident de Txernòbil (1986) va tenir un impacte global sobre la percepció del risc tecnològic.', 'ambit': 'Història i Fites'},
    {'pregunta': 'L\'instrument d\'intervenció que busca transmetre informació de manera unidireccional (ex: un fulletó) és la...', 'tipus': 'opcions', 'opcions': {'a': 'Informació', 'b': 'Comunicació', 'c': 'Participació', 'd': 'Formació'}, 'correcta': 'a', 'nivell': 'principiant', 'feedback': 'La informació és la base, però és unidireccional. La comunicació, en canvi, busca el diàleg.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Les sigles WWF es refereixen a una famosa organització de...', 'tipus': 'opcions', 'opcions': {'a': 'Salut mundial', 'b': 'Conservació de la natura', 'c': 'Comerç just', 'd': 'Drets dels treballadors'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'WWF (World Wide Fund for Nature) és una de les organitzacions de conservació més grans del món.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Què significa que l\'EA ha de promoure la "participació activa"?', 'tipus': 'opcions', 'opcions': {'a': 'Que tothom ha de pensar el mateix', 'b': 'Que la gent s\'ha d\'implicar en la solució de problemes', 'c': 'Que només els experts poden opinar', 'd': 'Que s\'ha de protestar sempre'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'La participació implica passar de ser un espectador a ser un actor en la protecció de l\'entorn.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'El concepte de "responsabilitat compartida" en EA significa que la cura del medi ambient és tasca de...', 'tipus': 'opcions', 'opcions': {'a': 'Només dels governs', 'b': 'Només de les empreses', 'c': 'Només dels ecologistes', 'd': 'Tota la societat'}, 'correcta': 'd', 'nivell': 'principiant', 'feedback': 'És un projecte comú que requereix la implicació de tots els sectors i persones.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quin és el principal problema de l\'enfocament antropocèntric?', 'tipus': 'opcions', 'opcions': {'a': 'Dona massa importància als animals', 'b': 'És massa car', 'c': 'Posa l\'ésser humà al centre, per sobre de la natura', 'd': 'És antiquat'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'L\'antropocentrisme considera la natura com un simple recurs per a l\'ésser humà, un enfocament que l\'EA busca superar.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'L\'instrument d\'intervenció que utilitza mitjans com la premsa o les xarxes socials per motivar a l\'acció és la...', 'tipus': 'opcions', 'opcions': {'a': 'Investigació', 'b': 'Avaluació', 'c': 'Comunicació', 'd': 'Formació'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'La comunicació busca persuadir i mobilitzar a través de campanyes i missatges bidireccionals.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Quin d\'aquests valors NO correspon a una societat sostenible segons el text?', 'tipus': 'opcions', 'opcions': {'a': 'Socialment Justa', 'b': 'Ambientalment Neta', 'c': 'Individualment Competitiva', 'd': 'Econòmicament Viable'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'Els valors de la sostenibilitat són col·lectius i cooperatius, no basats en la competència individual.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'La "Llista Vermella" de la IUCN serveix per identificar...', 'tipus': 'opcions', 'opcions': {'a': 'Països contaminants', 'b': 'Empreses no sostenibles', 'c': 'Espècies en perill d\'extinció', 'd': 'Rius contaminats'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'És l\'inventari més complet del món sobre l\'estat de conservació global de les espècies.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Un dels objectius de l\'EA és ensenyar a analitzar críticament la...', 'tipus': 'opcions', 'opcions': {'a': 'Música clàssica', 'b': 'Informació sobre el medi ambient', 'c': 'Literatura antiga', 'd': 'Moda'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'L\'EA no només dona informació, sinó que ensenya a avaluar-la de forma crítica per evitar manipulacions.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'La Cimera de la Terra de 1992, un esdeveniment clau per a la sostenibilitat, es va celebrar a...', 'tipus': 'opcions', 'opcions': {'a': 'Estocolm', 'b': 'París', 'c': 'Río de Janeiro', 'd': 'Kyoto'}, 'correcta': 'c', 'nivell': 'principiant', 'feedback': 'La Cimera de Río va tenir una repercussió mediàtica mundial i va posar el desenvolupament sostenible a l\'agenda global.', 'ambit': 'Història i Fites'},
    {'pregunta': 'El voluntariat ambiental és un exemple de...', 'tipus': 'opcions', 'opcions': {'a': 'Educació Formal', 'b': 'Participació Ciutadana', 'c': 'Sanció econòmica', 'd': 'Investigació científica'}, 'correcta': 'b', 'nivell': 'principiant', 'feedback': 'És una forma d\'implicació directa i altruista de la ciutadania en la cura de l\'entorn.', 'ambit': 'Actors i Instruments'},
    
    # =================== AVANÇAT (30 PREGUNTES) =====================
    {'pregunta': 'Quin informe de 1987 va definir i popularitzar per primer cop el concepte de "desenvolupament sostenible"?', 'tipus': 'opcions', 'opcions': {'a': 'Informe "Els Límits del Creixement"', 'b': 'Carta de Belgrad', 'c': 'Informe Brundtland', 'd': 'Agenda 21'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'L\'Informe Brundtland, titulat "El nostre Futur Comú", va ser un punt d\'inflexió conceptual.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'La Conferència d\'Estocolm de 1972 va donar lloc a la creació d\'un important organisme de l\'ONU. Quin?', 'tipus': 'opcions', 'opcions': {'a': 'UNESCO', 'b': 'PNUMA', 'c': 'Greenpeace', 'd': 'WWF'}, 'correcta': 'b', 'nivell': 'avançat', 'feedback': 'El PNUMA (Programa de les Nacions Unides per al Medi Ambient) va néixer arran d\'aquesta conferència.', 'ambit': 'Història i Fites'},
    {'pregunta': 'A Espanya, quina llei educativa de 1990 va introduir per primer cop l\'Educació Ambiental com a eix transversal?', 'tipus': 'opcions', 'opcions': {'a': 'Llei Moyano', 'b': 'Llei General d\'Educació', 'c': 'LOGSE', 'd': 'LOMCE'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'La LOGSE va ser pionera en la incorporació de continguts transversals com l\'EA al currículum.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'El Protocol de Kyoto (1997) va ser el primer tractat internacional vinculant per a...', 'tipus': 'opcions', 'opcions': {'a': 'Protegir la capa d\'ozó', 'b': 'Prohibir els plàstics d\'un sol ús', 'c': 'Reduir les emissions de gasos d\'efecte hivernacle', 'd': 'Crear reserves de la biosfera'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'Kyoto va establir per primer cop objectius quantificats de reducció d\'emissions per als països industrialitzats.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'El Centre Nacional d\'Educació Ambiental (CENEAM), un referent a Espanya, es troba a...', 'tipus': 'opcions', 'opcions': {'a': 'Madrid', 'b': 'Barcelona', 'c': 'Valsaín (Segòvia)', 'd': 'Sitges'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'El CENEAM es va inaugurar als anys 80, en l\'etapa de formalització, i és un centre clau per a l\'EA a Espanya.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'El document fonamental sorgit del Seminari Internacional d\'EA de 1975 es coneix com la...', 'tipus': 'opcions', 'opcions': {'a': 'Declaració de Tbilissi', 'b': 'Carta de la Terra', 'c': 'Carta de Belgrad', 'd': 'Declaració de Río'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'La Carta de Belgrad va establir un marc global per a l\'educació ambiental, definint els seus objectius i principis.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'L\'informe de 1972 "Els Límits del Creixement" va ser un encàrrec de l\'organització coneguda com...', 'tipus': 'opcions', 'opcions': {'a': 'El Club de Roma', 'b': 'La UNESCO', 'c': 'El Banc Mundial', 'd': 'La Unió Europea'}, 'correcta': 'a', 'nivell': 'avançat', 'feedback': 'El Club de Roma, un grup de científics i pensadors, va alertar sobre els riscos d\'un creixement exponencial.', 'ambit': 'Història i Fites'},
    {'pregunta': 'A Catalunya, l\'etapa de "Formalització" de l\'EA, amb la creació de les primeres unitats administratives, correspon a la dècada de...', 'tipus': 'opcions', 'opcions': {'a': '1970', 'b': '1980', 'c': '1990', 'd': '2000'}, 'correcta': 'b', 'nivell': 'avançat', 'feedback': 'Els anys 80 van ser clau per a la institucionalització de l\'EA a Espanya i Catalunya.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quin d\'aquests NO és un dels problemes per a la professionalització de l\'educador/a ambiental segons el text?', 'tipus': 'opcions', 'opcions': {'a': 'Indefinició del perfil', 'b': 'Manca de recursos', 'c': 'Excés de regulació', 'd': 'Competència deslleial'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'El text no esmenta un excés de regulació, sinó més aviat la necessitat de professionalitzar i regular el sector.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'La Dècada de les Nacions Unides de l\'Educació per al Desenvolupament Sostenible va comprendre el període...', 'tipus': 'opcions', 'opcions': {'a': '1995-2004', 'b': '2000-2009', 'c': '2005-2014', 'd': '2015-2024'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'Aquesta dècada va tenir l\'objectiu d\'integrar els principis de la sostenibilitat en tots els aspectes de l\'educació.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'Quin document de la Cimera de Río (1992) proposava un pla d\'acció detallat per al desenvolupament sostenible a nivell global i local?', 'tipus': 'opcions', 'opcions': {'a': 'El Conveni sobre la Diversitat Biològica', 'b': 'El Tractat d\'EA per a Societats Sostenibles', 'c': 'La Declaració de Río', 'd': 'L\'Agenda 21'}, 'correcta': 'd', 'nivell': 'avançat', 'feedback': 'L\'Agenda 21 va ser el gran pla d\'acció, impulsant la creació d\'Agendes 21 locals a tot el món.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'A Espanya, l\'etapa de "replantejament crític" de l\'EA, on es va començar a parlar de qualitat i sostenibilitat, va ser als anys...', 'tipus': 'opcions', 'opcions': {'a': '70', 'b': '80', 'c': '90', 'd': '2000'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'Als anys 90, el sector va madurar i va començar a reflexionar críticament sobre les seves pràctiques i objectius.', 'ambit': 'Història i Fites'},
    {'pregunta': 'El concepte que l\'EA ha de ser "interdisciplinària i multidisciplinària" significa que...', 'tipus': 'opcions', 'opcions': {'a': 'Només s\'ha d\'ensenyar en ciències naturals', 'b': 'Ha d\'integrar coneixements de diverses àrees', 'c': 'És una disciplina molt difícil', 'd': 'No té a veure amb les ciències socials'}, 'correcta': 'b', 'nivell': 'avançat', 'feedback': 'Els problemes ambientals són complexos i requereixen una visió que connecti diferents camps del saber.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'La primera definició formal d\'"educació ambiental" va ser proposada per William B. Stapp l\'any...', 'tipus': 'opcions', 'opcions': {'a': '1948', 'b': '1962', 'c': '1969', 'd': '1972'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'Aquesta definició de 1969 és considerada una de les fundacionals del camp de l\'EA.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quina d\'aquestes és una característica clau de l\'Educació per al Desenvolupament Sostenible (EDS)?', 'tipus': 'opcions', 'opcions': {'a': 'Enfocament purament local', 'b': 'Orientada als valors', 'c': 'Exclusivament teòrica', 'd': 'Dirigida només a infants'}, 'correcta': 'b', 'nivell': 'avançat', 'feedback': 'L\'EDS no només transmet coneixements, sinó que promou valors com la justícia, l\'equitat i la solidaritat.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'L\'instrument d\'intervenció que se centra en la formació contínua i el "saber fer" per afrontar reptes futurs s\'anomena...', 'tipus': 'opcions', 'opcions': {'a': 'Informació Personalitzada', 'b': 'Formació Professional', 'c': 'Capacitació', 'd': 'Avaluació'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'La capacitació es diferencia de la formació tradicional per ser més pràctica, adaptable i orientada a l\'acció.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'A Catalunya, la Xarxa de Ciutats i Pobles per la Sostenibilitat va ser una iniciativa clau impulsada per...', 'tipus': 'opcions', 'opcions': {'a': 'La Generalitat de Catalunya', 'b': 'L\'Ajuntament de Barcelona', 'c': 'La Diputació de Barcelona', 'd': 'La Societat Catalana d\'EA (SCEA)'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'Aquesta xarxa va ser fonamental per estendre les polítiques de sostenibilitat i les Agendes 21 a nivell municipal.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'El desastre del petrolier Exxon Valdez, un dels majors vessaments de cru de la història, va ocórrer l\'any...', 'tipus': 'opcions', 'opcions': {'a': '1979', 'b': '1984', 'c': '1989', 'd': '2002'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'L\'accident de l\'Exxon Valdez a Alaska va tenir un impacte mediàtic i legislatiu enorme.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Un dels objectius de l\'EA és ensenyar a analitzar conflictes socioambientals. Això implica entendre la seva dimensió...', 'tipus': 'opcions', 'opcions': {'a': 'Únicament ecològica', 'b': 'Històrica i artística', 'c': 'Social, econòmica i cultural', 'd': 'Només política'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'Els conflictes ambientals rarament són només naturals; tenen arrels socials, econòmiques i culturals.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'El programa "Escoles Verdes" és un referent de l\'EA formal a Catalunya que es va consolidar durant l\'etapa de...', 'tipus': 'opcions', 'opcions': {'a': 'Eclosió (anys 70)', 'b': 'Formalització (anys 80)', 'c': 'Generalització (anys 90)', 'd': 'Maduració (anys 2000)'}, 'correcta': 'd', 'nivell': 'avançat', 'feedback': 'Als anys 2000, programes com Escoles Verdes i l\'Agenda 21 Escolar van mostrar la maduresa i consolidació de l\'EA.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Quin d\'aquests instruments d\'intervenció té com a objectiu principal mesurar l\'eficàcia dels projectes?', 'tipus': 'opcions', 'opcions': {'a': 'Investigació', 'b': 'Comunicació', 'c': 'Avaluació', 'd': 'Participació'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'L\'avaluació és clau per saber si un projecte ha funcionat i com es pot millorar en el futur.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Segons el text, la crisi econòmica va marcar a Catalunya l\'etapa de l\'EA coneguda com...', 'tipus': 'opcions', 'opcions': {'a': 'Maduració', 'b': 'Resistència i aliances', 'c': 'Oficialització', 'd': 'Eclosió'}, 'correcta': 'b', 'nivell': 'avançat', 'feedback': 'A partir de 2008, la crisi va obligar el sector a reinventar-se, buscar aliances i treballar en xarxa.', 'ambit': 'Història i Fites'},
    {'pregunta': 'La primera referència del terme EA per Stapp (1969) la defineix com un procés per formar ciutadans...', 'tipus': 'opcions', 'opcions': {'a': 'Obedients i disciplinats', 'b': 'Rics i productius', 'c': 'Informats i motivats per actuar', 'd': 'Crítics però inactius'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'Des del seu origen, l\'EA ha tingut una clara vocació de formar una ciutadania activa i competent.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'La Cimera Mundial sobre el Desenvolupament Sostenible de 2002, on es va reforçar el paper de l\'educació, es va celebrar a...', 'tipus': 'opcions', 'opcions': {'a': 'Río de Janeiro', 'b': 'Johannesburg', 'c': 'París', 'd': 'Estocolm'}, 'correcta': 'b', 'nivell': 'avançat', 'feedback': 'La Cimera de Johannesburg va ser clau per consolidar el concepte d\'Educació per al Desenvolupament Sostenible (EDS).', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quin d\'aquests és un dels principals reptes de l\'EA en el sistema educatiu formal?', 'tipus': 'opcions', 'opcions': {'a': 'Massa temps lliure a les aules', 'b': 'Poc interès dels mitjans de comunicació', 'c': 'Currículums saturats de contingut', 'd': 'Excés de finançament públic'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'La manca d\'espai en uns currículums ja molt plens dificulta la integració efectiva de l\'EA.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'L\'instrument del "Consum Responsable" es considera una forma de...', 'tipus': 'opcions', 'opcions': {'a': 'Informació', 'b': 'Formació', 'c': 'Participació', 'd': 'Investigació'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'A través de les nostres decisions de compra, participem activament en el model econòmic i ambiental.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'El Moviment de Renovació Pedagògica va ser un actor clau en els inicis de l\'EA a Espanya, especialment en l\'àmbit...', 'tipus': 'opcions', 'opcions': {'a': 'Universitari', 'b': 'Empresarial', 'c': 'Escolar', 'd': 'Polític'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'Aquest moviment de mestres i pedagogs va ser fonamental per introduir noves pràctiques educatives, inclosa l\'EA.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'La desaparició del Departament de Medi Ambient de la Generalitat de Catalunya va succeir l\'any...', 'tipus': 'opcions', 'opcions': {'a': '1999', 'b': '2003', 'c': '2008', 'd': '2010'}, 'correcta': 'd', 'nivell': 'avançat', 'feedback': 'Aquest fet, en plena crisi econòmica, va marcar un punt d\'inflexió en les polítiques ambientals catalanes.', 'ambit': 'Història i Fites'},
    {'pregunta': 'La conferència on va sorgir una controvèrsia internacional sobre si canviar el nom d\'EA a "Educació per al Desenvolupament Sostenible" va ser a...', 'tipus': 'opcions', 'opcions': {'a': 'Tbilissi (1977)', 'b': 'Moscou (1987)', 'c': 'Tesalònica (1997)', 'd': 'Johannesburg (2002)'}, 'correcta': 'c', 'nivell': 'avançat', 'feedback': 'A Tesalònica es va produir aquest important debat conceptual que va reorientar l\'EA cap a la sostenibilitat.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Segons el text, la cultura és l\'element que connecta les tres àrees (societat, medi ambient i economia) amb...', 'tipus': 'opcions', 'opcions': {'a': 'La política internacional', 'b': 'El desenvolupament sostenible', 'c': 'El progrés tecnològic', 'd': 'La història de l\'art'}, 'correcta': 'b', 'nivell': 'avançat', 'feedback': 'La cultura és sovint considerada la quarta dimensió de la sostenibilitat, ja que defineix com vivim i interactuem.', 'ambit': 'Conceptes Fonamentals'},
    
    # =================== EXPERT (30 PREGUNTES) =====================
    {'pregunta': 'La Conferència Intergovernamental de 1977, clau per a la pedagogia de l\'EA, es va celebrar a...', 'tipus': 'opcions', 'opcions': {'a': 'Estocolm', 'b': 'Belgrad', 'c': 'Tbilissi', 'd': 'Tesalònica'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'La Conferència de Tbilissi (Geòrgia) va definir els objectius, principis i estratègies de l\'EA a nivell mundial.', 'ambit': 'Història i Fites'},
    {'pregunta': 'A Catalunya, la dècada de 1990, amb la creació de la Direcció General d\'EA i la SCEA, es coneix com l\'etapa de...', 'tipus': 'opcions', 'opcions': {'a': 'Eclosió', 'b': 'Formalització', 'c': 'Maduració', 'd': 'Generalització i oficialització'}, 'correcta': 'd', 'nivell': 'expert', 'feedback': 'Va ser el moment en què l\'EA es va consolidar a les estructures administratives i associatives de Catalunya.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quin instrument d\'intervenció de l\'EA se centra específicament en el "saber fer" i l\'adquisició d\'habilitats pràctiques i adaptables?', 'tipus': 'opcions', 'opcions': {'a': 'Formació', 'b': 'Capacitació', 'c': 'Informació', 'd': 'Comunicació'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'La capacitació va més enllà de la formació teòrica, enfocant-se en la competència pràctica per a l\'acció.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'El "Libro Blanco de la Educación Ambiental en España" (1999) va ser innovador perquè...', 'tipus': 'opcions', 'opcions': {'a': 'Va ser redactat només per polítics', 'b': 'Va sorgir d\'un ampli procés de participació pública', 'c': 'Es va centrar exclusivament en la biologia', 'd': 'Va ser una traducció d\'un document europeu'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'La seva principal fortalesa i legitimitat rau en el fet que va ser un document consensuat amb tots els actors implicats.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'Segons Lucie Sauvé, l\'objectiu de l\'EA no és només el medi, sinó les relacions humanes, que es manifesten en tres esferes: amb un mateix, amb els altres i...', 'tipus': 'opcions', 'opcions': {'a': 'Amb l\'economia', 'b': 'Amb la tecnologia', 'c': 'Amb l\'oikos (la casa de tots)', 'd': 'Amb la política'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'Aquesta visió holística (oikos = casa/entorn en grec) amplia el camp de l\'EA més enllà de l\'ecologia tradicional.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'El Programa Internacional d’Educació Ambiental (PIEA) va ser creat conjuntament per l\'UNESCO i...', 'tipus': 'opcions', 'opcions': {'a': 'El Banc Mundial', 'b': 'La Creu Roja', 'c': 'El PNUMA', 'd': 'L\'OTAN'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'El PIEA, creat el 1975, va ser una col·laboració estratègica entre l\'organisme d\'educació (UNESCO) i el de medi ambient (PNUMA) de l\'ONU.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Quin d\'aquests projectes NO és esmentat com a destacat de l\'etapa de Maduració de l\'EA a Catalunya (1998-2008)?', 'tipus': 'opcions', 'opcions': {'a': 'Xarxa de Custòdia del Territori', 'b': 'Projecte Rius', 'c': 'Creació del CENEAM', 'd': 'Institut Català d\'Ornitologia'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'El CENEAM és un centre estatal inaugurat als anys 80, molt abans d\'aquesta etapa de maduració a Catalunya.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'La recomanació del Llibre Blanc (LBEA) de "Garantir qualitat i acreditació dels centres d’EA" s\'adreça a l\'escenari de...', 'tipus': 'opcions', 'opcions': {'a': 'Les empreses', 'b': 'El sistema educatiu', 'c': 'L\'Administració Pública', 'd': 'Les associacions'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'És responsabilitat de l\'Administració establir mecanismes de control i acreditació per professionalitzar el sector.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'La principal causa que va marcar l\'etapa de "Resistència i aliances" de l\'EA a Catalunya (2008-2018) va ser...', 'tipus': 'opcions', 'opcions': {'a': 'Una onada de protestes socials', 'b': 'La crisi econòmica', 'c': 'Un canvi de paradigma educatiu', 'd': 'L\'aprovació de noves lleis europees'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'La crisi econòmica va provocar una forta retallada de recursos i una menor prioritat política per a l\'EA.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Segons el text, l\'EDS ha de ser "multimetodològica". Això s\'oposa a un enfocament...', 'tipus': 'opcions', 'opcions': {'a': 'Pràctic i vivencial', 'b': 'Crític i reflexiu', 'c': 'Únic i rígid per a tothom', 'd': 'Participatiu i democràtic'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'Ser multimetodològica implica utilitzar diverses estratègies (debat, projectes, sortides, etc.) adaptades a cada context.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'El Fòrum 2000 de la SCEA i l\'Estratègia Catalana d\'Educació Ambiental (2003) són fites de l\'etapa de...', 'tipus': 'opcions', 'opcions': {'a': 'Eclosió', 'b': 'Formalització', 'c': 'Maduració', 'd': 'Resistència'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'Aquests esdeveniments mostren la consolidació i la capacitat de reflexió estratègica del sector durant la dècada del 2000.', 'ambit': 'Història i Fites'},
    {'pregunta': 'El "Compromís Ciutadà per la Sostenibilitat" i la xarxa "Barcelona + Sostenible" són iniciatives de...', 'tipus': 'opcions', 'opcions': {'a': 'La Generalitat de Catalunya', 'b': 'L\'Ajuntament de Barcelona', 'c': 'La Diputació de Barcelona', 'd': 'L\'Obrador del Tercer Sector Ambiental'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'Són exemples de com l\'Ajuntament de Barcelona ha mantingut i renovat el seu compromís amb la sostenibilitat local.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Quina de les finalitats de l\'EA se centra específicament en "debatre alternatives i prendre decisions per resoldre" conflictes?', 'tipus': 'opcions', 'opcions': {'a': 'Comprensió', 'b': 'Anàlisi de conflictes socioambientals', 'c': 'Ètica', 'd': 'Coneixement'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'Aquesta finalitat va més enllà de l\'anàlisi, incloent la deliberació i la presa de decisions com a competències clau.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'La "Fàbrica del Sol" i les aules ambientals són equipaments de referència en EA de la ciutat de...', 'tipus': 'opcions', 'opcions': {'a': 'Girona', 'b': 'Tarragona', 'c': 'Lleida', 'd': 'Barcelona'}, 'correcta': 'd', 'nivell': 'expert', 'feedback': 'Són exemples concrets d\'equipaments municipals que dinamitzen l\'EA a Barcelona.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'L\'Obrador del Tercer Sector Ambiental de Catalunya va ser creat durant l\'etapa de...', 'tipus': 'opcions', 'opcions': {'a': 'Generalització i oficialització (anys 90)', 'b': 'Maduració (anys 2000)', 'c': 'Resistència i aliances (post-2008)', 'd': 'Formalització (anys 80)'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'Aquesta plataforma de col·laboració va néixer precisament com a resposta a la necessitat de sumar forces durant la crisi.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'El principi de l\'EA que diu que ha de "desenvolupar una acció educativa coherent i creïble" implica que l\'educador ha de...', 'tipus': 'opcions', 'opcions': {'a': 'Ser un expert científic', 'b': 'Actuar com un exemple a seguir', 'c': 'Tenir molta autoritat', 'd': 'Treballar sempre sol'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'La coherència entre el discurs i la pràctica és fonamental per a la credibilitat de qualsevol procés educatiu.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'El Congrés Internacional d\'Educació i Formació Ambiental de 1987, on es va revisar el progrés des de Tbilissi, es va celebrar a...', 'tipus': 'opcions', 'opcions': {'a': 'Río de Janeiro', 'b': 'Moscou', 'c': 'Kyoto', 'd': 'Johannesburg'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'Aquest congrés de Moscou va servir per fer balanç de la primera dècada d\'implementació de l\'EA a nivell mundial.', 'ambit': 'Història i Fites'},
    {'pregunta': 'El Llibre Blanc (LBEA) recomana a les empreses "Fomentar la sensibilització i participació dels..."', 'tipus': 'opcions', 'opcions': {'a': 'Clients', 'b': 'Accionistes', 'c': 'Treballadors', 'd': 'Proveïdors'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'El Llibre Blanc destaca la importància d\'implicar la plantilla en les polítiques de sostenibilitat de l\'empresa.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'La primera edició de les Jornades d\'Educació Ambiental a Espanya es va celebrar a...', 'tipus': 'opcions', 'opcions': {'a': 'Valsaín (1987)', 'b': 'Sitges (1983)', 'c': 'Madrid (1990)', 'd': 'Barcelona (1992)'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'Sitges va acollir les primeres jornades, sent un punt de trobada pioner per als professionals del sector.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Segons el text, la dècada dels 90 va posar èmfasi en la dimensió... de l\'EA.', 'tipus': 'opcions', 'opcions': {'a': 'Tecnològica', 'b': 'Social', 'c': 'Biològica', 'd': 'Artística'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'Es va aprofundir en la comprensió de les relacions humans-biosfera i els impactes socials i econòmics.', 'ambit': 'Història i Fites'},
    {'pregunta': 'La Xarxa de Voluntariat Ambiental de Catalunya es coneix per les sigles...', 'tipus': 'opcions', 'opcions': {'a': 'SCEA', 'b': 'CENEAM', 'c': 'LBEA', 'd': 'XVAC'}, 'correcta': 'd', 'nivell': 'expert', 'feedback': 'La XVAC és un dels projectes col·laboratius destacats que van sorgir en l\'etapa de maduració de l\'EA a Catalunya.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'El document de les ONG al Fòrum Global de Río (1992) es va anomenar...', 'tipus': 'opcions', 'opcions': {'a': 'Agenda 21', 'b': 'Declaració de Río', 'c': 'Tractat d\'Educació Ambiental per a Societats Sostenibles', 'd': 'Carta de la Terra'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'Mentre els governs signaven l\'Agenda 21, la societat civil va elaborar aquest tractat amb una visió més crítica i social.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'El valor d\'una societat sostenible que es refereix a la "conservació del capital humà i cultural respectant la diversitat" és...', 'tipus': 'opcions', 'opcions': {'a': 'Socialment Justa', 'b': 'Democràticament Governada', 'c': 'Econòmicament Viable', 'd': 'Culturament Accessible'}, 'correcta': 'a', 'nivell': 'expert', 'feedback': 'Aquest valor reconeix la cultura com un pilar fonamental per a la sostenibilitat.', 'ambit': 'Conceptes Fonamentals'}, 
    {'pregunta': 'El Llibre Blanc de l\'EA a Espanya s\'estructura en dues grans parts: un fonament teòric i una part...', 'tipus': 'opcions', 'opcions': {'a': 'Històrica', 'b': 'Legislativa', 'c': 'Pràctica amb marcs d\'acció', 'd': 'Filosòfica'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'Aquesta estructura combina la reflexió teòrica amb propostes concretes per a l\'acció.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'El principi de l\'EA que diu que ha de "facilitar la coordinació i col·laboració entre agents socials" la considera un...', 'tipus': 'opcions', 'opcions': {'a': 'Projecte comú', 'b': 'Negoci rendible', 'c': 'Camp de recerca', 'd': 'Instrument polític'}, 'correcta': 'a', 'nivell': 'expert', 'feedback': 'Aquest principi destaca la necessitat de treballar en xarxa i de forma col·laborativa.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quin d\'aquests NO és un dels objectius de l\'Educació per al Desenvolupament Sostenible (EDS)?', 'tipus': 'opcions', 'opcions': {'a': 'Millorar la qualitat de l\'ensenyament en EDS', 'b': 'Fomentar la col·laboració entre agents', 'c': 'Prioritzar el creixement econòmic sobre el medi ambient', 'd': 'Donar més protagonisme a l\'educació'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'L\'EDS busca precisament l\'equilibri entre economia, societat i medi ambient, no la priorització d\'un sobre els altres.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'La justificació per a la realització del Llibre Blanc incloïa problemes com l\'efecte hivernacle, la desertització i...', 'tipus': 'opcions', 'opcions': {'a': 'La crisi del petroli', 'b': 'La guerra freda', 'c': 'El repartiment injust de la pobresa', 'd': 'L\'expansió d\'internet'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'El Llibre Blanc va ser pioner en connectar de forma explícita els problemes ecològics globals amb les desigualtats socials.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'L\'any 1991 es va crear a Catalunya la Direcció General d\'EA dins del...', 'tipus': 'opcions', 'opcions': {'a': 'Departament d\'Educació', 'b': 'Departament de Medi Ambient', 'c': 'Departament de Cultura', 'd': 'Departament de Territori'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'Aquest fet va ser un pas clau en la institucionalització i oficialització de l\'EA a Catalunya.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quina característica de l\'EDS implica que ha de ser "transversal i holística"?', 'tipus': 'opcions', 'opcions': {'a': 'Que només es fa a través de tallers', 'b': 'Que ha d\'impregnar tot el currículum i connectar diferents àrees', 'c': 'Que només es basa en l\'experiència directa', 'd': 'Que és opcional per a l\'alumnat'}, 'correcta': 'b', 'nivell': 'expert', 'feedback': 'Ser transversal i holística significa que no és una assignatura aïllada, sinó un enfocament que ha d\'estar present a tot arreu.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'L\'etapa de l\'EA a Espanya dels anys 90 es va caracteritzar per una major exigència de... en els programes i activitats.', 'tipus': 'opcions', 'opcions': {'a': 'Quantitat', 'b': 'Rendibilitat econòmica', 'c': 'Criteris de qualitat', 'd': 'Participació política'}, 'correcta': 'c', 'nivell': 'expert', 'feedback': 'En l\'etapa de replantejament crític, el sector va començar a preocupar-se per la qualitat i l\'eficàcia de les seves intervencions.', 'ambit': 'Història i Fites'},
    
    # =================== LLEGENDA (30 PREGUNTES - Selecció Múltiple) =====================
    {'pregunta': 'Quines de les següents són considerades fites històriques CLAU en la dècada de 1970 per a l\'EA? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Publicació de l\'Informe Brundtland', 'b': 'Conferència d\'Estocolm (1972)', 'c': 'Creació del PNUMA (1973)', 'd': 'Conferència de Tbilissi (1977)'}, 'correcta': ['b', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'L\'Informe Brundtland és de 1987. Estocolm, la creació del PNUMA i Tbilissi van ser els tres grans esdeveniments que van definir l\'EA als anys 70.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quins dels següents són instruments d\'intervenció en Educació Ambiental segons el text? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Investigació', 'b': 'Legislació', 'c': 'Participació', 'd': 'Capacitació'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'La legislació (normes, sancions) és un instrument de gestió ambiental, però el text diferencia els instruments propis de l\'EA com la investigació, participació i capacitació, basats en l\'aprenentatge social.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Quins dels següents són reptes de l\'educació ambiental FORMAL esmentats en el resum? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Falta de recursos i formació docent', 'b': 'Currículums saturats', 'c': 'Teoria desvinculada de la pràctica', 'd': 'Excés d\'interès per part dels alumnes'}, 'correcta': ['a', 'b', 'c'], 'nivell': 'llegenda', 'feedback': 'Els tres grans reptes són la falta de mitjans, la sobrecàrrega dels plans d\'estudi i la dificultat de connectar la teoria amb accions reals i pràctiques.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'Quines d\'aquestes iniciatives o programes són referents de l\'EA a Catalunya durant l\'etapa de Maduració (1998-2008)? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Escoles Verdes', 'b': 'Creació de la SCEA', 'c': 'Agenda 21 Escolar', 'd': 'Xarxa de Custòdia del Territori'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'La SCEA es va crear a la dècada anterior (dels 90). Escoles Verdes, l\'Agenda 21 Escolar i la Xarxa de Custòdia del Territori són projectes que es van consolidar en l\'etapa de maduració.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Una societat sostenible ha de complir diversos valors. Quins dels següents en formen part? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Ambientalment Neta', 'b': 'Individualment Competitiva', 'c': 'Socialment Justa', 'd': 'Econòmicament Viable'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'Els pilars són ser Neta (ambiental), Justa (social) i Viable (econòmica). La competència individual no és un valor fonamental de la sostenibilitat.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quines de les següents són finalitats i objectius de l\'EA segons el text? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Fomentar una ètica ambiental', 'b': 'Promoure un pensament únic i homogeni', 'c': 'Estimular la participació activa', 'd': 'Entendre millor els processos ambientals'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'L\'EA busca el pensament crític i divers, no un pensament únic. La resta són finalitats clau.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quines de les següents són característiques de l\'Educació per al Desenvolupament Sostenible (EDS)? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Interdisciplinària i holística', 'b': 'Basada en el pensament crític', 'c': 'Monomotodològica i rígida', 'd': 'Orientada als valors'}, 'correcta': ['a', 'b', 'd'], 'nivell': 'llegenda', 'feedback': 'L\'EDS ha de ser multimetodològica i flexible, no monomotodològica. La resta de característiques són correctes.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quins dels següents escenaris d\'actuació de l\'EA són esmentats en el text? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Sistema Educatiu', 'b': 'Empreses', 'c': 'Administració Pública', 'd': 'Sector tecnològic exclusivament'}, 'correcta': ['a', 'b', 'c'], 'nivell': 'llegenda', 'feedback': 'El text desgrana les recomanacions per a l\'educació, les empreses, l\'administració i la comunitat en general, no només per al sector tecnològic.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Quines d\'aquestes fites internacionals van tenir lloc abans de la Conferència de Tbilissi (1977)? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Informe Brundtland', 'b': 'Fundació del WWF (1961)', 'c': 'Conferència d\'Estocolm (1972)', 'd': 'Protocol de Kyoto'}, 'correcta': ['b', 'c'], 'nivell': 'llegenda', 'feedback': 'L\'Informe Brundtland (1987) i el Protocol de Kyoto (1997) són posteriors a Tbilissi. La fundació del WWF i la Conferència d\'Estocolm van ser abans.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quines de les següents són recomanacions del Llibre Blanc (LBEA) per a l\'escenari del Sistema Educatiu? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Millorar la formació del professorat en EA', 'b': 'Reduir les hores de ciències naturals', 'c': 'Integrar l\'EA en la planificació dels centres', 'd': 'Garantir recursos adequats'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'El Llibre Blanc no proposa reduir hores, sinó integrar l\'EA de manera transversal i dotar el sistema de recursos i formació.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'Quins dels següents són instruments d\'intervenció basats en la participació? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Informació general en una pàgina web', 'b': 'Voluntariat ambiental', 'c': 'Consum responsable', 'd': 'Processos de participació pública'}, 'correcta': ['b', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'La informació general és un instrument unidireccional, mentre que els altres tres impliquen una acció i decisió per part de la ciutadania.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Quines de les següents afirmacions sobre l\'etapa de "Resistència i aliances" (post-2008) a Catalunya són certes? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Va desaparèixer el Departament de Medi Ambient', 'b': 'Es va crear el programa Escoles Verdes', 'c': 'Va augmentar molt la inversió pública en EA', 'd': 'Es va renovar el Compromís Ciutadà per la Sostenibilitat a Barcelona'}, 'correcta': ['a', 'd'], 'nivell': 'llegenda', 'feedback': 'Escoles Verdes es va consolidar abans, i la inversió pública va disminuir dràsticament. La desaparició del departament i la renovació del compromís a BCN són fets d\'aquesta etapa.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quins d\'aquests esdeveniments van tenir lloc a la dècada de 1990? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Conferència de Río de Janeiro (1992)', 'b': 'Publicació de l\'Informe Brundtland', 'c': 'Conferència de Tesalònica (1997)', 'd': 'Aprovació de la LOGSE a Espanya (1990)'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'L\'Informe Brundtland és de la dècada anterior (1987). Els altres tres esdeveniments van marcar la dècada dels 90.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quins dels següents són principis de l\'Educació Ambiental esmentats al text? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Implicar només els experts', 'b': 'Potenciar un pensament crític', 'c': 'Desenvolupar una acció educativa coherent', 'd': 'Promoure la participació'}, 'correcta': ['b', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'L\'EA ha d\'implicar a tota la societat, no només als experts. La resta són principis fonamentals.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Les tres vessants claus interconnectades de l\'Educació per al Desenvolupament Sostenible (EDS) són... (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Societat', 'b': 'Tecnologia', 'c': 'Economia', 'd': 'Medi Ambient'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'La tecnologia és una eina, però les tres vessants fonamentals que l\'EDS busca equilibrar són la social, l\'econòmica i l\'ambiental.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quines de les següents són finalitats de l\'EA relacionades amb l\'adquisició i ús de coneixement? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Promoure valors proambientals (VALORS)', 'b': 'Entendre millor els processos ambientals (COMPRENSIÓ)', 'c': 'Estimular la participació activa (PARTICIPACIÓ ACTIVA)', 'd': 'Ensenyar a analitzar críticament informació (ANÀLISI CRÍTICA)'}, 'correcta': ['b', 'd'], 'nivell': 'llegenda', 'feedback': 'Els valors i la participació són finalitats relacionades amb l\'actitud i l\'acció. La comprensió i l\'anàlisi crítica es refereixen directament al coneixement.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quines d\'aquestes grans catàstrofes ambientals van ocórrer a la dècada de 1980? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Bhopal (1984)', 'b': 'Prestige (2002)', 'c': 'Txernòbil (1986)', 'd': 'Exxon Valdez (1989)'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'El desastre del Prestige va ser al segle XXI. Bhopal, Txernòbil i l\'Exxon Valdez van ser tres grans catàstrofes que van marcar la dècada dels 80.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quins dels següents són escenaris per a l\'EA on el Llibre Blanc (LBEA) fa recomanacions específiques? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Empreses', 'b': 'Administració Pública', 'c': 'Nacions Unides', 'd': 'Sistema Educatiu'}, 'correcta': ['a', 'b', 'd'], 'nivell': 'llegenda', 'feedback': 'El Llibre Blanc se centra en l\'àmbit espanyol i fa recomanacions per a l\'administració, les empreses, el sistema educatiu i la comunitat, però no directament a organismes internacionals com l\'ONU.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'Quines d\'aquestes afirmacions sobre l\'etapa de "Generalització i oficialització" (anys 90) a Catalunya són CERTES? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Es va crear la Societat Catalana d\'EA (SCEA)', 'b': 'La Diputació de Barcelona va crear la Xarxa de Ciutats i Pobles per la Sostenibilitat', 'c': 'Va desaparèixer el Departament de Medi Ambient', 'd': 'Es va crear la Direcció General d\'EA dins del Departament de Medi Ambient'}, 'correcta': ['a', 'b', 'd'], 'nivell': 'llegenda', 'feedback': 'La desaparició del Departament de Medi Ambient va ser molt posterior, l\'any 2010. Les altres tres fites van ser clau en la consolidació de l\'EA durant els anys 90.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Els destinataris de l\'Educació Ambiental són... (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Només els nens i nenes a l\'escola', 'b': 'Totes les persones, de totes les generacions i condicions', 'c': 'Els ciutadans a través de l\'educació formal, no formal i informal', 'd': 'Només els polítics i directius d\'empreses'}, 'correcta': ['b', 'c'], 'nivell': 'llegenda', 'feedback': 'L\'EA interpel·la a tota la societat sense excepció, a través de tots els canals possibles (formal, no formal i informal). No es limita a un sol grup d\'edat o professional.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quins d\'aquests principis de l\'EA estan directament relacionats amb la necessitat de col·laboració? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Implicar a tota la societat (responsabilitat compartida)', 'b': 'Potenciar un pensament crític', 'c': 'Facilitar la coordinació i col·laboració entre agents socials', 'd': 'Desenvolupar una acció educativa coherent'}, 'correcta': ['a', 'c'], 'nivell': 'llegenda', 'feedback': 'El pensament crític i la coherència són principis més individuals o pedagògics, mentre que la responsabilitat compartida i la coordinació entre agents apel·len directament al treball en xarxa i la col·laboració.', 'ambit': 'Conceptes Fonamentals'},
    {'pregunta': 'Quines de les següents fites internacionals són posteriors a la Cimera de la Terra de Río (1992)? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Conferència de Tbilissi (1977)', 'b': 'Protocol de Kyoto (1997)', 'c': 'Conferència de Tesalònica (1997)', 'd': 'Assemblea General de l\'ONU amb l\'Agenda 2030 (2015)'}, 'correcta': ['b', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'Tbilissi és molt anterior a Río. En canvi, Kyoto, Tesalònica i l\'Agenda 2030 van ser passos posteriors en l\'evolució del discurs ambiental i de la sostenibilitat.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quins dels següents són objectius de l\'EA no formal? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Conscienciar sobre problemes ambientals', 'b': 'Obtenir una titulació universitària', 'c': 'Fomentar actituds i valors de respecte al medi', 'd': 'Impulsar la participació activa en projectes'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'L\'obtenció de titulacions oficials és pròpia de l\'educació formal. La no formal se centra en la conscienciació, els valors i la participació.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'La justificació del Llibre Blanc de l\'EA a Espanya connecta problemes ambientals i socials. Quins d\'aquests problemes socials s\'esmenten? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'El forat a la capa d\'ozó', 'b': 'La pobresa', 'c': 'El repartiment injust de la pobresa', 'd': 'La desigualtat en les relacions entre pobles'}, 'correcta': ['b', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'El forat a la capa d\'ozó és un problema ambiental. La pobresa, la seva distribució injusta i les desigualtats entre pobles són els problemes socials que el document connecta amb la crisi ecològica.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'Quines de les següents afirmacions diferencien correctament l\'educació no formal de la informal? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'La no formal és organitzada i planificada, la informal no', 'b': 'La informal es dona a l\'escola, la no formal fora', 'c': 'La no formal té lloc en cursos o tallers, la informal en la vida diària', 'd': 'La informal sempre condueix a un certificat, la no formal mai'}, 'correcta': ['a', 'c'], 'nivell': 'llegenda', 'feedback': 'La clau és la planificació: la no formal és intencionada (cursos, tallers) mentre que la informal és espontània (vida quotidiana). L\'educació formal és la que es dona a l\'escola i sol donar certificats.', 'ambit': 'Tipus d\'Educació'},
    {'pregunta': 'El perfil d\'un educador/a ambiental ha de combinar... (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Coneixements ambientals', 'b': 'Habilitats socials', 'c': 'Una gran fortuna personal', 'd': 'Recursos pedagògics'}, 'correcta': ['a', 'b', 'd'], 'nivell': 'llegenda', 'feedback': 'L\'educador/a ambiental és un professional que necessita coneixements de la matèria, habilitat per tractar amb persones i eines per ensenyar eficaçment.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Quines d\'aquestes fites corresponen a l\'etapa de "Maduració" (1998-2008) de l\'EA a Catalunya? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Aparició del programa Escoles Verdes', 'b': 'Inauguració del CENEAM', 'c': 'Celebració del Fòrum 2000 de la SCEA', 'd': 'Impuls de les Agendes 21 locals'}, 'correcta': ['a', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'El CENEAM es va inaugurar als anys 80 a nivell estatal. La resta d\'iniciatives són clau per entendre la consolidació i maduració de l\'EA a Catalunya en aquella dècada.', 'ambit': 'Història i Fites'},
    {'pregunta': 'Quines de les següents són recomanacions del LBEA per a les empreses? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Ignorar la normativa ambiental per ser més competitius', 'b': 'Integrar l\'EA a les polítiques empresarials', 'c': 'Patrocinar i participar en programes d\'EA', 'd': 'Fomentar la participació dels treballadors'}, 'correcta': ['b', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'El Llibre Blanc proposa que les empreses adoptin un rol proactiu, integrant la sostenibilitat a la seva estratègia i implicant-hi a la seva plantilla.', 'ambit': 'Polítiques i Acords'},
    {'pregunta': 'Quins d\'aquests són escenaris d\'intervenció de l\'EA? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'La comunitat general i la ciutadania', 'b': 'Les associacions', 'c': 'L\'administració pública', 'd': 'El sistema educatiu i les empreses'}, 'correcta': ['a', 'b', 'c', 'd'], 'nivell': 'llegenda', 'feedback': 'Correcte, totes les opcions són escenaris clau on l\'Educació Ambiental ha d\'intervenir per aconseguir un canvi real i profund.', 'ambit': 'Actors i Instruments'},
    {'pregunta': 'Quines d\'aquestes fites històriques van tenir un paper clau en l\'eclosió de la consciència ambiental abans de 1975? (Selecciona TOTES les correctes)', 'tipus': 'multiple', 'opcions': {'a': 'Creació de la IUCN (1948)', 'b': 'Publicació de "Primavera Silenciosa" (1962)', 'c': 'Informe "Els límits del creixement" (1972)', 'd': 'Aprovació de l\'Agenda 2030'}, 'correcta': ['a', 'b', 'c'], 'nivell': 'llegenda', 'feedback': 'L\'Agenda 2030 és molt recent (2015). Les altres tres fites van ser fonamentals en la primera onada de conscienciació ambiental global durant el segle XX.', 'ambit': 'Història i Fites'},
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
import streamlit as st
import random, math, time
from streamlit.components.v1 import html

# --- FUNCIONS AUXILIARS ---

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
    st.session_state.estat_joc = 'jugant'
    st.rerun()

def comprovar_resposta_multiple(respostes_usuari, respostes_correctes):
    return sorted(respostes_usuari) == sorted(respostes_correctes)

def anar_a_seleccio():
    for key in ['preguntes', 'guanys_sessio', 'pregunta_actual_idx', 'resposta_enviada',
                'resposta_correcta', 'session_correctes', 'session_performance_ambit']:
        st.session_state.pop(key, None)
    st.session_state.estat_joc = 'seleccion_nivell'
    st.rerun()

def calcular_multiplicador_total():
    multiplicador = 1.0
    for hab_id in st.session_state.get('habilitats_comprades', []):
        habilitat = next((h for h in VIDA['habilitats'] if h['id'] == hab_id), None)
        if habilitat: multiplicador *= habilitat['multiplicador']
    return multiplicador

# --- ESTAT INICIAL ---
if 'estat_joc' not in st.session_state:
    st.session_state.estat_joc = 'seleccion_nivell'
    st.session_state.ecos = 10
    st.session_state.nivells_desbloquejats = ['principiant']
    st.session_state.base_avatar_idx = 0
    st.session_state.skin_tone_idx = 2
    st.session_state.professions_idx = 0
    st.session_state.casa_idx = 0
    st.session_state.vehicle_idx = 0
    st.session_state.habilitats_comprades = []
    st.session_state.stats = {
        'total_preguntes': 0, 'total_correctes': 0, 'total_guanyat': 0,
        'total_perdut': 0, 'rendiment_ambit': {}
    }

# --- LÒGICA PRINCIPAL ---
if st.session_state.estat_joc == 'seleccion_nivell':
    st.title("🎓 Borsa del Saber")
    st.header("Selecciona un examen per posar a prova els teus coneixements")

    st.metric("El teu Saldo Actual", f"{st.session_state.ecos} ECO$")
    st.markdown("---")

    COSTOS_NIVELL = {'principiant': 0, 'avançat': 1000, 'expert': 5000, 'llegenda': 20000}
    nivells_info = {
        'principiant': ("🌱 Mercat Emergent", "Inversions segures. 10 preguntes fonamentals."),
        'avançat': ("🧠 Mercat Consolidat", "Major risc i recompensa."),
        'expert': ("🔥 Alt Risc", "Volatilitat màxima. Preguntes complexes."),
        'llegenda': ("👑 Fons d'Inversió", "El repte final amb múltiples respostes.")
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
                            st.toast(f"Has desbloquejat '{titol}'!", icon="🎉")
                            st.rerun()
                        else:
                            st.warning("No tens suficients ECO$!")

    st.markdown("---")
    if st.button("🛍️ Anar a la Botiga de Millores", use_container_width=True):
        st.session_state.estat_joc = 'botiga'
        st.rerun()

elif st.session_state.estat_joc == 'jugant':
    if 'preguntes' not in st.session_state or st.session_state.pregunta_actual_idx >= len(st.session_state.preguntes):
        st.session_state.estat_joc = 'resultats'
        st.rerun()

    pregunta_actual = st.session_state.preguntes[st.session_state.pregunta_actual_idx]

    guanys = st.session_state.get('guanys_sessio', 0)
    color = "#34d399" if guanys >= 0 else "#f87171"
    st.markdown(f"""
        <div style='text-align:center;margin-bottom:10px'>
        <p style='font-size:1.5rem;opacity:0.7;'>Balanç de l'Examen</p>
        <p style='font-size:5rem;font-weight:600;color:{color};line-height:1;'>{guanys} ECO$</p>
        </div>
    """, unsafe_allow_html=True)

    st.progress(st.session_state.pregunta_actual_idx / len(st.session_state.preguntes),
                text=f"Pregunta {st.session_state.pregunta_actual_idx + 1} de 10")

    if not st.session_state.get('resposta_enviada', False):
        key_timer = f"timer_start_{st.session_state.pregunta_actual_idx}"
        if key_timer not in st.session_state:
            st.session_state[key_timer] = time.time()
        start_time = st.session_state[key_timer]
        html(f"""
        <h1 id="timer-display" style='text-align:center;color:#34d399;font-size:4rem;'></h1>
        <script>
        const s={start_time};
        function u(){{let e=document.getElementById("timer-display");if(!e)return;
        let t=Math.max(0,100-Math.floor(((Date.now()/1000)-s)*5));
        e.textContent=`+${{t}} ECO$`;if(t<=0)clearInterval(window.ti);}}
        clearInterval(window.ti);window.ti=setInterval(u,200);u();
        </script>
        """, height=80)

    with st.container(border=True):
        st.markdown(f"#### {pregunta_actual['pregunta']}")
        disabled = st.session_state.get('resposta_enviada', False)
        if pregunta_actual['tipus'] == 'opcions':
            st.radio("Tria la teva inversió:", options=pregunta_actual['opcions'].keys(),
                     format_func=lambda k: f"{k.upper()}) {pregunta_actual['opcions'][k]}",
                     index=None, key="widget", disabled=disabled)
        else:
            st.multiselect("Selecciona TOTES les correctes:", options=pregunta_actual['opcions'].keys(),
                           format_func=lambda k: f"{k.upper()}) {pregunta_actual['opcions'][k]}",
                           key="widget", disabled=disabled)

    if st.session_state.get('resposta_enviada', False):
        if st.session_state.get('resposta_correcta', False):
            st.success("✅ Resposta Correcta!")
        else:
            st.error("❌ Resposta Incorrecta! Has perdut 50 ECO$.")
        st.info(f"💡 **Anàlisi:** {pregunta_actual['feedback']}")
        if st.button("Següent Pregunta →", use_container_width=True):
            st.session_state.pregunta_actual_idx += 1
            st.session_state.resposta_enviada = False
            st.session_state.pop('resposta_correcta', None)
            if st.session_state.pregunta_actual_idx >= 10:
                st.session_state.estat_joc = 'resultats'
            st.rerun()
    else:
        if st.button("Confirmar Resposta", use_container_width=True):
            resposta = st.session_state.get("widget")
            if not resposta:
                st.warning("Has de seleccionar una opció.")
            else:
                correcta = (
                    (pregunta_actual['tipus'] == 'opcions' and resposta == pregunta_actual['correcta']) or
                    (pregunta_actual['tipus'] == 'multiple' and
                     comprovar_resposta_multiple(resposta, pregunta_actual['correcta']))
                )
                temps = time.time() - st.session_state.get(f"timer_start_{st.session_state.pregunta_actual_idx}", time.time())
                ambit = pregunta_actual.get('ambit', 'General')
                st.session_state.stats['total_preguntes'] += 1
                st.session_state.stats['rendiment_ambit'].setdefault(ambit, {'correctes': 0, 'total': 0})
                st.session_state.stats['rendiment_ambit'][ambit]['total'] += 1

                if correcta:
                    st.session_state.session_correctes += 1
                    valor_final = max(0, 100 - (temps * 5))
                    guany = math.ceil(valor_final * calcular_multiplicador_total())
                    st.session_state.guanys_sessio += guany
                    st.session_state.stats['total_correctes'] += 1
                    st.session_state.stats['rendiment_ambit'][ambit]['correctes'] += 1
                    st.session_state.stats['total_guanyat'] += guany
                else:
                    penalitzacio = 50
                    st.session_state.guanys_sessio -= penalitzacio
                    st.session_state.stats['total_perdut'] += penalitzacio

                st.session_state.resposta_correcta = correcta
                st.session_state.resposta_enviada = True
                st.rerun()

elif st.session_state.estat_joc == 'resultats':
    session_earnings = st.session_state.get('guanys_sessio', 0)
    st.session_state.ecos += session_earnings
    st.session_state.pop('guanys_sessio', None)

    st.title("📊 Resultats de l'Examen")
    if session_earnings > 0:
        st.balloons()
        st.success(f"Has guanyat {session_earnings} ECO$.")
    else:
        st.error(f"Has perdut {abs(session_earnings)} ECO$.")
    correctes = st.session_state.get('session_correctes', 0)
    col1, col2, col3 = st.columns(3)
    col1.metric("Balanç Sessió", f"{session_earnings} ECO$")
    col2.metric("Correctes", f"{correctes}/10")
    col3.metric("Precisió", f"{(correctes / 10) * 100:.0f}%")

    st.markdown("---")
    st.header("Rendiment per Àmbit")
    performance = st.session_state.get('session_performance_ambit', {})
    if not performance:
        st.info("No hi ha dades de rendiment.")
    else:
        for ambit, dades in performance.items():
            percent = dades['correctes'] / dades['total'] if dades['total'] > 0 else 0
            st.write(f"**{ambit}:** {dades['correctes']} de {dades['total']} correctes")
            st.progress(percent)

    st.markdown("---")
    col_btn1, col_btn2 = st.columns(2)
    if col_btn1.button("Tornar a Jugar", use_container_width=True):
        anar_a_seleccio()
    if col_btn2.button("Anar a la Botiga", use_container_width=True):
        anar_a_seleccio()
        st.session_state.estat_joc = 'botiga'
        st.rerun()



