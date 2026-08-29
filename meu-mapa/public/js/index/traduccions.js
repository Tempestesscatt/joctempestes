// ============================================================
// TRADUCCIONS - Català / Castellà (COMPLET - TOT)
// ============================================================

let idiomaActual = localStorage.getItem('tempestes_idioma') || 
    (navigator.language.startsWith('es') ? 'es' : 'ca');

const traduccions = {

    // ============================================================
    // HERO
    // ============================================================
    "La tempesta no avisa... Un bon anàlisi sí!": "¡La tormenta no avisa... Un buen análisis sí!",
    "TEMPESTES.CAT": "TEMPESTES.CAT",
    "El portal de referència per a la previsió meteorològica professional a Catalunya. Informació actualitzada sobre tempestes, vents, calamarsa i fenòmens extrems.": "El portal de referencia para la previsión meteorológica profesional en Cataluña. Información actualizada sobre tormentas, vientos, granizo y fenómenos extremos.",
    "Tempestes a Catalunya - Pluja - Meteorologia - Vent - Neu - Pedregades - Fred - Calor": "Tormentas en Cataluña - Lluvia - Meteorología - Viento - Nieve - Granizadas - Frío - Calor",

    // ============================================================
    // TOPBAR
    // ============================================================
    "Previsió Professional": "Previsión Profesional",
    "Cercar...": "Buscar...",
    "Articles": "Artículos",
    "Avisos": "Avisos",
    "Qui som": "Quiénes somos",
    "Contacte": "Contacto",
    "Models": "Modelos",
    "Iniciar sessió": "Iniciar sesión",
    "Usuari": "Usuario",
    "obrir visor": "Abrir visor",
    

        // ============================================================
    // OUTBREAK / AVISOS (COMPLET)
    // ============================================================
    "Outbreak · Avís de tempestes severes": "Outbreak · Aviso de tormentas severas",
    "Mapa de risc màxim (14h-18h)": "Mapa de riesgo máximo (14h-18h)",
    "OUTBREAK CATALUNYA": "OUTBREAK CATALUÑA",
    "Carregant mapa d'outbreak...": "Cargando mapa de outbreak...",
    "Si us plau, espera uns segons": "Por favor, espera unos segundos",
    "Catalunya · Risc de tempestes severes": "Cataluña · Riesgo de tormentas severas",
    "S'actualitza cada 10 hores CEST": "Se actualiza cada 10 horas CEST",
    "Risc de tempestes severes": "Riesgo de tormentas severas",
    "amb calamarsa de gran tamany": "con granizo de gran tamaño",
    "vents forts (>90 km/h)": "vientos fuertes (>90 km/h)",
    "possible tornado": "posible tornado",
    "en zones de l'interior i el litoral.": "en zonas del interior y el litoral.",
    "Màxim entre les": "Máximo entre las",
    "14h i 18h": "14h y 18h",
    "Carregant data...": "Cargando fecha...",


    // ============================================================
    // ARTICLES (secció)
    // ============================================================
    "Articles meteorològics": "Artículos meteorológicos",
    "15 articles": "15 artículos",
    "Llegir més": "Leer más",
    "5 min": "5 min",

    // ============================================================
    // TÍTOLS DELS ARTICLES (15)
    // ============================================================
    "Com es formen les tempestes: els ingredients de la convecció?": "¿Cómo se forman las tormentas? Los ingredientes de la convección",
    "Vents en superfície: com predir-los i interpretar-los?": "Vientos en superficie: ¿cómo predecirlos e interpretarlos?",
    "Paràmetres de severitat: CAPE, CIN, cisallament i helicitat en que afecten?": "Parámetros de severidad: CAPE, CIN, cizallamiento y helicidad, ¿en qué afectan?",
    "El granís, calamarsa o pedregada: com es forma i com predir-lo?": "El granizo: ¿cómo se forma y cómo predecirlo?",
    "Com fer un anàlisi meteorològic professional pas a pas?": "¿Cómo hacer un análisis meteorológico profesional paso a paso?",
    "AROME 1.3km: el model que revoluciona la previsió a Catalunya": "AROME 1.3km: el modelo que revoluciona la previsión en Cataluña",
    "El radar meteorològic: com funciona i com l'interpretem": "El radar meteorológico: cómo funciona y cómo lo interpretamos",
    "Els ensembles: per què hi ha tantes previsions diferents?": "Los ensembles: ¿por qué hay tantas previsiones diferentes?",
    "El canvi climàtic i les tempestes a la Mediterrània": "El cambio climático y las tormentas en el Mediterráneo",
    "L'efecte Foehn: per què fa calor a l'Empordà quan neva al Pirineu": "El efecto Foehn: ¿por qué hace calor en el Empordà cuando nieva en el Pirineo?",
    "Les estacions meteorològiques: com mesurem el temps": "Las estaciones meteorológicas: cómo medimos el tiempo",
    "Les borrasques mediterrànies: com es formen i com ens afecten": "Las borrascas mediterráneas: cómo se forman y cómo nos afectan",
    "L'efecte de les muntanyes en el clima català": "El efecto de las montañas en el clima catalán",
    "Com interpretar un mapa de precipitació?": "¿Cómo interpretar un mapa de precipitación?",
    "La previsió de tempestes per a caçadors de tempestes": "La previsión de tormentas para cazatormentas",

    // ============================================================
    // CATEGORIES DELS ARTICLES
    // ============================================================
    "Tempestes": "Tormentas",
    "Vent": "Viento",
    "Severitat": "Severidad",
    "Granizo": "Granizo",
    "Anàlisi": "Análisis",
    "Models": "Modelos",
    "Tecnologia": "Tecnología",
    "Clima": "Clima",
    "Fenòmens locals": "Fenómenos locales",
    "Instrumentació": "Instrumentación",
    "Fenòmens extrems": "Fenómenos extremos",
    "Tutorial": "Tutorial",
    "Caçatempestes": "Cazatormentas",

    // ============================================================
    // EXCERPTS DELS ARTICLES
    // ============================================================
    "Descobreix els tres ingredients bàsics per a la formació de tempestes: humitat, inestabilitat i mecanisme d'ascens.": "Descubre los tres ingredientes básicos para la formación de tormentas: humedad, inestabilidad y mecanismo de ascenso.",
    "Aprèn a interpretar els mapes de vent a 10 metres i a entendre la circulació atmosfèrica a nivell de terra.": "Aprende a interpretar los mapas de viento a 10 metros y a entender la circulación atmosférica a nivel de suelo.",
    "Analitza els paràmetres que indiquen si una tempesta serà severa: CAPE, CIN, cisallament i helicitat.": "Analiza los parámetros que indican si una tormenta será severa: CAPE, CIN, cizallamiento y helicidad.",
    "Analitza la formació de la calamarsa, els paràmetres que l'indiquen i com predir-ne la caiguda.": "Analiza la formación del granizo, los parámetros que lo indican y cómo predecir su caída.",
    "Aprèn a fer un anàlisi meteorològic complet: des de l'observació de satèl·lit fins a la previsió de tempestes.": "Aprende a hacer un análisis meteorológico completo: desde la observación de satélite hasta la previsión de tormentas.",
    "Coneix en detall el model d'alta resolució que ens permet predir tempestes locals.": "Conoce en detalle el modelo de alta resolución que nos permite predecir tormentas locales.",
    "Coneix el funcionament del radar de precipitacions i com obtenir informació útil.": "Conoce el funcionamiento del radar de precipitaciones y cómo obtener información útil.",
    "Entén per què hi ha múltiples escenaris i com interpretar la incertesa.": "Entiende por qué hay múltiples escenarios y cómo interpretar la incertidumbre.",
    "Com l'escalfament global està alterant els patrons de tempestes al nostre mar.": "Cómo el calentamiento global está alterando los patrones de tormentas en nuestro mar.",
    "Descobreix com les muntanyes creen microclimes a Catalunya.": "Descubre cómo las montañas crean microclimas en Cataluña.",
    "Coneix els instruments que utilitzem per mesurar temperatura, pressió i humitat.": "Conoce los instrumentos que utilizamos para medir temperatura, presión y humedad.",
    "Analitzem la formació de les borrasques que ens porten tempestes.": "Analizamos la formación de las borrascas que nos traen tormentas.",
    "Com el Pirineu, el Prepirineu i la Serralada Litoral modifiquen el temps.": "Cómo el Pirineo, el Prepirineo y la Serralada Litoral modifican el tiempo.",
    "Guia pas a pas per entendre els mapes de pluja del nostre visor.": "Guía paso a paso para entender los mapas de lluvia de nuestro visor.",
    "Consells i eines per als que volen caçar tempestes a Catalunya.": "Consejos y herramientas para los que quieren cazar tormentas en Cataluña.",

    // ============================================================
    // ============================================================
    // CONTINGUT COMPLET DELS ARTICLES (TOT EL TEXT)
    // ============================================================
    // ============================================================

    // ----- ARTICLE 1: TEMPESTES -----
    "Com es formen les tempestes: els ingredients de la convecció": "Cómo se forman las tormentas: los ingredientes de la convección",
    "La convecció: el motor de les tempestes": "La convección: el motor de las tormentas",
    "La convecció és el procés pel qual l'aire càlid i menys dens ascendeix a través de l'atmosfera. Aquest moviment vertical és el motor que alimenta les tempestes. Quan l'aire ascendeix, es refreda i, si conté prou humitat, es condensa formant núvols de gran desenvolupament vertical: els cumulonimbus.": "La convección es el proceso por el cual el aire caliente y menos denso asciende a través de la atmósfera. Este movimiento vertical es el motor que alimenta las tormentas. Cuando el aire asciende, se enfría y, si contiene suficiente humedad, se condensa formando nubes de gran desarrollo vertical: los cumulonimbus.",
    "Perquè es produeixi convecció, cal que l'aire a la superfície sigui més càlid que l'aire que el rodeja. Això pot passar per escalfament solar, per la presència d'un front o per l'ascens forçat per relleu muntanyós.": "Para que se produzca convección, el aire en la superficie debe ser más cálido que el aire que lo rodea. Esto puede ocurrir por calentamiento solar, por la presencia de un frente o por el ascenso forzado por relieve montañoso.",
    "Els tres ingredients essencials": "Los tres ingredientes esenciales",
    "Perquè es formi una tempesta calen tres factors: humitat a baixos nivells, una font d'escalfament i un mecanisme d'ascens. A Catalunya, el sol escalfa la superfície i provoca l'ascens de l'aire humit del Mediterrani.": "Para que se forme una tormenta se necesitan tres factores: humedad en niveles bajos, una fuente de calentamiento y un mecanismo de ascenso. En Cataluña, el sol calienta la superficie y provoca el ascenso del aire húmedo del Mediterráneo.",
    "La humitat és el combustible de les tempestes. L'aire humit que puja es refreda i es condensa, formant núvols. Aquest procés allibera calor latent, que fa que l'aire continuï pujant. Això crea un bucle de retroalimentació positiva que pot donar lloc a tempestes molt intenses.": "La humedad es el combustible de las tormentas. El aire húmedo que sube se enfría y se condensa, formando nubes. Este proceso libera calor latente, que hace que el aire continúe subiendo. Esto crea un bucle de retroalimentación positiva que puede dar lugar a tormentas muy intensas.",
    "El paper del relleu català": "El papel del relieve catalán",
    "El relleu de Catalunya, amb el Pirineu, la Depressió Central i la Serralada Litoral, crea zones de convergència que afavoreixen la formació de núvols de tempesta. Les muntanyes actuen com a barreres que forcen l'aire a ascendir.": "El relieve de Cataluña, con el Pirineo, la Depresión Central y la Serralada Litoral, crea zonas de convergencia que favorecen la formación de nubes de tormenta. Las montañas actúan como barreras que fuerzan el aire a ascender.",
    "El Pirineu és una barrera natural que atura les masses d'aire humit procedents del nord. Quan l'aire xoca amb les muntanyes, es veu forçat a pujar, es refreda i es condensa, formant núvols i precipitacions. Això explica per què al Pirineu hi ha més precipitacions que a la Depressió Central.": "El Pirineo es una barrera natural que detiene las masas de aire húmedo procedentes del norte. Cuando el aire choca con las montañas, se ve forzado a subir, se enfría y se condensa, formando nubes y precipitaciones. Esto explica por qué en el Pirineo hay más precipitaciones que en la Depresión Central.",
    "Com mesurar la inestabilitat: CAPE i CIN": "Cómo medir la inestabilidad: CAPE y CIN",
    "El CAPE (Convective Available Potential Energy) és l'energia disponible per a la convecció. Valors superiors a 1000 J/kg indiquen un alt potencial de tempestes. El CIN (Convective Inhibition) és l'energia necessària per trencar la capa d'inhibició.": "El CAPE (Convective Available Potential Energy) es la energía disponible para la convección. Valores superiores a 1000 J/kg indican un alto potencial de tormentas. El CIN (Convective Inhibition) es la energía necesaria para romper la capa de inhibición.",
    "El CAPE es calcula a partir de la temperatura i la humitat a diferents altures. Es mesura en J/kg i, generalment, valors superiors a 1000 J/kg ja indiquen una alta probabilitat de tempestes. El CIN, en canvi, indica l'energia que cal subministrar per iniciar la convecció.": "El CAPE se calcula a partir de la temperatura y la humedad a diferentes alturas. Se mide en J/kg y, generalmente, valores superiores a 1000 J/kg ya indican una alta probabilidad de tormentas. El CIN, en cambio, indica la energía que hay que suministrar para iniciar la convección.",
    "Els models de previsió que utilitzem": "Los modelos de previsión que utilizamos",
    "A TEMPESTES.CAT utilitzem el model AROME de Meteo-France, amb una resolució de 1.3km, que permet detectar tempestes locals. També fem servir GFS i ECMWF per a tendències a llarg termini.": "En TEMPESTES.CAT utilizamos el modelo AROME de Meteo-France, con una resolución de 1.3km, que permite detectar tormentas locales. También usamos GFS y ECMWF para tendencias a largo plazo.",
    "AROME és el model més precís per a Catalunya perquè té en compte el relleu i les particularitats del clima mediterrani. Amb la seva resolució de 1.3 km, pot detectar tempestes que altres models amb resolució més baixa no veuen.": "AROME es el modelo más preciso para Cataluña porque tiene en cuenta el relieve y las particularidades del clima mediterráneo. Con su resolución de 1.3 km, puede detectar tormentas que otros modelos con resolución más baja no ven.",
    "Consells de seguretat davant d'una tempesta": "Consejos de seguridad ante una tormenta",
    "Si hi ha avís de tempesta, evita refugiar-te sota arbres, no utilitzis aparells connectats a la xarxa elèctrica i cerca un edifici segur. Si ets a la muntanya, baixa ràpidament.": "Si hay aviso de tormenta, evita refugiarte bajo árboles, no utilices aparatos conectados a la red eléctrica y busca un edificio seguro. Si estás en la montaña, baja rápidamente.",
    "Les tempestes poden ser molt perilloses. Els llamps poden caure a terra i causar incendis o lesions. Les pluges intenses poden provocar inundacions i lliscaments de terra. És important estar informat i seguir les recomanacions de Protecció Civil.": "Las tormentas pueden ser muy peligrosas. Los rayos pueden caer al suelo y causar incendios o lesiones. Las lluvias intensas pueden provocar inundaciones y deslizamientos de tierra. Es importante estar informado y seguir las recomendaciones de Protección Civil.",

    // ----- ARTICLE 2: VENT -----
    "Vents en superfície: com predir-los i interpretar-los": "Vientos en superficie: cómo predecirlos e interpretarlos",
    "Què és el vent en superfície?": "¿Qué es el viento en superficie?",
    "El vent en superfície és el moviment de l'aire a la capa més propera al terra, normalment mesurat a 10 metres d'altura. És el vent que sentim al nostre dia a dia i que afecta directament les activitats humanes, l'agricultura, la navegació i la seguretat.": "El viento en superficie es el movimiento del aire en la capa más cercana al suelo, normalmente medido a 10 metros de altura. Es el viento que sentimos en nuestro día a día y que afecta directamente las actividades humanas, la agricultura, la navegación y la seguridad.",
    "El vent en superfície està determinat pel gradient de pressió, la força de Coriolis i la fricció amb el terra. A diferència del vent en alçada, el vent en superfície es veu molt afectat pel relleu i la rugositat del terreny.": "El viento en superficie está determinado por el gradiente de presión, la fuerza de Coriolis y la fricción con el suelo. A diferencia del viento en altura, el viento en superficie se ve muy afectado por el relieve y la rugosidad del terreno.",
    "El gradient de pressió: el motor del vent": "El gradiente de presión: el motor del viento",
    "El vent es genera per les diferències de pressió atmosfèrica. L'aire es mou de les zones d'alta pressió cap a les zones de baixa pressió. Com més gran és la diferència de pressió, més intens és el vent.": "El viento se genera por las diferencias de presión atmosférica. El aire se mueve de las zonas de alta presión hacia las zonas de baja presión. Cuanto mayor es la diferencia de presión, más intenso es el viento.",
    "El gradient de pressió es mesura en hPa per 100 km. Un gradient de 5 hPa/100 km genera vents moderats, mentre que un gradient de 15 hPa/100 km pot generar vents forts o tempestuosos.": "El gradiente de presión se mide en hPa por 100 km. Un gradiente de 5 hPa/100 km genera vientos moderados, mientras que un gradiente de 15 hPa/100 km puede generar vientos fuertes o tempestuosos.",
    "La influència del relleu": "La influencia del relieve",
    "El relleu és un factor clau en la direcció i intensitat del vent en superfície. Les muntanyes poden canalitzar el vent, accelerar-lo en les valls o crear zones d'ombra on el vent és més feble.": "El relieve es un factor clave en la dirección e intensidad del viento en superficie. Las montañas pueden canalizar el viento, acelerarlo en los valles o crear zonas de sombra donde el viento es más débil.",
    "A Catalunya, la tramuntana a l'Empordà és un exemple clàssic de vent canalitzat pel relleu. El vent del nord baixa dels Pirineus i s'accelera a l'Empordà, on pot superar els 100 km/h.": "En Cataluña, la tramontana en el Empordà es un ejemplo clásico de viento canalizado por el relieve. El viento del norte baja de los Pirineos y se acelera en el Empordà, donde puede superar los 100 km/h.",
    "Com interpretar els mapes de vent": "Cómo interpretar los mapas de viento",
    "Els mapes de vent mostren la direcció (amb fletxes) i la intensitat (amb colors o isolínies). A TEMPESTES.CAT oferim mapes de vent a 10 metres dels models AROME": "Los mapas de viento muestran la dirección (con flechas) y la intensidad (con colores o isolíneas). En TEMPESTES.CAT ofrecemos mapas de viento a 10 metros de los modelos AROME",
    "La direcció del vent s'indica amb fletxes que apunten cap a on bufa el vent. La intensitat es mostra amb colors: blau (feble), verd (moderat), groc (fort) i vermell (molt fort).": "La dirección del viento se indica con flechas que apuntan hacia donde sopla el viento. La intensidad se muestra con colores: azul (débil), verde (moderado), amarillo (fuerte) y rojo (muy fuerte).",
    "El vent i les tempestes": "El viento y las tormentas",
    "El vent en superfície és un paràmetre clau per a la previsió de tempestes. Un canvi sobtat en la direcció o intensitat del vent pot indicar l'arribada d'una tempesta o d'un front.": "El viento en superficie es un parámetro clave para la previsión de tormentas. Un cambio brusco en la dirección o intensidad del viento puede indicar la llegada de una tormenta o de un frente.",
    "El cisallament del vent, que és la variació de la direcció i intensitat del vent amb l'altura, és un factor crític per a la formació de tempestes severes. Un cisallament fort pot organitzar les tempestes i donar lloc a supercèl·lules.": "El cizallamiento del viento, que es la variación de la dirección e intensidad del viento con la altura, es un factor crítico para la formación de tormentas severas. Un cizallamiento fuerte puede organizar las tormentas y dar lugar a supercélulas.",
    "Consells per a la navegació i activitats a l'aire lliure": "Consejos para la navegación y actividades al aire libre",
    "Consulta sempre la previsió de vent abans de fer activitats a l'aire lliure, especialment si tens previst navegar, volar o fer excursions a la muntanya.": "Consulta siempre la previsión de viento antes de hacer actividades al aire libre, especialmente si tienes previsto navegar, volar o hacer excursiones a la montaña.",
    "El vent pot ser perillós en activitats com la vela, el caiac o l'escalada. Una ratxa inesperada pot tombar una embarcació o fer caure un escalador. La informació actualitzada és la millor eina per a la seguretat.": "El viento puede ser peligroso en actividades como la vela, el kayak o la escalada. Una racha inesperada puede volcar una embarcación o hacer caer a un escalador. La información actualizada es la mejor herramienta para la seguridad.",

    // ----- ARTICLE 3: SEVERITAT -----
    "Paràmetres de severitat: CAPE, CIN, cisallament i helicitat": "Parámetros de severidad: CAPE, CIN, cizallamiento y helicidad",
    "Què és una tempesta severa?": "¿Qué es una tormenta severa?",
    "Una tempesta severa és aquella que produeix un o més dels següents fenòmens: calamarsa de més de 2 cm de diàmetre, ratxes de vent superiors a 90 km/h, o tornados. La seva predicció requereix l'anàlisi de diversos paràmetres atmosfèrics.": "Una tormenta severa es aquella que produce uno o más de los siguientes fenómenos: granizo de más de 2 cm de diámetro, ráfagas de viento superiores a 90 km/h, o tornados. Su predicción requiere el análisis de varios parámetros atmosféricos.",
    "Les tempestes severes són relativament freqüents a Catalunya, especialment a la tardor i a l'estiu. La combinació d'aire càlid i humit del Mediterrani amb l'aire fred en alçada pot generar condicions extremes.": "Las tormentas severas son relativamente frecuentes en Cataluña, especialmente en otoño y en verano. La combinación de aire cálido y húmedo del Mediterráneo con el aire frío en altura puede generar condiciones extremas.",
    "CAPE: l'energia disponible": "CAPE: la energía disponible",
    "El CAPE (Convective Available Potential Energy) és el paràmetre més important per a la severitat. Valors de 1500-3000 J/kg indiquen un alt potencial de tempestes severes. Per sobre de 3000 J/kg, el potencial és extrem.": "El CAPE (Convective Available Potential Energy) es el parámetro más importante para la severidad. Valores de 1500-3000 J/kg indican un alto potencial de tormentas severas. Por encima de 3000 J/kg, el potencial es extremo.",
    "El CAPE es calcula a partir del diagrama skew-T. Representa l'àrea entre la temperatura de la parcel·la d'aire que puja i la temperatura ambient. Com més gran és aquesta àrea, més energia disponible per a la convecció.": "El CAPE se calcula a partir del diagrama skew-T. Representa el área entre la temperatura de la parcela de aire que sube y la temperatura ambiente. Cuanto mayor es esta área, más energía disponible para la convección.",
    "CIN: la capa d'inhibició": "CIN: la capa de inhibición",
    "El CIN (Convective Inhibition) és l'energia que cal subministrar a una parcel·la d'aire perquè pugui superar la capa d'inhibició i iniciar la convecció. Un CIN alt pot impedir que es formin tempestes malgrat un CAPE alt.": "El CIN (Convective Inhibition) es la energía que hay que suministrar a una parcela de aire para que pueda superar la capa de inhibición e iniciar la convección. Un CIN alto puede impedir que se formen tormentas a pesar de un CAPE alto.",
    "El CIN és especialment important a primera hora del dia. Si el CIN és alt, les tempestes no es formaran fins que l'escalfament solar sigui suficient per trencar la capa d'inhibició.": "El CIN es especialmente importante a primera hora del día. Si el CIN es alto, las tormentas no se formarán hasta que el calentamiento solar sea suficiente para romper la capa de inhibición.",
    "El cisallament del vent": "El cizallamiento del viento",
    "El cisallament del vent és la variació de la direcció i intensitat del vent amb l'altura. Un cisallament fort (més de 20 m/s entre 0 i 6 km) pot organitzar les tempestes i donar lloc a supercèl·lules, que són les tempestes més violentes.": "El cizallamiento del viento es la variación de la dirección e intensidad del viento con la altura. Un cizallamiento fuerte (más de 20 m/s entre 0 y 6 km) puede organizar las tormentas y dar lugar a supercélulas, que son las tormentas más violentas.",
    "El cisallament permet que la tempesta es mantingui organitzada durant més temps. Les supercèl·lules poden produir calamarsa molt gran, vents destructius i, en casos extrems, tornados.": "El cizallamiento permite que la tormenta se mantenga organizada durante más tiempo. Las supercélulas pueden producir granizo muy grande, vientos destructivos y, en casos extremos, tornados.",
    "L'helicitat: el potencial de rotació": "La helicidad: el potencial de rotación",
    "L'helicitat és una mesura del potencial de rotació de l'aire en una tempesta. Valors d'helicitat superiors a 150 m²/s² indiquen un alt potencial de tornados o de vent en rotació.": "La helicidad es una medida del potencial de rotación del aire en una tormenta. Valores de helicidad superiores a 150 m²/s² indican un alto potencial de tornados o de viento en rotación.",
    "L'helicitat es calcula a partir de la variació de la direcció del vent amb l'altura. Un canvi important en la direcció del vent entre la superfície i els 3 km d'altura crea un entorn favorable per a la rotació.": "La helicidad se calcula a partir de la variación de la dirección del viento con la altura. Un cambio importante en la dirección del viento entre la superficie y los 3 km de altura crea un entorno favorable para la rotación.",
    "Com utilitzem aquests paràmetres a TEMPESTES.CAT": "Cómo utilizamos estos parámetros en TEMPESTES.CAT",
    "Utilitzem les sortides d'AROME per obtenir mapes de CAPE, CIN, cisallament i helicitat. Això ens permet identificar les zones amb més probabilitat de tempestes severes i la seva intensitat potencial.": "Utilizamos las salidas de AROME para obtener mapas de CAPE, CIN, cizallamiento y helicidad. Esto nos permite identificar las zonas con más probabilidad de tormentas severas y su intensidad potencial.",
    "A TEMPESTES.CAT oferim mapes de tots aquests paràmetres per a Catalunya. Aquesta informació és essencial per a la previsió de tempestes severes i per a la seguretat de la població.": "En TEMPESTES.CAT ofrecemos mapas de todos estos parámetros para Cataluña. Esta información es esencial para la previsión de tormentas severas y para la seguridad de la población.",

    // ----- ARTICLE 4: GRANIZO -----
    "La calamarsa: com es forma i com predir-la": "El granizo: cómo se forma y cómo predecirlo",
    "Què és el granizo?": "¿Qué es el granizo?",
    "La calamarsa és una precipitació sòlida formada per boles o blocs de gel que cauen d'un núvol de tempesta. La seva mida pot variar des d'uns pocs mil·límetres fins a més de 10 cm de diàmetre en casos extrems.": "El granizo es una precipitación sólida formada por bolas o bloques de hielo que caen de una nube de tormenta. Su tamaño puede variar desde unos pocos milímetros hasta más de 10 cm de diámetro en casos extremos.",
    "La calamarsa es forma quan les gotes d'aigua en un núvol de tempesta són arrossegades cap amunt pels corrents ascendents, on es congelen. Aquestes partícules de gel poden ser arrossegades cap amunt diverses vegades, creixent capa a capa fins que el seu pes supera la força del corrent ascendent i cauen a terra.": "El granizo se forma cuando las gotas de agua en una nube de tormenta son arrastradas hacia arriba por las corrientes ascendentes, donde se congelan. Estas partículas de hielo pueden ser arrastradas hacia arriba varias veces, creciendo capa a capa hasta que su peso supera la fuerza de la corriente ascendente y caen al suelo.",
    "Les condicions per a la formació de granizo": "Las condiciones para la formación de granizo",
    "Perquè es formi granizo, calen tres condicions: un corrent ascendent fort (més de 10 m/s), una gran quantitat d'humitat a la capa de l'atmosfera on es forma el gel, i un nivell de congelació prou baix.": "Para que se forme granizo, se necesitan tres condiciones: una corriente ascendente fuerte (más de 10 m/s), una gran cantidad de humedad en la capa de la atmósfera donde se forma el hielo, y un nivel de congelación suficientemente bajo.",
    "El corrent ascendent és el motor del granizo. Com més fort és, més grans poden ser les pedres de granizo. La humitat proporciona el material per al creixement, i el nivell de congelació determina l'altura a la qual es forma el gel.": "La corriente ascendente es el motor del granizo. Cuanto más fuerte es, más grandes pueden ser las piedras de granizo. La humedad proporciona el material para el crecimiento, y el nivel de congelación determina la altura a la que se forma el hielo.",
    "Paràmetres per a la predicció del granizo": "Parámetros para la predicción del granizo",
    "Els principals paràmetres per a la predicció del granizo són: la temperatura a 500 hPa (ha de ser inferior a -15°C), el CAPE (superior a 1500 J/kg), i el cisallament del vent (que organitza la tempesta).": "Los principales parámetros para la predicción del granizo son: la temperatura a 500 hPa (debe ser inferior a -15°C), el CAPE (superior a 1500 J/kg), y el cizallamiento del viento (que organiza la tormenta).",
    "Els models de predicció utilitzen aquests paràmetres per calcular la probabilitat de granizo. A TEMPESTES.CAT oferim mapes de risc de granizo basats en les sortides d'AROME.": "Los modelos de predicción utilizan estos parámetros para calcular la probabilidad de granizo. En TEMPESTES.CAT ofrecemos mapas de riesgo de granizo basados en las salidas de AROME.",
    "La mida del granizo": "El tamaño del granizo",
    "La mida del granizo està relacionada amb la força del corrent ascendent. Un corrent ascendent de 30 m/s pot generar pedres de fins a 4 cm de diàmetre, mentre que un corrent de 50 m/s pot generar pedres de més de 10 cm.": "El tamaño del granizo está relacionado con la fuerza de la corriente ascendente. Una corriente ascendente de 30 m/s puede generar piedras de hasta 4 cm de diámetro, mientras que una corriente de 50 m/s puede generar piedras de más de 10 cm.",
    "La mida del granizo és important per a la seguretat. Pedres de més de 2 cm poden causar danys a vehicles i edificis. Pedres de més de 5 cm poden ser letals per a persones i animals.": "El tamaño del granizo es importante para la seguridad. Piedras de más de 2 cm pueden causar daños a vehículos y edificios. Piedras de más de 5 cm pueden ser letales para personas y animales.",
    "Com ens preparem a TEMPESTES.CAT": "Cómo nos preparamos en TEMPESTES.CAT",
    "Utilitzem AROME per detectar situacions de granizo. Analitzem la temperatura a 500 hPa, el CAPE i el cisallament. Quan es detecta una situació de risc, publiquem avisos detallats.": "Utilizamos AROME para detectar situaciones de granizo. Analizamos la temperatura a 500 hPa, el CAPE y el cizallamiento. Cuando se detecta una situación de riesgo, publicamos avisos detallados.",
    "La predicció del granizo és difícil perquè es tracta d'un fenomen local. A TEMPESTES.CAT oferim la millor informació disponible perquè puguis prendre precaucions.": "La predicción del granizo es difícil porque se trata de un fenómeno local. En TEMPESTES.CAT ofrecemos la mejor información disponible para que puedas tomar precauciones.",
    "Consells de seguretat": "Consejos de seguridad",
    "En cas de risc de granizo, busca refugi sota un sostre sòlid. No et refugiïs sota arbres o estructures febles. Protegeix els vehicles i els animals.": "En caso de riesgo de granizo, busca refugio bajo un techo sólido. No te refugies bajo árboles o estructuras débiles. Protege los vehículos y los animales.",
    "La calamarsa pot causar lesions greus. Si ets a l'aire lliure i comença a caure granizo, protegeix-te el cap i busca un refugi ràpidament.": "El granizo puede causar lesiones graves. Si estás al aire libre y comienza a caer granizo, protégete la cabeza y busca un refugio rápidamente.",

    // ----- ARTICLE 5: ANÀLISI -----
    "Com fer un anàlisi meteorològic professional pas a pas": "Cómo hacer un análisis meteorológico profesional paso a paso",
    "1. Observació de satèl·lit i radar": "1. Observación de satélite y radar",
    "El primer pas de qualsevol anàlisi meteorològic és l'observació de les imatges de satèl·lit i del radar. El satèl·lit ens mostra l'estructura dels núvols, mentre que el radar ens mostra on està plovent.": "El primer paso de cualquier análisis meteorológico es la observación de las imágenes de satélite y del radar. El satélite nos muestra la estructura de las nubes, mientras que el radar nos muestra dónde está lloviendo.",
    "Les imatges de satèl·lit en infraroig ens mostren la temperatura del cim dels núvols. Com més fred és el cim, més alt és el núvol i més probable és que hi hagi precipitacions intenses.": "Las imágenes de satélite en infrarrojo nos muestran la temperatura de la cima de las nubes. Cuanto más fría es la cima, más alta es la nube y más probable es que haya precipitaciones intensas.",
    "2. Anàlisi dels mapes de pressió i fronts": "2. Análisis de los mapas de presión y frentes",
    "Els mapes de pressió ens mostren la distribució de la pressió atmosfèrica i la posició dels fronts. Les borrasques i els fronts són els principals responsables del temps a Catalunya.": "Los mapas de presión nos muestran la distribución de la presión atmosférica y la posición de los frentes. Las borrascas y los frentes son los principales responsables del tiempo en Cataluña.",
    "Un front fred es representa amb una línia blava amb triangles. Un front càlid es representa amb una línia vermella amb semicircles. L'anàlisi de la trajectòria dels fronts és clau per a la previsió.": "Un frente frío se representa con una línea azul con triángulos. Un frente cálido se representa con una línea roja con semicírculos. El análisis de la trayectoria de los frentes es clave para la previsión.",
    "3. Anàlisi del skew-T": "3. Análisis del skew-T",
    "El diagrama skew-T és una eina fonamental per a l'anàlisi de la inestabilitat. Mostra la temperatura i la humitat a diferents altures, i permet calcular el CAPE, el CIN i el nivell de congelació.": "El diagrama skew-T es una herramienta fundamental para el análisis de la inestabilidad. Muestra la temperatura y la humedad a diferentes alturas, y permite calcular el CAPE, el CIN y el nivel de congelación.",
    "Un skew-T amb un gradient tèrmic vertical elevat indica inestabilitat. Si a més hi ha humitat a baixos nivells, la probabilitat de tempestes és alta.": "Un skew-T con un gradiente térmico vertical elevado indica inestabilidad. Si además hay humedad en niveles bajos, la probabilidad de tormentas es alta.",
    "4. Anàlisi dels models numèrics": "4. Análisis de los modelos numéricos",
    "Els models numèrics (AROME, GFS, ECMWF) ens donen la previsió del temps per als propers dies. Cal comparar diferents models i analitzar les tendències per obtenir una previsió fiable.": "Los modelos numéricos (AROME, GFS, ECMWF) nos dan la previsión del tiempo para los próximos días. Hay que comparar diferentes modelos y analizar las tendencias para obtener una previsión fiable.",
    "Si tots els models coincideixen, la previsió és fiable. Si divergeixen, hi ha incertesa. En aquest cas, cal estar atents a les actualitzacions.": "Si todos los modelos coinciden, la previsión es fiable. Si divergen, hay incertidumbre. En este caso, hay que estar atentos a las actualizaciones.",
    "5. Síntesi i redacció de la previsió": "5. Síntesis y redacción de la previsión",
    "L'últim pas és la síntesi de tota la informació recollida i la redacció d'una previsió clara i concisa. Cal destacar els fenòmens més importants i els riscos potencials.": "El último paso es la síntesis de toda la información recogida y la redacción de una previsión clara y concisa. Hay que destacar los fenómenos más importantes y los riesgos potenciales.",
    "Una bona previsió ha de respondre a tres preguntes: què passarà?, on passarà?, i quan passarà?. La informació ha de ser clara i útil per a l'usuari.": "Una buena previsión debe responder a tres preguntas: ¿qué pasará?, ¿dónde pasará?, y ¿cuándo pasará?. La información debe ser clara y útil para el usuario.",
    "Consells per a un anàlisi professional": "Consejos para un análisis profesional",
    "Mantén una rutina d'anàlisi diària. Utilitza sempre les mateixes fonts d'informació per a poder comparar. I, sobretot, no et fiïs mai d'un sol model o d'una sola font.": "Mantén una rutina de análisis diaria. Utiliza siempre las mismas fuentes de información para poder comparar. Y, sobre todo, no te fíes nunca de un solo modelo o de una sola fuente.",
    "La meteorologia és una ciència en constant evolució. L'experiència i la pràctica són clau per millorar l'anàlisi i la previsió.": "La meteorología es una ciencia en constante evolución. La experiencia y la práctica son clave para mejorar el análisis y la previsión.",

    // ----- ARTICLE 6: AROME -----
    "AROME 1.3km: el model que revoluciona la previsió a Catalunya": "AROME 1.3km: el modelo que revoluciona la previsión en Cataluña",
    "Què és el model AROME?": "¿Qué es el modelo AROME?",
    "AROME (Application of Research to Operations at Mesoscale) és un model numèric de previsió meteorològica desenvolupat per Meteo-France. La seva versió de 1.3km és la més detallada disponible per a Catalunya.": "AROME (Application of Research to Operations at Mesoscale) es un modelo numérico de previsión meteorológica desarrollado por Meteo-France. Su versión de 1.3km es la más detallada disponible para Cataluña.",
    "AROME és el successor del model ALADIN i ofereix una resolució molt més alta. Això el fa ideal per a regions amb relleu complex com Catalunya, on les condicions meteorològiques poden variar molt en pocs quilòmetres.": "AROME es el sucesor del modelo ALADIN y ofrece una resolución mucho más alta. Esto lo hace ideal para regiones con relieve complejo como Cataluña, donde las condiciones meteorológicas pueden variar mucho en pocos kilómetros.",
    "Per què 1.3 km és important?": "¿Por qué 1.3 km es importante?",
    "La resolució espacial de 1.3 km permet capturar fenòmens locals que altres models (com GFS o ECMWF) no poden veure, com tempestes de petit tamany, vents de vall o boires costaneres.": "La resolución espacial de 1.3 km permite capturar fenómenos locales que otros modelos (como GFS o ECMWF) no pueden ver, como tormentas de pequeño tamaño, vientos de valle o nieblas costeras.",
    "Per posar-ho en perspectiva, el model GFS té una resolució d'uns 25 km, mentre que ECMWF en té uns 9 km. AROME 1.3 km és capaç de veure detalls que els altres models no poden resoldre, com ara la formació de tempestes a la Serralada Litoral o els vents de tramuntana a l'Empordà.": "Para ponerlo en perspectiva, el modelo GFS tiene una resolución de unos 25 km, mientras que ECMWF tiene unos 9 km. AROME 1.3 km es capaz de ver detalles que los otros modelos no pueden resolver, como la formación de tormentas en la Serralada Litoral o los vientos de tramontana en el Empordà.",
    "Com funciona AROME?": "¿Cómo funciona AROME?",
    "AROME utilitza un sistema de data assimilation que incorpora dades de radar, satèl·lit i estacions meteorològiques en temps real. Això permet tenir una previsió molt precisa de les properes 48 hores.": "AROME utiliza un sistema de data assimilation que incorpora datos de radar, satélite y estaciones meteorológicas en tiempo real. Esto permite tener una previsión muy precisa de las próximas 48 horas.",
    "La data assimilation és el procés pel qual el model incorpora dades observades per ajustar les condicions inicials. Com més dades té, més precisa és la previsió. AROME assimila dades de més de 1000 estacions, radars i satèl·lits per oferir la millor previsió possible.": "La data assimilation es el proceso por el cual el modelo incorpora datos observados para ajustar las condiciones iniciales. Cuantos más datos tiene, más precisa es la previsión. AROME asimila datos de más de 1000 estaciones, radares y satélites para ofrecer la mejor previsión posible.",
    "Què és l'skew-T i per què és útil?": "¿Qué es el skew-T y por qué es útil?",
    "El diagrama skew-T és una eina fonamental per als meteoròlegs. Mostra la temperatura i la humitat a diferents altures, permetent detectar inestabilitat i predir la probabilitat de tempestes.": "El diagrama skew-T es una herramienta fundamental para los meteorólogos. Muestra la temperatura y la humedad a diferentes alturas, permitiendo detectar inestabilidad y predecir la probabilidad de tormentas.",
    "El skew-T és com una radiografia de l'atmosfera. Mostra com varia la temperatura i la humitat amb l'altura. Si la temperatura disminueix ràpidament amb l'altura (gradient tèrmic vertical elevat), hi ha inestabilitat i probabilitat de tempestes.": "El skew-T es como una radiografía de la atmósfera. Muestra cómo varía la temperatura y la humedad con la altura. Si la temperatura disminuye rápidamente con la altura (gradiente térmico vertical elevado), hay inestabilidad y probabilidad de tormentas.",
    "Limitacions d'AROME": "Limitaciones de AROME",
    "Malgrat la seva alta resolució, AROME és un model que requereix molta potència de càlcul. A més, les previsions més enllà de les 48 hores perden precisió, per això complementem amb ensembles.": "A pesar de su alta resolución, AROME es un modelo que requiere mucha potencia de cálculo. Además, las previsiones más allá de las 48 horas pierden precisión, por eso complementamos con ensembles.",
    "AROME és un model computacionalment exigent. Necessita superordinadors per executar-se en un temps raonable. Per això, les previsions a més de 48 hores es fan amb models globals com GFS i ECMWF.": "AROME es un modelo computacionalmente exigente. Necesita superordenadores para ejecutarse en un tiempo razonable. Por eso, las previsiones a más de 48 horas se hacen con modelos globales como GFS y ECMWF.",
    "Com interpretar les sortides d'AROME": "Cómo interpretar las salidas de AROME",
    "A TEMPESTES.CAT mostrem mapes de precipitació, vent, temperatura i índex de convecció. Els usuaris avançats poden consultar els nivells d'altura i els diagrams skew-T.": "En TEMPESTES.CAT mostramos mapas de precipitación, viento, temperatura e índice de convección. Los usuarios avanzados pueden consultar los niveles de altura y los diagramas skew-T.",
    "Les sortides d'AROME es presenten en forma de mapes. Cada mapa mostra una variable concreta: precipitació acumulada, velocitat del vent a 10 metres, temperatura a 2 metres, etc. També oferim mapes de CAPE i CIN per a la previsió de tempestes.": "Las salidas de AROME se presentan en forma de mapas. Cada mapa muestra una variable concreta: precipitación acumulada, velocidad del viento a 10 metros, temperatura a 2 metros, etc. También ofrecemos mapas de CAPE y CIN para la previsión de tormentas.",

    // ----- ARTICLE 7: RADAR -----
    "El radar meteorològic: com funciona i com l'interpretem": "El radar meteorológico: cómo funciona y cómo lo interpretamos",
    "Què és un radar meteorològic?": "¿Qué es un radar meteorológico?",
    "El radar meteorològic és un instrument que emet ones de ràdio i detecta les gotes d'aigua i els cristalls de gel a l'atmosfera. Ens permet veure les precipitacions en temps real.": "El radar meteorológico es un instrumento que emite ondas de radio y detecta las gotas de agua y los cristales de hielo en la atmósfera. Nos permite ver las precipitaciones en tiempo real.",
    "El radar és una de les eines més importants per a la meteorologia operativa. Ens permet veure on està plovent en un instant determinat, la intensitat de la precipitació i la direcció cap a la qual es mouen les tempestes.": "El radar es una de las herramientas más importantes para la meteorología operativa. Nos permite ver dónde está lloviendo en un instante determinado, la intensidad de la precipitación y la dirección hacia la que se mueven las tormentas.",
    "Com funciona?": "¿Cómo funciona?",
    "El radar emet pulsos d'ones de ràdio que reboten en les partícules d'aigua. Mesurant el temps que tarden a tornar, podem saber la distància i la intensitat de la precipitació.": "El radar emite pulsos de ondas de radio que rebotan en las partículas de agua. Midiendo el tiempo que tardan en volver, podemos saber la distancia y la intensidad de la precipitación.",
    "El radar funciona com un eco. Emet un pols d'ones de ràdio que viatgen a la velocitat de la llum. Quan aquestes ones xoquen amb les gotes d'aigua o els cristalls de gel, es reflecteixen i tornen al radar. Mesurant el temps que tarden a tornar, el radar pot calcular la distància a què es troba la precipitació.": "El radar funciona como un eco. Emite un pulso de ondas de radio que viajan a la velocidad de la luz. Cuando estas ondas chocan con las gotas de agua o los cristales de hielo, se reflejan y vuelven al radar. Midiendo el tiempo que tardan en volver, el radar puede calcular la distancia a la que se encuentra la precipitación.",
    "Interpretació de les imatges": "Interpretación de las imágenes",
    "Els colors indiquen la intensitat de la precipitació: blau (pluja feble), verd (moderada), groc (forta), vermell (molt forta) i morat (torrencial).": "Los colores indican la intensidad de la precipitación: azul (lluvia débil), verde (moderada), amarillo (fuerte), rojo (muy fuerte) y morado (torrencial).",
    "La interpretació dels colors és clau per entendre el radar. El blau i el verd indiquen precipitacions febles a moderades. El groc i el vermell indiquen precipitacions fortes que poden causar inundacions. El morat indica precipitacions torrencials que requereixen una atenció especial.": "La interpretación de los colores es clave para entender el radar. El azul y el verde indican precipitaciones débiles a moderadas. El amarillo y el rojo indican precipitaciones fuertes que pueden causar inundaciones. El morado indica precipitaciones torrenciales que requieren una atención especial.",
    "Limitacions del radar": "Limitaciones del radar",
    "El radar pot tenir problemes per detectar precipitacions a llarga distància o en zones amb molta muntanya. També pot confondre gotes d'aigua amb altres objectes com ocells o insectes.": "El radar puede tener problemas para detectar precipitaciones a larga distancia o en zonas con mucha montaña. También puede confundir gotas de agua con otros objetos como pájaros o insectos.",
    "El radar té limitacions. A llarga distància, el feix d'ones de ràdio es va eixamplant i perd intensitat, per la qual cosa pot no detectar precipitacions febles. A més, les muntanyes poden bloquejar el senyal, creant zones d'ombra on el radar no pot veure res.": "El radar tiene limitaciones. A larga distancia, el haz de ondas de radio se va ensanchando y pierde intensidad, por lo que puede no detectar precipitaciones débiles. Además, las montañas pueden bloquear la señal, creando zonas de sombra donde el radar no puede ver nada.",
    "El radar a TEMPESTES.CAT": "El radar en TEMPESTES.CAT",
    "Al nostre portal tenim accés directe al radar de l'AEMET i de Meteo-France, amb actualitzacions cada 10 minuts. El combinem amb AROME per a una visió completa.": "En nuestro portal tenemos acceso directo al radar de la AEMET y de Meteo-France, con actualizaciones cada 10 minutos. Lo combinamos con AROME para una visión completa.",
    "A TEMPESTES.CAT oferim accés al radar en temps real. Utilitzem les dades dels radars de l'AEMET (Espanya) i de Meteo-France (França) per tenir una cobertura completa de Catalunya. Les imatges s'actualitzen cada 10 minuts, permetent un seguiment en temps real de les tempestes.": "En TEMPESTES.CAT ofrecemos acceso al radar en tiempo real. Utilizamos los datos de los radares de la AEMET (España) y de Meteo-France (Francia) para tener una cobertura completa de Cataluña. Las imágenes se actualizan cada 10 minutos, permitiendo un seguimiento en tiempo real de las tormentas.",
    "Consells per a l'usuari": "Consejos para el usuario",
    "El radar és una eina excel·lent per veure on plou ara, però no substitueix la previsió. Combina el radar amb els models per saber cap a on es mouen les tempestes.": "El radar es una herramienta excelente para ver dónde llueve ahora, pero no sustituye la previsión. Combina el radar con los modelos para saber hacia dónde se mueven las tormentas.",
    "El radar et diu on està plovent ara mateix. Per saber cap a on es mou la pluja i si afectarà la teva zona, cal combinar el radar amb els models de previsió (AROME, GFS). A TEMPESTES.CAT oferim una visió integrada perquè puguis fer les teves pròpies prediccions.": "El radar te dice dónde está lloviendo ahora mismo. Para saber hacia dónde se mueve la lluvia y si afectará tu zona, hay que combinar el radar con los modelos de previsión (AROME, GFS). En TEMPESTES.CAT ofrecemos una visión integrada para que puedas hacer tus propias predicciones.",

    // ----- ARTICLE 8: ENSEMBLES -----
    "Els ensembles: per què hi ha tantes previsions diferents?": "Los ensembles: ¿por qué hay tantas previsiones diferentes?",
    "Què és un ensemble?": "¿Qué es un ensemble?",
    "Un ensemble és un conjunt de múltiples simulacions del mateix model, amb petites variacions en les condicions inicials. Això permet veure la incertesa de la previsió.": "Un ensemble es un conjunto de múltiples simulaciones del mismo modelo, con pequeñas variaciones en las condiciones iniciales. Esto permite ver la incertidumbre de la previsión.",
    "Un ensemble és com una col·lecció de previsions. En lloc de fer una sola simulació, el model en fa moltes (normalment entre 20 i 50), cadascuna amb petites variacions en les condicions inicials. Això permet veure la incertesa de la previsió.": "Un ensemble es como una colección de previsiones. En lugar de hacer una sola simulación, el modelo hace muchas (normalmente entre 20 y 50), cada una con pequeñas variaciones en las condiciones iniciales. Esto permite ver la incertidumbre de la previsión.",
    "Per què calen ensembles?": "¿Por qué se necesitan ensembles?",
    "L'atmosfera és caòtica: petites variacions poden portar a resultats molt diferents. Els ensembles ens donen una idea de la probabilitat que es doni cada escenari.": "La atmósfera es caótica: pequeñas variaciones pueden llevar a resultados muy diferentes. Los ensembles nos dan una idea de la probabilidad de que se dé cada escenario.",
    "L'atmosfera és un sistema caòtic. Això vol dir que petites variacions en les condicions inicials poden portar a resultats molt diferents (l'efecte papallona). Els ensembles ens permeten quantificar aquesta incertesa i saber quina és la probabilitat que es doni cada escenari.": "La atmósfera es un sistema caótico. Esto significa que pequeñas variaciones en las condiciones iniciales pueden llevar a resultados muy diferentes (el efecto mariposa). Los ensembles nos permiten cuantificar esta incertidumbre y saber cuál es la probabilidad de que se dé cada escenario.",
    "Interpretació dels ensembles": "Interpretación de los ensembles",
    "Si tots els membres de l'ensemble coincideixen, la previsió és fiable. Si divergeixen, hi ha incertesa. La probabilitat de precipitació es calcula a partir del percentatge de membres que prediuen pluja.": "Si todos los miembros del ensemble coinciden, la previsión es fiable. Si divergen, hay incertidumbre. La probabilidad de precipitación se calcula a partir del porcentaje de miembros que predicen lluvia.",
    "Per interpretar un ensemble, cal mirar la dispersió entre els membres. Si tots els membres donen resultats similars, la previsió és fiable. Si divergeixen molt, hi ha incertesa. La probabilitat de precipitació es calcula a partir del percentatge de membres que prediuen pluja.": "Para interpretar un ensemble, hay que mirar la dispersión entre los miembros. Si todos los miembros dan resultados similares, la previsión es fiable. Si divergen mucho, hay incertidumbre. La probabilidad de precipitación se calcula a partir del porcentaje de miembros que predicen lluvia.",
    "Els ensembles a TEMPESTES.CAT": "Los ensembles en TEMPESTES.CAT",
    "Utilitzem ensembles de GFS i ECMWF per a previsions a 5-10 dies. Això ens permet oferir escenaris de reforç i tendències, no només una previsió determinista.": "Utilizamos ensembles de GFS y ECMWF para previsiones a 5-10 días. Esto nos permite ofrecer escenarios de refuerzo y tendencias, no solo una previsión determinista.",
    "A TEMPESTES.CAT oferim les sortides dels ensembles de GFS i ECMWF. Això ens permet oferir previsions a 5-10 dies amb probabilitats, no només una previsió única. Això és especialment útil per a la planificació a mitjà termini.": "En TEMPESTES.CAT ofrecemos las salidas de los ensembles de GFS y ECMWF. Esto nos permite ofrecer previsiones a 5-10 días con probabilidades, no solo una previsión única. Esto es especialmente útil para la planificación a medio plazo.",
    "L'avantatge de la incertesa": "La ventaja de la incertidumbre",
    "La incertesa no és dolenta: ens ajuda a prendre decisions. Si hi ha incertesa, sabem que cal estar atents i actualitzar la previsió diàriament.": "La incertidumbre no es mala: nos ayuda a tomar decisiones. Si hay incertidumbre, sabemos que hay que estar atentos y actualizar la previsión diariamente.",
    "La incertesa és una eina. Si hi ha incertesa, sabem que la previsió pot canviar i que cal estar atents. Això ens ajuda a prendre decisions: si la probabilitat de pluja és alta, ens preparem per a la pluja; si és baixa, ens relaxem.": "La incertidumbre es una herramienta. Si hay incertidumbre, sabemos que la previsión puede cambiar y que hay que estar atentos. Esto nos ayuda a tomar decisiones: si la probabilidad de lluvia es alta, nos preparamos para la lluvia; si es baja, nos relajamos.",
    "No et fixis només en una previsió. Mira els ensembles i la probabilitat. Si la probabilitat de pluja és del 60%, hi ha 6 de cada 10 possibilitats que plogui.": "No te fijes solo en una previsión. Mira los ensembles y la probabilidad. Si la probabilidad de lluvia es del 60%, hay 6 de cada 10 posibilidades de que llueva.",
    "La previsió determinista (un sol número) és només una part de la història. Per prendre decisions, cal mirar la probabilitat. Si la probabilitat de pluja és del 60%, hi ha més probabilitat que plogui que no pas que no plogui. Això t'ajudarà a prendre decisions més informades.": "La previsión determinista (un solo número) es solo una parte de la historia. Para tomar decisiones, hay que mirar la probabilidad. Si la probabilidad de lluvia es del 60%, hay más probabilidad de que llueva que de que no llueva. Esto te ayudará a tomar decisiones más informadas.",

        // ============================================================
    // ARTICLE 9: CANVI CLIMÀTIC
    // ============================================================
    "El canvi climàtic i les tempestes a la Mediterrània": "El cambio climático y las tormentas en el Mediterráneo",
    "Com afecta l'escalfament a la Mediterrània?": "¿Cómo afecta el calentamiento al Mediterráneo?",
    "La temperatura del mar Mediterrani ha augmentat més d'1°C en els darrers 50 anys. Això significa més humitat disponible per a les tempestes i episodis de gota freda més intensos.": "La temperatura del mar Mediterráneo ha aumentado más de 1°C en los últimos 50 años. Esto significa más humedad disponible para las tormentas y episodios de gota fría más intensos.",
    "El Mediterrani s'està escalfant més ràpidament que la mitjana global. Aquest escalfament té conseqüències directes sobre la meteorologia: més humitat a l'atmosfera, més energia per a les tempestes, i episodis de gota freda més intensos.": "El Mediterráneo se está calentando más rápidamente que la media global. Este calentamiento tiene consecuencias directas sobre la meteorología: más humedad en la atmósfera, más energía para las tormentas, y episodios de gota fría más intensos.",
    "Més tempestes intenses": "Más tormentas intensas",
    "Les tempestes seran més intenses, amb pluges més torrencials en menys temps. Això augmenta el risc d'inundacions, especialment a les zones costaneres i urbanes.": "Las tormentas serán más intensas, con lluvias más torrenciales en menos tiempo. Esto aumenta el riesgo de inundaciones, especialmente en las zonas costeras y urbanas.",
    "L'escalfament del mar augmenta l'evaporació, i per tant la humitat disponible a l'atmosfera. Quan es produeix una tempesta, aquesta humitat es converteix en pluja. Com més humitat hi ha, més pluja pot caure en menys temps, augmentant el risc d'inundacions.": "El calentamiento del mar aumenta la evaporación, y por tanto la humedad disponible en la atmósfera. Cuando se produce una tormenta, esta humedad se convierte en lluvia. Cuanta más humedad hay, más lluvia puede caer en menos tiempo, aumentando el riesgo de inundaciones.",
    "Menys tempestes però més intenses": "Menos tormentas pero más intensas",
    "Els models preveuen que hi haurà menys tempestes, però que seran més violentes. L'energia disponible serà més gran, i les tempestes podran generar més calamarsa i llamps.": "Los modelos prevén que habrá menos tormentas, pero que serán más violentas. La energía disponible será mayor, y las tormentas podrán generar más granizo y rayos.",
    "Els models climàtics preveuen una disminució del nombre de tempestes a la Mediterrània, però un augment de la seva intensitat. Això es deu al fet que l'energia disponible (CAPE) serà més gran, i les tempestes que es formin seran més violentes.": "Los modelos climáticos prevén una disminución del número de tormentas en el Mediterráneo, pero un aumento de su intensidad. Esto se debe a que la energía disponible (CAPE) será mayor, y las tormentas que se formen serán más violentas.",
    "Els episodis de gota freda seran més freqüents?": "¿Los episodios de gota fría serán más frecuentes?",
    "No és clar que siguin més freqüents, però sí que seran més intensos quan es donin. L'escalfament de l'aire i el mar afavoreix l'acumulació d'energia.": "No está claro que sean más frecuentes, pero sí que serán más intensos cuando se den. El calentamiento del aire y el mar favorece la acumulación de energía.",
    "La freqüència de les gotes fredes és un tema de debat científic. El que sembla clar és que, quan es donen, seran més intenses a causa de l'augment de la humitat i l'energia disponible. Això significa que les pluges seran més torrencials i els riscos més grans.": "La frecuencia de las gotas frías es un tema de debate científico. Lo que parece claro es que, cuando se dan, serán más intensas debido al aumento de la humedad y la energía disponible. Esto significa que las lluvias serán más torrenciales y los riesgos mayores.",
    "Què podem fer?": "¿Qué podemos hacer?",
    "Reduir les emissions és la solució a llarg termini. A curt termini, la informació i la preparació són clau: avisos precisos i plans d'emergència.": "Reducir las emisiones es la solución a largo plazo. A corto plazo, la información y la preparación son clave: avisos precisos y planes de emergencia.",
    "La solució al canvi climàtic és reduir les emissions de gasos d'efecte hivernacle. A curt termini, hem d'adaptar-nos. Això significa millorar els sistemes d'avís, preparar plans d'emergència i informar la població dels riscos.": "La solución al cambio climático es reducir las emisiones de gases de efecto invernadero. A corto plazo, tenemos que adaptarnos. Esto significa mejorar los sistemas de aviso, preparar planes de emergencia e informar a la población de los riesgos.",
    "El paper de TEMPESTES.CAT": "El papel de TEMPESTES.CAT",
    "El nostre objectiu és oferir la millor informació possible perquè la societat s'adapti. Per això millorem constantment els models i la difusió dels avisos.": "Nuestro objetivo es ofrecer la mejor información posible para que la sociedad se adapte. Por eso mejoramos constantemente los modelos y la difusión de los avisos.",
    "A TEMPESTES.CAT ens comprometem a oferir la millor informació meteorològica possible. Per això millorem constantment els nostres models i la difusió dels avisos. Volem ser una eina per a la societat en l'adaptació al canvi climàtic.": "En TEMPESTES.CAT nos comprometemos a ofrecer la mejor información meteorológica posible. Por eso mejoramos constantemente nuestros modelos y la difusión de los avisos. Queremos ser una herramienta para la sociedad en la adaptación al cambio climático.",

    // ============================================================
    // ARTICLE 10: FOEHN
    // ============================================================
    "L'efecte Foehn: per què fa calor a l'Empordà quan neva al Pirineu": "El efecto Foehn: ¿por qué hace calor en el Empordà cuando nieva en el Pirineo?",
    "Què és l'efecte Foehn?": "¿Qué es el efecto Foehn?",
    "L'efecte Foehn és un fenomen en què l'aire humit ascendint per una muntanya es refreda i plou, i en baixar per l'altre vessant s'escalfa i s'asseca. Això crea temperatures més altes a sotavent.": "El efecto Foehn es un fenómeno en el que el aire húmedo al ascender por una montaña se enfría y llueve, y al bajar por la otra vertiente se calienta y se seca. Esto crea temperaturas más altas a sotavento.",
    "L'efecte Foehn és un fenomen que es produeix quan l'aire humit es veu forçat a pujar per una muntanya. A mesura que puja, es refreda i es condensa, formant núvols i precipitacions. Quan baixa per l'altre vessant, l'aire s'escalfa i s'asseca, creant temperatures més altes i un ambient sec.": "El efecto Foehn es un fenómeno que se produce cuando el aire húmedo se ve forzado a subir por una montaña. A medida que sube, se enfría y se condensa, formando nubes y precipitaciones. Cuando baja por la otra vertiente, el aire se calienta y se seca, creando temperaturas más altas y un ambiente seco.",
    "Com es produeix a Catalunya": "Cómo se produce en Cataluña",
    "Quan el vent del sud o del sud-est porta aire humit cap als Pirineus, l'aire plou al vessant nord (França) i baixa sec i càlid al vessant sud (Catalunya). Això explica les altes temperatures a la Cerdanya i l'Empordà.": "Cuando el viento del sur o del sureste lleva aire húmedo hacia los Pirineos, el aire llueve en la vertiente norte (Francia) y baja seco y cálido en la vertiente sur (Cataluña). Esto explica las altas temperaturas en la Cerdanya y el Empordà.",
    "A Catalunya, l'efecte Foehn es produeix principalment amb vents del sud i del sud-est. L'aire humit procedent del Mediterrani puja pel vessant sud dels Pirineus, plou al vessant nord (a França) i baixa sec i càlid al vessant sud (a Catalunya).": "En Cataluña, el efecto Foehn se produce principalmente con vientos del sur y del sureste. El aire húmedo procedente del Mediterráneo sube por la vertiente sur de los Pirineos, llueve en la vertiente norte (en Francia) y baja seco y cálido en la vertiente sur (en Cataluña).",
    "Efectes sobre la meteorologia": "Efectos sobre la meteorología",
    "El Foehn provoca cels clars, temperatures altes i vents secs. També augmenta el risc d'incendis i afecta les condicions de visibilitat a les valls.": "El Foehn provoca cielos despejados, temperaturas altas y vientos secos. También aumenta el riesgo de incendios y afecta las condiciones de visibilidad en los valles.",
    "L'efecte Foehn té conseqüències importants sobre la meteorologia: cels clars (perquè l'aire és sec), temperatures altes (perquè l'aire s'escalfa en baixar) i vents secs que augmenten el risc d'incendis.": "El efecto Foehn tiene consecuencias importantes sobre la meteorología: cielos despejados (porque el aire es seco), temperaturas altas (porque el aire se calienta al bajar) y vientos secos que aumentan el riesgo de incendios.",
    "El Foehn a l'Empordà": "El Foehn en el Empordà",
    "L'Empordà és una de les zones amb més Foehn de Catalunya. Quan plou al Pirineu, a l'Empordà poden tenir dies de més de 25°C a l'hivern, mentre que a la Vall d'Aran neva.": "El Empordà es una de las zonas con más Foehn de Cataluña. Cuando llueve en el Pirineo, en el Empordà pueden tener días de más de 25°C en invierno, mientras que en la Vall d'Aran nieva.",
    "L'Empordà és un cas paradigmàtic de l'efecte Foehn. Quan els vents del sud i del sud-est porten humitat cap als Pirineus, a l'Empordà (sotavent) les temperatures poden ser molt altes, mentre que al vessant nord (França) hi ha precipitacions abundants.": "El Empordà es un caso paradigmático del efecto Foehn. Cuando los vientos del sur y del sureste llevan humedad hacia los Pirineos, en el Empordà (sotavento) las temperaturas pueden ser muy altas, mientras que en la vertiente norte (Francia) hay precipitaciones abundantes.",
    "Com ho detectem a TEMPESTES.CAT": "Cómo lo detectamos en TEMPESTES.CAT",
    "Utilitzem els models AROME i GFS per detectar situacions de Foehn. Analitzem la direcció del vent i la humitat per predir on farà més calor i on plourà.": "Utilizamos los modelos AROME y GFS para detectar situaciones de Foehn. Analizamos la dirección del viento y la humedad para predecir dónde hará más calor y dónde lloverá.",
    "A TEMPESTES.CAT detectem les situacions de Foehn analitzant la direcció del vent i la humitat prevista pels models. Quan detectem una situació de Foehn, publiquem avisos i mapes de temperatura per a les zones afectades.": "En TEMPESTES.CAT detectamos las situaciones de Foehn analizando la dirección del viento y la humedad prevista por los modelos. Cuando detectamos una situación de Foehn, publicamos avisos y mapas de temperatura para las zonas afectadas.",
    "Consells per a les zones de Foehn": "Consejos para las zonas de Foehn",
    "En episodis de Foehn, cal tenir cura amb els incendis i amb la deshidratació. També pot afectar a persones amb problemes respiratoris per la sequedat de l'aire.": "En episodios de Foehn, hay que tener cuidado con los incendios y con la deshidratación. También puede afectar a personas con problemas respiratorios por la sequedad del aire.",
    "L'aire sec del Foehn pot ser perillós. Augmenta el risc d'incendis, per la qual cosa cal extremar la precaució. També pot afectar persones amb problemes respiratoris, per la sequedat de l'aire. Es recomana beure aigua en abundància.": "El aire seco del Foehn puede ser peligroso. Aumenta el riesgo de incendios, por lo que hay que extremar la precaución. También puede afectar a personas con problemas respiratorios, por la sequedad del aire. Se recomienda beber agua en abundancia.",

    // ============================================================
    // ARTICLE 11: ESTACIONS METEOROLÒGIQUES
    // ============================================================
    "Les estacions meteorològiques: com mesurem el temps": "Las estaciones meteorológicas: cómo medimos el tiempo",
    "Què és una estació meteorològica?": "¿Qué es una estación meteorológica?",
    "Una estació meteorològica és un conjunt d'instruments que mesuren variables atmosfèriques: temperatura, pressió, humitat, vent, precipitació i radiació solar.": "Una estación meteorológica es un conjunto de instrumentos que miden variables atmosféricas: temperatura, presión, humedad, viento, precipitación y radiación solar.",
    "Una estació meteorològica és com un laboratori a l'aire lliure. Conté instruments que mesuren les principals variables atmosfèriques. Les dades d'aquestes estacions són fonamentals per a la previsió meteorològica.": "Una estación meteorológica es como un laboratorio al aire libre. Contiene instrumentos que miden las principales variables atmosféricas. Los datos de estas estaciones son fundamentales para la previsión meteorológica.",
    "El termòmetre i la temperatura": "El termómetro y la temperatura",
    "El termòmetre mesura la temperatura de l'aire en graus Celsius. Es col·loca a l'ombra, en un lloc ben ventilat, per evitar influències del sol i del terra.": "El termómetro mide la temperatura del aire en grados Celsius. Se coloca a la sombra, en un lugar bien ventilado, para evitar influencias del sol y del suelo.",
    "El termòmetre és un dels instruments més bàsics. Es col·loca dins d'una garita meteorològica, a l'ombra, per mesurar la temperatura de l'aire sense influències directes del sol o de la radiació del terra.": "El termómetro es uno de los instrumentos más básicos. Se coloca dentro de una garita meteorológica, a la sombra, para medir la temperatura del aire sin influencias directas del sol o de la radiación del suelo.",
    "El baròmetre i la pressió": "El barómetro y la presión",
    "El baròmetre mesura la pressió atmosfèrica en hectopascals (hPa). La pressió baixa indica que s'acosta una borrasca, mentre que la pressió alta porta temps estable.": "El barómetro mide la presión atmosférica en hectopascales (hPa). La presión baja indica que se acerca una borrasca, mientras que la presión alta trae tiempo estable.",
    "El baròmetre és l'instrument que mesura la pressió atmosfèrica. La pressió és una variable clau: quan baixa, indica que s'acosta una borrasca i, per tant, temps inestable. Quan puja, indica temps estable.": "El barómetro es el instrumento que mide la presión atmosférica. La presión es una variable clave: cuando baja, indica que se acerca una borrasca y, por tanto, tiempo inestable. Cuando sube, indica tiempo estable.",
    "El pluviòmetre i la precipitació": "El pluviómetro y la precipitación",
    "El pluviòmetre recull la pluja en un embut i la mesura en mil·límetres. Un mil·límetre de pluja equival a un litre per metre quadrat.": "El pluviómetro recoge la lluvia en un embudo y la mide en milímetros. Un milímetro de lluvia equivale a un litro por metro cuadrado.",
    "El pluviòmetre és l'instrument que mesura la precipitació. Recull l'aigua de pluja en un embut i la mesura en mil·límetres. Un mil·límetre de pluja equival a un litre d'aigua per metre quadrat.": "El pluviómetro es el instrumento que mide la precipitación. Recoge el agua de lluvia en un embudo y la mide en milímetros. Un milímetro de lluvia equivale a un litro de agua por metro cuadrado.",
    "L'anemòmetre i el vent": "El anemómetro y el viento",
    "L'anemòmetre mesura la velocitat i la direcció del vent. Utilitza cassoletes o hèlixs que giren amb el vent, i una veleta per a la direcció.": "El anemómetro mide la velocidad y la dirección del viento. Utiliza cazoletas o hélices que giran con el viento, y una veleta para la dirección.",
    "L'anemòmetre és l'instrument que mesura el vent. La velocitat es mesura amb cassoletes que giren amb el vent, o amb hèlixs. La direcció es mesura amb una veleta. El vent es mesura normalment en km/h o en nusos.": "El anemómetro es el instrumento que mide el viento. La velocidad se mide con cazoletas que giran con el viento, o con hélices. La dirección se mide con una veleta. El viento se mide normalmente en km/h o en nudos.",
    "Les estacions a TEMPESTES.CAT": "Las estaciones en TEMPESTES.CAT",
    "Utilitzem dades de les estacions de l'AEMET, Meteo-Cat i xarxes privades per calibrar els models i oferir previsions més precises. La qualitat de les dades és clau.": "Utilizamos datos de las estaciones de la AEMET, Meteo-Cat y redes privadas para calibrar los modelos y ofrecer previsiones más precisas. La calidad de los datos es clave.",
    "A TEMPESTES.CAT utilitzem dades de diferents xarxes d'estacions: l'AEMET (xarxa oficial espanyola), Meteo-Cat (xarxa oficial catalana) i xarxes privades de particulars. Aquestes dades s'utilitzen per calibrar els models i validar les previsions.": "En TEMPESTES.CAT utilizamos datos de diferentes redes de estaciones: la AEMET (red oficial española), Meteo-Cat (red oficial catalana) y redes privadas de particulares. Estos datos se utilizan para calibrar los modelos y validar las previsiones.",

    // ============================================================
    // ARTICLE 12: BORRASQUES
    // ============================================================
    "Les borrasques mediterrànies: com es formen i com ens afecten": "Las borrascas mediterráneas: cómo se forman y cómo nos afectan",
    "Què és una borrasca mediterrània?": "¿Qué es una borrasca mediterránea?",
    "Una borrasca és una zona de baixa pressió atmosfèrica. Al Mediterrani, es formen quan l'aire fred de l'Atlàntic xoca amb l'aire càlid i humit del mar Mediterrani.": "Una borrasca es una zona de baja presión atmosférica. En el Mediterráneo, se forman cuando el aire frío del Atlántico choca con el aire cálido y húmedo del mar Mediterráneo.",
    "Una borrasca és una zona de baixa pressió on l'aire ascendeix, es refreda i es condensa, formant núvols i precipitacions. Al Mediterrani, les borrasques es formen sovint pel xoc entre l'aire fred de l'Atlàntic i l'aire càlid i humit del Mediterrani.": "Una borrasca es una zona de baja presión donde el aire asciende, se enfría y se condensa, formando nubes y precipitaciones. En el Mediterráneo, las borrascas se forman a menudo por el choque entre el aire frío del Atlántico y el aire cálido y húmedo del Mediterráneo.",
    "Les fases de formació": "Las fases de formación",
    "Una borrasca es forma en tres fases: inici (pertorbació), desenvolupament (intensificació) i maduresa (màxima activitat). Les borrasques mediterrànies solen ser ràpides i intenses.": "Una borrasca se forma en tres fases: inicio (perturbación), desarrollo (intensificación) y madurez (máxima actividad). Las borrascas mediterráneas suelen ser rápidas e intensas.",
    "Una borrasca passa per tres fases: inici (quan es forma la pertorbació), desenvolupament (quan s'intensifica) i maduresa (quan arriba al màxim d'activitat). Les borrasques mediterrànies solen ser més ràpides i intenses que les atlàntiques, a causa de les temperatures més altes del mar.": "Una borrasca pasa por tres fases: inicio (cuando se forma la perturbación), desarrollo (cuando se intensifica) y madurez (cuando llega al máximo de actividad). Las borrascas mediterráneas suelen ser más rápidas e intensas que las atlánticas, debido a las temperaturas más altas del mar.",
    "Els efectes a Catalunya": "Los efectos en Cataluña",
    "Les borrasques mediterrànies porten pluges intenses, vent fort i, sovint, tempestes. Són la principal causa dels episodis de gota freda al nostre territori.": "Las borrascas mediterráneas traen lluvias intensas, viento fuerte y, a menudo, tormentas. Son la principal causa de los episodios de gota fría en nuestro territorio.",
    "Les borrasques mediterrànies són responsables de la major part de les precipitacions intenses a Catalunya. Poden provocar pluges torrencials, vents forts i tempestes. Són la principal causa dels episodis de gota freda, especialment a la tardor.": "Las borrascas mediterráneas son responsables de la mayor parte de las precipitaciones intensas en Cataluña. Pueden provocar lluvias torrenciales, vientos fuertes y tormentas. Son la principal causa de los episodios de gota fría, especialmente en otoño.",
    "Com les detectem a TEMPESTES.CAT": "Cómo las detectamos en TEMPESTES.CAT",
    "Utilitzem els mapes de pressió dels models GFS i ECMWF per identificar borrasques. També analitzem la trajectòria de les pertorbacions per anticipar els seus efectes.": "Utilizamos los mapas de presión de los modelos GFS y ECMWF para identificar borrascas. También analizamos la trayectoria de las perturbaciones para anticipar sus efectos.",
    "A TEMPESTES.CAT detectem les borrasques analitzant els mapes de pressió dels models globals (GFS, ECMWF). Quan detectem una borrasca, analitzem la seva trajectòria per anticipar quines zones es veuran afectades.": "En TEMPESTES.CAT detectamos las borrascas analizando los mapas de presión de los modelos globales (GFS, ECMWF). Cuando detectamos una borrasca, analizamos su trayectoria para anticipar qué zonas se verán afectadas.",
    "La borrasca típica catalana": "La borrasca típica catalana",
    "Normalment, una borrasca ens arriba des del sud-oest (Península) o des del sud-est (Mediterrani). Les del sud-est solen ser més humides i intenses.": "Normalmente, una borrasca nos llega desde el suroeste (Península) o desde el sureste (Mediterráneo). Las del sureste suelen ser más húmedas e intensas.",
    "Les borrasques que afecten Catalunya solen arribar de dues direccions: del sud-oest (a través de la Península) o del sud-est (directament del Mediterrani). Les del sud-est solen ser més humides i intenses.": "Las borrascas que afectan Cataluña suelen llegar de dos direcciones: del suroeste (a través de la Península) o del sureste (directamente del Mediterráneo). Las del sureste suelen ser más húmedas e intensas.",
    "Consells per a episodis de borrasca": "Consejos para episodios de borrasca",
    "En episodis de borrasca, consulta els avisos de TEMPESTES.CAT i Protecció Civil. Evita zones inundables i no circulis per carreteres amb risc de lliscament.": "En episodios de borrasca, consulta los avisos de TEMPESTES.CAT y Protección Civil. Evita zonas inundables y no circules por carreteras con riesgo de deslizamiento.",
    "Les borrasques poden ser perilloses, especialment si van acompanyades de pluges intenses. És important estar informat i seguir les recomanacions de Protecció Civil. Evita zones inundables i no circulis per carreteres amb risc de lliscament de terra.": "Las borrascas pueden ser peligrosas, especialmente si van acompañadas de lluvias intensas. Es importante estar informado y seguir las recomendaciones de Protección Civil. Evita zonas inundables y no circules por carreteras con riesgo de deslizamiento de tierra.",

    // ============================================================
    // ARTICLE 13: MUNTANYES
    // ============================================================
    "L'efecte de les muntanyes en el clima català": "El efecto de las montañas en el clima catalán",
    "El Pirineu: barrera climàtica": "El Pirineo: barrera climática",
    "El Pirineu és una barrera que separa l'aire atlàntic humit de l'aire mediterrani. Això crea un gradient de precipitació molt marcat: més pluja al nord, menys al sud.": "El Pirineo es una barrera que separa el aire atlántico húmedo del aire mediterráneo. Esto crea un gradiente de precipitación muy marcado: más lluvia al norte, menos al sur.",
    "El Pirineu és la principal barrera climàtica de Catalunya. Separa l'aire humit de l'Atlàntic (que plou al vessant nord) de l'aire mediterrani (que plou al vessant sud). Això crea un gradient de precipitació molt marcat.": "El Pirineo es la principal barrera climática de Cataluña. Separa el aire húmedo del Atlántico (que llueve en la vertiente norte) del aire mediterráneo (que llueve en la vertiente sur). Esto crea un gradiente de precipitación muy marcado.",
    "El Prepirineu i la Depressió Central": "El Prepirineo y la Depresión Central",
    "El Prepirineu és una zona de transició. La Depressió Central, entre el Pirineu i la Serralada Litoral, és la zona més seca de Catalunya a causa de l'ombra orogràfica.": "El Prepirineo es una zona de transición. La Depresión Central, entre el Pirineo y la Serralada Litoral, es la zona más seca de Cataluña debido a la sombra orográfica.",
    "El Prepirineu és la zona de transició entre el Pirineu i la Depressió Central. La Depressió Central és la zona més seca de Catalunya a causa de l'ombra orogràfica: les muntanyes del Pirineu i del Prepirineu bloquegen les precipitacions.": "El Prepirineo es la zona de transición entre el Pirineo y la Depresión Central. La Depresión Central es la zona más seca de Cataluña debido a la sombra orográfica: las montañas del Pirineo y del Prepirineo bloquean las precipitaciones.",
    "La Serralada Litoral": "La Serralada Litoral",
    "La Serralada Litoral (Collserola, Montseny) atura les pluges procedents del mar. Això explica que a la costa hi plogui més que a l'interior de la Depressió Central.": "La Serralada Litoral (Collserola, Montseny) detiene las lluvias procedentes del mar. Esto explica que en la costa llueva más que en el interior de la Depresión Central.",
    "La Serralada Litoral és la darrera barrera abans del mar. Atura les pluges procedents del Mediterrani, de manera que a la costa hi plou més que a l'interior. Això explica per què el Maresme i el Baix Ebre tenen més precipitacions.": "La Serralada Litoral es la última barrera antes del mar. Detiene las lluvias procedentes del Mediterráneo, de manera que en la costa llueve más que en el interior. Esto explica por qué el Maresme y el Baix Ebre tienen más precipitaciones.",
    "Els microclimes": "Los microclimas",
    "Les muntanyes creen microclimes. El Vallès, el Maresme, l'Empordà i les Terres de l'Ebre tenen climats molt diferents a causa de la seva ubicació i orientació.": "Las montañas crean microclimas. El Vallès, el Maresme, el Empordà y las Terres de l'Ebre tienen climas muy diferentes debido a su ubicación y orientación.",
    "Les muntanyes creen microclimes, és a dir, climes locals que poden ser molt diferents de la mitjana regional. El Vallès, el Maresme, l'Empordà i les Terres de l'Ebre tenen climats molt diferents.": "Las montañas crean microclimas, es decir, climas locales que pueden ser muy diferentes de la media regional. El Vallès, el Maresme, el Empordà y las Terres de l'Ebre tienen climas muy diferentes.",
    "Com ho tenim en compte a TEMPESTES.CAT": "Cómo lo tenemos en cuenta en TEMPESTES.CAT",
    "El model AROME, amb resolució de 1.3km, captura aquests efectes locals. Això ens permet fer previsions molt concretes per a cada comarca, no només per a Catalunya en general.": "El modelo AROME, con resolución de 1.3km, captura estos efectos locales. Esto nos permite hacer previsiones muy concretas para cada comarca, no solo para Cataluña en general.",
    "AROME, amb la seva resolució de 1.3 km, és capaç de capturar els efectes locals de les muntanyes. Això ens permet fer previsions molt concretes per a cada comarca, tenint en compte les particularitats del relleu.": "AROME, con su resolución de 1.3 km, es capaz de capturar los efectos locales de las montañas. Esto nos permite hacer previsiones muy concretas para cada comarca, teniendo en cuenta las particularidades del relieve.",
    "Consells per a cada zona": "Consejos para cada zona",
    "Si vius a prop del mar, prepara't per a tempestes més freqüents. Si vius a l'interior, les pluges seran menys intenses però més irregulars. Consulta les previsions específiques.": "Si vives cerca del mar, prepárate para tormentas más frecuentes. Si vives en el interior, las lluvias serán menos intensas pero más irregulares. Consulta las previsiones específicas.",
    "Cada zona de Catalunya té les seves particularitats. Si vius a la costa, prepara't per a tempestes més freqüents i precipitacions més intenses. Si vius a l'interior, les pluges seran menys intenses però més irregulars.": "Cada zona de Cataluña tiene sus particularidades. Si vives en la costa, prepárate para tormentas más frecuentes y precipitaciones más intensas. Si vives en el interior, las lluvias serán menos intensas pero más irregulares.",    // ============================================================
    // ARTICLE 14: PRECIPITACIÓ
    // ============================================================
    "Com interpretar un mapa de precipitació?": "¿Cómo interpretar un mapa de precipitación?",
    "Com interpretar un mapa de precipitació de AROME": "Cómo interpretar un mapa de precipitación de AROME",
    "Què mostren els mapes?": "¿Qué muestran los mapas?",
    "Els mapes de precipitació d'AROME mostren la quantitat de pluja prevista en un període determinat (1h, 3h, 12h, 24h). Els colors indiquen la intensitat: blau (feble), verd (moderada), groc (forta), vermell (molt forta).": "Los mapas de precipitación de AROME muestran la cantidad de lluvia prevista en un período determinado (1h, 3h, 12h, 24h). Los colores indican la intensidad: azul (débil), verde (moderada), amarillo (fuerte), rojo (muy fuerte).",
    "Els mapes de precipitació són una de les eines més utilitzades per als meteoròlegs. Mostren la quantitat de pluja prevista en un període determinat. Els colors permeten identificar ràpidament les zones amb més intensitat de precipitació.": "Los mapas de precipitación son una de las herramientas más utilizadas por los meteorólogos. Muestran la cantidad de lluvia prevista en un período determinado. Los colores permiten identificar rápidamente las zonas con más intensidad de precipitación.",
    "Interpretació dels colors": "Interpretación de los colores",
    "Blau: 0-2 mm/h. Verd: 2-10 mm/h. Groc: 10-25 mm/h. Vermell: 25-50 mm/h. Morat: >50 mm/h (torrencial).": "Azul: 0-2 mm/h. Verde: 2-10 mm/h. Amarillo: 10-25 mm/h. Rojo: 25-50 mm/h. Morado: >50 mm/h (torrencial).",
    "La interpretació dels colors és clau. El blau indica precipitació feble, el verd moderada, el groc forta, el vermell molt forta i el morat torrencial. Aquesta escala ens permet identificar ràpidament les zones amb més risc d'inundació.": "La interpretación de los colores es clave. El azul indica precipitación débil, el verde moderada, el amarillo fuerte, el rojo muy fuerte y el morado torrencial. Esta escala nos permite identificar rápidamente las zonas con más riesgo de inundación.",
    "El factor temporal": "El factor temporal",
    "La pluja acumulada en 24h és més important que la intensitat instantània. Una pluja de 5 mm/h durant 6 hores (30 mm) pot ser més perillosa que una de 30 mm/h durant 1 hora.": "La lluvia acumulada en 24h es más importante que la intensidad instantánea. Una lluvia de 5 mm/h durante 6 horas (30 mm) puede ser más peligrosa que una de 30 mm/h durante 1 hora.",
    "No tot és la intensitat. La pluja acumulada en 24 hores és més important que la intensitat instantània. Una pluja moderada però persistent pot acumular més aigua que una pluja intensa però curta.": "No todo es la intensidad. La lluvia acumulada en 24 horas es más importante que la intensidad instantánea. Una lluvia moderada pero persistente puede acumular más agua que una lluvia intensa pero corta.",
    "Com es mouen les precipitacions": "Cómo se mueven las precipitaciones",
    "Observa la direcció de les bandes de precipitació. A Catalunya, les pluges solen venir del sud-est o del nord-oest. AROME mostra la trajectòria de les tempestes.": "Observa la dirección de las bandas de precipitación. En Cataluña, las lluvias suelen venir del sureste o del noroeste. AROME muestra la trayectoria de las tormentas.",
    "Les precipitacions es mouen. És important observar la direcció de les bandes de precipitació per saber si afectaran la teva zona. A Catalunya, les pluges solen venir del sud-est (Mediterrani) o del nord-oest (Atlàntic).": "Las precipitaciones se mueven. Es importante observar la dirección de las bandas de precipitación para saber si afectarán tu zona. En Cataluña, las lluvias suelen venir del sureste (Mediterráneo) o del noroeste (Atlántico).",
    "El radar i AROME junts": "El radar y AROME juntos",
    "El radar mostra on plou ara, i AROME prediu on plourà. A TEMPESTES.CAT els combinem per tenir una visió completa: el radar per a la situació actual i AROME per a les properes hores.": "El radar muestra dónde llueve ahora, y AROME predice dónde lloverá. En TEMPESTES.CAT los combinamos para tener una visión completa: el radar para la situación actual y AROME para las próximas horas.",
    "La combinació del radar i AROME és la millor estratègia. El radar et mostra on està plovent ara, i AROME et mostra on plourà en les properes hores. A TEMPESTES.CAT oferim aquesta visió integrada.": "La combinación del radar y AROME es la mejor estrategia. El radar te muestra dónde está lloviendo ahora, y AROME te muestra dónde lloverá en las próximas horas. En TEMPESTES.CAT ofrecemos esta visión integrada.",
    "No et fixis només en el color més intens. Mira l'evolució temporal: cap a on es mouen les precipitacions? S'intensifiquen o es debiliten? Això et donarà una idea de què passarà.": "No te fijes solo en el color más intenso. Mira la evolución temporal: ¿hacia dónde se mueven las precipitaciones? ¿Se intensifican o se debilitan? Esto te dará una idea de qué pasará.",
    "Per interpretar correctament un mapa de precipitació, no et fixis només en el color més intens. Mira l'evolució temporal: cap a on es mouen les precipitacions? S'intensifiquen o es debiliten? Això et donarà una idea de què passarà.": "Para interpretar correctamente un mapa de precipitación, no te fijes solo en el color más intenso. Mira la evolución temporal: ¿hacia dónde se mueven las precipitaciones? ¿Se intensifican o se debilitan? Esto te dará una idea de qué pasará.",

    // ============================================================
    // ARTICLE 15: CAÇADORS DE TEMPESTES
    // ============================================================
    "La previsió de tempestes per a caçadors de tempestes": "La previsión de tormentas para cazatormentas",
    "Què és un caçador de tempestes?": "¿Qué es un cazatormentas?",
    "Un caçador de tempestes és una persona que persegueix tempestes per fotografiar-les, filmar-les o estudiar-les. És una activitat que requereix coneixements meteorològics i mesures de seguretat.": "Un cazatormentas es una persona que persigue tormentas para fotografiarlas, filmarlas o estudiarlas. Es una actividad que requiere conocimientos meteorológicos y medidas de seguridad.",
    "Els caçadors de tempestes són apassionats de la meteorologia que persegueixen tempestes per capturar imatges espectaculars o per estudiar fenòmens meteorològics. És una activitat que requereix coneixements tècnics i molta precaució.": "Los cazatormentas son apasionados de la meteorología que persiguen tormentas para capturar imágenes espectaculares o para estudiar fenómenos meteorológicos. Es una actividad que requiere conocimientos técnicos y mucha precaución.",
    "Les eines del caçador": "Las herramientas del cazador",
    "Un caçador necessita: un telèfon amb accés a radar i models, una càmera, roba impermeable, i un vehicle segur. A TEMPESTES.CAT oferim les eines digitals per planificar la caça.": "Un cazador necesita: un teléfono con acceso a radar y modelos, una cámara, ropa impermeable, y un vehículo seguro. En TEMPESTES.CAT ofrecemos las herramientas digitales para planificar la caza.",
    "Per ser un bon caçador de tempestes cal tenir les eines adequades: un telèfon mòbil amb accés al radar i als models (com els que oferim a TEMPESTES.CAT), una càmera de qualitat, roba impermeable i un vehicle segur per desplaçar-se.": "Para ser un buen cazatormentas hay que tener las herramientas adecuadas: un teléfono móvil con acceso al radar y a los modelos (como los que ofrecemos en TEMPESTES.CAT), una cámara de calidad, ropa impermeable y un vehículo seguro para desplazarse.",
    "On caçar tempestes a Catalunya": "Dónde cazar tormentas en Cataluña",
    "Les millors zones són l'Empordà, el Maresme, el Montsià i el Pirineu. A l'Empordà hi ha tempestes de gran bellesa visual a l'estiu, amb estructures de núvols impressionants.": "Las mejores zonas son el Empordà, el Maresme, el Montsià y el Pirineo. En el Empordà hay tormentas de gran belleza visual en verano, con estructuras de nubes impresionantes.",
    "Catalunya té zones excepcionals per a la caça de tempestes. L'Empordà és famosa per les seves tempestes estivals, amb estructures de núvols impressionants. El Maresme i el Montsià també són zones ideals, especialment en episodis de gota freda.": "Cataluña tiene zonas excepcionales para la caza de tormentas. El Empordà es famosa por sus tormentas estivales, con estructuras de nubes impresionantes. El Maresme y el Montsià también son zonas ideales, especialmente en episodios de gota fría.",
    "Com planificar una caça": "Cómo planificar una caza",
    "Consulta la previsió d'AROME per a la inestabilitat (CAPE) i la direcció del vent. Busca zones on el CAPE sigui alt i hi hagi poca cizalla, per a tempestes verticals. Utilitza el radar per seguir les tempestes en temps real.": "Consulta la previsión de AROME para la inestabilidad (CAPE) y la dirección del viento. Busca zonas donde el CAPE sea alto y haya poca cizalla, para tormentas verticales. Utiliza el radar para seguir las tormentas en tiempo real.",
    "Per planificar una caça de tempestes, cal consultar les previsions d'inestabilitat (CAPE) i la direcció del vent. Busca zones on el CAPE sigui alt i el cisallament sigui baix, per a tempestes verticals i ben estructurades.": "Para planificar una caza de tormentas, hay que consultar las previsiones de inestabilidad (CAPE) y la dirección del viento. Busca zonas donde el CAPE sea alto y el cizallamiento sea bajo, para tormentas verticales y bien estructuradas.",
    "Seguretat en la caça de tempestes": "Seguridad en la caza de tormentas",
    "Mantén una distància de seguretat de les tempestes (almenys 5 km). No et posis sota arbres aïllats. Evita zones inundables i camins de terra que es puguin convertir en fang. Sempre informa algú de la teva ubicació.": "Mantén una distancia de seguridad de las tormentas (al menos 5 km). No te pongas bajo árboles aislados. Evita zonas inundables y caminos de tierra que se puedan convertir en barro. Siempre informa a alguien de tu ubicación.",
    "La seguretat és el més important en la caça de tempestes. Mantén una distància de seguretat de les tempestes (almenys 5 km). No et posis sota arbres aïllats (són un imant per als llamps). Evita zones inundables i camins de terra.": "La seguridad es lo más importante en la caza de tormentas. Mantén una distancia de seguridad de las tormentas (al menos 5 km). No te pongas bajo árboles aislados (son un imán para los rayos). Evita zonas inundables y caminos de tierra.",
    "El codi ètic del caçador": "El código ético del cazador",
    "Respecta les propietats i les persones. No obstaculitzis el trànsit. Comparteix les teves fotos i dades amb la comunitat per millorar la ciència. A TEMPESTES.CAT donem suport a aquesta comunitat.": "Respeta las propiedades y las personas. No obstaculices el tráfico. Comparte tus fotos y datos con la comunidad para mejorar la ciencia. En TEMPESTES.CAT damos apoyo a esta comunidad.",
    "Els caçadors de tempestes tenen un codi ètic: respectar les propietats i les persones, no obstaculitzar el trànsit i compartir les fotos i les dades amb la comunitat. A TEMPESTES.CAT donem suport a aquesta comunitat, oferint eines i difonent les seves imatges.": "Los cazatormentas tienen un código ético: respetar las propiedades y las personas, no obstaculizar el tráfico y compartir las fotos y los datos con la comunidad. En TEMPESTES.CAT damos apoyo a esta comunidad, ofreciendo herramientas y difundiendo sus imágenes.",

    // ============================================================
    // POLÍTICA DE PRIVACITAT (COMPLET)
    // ============================================================
    "Política de Privacitat": "Política de Privacidad",
    "Política de privacitat de TEMPESTES.CAT": "Política de privacidad de TEMPESTES.CAT",
    "Responsable del tractament:": "Responsable del tratamiento:",
    "A TEMPESTES.CAT respectem la teva privacitat. Aquesta política explica quines dades recollim, com les utilitzem i quins drets tens.": "En TEMPESTES.CAT respetamos tu privacidad. Esta política explica qué datos recogemos, cómo los utilizamos y qué derechos tienes.",
    "1. Quines dades recollim": "1. ¿Qué datos recogemos?",
    "Dades de contacte:": "Datos de contacto:",
    "nom i correu electrònic (si ens contactes).": "nombre y correo electrónico (si nos contactas).",
    "Dades d'ús:": "Datos de uso:",
    "adreça IP, navegador, pàgines visitades (mitjançant Google Analytics).": "dirección IP, navegador, páginas visitadas (mediante Google Analytics).",
    "Cookies:": "Cookies:",
    "utilitzem cookies per millorar l'experiència d'usuari.": "utilizamos cookies para mejorar la experiencia de usuario.",
    "2. Com utilitzem les dades": "2. ¿Cómo utilizamos los datos?",
    "Per respondre a les teves consultes.": "Para responder a tus consultas.",
    "Per millorar el contingut i la navegació.": "Para mejorar el contenido y la navegación.",
    "Per mostrar anuncis rellevants (Google AdSense).": "Para mostrar anuncios relevantes (Google AdSense).",
    "3. Drets de l'usuari": "3. Derechos del usuario",
    "Accedir, rectificar o suprimir les teves dades.": "Acceder, rectificar o suprimir tus datos.",
    "Oposar-te al tractament de les teves dades.": "Oponerte al tratamiento de tus datos.",
    "Sol·licitar la portabilitat de les dades.": "Solicitar la portabilidad de los datos.",
    "Pots exercir els teus drets escrivint a": "Puedes ejercer tus derechos escribiendo a",
    "4. Cookies": "4. Cookies",
    "Utilitzem cookies pròpies i de tercers (Google Analytics, AdSense) per analitzar el trànsit i mostrar anuncis. Pots gestionar les cookies des del teu navegador o mitjançant el nostre panell de cookies.": "Utilizamos cookies propias y de terceros (Google Analytics, AdSense) para analizar el tráfico y mostrar anuncios. Puedes gestionar las cookies desde tu navegador o mediante nuestro panel de cookies.",
    "Última actualització: 26 d'agost de 2026": "Última actualización: 26 de agosto de 2026",

    // ============================================================
    // CONTACTE (COMPLET)
    // ============================================================
    "Tens alguna pregunta o suggeriment? Escriu-nos!": "¿Tienes alguna pregunta o sugerencia? ¡Escríbenos!",
    "El teu nom": "Tu nombre",
    "Correu electrònic": "Correo electrónico",
    "Missatge": "Mensaje",
    "He llegit i accepto la": "He leído y acepto la",
    "Política de Privacitat": "Política de Privacidad",
    "Les meves dades seran tractades per respondre a la meva consulta.": "Mis datos serán tratados para responder a mi consulta.",
    "Enviar missatge": "Enviar mensaje",
    "També pots escriure'ns directament a": "También puedes escribirnos directamente a",
    "Ja has enviat un missatge recentment. Pots tornar a enviar en": "Ya has enviado un mensaje recientemente. Puedes volver a enviar en",

    // ============================================================
    // SECTORS (COMPLET)
    // ============================================================
    "Qui fa servir TEMPESTES.CAT?": "¿Quién usa TEMPESTES.CAT?",
    "Agricultura": "Agricultura",
    "Muntanya": "Montaña",
    "Nàutica": "Náutica",
    "Transport": "Transporte",
    "Protecció Civil": "Protección Civil",
    "Caçatempestes": "Cazatormentas",

    // ============================================================
    // FOOTER (COMPLET)
    // ============================================================
    "Avís legal": "Aviso legal",
    "Dades de Meteo-France, NOAA i ECMWF. Mapes i dades elaborats per": "Datos de Meteo-France, NOAA y ECMWF. Mapas y datos elaborados por",
    "Responsable: Simo Garcia · meteomaresme@gmail.com": "Responsable: Simo Garcia · meteomaresme@gmail.com",
    "AROME 1.3km · AROME-PI · GFS 0.25º": "AROME 1.3km · AROME-PI · GFS 0.25º",
    "Política de Cookies": "Política de Cookies",

    // ============================================================
    // COOKIES BANNER (COMPLET)
    // ============================================================
    "Utilitzem cookies pròpies i de tercers per millorar la navegació, analitzar el trànsit i mostrar anuncis rellevants. Pots acceptar-les o rebutjar-les. Més informació a la": "Utilizamos cookies propias y de terceros para mejorar la navegación, analizar el tráfico y mostrar anuncios relevantes. Puedes aceptarlas o rechazarlas. Más información en la",
    "Acceptar": "Aceptar",
    "Rebutjar": "Rechazar",

    // ============================================================
    // MODAL PERFIL (COMPLET)
    // ============================================================
    "El meu perfil": "Mi perfil",
    "Nom": "Nombre",
    "Email": "Email",
    "Desar": "Guardar",
    "Sortir": "Salir",

    // ============================================================
    // SIDE PANEL (COMPLET)
    // ============================================================
    "AROME": "AROME",
    "Alta resolució 1.3km, nivells, skew-T i convecció.": "Alta resolución 1.3km, niveles, skew-T y convección.",
    "Previsions (Ensembles)": "Previsiones (Ensamble)",
    "Escenaris i models de reforç a curt termini.": "Escenarios y modelos de refuerzo a corto plazo.",
    "Visor d'onades (MFWAM0025)": "Visor de olas (MFWAM0025)",
    "Alçada, període, direcció, mar de vent i swell.": "Altura, período, dirección, mar de viento y swell.",
    "Fòrum d'episodis": "Foro de episodios",
    "Pluges torrencials, nevades, calor i vents forts.": "Lluvias torrenciales, nevadas, calor y vientos fuertes.",
    "Radar meteorològic": "Radar meteorológico",
    "Reflectivitat en temps real cada 10 min.": "Reflectividad en tiempo real cada 10 min.",

    // ============================================================
    // QUI SOM (COMPLET)
    // ============================================================
    "Qui som": "Quiénes somos",
    "Coneix l'equip de TEMPESTES.CAT": "Conoce el equipo de TEMPESTES.CAT",
    "Ens presentem": "Nos presentamos",
    "Som un equip de meteoròlegs apassionats dedicats a oferir la millor previsió per a Catalunya. La nostra missió és ajudar-te a entendre el temps que farà i a preparar-te per a qualsevol fenòmen extrem.": "Somos un equipo de meteorólogos apasionados dedicados a ofrecer la mejor previsión para Cataluña. Nuestra misión es ayudarte a entender el tiempo que hará y a prepararte para cualquier fenómeno extremo.",
    "Tempestes.cat": "Tempestes.cat",
    "Apassionat · Fundador de la web": "Apasionado · Fundador de la web",
    "Meteo.Felix": "Meteo.Felix",
    "Apassionat · Col·laborador": "Apasionado · Colaborador",
    "Lameteo.cat": "Lameteo.cat",
    "Apassionat · Desenvolupador": "Apasionado · Desarrollador",
    "Visitar MeteoVigilancia": "Visitar MeteoVigilancia",
    "Visitar Lameteo.cat": "Visitar Lameteo.cat",

    // ============================================================
    // QUI SOM - DESCRIPCIONS COMPLETES
    // ============================================================
    "Des de ben petit, pràcticament des dels 6 anys, he sentit una fascinació absoluta per la meteorologia. Em passava hores mirant el cel, meravellat pels canvis de temps i per tota la força de la natura. Va ser l'any 2022 quan vaig decidir fer un pas ferm. Ja no em conformava a ser un simple espectador; volia entendre què s'amagava darrere del que veia, més enllà de simples núvols o llamps llunyans. A poc a poc, amb moltes hores d'aprenentatge, interpretant mapes i amb molta pràctica diària, vaig començar a entendre com funciona l'atmosfera. Avui dia, ja puc interpretar el cel amb criteri propi i tenir una idea clara de si avui plourà o no.": "Desde pequeño, prácticamente desde los 6 años, he sentido una fascinación absoluta por la meteorología. Pasaba horas mirando el cielo, maravillado por los cambios de tiempo y por toda la fuerza de la naturaleza. Fue en 2022 cuando decidí dar un paso firme. Ya no me conformaba con ser un simple espectador; quería entender qué se escondía detrás de lo que veía, más allá de simples nubes o rayos lejanos. Poco a poco, con muchas horas de aprendizaje, interpretando mapas y con mucha práctica diaria, empecé a entender cómo funciona la atmósfera. Hoy en día, ya puedo interpretar el cielo con criterio propio y tener una idea clara de si hoy lloverá o no.",

    "Vaig Fundadar MeteoVigilància i una de les peces més importants de Tempestes.cat. Vam començar junts en aquest món durant l'estiu de 2024, compartint la passió per la meteorologia, les tempestes i la caça de fenòmens extrems. Des d'aleshores, hem anat creixent i aprenent plegats dins d'aquest projecte. És el fundador de MeteoVigilància, una aplicació que permet situar i compartir avisos de fenòmens meteorològics severs arreu de Catalunya, ajudant a entendre en quines zones poden estar causant més afectacions.": "Fundé MeteoVigilància y soy una de las piezas más importantes de Tempestes.cat. Empezamos juntos en este mundo durante el verano de 2024, compartiendo la pasión por la meteorología, las tormentas y la caza de fenómenos extremos. Desde entonces, hemos ido creciendo y aprendiendo juntos dentro de este proyecto. Soy el fundador de MeteoVigilància, una aplicación que permite situar y compartir avisos de fenómenos meteorológicos severos en toda Cataluña, ayudando a entender en qué zonas pueden estar causando más afectaciones.",

    "M'agrada molt programar i m'he especialitzat en la visualització de dades meteorològiques. Treballo diàriament amb informació a gran escala i petita, transformant dades complexes en entorns visuals senzills d'entendre. La meva passió és agafar tota aquesta complexitat atmosfèrica i fer-la totalment accessible. Per aconseguir-ho, em dedico a crear moltes eines digitals i visors interactius d'alta precisió. El meu objectiu principal és que els usuaris puguin entendre l'evolució del temps d'un sol cop d'ull. A través d'interfícies ben dissenyades i intuïtives com appstore i applestore i PC, faig possible que tota aquesta densa informació sigui sempre una experiència molt clara i útil.": "Me gusta mucho programar y me he especializado en la visualización de datos meteorológicos. Trabajo diariamente con información a gran escala y pequeña, transformando datos complejos en entornos visuales sencillos de entender. Mi pasión es coger toda esta complejidad atmosférica y hacerla totalmente accesible. Para conseguirlo, me dedico a crear muchas herramientas digitales y visores interactivos de alta precisión. Mi objetivo principal es que los usuarios puedan entender la evolución del tiempo de un solo vistazo. A través de interfaces bien diseñadas e intuitivas como appstore y applestore y PC, hago posible que toda esta densa información sea siempre una experiencia muy clara y útil.",

    // ============================================================
    // ALTRES TEXTOS QUE PODEN APARÈIXER
    // ============================================================
    "Castellano": "Castellano",
    "Català": "Català",
    "TEMPESTES.CAT · Previsió Meteorològica Professional": "TEMPESTES.CAT · Previsión Meteorológica Profesional",
    "Previsió meteorològica professional d'alta resolució per a Catalunya. Informació sobre tempestes, fenòmens extrems, radar, onatge i models AROME.": "Previsión meteorológica profesional de alta resolución para Cataluña. Información sobre tormentas, fenómenos extremos, radar, oleaje y modelos AROME.",
    "TEMPESTES.CAT · 2026": "TEMPESTES.CAT · 2026",
    "X": "X",
    "Instagram": "Instagram",
    "TEMPESTES.CAT": "TEMPESTES.CAT",

    // ============================================================
    // ETIQUETES DELS CAÇADORS (per l'article 15)
    // ============================================================
    "@Meteo.Felix": "@Meteo.Felix",
    "@Meteo_nordeste": "@Meteo_nordeste",
    "@Tempestes.cat": "@Tempestes.cat",
    "@ruben.aibar.martinez": "@ruben.aibar.martinez",

    // ============================================================
    // MISSATGES DE CONTACTE (feedback)
    // ============================================================
    "✅ Missatge enviat correctament! Et respondrem en 24h.": "✅ ¡Mensaje enviado correctamente! Te responderemos en 24h.",
    "❌ Error en enviar el missatge. Prova de nou més tard.": "❌ Error al enviar el mensaje. Inténtalo de nuevo más tarde.",
    "Si us plau, omple tots els camps.": "Por favor, completa todos los campos.",
    "Has d'acceptar la política de privacitat.": "Debes aceptar la política de privacidad.",
    "Si us plau, introdueix un correu electrònic vàlid.": "Por favor, introduce un correo electrónico válido.",
    "Ja has enviat un missatge avui. Pots tornar a enviar en": "Ya has enviado un mensaje hoy. Puedes volver a enviar en",



        // ============================================================
    // VISOR AROME (COMPLET)
    // ============================================================
    "Visor AROME · Alta resolució": "Visor AROME · Alta resolución",
    "1.3km - 2.5km": "1.3km - 2.5km",
    "Obrir visor": "Abrir visor",
    "AROME-CAT": "AROME-CAT",
    "El model més precís per a Catalunya": "El modelo más preciso para Cataluña",
    "Consulta les previsions d'alta resolució amb el model AROME de Meteo-France. Visualitza tempestes, vents, precipitacions i fenòmens extrems amb una resolució de": "Consulta las previsiones de alta resolución con el modelo AROME de Meteo-France. Visualiza tormentas, vientos, precipitaciones y fenómenos extremos con una resolución de",
    "1.3 quilòmetres i per altura 2.5 quilòmetres": "1.3 kilómetros y por altura 2.5 kilómetros",
    "Precisió màxima": "Precisión máxima",
    "Actualització 6h": "Actualización 6h",
    "Mapes interactius": "Mapas interactivos",
    "Detecta tempestes": "Detecta tormentas",
    "Entrar al visor": "Entrar al visor",
    "Ensembles": "Ensamble",

    // ============================================================
    // RADAR (COMPLET)
    // ============================================================
    "Radar meteorològic en viu": "Radar meteorológico en vivo",
    "Temps real": "Tiempo real",
    "Obrir radar": "Abrir radar",
    "Radar Dbz": "Radar Dbz",
    "Radar meteorològic d'alta resolució en temps real": "Radar meteorológico de alta resolución en tiempo real",
    "El radar meteorològic detecta la precipitació en temps real mitjançant ones electromagnètiques. Permet visualitzar la intensitat de la pluja, la calamarsa i la neu amb una resolució espacial de": "El radar meteorológico detecta la precipitación en tiempo real mediante ondas electromagnéticas. Permite visualizar la intensidad de la lluvia, el granizo y la nieve con una resolución espacial de",
    "1.3 quilòmetres": "1.3 kilómetros",
    "i una cobertura vertical de fins a": "y una cobertura vertical de hasta",
    "2.5 quilòmetres d'altura": "2.5 kilómetros de altura",
    "Amb el radar pots:": "Con el radar puedes:",
    "Seguir tempestes": "Seguir tormentas",
    "i precipitacions en temps real": "y precipitaciones en tiempo real",
    "Detectar fenòmens extrems": "Detectar fenómenos extremos",
    "com calamarsa o pedregades": "como granizo o pedrisco",
    "Visualitzar la intensitat": "Visualizar la intensidad",
    "de la precipitació per zones": "de la precipitación por zonas",
    "Consultar les últimes hores": "Consultar las últimas horas",
    "amb l'animació del radar": "con la animación del radar",
    "Entrar al radar en viu": "Entrar al radar en vivo",
    "Interactiu": "Interactivo",



        // ============================================================
    // QUI SOM - TRUST BADGES (COMPLET)
    // ============================================================
    "Més de 2 anys": "Más de 2 años",
    "Estem construint-nos com mai! I seguirem molts més anys i millorant!": "¡Nos estamos construyendo como nunca! ¡Y seguiremos muchos más años y mejorando!",
    "Som uns 50.000 entre l'equip a Instgram": "Somos unos 50.000 entre el equipo en Instagram",
    "cada mes confien en nosaltres": "cada mes confían en nosotros",
    "Models professionals": "Modelos profesionales",
    "AROME-AROME-PI": "AROME-AROME-PI",
    "Precisió garantida!": "¡Precisión garantizada!",
    "Validació diària de les dades": "Validación diaria de los datos",
};


