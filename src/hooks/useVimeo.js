import { useState, useCallback } from 'react';
import { getFollowedDirectors, getDirectorVideos } from '../api/vimeo';

export const useVimeo = () => {
  const [token, setToken] = useState(() => localStorage.getItem('vimeo_token') || '');
  const [directors, setDirectors] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const authenticate = (newToken) => {
    localStorage.setItem('vimeo_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('vimeo_token');
    setToken('');
    setDirectors([]);
    setVideos([]);
  };

  const fetchDirectorsAndVideos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const dirs = await getFollowedDirectors(token);
      setDirectors(dirs);
      
      // Let's fetch videos for top 10 to avoid rate limits during dev
      const limitedDirs = dirs.slice(0, 10);
      let allVids = [];

      await Promise.allSettled(limitedDirs.map(async (d) => {
         const vids = await getDirectorVideos(token, d.uri);
         const enhancedVids = vids.map(v => ({
           id: v.uri,
           name: v.name,
           description: v.description,
           tags: v.tags?.map(t => t.name).join(', ') || '',
           directorName: d.name,
           thumbnail: v.pictures?.sizes?.[0]?.link || '',
           link: v.link
         }));
         allVids = [...allVids, ...enhancedVids];
      }));

      setVideos(allVids);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    token,
    authenticate,
    logout,
    directors,
    videos,
    loading,
    error,
    fetchDirectorsAndVideos
  };
};
