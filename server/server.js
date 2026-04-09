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
app.use('/coloritos/api', apiRoutes);

// Producción: Servir el frontend de React ensamblado (dist/)
app.use('/coloritos', express.static(path.resolve(__dirname, '..', 'dist')));

// Fallback: Cualquier ruta que no sea de la API, se la enviamos a React
app.get('/coloritos/{*path}', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'dist', 'index.html'));
});

// Redireccionar la raiz pura a /coloritos/
app.get('/', (req, res) => res.redirect('/coloritos/'));

// Iniciamos el motor Node.js
app.listen(PORT, () => {
    console.log(`🚀 Servidor estelar ejecutándose en http://localhost:${PORT}`);
});
