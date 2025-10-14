// src/app/App.js
import { Logger } from '../utils/Logger.js';
import { EventBus } from './EventBus.js';
import { SceneManager } from '../core/SceneManager.js';
import { Renderer } from '../core/Renderer.js';
import { ModelLoader } from '../core/ModelLoader.js';
import { UIManager } from '../ui/UIManager.js';
import { ToolController } from '../ui/ToolController.js';
import { InteractionController } from '../core/InteractionController.js';
import { MeasurementManager } from '../modules/MeasurementManager.js';
import { CollaborationManager } from '../modules/CollaborationManager.js';

export class App {
    constructor(container) {
        this.container = container;
        this.logger = new Logger('INFO');
        this.eventBus = new EventBus(this.logger);
        this.sceneManager = new SceneManager(this.logger, this.eventBus);
        this.modelLoader = new ModelLoader(this.logger, this.eventBus);
        this.uiManager = new UIManager(this.logger, this.eventBus);
        this.toolController = new ToolController(this.logger, this.eventBus);
    }

    async start() {
        this.logger.info('App: Starting...');
        try {
            // WebGL Check
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) {
                throw new Error('Seu navegador não suporta WebGL, que é necessário para rodar esta aplicação.');
            }

            const { scene } = this.sceneManager.initialize();
            this.renderer = new Renderer(this.container, scene, this.logger, this.eventBus);
            const rendererComponents = this.renderer.initialize();

            this.modelLoader.initialize();
            this.uiManager.initialize();

            this.interactionController = new InteractionController(
                rendererComponents.camera,
                rendererComponents.domElement,
                this.logger,
                this.eventBus
            );
            this.measurementManager = new MeasurementManager(scene, this.logger, this.eventBus);
            this.collaborationManager = new CollaborationManager(scene, this.logger, this.eventBus);

            // Pass collaboration manager to measurement manager for annotation syncing
            this.measurementManager.setCollaborationManager(this.collaborationManager);

            this._setupCrossModuleIntegration();
            this._animate();
            this.logger.info('App: Started successfully.');
        } catch (error) {
            this.logger.error('App: A critical error occurred during initialization.', error);
            throw error;
        }
    }

    _setupCrossModuleIntegration() {
        // When a model is loaded, give its data to the CollaborationManager for P2P sharing
        this.eventBus.on('model:loaded', (payload) => {
            if (payload.modelBlob && this.collaborationManager) {
                this.logger.info(`App: Storing model data (${(payload.modelBlob.size / 1024 / 1024).toFixed(2)} MB) for P2P sharing.`);
                this.collaborationManager.setModelData(payload.modelBlob, payload.model.name);
            }
        });

        // When a measurement is completed, it is automatically broadcast by AnnotationSync,
        // so no specific handler is needed here anymore for creation.

        // ✅ FIX: This is the corrected event listener for deletion.
        this.eventBus.on('measurement:delete', (payload) => {
            // If we are in a collaborative session, ALL delete operations MUST go through the sync manager.
            if (this.collaborationManager?.isConnected()) {
                this.collaborationManager.deleteAnnotation(payload.id);
            } else {
                // Only if we are NOT connected, we perform a local-only delete.
                this.measurementManager.clearMeasurement(payload.id);
            }
        });

        // Add a listener to update the UI when annotations change (from local or remote actions)
        this.eventBus.on('annotation:changed', () => {
            this.measurementManager._updateUI();
        });

        this.logger.info('App: Cross-module integrations configured.');
    }

    _animate() {
        requestAnimationFrame(this._animate.bind(this));
        this.eventBus.emit('app:update');
    }
}