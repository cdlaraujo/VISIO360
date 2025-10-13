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

/**
 * @class App
 * @description Main application class with collaboration support
 */
export class App {
    constructor(container) {
        if (!container) {
            throw new Error('Container element is required for the application.');
        }
        this.container = container;

        // Core systems
        this.logger = new Logger('INFO');
        this.eventBus = new EventBus(this.logger);

        // Application Modules
        this.sceneManager = new SceneManager(this.logger, this.eventBus);
        this.renderer = null;
        this.modelLoader = new ModelLoader(this.logger, this.eventBus);
        this.uiManager = new UIManager(this.logger, this.eventBus);
        this.toolController = new ToolController(this.logger, this.eventBus);
        this.interactionController = null;
        this.measurementManager = null;
        this.collaborationManager = null; // Added for collaboration
    }

    async start() {
        this.logger.info('App: Starting collaborative 3D viewer...');

        try {
            // 1. Initialize SceneManager and get the scene
            const { scene } = this.sceneManager.initialize();

            // 2. Initialize Renderer
            this.renderer = new Renderer(this.container, scene, this.logger, this.eventBus);
            const rendererComponents = this.renderer.initialize();

            // 3. Initialize core modules
            this.modelLoader.initialize();
            this.uiManager.initialize();

            // 4. Initialize InteractionController
            this.interactionController = new InteractionController(
                rendererComponents.camera,
                rendererComponents.domElement,
                this.logger,
                this.eventBus
            );

            // 5. Initialize MeasurementManager
            this.measurementManager = new MeasurementManager(
                scene,
                this.logger,
                this.eventBus
            );

            // 6. Initialize CollaborationManager
            this.collaborationManager = new CollaborationManager(
                scene,
                this.logger,
                this.eventBus,
                {
                    usePeerJSCloud: true, // Use the free, public PeerJS server
                    autoJoinRoom: true    // Automatically join a room if the URL has a room code
                }
            );

            // 7. Configure integrations between modules
            this._setupCrossModuleIntegration();

            // 8. Start the animation loop
            this._animate();

            this.logger.info('App: Application started successfully.');

        } catch (error) {
            this.logger.error('App: A critical error occurred during initialization.', error);
            // Re-throw the error to be caught by the global handler in index.html
            throw error;
        }
    }

    /**
     * Sets up event listeners to enable communication between different modules.
     * @private
     */
    _setupCrossModuleIntegration() {
        // When a model is loaded from a URL, share it with peers
        this.eventBus.on('model:loaded', (payload) => {
            // Check if the model has a URL attached to its data
            if (payload.model.userData.url) {
                if (this.collaborationManager && this.collaborationManager.isConnected()) {
                    const modelUrl = payload.model.userData.url;
                    this.collaborationManager.currentModelURL = modelUrl;
                    // Broadcast the model URL to all connected peers
                    this.collaborationManager._broadcast({
                        type: 'set-model',
                        url: modelUrl,
                        fileName: modelUrl.split('/').pop()
                    });
                }
            }
        });

        // When a local measurement is completed, share it with peers
        this.eventBus.on('measurement:distance:completed', (payload) => {
            if (this.collaborationManager && this.collaborationManager.isConnected()) {
                // Send measurement data, not the full Three.js objects
                this.collaborationManager.createAnnotation({
                    type: 'measurement',
                    distance: payload.measurement.distance,
                    points: payload.measurement.points.map(p => ({ x: p.x, y: p.y, z: p.z }))
                });
            }
        });

        // Add more measurement sync handlers here...

        // Listener for general resource cleanup
        this.eventBus.on('app:cleanup', () => this._cleanup());

        this.logger.info('App: Cross-module integrations have been configured.');
    }

    /**
     * The main animation loop, called every frame.
     * @private
     */
    _animate() {
        requestAnimationFrame(this._animate.bind(this));
        // Emit a general update event that other modules can listen to
        this.eventBus.emit('app:update');
    }

    /**
     * Cleans up resources when the application is closed or reset.
     * @private
     */
    _cleanup() {
        this.logger.info('App: Cleaning up application resources...');
        if (this.measurementManager) {
            this.measurementManager.clearAllMeasurements();
        }
        if (this.collaborationManager) {
            this.collaborationManager.disconnect();
        }
        // Add more cleanup logic for other modules if needed
        this.logger.info('App: Cleanup complete.');
    }

    /**
     * Public API to get references to the main modules (useful for debugging).
     * @returns {object} An object containing references to the application's modules.
     */
    getModules() {
        return {
            logger: this.logger,
            eventBus: this.eventBus,
            sceneManager: this.sceneManager,
            renderer: this.renderer,
            modelLoader: this.modelLoader,
            uiManager: this.uiManager,
            toolController: this.toolController,
            interactionController: this.interactionController,
            measurementManager: this.measurementManager,
            collaborationManager: this.collaborationManager
        };
    }
}