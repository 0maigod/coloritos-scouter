const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Cargar variables secretas
dotenv.config();

// Auto-conectar a MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Permite peticiones del frontend (localhost:5173)
app.use(express.json()); // Parsea JSON bodies

// Importar rutas
const apiRoutes = require('./routes/api');

// Rutas API Iniciales
app.get('/', (req, res) => {
    res.json({ message: "🌌 Motor Coloritos Scouter Online." });
});
app.use('/api', apiRoutes);

// Iniciamos el motor Node.js
app.listen(PORT, () => {
    console.log(`🚀 Servidor estelar ejecutándose en http://localhost:${PORT}`);
});
