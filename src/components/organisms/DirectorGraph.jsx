import React, { useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line, Stars } from '@react-three/drei';

const CameraController = ({ selectedPos }) => {
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (selectedPos) {
      // Reutiliza el vector para no saturar el Garbage Collector a 60fps
      targetPos.set(selectedPos.x, selectedPos.y, selectedPos.z).normalize().multiplyScalar(20);
      camera.position.lerp(targetPos, 0.05);
    }
  });
  return null;
};

// Helper to generate 3D spherical positions (Fibonacci sphere)
const getFibonacciSpherePoints = (samples, radius = 5) => {
  if(samples === 0) return [];
  if(samples === 1) return [{x:0, y:radius, z:0}];
  const points = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2;
    const rSq = 1 - y * y;
    const r = Math.sqrt(Math.max(0, rSq));
    const theta = phi * i;
    points.push({ x: Math.cos(theta) * r * radius, y: y * radius, z: Math.sin(theta) * r * radius });
  }
  return points;
};

const Node = ({ dir, pos, isSelected, isDimmed, onClick }) => {
  const totalVideos = dir.metadata?.connections?.videos?.total || 0;
  // Use log base 10 to gracefully scale extreme differences (e.g. 10 vs 5000)
  const logFactor = Math.log10(totalVideos + 1);
  const sphereSize = (isSelected ? 0.35 : 0.12) * (0.8 + logFactor * 0.25);
  const fontSize = isSelected ? Math.max(16, Math.round(10 + logFactor * 3)) : Math.round(8 + logFactor * 3);

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh onPointerDown={(e) => { e.stopPropagation(); onClick(dir); }}>
        <sphereGeometry args={[sphereSize, 32, 32]} />
        <meshStandardMaterial 
          color={isSelected ? "#3b82f6" : "#ffffff"} 
          emissive={isSelected ? "#1d4ed8" : "#ffffff"} 
          emissiveIntensity={isSelected ? 0.5 : 0.4} 
          roughness={0.2} 
        />
      </mesh>
      
      {(!isDimmed || isSelected) && (
        <Html distanceFactor={15} center zIndexRange={[100, 0]}>
          <div 
            onPointerDown={(e) => { e.stopPropagation(); onClick(dir); }}
            style={{
              cursor: 'pointer',
              background: isSelected ? 'var(--color-primary)' : 'rgba(15, 17, 21, 0.7)',
              padding: `${isSelected ? 6 : Math.round(3 + logFactor)}px ${Math.round(8 + logFactor * 2)}px`,
              borderRadius: '12px',
              border: `1px solid ${isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)'}`,
              color: 'white',
              fontSize: `${fontSize}px`,
              fontWeight: isSelected ? 'bold' : 'normal',
              whiteSpace: 'nowrap',
              pointerEvents: 'auto',
              transition: 'all 0.2s',
              opacity: isDimmed ? 0.2 : 1,
              backdropFilter: 'blur(4px)'
            }}
          >
            {dir.name}
          </div>
        </Html>
      )}
    </group>
  );
}

const CategoryNode = ({ category, pos, onClick }) => {
    return (
        <group position={[pos.x, pos.y, pos.z]}>
            <mesh onPointerDown={(e) => { e.stopPropagation(); onClick(category); }}>
               <sphereGeometry args={[0.08, 16, 16]} />
               <meshStandardMaterial color="#3b82f6" emissive="#1e3a8a" />
            </mesh>
            <Html distanceFactor={15} center zIndexRange={[100, 0]}>
                <div onPointerDown={(e) => { e.stopPropagation(); onClick(category); }}
                     style={{
                        cursor: 'pointer',
                        background: '#1e293b', 
                        padding: '3px 8px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-primary)',
                        color: 'white',
                        fontSize: '9px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'auto'
                     }}>
                    {category}
                </div>
            </Html>
        </group>
    )
}

const Scene = ({ directors, selectedDirector, videos, onDirectorClick, onCategorySelect }) => {
  const [expanded, setExpanded] = useState(true);
  
  // Base radius for directors expands slightly if there are many
  const radius = 8 + (directors.length * 0.03); 
  const points = useMemo(() => getFibonacciSpherePoints(directors.length, radius), [directors.length, radius]);
  
  const uniqueCategories = useMemo(() => [...new Set(videos.map(v => v.category))].filter(Boolean), [videos]);
  const catPoints = useMemo(() => getFibonacciSpherePoints(uniqueCategories.length, 3), [uniqueCategories.length]);

  const selectedIndex = directors.findIndex(d => d.uri === selectedDirector?.uri);
  const selectedPos = selectedIndex >= 0 ? points[selectedIndex] : null;

  return (
    <>
      <CameraController selectedPos={selectedPos} />
      <OrbitControls autoRotate={!selectedDirector} autoRotateSpeed={0.5} enablePan={false} maxDistance={40} minDistance={2} dampingFactor={0.05} />
      <ambientLight intensity={0.2} />
      {/* Light from within the sphere to illuminate lines */}
      <pointLight position={[0, 0, 0]} intensity={3} color="#ffffff" distance={30} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

      {/* Central Sphere */}
      <group onPointerDown={() => setExpanded(!expanded)}>
          <mesh>
            <sphereGeometry args={[1.5, 32, 32]} />
            <meshStandardMaterial color="#ffffff" emissive="#333333" roughness={0.1} metalness={0.9} />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.8, 32, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
          </mesh>
      </group>

      <Html position={[0, -2.5, 0]} center zIndexRange={[0, 0]}>
         {!expanded && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', pointerEvents: 'none', letterSpacing: '2px' }}>CLICK PARA EXPANDIR</div>}
      </Html>

      {/* Directors */}
      {expanded && directors.map((dir, i) => {
         const pos = points[i];
         const isSelected = selectedDirector?.uri === dir.uri;
         const isDimmed = selectedDirector && !isSelected;

         return (
           <group key={dir.uri}>
             {/* The cord/line connecting center to node */}
             <Line
               points={[[0,0,0], [pos.x, pos.y, pos.z]]}
               color={isSelected ? "#3b82f6" : "#ffffff"}
               lineWidth={isSelected ? 2 : 1}
               transparent
               opacity={isDimmed ? 0.05 : (isSelected ? 0.8 : 0.15)}
             />
             
             <Node 
                dir={dir} 
                pos={pos} 
                isSelected={isSelected} 
                isDimmed={isDimmed} 
                onClick={onDirectorClick} 
             />
             
             {/* Render Sub Categories if selected */}
             {isSelected && uniqueCategories.map((cat, j) => {
                 const cPos = catPoints[j];
                 // Offset category by director pos
                 const absPos = { x: pos.x + cPos.x, y: pos.y + cPos.y, z: pos.z + cPos.z };
                 return (
                     <group key={cat}>
                        <Line
                          points={[[pos.x, pos.y, pos.z], [absPos.x, absPos.y, absPos.z]]}
                          color="#3b82f6"
                          lineWidth={1}
                          transparent
                          opacity={0.5}
                        />
                        <CategoryNode category={cat} pos={absPos} onClick={onCategorySelect} />
                     </group>
                 )
             })}
           </group>
         )
      })}
    </>
  )
}

const DirectorGraph = (props) => {
  const { onBackgroundClick } = props;
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)', zIndex: 0 }}>
      <Canvas camera={{ position: [0, 0, 20], fov: 60 }} onPointerMissed={() => onBackgroundClick?.()}>
         <Scene {...props} />
      </Canvas>
    </div>
  );
};

export default DirectorGraph;
