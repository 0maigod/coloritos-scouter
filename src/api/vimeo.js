// src/api/vimeo.js
// OPINIONATED REWRITE: Proxy hacia el Backend Opcion B

const API_URL = 'http://localhost:3000/api';

export const getFollowedDirectors = async (token) => {
  // Ignoramos el token del cliente. El backend lee su propio .env
  const res = await fetch(`${API_URL}/vimeo/directors`);
  
  if (!res.ok) {
    throw new Error(`Error fetching directors via backend`);
  }
  
  return await res.json();
};

export const getDirectorVideos = async (token, directorUri) => {
  const res = await fetch(`${API_URL}/vimeo/videos?directorUri=${directorUri}`);
  
  if (!res.ok) {
    throw new Error(`Error fetching videos via backend`);
  }
  
  const data = await res.json();
  return data.data || [];
};
