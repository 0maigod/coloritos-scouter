const mongoose = require('mongoose');

const directorSchema = new mongoose.Schema({
    uri: { 
        type: String, 
        required: true, 
        unique: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    link: String,
    pictures: mongoose.Schema.Types.Mixed,
    
    // Almacenamos stats o metadatos extras de vimeo si queremos
    metadata: mongoose.Schema.Types.Mixed,
    
}, {
    timestamps: true 
});

module.exports = mongoose.model('Director', directorSchema);
