require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');



// Auto-conectar a MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Permite peticiones del frontend (localhost:5173)
app.use(express.json({ limit: '50mb' })); // Parsea JSON bodies mucho más pesados (para el batch a Gemini)
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Importar rutas
const apiRoutes = require('./routes/api');

const path = require('path');

// Rutas API (Ocultas)
app.use('/api', apiRoutes);

// Producción: Servir el frontend de React ensamblado (dist/)
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback: Cualquier ruta que no sea de la API, se la enviamos a React
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Iniciamos el motor Node.js
app.listen(PORT, () => {
    console.log(`🚀 Servidor estelar ejecutándose en http://localhost:${PORT}`);
});
