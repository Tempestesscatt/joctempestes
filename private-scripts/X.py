#!/usr/bin/env python3
"""
fetch_tweets.py
--------------------------------------------------------------
Agafa els últims 6 tuits de @tempestes_cat,
descarrega les imatges i genera un JSON amb dates reals.

NOVETAT: en lloc de trucar sempre a nitter.net, l'script prova
una llista d'instàncies Nitter per ordre fins que una respongui
correctament. Si una dona 429 (massa peticions) o error, passa
a la següent automàticament, amb un petit backoff entremig.
--------------------------------------------------------------
"""

import os
import json
import re
import time
import requests
from datetime import datetime, timezone
from dateutil import parser
import xml.etree.ElementTree as ET

# ============================================================
# CONFIGURACIÓ
# ============================================================
TWITTER_USERNAME = 'tempestes_cat'

# LLISTA D'INSTÀNCIES NITTER (per ordre de preferència)
# Es proven una a una fins que alguna respongui bé.
# Pots actualitzar aquesta llista consultant: https://status.d420.de/
NITTER_INSTANCES = [
    'nitter.poast.org',       # té RSS actiu confirmat
    'xcancel.com',
    'nitter.tiekoetter.com',
    'nitter.catsarch.com',
    'lightbrd.com',
    'nitter.net',
]

# Quants intents (amb backoff) per CADA instància abans de passar a la següent
INTENTS_PER_INSTANCIA = 2
ESPERA_BASE_SEGONS = 3  # backoff exponencial: 3s, 6s, 12s...

# RUTA: public/js/index/twitter/
BASE_PATH = 'C:/Users/simob/Documents/GitHub/joctempestes/meu-mapa/public/js/index/twitter'
OUTPUT_JSON = os.path.join(BASE_PATH, 'tweets.json')
IMAGE_FOLDER = os.path.join(BASE_PATH, 'images/')

MAX_TWEETS = 12

# ============================================================
# FUNCIONS
# ============================================================

def crear_carpetes():
    """Crea totes les carpetes necessàries"""
    carpetes = [BASE_PATH, IMAGE_FOLDER]
    for carpeta in carpetes:
        if not os.path.exists(carpeta):
            os.makedirs(carpeta)
            print(f'📁 Carpeta creada: {carpeta}')
        else:
            print(f'📁 Carpeta existent: {carpeta}')

def fetch_rss_una_instancia(url):
    """
    Intenta carregar l'RSS d'UNA instància concreta.
    Retorna (contingut, None) si va bé.
    Retorna (None, motiu) si falla, perquè l'anell superior decideixi
    si val la pena reintentar o passar a la següent instància.
    """
    try:
        response = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        if response.status_code == 429:
            return None, '429'  # massa peticions, val la pena esperar i reintentar
        if response.status_code == 404:
            return None, '404'  # aquesta instància no té RSS actiu, no val la pena reintentar
        response.raise_for_status()

        # Comprovació bàsica: que sembli XML/RSS de veritat i no una pàgina d'error HTML
        text = response.text
        if '<?xml' not in text[:200] and '<rss' not in text[:500]:
            return None, 'resposta_invalida'

        return text, None

    except requests.exceptions.Timeout:
        return None, 'timeout'
    except Exception as e:
        return None, f'error:{e}'

