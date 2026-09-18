// ═══════════════════════════════════════════════════════════════════════
//  Web Worker - Precarrega massiva en paral·lel
//  S'executa en un fil separat del navegador i NO es veu afectat
//  per la visibilitat de la pestanya.
// ═══════════════════════════════════════════════════════════════════════

let _aturat = false;
let _abortController = null;

self.onmessage = async function(e) {
    const msg = e.data;

    if (msg.tipus === 'iniciar') {
        _aturat = false;
        _abortController = new AbortController();
        await executarPrecarrega(msg.hores, msg.maxParallel);
    } else if (msg.tipus === 'aturar') {
        _aturat = true;
        if (_abortController) {
            _abortController.abort();
        }
    }
};

async function executarPrecarrega(hores, maxParallel) {
    const total = hores.length;
    let carregades = 0;
    let fallades = 0;
    const inici = Date.now();

    self.postMessage({
        tipus: 'inici',
        total: total,
        inici: inici
    });

    if (total === 0) {
        self.postMessage({
            tipus: 'completat',
            carregades: 0,
            fallades: 0,
            total: 0,
            durada: 0
        });
        return;
    }

    // Cua compartida d'índexs
    let idxPropera = 0;

    // Funció que processa una hora
    async function processarHora(entrada) {
        if (_aturat) return;

        try {
            const dades = await descarregarHora(entrada.nomSFC, _abortController.signal);
            if (_aturat) return;
            carregades++;
            self.postMessage({
                tipus: 'hora-ok',
                idx: entrada.idx,
                dades: dades,
                carregades: carregades,
                fallades: fallades,
                total: total,
                progress: Math.round((carregades / total) * 100)
            });
        } catch (err) {
            if (err.name === 'AbortError') return;
            fallades++;
            self.postMessage({
                tipus: 'hora-error',
                idx: entrada.idx,
                nomSFC: entrada.nomSFC,
                error: err.message,
                carregades: carregades,
                fallades: fallades,
                total: total,
                progress: Math.round((carregades / total) * 100)
            });
        }
    }

    // Llancem N workers en paral·lel
    const numWorkers = Math.min(maxParallel, total);
    const workers = [];

    for (let w = 0; w < numWorkers; w++) {
        workers.push((async () => {
            while (true) {
                if (_aturat) return;
                const idx = idxPropera++;
                if (idx >= hores.length) return;
                await processarHora(hores[idx]);
            }
        })());
    }

    await Promise.all(workers);

    if (_aturat) {
        self.postMessage({
            tipus: 'aturat',
            carregades: carregades,
            fallades: fallades
        });
        return;
    }

    self.postMessage({
        tipus: 'completat',
        carregades: carregades,
        fallades: fallades,
        total: total,
        durada: Date.now() - inici
    });
}

// ─── Descarregar i processar una hora ──────────────────────────────
async function descarregarHora(nomSFC, signal) {
    const response = await fetch(nomSFC, {
        cache: 'no-store',
        signal: signal
    });

    if (!response.ok) {
        throw new Error('HTTP ' + response.status);
    }

    const ct = response.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
        throw new Error('Fitxer no existeix (SPA fallback)');
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let decompressed;
    if (bytes.length >= 2 && bytes[0] === 0x1F && bytes[1] === 0x8B) {
        // Gzip real
        const ds = new DecompressionStream('gzip');
        const blob = new Blob([buffer]);
        const stream = blob.stream().pipeThrough(ds);
        const reader = stream.getReader();
        const chunks = [];
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const totalLength = chunks.reduce((a, b) => a + b.length, 0);
        decompressed = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            decompressed.set(chunk, offset);
            offset += chunk.length;
        }
    } else {
        decompressed = bytes;
    }

    // MessagePack si està disponible, si no JSON
    if (typeof self.MessagePack !== 'undefined') {
        try {
            return self.MessagePack.decode(decompressed);
        } catch (e) {
            // Fallback a JSON
        }
    }

    const text = new TextDecoder().decode(decompressed);
    return JSON.parse(text);
}