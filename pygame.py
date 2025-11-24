import streamlit as st
import time
import numpy as np

# --- 1. Configuración del Juego y Assets ---
# Usamos emojis/texto simple como "pixel art" para el mapa en Streamlit
# Un juego real usaría imágenes, pero esto demuestra el concepto con st.write

# Definiciones de los elementos
ELEMENTS = {
    'PLAYER': '🚁',   # Helicóptero/Cazador de Tornados
    'TORNADO': '🌪️',  # El temible tornado
    'TARGET': '💰',   # Objetivo (puntos a recoger)
    'EMPTY': '⬜',    # Terreno vacío/seguro
    'CRASH': '💥',    # Colisión/Game Over
}

# Dimensiones del mapa
MAP_SIZE = 10
DELAY = 0.3  # Velocidad de actualización del juego (en segundos)

# --- 2. Inicialización del Estado del Juego (Usando st.session_state) ---

if 'game_started' not in st.session_state:
    st.session_state.game_started = False
    st.st_game_state = 'IN_MENU' # IN_MENU, PLAYING, GAME_OVER

def initialize_game():
    """Establece las posiciones iniciales y la puntuación."""
    st.session_state.game_started = True
    st.session_state.st_game_state = 'PLAYING'
    st.session_state.score = 0
    # Posiciones iniciales aleatorias (Player en esquina, Tornado/Target en otro lugar)
    st.session_state.player_pos = [MAP_SIZE - 1, int(MAP_SIZE / 2)] # Abajo en el centro
    st.session_state.tornado_pos = [0, np.random.randint(MAP_SIZE)] # Arriba
    st.session_state.target_pos = [np.random.randint(1, MAP_SIZE - 1), np.random.randint(MAP_SIZE)]
    # Asegurar que los elementos no comiencen superpuestos
    while st.session_state.target_pos == st.session_state.player_pos or \
          st.session_state.target_pos == st.session_state.tornado_pos:
        st.session_state.target_pos = [np.random.randint(1, MAP_SIZE - 1), np.random.randint(MAP_SIZE)]


# --- 3. Lógica del Juego (Movimiento, Colisiones, Puntuación) ---

def move_element(pos, direction):
    """Calcula la nueva posición y asegura que esté dentro de los límites."""
    r, c = pos
    if direction == 'UP': r = max(0, r - 1)
    elif direction == 'DOWN': r = min(MAP_SIZE - 1, r + 1)
    elif direction == 'LEFT': c = max(0, c - 1)
    elif direction == 'RIGHT': c = min(MAP_SIZE - 1, c + 1)
    return [r, c]

def tornado_ai():
    """Lógica simple: el tornado se mueve aleatoriamente o sigue al jugador."""
    r_p, c_p = st.session_state.player_pos
    r_t, c_t = st.session_state.tornado_pos

    # 70% de seguir al jugador (más desafiante)
    if np.random.rand() < 0.7:
        if abs(r_p - r_t) > abs(c_p - c_t): # ¿Está el jugador más arriba/abajo?
            direction = 'UP' if r_p < r_t else 'DOWN'
        else: # ¿Está el jugador más a la izquierda/derecha?
            direction = 'LEFT' if c_p < c_t else 'RIGHT'
    else: # 30% de moverse aleatoriamente
        directions = ['UP', 'DOWN', 'LEFT', 'RIGHT']
        direction = np.random.choice(directions)
    
    st.session_state.tornado_pos = move_element(st.session_state.tornado_pos, direction)

def check_game_state():
    """Verifica colisiones y objetivos."""
    
    # 1. Recoger Objetivo
    if st.session_state.player_pos == st.session_state.target_pos:
        st.session_state.score += 1
        # Generar nueva posición del objetivo
        while True:
            new_target = [np.random.randint(MAP_SIZE), np.random.randint(MAP_SIZE)]
            if new_target != st.session_state.player_pos and new_target != st.session_state.tornado_pos:
                st.session_state.target_pos = new_target
                break
        
    # 2. Colisión con Tornado
    if st.session_state.player_pos == st.session_state.tornado_pos:
        st.session_state.st_game_state = 'GAME_OVER'

# --- 4. Renderizado del Mapa ---

