import streamlit as st
import time
import random
import pandas as pd
import altair as alt
from collections import deque

# --- CONFIGURACIÓ DE PÀGINA INICIAL ---
st.set_page_config(page_title="Terra-Expert", page_icon="🌍", layout="wide")

# --- ESTRUCTURES DE DADES DEL JOC ---

# 1. Pla de Carrera Professional en Edafologia
CERTIFICACIONS_INFO = [
    {"id": 1, "nom": "Introducció a l'Edafologia", "cost": 0, "nivell_dificultat": 1, "icon": "🕵️‍♂️"},
    {"id": 2, "nom": "Certificat en Perfils Edàfics", "cost": 450, "nivell_dificultat": 2, "icon": "🏞️"},
    {"id": 3, "nom": "Diploma en Propietats Físiques", "cost": 1200, "nivell_dificultat": 3, "icon": "🔬"},
    {"id": 4, "nom": "Avançat en Química del Sòl", "cost": 2800, "nivell_dificultat": 4, "icon": "🧪"},
    {"id": 5, "nom": "Màster en Edafogènesi", "cost": 5500, "nivell_dificultat": 5, "icon": "🌋"},
    {"id": 6, "nom": "Postgrau en Cicles Biogeoquímics", "cost": 9000, "nivell_dificultat": 6, "icon": "👑"},
]

# 2. Tenda de Millores Permanents (Multiplicadors)
POTENCIADORS_TENDA = [
    {"nivell": 1, "nom": "Mètodes d'Estudi Bàsics", "cost": 300, "multiplicador": 1.05},
    {"nivell": 2, "nom": "Equip de Camp Millorat", "cost": 500, "multiplicador": 1.10},
    {"nivell": 3, "nom": "Lupa de Geòleg Digital", "cost": 800, "multiplicador": 1.20},
    {"nivell": 4, "nom": "Programari d'Anàlisi de Dades", "cost": 1250, "multiplicador": 1.35},
    {"nivell": 5, "nom": "Kit de Proves Químiques Ràpides", "cost": 2000, "multiplicador": 1.50},
    {"nivell": 6, "nom": "Accés a Journals Científics", "cost": 3500, "multiplicador": 1.75},
    {"nivell": 7, "nom": "Microscopi Electrònic", "cost": 5500, "multiplicador": 2.00},
    {"nivell": 8, "nom": "Laboratori Personal", "cost": 8000, "multiplicador": 2.50},
    {"nivell": 9, "nom": "Subvenció d'Investigació Nacional", "cost": 12000, "multiplicador": 3.00},
    {"nivell": 10, "nom": "Premi Nobel d'Edafologia", "cost": 25000, "multiplicador": 5.00},
]


