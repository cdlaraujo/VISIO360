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
 * The main coordinator of the entire application. It follows a pure coordinator pattern.
 * Its responsibilities are:
 * 1. Instantiate all core systems and feature modules.
 * 2. Define the high-level event-based communication between these modules.
 * It contains no business logic itself, delegating all tasks to specialized worker modules.
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
            // The two main features of the application are instantiated here.
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
     * This is the core of the coordinator's responsibility.
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
        // App.js decides whether the action is local or needs to be synced.
        this.eventBus.on('measurement:delete', (payload) => {
            if (this.collaboration?.isConnected()) {
                // If in a session, the collaboration module handles the synced deletion.
                this.collaboration.deleteAnnotation(payload.id);
            } else {
                // Otherwise, the measurements module performs a local-only delete.
                this.measurements.clearMeasurement(payload.id);
            }
        });

        this.logger.info('App: Cross-module integrations configured.');
    }
}
