import streamlit as st
import pygame
import os
from io import BytesIO

# =============================================================================
# CONFIGURACIÓN INICIAL Y CARGA DE RECURSOS (SOLO SE EJECUTA UNA VEZ)
# =============================================================================

# --- Configuración de la pantalla (virtual, no se mostrará) ---
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
GROUND_LEVEL = 480

# --- Función para cargar la imagen de forma segura ---
# st.cache_data asegura que la imagen se cargue solo una vez para mejorar el rendimiento.
@st.cache_data
def load_image():
    # Construir la ruta absoluta al archivo para evitar FileNotFoundError
    script_dir = os.path.dirname(os.path.abspath(__file__))
    background_path = os.path.join(script_dir, 'background.png')
    
    if not os.path.exists(background_path):
        st.error(f"No se encontró 'background.png' en la ruta: {background_path}")
        st.stop()
        
    background_image = pygame.image.load(background_path).convert()
    
    # Redimensionar la imagen
    bg_width = background_image.get_width()
    bg_height = background_image.get_height()
    scale_factor = SCREEN_WIDTH / bg_width
    return pygame.transform.scale(background_image, (SCREEN_WIDTH, int(bg_height * scale_factor)))

# --- Inicializar Pygame y cargar la imagen ---
pygame.init()
background_image = load_image()

# =============================================================================
# CLASE DEL JUGADOR (Simplificada para este ejemplo)
# =============================================================================
class Player(pygame.sprite.Sprite):
    def __init__(self, pos_x, pos_y):
        super().__init__()
        self.image = pygame.Surface((32, 64))
        self.image.fill((255, 0, 0)) # Rojo
        self.rect = self.image.get_rect(midbottom=(pos_x, pos_y))

# =============================================================================
# FUNCIÓN DE DIBUJO PRINCIPAL
# =============================================================================

def draw_game_frame(scroll_pos, player_pos_x, player_pos_y):
    """
    Dibuja un único fotograma del juego en una superficie de Pygame.
    Devuelve la imagen como bytes para que Streamlit pueda mostrarla.
    """
    # Crear una superficie virtual donde dibujar
    surface = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
    
    # 1. Dibujar el fondo desplazable
    for i in range(2):
        surface.blit(background_image, (i * SCREEN_WIDTH - scroll_pos, 0))
        
    # 2. Dibujar al jugador
    player = Player(player_pos_x, player_pos_y)
    player_group = pygame.sprite.Group()
    player_group.add(player)
    player_group.draw(surface)
    
    # 3. Convertir la superficie de Pygame a una imagen en memoria
    img_in_memory = BytesIO()
    pygame.image.save(surface, img_in_memory, 'PNG')
    return img_in_memory

# =============================================================================
# LÓGICA DE LA APLICACIÓN STREAMLIT
# =============================================================================

st.set_page_config(page_title="Juego en Streamlit", layout="centered")
st.title("Demo de Pygame en Streamlit")
st.write("Usa los botones para mover el mundo. ¡El juego no es en tiempo real!")

# --- Inicializar el estado del juego (solo la primera vez que se ejecuta) ---
if 'scroll' not in st.session_state:
    st.session_state.scroll = 0
    st.session_state.player_y = GROUND_LEVEL # El jugador no se mueve verticalmente en esta demo simple

# --- Crear columnas para los botones de control ---
col1, col2, col3 = st.columns([1, 1, 1])

with col1:
    if st.button("⬅️ Mover Izquierda"):
        st.session_state.scroll -= 50 # Mueve el fondo

with col2:
    if st.button("⬆️ Saltar (No implementado)"):
        # La lógica del salto sería más compleja, actualizando player_y
        st.info("La función de salto requeriría una simulación por pasos.")
        
with col3:
    if st.button("➡️ Mover Derecha"):
        st.session_state.scroll += 50 # Mueve el fondo

# Asegurar que el scroll se reinicie para un efecto infinito
if abs(st.session_state.scroll) > SCREEN_WIDTH:
    st.session_state.scroll = 0

# --- Dibujar y mostrar el fotograma actual del juego ---
game_image = draw_game_frame(
    scroll_pos=st.session_state.scroll,
    player_pos_x=150, # El jugador se queda fijo en el eje X
    player_pos_y=st.session_state.player_y
)

st.image(game_image, caption=f"Posición del Scroll: {st.session_state.scroll}")

st.info("Cada clic en un botón recarga la app, actualiza el estado y genera una nueva imagen.")
