import streamlit as st
import numpy as np
import matplotlib.pyplot as plt
from perlin_noise import PerlinNoise

# --- CONFIGURACIÓN DE LA PÁGINA ---
st.set_page_config(
    page_title="Simulador de Nubes Fractal",
    layout="wide"
)

## ☁️ Generador de Ruido Perlin (Textura Base)
def generar_mapa_nubes(dimension, octavas, semilla, escala):
    """
    Genera un mapa 2D usando Ruido Perlin para simular la textura de las nubes.
    """
    noise = PerlinNoise(octaves=octavas, seed=semilla)
    xpix, ypix = dimension, dimension
    pic = []
    
    for i in range(xpix):
        row = []
        for j in range(ypix):
            # Normalizar las coordenadas y aplicar escala
            valor = noise([i / xpix * escala, j / ypix * escala])
            row.append(valor)
        pic.append(row)
        
    return np.array(pic)

## 🎨 Visualización y Clasificación de Nubes
def visualizar_nubes(mapa_ruido, umbral):
    """
    Clasifica y visualiza la textura de ruido como distintos tipos de nubes.
    
    Un 'juego' simple podría ser variar el umbral para simular
    diferentes densidades/tipos de nubes (Fractus, Cúmulus, Cumulonimbus).
    """
    # Normalizar el mapa a valores entre 0 y 1
    mapa_normalizado = (mapa_ruido - np.min(mapa_ruido)) / (np.max(mapa_ruido) - np.min(mapa_ruido))
    
    # Crear la imagen binaria/densidad de la nube
    # Los valores por encima del umbral son "nube"
    nubes = mapa_normalizado > umbral
    
    # Se puede usar un mapa de colores para simular densidad o tipo
    fig, ax = plt.subplots(figsize=(8, 8))
    
    # Usar un mapa de colores 'Blues' o 'Greys' para nubes
    ax.imshow(mapa_normalizado, cmap='gray_r', interpolation='nearest')
    
    # Opcional: una máscara de colores más vivos para la simulación
    ax.imshow(nubes, cmap='Blues', alpha=0.5 * nubes, interpolation='nearest')
    
    ax.set_title("Simulación de Nubes Fractal (Ruido Perlin)")
    ax.axis('off') # Ocultar ejes
    return fig

# --- APLICACIÓN STREAMLIT ---

st.title("🌩️ Generador Interactivo de Nubes Fractal (Streamlit)")

st.sidebar.header("Parámetros de Simulación")

# Sliders para controlar el Ruido Perlin (fractalidad)
dimension = st.sidebar.slider("Dimensión del Mapa", 100, 512, 256, 50)
octavas = st.sidebar.slider("Octavas (Detalle Fractal)", 1, 10, 5, 1)
escala = st.sidebar.slider("Escala (Zoom)", 1.0, 10.0, 3.0, 0.5)
semilla = st.sidebar.number_input("Semilla (Para Variar la Nube)", 0, 1000, 123)

# Slider para simular la densidad/tipo de nube (el 'juego')
umbral = st.sidebar.slider("Umbral de Densidad de Nube", 0.0, 1.0, 0.5, 0.05)

# Clasificación del tipo de nube según el umbral (muy simplificado)
if umbral < 0.4:
    tipo_nube = "Cúmulus"
elif umbral < 0.65:
    tipo_nube = "Altocúmulus/Fractus"
else:
    tipo_nube = "Cumulonimbus (¡Alta Densidad!)"

st.sidebar.info(f"Tipo de Nube Estimado: **{tipo_nube}**")

# Generar y mostrar las nubes
mapa = generar_mapa_nubes(dimension, octavas, semilla, escala)
figura = visualizar_nubes(mapa, umbral)

st.pyplot(figura)

st.write("""
**Cómo funciona el 'Juego':**
Modifica el **Umbral de Densidad de Nube** en la barra lateral. Este valor determina qué tan denso se mostrará el ruido generado.

* **Umbral Bajo:** Nubes dispersas y ligeras (simulando **Fractus** o **Cúmulus** aislados).
* **Umbral Alto:** Nubes densas y masivas (simulando un **Cumulonimbus** o una capa de nubes).
""")

# --- Ejecución ---
# Guarda este archivo como 'app.py' y ejecútalo con:
# streamlit run app.py