def fetch_rss(username):
    """
    Prova totes les instàncies de NITTER_INSTANCES per ordre.
    Per cada instància, fa fins a INTENTS_PER_INSTANCIA intents amb backoff
    si rep un 429. Si una instància no té RSS (404) o falla per altres motius,
    passa directament a la següent sense esperar.
    """
    for instancia in NITTER_INSTANCES:
        url = f'https://{instancia}/{username}/rss'
        print(f'📡 Provant instància: {instancia} ...')

        for intent in range(1, INTENTS_PER_INSTANCIA + 1):
            contingut, error = fetch_rss_una_instancia(url)

            if contingut:
                print(f'✅ RSS carregat correctament des de {instancia}')
                return contingut

            if error == '429':
                espera = ESPERA_BASE_SEGONS * (2 ** (intent - 1))
                print(f'⚠️ {instancia}: massa peticions (429). Esperant {espera}s abans de reintentar...')
                time.sleep(espera)
                continue  # reintenta la mateixa instància

            if error == '404':
                print(f'⏭️ {instancia}: no té RSS actiu. Passant a la següent instància.')
                break  # no val la pena reintentar, salta a la següent instància

            print(f'⏭️ {instancia}: {error}. Passant a la següent instància.')
            break

    print('❌ Cap instància de Nitter ha respost correctament.')
    return None

def netejar_xml(xml_text):
    """
    Neteja el text abans de parsejar-lo com XML.
    Elimina BOM (byte order mark) i espais/línies en blanc inicials,
    que són la causa més freqüent de l'error
    'XML or text declaration not at start of entity'.
    """
    if xml_text is None:
        return xml_text

    # Elimina el BOM UTF-8 si hi és (com a caràcter o com a bytes ja decodificats)
    xml_text = xml_text.lstrip('\ufeff')

    # Elimina espais en blanc / línies buides abans de la declaració XML
    xml_text = xml_text.lstrip()

    return xml_text

def parse_rss(xml_text):
    """Parsa el RSS i extreu les dades dels tuits amb data real"""
    tweets = []
    xml_text = netejar_xml(xml_text)
    try:
        root = ET.fromstring(xml_text)
        
        for item in root.findall('.//item'):
            title = item.find('title')
            link = item.find('link')
            pub_date = item.find('pubDate')
            description = item.find('description')
            
            # Extreure text net
            desc_text = description.text if description is not None else ''
            clean_text = re.sub(r'<[^>]+>', '', desc_text).strip()
            
            # Extreure imatge del description
            img_url = ''
            img_match = re.search(r'<img[^>]+src="([^">]+)"', desc_text)
            if img_match:
                img_url = img_match.group(1)
            
            # DATA REAL DEL TUIT (de pubDate)
            tweet_date = None
            date_str = pub_date.text if pub_date is not None else ''
            if date_str:
                try:
                    tweet_date = parser.parse(date_str)
                except:
                    tweet_date = datetime.now(timezone.utc)
            else:
                tweet_date = datetime.now(timezone.utc)
            
            tweet = {
                'id': link.text.split('/')[-1] if link is not None else '',
                'text': clean_text or (title.text if title else ''),
                'link': link.text if link is not None else '',
                'date': tweet_date,
                'date_str': tweet_date.isoformat() if tweet_date else '',
                'image_url': img_url,
                'image_local': ''
            }
            
            if tweet['text'] or tweet['image_url']:
                tweets.append(tweet)
                
    except Exception as e:
        print(f'❌ Error parsejant RSS: {e}')
    
    # ORDENAR DEL MÉS RECENT AL MÉS ANTIC
    tweets.sort(key=lambda x: x['date'], reverse=True)
    
    return tweets[:MAX_TWEETS]

def download_image(url, folder, filename):
    """Descarrega una imatge i la guarda a la carpeta"""
    if not url:
        return ''
    
    if 'via.placeholder.com' in url:
        return url
    
    try:
        os.makedirs(folder, exist_ok=True)
        
        response = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        response.raise_for_status()
        
        content_type = response.headers.get('content-type', '')
        ext = '.jpg'
        if 'png' in content_type:
            ext = '.png'
        elif 'gif' in content_type:
            ext = '.gif'
        elif 'webp' in content_type:
            ext = '.webp'
        
        filepath = os.path.join(folder, f'{filename}{ext}')
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        rel_path = f'images/{filename}{ext}'
        print(f'✅ Imatge guardada: {filepath}')
        return rel_path
        
    except Exception as e:
        print(f'❌ Error descarregant imatge: {e}')
        return ''

