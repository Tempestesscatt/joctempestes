// ═══════════════════════════════════════════════════════════════════════
//  radar.js — VISOR RADAR METEOROLÒGIC (NE ESPANYA)
//  Espera autenticació abans de carregar
// ═══════════════════════════════════════════════════════════════════════

const RADAR_PATH = 'web_radar';
const DADES_PATH = 'dades';

const STOPS_DBZ = [
    {v: -10, r: 0, g: 0, b: 0, a: 0},
    {v: -5, r: 0, g: 200, b: 200, a: 150},
    {v: 0, r: 0, g: 236, b: 236, a: 160},
    {v: 5, r: 1, g: 160, b: 246, a: 180},
    {v: 10, r: 0, g: 0, b: 246, a: 200},
    {v: 15, r: 0, g: 236, b: 0, a: 210},
    {v: 20, r: 1, g: 200, b: 0, a: 220},
    {v: 25, r: 0, g: 144, b: 0, a: 220},
    {v: 30, r: 255, g: 255, b: 0, a: 230},
    {v: 35, r: 255, g: 144, b: 0, a: 230},
    {v: 40, r: 255, g: 0, b: 0, a: 240},
    {v: 45, r: 192, g: 0, b: 0, a: 240},
    {v: 50, r: 120, g: 0, b: 0, a: 240},
    {v: 55, r: 255, g: 0, b: 255, a: 250},
    {v: 60, r: 160, g: 32, b: 240, a: 250},
    {v: 65, r: 80, g: 0, b: 130, a: 255},
    {v: 70, r: 200, g: 200, b: 200, a: 255},
    {v: 75, r: 255, g: 255, b: 255, a: 255}
];

// ═══ MAPA ═══
const map = L.map('map', {
    preferCanvas: true,
    minZoom: 6,
    maxZoom: 14
}).setView([41.0, 1.5], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
}).addTo(map);

map.createPane('paneRadar');
map.getPane('paneRadar').style.zIndex = 400;
map.getPane('paneRadar').style.pointerEvents = 'none';

map.createPane('paneGeojson');
map.getPane('paneGeojson').style.zIndex = 500;
map.getPane('paneGeojson').style.pointerEvents = 'none';

// ═══ COLOR ═══
function getColor(dbz) {
    const s = STOPS_DBZ;
    if (dbz === null || isNaN(dbz)) return {r:0,g:0,b:0,a:0};
    if (dbz <= s[0].v) return s[0];
    if (dbz >= s[s.length-1].v) return s[s.length-1];
    for (let i=0; i<s.length-1; i++) {
        if (dbz>=s[i].v && dbz<=s[i+1].v) {
            const t=(dbz-s[i].v)/(s[i+1].v-s[i].v);
            return {
                r:Math.round(s[i].r+(s[i+1].r-s[i].r)*t),
                g:Math.round(s[i].g+(s[i+1].g-s[i].g)*t),
                b:Math.round(s[i].b+(s[i+1].b-s[i].b)*t),
                a:Math.round((s[i].a||255)+((s[i+1].a||255)-(s[i].a||255))*t)
            };
        }
    }
    return {r:0,g:0,b:0,a:0};
}

// ═══ CAPA CANVAS ═══
const RadarLayer = L.Layer.extend({
    initialize:function(){this._canvas=null;this._frame=null;this._offscreen=null;this._dirty=true;},
    onAdd:function(map){
        this._map=map;
        const c=document.createElement('canvas');
        c.style.cssText='position:absolute;top:0;left:0;pointer-events:none;';
        map.getPane('paneRadar').appendChild(c);
        this._canvas=c;
        map.on('moveend zoomend',this._render,this);
        this._render();
    },
    onRemove:function(map){map.getPane('paneRadar').removeChild(this._canvas);map.off('moveend zoomend',this._render,this);},
    setFrame:function(frame){this._frame=frame;this._dirty=true;this._render();},
    _drawOffscreen:function(){
        if(!this._frame||!this._frame.points||!this._frame.points.length)return;
        const pts=this._frame.points,b=this._frame.bounds,W=1024,lonR=b.east-b.west,latR=b.north-b.south,H=Math.round(W*latR/lonR);
        if(!this._offscreen||this._offscreen.width!==W||this._offscreen.height!==H){
            this._offscreen=document.createElement('canvas');
            this._offscreen.width=W;this._offscreen.height=H;
        }
        const ctx=this._offscreen.getContext('2d');
        ctx.clearRect(0,0,W,H);
        for(let i=0;i<pts.length;i++){
            const p=pts[i],x=(p.lon-b.west)/lonR*W,y=(b.north-p.lat)/latR*H;
            if(x<0||x>=W||y<0||y>=H)continue;
            const c=getColor(p.dbz);
            if(!c.a)continue;
            ctx.fillStyle='rgba('+c.r+','+c.g+','+c.b+','+(c.a/255)+')';
            ctx.fillRect(Math.floor(x),Math.floor(y),2,2);
        }
        this._dirty=false;
    },
    _render:function(){
        if(!this._frame||!this._map)return;
        if(this._dirty)this._drawOffscreen();
        if(!this._offscreen)return;
        const size=this._map.getSize(),c=this._canvas;
        c.width=size.x;c.height=size.y;
        const ctx=c.getContext('2d');
        ctx.clearRect(0,0,size.x,size.y);
        L.DomUtil.setPosition(c,this._map.containerPointToLayerPoint([0,0]));
        const b=this._frame.bounds,tl=this._map.latLngToContainerPoint([b.north,b.west]),br=this._map.latLngToContainerPoint([b.south,b.east]),w=br.x-tl.x,h=br.y-tl.y;
        if(w>0&&h>0)ctx.drawImage(this._offscreen,tl.x,tl.y,w,h);
    }
});

