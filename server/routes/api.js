const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

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
        const response = await fetch(`https://api.vimeo.com${dirUri}/videos?per_page=20&sort=date&direction=desc`, {
            headers: {
                'Authorization': `bearer ${process.env.VIMEO_TOKEN}`,
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            }
        });
        if (!response.ok) throw new Error(`Vimeo Error: ${response.statusText}`);
        
        const data = await response.json();
        const vimeoVideos = data.data || [];

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
// GEMINI AI PROXY ROUTE
// ==========================================

router.post('/gemini/classify', async (req, res) => {
    const { videosArray } = req.body;
    if (!videosArray || videosArray.length === 0) return res.json([]);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

Videos a procesar:
${JSON.stringify(promptData, null, 2)}`;

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

        const resultJSON = JSON.parse(response.text);

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

        res.json(updatedVideos);

    } catch (e) {
        console.error("Gemini Error:", e);
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
