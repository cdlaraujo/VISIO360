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
            throw new Error('Container element required');
        }
        this.container = container;
        
        // Core systems
        this.logger = new Logger('INFO');
        this.eventBus = new EventBus(this.logger);

        // Modules
        this.sceneManager = new SceneManager(this.logger, this.eventBus);
        this.renderer = null;
        this.modelLoader = new ModelLoader(this.logger, this.eventBus);
        this.uiManager = new UIManager(this.logger, this.eventBus);
        this.toolController = new ToolController(this.logger, this.eventBus);
        this.interactionController = null;
        this.measurementManager = null;
        this.collaborationManager = null;  // NEW!
    }

    async start() {
        this.logger.info('App: Starting application with collaboration...');
        
        try {
            // 1. Initialize scene
            const { scene } = this.sceneManager.initialize();

            // 2. Initialize renderer
            this.renderer = new Renderer(this.container, scene, this.logger, this.eventBus);
            const rendererComponents = this.renderer.initialize();
            
            // 3. Initialize other modules
            this.modelLoader.initialize();
            this.uiManager.initialize();

            // 4. Initialize interaction controller
            this.interactionController = new InteractionController(
                rendererComponents.camera,
                rendererComponents.domElement,
                this.logger,
                this.eventBus
            );

            // 5. Initialize measurement system
            this.measurementManager = new MeasurementManager(
                scene,
                this.logger,
                this.eventBus
            );

            // 6. Initialize collaboration system (NEW!)
            this.collaborationManager = new CollaborationManager(
                scene,
                this.logger,
                this.eventBus,
                {
                    usePeerJSCloud: true,
                    autoJoinRoom: true
                }
            );

            // 7. Setup integrations
            this._setupCrossModuleIntegration();
            
            // 8. Start animation loop
            this._animate();

            this.logger.info('App: Application started successfully');
            
        } catch (error) {
            this.logger.error('App: Initialization error', error);
            throw error;
        }
    }

    _setupCrossModuleIntegration() {
        // Measurement to collaboration sync
        this.eventBus.on('measurement:distance:completed', (payload) => {
            if (this.collaborationManager && this.collaborationManager.isConnected()) {
                const midPoint = payload.measurement.points[0].clone()
                    .add(payload.measurement.points[1]).multiplyScalar(0.5);

                this.collaborationManager.createAnnotation({
                    type: 'measurement',
                    subtype: 'distance',
                    distance: payload.measurement.distance,
                    points: payload.measurement.points.map(p => ({ x: p.x, y: p.y, z: p.z })),
                    position: { x: midPoint.x, y: midPoint.y, z: midPoint.z }
                });
            }
        });

        this.eventBus.on('measurement:area:completed', (payload) => {
            if (this.collaborationManager && this.collaborationManager.isConnected()) {
                const center = new THREE.Vector3();
                payload.measurement.points.forEach(p => center.add(p));
                center.divideScalar(payload.measurement.points.length);

                this.collaborationManager.createAnnotation({
                    type: 'area',
                    area: payload.measurement.area,
                    points: payload.measurement.points.map(p => ({ x: p.x, y: p.y, z: p.z })),
                    position: { x: center.x, y: center.y, z: center.z }
                });
            }
        });

        this.eventBus.on('measurement:surfaceArea:completed', (payload) => {
            if (this.collaborationManager && this.collaborationManager.isConnected()) {
                const center = new THREE.Vector3();
                payload.measurement.points.forEach(p => center.add(p));
                center.divideScalar(payload.measurement.points.length);

                this.collaborationManager.createAnnotation({
                    type: 'surfaceArea',
                    surfaceArea: payload.measurement.surfaceArea,
                    points: payload.measurement.points.map(p => ({ x: p.x, y: p.y, z: p.z })),
                    position: { x: center.x, y: center.y, z: center.z }
                });
            }
        });

        // Cleanup handler
        this.eventBus.on('app:cleanup', () => {
            this._cleanup();
        });

        this.logger.info('App: Cross-module integration configured');
    }

    _animate() {
        try {
            requestAnimationFrame(this._animate.bind(this));
            this.eventBus.emit('app:update');
        } catch (error) {
            this.logger.error('App: Animation loop error', error);
        }
    }

    _cleanup() {
        this.logger.info('App: Cleaning up resources...');
        
        if (this.measurementManager) {
            this.measurementManager.clearAllMeasurements();
        }

        if (this.collaborationManager) {
            this.collaborationManager.disconnect();
        }

        this.logger.info('App: Cleanup complete');
    }

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
            collaborationManager: this.collaborationManager  // NEW!
        };
    }
}