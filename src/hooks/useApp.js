import { useState, useCallback } from 'react';
import { getFollowedDirectors, getDirectorVideos } from '../api/vimeo';
import { classifyVideos } from '../services/classification';
import { getDirectorData, saveDirectorData } from '../services/db';

export const useApp = () => {
  const [vimeoToken, setVimeoToken] = useState(() => localStorage.getItem('vimeo_token') || import.meta.env.VITE_VIMEO_TOKEN || '');
  const [geminiToken, setGeminiToken] = useState(() => localStorage.getItem('gemini_token') || import.meta.env.VITE_GEMINI_API_KEY || '');
  
  const [directors, setDirectors] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loadingDirectors, setLoadingDirectors] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState(null);

  const authenticate = (vToken, gToken) => {
    localStorage.setItem('vimeo_token', vToken);
    localStorage.setItem('gemini_token', gToken);
    setVimeoToken(vToken);
    setGeminiToken(gToken);
  };

  const logout = () => {
    localStorage.removeItem('vimeo_token');
    localStorage.removeItem('gemini_token');
    setVimeoToken('');
    setGeminiToken('');
    setDirectors([]);
    setVideos([]);
  };

  const fetchDirectors = useCallback(async () => {
    if (!vimeoToken) return;
    setError(null);
    
    try {
      // 1. Instant Cache Hit (Stale-while-revalidate)
      const cachedDirs = await getDirectorData('all_directors');
      if (cachedDirs && cachedDirs.length > 0) {
        setDirectors(cachedDirs);
        // Si hay caché, no bloqueamos la UI con el loading spinner
      } else {
        setLoadingDirectors(true);
      }

      // 2. Fetch fresh data from Vimeo in background
      const dirs = await getFollowedDirectors(vimeoToken);
      
      // 3. Update state and cache
      setDirectors(dirs);
      await saveDirectorData('all_directors', dirs);
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingDirectors(false);
    }
  }, [vimeoToken]);

  const fetchDirectorVideos = useCallback(async (director) => {
    if (!vimeoToken || !geminiToken) return;
    setLoadingVideos(true);
    setClassifying(false);
    setError(null);
    setVideos([]); 
    
    try {
      // 1. Check local DB for instant cache hit
      const apiTotalVideos = director.metadata?.connections?.videos?.total || 0;
      const cachedData = await getDirectorData(director.uri);
      
      // If totals match and we have video objects, load from cache instantly.
      if (cachedData && cachedData.total === apiTotalVideos && cachedData.videos?.length > 0) {
          setVideos(cachedData.videos);
          setLoadingVideos(false);
          return;
      }

      // 2. Cache miss or updated remote. Fetch from Vimeo.
      const vids = await getDirectorVideos(vimeoToken, director.uri);
      const enhancedVids = vids.map(v => ({
           id: v.uri,
           name: v.name,
           description: v.description,
           tags: v.tags?.map(t => t.name).join(', ') || '',
           directorName: director.name,
           thumbnail: v.pictures?.sizes?.[0]?.link || '',
           link: v.link,
           category: 'Clasificando...'
      }));
      setVideos(enhancedVids);
      setLoadingVideos(false);
      
      // 3. Classify new videos using Gemini
      setClassifying(true);
      const classifiedVids = await classifyVideos(geminiToken, enhancedVids);
      setVideos(classifiedVids);

      // 4. Save to IndexedDB
      await saveDirectorData(director.uri, {
          total: apiTotalVideos,
          videos: classifiedVids
      });

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error parsing videos');
    } finally {
      setLoadingVideos(false);
      setClassifying(false);
    }
  }, [vimeoToken, geminiToken]);

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
    fetchDirectors,
    fetchDirectorVideos,
    setVideos
  };
};
