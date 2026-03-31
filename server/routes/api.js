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
    const dirUri = req.query.directorUri;
    const forceRefresh = req.query.refresh === 'true';
    if (!dirUri) return res.status(400).json({ error: "Missing directorUri" });

    try {
        // ── CACHE-FIRST: Serve from MongoDB when data exists ──────────────
        const cachedVideos = await Video.find({ directorUri: dirUri }).lean();

        if (cachedVideos.length > 0 && !forceRefresh) {
            // MongoDB hit: reshape to match Vimeo API shape the frontend expects
            const cachedResponse = cachedVideos.map(v => {
                // Extract thumbnail with belt-and-suspenders:
                // prefer the flat field, fall back to the nested pictures.sizes array
                const thumb = v.thumbnail
                    || v.pictures?.sizes?.[0]?.link
                    || '';
                
                // Silently backfill thumbnail in DB if it was missing (fire-and-forget)
                if (!v.thumbnail && thumb) {
                    Video.updateOne({ uri: v.uri }, { $set: { thumbnail: thumb } }).exec();
                }

                return {
                    uri: v.uri,
                    name: v.name,
                    description: v.description,
                    link: v.link,
                    duration: v.duration,
                    thumbnail: thumb,
                    pictures: v.pictures,
                    player_embed_url: v.player_embed_url,
                    tags: v.tags || [],
                    user: { uri: v.directorUri },
                    // Classification fields
                    category: v.category,
                    subCategory: v.subCategory,
                    brand: v.brand,
                    manualOverride: v.manualOverride
                };
            });

            console.log(`⚡ Cache hit: ${cachedVideos.length} videos for ${dirUri} served from MongoDB`);
            return res.json({ data: cachedResponse, source: 'cache' });
        }

        // ── CACHE MISS or FORCE REFRESH: Fetch from Vimeo ─────────────────
        console.log(`🌐 Fetching from Vimeo for ${dirUri} (forceRefresh=${forceRefresh})`);
        let allVideos = [];
        let nextPageUrl = `https://api.vimeo.com${dirUri}/videos?per_page=100&sort=date&direction=desc`;
        let loopCount = 0;

        while (nextPageUrl && loopCount < 5) {
            const response = await fetch(nextPageUrl, {
                headers: {
                    'Authorization': `bearer ${process.env.VIMEO_TOKEN}`,
                    'Accept': 'application/vnd.vimeo.*+json;version=3.4'
                }
            });
            if (!response.ok) throw new Error(`Vimeo Error: ${response.statusText}`);
            
            const data = await response.json();
            if (data.data) allVideos.push(...data.data);

            nextPageUrl = (data.paging?.next) ? `https://api.vimeo.com${data.paging.next}` : null;
            loopCount++;
        }

        // Enrich Vimeo data with existing MongoDB classifications + backfill thumbnail
        const enrichedVideos = [];
        for (let v of allVideos) {
            let dbVid = await Video.findOne({ uri: v.uri });
            const thumb = v.pictures?.sizes?.[0]?.link || dbVid?.thumbnail || '';

            // Backfill thumbnail if already in DB but lacking the field
            if (dbVid && !dbVid.thumbnail && thumb) {
                Video.updateOne({ uri: v.uri }, { $set: { thumbnail: thumb } }).exec();
            }

            enrichedVideos.push({
                ...v,
                thumbnail:      thumb,
                category:      dbVid?.category      || 'Sin clasificar',
                subCategory:   dbVid?.subCategory   || 'S/D',
                brand:         dbVid?.brand         || 'Indefinida',
                manualOverride: dbVid?.manualOverride || false
            });
        }

        res.json({ data: enrichedVideos, source: 'vimeo' });
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
        let resultJSON = [];
        let activeModelUsed = 'gemini-2.5-flash';

        // Dividir el array en lotes (chunks) de 50 videos
        // Esto evita limites de contexto o respuesta maximos en las API LLM
        const chunkSize = 50;
        for (let i = 0; i < videosArray.length; i += chunkSize) {
            const chunk = videosArray.slice(i, i + chunkSize);
            const batchNum = Math.floor(i / chunkSize) + 1;

            const promptData = chunk.map(v => ({
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

Videos a procesar (Lote ${batchNum}):
${JSON.stringify(promptData, null, 2)}`;

            let chunkResultJSON = null;

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
                
                chunkResultJSON = JSON.parse(response.text);
                console.log("-------------------------------------------------");
                console.log(`📌 GEMINI EJECUTÓ EL BATCH ${batchNum}:`, response.modelVersion || 'gemini-2.5-flash');
                console.log("-------------------------------------------------");
            } 
            // 2. BACKUP / CONTINGENCIA: OPENAI GPT-4o-MINI
            catch (geminiErr) {
                console.warn(`⚠️ Falló Gemini en el lote ${batchNum} (Posible límite de cuota). Activando fallback a OpenAI GPT-4o-mini...`, geminiErr.message);
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
                chunkResultJSON = JSON.parse(cleanJSON);
            }

            if (Array.isArray(chunkResultJSON)) {
                resultJSON.push(...chunkResultJSON);
            }
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
                thumbnail: v.pictures?.sizes?.[0]?.link || v.thumbnail || '',
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