# 3. BANC DE PREGUNTES COMPLET (+80)
PREGUNTES_EDAFOLOGIA = [
    # --- NIVELL 1 (Introducció a l'Edafologia) ---
    # Categoria: Conceptes Bàsics
    {"pregunta": "Què estudia principalment l'edafologia?", "opcions": ["Les roques", "El sòl des de tots els punts de vista", "El clima", "Els rius"], "resposta_correcta": "El sòl des de tots els punts de vista", "gc_guany": 25, "gc_perdua": 10, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "El sòl es considera la capa... de la superfície terrestre.", "opcions": ["Inferior", "Intermèdia", "Superior", "Interna"], "resposta_correcta": "Superior", "gc_guany": 20, "gc_perdua": 5, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "Quin percentatge aproximat del sòl està format per materials minerals?", "opcions": ["5%", "25%", "45%", "90%"], "resposta_correcta": "45%", "gc_guany": 30, "gc_perdua": 15, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "Aproximadament, quin percentatge del volum d'un sòl ideal hauria de ser espai porós (ocupat per aire i aigua)?", "opcions": ["10%", "25%", "50%", "80%"], "resposta_correcta": "50%", "gc_guany": 30, "gc_perdua": 15, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "Com s'anomena la ciència que estudia el sòl des del punt de vista de la seva classificació, origen i morfologia?", "opcions": ["Geologia", "Edafologia", "Hidrologia", "Ecologia"], "resposta_correcta": "Edafologia", "gc_guany": 25, "gc_perdua": 10, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "La matèria orgànica en un sòl sa representa aproximadament un...", "opcions": ["<1%", "5%", "15%", "25%"], "resposta_correcta": "5%", "gc_guany": 30, "gc_perdua": 15, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "Quins són els quatre components principals del sòl?", "opcions": ["Roques, plantes, animals, sol", "Matèria mineral, matèria orgànica, aigua, aire", "Sorra, llim, argila, humus", "Nitrogen, fòsfor, potassi, aigua"], "resposta_correcta": "Matèria mineral, matèria orgànica, aigua, aire", "gc_guany": 30, "gc_perdua": 15, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "De quin procés es forma principalment el sòl?", "opcions": ["Sedimentació marina", "Activitat volcànica", "Meteorització de les roques", "Compactació per glaceres"], "resposta_correcta": "Meteorització de les roques", "gc_guany": 30, "gc_perdua": 15, "dificultat": 1, "categoria": "Edafogènesi"},
    
    # Categoria: Funcions del Sòl
    {"pregunta": "Quina de les següents NO és una funció principal del sòl en els ecosistemes?", "opcions": ["Medi per al creixement de les plantes", "Generador de llum solar", "Hàbitat per a organismes", "Sistema de reciclatge de matèria orgànica"], "resposta_correcta": "Generador de llum solar", "gc_guany": 25, "gc_perdua": 10, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "Com actua el sòl respecte a l'aigua?", "opcions": ["La repel·leix sempre", "Com un medi regulador del seu subministrament", "Només l'evapora", "La congela a la superfície"], "resposta_correcta": "Com un medi regulador del seu subministrament", "gc_guany": 25, "gc_perdua": 10, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "Per què és el sòl un 'sistema de reciclatge'?", "opcions": ["Perquè transforma plàstics en terra", "Perquè descompon la matèria orgànica en nutrients", "Perquè crea nous minerals", "Perquè genera aigua potable"], "resposta_correcta": "Perquè descompon la matèria orgànica en nutrients", "gc_guany": 30, "gc_perdua": 15, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "Quina funció compleix el sòl per a insectes, bacteris i fongs?", "opcions": ["És una font d'energia lumínica", "És un medi de transport ràpid", "És el seu hàbitat", "És una barrera impenetrable"], "resposta_correcta": "És el seu hàbitat", "gc_guany": 25, "gc_perdua": 10, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "El sòl serveix com a medi per al creixement de les plantes principalment perquè...", "opcions": ["Les protegeix del vent", "Els proporciona suport físic, aigua i nutrients", "Els dona calor durant la nit", "Accelera la fotosíntesi"], "resposta_correcta": "Els proporciona suport físic, aigua i nutrients", "gc_guany": 30, "gc_perdua": 15, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "Quina funció té el sòl relacionada amb la construcció?", "opcions": ["Genera materials de construcció com el ciment", "Serveix com a base per a edificis i infraestructures", "Purifica l'aire dels edificis", "No té cap funció en la construcció"], "resposta_correcta": "Serveix com a base per a edificis i infraestructures", "gc_guany": 25, "gc_perdua": 10, "dificultat": 1, "categoria": "Funcions del Sòl"},
    {"pregunta": "La capacitat del sòl de filtrar i netejar l'aigua que passa a través seu es coneix com a funció...", "opcions": ["Estructural", "Depuradora", "Agrícola", "Climàtica"], "resposta_correcta": "Depuradora", "gc_guany": 30, "gc_perdua": 15, "dificultat": 1, "categoria": "Funcions del Sòl"},
    # ... (afegir més preguntes de nivell 1 fins a aprox. 50)
    {"pregunta": "L'aire del sòl és crucial per a...", "opcions": ["La respiració de les arrels i els microorganismes", "Mantenir el sòl fred", "Dissoldre les roques", "Crear pressió"], "resposta_correcta": "La respiració de les arrels i els microorganismes", "gc_guany": 25, "gc_perdua": 10, "dificultat": 1, "categoria": "Conceptes Bàsics"},
    {"pregunta": "Què passaria si no existís el sòl?", "opcions": ["No hi hauria núvols", "La vida terrestre, tal com la coneixem, no seria possible", "Els oceans s'evaporarien", "La lluna xocaria amb la Terra"], "resposta_correcta": "La vida terrestre, tal com la coneixem, no seria possible", "gc_guany": 25, "gc_perdua": 10, "dificultat": 1, "categoria": "Funcions del Sòl"},


    # --- NIVELL 2 (Perfils Edàfics) ---
    # Categoria: Horitzons
    {"pregunta": "Quin horitzó del sòl està constituït principalment per fullaraca i restes orgàniques sense transformar?", "opcions": ["Horitzó A", "Horitzó B", "Horitzó O", "Horitzó C"], "resposta_correcta": "Horitzó O", "gc_guany": 40, "gc_perdua": 20, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "L'horitzó A, o de rentatge, és especialment ric en...", "opcions": ["Fragments de roca mare", "Argila pura", "Humus i matèria orgànica", "Carbonat càlcic"], "resposta_correcta": "Humus i matèria orgànica", "gc_guany": 45, "gc_perdua": 20, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "Quin horitzó es coneix com a 'subsòl' i està format per fragments meteoritzats de la roca mare?", "opcions": ["Horitzó R", "Horitzó A", "Horitzó B", "Horitzó C"], "resposta_correcta": "Horitzó C", "gc_guany": 40, "gc_perdua": 20, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "La roca mare no alterada es designa com a...", "opcions": ["Horitzó A", "Horitzó C", "Horitzó R", "Horitzó O"], "resposta_correcta": "Horitzó R", "gc_guany": 35, "gc_perdua": 15, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "Un horitzó de transició amb característiques intermèdies entre A i B s'anomenaria...", "opcions": ["Horitzó A/B", "Horitzó C", "Horitzó AB", "Horitzó BA"], "resposta_correcta": "Horitzó AB", "gc_guany": 45, "gc_perdua": 25, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "L'horitzó B, o de precipitació, es caracteritza per una acumulació de...", "opcions": ["Humus", "Restes de fulles", "Substàncies minerals com argila i òxids de Fe", "Roca sense alterar"], "resposta_correcta": "Substàncies minerals com argila i òxids de Fe", "gc_guany": 50, "gc_perdua": 25, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "Quin color sol tenir l'horitzó A a causa del seu alt contingut en matèria orgànica?", "opcions": ["Blanc brillant", "De gris fosc a negre", "Vermell intens", "Blau verdós"], "resposta_correcta": "De gris fosc a negre", "gc_guany": 45, "gc_perdua": 20, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "En quin tipus de sòl és freqüent trobar un horitzó O ben desenvolupat?", "opcions": ["En deserts", "En sòls cultivats", "En boscos", "En platges"], "resposta_correcta": "En boscos", "gc_guany": 40, "gc_perdua": 20, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "El conjunt de tots els horitzons d'un sòl, des de la superfície fins a la roca mare, s'anomena...", "opcions": ["Textura del sòl", "Perfil del sòl", "Estructura del sòl", "Composició del sòl"], "resposta_correcta": "Perfil del sòl", "gc_guany": 40, "gc_perdua": 20, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "Quin horitzó és generalment absent o molt prim en sòls cultivats durant molt de temps?", "opcions": ["Horitzó B", "Horitzó C", "Horitzó A (i O)", "Horitzó R"], "resposta_correcta": "Horitzó A (i O)", "gc_guany": 50, "gc_perdua": 25, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "Si caves un forat i trobes roca dura que no es pot cavar, has arribat a l'horitzó...", "opcions": ["O", "B", "C", "R"], "resposta_correcta": "R", "gc_guany": 35, "gc_perdua": 15, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "L'eluviació, o pèrdua de materials per rentat, és característica de l'horitzó...", "opcions": ["A", "B", "C", "R"], "resposta_correcta": "A", "gc_guany": 50, "gc_perdua": 25, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "La il·luviació, o acumulació de materials, és característica de l'horitzó...", "opcions": ["O", "A", "B", "R"], "resposta_correcta": "B", "gc_guany": 50, "gc_perdua": 25, "dificultat": 2, "categoria": "Horitzons"},
    # ... (afegir més preguntes de nivell 2 fins a aprox. 50)
    {"pregunta": "En un sòl jove i poc desenvolupat, quins horitzons podrien faltar?", "opcions": ["Només l'horitzó A", "L'horitzó C i R", "L'horitzó O i B", "Cap, tots hi són sempre"], "resposta_correcta": "L'horitzó O i B", "gc_guany": 55, "gc_perdua": 25, "dificultat": 2, "categoria": "Horitzons"},
    {"pregunta": "La lletra 'k' en una designació d'horitzó (Ex: Bk) indica una acumulació de...", "opcions": ["Humus", "Argila", "Carbonats", "Guix"], "resposta_correcta": "Carbonats", "gc_guany": 55, "gc_perdua": 25, "dificultat": 2, "categoria": "Horitzons"},


    # --- NIVELL 3 (Propietats Físiques) ---
    # Categoria: Propietats Físiques
    {"pregunta": "La 'textura' del sòl fa referència a la proporció de...", "opcions": ["Aigua, aire i matèria orgànica", "Sorra, llim i argila", "Roques, minerals i fòssils", "Horitzons O, A i B"], "resposta_correcta": "Sorra, llim i argila", "gc_guany": 60, "gc_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Quina fracció textural té la major capacitat de retenció d'aigua i nutrients?", "opcions": ["Sorra", "Graveta", "Llim", "Argila"], "resposta_correcta": "Argila", "gc_guany": 70, "gc_perdua": 35, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "La 'porositat' del sòl es defineix com el volum de sòl ocupat per...", "opcions": ["Partícules sòlides", "Només aigua", "Forats (aire i aigua)", "Matèria orgànica"], "resposta_correcta": "Forats (aire i aigua)", "gc_guany": 65, "gc_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Un sòl amb partícules de diàmetre entre 2mm i 0,02mm es considera...", "opcions": ["Argilós", "Llimós", "Sorrós", "Rocós"], "resposta_correcta": "Sorrós", "gc_guany": 60, "gc_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "El color fosc o negre d'un sòl generalment indica una alta presència de...", "opcions": ["Quars", "Carbonats", "Matèria orgànica", "Òxids de ferro"], "resposta_correcta": "Matèria orgànica", "gc_guany": 65, "gc_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Les taules Munsell s'utilitzen per determinar de forma estandarditzada...", "opcions": ["El pH del sòl", "La textura del sòl", "El color del sòl", "La porositat del sòl"], "resposta_correcta": "El color del sòl", "gc_guany": 70, "gc_perdua": 35, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Un sòl sorrós té un drenatge...", "opcions": ["Molt lent", "Moderat", "Molt ràpid", "Inexistent"], "resposta_correcta": "Molt ràpid", "gc_guany": 65, "gc_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Què és la 'terra fina' en edafologia?", "opcions": ["Les partícules de diàmetre inferior a 2mm", "Només la fracció d'argila", "El sòl de la capa superficial", "Un tipus d'adob"], "resposta_correcta": "Les partícules de diàmetre inferior a 2mm", "gc_guany": 60, "gc_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "L'estructura 'granular' o 'de molles' és típica de quin horitzó?", "opcions": ["Horitzó B", "Horitzó C", "Horitzó A ric en humus", "Horitzó R"], "resposta_correcta": "Horitzó A ric en humus", "gc_guany": 70, "gc_perdua": 35, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "La densitat 'aparent' del sòl és sempre... que la densitat 'real' de les seves partícules.", "opcions": ["Més gran", "Igual", "Més petita", "El doble"], "resposta_correcta": "Més petita", "gc_guany": 75, "gc_perdua": 40, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Un sòl amb un 33% de sorra, 33% de llim i 34% d'argila té una textura...", "opcions": ["Sorrosa", "Llimosa", "Argilosa", "Franca o equilibrada"], "resposta_correcta": "Franca o equilibrada", "gc_guany": 70, "gc_perdua": 35, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "El color vermellós o groguenc en un sòl sol ser causat per...", "opcions": ["Alts nivells de matèria orgànica", "Òxids de ferro", "Presència de quars", "Excés d'aigua"], "resposta_correcta": "Òxids de ferro", "gc_guany": 65, "gc_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Com s'anomena l'agregació de partícules de sorra, llim i argila en unitats més grans?", "opcions": ["Textura del sòl", "Perfil del sòl", "Estructura del sòl", "Horitzó del sòl"], "resposta_correcta": "Estructura del sòl", "gc_guany": 65, "gc_perdua": 30, "dificultat": 3, "categoria": "Propietats Físiques"},
    {"pregunta": "Quina fracció textural se sent suau i sedosa al tacte, com la farina?", "opcions": ["Sorra", "Grava", "Llim", "Argila"], "resposta_correcta": "Llim", "gc_guany": 70, "gc_perdua": 35, "dificultat": 3, "categoria": "Propietats Físiques"},
    # ... (afegir més preguntes de nivell 3 fins a aprox. 50)
    {"pregunta": "La capacitat de camp es refereix a...", "opcions": ["La quantitat màxima d'aigua que un sòl pot retenir contra la força de la gravetat", "La velocitat a la que l'aigua s'infiltra", "La profunditat de l'horitzó A", "El color del sòl quan està sec"], "resposta_correcta": "La quantitat màxima d'aigua que un sòl pot retenir contra la força de la gravetat", "gc_guany": 75, "gc_perdua": 40, "dificultat": 3, "categoria": "Propietats Físiques"},


    # --- NIVELL 4 (Química del Sòl) ---
    # Categoria: Propietats Químiques
    {"pregunta": "Un interval de pH òptim per a la majoria de les plantes es troba entre...", "opcions": ["4-5", "6-8", "9-10", "2-3"], "resposta_correcta": "6-8", "gc_guany": 80, "gc_perdua": 40, "dificultat": 4, "categoria": "Propietats Químiques"},
    {"pregunta": "La presència de carbonats en un sòl es pot detectar fàcilment al camp afegint...", "opcions": ["Aigua", "Un àcid (com HCl)", "Una base (com NaOH)", "Oli"], "resposta_correcta": "Un àcid (com HCl)", "gc_guany": 85, "gc_perdua": 45, "dificultat": 4, "categoria": "Propietats Químiques"},
    {"pregunta": "Què tendeix a passar amb el pH del sòl a causa de les precipitacions abundants?", "opcions": ["Tendeix a alcalinitzar-se", "No té cap efecte", "Tendeix a acidificar-se", "Es neutralitza sempre a 7"], "resposta_correcta": "Tendeix a acidificar-se", "gc_guany": 80, "gc_perdua": 40, "dificultat": 4, "categoria": "Propietats Químiques"},
    {"pregunta": "Un sòl amb un pH de 8.5 es considera...", "opcions": ["Molt àcid", "Lleugerament àcid", "Neutre", "Alcalí o bàsic"], "resposta_correcta": "Alcalí o bàsic", "gc_guany": 80, "gc_perdua": 40, "dificultat": 4, "categoria": "Propietats Químiques"},
    {"pregunta": "Què mesura la Capacitat d'Intercanvi Catiònic (CIC)?", "opcions": ["La capacitat del sòl per retenir aigua", "La quantitat de matèria orgànica", "La capacitat del sòl per retenir cations amb càrrega positiva (nutrients)", "La resistència del sòl a l'erosió"], "resposta_correcta": "La capacitat del sòl per retenir cations amb càrrega positiva (nutrients)", "gc_guany": 95, "gc_perdua": 50, "dificultat": 4, "categoria": "Propietats Químiques"},
    {"pregunta": "Quins components del sòl tenen més influència en la CIC?", "opcions": ["La sorra i el llim", "L'argila i la matèria orgànica", "L'aigua i l'aire", "Les roques i les graves"], "resposta_correcta": "L'argila i la matèria orgànica", "gc_guany": 90, "gc_perdua": 45, "dificultat": 4, "categoria": "Propietats Químiques"},

    # Categoria: Matèria Orgànica
    {"pregunta": "La matèria orgànica al sòl millora la fertilitat...", "opcions": ["Només física", "Només química", "Només biològica", "Física, química i biològica"], "resposta_correcta": "Física, química i biològica", "gc_guany": 90, "gc_perdua": 45, "dificultat": 4, "categoria": "Matèria Orgànica"},
    {"pregunta": "Com es diu la fracció més estable i descomposta de la matèria orgànica?", "opcions": ["Fullaraca", "Detritus", "Humus", "Biomassa"], "resposta_correcta": "Humus", "gc_guany": 85, "gc_perdua": 45, "dificultat": 4, "categoria": "Matèria Orgànica"},
    {"pregunta": "Com afecta la matèria orgànica a l'estructura del sòl?", "opcions": ["La destrueix, fent el sòl compacte", "No hi té cap efecte", "L'ajuda a agregar-se, millorant la porositat i l'estabilitat", "La converteix en roca"], "resposta_correcta": "L'ajuda a agregar-se, millorant la porositat i l'estabilitat", "gc_guany": 90, "gc_perdua": 45, "dificultat": 4, "categoria": "Matèria Orgànica"},

    # Categoria: Horitzons de diagnòstic
    {"pregunta": "Com s'anomena l'horitzó de diagnòstic superficial, fosc, ric en matèria orgànica i propi de sòls àcids?", "opcions": ["Móllico", "Úmbrico", "Càlcic", "Árgico"], "resposta_correcta": "Úmbrico", "gc_guany": 95, "gc_perdua": 50, "dificultat": 4, "categoria": "Horitzons de diagnòstic"},
    {"pregunta": "Un horitzó Móllico és similar a l'Úmbrico, però es diferencia perquè té...", "opcions": ["Menys matèria orgànica", "Un color més clar", "Una saturació de bases superior al 50% (més fèrtil)", "Més contingut d'argila"], "resposta_correcta": "Una saturació de bases superior al 50% (més fèrtil)", "gc_guany": 100, "gc_perdua": 50, "dificultat": 4, "categoria": "Horitzons de diagnòstic"},
    {"pregunta": "Un horitzó Árgico (Bt) és un horitzó subsuperficial enriquit en...", "opcions": ["Humus", "Carbonats", "Argila il·luvial", "Sorra"], "resposta_correcta": "Argila il·luvial", "gc_guany": 95, "gc_perdua": 50, "dificultat": 4, "categoria": "Horitzons de diagnòstic"},
    {"pregunta": "Un horitzó Càlcic (Bk) es caracteritza per una acumulació de...", "opcions": ["Òxids de ferro", "Matèria orgànica", "Carbonat càlcic secundari", "Sulfat de calci (guix)"], "resposta_correcta": "Carbonat càlcic secundari", "gc_guany": 90, "gc_perdua": 45, "dificultat": 4, "categoria": "Horitzons de diagnòstic"},
    {"pregunta": "L'horitzó de diagnòstic Hístic (H) està format en condicions de...", "opcions": ["Aridesa extrema", "Fred intens", "Saturació per aigua durant llargs períodes", "Activitat volcànica recent"], "resposta_correcta": "Saturació per aigua durant llargs períodes", "gc_guany": 100, "gc_perdua": 50, "dificultat": 4, "categoria": "Horitzons de diagnòstic"},
    # ... (afegir més preguntes de nivell 4 fins a aprox. 50)
    {"pregunta": "Un horitzó Álbico (E) és una capa molt rentada, de colors blanquinosos, a causa de l'eliminació de...", "opcions": ["Només sorra", "Argiles i òxids de ferro", "Matèria orgànica", "Carbonats"], "resposta_correcta": "Argiles i òxids de ferro", "gc_guany": 105, "gc_perdua": 55, "dificultat": 4, "categoria": "Horitzons de diagnòstic"},


    # --- NIVELL 5 (Edafogènesi) ---
    # Categoria: Edafogènesi
    {"pregunta": "El terme 'edafogènesi' es refereix a...", "opcions": ["La classificació dels sòls", "La formació del sòl", "L'erosió del sòl", "L'anàlisi química del sòl"], "resposta_correcta": "La formació del sòl", "gc_guany": 110, "gc_perdua": 55, "dificultat": 5, "categoria": "Edafogènesi"},
    {"pregunta": "Per què es considera el sòl un recurs NO renovable a escala humana?", "opcions": ["Perquè no es pot moure", "Perquè el seu temps de formació és extremadament lent", "Perquè sempre és de color fosc", "Perquè no conté aigua"], "resposta_correcta": "Perquè el seu temps de formació és extremadament lent", "gc_guany": 130, "gc_perdua": 65, "dificultat": 5, "categoria": "Edafogènesi"},
    {"pregunta": "Un sòl format 'in situ' a partir de l'alteració de la roca que té a sota s'anomena...", "opcions": ["Sòl al·lòcton", "Sòl transportat", "Sòl autòcton", "Sòl col·luvial"], "resposta_correcta": "Sòl autòcton", "gc_guany": 125, "gc_perdua": 60, "dificultat": 5, "categoria": "Edafogènesi"},
    {"pregunta": "Com s'anomenen els sòls formats amb materials provinents d'altres llocs, transportats per aigua, vent o gel?", "opcions": ["Sòls residuals", "Sòls autòctons", "Sòls al·lòctons", "Sòls primaris"], "resposta_correcta": "Sòls al·lòctons", "gc_guany": 125, "gc_perdua": 60, "dificultat": 5, "categoria": "Edafogènesi"},
    
    # Categoria: Factors de Formació
    {"pregunta": "Quin factor de formació del sòl influeix sobre la velocitat de les reaccions químiques i l'activitat biològica?", "opcions": ["El temps", "La roca mare", "El clima (temperatura i precipitació)", "La topografia"], "resposta_correcta": "El clima (temperatura i precipitació)", "gc_guany": 115, "gc_perdua": 55, "dificultat": 5, "categoria": "Factors de Formació"},
    {"pregunta": "Com afecta la topografia (el pendent) a la formació del sòl?", "opcions": ["No hi afecta", "En pendents forts, l'erosió supera la formació, creant sòls prims", "En pendents forts es formen sòls més profunds", "Només afecta el color del sòl"], "resposta_correcta": "En pendents forts, l'erosió supera la formació, creant sòls prims", "gc_guany": 120, "gc_perdua": 60, "dificultat": 5, "categoria": "Factors de Formació"},
    {"pregunta": "La 'roca mare' és un factor crucial perquè determina principalment...", "opcions": ["La quantitat de pluja", "La composició mineral inicial del sòl", "El tipus de plantes que hi creixeran", "L'edat del sòl"], "resposta_correcta": "La composició mineral inicial del sòl", "gc_guany": 115, "gc_perdua": 55, "dificultat": 5, "categoria": "Factors de Formació"},
    {"pregunta": "Com contribueixen els organismes (plantes, animals, microbis) a la formació del sòl?", "opcions": ["Només extraient nutrients", "Només compactant el terra", "Aportant matèria orgànica, airejant i meteoritzant la roca", "No hi contribueixen activament"], "resposta_correcta": "Aportant matèria orgànica, airejant i meteoritzant la roca", "gc_guany": 120, "gc_perdua": 60, "dificultat": 5, "categoria": "Factors de Formació"},
    {"pregunta": "Quin factor explica per què sòls formats sobre la mateixa roca mare poden ser molt diferents en climes diferents?", "opcions": ["El temps", "Els organismes", "El clima", "La topografia"], "resposta_correcta": "El clima", "gc_guany": 115, "gc_perdua": 55, "dificultat": 5, "categoria": "Factors de Formació"},

    # Categoria: Meteorització
    {"pregunta": "La fragmentació d'una roca per l'acció del gel que es forma a les esquerdes s'anomena...", "opcions": ["Hidròlisi", "Oxidació", "Gelifracció (meteorització física)", "Carbonatació"], "resposta_correcta": "Gelifracció (meteorització física)", "gc_guany": 120, "gc_perdua": 60, "dificultat": 5, "categoria": "Meteorització"},
    {"pregunta": "La descomposició química de minerals per reacció amb l'aigua es coneix com a...", "opcions": ["Termoclàstia", "Hidròlisi", "Gelifracció", "Abrasió"], "resposta_correcta": "Hidròlisi", "gc_guany": 125, "gc_perdua": 65, "dificultat": 5, "categoria": "Meteorització"},
    {"pregunta": "Quin tipus de meteorització és dominant en climes desèrtics amb grans oscil·lacions de temperatura diàries?", "opcions": ["Meteorització biològica per arrels", "Hidròlisi intensa", "Termoclàstia (dilatació i contracció tèrmica)", "Gelifracció"], "resposta_correcta": "Termoclàstia (dilatació i contracció tèrmica)", "gc_guany": 130, "gc_perdua": 65, "dificultat": 5, "categoria": "Meteorització"},
    {"pregunta": "La reacció de l'oxigen amb minerals, especialment els que contenen ferro, s'anomena...", "opcions": ["Carbonatació", "Oxidació", "Dissolució", "Hidratació"], "resposta_correcta": "Oxidació", "gc_guany": 120, "gc_perdua": 60, "dificultat": 5, "categoria": "Meteorització"},
    {"pregunta": "L'acció de les arrels de les plantes que creixen a les fissures de les roques és un exemple de meteorització...", "opcions": ["Química", "Física", "Biològica", "Atmosfèrica"], "resposta_correcta": "Biològica", "gc_guany": 115, "gc_perdua": 55, "dificultat": 5, "categoria": "Meteorització"},
    # ... (afegir més preguntes de nivell 5 fins a aprox. 50)
    {"pregunta": "El procés on l'aigua dissol completament un mineral, com la sal gemma, es diu...", "opcions": ["Hidròlisi", "Oxidació", "Dissolució", "Carbonatació"], "resposta_correcta": "Dissolució", "gc_guany": 125, "gc_perdua": 60, "dificultat": 5, "categoria": "Meteorització"},


    # --- NIVELL 6 (Cicles Biogeoquímics) ---
    # Categoria: Cicles Biogeoquímics
    {"pregunta": "En el cicle del nitrogen, la conversió de nitrogen gas (N₂) en amoníac (NH₃) o nitrats (NO₃⁻) es diu...", "opcions": ["Nitrificació", "Desnitrificació", "Fixació", "Amonificació"], "resposta_correcta": "Fixació", "gc_guany": 150, "gc_perdua": 75, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "Quin element, essencial per la vida, abunda en minerals i la seva principal via d'entrada a l'ecosistema és l'erosió de les roques?", "opcions": ["Carboni", "Nitrogen", "Fòsfor", "Sofre"], "resposta_correcta": "Fòsfor", "gc_guany": 160, "gc_perdua": 80, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "La 'desnitrificació' és el procés on els nitrats es redueixen a...", "opcions": ["Amoni (NH₄⁺)", "Nitrogen gas (N₂)", "Nitrit (NO₂⁻)", "Matèria orgànica"], "resposta_correcta": "Nitrogen gas (N₂)", "gc_guany": 155, "gc_perdua": 75, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "La fotosíntesi i la respiració són processos clau en el cicle del...", "opcions": ["Fòsfor", "Aigua", "Carboni", "Sofre"], "resposta_correcta": "Carboni", "gc_guany": 140, "gc_perdua": 70, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "Com es diu el procés on els bacteris del sòl converteixen nitrogen orgànic (de cadàvers) en amoni?", "opcions": ["Assimilació", "Amonificació o mineralització", "Nitrificació", "Fixació"], "resposta_correcta": "Amonificació o mineralització", "gc_guany": 165, "gc_perdua": 80, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "La 'nitrificació' és un procés en dues etapes que converteix...", "opcions": ["Nitrats en N₂", "Amoni en nitrats", "N₂ en amoni", "Nitrats en amoni"], "resposta_correcta": "Amoni en nitrats", "gc_guany": 160, "gc_perdua": 80, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "Quin és el principal reservori de carboni al planeta?", "opcions": ["L'atmosfera", "Els boscos", "Els oceans i les roques sedimentàries", "La biomassa animal"], "resposta_correcta": "Els oceans i les roques sedimentàries", "gc_guany": 150, "gc_perdua": 75, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "Com afecta l'ús excessiu de fertilitzants nitrogenats als ecosistemes aquàtics?", "opcions": ["Els purifica", "Pot causar eutrofització (proliferació d'algues)", "Augmenta la quantitat de peixos", "Fa l'aigua més salada"], "resposta_correcta": "Pot causar eutrofització (proliferació d'algues)", "gc_guany": 170, "gc_perdua": 85, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "Per què el cicle del fòsfor és considerablement més lent que el del carboni o nitrogen?", "opcions": ["Perquè el fòsfor és un gas pesat", "Perquè no té una fase gasosa atmosfèrica important i depèn de l'erosió", "Perquè només el fan servir les plantes", "Perquè es destrueix amb la llum solar"], "resposta_correcta": "Perquè no té una fase gasosa atmosfèrica important i depèn de l'erosió", "gc_guany": 175, "gc_perdua": 90, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "La combustió de combustibles fòssils allibera grans quantitats de diòxid de sofre (SO₂) que pot causar...", "opcions": ["Un augment de la fertilitat del sòl", "Pluja àcida", "Un refredament global", "Una millora de la qualitat de l'aire"], "resposta_correcta": "Pluja àcida", "gc_guany": 160, "gc_perdua": 80, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "L'absorció de nutrients com el nitrat per part de les arrels de les plantes s'anomena...", "opcions": ["Fixació", "Desnitrificació", "Assimilació", "Mineralització"], "resposta_correcta": "Assimilació", "gc_guany": 155, "gc_perdua": 75, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "Quins organismes són els principals responsables de la fixació biològica de nitrogen?", "opcions": ["Plantes superiors", "Fongs micorízics", "Cucs de terra", "Bacteris (com Rhizobium) i cianobacteris"], "resposta_correcta": "Bacteris (com Rhizobium) i cianobacteris", "gc_guany": 170, "gc_perdua": 85, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    {"pregunta": "El 'guano' (excrements d'aus marines) és una font històricament important de quin element?", "opcions": ["Carboni", "Sofre", "Fòsfor", "Silici"], "resposta_correcta": "Fòsfor", "gc_guany": 160, "gc_perdua": 80, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
    # ... (afegir més preguntes de nivell 6 fins a aprox. 50)
    {"pregunta": "El procés d'oxidació anaeròbica de l'amoni, conegut com a ANAMMOX, converteix nitrit i amoni directament en...", "opcions": ["Nitrats", "Matèria orgànica", "Gas nitrogen (N₂)", "Àcid nítric"], "resposta_correcta": "Gas nitrogen (N₂)", "gc_guany": 180, "gc_perdua": 90, "dificultat": 6, "categoria": "Cicles Biogeoquímics"},
]

# --- CONFIGURACIÓ INICIAL I D'ESTAT DE LA SESSIÓ ---
if 'geo_credits' not in st.session_state:
    st.session_state.geo_credits = 500
if 'puntuacio' not in st.session_state:
    st.session_state.puntuacio = 0
if 'pregunta_actual' not in st.session_state:
    st.session_state.pregunta_actual = None
if 'opcions_actuals' not in st.session_state: # NOU: Per guardar les opcions barrejades
    st.session_state.opcions_actuals = []
if 'resposta_enviada' not in st.session_state: # NOU: Per controlar l'estat de la pregunta
    st.session_state.resposta_enviada = False
if 'missatge_feedback' not in st.session_state:
    st.session_state.missatge_feedback = ""
if 'cambio_saldo' not in st.session_state:
    st.session_state.cambio_saldo = 0 
if 'mostrar_cambio' not in st.session_state:
    st.session_state.mostrar_cambio = False
if 'certificacions' not in st.session_state:
    cert_amb_estat = [dict(c, unlocked=(c['id'] == 1)) for c in CERTIFICACIONS_INFO]
    st.session_state.certificacions = cert_amb_estat
if 'preguntes_respostes' not in st.session_state:
    st.session_state.preguntes_respostes = 0
if 'respostes_correctes' not in st.session_state:
    st.session_state.respostes_correctes = 0
if 'errors_per_categoria' not in st.session_state:
    st.session_state.errors_per_categoria = {}
if 'preguntes_recents' not in st.session_state:
    st.session_state.preguntes_recents = deque(maxlen=20)
if 'multiplicador_actual' not in st.session_state:
    st.session_state.multiplicador_actual = 1.0
if 'nivell_potenciador_actual' not in st.session_state:
    st.session_state.nivell_potenciador_actual = 0

# --- FUNCIONS DEL JOC ---
def generar_pregunta():
    """Selecciona una nova pregunta, barreja les seves opcions i reinicia l'estat per respondre."""
    nivell_maxim = max(c['nivell_dificultat'] for c in st.session_state.certificacions if c['unlocked'])
    
    preguntes_disponibles = [
        (i, p) for i, p in enumerate(PREGUNTES_EDAFOLOGIA) 
        if p['dificultat'] <= nivell_maxim and i not in st.session_state.preguntes_recents
    ]
    
    if not preguntes_disponibles:
        st.session_state.preguntes_recents.clear()
        preguntes_disponibles = [(i, p) for i, p in enumerate(PREGUNTES_EDAFOLOGIA) if p['dificultat'] <= nivell_maxim]

    if preguntes_disponibles:
        idx, pregunta_seleccionada = random.choice(preguntes_disponibles)
        st.session_state.pregunta_actual = pregunta_seleccionada
        st.session_state.preguntes_recents.append(idx)
        # Barreja i guarda les opcions per evitar que canviïn
        st.session_state.opcions_actuals = random.sample(pregunta_seleccionada["opcions"], len(pregunta_seleccionada["opcions"]))
    else:
        st.session_state.pregunta_actual = None
    
    # Reinicia l'estat per a la nova pregunta
    st.session_state.missatge_feedback = ""
    st.session_state.resposta_enviada = False

def verificar_resposta(resposta_usuari):
    """Verifica la resposta de l'usuari, actualitza les puntuacions i prepara el feedback."""
    pregunta = st.session_state.pregunta_actual
    st.session_state.preguntes_respostes += 1
    
    if resposta_usuari == pregunta["resposta_correcta"]:
        guany_base = pregunta["gc_guany"]
        guany_final = int(guany_base * st.session_state.multiplicador_actual)
        st.session_state.geo_credits += guany_final
        st.session_state.puntuacio += 1
        st.session_state.respostes_correctes += 1
        st.session_state.missatge_feedback = f"🎉 Resposta Correcta! <span class='feedback-guany'>+{guany_final} GC</span>"
        st.session_state.cambio_saldo = guany_final
    else:
        perdua_gc = pregunta["gc_perdua"]
        st.session_state.geo_credits -= perdua_gc
        st.session_state.missatge_feedback = f"😔 Resposta Incorrecta. La correcta era: **{pregunta['resposta_correcta']}**. <span class='feedback-perdua'>-{perdua_gc} GC</span>"
        st.session_state.cambio_saldo = -perdua_gc
        categoria_error = pregunta.get('categoria', 'General')
        st.session_state.errors_per_categoria[categoria_error] = st.session_state.errors_per_categoria.get(categoria_error, 0) + 1

    st.session_state.mostrar_cambio = True
    st.session_state.resposta_enviada = True # Marca la pregunta com a contestada

def comprar_potenciador():
    nivell_actual = st.session_state.nivell_potenciador_actual
    if nivell_actual < len(POTENCIADORS_TENDA):
        proper_potenciador = POTENCIADORS_TENDA[nivell_actual]
        if st.session_state.geo_credits >= proper_potenciador['cost']:
            st.session_state.geo_credits -= proper_potenciador['cost']
            st.session_state.multiplicador_actual = proper_potenciador['multiplicador']
            st.session_state.nivell_potenciador_actual += 1
            st.success(f"Has adquirit '{proper_potenciador['nom']}'! Els teus guanys ara es multipliquen per {st.session_state.multiplicador_actual:.2f}x.")
            time.sleep(2)
            st.rerun()
        else:
            st.error("No tens suficients GeoCrèdits per aquesta millora.")


# --- DISSENY DE LA INTERFÍCIE (UI) ---
st.markdown("""
    <style>
        /* ... (El teu CSS no necessita canvis, és perfecte) ... */
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
        :root {
            --primary-color: #8B4513; --accent-color: #50C878; --text-color: #E0E0E0;
            --dark-bg: #1C1C1E; --card-bg: rgba(255, 255, 255, 0.05); --border-color: rgba(255, 255, 255, 0.1);
            --border-radius: 16px; --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        html, body, [class*="st-emotion"] { font-family: 'Poppins', sans-serif; color: var(--text-color); background-color: var(--dark-bg); }
        h1, h2, h3, h5, h4 { font-family: 'Poppins', sans-serif; font-weight: 700; color: white; }
        .app-header h1 {
            font-size: 2.5em; text-align: center; margin-bottom: 2rem;
            background: -webkit-linear-gradient(45deg, var(--primary-color), var(--accent-color));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .glass-card {
            background: var(--card-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            border-radius: var(--border-radius); border: 1px solid var(--border-color);
            padding: 25px; text-align: center; position: relative; box-shadow: var(--shadow); height: 100%;
        }
        .glass-card h2 { font-size: 1em; color: #BDBDBD; margin: 0; font-weight: 600; }
        .glass-card p { font-size: 2.5em; font-weight: 700; color: white; margin: 5px 0 0 0; }
        .saldo-change { position: absolute; top: 15px; right: 20px; font-size: 1.5em; font-weight: 700; animation: fadeInOut 1.5s ease-in-out forwards; }
        .saldo-change.positive { color: var(--accent-color); }
        .saldo-change.negative { color: #FF5252; }
        @keyframes fadeInOut { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
        .stButton>button {
            background-image: linear-gradient(90deg, var(--primary-color) 0%, var(--accent-color) 100%);
            color: white; border: none; border-radius: 12px; padding: 16px 30px; font-size: 1.1em;
            font-family: 'Poppins', sans-serif; font-weight: 600; width: 100%; transition: all 0.3s ease;
            margin-top: 15px; box-shadow: 0 4px 15px rgba(80, 200, 120, 0.2);
        }
        .stButton>button:hover { transform: translateY(-3px); box-shadow: 0 7px 20px rgba(80, 200, 120, 0.3); }
        .stButton>button:disabled { background-image: none; background-color: #424242; cursor: not-allowed; box-shadow: none; }
        .feedback-guany { color: var(--accent-color); } .feedback-perdua { color: #FF5252; }
        .career-path { position: relative; padding-left: 30px; border-left: 2px solid var(--border-color); }
        .step { position: relative; margin-bottom: 2rem; }
        .step-icon { position: absolute; left: -44px; top: 50%; transform: translateY(-50%); font-size: 1.8em; background: var(--dark-bg); padding: 5px; border-radius: 50%; }
        .step.unlocked .step-icon { color: var(--accent-color); }
        .step-details p { font-weight: 600; margin: 0; color: white; }
        .step-details span { font-size: 0.9em; color: #BDBDBD; }
        .step.locked .step-details { opacity: 0.5; }
        div[data-baseweb="tab-list"] { background: var(--card-bg); border-radius: var(--border-radius); padding: 10px; border: 1px solid var(--border-color); }
        button[data-baseweb="tab"] { background-color: transparent; color: var(--text-color); border-radius: 10px; font-family: 'Poppins', sans-serif; font-weight: 600; }
        button[data-baseweb="tab"][aria-selected="true"] { background-image: linear-gradient(90deg, var(--primary-color) 0%, var(--accent-color) 100%); color: white; }
        .st-emotion-cache-1s3wbf8 { padding-top: 2rem; min-height: 500px; }
    </style>
""", unsafe_allow_html=True)

# --- CONTINGUT DE L'APP ---
st.markdown("<div class='app-header'><h1>Terra-Expert: El Repte de l'Edafologia</h1></div>", unsafe_allow_html=True)

col_stats_1, col_stats_2, col_stats_3 = st.columns(3)
with col_stats_1:
    saldo_html = f"""<div class="glass-card"><h2>Capital (GC)</h2><p>{st.session_state.geo_credits:.0f}</p>"""
    if st.session_state.mostrar_cambio and st.session_state.cambio_saldo != 0:
        saldo_html += f'<div class="saldo-change {"positive" if st.session_state.cambio_saldo > 0 else "negative"}">{"+" if st.session_state.cambio_saldo > 0 else ""}{st.session_state.cambio_saldo}</div>'
    saldo_html += "</div>"
    st.markdown(saldo_html, unsafe_allow_html=True)

with col_stats_2:
    st.markdown(f"""<div class="glass-card"><h2>Puntuació</h2><p>{st.session_state.puntuacio}</p></div>""", unsafe_allow_html=True)

with col_stats_3:
    total_respostes = st.session_state.get('preguntes_respostes', 0)
    correctes = st.session_state.get('respostes_correctes', 0)
    percentatge_encert = (correctes / total_respostes * 100) if total_respostes > 0 else 0
    st.markdown(f"""<div class="glass-card"><h2>% Encerts</h2><p>{percentatge_encert:.1f}%</p></div>""", unsafe_allow_html=True)

st.write("")

tab1, tab2, tab3, tab4 = st.tabs(["🔬 Simulador de Camp", "🎓 Pla de Carrera", "📈 Tenda d'Investigació", "📊 El Teu Rendiment"])

with tab1:
    if st.session_state.pregunta_actual is None:
        if st.button("Començar Simulació", key="btn_generar_inicial"):
            generar_pregunta()
            st.rerun()
    else:
        pregunta = st.session_state.pregunta_actual
        st.markdown(f"**Nivell de Certificació:** `{pregunta['dificultat']}` | **Categoria:** `{pregunta['categoria']}`")
        st.markdown(f"#### {pregunta['pregunta']}")
        
        # El radio button ara es desactiva un cop s'ha enviat la resposta
        resposta_usuari = st.radio(
            "Selecciona la teva resposta:", 
            st.session_state.opcions_actuals, 
            key="radio_respostes", 
            label_visibility="collapsed",
            disabled=st.session_state.resposta_enviada
        )
        
        # LÒGICA DE BOTONS CORREGIDA
        if not st.session_state.resposta_enviada:
            if st.button("Confirmar Resposta", key="btn_enviar_resposta", use_container_width=True):
                verificar_resposta(resposta_usuari)
                st.rerun()
        else:
            # Mostra el feedback un cop la resposta ha estat enviada
            if st.session_state.missatge_feedback:
                st.markdown(f"<div style='margin-top: 20px; text-align: center; font-size: 1.1em;'>{st.session_state.missatge_feedback}</div>", unsafe_allow_html=True)
            
            if st.button("Següent Pregunta", key="btn_seguent_pregunta", use_container_width=True):
                generar_pregunta()
                st.rerun()

with tab2:
    # Aquesta pestanya no necessita canvis
    st.subheader("El Teu Camí d'Expert en Sòls")
    st.markdown('<div class="career-path">', unsafe_allow_html=True)
    for i, cert in enumerate(st.session_state.get('certificacions', [])):
        status_class = "unlocked" if cert["unlocked"] else "locked"
        can_unlock = st.session_state.certificacions[i-1]['unlocked'] if i > 0 else True
        st.markdown(f'<div class="step {status_class}">', unsafe_allow_html=True)
        st.markdown(f'<span class="step-icon">{cert["icon"]}</span>', unsafe_allow_html=True)
        st.markdown(f"""
            <div class="step-details">
                <p>{cert['nom']}</p>
                <span>{'✅ Certificació Obtinguda' if cert['unlocked'] else f"Inversió: {cert['cost']} GC"}</span>
            </div>
        """, unsafe_allow_html=True)
        if not cert['unlocked'] and can_unlock:
            if st.button(f"Desbloquejar Nivell {cert['id']}", key=f"buy_cert_{cert['id']}", disabled=(st.session_state.geo_credits < cert['cost'])):
                st.session_state.geo_credits -= cert['cost']
                st.session_state.certificacions[i]['unlocked'] = True
                st.success(f"Felicitats! Has obtingut la certificació '{cert['nom']}'!")
                time.sleep(1.5)
                st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

with tab3:
    # Aquesta pestanya no necessita canvis
    st.subheader("Laboratori de Millores Permanents")
    st.markdown(f"La teva eficiència d'investigació actual multiplica els guanys per **{st.session_state.multiplicador_actual:.2f}x**.")
    st.markdown("---")
    nivell_actual = st.session_state.nivell_potenciador_actual
    if nivell_actual < len(POTENCIADORS_TENDA):
        propera_millora = POTENCIADORS_TENDA[nivell_actual]
        st.markdown("#### Pròxim salt quàntic:")
        st.markdown(f"### {propera_millora['nom']}")
        st.markdown(f"Aquesta millora augmentarà el teu multiplicador de guanys a **{propera_millora['multiplicador']:.2f}x**.")
        st.markdown(f"**Cost de la inversió:** `{propera_millora['cost']} GC`")
        if st.button("Adquirir Millora", key="buy_upgrade", use_container_width=True, disabled=(st.session_state.geo_credits < propera_millora['cost'])):
            comprar_potenciador()
    else:
        st.success("🎉 Has assolit el màxim nivell d'investigació! Ets una llegenda de l'edafologia. 🎉")

with tab4:
    # Aquesta pestanya no necessita canvis
    st.subheader("Anàlisi de Rendiment")
    if st.session_state.preguntes_respostes > 0:
        st.markdown("<h5>Estadístiques Generals</h5>", unsafe_allow_html=True)
        st.markdown(f"""
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #BDBDBD;">Percentatge d'Encerts</span><span style="font-weight: 600;">{percentatge_encert:.1f}%</span></div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #BDBDBD;">Preguntes Respostes</span><span style="font-weight: 600;">{total_respostes}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #BDBDBD;">Respostes Correctes</span><span style="font-weight: 600; color: var(--accent-color);">{correctes}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #BDBDBD;">Respostes Incorrectes</span><span style="font-weight: 600; color: #FF5252;">{total_respostes - correctes}</span></div>
        """, unsafe_allow_html=True)
        st.write("")
        st.markdown("<h5>Àrees de Millora (Basat en Errors)</h5>", unsafe_allow_html=True)
        if st.session_state.errors_per_categoria:
            errors_df = pd.DataFrame(list(st.session_state.errors_per_categoria.items()), columns=['Categoria', 'Errors'])
            chart = alt.Chart(errors_df).mark_bar(cornerRadius=5, height=25).encode(
                x=alt.X('Errors:Q', title="Nombre d'Errors"),
                y=alt.Y('Categoria:N', title="", sort='-x'),
                tooltip=['Categoria', 'Errors'],
                color=alt.Color('Categoria:N', legend=None, scale=alt.Scale(scheme='greens', reverse=True))
            ).configure_axis(labelColor='#E0E0E0', titleColor='#BDBDBD', gridColor='rgba(255, 255, 255, 0.1)', domain=False
            ).configure_view(strokeWidth=0).configure(background='transparent')
            st.altair_chart(chart, use_container_width=True)
        else:
            st.success("🎉 De moment, cap error! El teu rendiment és perfecte.")
    else:
        st.info("Comença el simulador per veure les teves estadístiques de rendiment.")

# Lògica de l'animació de canvi de saldo
if st.session_state.get('mostrar_cambio', False):
    time.sleep(1.5)
    st.session_state.mostrar_cambio = False
    st.session_state.cambio_saldo = 0
    st.rerun()

