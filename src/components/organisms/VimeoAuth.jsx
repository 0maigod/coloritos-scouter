import React, { useState } from 'react';
import Button from '../atoms/Button';
import Input from '../atoms/Input';

const VimeoAuth = ({ onAuthenticate }) => {
  const [vimeoToken, setVimeoToken] = useState('');
  const [geminiToken, setGeminiToken] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (vimeoToken.trim() && geminiToken.trim()) {
      onAuthenticate(vimeoToken.trim(), geminiToken.trim());
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-form">
        <h2 style={{ margin: '0 0 var(--space-sm) 0' }}>Vimeo Scouter ✨</h2>
        <p style={{ margin: '0 0 var(--space-md) 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Ingresa tus tokens para explorar y usar IA para clasificar los videos publicitarios de los directores que sigues.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Input 
            placeholder="Vimeo Personal Access Token" 
            value={vimeoToken}
            onChange={(e) => setVimeoToken(e.target.value)}
          />
          <Input 
            type="password"
            placeholder="Google Gemini API Key" 
            value={geminiToken}
            onChange={(e) => setGeminiToken(e.target.value)}
          />
          <Button type="submit" disabled={!vimeoToken || !geminiToken}>Conectar y Clasificar</Button>
        </form>
      </div>
    </div>
  );
};

export default VimeoAuth;