// ============================================================
// FUNCIÓ PER TRADUIR (només textos, sense tocar HTML)
// ============================================================

function traduirPagina() {
    if (idiomaActual === 'ca') return;

    function recorrerNodes(node) {
        if (node.nodeType === 3) {
            let text = node.textContent.trim();
            if (traduccions[text] !== undefined) {
                node.textContent = traduccions[text];
            }
        } else if (node.nodeType === 1) {
            if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
                node.childNodes.forEach(recorrerNodes);
            }
        }
    }

    document.body.childNodes.forEach(recorrerNodes);

    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
        const placeholder = el.placeholder;
        if (traduccions[placeholder] !== undefined) {
            el.placeholder = traduccions[placeholder];
        }
    });

    if (document.title) {
        const title = document.title;
        if (traduccions[title] !== undefined) {
            document.title = traduccions[title];
        }
    }

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && metaDesc.content) {
        const desc = metaDesc.content;
        if (traduccions[desc] !== undefined) {
            metaDesc.content = traduccions[desc];
        }
    }
}

// ============================================================
// FUNCIÓ PER CANVIAR IDIOMA
// ============================================================

function canviarIdioma(idioma) {
    if (!idioma) {
        idioma = idiomaActual === 'ca' ? 'es' : 'ca';
    }
    
    idiomaActual = idioma;
    localStorage.setItem('tempestes_idioma', idioma);
    location.reload();
}

// ============================================================
// ACTUALITZAR BOTÓ D'IDIOMA
// ============================================================

function actualitzarBotoIdioma() {
    const btn = document.getElementById('btnIdioma');
    if (!btn) return;
    
    if (idiomaActual === 'ca') {
        btn.innerHTML = '<i class="fa-solid fa-language"></i> <span>Castellano</span>';
        btn.setAttribute('data-idioma', 'es');
    } else {
        btn.innerHTML = '<i class="fa-solid fa-language"></i> <span>Català</span>';
        btn.setAttribute('data-idioma', 'ca');
    }
}

// ============================================================
// INICIALITZACIÓ
// ============================================================

function initIdioma() {
    const guardat = localStorage.getItem('tempestes_idioma');
    if (guardat && (guardat === 'ca' || guardat === 'es')) {
        idiomaActual = guardat;
    } else {
        const navLang = navigator.language || navigator.language;
        idiomaActual = navLang.startsWith('es') ? 'es' : 'ca';
    }
    
    if (idiomaActual === 'es') {
        traduirPagina();
    }
    
    actualitzarBotoIdioma();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIdioma);
} else {
    initIdioma();
}