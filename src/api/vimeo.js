// src/api/vimeo.js

/**
 * Fetch all followed directors (users)
 * @param {string} token - Personal Access Token
 * @returns {Promise<Array>} Array of user objects
 */
export const getFollowedDirectors = async (token) => {
  const response = await fetch('https://api.vimeo.com/me/following?per_page=100', {
    headers: {
      'Authorization': `bearer ${token}`,
      'Accept': 'application/vnd.vimeo.*+json;version=3.4'
    }
  });

  if (!response.ok) {
    throw new Error(`Error fetching directors: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
};

/**
 * Fetch latest videos from a specific director
 * @param {string} token - Personal Access Token
 * @param {string} directorUri - e.g. "/users/123456"
 * @returns {Promise<Array>} Array of video objects
 */
export const getDirectorVideos = async (token, directorUri) => {
  const response = await fetch(`https://api.vimeo.com${directorUri}/videos?per_page=20&sort=date&direction=desc`, {
    headers: {
      'Authorization': `bearer ${token}`,
      'Accept': 'application/vnd.vimeo.*+json;version=3.4'
    }
  });

  if (!response.ok) {
    throw new Error(`Error fetching videos for ${directorUri}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
};
