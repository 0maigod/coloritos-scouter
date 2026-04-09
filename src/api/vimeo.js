// src/api/vimeo.js
// OPINIONATED REWRITE: Proxy hacia el Backend Opcion B

const API_URL = import.meta.env.PROD ? '/coloritos/api' : 'http://localhost:3000/coloritos/api';

export const getFollowedDirectors = async (token, forceSync = false) => {
  const url = `${API_URL}/vimeo/directors${forceSync ? '?sync=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error fetching directors via backend`);
  const data = await res.json();
  // We expect { source: '...', data: [...] } format from the backend
  return data;
};

export const getDirectorVideos = async (token, directorUri, forceRefresh = false) => {
  const url = `${API_URL}/vimeo/videos?directorUri=${directorUri}${forceRefresh ? '&refresh=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error fetching videos via backend`);
  const data = await res.json();
  // Return both the videos array and the source so callers know if it was cache or Vimeo
  return { videos: data.data || [], source: data.source || 'vimeo' };
};
