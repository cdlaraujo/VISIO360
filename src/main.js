// src/main.js
import './style.css';
import { Visio360Viewer } from './core/Visio360Viewer.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('app');
    
    if (container) {
        // Toda a complexidade agora está encapsulada dentro do Viewer.
        const viewer = new Visio360Viewer(container);
        viewer.init();
    } else {
        console.error('Fatal: Contêiner da aplicação #app não encontrado.');
    }
});