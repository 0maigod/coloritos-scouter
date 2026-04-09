// src/services/classification.js
// OPINIONATED REWRITE: Proxy hacia el Backend Opcion B
// El SDK pesado de Google ya no bloquea el frontal.

const API_URL = import.meta.env.PROD ? '/coloritos/api' : 'http://localhost:3000/coloritos/api';

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
            let errorText = response.statusText;
            try {
                const errorData = await response.json();
                if (errorData.error) errorText = errorData.error;
            } catch (je) {}
            throw new Error(errorText);
        }

        // El backend nos devuelve un objeto: { data: arrayDeVideos, activeModel: 'gemini...' }
        return await response.json();

    } catch (e) {
        console.error("Error connecting to Gemini Proxy:", e);
        // Si no podemos manejarlo adecuadamente, propagamos el error para que useApp informe al usuario 
        // (Violación de silenciamiento corregida).
        throw e;
    }
}
