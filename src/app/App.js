import { Logger } from '../utils/Logger.js';
import { EventBus } from './EventBus.js';
import { SceneManager } from '../core/SceneManager.js';
import { Renderer } from '../core/Renderer.js';
import { ModelLoader } from '../core/ModelLoader.js';
import { UIManager } from '../ui/UIManager.js';
import { ToolController } from '../ui/ToolController.js';
import { InteractionController } from '../core/InteractionController.js';
import { AnimationLoop } from '../core/AnimationLoop.js';
import { Measurements } from '../modules/measurements.js';
import { Collaboration } from '../modules/collaboration.js';

/**
 * @class App
 * @description
 * The main coordinator of the entire application.
 */
export class App {
    constructor(container) {
        this.container = container;
        this.logger = new Logger('INFO');
        this.eventBus = new EventBus(this.logger);

        // --- Instantiate Core Systems ---
        this.sceneManager = new SceneManager(this.logger, this.eventBus);
        this.modelLoader = new ModelLoader(this.logger, this.eventBus);
        this.uiManager = new UIManager(this.logger, this.eventBus);
        this.toolController = new ToolController(this.logger, this.eventBus);
        this.animationLoop = new AnimationLoop(this.eventBus);
    }

    async start() {
        this.logger.info('App: Starting...');
        try {
            // --- Renderer and Scene Initialization ---
            const { scene } = this.sceneManager.initialize();
            this.renderer = new Renderer(this.container, scene, this.logger, this.eventBus);
            const rendererComponents = this.renderer.initialize();

            // --- Initialize Core Modules ---
            this.modelLoader.initialize();
            this.uiManager.initialize();

            this.interactionController = new InteractionController(
                rendererComponents.camera,
                rendererComponents.domElement,
                this.logger,
                this.eventBus
            );
            
            // --- Initialize Feature Modules ---
            this.collaboration = new Collaboration(scene, this.logger, this.eventBus);
            this.measurements = new Measurements(scene, this.logger, this.eventBus, this.collaboration);

            // --- Wire up high-level integrations and start the app ---
            this._setupCrossModuleIntegration();
            this.animationLoop.start();

            this.logger.info('App: Started successfully.');
        } catch (error) {
            this.logger.error('App: A critical error occurred during initialization.', error);
            throw error;
        }
    }

    /**
     * Wires up high-level event communication between major, decoupled modules.
     * @private
     */
    _setupCrossModuleIntegration() {
        // When a model is loaded, give its data to the Collaboration module for P2P sharing.
        this.eventBus.on('model:loaded', (payload) => {
            if (payload.modelBlob && this.collaboration) {
                this.logger.info(`App: Storing model data for P2P sharing.`);
                this.collaboration.setModelData(payload.modelBlob, payload.model.name);
            }
        });

        // Handle the deletion of a measurement.
        this.eventBus.on('measurement:delete', (payload) => {
            if (this.collaboration?.isConnected()) {
                this.collaboration.deleteAnnotation(payload.id);
            } else {
                this.measurements.clearMeasurement(payload.id);
            }
        });

        // --- Collaboration UI Requests (NEW) ---

        // Listen for request from CollaborationUI to create a room
        this.eventBus.on('collaboration:create:request', async (payload) => {
            if (!this.collaboration) return;
            try {
                this.collaboration.userName = payload.userName;
                await this.collaboration.connect();
                // Success is handled by the 'collaboration:connected' event
            } catch (error) {
                this.logger.error('App: Failed to create room', error);
                // Tell UI to hide progress bar and show error
                this.eventBus.emit('ui:progress:end');
                this.eventBus.emit('ui:notification:show', {
                    message: 'Erro ao criar sala',
                    type: 'error'
                });
            }
        });

        // Listen for request from CollaborationUI to join a room
        this.eventBus.on('collaboration:join:request', async (payload) => {
            if (!this.collaboration) return;
            try {
                this.collaboration.userName = payload.userName;
                await this.collaboration.connect(payload.roomId);
                // Success is handled by the 'collaboration:connected' event
            } catch (error) {
                this.logger.error('App: Failed to join room', error);
                // Tell UI to hide progress bar and show error
                this.eventBus.emit('ui:progress:end');
                this.eventBus.emit('ui:notification:show', {
                    message: 'Erro ao entrar na sala',
                    type: 'error'
                });
            }
        });

        // Listen for request from CollaborationUI to disconnect
        this.eventBus.on('collaboration:disconnect:request', () => {
            if (this.collaboration) {
                this.collaboration.disconnect();
            }
        });
        
        // Listen for request from CollaborationUI to get peer data
        this.eventBus.on('collaboration:peers:request', () => {
            if (this.collaboration) {
                const peerData = this.collaboration.getPeerProfileData();
                this.eventBus.emit('collaboration:peers:update', peerData);
            }
        });

        this.logger.info('App: Cross-module integrations configured.');
    }
}