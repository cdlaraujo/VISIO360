/**
 * @file main.js
 * @description Application Entry Point. This is the first file to be executed.
 */
import { App } from './App.js';

// Wait for the DOM to be fully loaded before starting the application
document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app');
    
    if (appContainer) {
        try {
            const app = new App(appContainer);
            app.start();
        } catch (error) {
            console.error('Fatal Error during app initialization:', error);
            appContainer.innerHTML = '<p style="color: red; text-align: center;">An error occurred. Please check the console.</p>';
        }
    } else {
        console.error('Fatal Error: Application container #app not found in the DOM.');
    }
});