const radarLayer=new RadarLayer();
radarLayer.addTo(map);

// ═══ GEOJSON ═══
let capaComarques=null;
async function carregarComarques(){
    try{
        const resp=await fetch(DADES_PATH+'/girona_comarques.geojson');
        if(!resp.ok){console.warn('[GeoJSON] No trobat');return;}
        const geojson=await resp.json();
        capaComarques=L.geoJSON(geojson,{
            pane:'paneGeojson',
            style:function(){return {color:'#5a7a9a',weight:1.2,opacity:0.7,fill:false,interactive:false,dashArray:'4 4'};},
            onEachFeature:function(feature,layer){
                if(feature.properties&&feature.properties.nom){
                    layer.bindTooltip(feature.properties.nom,{permanent:false,direction:'center',opacity:0.9});
                }
            }
        });
        capaComarques.addTo(map);
        console.log('[GeoJSON] Comarques carregades');
    }catch(e){console.warn('[GeoJSON] Error:',e.message);}
}

// ═══ DADES ═══
let radarFrames=[],currentFrame=0,animTimer=null,animPlaying=false;

function formatarHora(t){
    try{
        const d=new Date(t);
        return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    }catch(e){return'--/-- --:--';}
}

async function carregarDades(){
    console.log('[Radar] Iniciant càrrega...');
    
    // Mostrar loading
    const ld=document.getElementById('loading');
    if(ld)ld.classList.remove('hidden');
    
    try{
        const mr=await fetch(RADAR_PATH+'/radar_metadata.js');
        if(!mr.ok){mostrarError('No s\'han trobat dades del radar');return;}
        eval(await mr.text());
        if(!window.radarMetadata||!window.radarMetadata.frames||!window.radarMetadata.frames.length){mostrarError('No hi ha frames disponibles');return;}
        
        const fi=window.radarMetadata.frames;
        console.log('[Radar] Carregant '+fi.length+' frames...');
        for(let i=0;i<fi.length;i++){
            try{
                const r=await fetch(RADAR_PATH+'/'+fi[i].file);
                if(!r.ok)continue;
                eval(await r.text());
                const vn='radarFrame_'+i;
                if(window[vn]&&window[vn].points&&window[vn].points.length)radarFrames.push(window[vn]);
            }catch(e){console.warn('[Radar] Error frame '+i+': '+e.message);}
        }
        radarFrames.reverse();
        
        // ═══ AMAGAR LOADING ═══
        if(ld)ld.classList.add('hidden');
        
        if(!radarFrames.length){console.error('[Radar] Buit');return;}
        console.log('[Radar] '+radarFrames.length+' frames carregats');
        
        currentFrame=radarFrames.length-1;
        radarLayer.setFrame(radarFrames[currentFrame]);
        actualitzarUI();
    }catch(e){
        console.error('[Radar] Error:',e);
        mostrarError('Error de connexió');
    }
}

function mostrarError(msg){
    const ld=document.getElementById('loading');
    if(ld){
        document.getElementById('loadingSpinner').style.display='none';
        document.getElementById('loadingTitle').style.display='none';
        document.getElementById('loadingSubtitle').style.display='none';
        const le=document.getElementById('loadingError');
        if(le){le.style.display='block';document.getElementById('errorMessage').textContent=msg;}
    }
}

function actualitzarUI(){
    const fi=document.getElementById('frameIndicator');
    if(fi)fi.textContent=(currentFrame+1)+' / '+radarFrames.length;
    const td=document.getElementById('timeDisplay');
    if(td&&radarFrames[currentFrame]){
        try{
            const d=new Date(radarFrames[currentFrame].timestamp);
            td.textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
        }catch(e){td.textContent='--:--';}
    }
}

