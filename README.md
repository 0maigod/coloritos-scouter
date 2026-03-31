# 🌌 Coloritos Scouter v2.0 (Fullstack Edition)

**Coloritos Scouter** es una plataforma de scouting visual de próxima generación. Transforma tu base de datos de comerciales y videos de Vimeo en un universo 3D altamente interactivo, permitiendo descubrir, filtrar y re-clasificar directores y marcas usando Inteligencia Artificial (Dual: Gemini Pro + OpenAI).

En esta versión v2.0, el proyecto ha evolucionado de una SPA (Single Page Application) a una arquitectura **Cloud Client-Server**, introduciendo un backend en Node.js para proteger las API Keys y centralizar toda la inteligencia en MongoDB.

![3D Galaxy View](./assets/galaxy_view.png)

## ✨ Características Principales

*   **Arquitectura BFF (Backend-for-Frontend):** Las API Keys de Vimeo, Gemini y OpenAI están blindadas dentro de un servidor Express.js (`/server`). El frontend de React jamás toca credenciales extranjeras.
*   **Persistencia Centralizada Cache-First (MongoDB Atlas):** Toda la taxonomía, directores y metadatos de clasificación se inmortalizan en la nube usando Mongoose. Las lecturas de directores apuntan primero a la base de datos local (cargando en milisegundos) recurriendo a la API de Vimeo solo para sincronización manual o el primer descubrimiento.
*   **Sistema Dual de IA Automático (Fallback):** Google Gemini procesa nativamente los nuevos descubrimientos usando *few-shot prompting*. Si los límites diarios de cuota de Gemini se agotan, el sistema conmuta automáticamente (sin intervención del usuario) al backend de **OpenAI (GPT-4o-mini)**, garantizando un uptime del 100%.
*   **Performance Extrema UI (Infinite Scroll):** Interfaces optimizadas para directores con cientos de comerciales (lazy-loading por IntersectionObserver). Selecciones múltiples fluidas mediante shift-click tipo OS nativo y encabezados siempre flotantes.
*   **Universo 3D Espacial Data-Driven:** Navega por un cosmos dinámico (React Three Fiber) donde los directores son estrellas y sus dominios de trabajo orbitan a su alrededor. Los nodos ahora reflejan metadatos en vivo (e.g. colores de alerta si hay videos pendientes de clasificar e indicadores numéricos de densidad de video por categoría).
*   **Omnibox Taxonómico e Inteligencia Artificial:** Un buscador global interactivo y data-driven que cruza marcas, categorías y tags en tiempo real, permitiendo seleccionar y auto-clasificar baches enteros de video en 1-click.

---

## 🛠️ Tecnologías y Stack

### Fullstack Security Backend (`/server`)
*   **Motor:** Node.js, Express.js.
*   **Database:** MongoDB Atlas (Mongoose ORM).
*   **Cognición IA Primaria:** `@google/genai` (Gemini Pro).
*   **Cognición IA Fallback:** `openai` (GPT-4o-mini).

### Frontend UI (`/src`)
*   **Framework:** React 18, Vite.
*   **Renderizado 3D Interactivo:** `@react-three/fiber`, `d3-force-3d`, `three.js`.
*   **Grafo 2D SVG:** `react-d3-tree` (customizado).

---

## 🚀 Instalación y Despliegue Secuencial

Como aplicación Fullstack, debes levantar ambos motores (Front y Back) en paralelo:

1. **Clona este repositorio:**
   ```bash
   git clone https://github.com/0maigod/coloritos-scouter.git
   cd coloritos-scouter
   ```

2. **Instala las dependencias maestras (Frontend):**
   ```bash
   npm install
   ```

3. **Crea el archivo Secreto del Backend:**
   Ve a la carpeta `/server`, duplica el archivo `.env.example`, renómbralo a `.env` y coloca allí tus credenciales de la nube:
   ```env
   MONGO_URI=mongodb+srv://.../coloritos?retryWrites=true&w=majority
   VIMEO_TOKEN=tu_token_secreto_de_vimeo
   GEMINI_API_KEY=tu_token_secreto_de_google
   OPENAI_API_KEY=sk-tu_token_secreto_de_openai
   PORT=3000
   ```

4. **Levanta el Backend (Terminal 1):**
   ```bash
   cd server
   npm install
   node server.js
   ```

5. **Levanta el Frontend (Terminal 2):**
   Abre otra terminal en la raíz del proyecto y enciende Vite:
   ```bash
   npm run dev
   ```

6. Visita `http://localhost:5173`. ¡El universo ya no pedirá contraseñas y se auto-ensamblará usando MongoDB por debajo!

## 🔒 Privacidad y Control
En esta nueva versión `localforage` y el almacenamiento caché de Chrome han sido removidos. Todo el poder de procesamiento, almacenamiento y las llaves maestras recaen completamente sobre el Backend de Node.js que despliegues.
