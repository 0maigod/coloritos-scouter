import localforage from 'localforage';

localforage.config({
  name: 'VimeoScouterDB',
  storeName: 'directors_data',
  description: 'Caché de videos y clasificaciones de directores de Vimeo'
});

export const saveDirectorData = async (directorUri, data) => {
    try {
        await localforage.setItem(directorUri, data);
    } catch(e) {
        console.error("LocalForage Set Error:", e);
    }
};

export const getDirectorData = async (directorUri) => {
    try {
        return await localforage.getItem(directorUri);
    } catch(e) {
        console.error("LocalForage Get Error:", e);
        return null;
    }
};

export const getAllCachedVideos = async () => {
    try {
        const keys = await localforage.keys();
        let allVideos = [];
        for(let key of keys) {
            if (key !== 'all_directors' && key !== 'gemini_token') {
                const data = await localforage.getItem(key);
                if (data) {
                    let vidsArray = [];
                    if (Array.isArray(data.videos)) {
                        vidsArray = data.videos;
                    } else if (Array.isArray(data)) {
                        vidsArray = data; // Legacy support
                    }

                    if (vidsArray.length > 0) {
                        const injected = vidsArray.map(v => ({ ...v, _directorUri: key }));
                        allVideos = allVideos.concat(injected);
                    }
                }
            }
        }
        return allVideos;
    } catch (e) {
        console.error("Error fetching all cached videos", e);
        return [];
    }
};

export const clearDB = async () => {
    await localforage.clear();
};
