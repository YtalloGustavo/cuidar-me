// src/index.js (VERSÃO CORRIGIDA)
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App'; // Importa nosso componente principal

// Encontra o elemento 'root' no seu HTML
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderiza (desenha) nosso App na tela
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);