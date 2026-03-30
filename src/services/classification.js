// src/services/classification.js
// OPINIONATED REWRITE: Proxy hacia el Backend Opcion B
// El SDK pesado de Google ya no bloquea el frontal.

const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api';

export const classifyVideos = async (apiKey, videosArray) => {
    if (!videosArray || videosArray.length === 0) return { data: [], activeModel: 'Ninguno' };

    try {
        const response = await fetch(`${API_URL}/gemini/classify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ videosArray })
        });

        if (!response.ok) {
            throw new Error(`Error Gemin proxy: ${response.statusText}`);
        }

        // El backend nos devuelve un objeto: { data: arrayDeVideos, activeModel: 'gemini...' }
        return await response.json();

    } catch (e) {
        console.error("Error connecting to Gemini Proxy:", e);
        // Fallback robusto
        return {
            data: videosArray.map(v => ({ ...v, category: 'Sin clasificar', subCategory: 'S/D', brand: 'Indefinida' })),
            activeModel: 'Offline/Error'
        };
    }
}
