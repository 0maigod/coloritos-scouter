const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    uri: { 
        type: String, 
        required: true, 
        unique: true 
    },
    name: String,
    description: String,
    link: String,
    duration: Number,
    thumbnail: String,                           // URL directa de la miniatura (más confiable que navegar pictures.sizes)
    pictures: mongoose.Schema.Types.Mixed,       // Estructura original de Vimeo (backup completo)
    player_embed_url: String,                    // El iframe
    
    // Relación al director (usamos el uri único del director en lugar de un ObjectId para más fácil mapeo)
    directorUri: {
        type: String,
        required: true,
        index: true
    },

    // Las clasificaciones generadas por Gemini (o el override del usuario)
    category: {
        type: String,
        default: 'Sin clasificar',
        index: true
    },
    subCategory: {
        type: String,
        default: 'S/D',
        index: true
    },
    brand: {
        type: String,
        default: 'Indefinida',
        index: true
    },

    // Control: true si la jerarquía fue manipulada manualmente (Retag menu), false si fue la IA original
    manualOverride: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('Video', videoSchema);
