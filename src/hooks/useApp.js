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

  const fetchDirectorVideos = useCallback(async (director, forceRefresh = false) => {
    setLoadingVideos(true);
    setClassifying(false);
    setError(null);
    setVideos([]); 
    
    try {
      // Cache-first by default. forceRefresh=true goes straight to Vimeo.
      const { videos: vids, source } = await getDirectorVideos(null, director.uri, forceRefresh);
      
      const enhancedVids = vids.map(v => ({
           id: v.uri,
           uri: v.uri,
           _directorUri: director.uri,
           name: v.name,
           description: v.description,
           tags: v.tags?.map(t => t.name).join(', ') || '',
           directorName: director.name,
           thumbnail: v.thumbnail || v.pictures?.sizes?.[0]?.link || '',
           link: v.link,
           // Classification fields from MongoDB (via cache or Vimeo enrichment)
           category: v.category || 'Sin clasificar',
           subCategory: v.subCategory || 'S/D',
           brand: v.brand || 'Indefinida',
           manualOverride: v.manualOverride || false
      }));
      setVideos(enhancedVids);
      setLoadingVideos(false);

      if (source === 'cache') {
        console.log(`⚡ ${enhancedVids.length} videos from cache for ${director.name}`);
      }

      // Classify untagged videos regardless of source (cache may have pending videos too)
      const unclassifiedVids = enhancedVids.filter(v => v.category === 'Sin clasificar' && !v.manualOverride);

      if (unclassifiedVids.length === 0) {
        // All tagged — nothing to do
        return;
      }

      setClassifying(true);
      const result = await classifyVideos(null, unclassifiedVids);

      setActiveAIModel(result.activeModel);
      const classificationData = result.data || [];

      setVideos(prev => prev.map(old => {
          const fresh = classificationData.find(n => n.uri === old.uri);
          return fresh ? { ...old, ...fresh } : old;
      }));

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error parsing backend videos');
    } finally {
      setLoadingVideos(false);
      setClassifying(false);
    }
  }, []);

  // Explicitly sync from Vimeo, bypassing cache
  const refreshDirectorVideos = useCallback((director) => {
    return fetchDirectorVideos(director, true);
  }, [fetchDirectorVideos]);

  const classifySelectedVideos = useCallback(async (videosToClassify) => {
    if (!videosToClassify || videosToClassify.length === 0) return;
    setClassifying(true);
    setError(null);

    try {
      const result = await classifyVideos(null, videosToClassify);

      setActiveAIModel(result.activeModel);
      const classificationData = result.data || [];

      // Merge the fresh classification back into the global videos state without mutation
      setVideos(prev => prev.map(old => {
        const fresh = classificationData.find(n => n.uri === old.uri);
        return fresh ? { ...old, ...fresh } : old;
      }));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error clasificando videos seleccionados');
    } finally {
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
    refreshDirectorVideos,
    setVideos,
    classifySelectedVideos
  };
};
