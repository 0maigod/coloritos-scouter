import React from 'react';
import VimeoAuth from './components/organisms/VimeoAuth';
import Dashboard from './components/organisms/Dashboard';
import { useApp } from './hooks/useApp';

function App() {
  const { vimeoToken, geminiToken, authenticate, logout } = useApp();

  return (
    <>
      {(!vimeoToken || !geminiToken) ? (
        <VimeoAuth onAuthenticate={authenticate} />
      ) : (
        <Dashboard onLogout={logout} />
      )}
    </>
  );
}

export default App;
