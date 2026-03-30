// src/services/db.js
// OPINIONATED REWRITE: Ya no usamos IndexedDB/LocalForage.
// Todo redirige al nuevo servidor centralizado de MongoDB.

const API_URL = 'http://localhost:3000/api';

export const saveDirectorData = async (directorUri, data) => {
    // Delegado al Backend: El backend ya persiste automáticamente 
    // cuando llama a /api/gemini/classify.
    console.log("Interceptor DB: Save ignorado. Delegado a MongoDB.");
};

export const getDirectorData = async (directorUri) => {
    // Delegado. Si se pide localmente, devolvemos null para forzar network fetch
    return null;
};

export const getAllCachedVideos = async () => {
    try {
        const res = await fetch(`${API_URL}/videos`);
        if (!res.ok) throw new Error("API Mongo no responde");
        return await res.json();
    } catch (e) {
        console.error("Centralized Storage Error", e);
        return [];
    }
};

export const clearDB = async () => {
    console.warn("🛡️ Firewall local: No puedes purgar la Base de Datos Centralizada desde este botón.");
    alert("Purga local deshabilitada por seguridad (Estamos en DB Centralizada).");
};

// ==========================================
// NUEVO METODO DE RETAG PARA LA DB
// ==========================================
export const updateVideoRetag = async (videoUri, category, subCategory, brand) => {
    try {
        const res = await fetch(`${API_URL}/videos/retag`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ videoUri, category, subCategory, brand })
        });
        if (!res.ok) throw new Error("Error retagueando en Base Centralizada");
        return true;
    } catch(e) {
        console.error("Retag Error:", e);
        return false;
    }
}
