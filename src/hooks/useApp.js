import { useState, useCallback } from 'react';
import { getFollowedDirectors, getDirectorVideos } from '../api/vimeo';
import { classifyVideos } from '../services/classification';

export const useApp = () => {
  // Fondeamos los tokens porque el backend ahora gestiona la autenticación nativamente.
  const vimeoToken = 'backend_secured';
  const geminiToken = 'backend_secured';
  
  const [directors, setDirectors] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loadingDirectors, setLoadingDirectors] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState(null);

  const [activeAIModel, setActiveAIModel] = useState('Esperando consulta...');

  const authenticate = () => {};
  const logout = () => {};

  const fetchDirectors = useCallback(async () => {
    setError(null);
    setLoadingDirectors(true);
    
    try {
      // 1. Llama al Backend (El cual hace proxy hacia Vimeo)
      const dirs = await getFollowedDirectors(null);
      setDirectors(dirs);
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingDirectors(false);
    }
  }, []);

  const fetchDirectorVideos = useCallback(async (director) => {
    setLoadingVideos(true);
    setClassifying(false);
    setError(null);
    setVideos([]); 
    
    try {
      // 1. Llama al Backend (El cual mergea Vimeo con MongoDB)
      const vids = await getDirectorVideos(null, director.uri);
      
      const enhancedVids = vids.map(v => ({
           id: v.uri,
           uri: v.uri,
           _directorUri: director.uri,
           name: v.name,
           description: v.description,
           tags: v.tags?.map(t => t.name).join(', ') || '',
           directorName: director.name,
           thumbnail: v.pictures?.sizes?.[0]?.link || '',
           link: v.link,
           // Estas 4 keys vienen inyectadas directamente de MongoDB gracias al Backend
           category: v.category || 'Sin clasificar',
           subCategory: v.subCategory || 'S/D',
           brand: v.brand || 'Indefinida',
           manualOverride: v.manualOverride || false
      }));
      setVideos(enhancedVids);
      setLoadingVideos(false);
      
      // 2. Inteligencia Colectiva: Filtramos solo los que NO están en MongoDB
      const unclassifiedVids = enhancedVids.filter(v => v.category === 'Sin clasificar' && !v.manualOverride);
      
      if (unclassifiedVids.length > 0) {
          setClassifying(true);
          // 3. Mandar al Backend Gemini Proxy (con Fallback OpenAI)
          const result = await classifyVideos(null, unclassifiedVids);
          
          setActiveAIModel(result.activeModel); // Guardamos el modelo que se usó
          const classificationData = result.data || [];

          // 4. Mergear de vuelta al estado visual sin mutar
          setVideos(prev => prev.map(old => {
              const fresh = classificationData.find(n => n.uri === old.uri);
              return fresh ? { ...old, ...fresh } : old;
          }));
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error parsing backend videos');
    } finally {
      setLoadingVideos(false);
      setClassifying(false);
    }
  }, []);

  return {
    vimeoToken,
    geminiToken,
    authenticate,
    logout,
    directors,
    videos,
    loadingDirectors,
    loadingVideos,
    classifying,
    error,
    activeAIModel,
    fetchDirectors,
    fetchDirectorVideos,
    setVideos
  };
};