def format_time_ago_exact(date_obj):
    """
    Converteix una data a format EXACTE:
    - "Fa 2 dies 3 hores"
    - "Fa 5 hores 30 minuts"
    - "Fa 45 minuts"
    """
    if not date_obj:
        return 'Ara mateix'
    
    # Si la data no té timezone, afegir-li
    if date_obj.tzinfo is None:
        date_obj = date_obj.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    diff = now - date_obj
    
    total_seconds = int(diff.total_seconds())
    
    if total_seconds < 0:
        return 'Ara mateix'
    
    # Calcular dies, hores, minuts
    days = total_seconds // 86400
    remaining = total_seconds % 86400
    hours = remaining // 3600
    remaining = remaining % 3600
    minutes = remaining // 60
    seconds = remaining % 60
    
    # Construir el text
    parts = []
    
    if days > 0:
        if days == 1:
            parts.append('1 dia')
        else:
            parts.append(f'{days} dies')
    
    if hours > 0:
        if hours == 1:
            parts.append('1 hora')
        else:
            parts.append(f'{hours} hores')
    
    if minutes > 0 and days == 0:  # Només mostrar minuts si no hi ha dies
        if minutes == 1:
            parts.append('1 minut')
        else:
            parts.append(f'{minutes} minuts')
    
    # Si no hi ha res, mostrar "Fa uns segons"
    if not parts:
        return 'Fa uns segons'
    
    # Unir les parts
    if len(parts) == 1:
        return f'Fa {parts[0]}'
    elif len(parts) == 2:
        return f'Fa {parts[0]} i {parts[1]}'
    else:
        # Màxim 2 parts per no fer-ho massa llarg
        return f'Fa {parts[0]} i {parts[1]}'

def format_time_ago_short(date_obj):
    """
    Versió curta per si es vol mostrar compacte:
    - "2d 3h"
    - "5h 30m"
    - "45m"
    """
    if not date_obj:
        return 'Ara'
    
    if date_obj.tzinfo is None:
        date_obj = date_obj.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    diff = now - date_obj
    
    total_seconds = int(diff.total_seconds())
    
    if total_seconds < 0:
        return 'Ara'
    
    days = total_seconds // 86400
    remaining = total_seconds % 86400
    hours = remaining // 3600
    remaining = remaining % 3600
    minutes = remaining // 60
    
    parts = []
    if days > 0:
        parts.append(f'{days}d')
    if hours > 0:
        parts.append(f'{hours}h')
    if minutes > 0 and days == 0:
        parts.append(f'{minutes}m')
    
    if not parts:
        return 'Ara'
    
    return ' '.join(parts)

def generate_json(tweets, output_path):
    """Genera el fitxer JSON amb les dades processades"""
    data = []
    for i, tweet in enumerate(tweets):
        # Descarregar imatge si n'hi ha
        local_img = ''
        if tweet['image_url'] and tweet['image_url'].startswith('http'):
            local_img = download_image(
                tweet['image_url'],
                IMAGE_FOLDER,
                f'tweet_{i+1}'
            )
        else:
            local_img = tweet['image_url']
        
        # Data del tuit
        tweet_date = tweet['date']
        date_str = tweet_date.isoformat() if tweet_date else datetime.now(timezone.utc).isoformat()
        
        # Format exacte (ex: "Fa 2 dies i 3 hores")
        time_ago_exact = format_time_ago_exact(tweet_date) if tweet_date else 'Ara mateix'
        
        # Format curt (ex: "2d 3h")
        time_ago_short = format_time_ago_short(tweet_date) if tweet_date else 'Ara'
        
        # Formatejar la data per mostrar-la (ex: 18/08/2026 12:30)
        display_date = ''
        if tweet_date:
            try:
                display_date = tweet_date.strftime('%d/%m/%Y %H:%M')
            except:
                display_date = date_str[:16].replace('T', ' ')
        
        data.append({
            'id': tweet['id'] or f'demo_{i+1}',
            'caption': tweet['text'],
            'media_url': local_img or tweet['image_url'] or '',
            'permalink': tweet['link'] or f'https://x.com/{TWITTER_USERNAME}',
            'timestamp': date_str,
            'display_date': display_date,
            'time_ago': time_ago_exact,      # Format exacte: "Fa 2 dies i 3 hores"
            'time_ago_short': time_ago_short  # Format curt: "2d 3h"
        })
    
    # Si no hi ha tweets, afegir dades d'exemple
    if not data:
        data = get_demo_data()
    
    # Guardar JSON
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f'✅ JSON guardat a: {output_path}')
    return data

