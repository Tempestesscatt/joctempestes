import pygame
import sys

# =============================================================================
# 1. INICIALIZACIÓN Y CONFIGURACIÓN
# =============================================================================

# Inicializar todos los módulos de Pygame
pygame.init()

# Configuración de la pantalla
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Mi Juego de Plataformas")

# Reloj para controlar la velocidad de fotogramas (FPS)
clock = pygame.time.Clock()

# Definir la altura del suelo (basado en la imagen)
GROUND_LEVEL = 480

# =============================================================================
# 2. CARGAR RECURSOS (IMÁGENES Y SONIDOS)
# =============================================================================

# Cargar la imagen de fondo
try:
    # Usamos .convert() para optimizar el rendimiento del dibujado
    background_image = pygame.image.load('background.png').convert()
except pygame.error as e:
    print(f"Error: No se pudo cargar la imagen 'background.png'.")
    print("Asegúrate de que la imagen está en la misma carpeta que el script.")
    print(f"Detalle del error: {e}")
    sys.exit()

# Redimensionar la imagen para que el ancho coincida con la pantalla
bg_width = background_image.get_width()
bg_height = background_image.get_height()
scale_factor = SCREEN_WIDTH / bg_width
background_image = pygame.transform.scale(background_image, (SCREEN_WIDTH, int(bg_height * scale_factor)))

# Variable para controlar el desplazamiento horizontal del fondo
scroll = 0

# =============================================================================
# 3. CLASE DEL JUGADOR
# =============================================================================

class Player(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        
        # Apariencia del jugador (un simple rectángulo rojo por ahora)
        self.original_image = pygame.Surface((32, 64))
        self.original_image.fill((255, 0, 0)) # Color rojo
        self.image = self.original_image.copy()
        
        # Posición y rectángulo de colisión
        self.rect = self.image.get_rect(midbottom=(150, GROUND_LEVEL))
        
        # Físicas y movimiento
        self.gravity = 0.8
        self.velocity_y = 0
        self.jump_speed = -18
        self.move_speed = 5
        
        # Estado del jugador
        self.on_ground = True
        self.is_crouching = False

    def handle_input(self):
        """Gestiona las entradas del teclado para el movimiento."""
        keys = pygame.key.get_pressed()
        
        # Movimiento horizontal (devuelve el desplazamiento para el fondo)
        scroll_direction = 0
        if keys[pygame.K_LEFT]:
            scroll_direction = -self.move_speed
        if keys[pygame.K_RIGHT]:
            scroll_direction = self.move_speed
            
        # Salto
        if keys[pygame.K_UP] and self.on_ground:
            self.jump()

        # Agacharse
        if keys[pygame.K_DOWN]:
            self.crouch()
        else:
            # Si la tecla de agacharse no está presionada, se levanta
            if self.is_crouching:
                self.stand_up()
        
        return scroll_direction

    def apply_gravity(self):
        """Aplica la gravedad al jugador."""
        self.velocity_y += self.gravity
        self.rect.y += self.velocity_y
        
        # Simular colisión con el suelo
        if self.rect.bottom >= GROUND_LEVEL:
            self.rect.bottom = GROUND_LEVEL
            self.velocity_y = 0
            if not self.on_ground:
                # Solo se activa si acaba de aterrizar
                self.on_ground = True

    def jump(self):
        """Hace que el jugador salte."""
        if self.on_ground:
            self.velocity_y = self.jump_speed
            self.on_ground = False # Ya no está en el suelo

    def crouch(self):
        """Agacha al jugador cambiando el tamaño de su rectángulo."""
        if not self.is_crouching and self.on_ground:
            self.is_crouching = True
            # Reducir la altura a la mitad y mantener la base en su sitio
            self.image = pygame.transform.scale(self.original_image, (32, 32))
            self.rect = self.image.get_rect(midbottom=self.rect.midbottom)

    def stand_up(self):
        """Levanta al jugador a su tamaño original."""
        self.is_crouching = False
        self.image = self.original_image.copy()
        self.rect = self.image.get_rect(midbottom=self.rect.midbottom)

    def update(self):
        """Actualiza el estado del jugador en cada fotograma."""
        self.apply_gravity()
        # El manejo de la entrada se hará en el bucle principal
        # para poder controlar el scroll del fondo.


# =============================================================================
# 4. CONFIGURACIÓN INICIAL DEL JUEGO
# =============================================================================

# Crear el jugador
player = Player()

# Crear un grupo de sprites (facilita dibujar y actualizar todos los sprites a la vez)
player_group = pygame.sprite.Group()
player_group.add(player)

# =============================================================================
# 5. BUCLE PRINCIPAL DEL JUEGO
# =============================================================================

running = True
while running:
    
    # --- 5.1. Manejo de Eventos ---
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    # --- 5.2. Lógica del Juego ---
    
    # Obtener la dirección del movimiento del jugador
    scroll_change = player.handle_input()
    scroll += scroll_change
    
    # Reiniciar el scroll para crear un bucle infinito
    # Si el scroll se pasa del ancho de una imagen, se resetea.
    if abs(scroll) > SCREEN_WIDTH:
        scroll = 0

    # Actualizar todos los sprites en el grupo (llama al método player.update())
    player_group.update()

    # --- 5.3. Dibujado ---
    
    # Dibujar el fondo desplazable. Se dibujan dos copias para que no haya espacios vacíos.
    for i in range(2):
        screen.blit(background_image, (i * SCREEN_WIDTH - scroll, 0))
    
    # Dibujar todos los sprites en su nueva posición
    player_group.draw(screen)

    # --- 5.4. Actualizar la Pantalla ---
    
    # Muestra todo lo que se ha dibujado en este fotograma
    pygame.display.flip()
    
    # Limitar el juego a 60 fotogramas por segundo (FPS)
    clock.tick(60)

# =============================================================================
# 6. SALIR DEL JUEGO
# =============================================================================
pygame.quit()
sys.exit()
