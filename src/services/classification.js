import { GoogleGenAI } from '@google/genai';

/**
 * Classifies an array of videos into advertising categories using Gemini
 * @param {string} apiKey - Gemini API Key
 * @param {Array} videosArray - Array of video objects from Vimeo
 * @returns {Promise<Array>} The same array but with a 'category' field added to each
 */
export const classifyVideos = async (apiKey, videosArray) => {
    if (!videosArray || videosArray.length === 0) return [];
    
    // Inicializamos el SDK con la llave limpia del usuario
    const ai = new GoogleGenAI({ apiKey });
    
    // Preparamos solo los datos útiles para no saturar tokens
    const promptData = videosArray.map(v => ({
        id: v.id,
        title: v.name,
        description: v.description?.substring(0, 200) || '',
        tags: v.tags
    }));

    // Prompt de Ingeniería Estricta con Taxonomía Nivel 3 (Marcas)
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
Sé extremadamente preciso de modo analítico.

Videos a procesar:
${JSON.stringify(promptData, null, 2)}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                // Forzamos Estructura JSON (Structured Outputs) directamente en Google
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    description: "Clasificación publicitaria estricta de cada video",
                    items: {
                        type: "OBJECT",
                        properties: {
                            id: { 
                                type: "STRING", 
                                description: "ID exacto del video" 
                            },
                            mainCategory: { 
                                type: "STRING", 
                                description: "Categoría principal elegida del árbol" 
                            },
                            subCategory: {
                                type: "STRING",
                                description: "Subcategoría correspondiente de la principal elegida"
                            },
                            brand: {
                                type: "STRING",
                                description: "La marca anunciante del comercial (ej: Audi, Nike). Si no se detecta, pon 'Indefinida'"
                            }
                        },
                        required: ["id", "mainCategory", "subCategory", "brand"]
                    }
                }
            }
        });

        // Ya no buscamos markdown extra ni regexes turbios. 
        // Gemini nos devuelve la estructura pura del responseSchema validada por su backend.
        let jsonRaw = response.text;
        const resultJSON = JSON.parse(jsonRaw);
        
        return videosArray.map(v => {
           const classification = resultJSON.find(r => r.id === v.id);
           return { 
               ...v, 
               category: classification ? classification.mainCategory : 'Otro',
               subCategory: classification ? classification.subCategory : 'Varios',
               brand: classification ? classification.brand : 'Indefinida'
           };
        });
    } catch(e) {
        console.error("Error parsing Gemini JSON:", e);
        // Fallback: si falla por key incorrecta o por red, retornamos sin romper la UI
        return videosArray.map(v => ({...v, category: 'Sin Clasificar', subCategory: 'General', brand: 'Indefinida'}));
    }
}
