import pygame
import numpy as np
from perlin_noise import PerlinNoise

# --- 1. CONFIGURACIÓN DEL JUEGO ---
pygame.init()

# Dimensiones de la pantalla (resolución del juego)
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
SCREEN = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Juego de Nubes Pixelado (Minecraft 2D Style)")
CLOCK = pygame.time.Clock()

# Paleta de Colores (Estilo Pixelado)
COLOR_SKY_DAY = (135, 206, 235)  # Azul claro
COLOR_GROUND = (34, 139, 34)     # Verde oscuro para el suelo
COLOR_CLOUD_WHITE = (245, 245, 245) # Blanco de las nubes
COLOR_CLOUD_SHADOW = (170, 170, 170) # Sombra (para dar profundidad)

# --- 2. GENERACIÓN DE NUBES (Ruido Perlin) ---

# Parámetros del Ruido
MAP_DIMENSION = 64  # Dimensión pequeña para simular 'píxeles' grandes
OCTAVES = 6         # Detalle fractal
ESCALA = 4.0        # Zoom
UMBRAL = 0.55       # Densidad de la nube (Fractus vs Cumulonimbus)

noise = PerlinNoise(octaves=OCTAVES, seed=np.random.randint(1000))

def generar_mapa_nubes(dim, escala_ruido, offset_x):
    """Genera un mapa de ruido 2D con un desplazamiento (offset) para movimiento."""
    mapa = np.zeros((dim, dim))
    for i in range(dim):
        for j in range(dim):
            # i es el eje X, j es el eje Y
            valor = noise([i / dim * escala_ruido + offset_x, j / dim * escala_ruido])
            mapa[j, i] = valor
    return (mapa - np.min(mapa)) / (np.max(mapa) - np.min(mapa)) # Normalizar

# --- 3. BUCLE PRINCIPAL DEL JUEGO ---

cloud_offset = 0.0 # Usado para mover las nubes horizontalmente
TILE_SIZE = SCREEN_WIDTH // MAP_DIMENSION # Tamaño del 'pixel' de la nube

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
            
    # --- Lógica del Juego (Movimiento de Nubes) ---
    cloud_offset += 0.005 # Simula el viento (cambia el offset)
    
    # Regenerar el mapa de nubes con el offset
    cloud_map = generar_mapa_nubes(MAP_DIMENSION, ESCALA, cloud_offset)
    
    # --- Renderizado de la Escena ---
    
    # 1. Fondo (Cielo)
    SCREEN.fill(COLOR_SKY_DAY)
    
    # 2. Renderizado de las Nubes Pixeladas
    air_height = SCREEN_HEIGHT * 0.7 # 70% de la pantalla es aire
    
    for x in range(MAP_DIMENSION):
        for y in range(MAP_DIMENSION):
            density = cloud_map[y, x] # Densidad del 0.0 al 1.0
            
            # Solo dibujamos si hay suficiente densidad para ser una 'nube'
            if density > UMBRAL:
                
                # Coordenadas y tamaño real en pantalla
                rect_x = x * TILE_SIZE
                # Las nubes están en la parte superior del cielo
                rect_y = y * TILE_SIZE * (air_height / (MAP_DIMENSION * TILE_SIZE))
                rect_h = TILE_SIZE * (air_height / (MAP_DIMENSION * TILE_SIZE))
                
                rect = pygame.Rect(rect_x, rect_y, TILE_SIZE, rect_h)
                
                # El tipo de nube (color) según la densidad
                if density > UMBRAL + 0.15:
                    # Nube densa (Cumulonimbus/Cúmulus grandes)
                    color = COLOR_CLOUD_WHITE
                elif density > UMBRAL:
                    # Nube normal (Fractus/Cúmulus)
                    color = COLOR_CLOUD_SHADOW
                else:
                    continue # No debería pasar, pero seguridad
                    
                pygame.draw.rect(SCREEN, color, rect)
                
    # 3. Suelo (Tierra)
    ground_rect = pygame.Rect(0, air_height, SCREEN_WIDTH, SCREEN_HEIGHT - air_height)
    pygame.draw.rect(SCREEN, COLOR_GROUND, ground_rect)
    
    # 4. Actualizar la Pantalla
    pygame.display.flip()
    
    # Limitar FPS
    CLOCK.tick(60)

pygame.quit()
