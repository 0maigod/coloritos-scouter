const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI no está definido en el archivo .env");
        }

        // Conexión estable usando mongoose
        const conn = await mongoose.connect(process.env.MONGO_URI);
        
        console.log(`🌌 MongoDB Conectado a la Galaxia: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Error de conexión a MongoDB: ${error.message}`);
        process.exit(1); // Detiene el servidor si la base de datos no levanta
    }
};

module.exports = connectDB;
