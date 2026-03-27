import React, { useEffect, useState, useMemo } from 'react';
import Tree from 'react-d3-tree';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import { useApp } from '../../hooks/useApp';
import DirectorGraph from './DirectorGraph';
import { getAllCachedVideos, saveDirectorData } from '../../services/db';

const MAIN_CATEGORIES = ["Directores", "Alimentos y Bebidas", "Moda y Belleza", "Movilidad", "Servicios y Tecnología", "Arte y Entretenimiento", "Otro"];
const SUB_CATEGORIES = {
    "Alimentos y Bebidas": ["Bebidas", "Comida", "Snacks"],
    "Moda y Belleza": ["Ropa", "Cosméticos/Perfumes"],
    "Movilidad": ["Coches", "Motos"],
    "Servicios y Tecnología": ["Bancos/Finanzas", "Apps/Gadgets"],
    "Arte y Entretenimiento": ["Videoclip Musical", "Deportes", "Fashion Film", "Documental"],
    "Otro": ["Varios"]
};

const Dashboard = ({ onLogout }) => {
  const { directors, videos, loadingDirectors, loadingVideos, classifying, error, fetchDirectors, fetchDirectorVideos, setVideos } = useApp();
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedDirector, setSelectedDirector] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [filterMode, setFilterMode] = useState("Directores"); 
  const [activeSubFilter, setActiveSubFilter] = useState(null); 
  const [activeBrandFilter, setActiveBrandFilter] = useState(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [allCachedVideos, setAllCachedVideos] = useState([]);
  const [retagVideo, setRetagVideo] = useState(null);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showMappedModal, setShowMappedModal] = useState(false);

  const mappedDirectorUris = useMemo(() => new Set(allCachedVideos.map(v => v._directorUri)), [allCachedVideos]);
  const pendingDirectorsList = useMemo(() => directors.filter(d => !mappedDirectorUris.has(d.uri)), [directors, mappedDirectorUris]);

  // Cerrar Árbol D3 con ESC y Auto-Abrir con typing
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. ESC Escape Hatch: Debe funcionar SIEMPRE, incluso si el Input está focado
      if (e.key === 'Escape' && isSearchFocused) {
        setIsSearchFocused(false);
        document.activeElement?.blur(); // Remover foco del input para resetear estado manual
        return;
      }

      // 2. Typing interceptor
      const tagName = document.activeElement?.tagName;
      // Ignorar escritura global si el usuario ya está tecleando en un input nativo (ej: Retag)
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;

      // Magia: Si toca una letra/número normal, auto-abrir el D3 y capturar letra
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !retagVideo) {
        if (!isSearchFocused) {
           setIsSearchFocused(true);
           setGlobalSearch(prev => prev ? prev + e.key : e.key);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused, retagVideo]);

  // Generar Categorías Dinámicas (Mezclando las fijas con las que invente el usuario)
  const dynamicMainCategories = useMemo(() => {
      const set = new Set(MAIN_CATEGORIES);
      allCachedVideos.forEach(v => {
          if (v.category && v.category !== 'Sin Clasificar' && v.category !== 'Otro') set.add(v.category);
      });
      return Array.from(set).concat(["Otro"]); // Mover 'Otro' al final
  }, [allCachedVideos]);

  const dynamicSubCategories = useMemo(() => {
      const subs = JSON.parse(JSON.stringify(SUB_CATEGORIES)); // Deep copy base
      allCachedVideos.forEach(v => {
          if (v.category && v.subCategory && v.subCategory !== 'General' && v.subCategory !== 'Varios') {
              if (!subs[v.category]) subs[v.category] = [];
              if (!subs[v.category].includes(v.subCategory)) {
                  subs[v.category].push(v.subCategory);
              }
          }
      });
      return subs;
  }, [allCachedVideos]);

  // Filtros del Omnibox (solo los que REALMENTE existen en la BD)
  const omniboxMainCategories = useMemo(() => {
      const set = new Set();
      allCachedVideos.forEach(v => {
          if (v.category && v.category !== 'Sin Clasificar' && v.category !== 'Otro') set.add(v.category);
      });
      const arr = Array.from(set);
      if (allCachedVideos.some(v => v.category === 'Otro')) arr.push('Otro');
      return arr;
  }, [allCachedVideos]);

  const omniboxSubCategories = useMemo(() => {
     const subs = {};
     allCachedVideos.forEach(v => {
          if (v.category && v.subCategory && v.subCategory !== 'General' && v.subCategory !== 'Varios') {
              if (!subs[v.category]) subs[v.category] = [];
              if (!subs[v.category].includes(v.subCategory)) {
                  subs[v.category].push(v.subCategory);
              }
          }
      });
      return subs;
  }, [allCachedVideos]);

  const omniboxBrands = useMemo(() => {
     const brands = {};
     allCachedVideos.forEach(v => {
          if (v.category && v.subCategory && v.brand && v.brand !== 'Indefinida') {
              if (!brands[v.subCategory]) brands[v.subCategory] = [];
              if (!brands[v.subCategory].includes(v.brand)) {
                  brands[v.subCategory].push(v.brand);
              }
          }
      });
      return brands;
  }, [allCachedVideos]);

  // D3 Tree Mapping
  const d3TreeData = useMemo(() => {
      const root = {
          name: 'Coloritos',
          attributes: { type: 'root' },
          children: []
      };
      
      omniboxMainCategories.forEach(cat => {
          const catNode = { name: cat, attributes: { type: 'main' }, children: [] };
          if (omniboxSubCategories[cat]) {
              omniboxSubCategories[cat].forEach(sub => {
                  const subNode = { name: sub, attributes: { type: 'sub' }, children: [] };
                  if (omniboxBrands[sub]) {
                      omniboxBrands[sub].forEach(brand => {
                          subNode.children.push({ name: brand, attributes: { type: 'brand' } });
                      });
                  }
                  catNode.children.push(subNode);
              });
          }
          root.children.push(catNode);
      });
      return root;
  }, [omniboxMainCategories, omniboxSubCategories, omniboxBrands]);

  const renderCustomNode = ({ nodeDatum, toggleNode }) => {
      const isRoot = nodeDatum.attributes?.type === 'root';
      const isMain = nodeDatum.attributes?.type === 'main';
      const isSub = nodeDatum.attributes?.type === 'sub';
      const isBrand = nodeDatum.attributes?.type === 'brand';

      let isActive = false;
      let color = 'white';
      let circleColor = 'rgba(255,255,255,0.4)';
      let circleStroke = 'transparent';

      if (isMain && filterMode === nodeDatum.name) { isActive = true; color = 'var(--color-primary)'; circleColor = 'var(--color-primary)'; circleStroke = 'var(--color-primary)'; }
      else if (isSub && activeSubFilter === nodeDatum.name) { isActive = true; color = 'var(--color-primary)'; circleColor = 'var(--color-primary)'; circleStroke = 'var(--color-primary)'; }
      else if (isBrand && activeBrandFilter === nodeDatum.name) { isActive = true; color = 'gold'; circleColor = 'gold'; circleStroke = 'gold'; }
      else if (isBrand) { color = 'gold'; circleColor = 'rgba(255,215,0,0.3)'; }

      if (isRoot) { color = 'white'; circleColor = 'transparent'; circleStroke = 'transparent'; }

      // Desvanecer nodo activo para "limpiar" el cruce de líneas a cero opacidad
      let nodeOpacity = (isActive && !isBrand) ? 0 : 1;
      let glow = (isActive || isBrand) ? '0 0 10px rgba(0,255,136,0.8)' : 'none';
      if (isActive && isBrand) glow = '0 0 10px rgba(255,215,0,0.8)';

      return (
         <g 
             onClick={(e) => {
                 e.stopPropagation();
                 if (nodeDatum.children?.length > 0) toggleNode();
                 if (isMain) { setFilterMode(nodeDatum.name); setActiveSubFilter(null); setActiveBrandFilter(null); }
                 if (isSub) { setActiveSubFilter(activeSubFilter === nodeDatum.name ? null : nodeDatum.name); setActiveBrandFilter(null); }
                 if (isBrand) { setActiveBrandFilter(activeBrandFilter === nodeDatum.name ? null : nodeDatum.name); }
             }}
             style={{ cursor: 'pointer' }}
         >
            <circle r={isActive || isRoot ? "6" : "5"} fill={circleColor} stroke={circleStroke} strokeWidth="2" style={{ opacity: nodeOpacity, transition: 'all 0.3s ease' }} />

            {/* Hitbox invisible y gigante para atrapar clics súper fácil (y colapsar nodos cuando son opacidad 0) */}
            {!isRoot && <rect x="-10" y="-20" width="250" height="40" opacity="0" style={{ cursor: 'pointer' }} />}

            {isRoot ? (
               <foreignObject x="-10" y="-24" width="220" height="250" style={{ overflow: 'visible' }}>
                  <div className="glass-panel" style={{ padding: '8px', background: 'rgba(0,0,0,0.8)', border: '1px solid var(--color-primary)', width: '220px' }}>
                      <Input 
                         autoFocus
                         placeholder="Buscar por texto..."
                         value={globalSearch}
                         onChange={(e) => setGlobalSearch(e.target.value)}
                         style={{ width: '100%', fontSize: '0.85rem', color: 'white' }}
                      />
                  </div>
               </foreignObject>
            ) : (
               <text 
                  fill={color} 
                  strokeWidth="0" 
                  x="15" 
                  dy={nodeDatum.children?.length > 0 ? "-10" : ".33em"} 
                  fontSize={isActive || isBrand ? "14px" : "13px"}
                  fontWeight={isActive || isBrand ? "bold" : "normal"}
                  style={{ textShadow: glow, opacity: nodeOpacity, pointerEvents: 'none', userSelect: 'none', transition: 'all 0.4s ease' }}
               >
                  {isBrand ? `★ ${nodeDatum.name}` : nodeDatum.name}
                  {nodeDatum.children?.length > 0 && ` (${nodeDatum.children.length})`}
               </text>
            )}
         </g>
      );
  };

  const handleRetag = (video, newMain, newSub, newBrand) => {
      const b = newBrand || video.brand || 'Indefinida';
      const updatedVids = videos.map(v => v.id === video.id ? { ...v, category: newMain, subCategory: newSub, brand: b } : v);
      setVideos(updatedVids);
      setAllCachedVideos(prev => prev.map(v => v.id === video.id ? { ...v, category: newMain, subCategory: newSub, brand: b } : v));
      
      const apiTotalVideos = selectedDirector?.metadata?.connections?.videos?.total || 0;
      saveDirectorData(selectedDirector.uri, { total: apiTotalVideos, videos: updatedVids });
      setRetagVideo(null);
  };

  useEffect(() => {
    fetchDirectors();
  }, [fetchDirectors]);

  useEffect(() => {
    if(!loadingDirectors) {
        getAllCachedVideos().then(vids => setAllCachedVideos(vids));
    }
  }, [loadingDirectors, videos]);

  const handleDirectorClick = (director) => {
    // If clicking same director, deselect
    if(selectedDirector && selectedDirector.uri === director.uri) {
        setSelectedDirector(null);
        setSelectedCategory(null);
        setVideos([]);
        return;
    }
    
    setSelectedDirector(director);
    setSelectedCategory(null);
    fetchDirectorVideos(director);
  };

  const handleCategorySelect = (category) => {
      setSelectedCategory(category);
  };

  const handleBackgroundClick = () => {
      // Go up one level (if category selected -> go to director, if director -> go to all)
      if (selectedCategory) {
          setSelectedCategory(null);
      } else if (selectedDirector) {
          setSelectedDirector(null);
          setVideos([]);
      }
  };

  // Filter directors globally
  const filteredDirectors = useMemo(() => {
     let result = directors;
     
     // 1. Nivel 1: Categoría Principal
     if (filterMode && filterMode !== "Directores") {
         result = result.filter(dir => 
            allCachedVideos.some(v => v._directorUri === dir.uri && v.category === filterMode)
         );
     }
     
     // 2. Nivel 2: Sub-Categoría
     if (activeSubFilter) {
         result = result.filter(dir => 
            allCachedVideos.some(v => v._directorUri === dir.uri && v.subCategory === activeSubFilter)
         );
     }

     // 3. Nivel 3: Marcas (Brands)
     if (activeBrandFilter) {
         result = result.filter(dir => 
            allCachedVideos.some(v => v._directorUri === dir.uri && v.subCategory === activeSubFilter && v.brand === activeBrandFilter)
         );
     }

     // 4. Nivel 4: Filtro por Texto Fino
     if (globalSearch && filterMode) {
         const term = globalSearch.toLowerCase();
         result = result.filter(dir => {
             if (dir.name?.toLowerCase().includes(term)) return true;
             return allCachedVideos.some(v => 
                 v._directorUri === dir.uri && 
                 (!filterMode || filterMode === "Directores" || v.category === filterMode) &&
                 (!activeSubFilter || v.subCategory === activeSubFilter) &&
                 (!activeBrandFilter || v.brand === activeBrandFilter) &&
                 (
                    v.name?.toLowerCase().includes(term) || 
                    (v.brand && v.brand.toLowerCase().includes(term)) ||
                    (Array.isArray(v.tags) && v.tags.some(tag => tag?.name?.toLowerCase().includes(term) || (typeof tag === 'string' && tag.toLowerCase().includes(term))))
                 )
             );
         });
     } else if (globalSearch && !filterMode) {
         const term = globalSearch.toLowerCase();
         result = result.filter(dir => dir.name.toLowerCase().includes(term));
     }
     
     return result;
  }, [directors, allCachedVideos, globalSearch, filterMode, activeSubFilter]);

  // Filter videos for the gallery
  const filteredVideos = useMemo(() => {
    let result = videos;
    
    // Filtro estricto del Grafo 3D (si tocaste una bola sub-categoría específica)
    if (selectedCategory) {
        result = result.filter(v => v.category === selectedCategory);
    }

    // Filtros del Omnibox (Globales)
    if (filterMode && filterMode !== "Directores") {
        result = result.filter(v => v.category === filterMode);
    }
    if (activeSubFilter) {
        result = result.filter(v => v.subCategory === activeSubFilter);
    }
    if (globalSearch && filterMode) {
        const term = globalSearch.toLowerCase();
        result = result.filter(v => 
            v.name?.toLowerCase().includes(term) || 
            (Array.isArray(v.tags) && v.tags.some(tag => tag?.name?.toLowerCase().includes(term) || (typeof tag === 'string' && tag.toLowerCase().includes(term))))
        );
    }

    return result;
  }, [videos, selectedCategory, filterMode, activeSubFilter, activeBrandFilter, globalSearch]);

  return (
    <div className="dashboard-container" style={{ padding: 0, overflow: 'hidden' }}>
      <main style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        
        {/* Floating Top Controls (Integrated) */}
        <div style={{
          position: 'absolute',
          top: 'var(--space-md)',
          left: 'var(--space-md)',
          right: 'var(--space-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
          pointerEvents: 'none' // allow clicks to pass through to canvas
        }}>
           {/* Brand / Info */}
           <div className="glass-panel" style={{ padding: 'var(--space-sm) var(--space-md)', pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'linear-gradient(135deg, #00C9FF 0%, #92FE9D 100%)', boxShadow: '0 0 10px rgba(0,201,255,0.8)' }} />
                <h1 style={{ margin: 0, fontSize: '1.2rem', textShadow: '0 2px 10px rgba(0,0,0,0.5)', fontWeight: '800', letterSpacing: '0.5px' }}>Coloritos</h1>
              </div>
              <div style={{ height: '30px', width: '1px', background: 'var(--color-border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>{directors.length} en Vimeo</span>
                <span 
                    onClick={() => setShowMappedModal(true)}
                    style={{ color: 'var(--color-danger)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold', textShadow: '0 0 8px rgba(255,0,0,0.3)' }}
                >
                    {pendingDirectorsList.length} pendientes
                </span>
              </div>
              <span 
                onClick={async () => { const db = await import('../../services/db'); await db.clearDB(); window.location.reload(); }} 
                style={{ color: 'var(--color-danger)', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto' }}
                title="Borra la base de datos si tienes videos clasificados con clasificaciones viejas"
              >
                [Purgar]
              </span>
           </div>
        </div>

        {/* Background Blur Overlay for Search Focus */}
        {isSearchFocused && (
           <div 
               style={{ position: 'fixed', inset: 0, backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.6)', zIndex: 50, transition: 'all 0.3s' }}
               onClick={() => setIsSearchFocused(false)}
           />
        )}

        {/* Static Omnibox / Search Trigger (Visible when Tree is closed) */}
        {!isSearchFocused && (
            <div style={{ position: 'absolute', bottom: 'var(--space-md)', left: 'var(--space-md)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', animation: 'fadeIn 0.3s ease-out' }}>
                <div className="glass-panel" style={{ padding: 'var(--space-md)', width: '300px', pointerEvents: 'auto' }}>
                    <Input 
                        placeholder="Buscar talentos o abrir taxonomía..."
                        value={globalSearch}
                        onFocus={() => setIsSearchFocused(true)}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        style={{ width: '100%', fontSize: '0.85rem', background: 'rgba(0,0,0,0.4)', transition: 'all 0.3s', color: 'white' }}
                    />
                    {filterMode && filterMode !== "Directores" && (
                        <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                            <strong>Filtro Activo:</strong> {filterMode} {activeSubFilter ? ` ▸ ${activeSubFilter}` : ''} {activeBrandFilter ? ` ▸ ${activeBrandFilter}` : ''}
                            <span 
                                onClick={(e) => { e.stopPropagation(); setFilterMode("Directores"); setActiveSubFilter(null); setActiveBrandFilter(null); setGlobalSearch(''); }} 
                                style={{ color: 'var(--color-danger)', cursor: 'pointer', float: 'right', fontWeight: 'bold' }}
                            >
                                [X]
                            </span>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Taxonomy Tree (react-d3-tree) */}
        {isSearchFocused && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none', animation: 'fadeInOverlay 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                {/* Fixed controls overlay */}
                <div style={{ position: 'absolute', top: '24px', left: '24px', pointerEvents: 'auto', zIndex: 110, display: 'flex', gap: '8px' }}>
                     <Button variant="danger" onClick={() => setIsSearchFocused(false)}>Contraer Ramas (X)</Button>
                     <Button variant="danger" onClick={() => { setIsSearchFocused(false); setFilterMode("Directores"); setActiveSubFilter(null); setActiveBrandFilter(null); setGlobalSearch(''); }} style={{ background: 'transparent', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}>Borrar Todo</Button>
                </div>
                
                {/* SVG Container bounds */}
                <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }} onClick={() => setIsSearchFocused(false)}>
                    <div style={{ width: '100%', height: '100%' }} onClick={e => e.stopPropagation()}>
                        <Tree 
                           data={d3TreeData} 
                           orientation="horizontal"
                           pathFunc="diagonal"
                           translate={{ x: window.innerWidth ? window.innerWidth * 0.15 : 200, y: window.innerHeight ? window.innerHeight / 2 : 400 }}
                           nodeSize={{ x: 260, y: 55 }}
                           separation={{ siblings: 1.2, nonSiblings: 1.5 }}
                           renderCustomNodeElement={renderCustomNode}
                           zoomable={true}
                           collapsible={true}
                           initialDepth={1}
                           transitionDuration={600}
                           pathClassFunc={() => 'custom-d3-link'}
                        />
                    </div>
                </div>
            </div>
        )}

        {loadingDirectors && <div className="glass-panel" style={{ position: 'absolute', top: 100, left: 'var(--space-md)', zIndex: 100 }}>Cargando directores...</div>}
        {error && <div className="glass-panel" style={{ position: 'absolute', top: 100, left: 'var(--space-md)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', zIndex: 100 }}>Error: {error}</div>}
        
        {/* Full screen Graph View. It handles its own dimming and subnodes */}
        <DirectorGraph 
            directors={filteredDirectors} 
            selectedDirector={selectedDirector} 
            videos={videos} // Pass videos so it knows the categories
            onDirectorClick={handleDirectorClick} 
            onCategorySelect={handleCategorySelect}
            onBackgroundClick={handleBackgroundClick}
        />

        {/* Floating Side Panel for Videos if a director is selected OR if it's loading */}
        {(selectedDirector || loadingVideos || classifying) && (
          <div style={{ 
              position: 'absolute', 
              right: 0, top: 0, bottom: 0, 
              width: '400px', 
              background: 'var(--color-bg-base)', 
              borderLeft: '1px solid var(--color-border)',
              padding: 'var(--space-md)',
              overflowY: 'auto',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
              zIndex: 90
            }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0, lineHeight: 1.2 }}>
                    {loadingVideos || classifying ? 'Procesando...' : 
                     <>{selectedCategory || (filterMode !== "Directores" ? activeSubFilter || filterMode : "Todos los videos")}<br/><span style={{fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>{selectedDirector?.name} ({filteredVideos.length})</span></>}
                </h2>
                {selectedDirector && (
                    <Button variant="danger" onClick={() => { setSelectedDirector(null); setSelectedCategory(null); }}>X</Button>
                )}
            </div>

            {loadingVideos && <p>Descargando o leyendo de la DB local...</p>}
            {classifying && <p style={{ color: 'var(--color-primary)' }}>✨ Gemini está analizando nuevos videos...</p>}
            
            {!loadingVideos && !classifying && filteredVideos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                 {filteredVideos.map(video => (
                   <a 
                     key={video.id} 
                     href={video.link} 
                     target="_blank" 
                     rel="noreferrer"
                     className="glass-panel" 
                     style={{ 
                       padding: 0, display: 'flex', flexDirection: 'column', textDecoration: 'none', 
                       color: 'inherit', overflow: 'hidden', transition: 'transform 0.2s',
                     }}
                   >
                     {video.thumbnail && (
                       <img src={video.thumbnail} alt={video.name} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                     )}
                     <div style={{ padding: 'var(--space-sm)' }}>
                       <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '4px', gap: '4px', position: 'relative' }}>
                          <span 
                            onClick={(e) => { e.preventDefault(); setRetagVideo(retagVideo?.id === video.id ? null : video); setCustomTagInput(''); }}
                            style={{ background: 'var(--color-primary)', color: 'white', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s', transform: retagVideo?.id === video.id ? 'scale(1.1)' : 'scale(1)' }}
                            title="Cambiar categoría manual"
                          >
                            {video.category} ✎
                          </span>
                          {video.subCategory && video.subCategory !== 'Varios' && video.subCategory !== 'General' && (
                             <span style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                               {video.subCategory}
                             </span>
                          )}
                          {video.brand && video.brand !== 'Indefinida' && (
                             <span style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '1px dashed rgba(255,215,0,0.4)', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                               ★ {video.brand}
                             </span>
                          )}
                       </div>

                       {/* Retag Menu (Inline Flow) */}
                       {retagVideo?.id === video.id && (
                         <div className="glass-panel" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{ marginTop: '12px', marginBottom: '8px', padding: 'var(--space-sm)', border: '1px solid var(--color-primary)', display: 'flex', flexDirection: 'column', gap: '8px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)' }}>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold', color: 'white' }}>Re-clasificar en árbol existente:</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                               {dynamicMainCategories.filter(c => !["Directores", "Otro"].includes(c)).map(cat => (
                                  <div key={cat} style={{ display: 'flex', flexDirection: 'column', padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                     <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', marginBottom: '6px' }}>{cat}</span>
                                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {dynamicSubCategories[cat]?.map(sub => (
                                           <button key={sub} onClick={() => handleRetag(video, cat, sub)} style={{ fontSize: '0.6rem', padding: '3px 6px', background: 'var(--color-bg-base)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--color-text-muted)', borderRadius: '4px', cursor: 'pointer' }}>{sub}</button>
                                        ))}
                                        <input 
                                           placeholder="+ Nueva Sub (Enter)"
                                           onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); e.stopPropagation(); handleRetag(video, cat, e.target.value.trim()); e.target.value = ''; } }}
                                           onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                           style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'transparent', border: '1px dashed rgba(255,255,255,0.4)', color: 'white', borderRadius: '4px', width: '110px', outline: 'none' }}
                                        />
                                     </div>
                                  </div>
                               ))}
                            </div>
                            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                            
                            {/* Tercer Nivel: Marcas */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <p style={{ margin: 0, fontSize: '0.75rem', color: 'gold' }}>Marca: {video.brand !== 'Indefinida' ? video.brand : 'Sin registrar'}</p>
                               <input 
                                   placeholder="+ Editar Marca (Enter)"
                                   onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); e.stopPropagation(); handleRetag(video, video.category, video.subCategory, e.target.value.trim()); } }}
                                   onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                   style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(255,215,0,0.1)', border: '1px dashed gold', color: 'gold', borderRadius: '4px', width: '120px', outline: 'none' }}
                               />
                            </div>

                            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold', color: 'white' }}>O escribe una categoría principal (raíz) nueva:</p>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <Input 
                                   placeholder={`Ej: ${video.category}`} 
                                   value={customTagInput} 
                                   onChange={e => setCustomTagInput(e.target.value)} 
                                   style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)' }} 
                                />
                                <Button variant="primary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); customTagInput.trim() && handleRetag(video, customTagInput.trim(), "General"); }} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>Guardar</Button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRetag(video, "Otro", "Varios"); }} style={{ fontSize: '0.65rem', padding: '4px 8px', background: 'transparent', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', borderRadius: '4px', cursor: 'pointer' }}>Marcar como Otro / Arte</button>
                                <Button variant="danger" style={{ padding: '4px 12px', fontSize: '0.7rem' }} onClick={(e) => { e.stopPropagation(); setRetagVideo(null); }}>Cerrar Menu</Button>
                            </div>
                         </div>
                       )}

                       <h3 style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.3' }}>{video.name}</h3>
                     </div>
                   </a>
                 ))}
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Pending Directors Modal */}
      {showMappedModal && (
         <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="glass-panel" style={{ width: '450px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 'var(--space-lg)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                  <div>
                      <h2 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>Pendientes de Escaneo</h2>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>Faltan {pendingDirectorsList.length} directores</span>
                  </div>
                  <Button variant="danger" onClick={() => setShowMappedModal(false)} style={{ padding: '4px 12px' }}>X</Button>
               </div>
               <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
                  {pendingDirectorsList.length > 0 ? pendingDirectorsList.map(dir => (
                     <div key={dir.uri} style={{ background: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.2)', padding: '12px 16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' }}>
                         <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem' }}>{dir.name}</span>
                         <Button 
                            variant="primary" 
                            style={{ fontSize: '0.7rem', padding: '4px 12px' }}
                            onClick={() => {
                                setShowMappedModal(false);
                                handleDirectorClick(dir);
                            }}
                         >
                            ✨ Procesar
                         </Button>
                     </div>
                  )) : (
                     <p style={{ color: 'var(--color-primary)', textAlign: 'center', fontStyle: 'italic', padding: '20px', fontWeight: 'bold' }}>
                        ¡Felicidades! Todos los directores han sido procesados y mapeados.
                     </p>
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
export default Dashboard;
