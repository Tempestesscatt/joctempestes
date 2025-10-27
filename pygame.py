import streamlit as st
import time
import random
from dataclasses import dataclass

# Streamlit ECO$ Bank - simple game
# Run: streamlit run streamlit_eco_bank.py

# --- Data classes & helpers ---
@dataclass
class ShopItem:
    id: str
    name: str
    cost: int
    description: str
    apply_msg: str


SHOP_ITEMS = [
    ShopItem('m2', 'Multiplicador x2 (permanente)', 200, 'Duplica las ECO$ que ganas por respuesta correcta.', 'Ganancias multiplicadas por 2.'),
    ShopItem('m3', 'Multiplicador x3 (permanente)', 450, 'Multiplica por 3 las ECO$ que ganas por respuesta correcta.', 'Ganancias multiplicadas por 3.'),
    ShopItem('shield', 'Escudo (-50% decay 30s)', 300, 'Reduce la caída pasiva un 50% durante 30 segundos.', 'Escudo activo 30s.'),
]


# --- Session state init ---
if 'balance' not in st.session_state:
    st.session_state.balance = 500
if 'multiplier' not in st.session_state:
    st.session_state.multiplier = 1
if 'last_tick' not in st.session_state:
    st.session_state.last_tick = time.time()
if 'shield_until' not in st.session_state:
    st.session_state.shield_until = 0
if 'current_question' not in st.session_state:
    st.session_state.current_question = None
if 'base_reward' not in st.session_state:
    st.session_state.base_reward = 50
if 'penalty' not in st.session_state:
    st.session_state.penalty = 40
if 'history' not in st.session_state:
    st.session_state.history = []
if 'auto_mode' not in st.session_state:
    st.session_state.auto_mode = False


# --- Passive decay logic (every 5 seconds subtract 10 ECO$) ---
def apply_passive_decay():
    now = time.time()
    elapsed = now - st.session_state.last_tick
    if elapsed < 5:
        return  # nothing to do
    ticks = int(elapsed // 5)
    decay_per_tick = 10
    # Shield reduces decay by 50% while active
    factor = 0.5 if time.time() < st.session_state.shield_until else 1.0
    total_decay = int(decay_per_tick * ticks * factor)
    if total_decay != 0:
        st.session_state.balance = max(0, st.session_state.balance - total_decay)
        st.session_state.history.append(f'Pasivo: -{total_decay} ECO$ ({ticks} ticks)')
    st.session_state.last_tick += 5 * ticks


# Try to auto-refresh if user enabled auto_mode and streamlit_autorefresh is available
if st.session_state.get('auto_mode_refresh_id', None) is None and st.session_state.auto_mode:
    try:
        from streamlit_autorefresh import st_autorefresh
        # request a rerun every 5 seconds (5000 ms)
        st.session_state.auto_mode_refresh_id = st_autorefresh(interval=5000, limit=None)
    except Exception:
        # package not available — inform user later
        st.session_state.auto_mode_refresh_id = 'missing'

# Apply passive decay on every run when needed
apply_passive_decay()

# --- UI ---
st.title('🏦 Banco ECO$ - Streamlit Game')
st.markdown('Juega con una cuenta bancaria en ECO$. Responde preguntas, compra mejoras y gestiona la caída pasiva de ECO$.')

col1, col2 = st.columns([2,1])
with col1:
    st.subheader('Saldo')
    st.metric('ECO$', f"{st.session_state.balance}")
    st.write(f'Multiplicador activo: x{st.session_state.multiplier}')
    if time.time() < st.session_state.shield_until:
        st.write(f'Escudo activo hasta {time.strftime("%H:%M:%S", time.localtime(st.session_state.shield_until))}')

    # Question area
    st.subheader('Pregunta')
    if st.session_state.current_question is None:
        # generate a simple random arithmetic question
        a = random.randint(1, 20)
        b = random.randint(1, 20)
        op = random.choice(['+', '-', '*'])
        question = f"{a} {op} {b}"
        answer = eval(question)
        st.session_state.current_question = (question, answer)

    q_text, q_ans = st.session_state.current_question
    st.write('Resuelve:')
    st.markdown(f'### {q_text} = ?')
    user_ans = st.text_input('Tu respuesta', key='answer_input')

    if st.button('Enviar respuesta'):
        try:
            user_val = int(user_ans.strip())
            if user_val == q_ans:
                gain = int(st.session_state.base_reward * st.session_state.multiplier)
                st.session_state.balance += gain
                st.session_state.history.append(f'Correcto: +{gain} ECO$')
                st.success(f'¡Correcto! +{gain} ECO$')
            else:
                st.session_state.balance = max(0, st.session_state.balance - st.session_state.penalty)
                st.session_state.history.append(f'Error: -{st.session_state.penalty} ECO$')
                st.error(f'Incorrecto. -{st.session_state.penalty} ECO$')
        except Exception:
            st.warning('Introduce un número entero como respuesta.')
        # reset question
        st.session_state.current_question = None
        st.experimental_rerun()

    st.write('---')
    st.subheader('Historial reciente')
    for item in st.session_state.history[-10:][::-1]:
        st.write('- ' + item)

with col2:
    st.subheader('Tienda (Compra mejoras)')
    for it in SHOP_ITEMS:
        st.write(f"**{it.name}** — {it.cost} ECO$")
        st.write(it.description)
        if st.button(f'Comprar {it.name} — {it.cost} ECO$', key=f'buy_{it.id}'):
            if st.session_state.balance >= it.cost:
                st.session_state.balance -= it.cost
                st.session_state.history.append(f'Compra: {it.name} -{it.cost} ECO$')
                if it.id == 'm2':
                    st.session_state.multiplier = max(st.session_state.multiplier, 2)
                if it.id == 'm3':
                    st.session_state.multiplier = max(st.session_state.multiplier, 3)
                if it.id == 'shield':
                    st.session_state.shield_until = time.time() + 30
                st.success(f'Has comprado {it.name}. {it.apply_msg}')
            else:
                st.warning('No tienes suficientes ECO$')

    st.write('---')
    st.subheader('Controles')
    if st.button('Simular tick de 5s'):
        # manual tick useful si no hay autorefresh
        st.session_state.last_tick = st.session_state.last_tick - 5  # force one tick
        apply_passive_decay()
        st.experimental_rerun()

    auto = st.checkbox('Auto tick (intenta usar streamlit-autorefresh)', value=st.session_state.auto_mode, key='auto_mode_checkbox')
    st.session_state.auto_mode = auto
    if st.session_state.auto_mode and st.session_state.auto_mode_refresh_id == 'missing':
        st.info('Para auto tick automático instala: pip install streamlit-autorefresh')

    st.write('---')
    st.subheader('Ajustes')
    st.number_input('Recompensa base por acierto', min_value=1, max_value=1000, value=st.session_state.base_reward, key='base_reward_input')
    st.number_input('Penalización por fallo', min_value=0, max_value=1000, value=st.session_state.penalty, key='penalty_input')

st.write('---')
st.caption('Nota: la "caída" pasiva resta 10 ECO$ cada 5s. Puedes simular ticks con el botón si no instalas streamlit-autorefresh.')

# persist adjustments
st.session_state.base_reward = st.session_state.base_reward_input
st.session_state.penalty = st.session_state.penalty_input

# Footer: quick reset
st.write('---')
if st.button('Resetear juego'):
    for k in ['balance','multiplier','last_tick','shield_until','current_question','base_reward','penalty','history','auto_mode','auto_mode_refresh_id']:
        if k in st.session_state:
            del st.session_state[k]
    st.experimental_rerun()
