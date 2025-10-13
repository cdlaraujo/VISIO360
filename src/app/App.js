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

        // When a measurement is completed, broadcast it to peers
        this.eventBus.on('measurement:distance:completed', (payload) => {
            if (this.collaborationManager?.isConnected()) {
                this.collaborationManager.createAnnotation({
                    type: 'measurement',
                    distance: payload.measurement.distance,
                    points: payload.measurement.points.map(p => ({ x: p.x, y: p.y, z: p.z }))
                });
            }
        });
        this.logger.info('App: Cross-module integrations configured.');
    }

    _animate() {
        requestAnimationFrame(this._animate.bind(this));
        this.eventBus.emit('app:update');
    }
}