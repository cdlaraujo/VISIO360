import { App } from './app/App.js';

/**
 * Handles fatal application errors by displaying a user-friendly message.
 * @param {Error} error - The error that occurred.
 */
function handleGlobalError(error) {
    console.error('❌ Erro fatal na aplicação:', error);
    document.getElementById('loading')?.remove();
    document.getElementById('progress-bar-container')?.remove();
    const appContainer = document.getElementById('app');
    if (appContainer) {
        appContainer.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #ff4444; background: rgba(0, 0, 0, 0.9); padding: 30px; border-radius: 12px; border: 1px solid #ff4444;">
                <h2>🚨 Erro na Aplicação</h2>
                <p><strong>Motivo:</strong> ${error.message || 'Erro desconhecido'}</p>
                <p style="font-size: 0.9em; color: #aaa; margin-top: 15px;">Verifique o console do navegador (F12) para detalhes.</p>
                <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin-top: 20px;">🔄 Tentar Novamente</button>
            </div>`;
    }
}

/**
 * Application entry point.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const appContainer = document.getElementById('app');
        if (!appContainer) throw new Error('Container #app não encontrado no DOM');
        
        const app = new App(appContainer);
        await app.start();

        // Make the app instance globally accessible for debugging
        window.app = app;
        console.log('✅ Aplicação inicializada com sucesso!');
    } catch (error) {
        handleGlobalError(error);
    }
});