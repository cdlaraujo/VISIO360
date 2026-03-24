// src/main.js
import { App } from './app/App.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const app = new App('cesiumContainer');
        await app.start();
        window.app = app;
    } catch (error) {
        console.error('Visio360: Fatal error', error);
        const el = document.getElementById('cesiumContainer');
        if (el) {
            el.innerHTML = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff4444;background:rgba(0,0,0,0.9);padding:30px;border-radius:12px;text-align:center;">
                <h2>Erro na Aplicação</h2>
                <p>${error.message || 'Erro desconhecido'}</p>
                <button onclick="location.reload()" style="background:#007bff;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;margin-top:15px;">Tentar Novamente</button>
            </div>`;
        }
    }
});
