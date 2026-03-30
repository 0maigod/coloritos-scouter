const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai');

const Director = require('../models/Director');
const Video = require('../models/Video');

// ==========================================
// VIMEO PROXY ROUTES
// ==========================================

router.get('/vimeo/directors', async (req, res) => {
    try {
        const response = await fetch('https://api.vimeo.com/me/following?per_page=100', {
            headers: {
                'Authorization': `bearer ${process.env.VIMEO_TOKEN}`,
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            }
        });
        if (!response.ok) throw new Error(`Vimeo Error: ${response.statusText}`);
        
        const data = await response.json();
        const directors = data.data || [];

        // Opcional: Upsert silencioso en MongoDB
        for (let d of directors) {
            await Director.findOneAndUpdate(
                { uri: d.uri },
                { name: d.name, link: d.link, pictures: d.pictures },
                { upsert: true, new: true }
            );
        }

        res.json(directors);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/vimeo/videos', async (req, res) => {
    // Expected query param: ?directorUri=/users/1234
    const dirUri = req.query.directorUri;
    if (!dirUri) return res.status(400).json({ error: "Missing directorUri" });

    try {
        let allVideos = [];
        let nextPageUrl = `https://api.vimeo.com${dirUri}/videos?per_page=100&sort=date&direction=desc`;
        let loopCount = 0;

        while (nextPageUrl && loopCount < 5) { // Límite de seguridad: máximo 500 videos (5 páginas)
            const response = await fetch(nextPageUrl, {
                headers: {
                    'Authorization': `bearer ${process.env.VIMEO_TOKEN}`,
                    'Accept': 'application/vnd.vimeo.*+json;version=3.4'
                }
            });
            if (!response.ok) throw new Error(`Vimeo Error: ${response.statusText}`);
            
            const data = await response.json();
            if (data.data) {
                allVideos.push(...data.data);
            }

            // Paginación de Vimeo: si hay más páginas, armamos la URL siguiente
            if (data.paging && data.paging.next) {
                nextPageUrl = `https://api.vimeo.com${data.paging.next}`;
            } else {
                nextPageUrl = null;
            }
            loopCount++;
        }

        const vimeoVideos = allVideos;

        // Check MongoDB para ver si ya tenemos clasificaciones para estos videos
        const enrichedVideos = [];
        for (let v of vimeoVideos) {
            let dbVid = await Video.findOne({ uri: v.uri });
            if (dbVid) {
                // Ya existe en la base, le inyectamos la taxonomía
                enrichedVideos.push({
                    ...v,
                    category: dbVid.category,
                    subCategory: dbVid.subCategory,
                    brand: dbVid.brand,
                    manualOverride: dbVid.manualOverride
                });
            } else {
                enrichedVideos.push({
                    ...v,
                    category: 'Sin clasificar',
                    subCategory: 'S/D',
                    brand: 'Indefinida'
                });
            }
        }

        res.json({ data: enrichedVideos });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});


// ==========================================
// AI CLASSIFICATION ROUTE (DUAL MODEL FAILOVER)
// ==========================================

router.post('/gemini/classify', async (req, res) => {
    const { videosArray } = req.body;
    if (!videosArray || videosArray.length === 0) return res.json({ data: [], activeModel: 'none' });

    try {
        const promptData = videosArray.map(v => ({
            id: v.uri, // usamos uri ahora
            title: v.name,
            description: v.description?.substring(0, 200) || '',
            tags: v.tags
        }));

        const prompt = `Actúa como un Productor y Director de Arte Publicitario experto.
Clasifica los siguientes videos publicitarios asignando ESTRICTAMENTE una "mainCategory", una "subCategory" y extrayendo la MARCA anunciante ("brand"):

Árbol Base (Main -> Sub):
* Alimentos y Bebidas -> (Bebidas, Comida, Snacks)
* Moda y Belleza -> (Ropa, Cosméticos/Perfumes)
* Movilidad -> (Coches, Motos)
* Servicios y Tecnología -> (Bancos/Finanzas, Apps/Gadgets)
* Arte y Entretenimiento -> (Videoclip Musical, Deportes, Fashion Film, Documental)

Y además extrae la MARCA (ejemplo: "Nike", "Coca-Cola", "Ford", "L'Oréal").
Si no consigues detectar la Marca anunciante, escribe "Indefinida".
Si no coincide con ninguna mainCategory del árbol, usa mainCategory "Otro", subCategory "Varios".

IMPORTANTE: Devuelve ÚNICAMENTE un Array JSON puramente válido sin formato markdown ni texto adicional.
Cada elemento del array debe tener: "id", "mainCategory", "subCategory", "brand"

Videos a procesar:
${JSON.stringify(promptData, null, 2)}`;

        let resultJSON = null;
        let activeModelUsed = 'gemini-2.5-flash';

        // 1. INTENTO PRINCIPAL: GEMINI 2.5 FLASH
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                id: { type: "STRING" },
                                mainCategory: { type: "STRING" },
                                subCategory: { type: "STRING" },
                                brand: { type: "STRING" }
                            },
                            required: ["id", "mainCategory", "subCategory", "brand"]
                        }
                    }
                }
            });
            resultJSON = JSON.parse(response.text);
            console.log("-------------------------------------------------");
            console.log("📌 GEMINI EJECUTÓ EL BATCH:", response.modelVersion || 'gemini-2.5-flash');
            console.log("-------------------------------------------------");
        } 
        // 2. BACKUP / CONTINGENCIA: OPENAI GPT-4o-MINI
        catch (geminiErr) {
            console.warn("⚠️ Falló Gemini (Posible límite de cuota). Activando fallback a OpenAI GPT-4o-mini...", geminiErr.message);
            activeModelUsed = 'gpt-4o-mini';
            
            if (!process.env.OPENAI_API_KEY) {
                throw new Error("Gemini falló y no hay llave OPENAI_API_KEY para hacer el fallback de emergencia.");
            }

            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful JSON data classification system. Always respond with a strictly valid raw JSON array and absolutely nothing else." },
                    { role: "user", content: prompt }
                ]
            });
            
            const rawOutput = completion.choices[0].message.content.trim();
            // Limpiar posibles backticks si chatgpt se olvidó de la regla (ej: ```json [...] ```)
            const cleanJSON = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
            resultJSON = JSON.parse(cleanJSON);
        }

        // Actualizamos o Creamos en MongoDB
        const updatedVideos = [];
        for (let v of videosArray) {
            const cls = resultJSON.find(r => r.id === v.uri);
            const dataToSave = {
                uri: v.uri,
                name: v.name,
                description: v.description,
                link: v.link,
                duration: v.duration,
                pictures: v.pictures,
                player_embed_url: v.player_embed_url,
                directorUri: v.user?.uri || v._directorUri,
                category: cls ? cls.mainCategory : 'Otro',
                subCategory: cls ? cls.subCategory : 'Varios',
                brand: cls ? cls.brand : 'Indefinida',
                manualOverride: false
            };
            
            // Solo si NO ha sido overrideado por el usuario manualmente
            const dbVid = await Video.findOne({ uri: v.uri });
            if (!dbVid || !dbVid.manualOverride) {
                await Video.findOneAndUpdate({ uri: v.uri }, dataToSave, { upsert: true });
            }

            updatedVideos.push({
                ...v,
                category: dataToSave.category,
                subCategory: dataToSave.subCategory,
                brand: dataToSave.brand
            });
        }

        // Devolvemos ahora el objeto enriquecido
        res.json({ data: updatedVideos, activeModel: activeModelUsed });

    } catch (e) {
        console.error("AI Classification Overall Error:", e);
        res.status(500).json({ error: e.message });
    }
});


// ==========================================
// DATABASE (CACHE & RETAG) ROUTES
// ==========================================

router.get('/videos', async (req, res) => {
    try {
        // Obtenemos todos los videos de la BD global
        const videos = await Video.find({}).lean();
        
        res.json(videos.map(v => ({
            uri: v.uri,
            id: v.uri.split('/').pop(),
            name: v.name,
            description: v.description,
            link: v.link,
            duration: v.duration,
            pictures: v.pictures,
            player_embed_url: v.player_embed_url,
            _directorUri: v.directorUri,
            user: { uri: v.directorUri },
            category: v.category,
            subCategory: v.subCategory,
            brand: v.brand,
            manualOverride: v.manualOverride
        })));
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/videos/retag', async (req, res) => {
    const { videoUri, category, subCategory, brand } = req.body;
    try {
        await Video.findOneAndUpdate(
            { uri: videoUri },
            { 
                category, 
                subCategory, 
                brand,
                manualOverride: true 
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