def render_map():
    """Dibuja el mapa del juego en la interfaz de Streamlit."""
    
    # Crea una matriz vacía para el mapa
    grid = [[ELEMENTS['EMPTY'] for _ in range(MAP_SIZE)] for _ in range(MAP_SIZE)]

    # Coloca los elementos
    r_p, c_p = st.session_state.player_pos
    r_t, c_t = st.session_state.tornado_pos
    r_obj, c_obj = st.session_state.target_pos

    # 1. Colocar el objetivo
    grid[r_obj][c_obj] = ELEMENTS['TARGET']
    
    # 2. Colocar el tornado (Importante: debe ir antes que el jugador para simular Game Over)
    grid[r_t][c_t] = ELEMENTS['TORNADO']

    # 3. Colocar el jugador o la explosión
    if st.session_state.st_game_state == 'GAME_OVER':
        grid[r_p][c_p] = ELEMENTS['CRASH']
    else:
        grid[r_p][c_p] = ELEMENTS['PLAYER']

    # Convierte la matriz a una cadena Markdown para Streamlit (se ve mejor con un espacio fijo)
    map_str = ""
    for row in grid:
        map_str += " ".join(row) + "\n"
        
    st.markdown(f'<div style="font-size: 24px; font-family: monospace; white-space: pre;">{map_str}</div>', unsafe_allow_html=True)


# --- 5. Interfaz de Streamlit ---

st.set_page_config(
    page_title="Tornado Hunter 🌪️ (Pixel Art)",
    layout="centered"
)

st.title("🚁 Tornado Hunter: La Cacería de Píxeles")
st.markdown("---")

if st.session_state.st_game_state == 'IN_MENU':
    st.success("¡Bienvenido al mapa! Recoge 💰 antes de que te atrape el 🌪️.")
    if st.button("▶️ Iniciar Cacería"):
        initialize_game()
        st.experimental_rerun() # Reinicia para empezar el juego
        
elif st.session_state.st_game_state == 'GAME_OVER':
    st.error(f"## 💥 ¡GAME OVER! 💥")
    st.info(f"El tornado te alcanzó. Puntuación final: **{st.session_state.score}**")
    render_map()
    st.markdown("---")
    if st.button("🔄 Jugar de Nuevo"):
        initialize_game()
        st.experimental_rerun()
    
elif st.session_state.st_game_state == 'PLAYING':
    
    # Usamos un placeholder para actualizar el contenido del juego
    game_placeholder = st.empty()
    
    # Columna para puntuación y controles
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.metric(label="Puntuación", value=st.session_state.score)
        
    with col2:
        st.write("### Controles 🕹️")
        
        # Botones de movimiento
        # Usamos una estructura de 3x3 para simular un D-Pad
        row_up = st.columns([1, 1, 1])
        row_mid = st.columns([1, 1, 1])
        row_down = st.columns([1, 1, 1])
        
        # Lógica para manejar el movimiento en un solo bucle
        # El movimiento del jugador solo se ejecuta si se presiona un botón.
        
        # Bandera para saber si hubo movimiento del jugador
        player_moved = False

        if row_up[1].button("⬆️"):
            st.session_state.player_pos = move_element(st.session_state.player_pos, 'UP')
            player_moved = True
        
        if row_mid[0].button("⬅️"):
            st.session_state.player_pos = move_element(st.session_state.player_pos, 'LEFT')
            player_moved = True
            
        if row_mid[2].button("➡️"):
            st.session_state.player_pos = move_element(st.session_state.player_pos, 'RIGHT')
            player_moved = True
            
        if row_down[1].button("⬇️"):
            st.session_state.player_pos = move_element(st.session_state.player_pos, 'DOWN')
            player_moved = True
            
        # --- Bucle de Juego Principal (Se ejecuta solo si el jugador se movió) ---
        if player_moved:
            # 1. Mover Tornado (Tornado AI)
            tornado_ai()
            
            # 2. Verificar Estado del Juego (Colisiones, Recolección)
            check_game_state()
            
            # 3. Forzar Re-renderizado (Esto refresca toda la app)
            st.experimental_rerun()

    # --- Renderizar en el placeholder ---
    # Esto se asegura de que el mapa se actualice después de los movimientos
    with game_placeholder:
        render_map()
        st.markdown("---")
        st.write("Pulsa las flechas para mover tu 🚁. El 🌪️ se mueve después de ti.")
