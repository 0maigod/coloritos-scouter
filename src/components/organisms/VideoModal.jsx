import React, { useEffect } from 'react';
import Button from '../atoms/Button';

const VideoModal = ({ video, isFavorited, onToggleFavorite, onClose }) => {
  useEffect(() => {
    const handleEsc = (e) => {
      // Evita colisiones si hay otros listeners, pero queremos cerrar el modal.
      if (e.key === 'Escape') {
        onClose();
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    // Usamos captura (true) para que el modal atrape el ESC antes que el dashboard
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  if (!video) return null;

  // Extraemos el ID numérico de Vimeo. El ID en la DB suele ser el URI (ej: /videos/12345678)
  const videoId = video.uri?.split('/').pop() || video.id?.split('/').pop() || video.link?.split('/').pop();

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(16px)',
        zIndex: 9999, // Asegura que esté por encima de la barra de búsqueda y el Graph
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-lg)',
        opacity: 0,
        animation: 'fadeInOverlay 0.3s forwards ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
           position: 'absolute',
           top: '24px',
           right: '32px',
           zIndex: 10000
        }}
      >
        <Button variant="danger" onClick={onClose} style={{ fontSize: '1rem', padding: '8px 24px', borderRadius: '30px', fontWeight: 'bold' }}>
          Cerrar
        </Button>
      </div>
      
      <div 
        onClick={(e) => e.stopPropagation()} // Evitamos que un clic en el video cierre el modal
        style={{
          width: '100%',
          maxWidth: '1200px',
          aspectRatio: '16/9',
          background: '#000',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
          transform: 'scale(0.95)',
          animation: 'scaleUp 0.3s forwards cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        <iframe
          src={`https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0&color=00ff88`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={video.name}
        ></iframe>
      </div>
      
      <div 
        style={{ 
          marginTop: '24px', 
          textAlign: 'center', 
          color: 'white', 
          maxWidth: '800px',
          animation: 'slideUp 0.4s forwards ease-out',
          opacity: 0
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <span>{video.name}</span>
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(); }}
            style={{ 
               fontSize: '0.9rem', 
               background: isFavorited ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)', 
               border: isFavorited ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.4)',
               color: isFavorited ? '#000' : 'white', 
               padding: '6px 16px', 
               borderRadius: '20px', 
               display: 'inline-flex', 
               alignItems: 'center', 
               gap: '8px', 
               fontWeight: 'bold',
               transition: 'all 0.2s',
               cursor: 'pointer',
               boxShadow: isFavorited ? '0 0 10px var(--color-primary)' : 'none'
            }}
            title={isFavorited ? "Quitar de Mi Lista" : "Agregar a Mi Lista Corta"}
          >
             Agregar
          </button>
        </h2>
        <p style={{ margin: 0, color: 'var(--color-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
           <span>{video.category}</span>
           {video.subCategory && video.subCategory !== 'Varios' && (
             <>
               <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
               <span>{video.subCategory}</span>
             </>
           )}
           {video.brand && video.brand !== 'Indefinida' && (
             <>
               <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
               <span style={{ color: 'gold' }}>★ {video.brand}</span>
             </>
           )}
        </p>
      </div>

      <style>{`
        @keyframes scaleUp {
          to { transform: scale(1); }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default VideoModal;
