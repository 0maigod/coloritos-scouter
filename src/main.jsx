import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("React Crash:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{color:'#ff4444', padding: '40px', background:'#111', fontSize:'18px', zIndex:99999, position:'fixed', inset:0, overflow:'auto'}}>
          <h1>🚨 Error Fatal en React 3D 🚨</h1>
          <p>Por favor, copia este texto y envíaselo a Tigra:</p>
          <pre style={{whiteSpace:'pre-wrap', background:'#222', padding:'20px', borderRadius:'10px'}}>
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children; 
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