// ═══ NAVEGACIÓ ═══
function frameAnterior(){
    if(!radarFrames.length)return;
    if(currentFrame>0){currentFrame--;}else{currentFrame=radarFrames.length-1;}
    radarLayer.setFrame(radarFrames[currentFrame]);
    actualitzarUI();
}
function frameSeguent(){
    if(!radarFrames.length)return;
    if(currentFrame<radarFrames.length-1){currentFrame++;}else{currentFrame=0;}
    radarLayer.setFrame(radarFrames[currentFrame]);
    actualitzarUI();
}
function anarActual(){
    if(!radarFrames.length)return;
    currentFrame=radarFrames.length-1;
    radarLayer.setFrame(radarFrames[currentFrame]);
    actualitzarUI();
}

// ═══ ANIMACIÓ ═══
function iniciarAnimacio(){
    if(animPlaying||radarFrames.length<2)return;
    animPlaying=true;
    const btn=document.getElementById('btnPlay');
    if(btn){btn.textContent='Pausa';btn.classList.add('active');}
    animTimer=setInterval(function(){
        if(currentFrame<radarFrames.length-1){currentFrame++;}else{currentFrame=0;}
        radarLayer.setFrame(radarFrames[currentFrame]);
        actualitzarUI();
    },800);
}
function aturarAnimacio(){
    animPlaying=false;
    const btn=document.getElementById('btnPlay');
    if(btn){btn.textContent='Reproduir';btn.classList.remove('active');}
    if(animTimer){clearInterval(animTimer);animTimer=null;}
}
function toggleAnimacio(){animPlaying?aturarAnimacio():iniciarAnimacio();}

// ═══ TECLES ═══
document.addEventListener('keydown',function(e){
    if(!radarFrames.length)return;
    if(e.key==='ArrowLeft'){e.preventDefault();aturarAnimacio();frameAnterior();}
    if(e.key==='ArrowRight'){e.preventDefault();aturarAnimacio();frameSeguent();}
    if(e.key===' '){e.preventDefault();toggleAnimacio();}
});

// ═══ BOTONS ═══
document.addEventListener('DOMContentLoaded',function(){
    document.getElementById('btnPrev').addEventListener('click',function(){aturarAnimacio();frameAnterior();});
    document.getElementById('btnNext').addEventListener('click',function(){aturarAnimacio();frameSeguent();});
    document.getElementById('btnLatest').addEventListener('click',function(){aturarAnimacio();anarActual();});
    const bb=document.getElementById('bottombar');
    if(bb&&!document.getElementById('btnPlay')){
        const bp=document.createElement('button');
        bp.id='btnPlay';bp.textContent='Reproduir';bp.className='primary';
        bp.title='Reproduir/Pausar (espai)';bp.addEventListener('click',toggleAnimacio);
        bb.insertBefore(bp,document.getElementById('btnLatest'));
    }
});

// ═══ CLICK MAPA ═══
let popupActual=null;
map.on('click',function(e){
    if(!radarFrames.length||!radarFrames[currentFrame])return;
    const frame=radarFrames[currentFrame],lat=e.latlng.lat,lng=e.latlng.lng;
    let mp=null,dm=Infinity;
    for(let i=0;i<frame.points.length;i++){
        const p=frame.points[i],d=(p.lat-lat)*(p.lat-lat)+(p.lon-lng)*(p.lon-lng);
        if(d<dm){dm=d;mp=p;}
    }
    if(popupActual){map.removeLayer(popupActual);popupActual=null;}
    if(mp&&Math.sqrt(dm)<0.05){
        const c=getColor(mp.dbz);
        popupActual=L.popup({closeButton:true,className:'popup-clic',offset:[0,-8]})
            .setLatLng(e.latlng)
            .setContent('<div style="background:rgba(13,17,23,0.95);color:#c9d1d9;padding:12px 16px;border-radius:10px;font-family:sans-serif;min-width:110px;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:4px;">Reflectivitat</div><div style="font-size:26px;font-weight:700;color:rgb('+c.r+','+c.g+','+c.b+');">'+mp.dbz.toFixed(1)+' <span style="font-size:13px;font-weight:500;color:#8b949e;">dBZ</span></div><div style="font-size:10px;color:#484f58;margin-top:8px;">'+lat.toFixed(4)+'&deg;N &middot; '+lng.toFixed(4)+'&deg;E</div></div>')
            .openOn(map);
    }
});

// ═══ INICI (ESPERA AUTENTICACIÓ) ═══
console.log('[Radar] Esperant autenticació...');

// El loading comença AMAGAT. Només es mostra quan l'usuari és autoritzat.
const ld = document.getElementById('loading');
if (ld) ld.classList.add('hidden');

// Escoltar l'event d'autenticació
document.addEventListener('auth:autoritzat', function() {
    console.log('[Radar] Usuari autoritzat, iniciant càrrega...');
    carregarComarques().then(function() {
        carregarDades();
    });
});

// Si ja està autoritzat en el moment de carregar l'script
if (window.esAutoritzat && window.esAutoritzat()) {
    console.log('[Radar] Ja autoritzat, iniciant...');
    carregarComarques().then(function() {
        carregarDades();
    });
}