def get_demo_data():
    """Dades d'exemple per si el RSS falla"""
    now = datetime.now(timezone.utc)
    return [
        {
            'id': 'demo_1',
            'caption': '🌤️ Benvingut a TEMPESTES.CAT! Previsió meteorològica professional per a Catalunya.',
            'media_url': 'images/demo_1.png',
            'permalink': f'https://x.com/{TWITTER_USERNAME}',
            'timestamp': now.isoformat(),
            'display_date': now.strftime('%d/%m/%Y %H:%M'),
            'time_ago': 'Ara mateix',
            'time_ago_short': 'Ara'
        },
        {
            'id': 'demo_2',
            'caption': '📊 Anàlisi dels models de predicció per a Catalunya. Consulta les dades al nostre visor.',
            'media_url': 'images/demo_2.png',
            'permalink': f'https://x.com/{TWITTER_USERNAME}',
            'timestamp': now.isoformat(),
            'display_date': now.strftime('%d/%m/%Y %H:%M'),
            'time_ago': 'Fa 2 hores i 15 minuts',
            'time_ago_short': '2h 15m'
        },
        {
            'id': 'demo_3',
            'caption': '⚡ Tempestes a la vista! Segueix l\'evolució amb els nostres mapes.',
            'media_url': 'images/demo_3.png',
            'permalink': f'https://x.com/{TWITTER_USERNAME}',
            'timestamp': now.isoformat(),
            'display_date': now.strftime('%d/%m/%Y %H:%M'),
            'time_ago': 'Fa 1 dia i 5 hores',
            'time_ago_short': '1d 5h'
        }
    ]

# ============================================================
# MAIN
# ============================================================

def main():
    print('🐦 Agafant últims tuits de @' + TWITTER_USERNAME)
    print(f'📁 Destí: public/js/index/twitter/')
    print(f'📊 Mostrant les últimes {MAX_TWEETS} notícies')
    
    # CREAR CARPETES
    crear_carpetes()
    
    # 1. Carregar RSS (prova totes les instàncies de la llista)
    rss_content = fetch_rss(TWITTER_USERNAME)
    
    if not rss_content:
        print('⚠️ No s\'ha pogut carregar el RSS de cap instància. Usant dades d\'exemple.')
        tweets = get_demo_data()
        tweets = [
            {
                'id': t['id'],
                'text': t['caption'],
                'link': t['permalink'],
                'date': datetime.now(timezone.utc),
                'date_str': t['timestamp'],
                'image_url': t['media_url'],
                'image_local': ''
            }
            for t in tweets
        ]
    else:
        # 2. Parsejar RSS
        tweets = parse_rss(rss_content)
        print(f'✅ Tuits trobats: {len(tweets)}')
        
        # Mostrar dates dels tuits
        for i, tweet in enumerate(tweets):
            if tweet['date']:
                time_str = format_time_ago_exact(tweet['date'])
                print(f'   #{i+1} - {tweet["date"].strftime("%d/%m/%Y %H:%M")} - {time_str}')
    
    # 3. Generar JSON
    generate_json(tweets, OUTPUT_JSON)
    
    print('\n📊 Resum:')
    print(f'   - JSON: {OUTPUT_JSON}')
    print(f'   - Imatges: {IMAGE_FOLDER}')
    print('✅ Processament completat!')

if __name__ == '__main__':
    main()