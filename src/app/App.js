// src/app/App.js (Cesium version)

import { Logger }                from '../utils/Logger.js';
import { EventBus }              from './EventBus.js';
import { CesiumViewer }          from '../core/CesiumViewer.js';
import { ModelLoader }           from '../core/ModelLoader.js';
import { InteractionController } from '../core/InteractionController.js';
import { UIManager }             from '../ui/UIManager.js';
import { ToolController }        from '../ui/ToolController.js';
import { Measurements }          from '../modules/measurements.js';
import { Collaboration }         from '../modules/collaboration.js';

export class App {
    constructor(containerId) {
        this.containerId = containerId;
        this.logger   = new Logger('INFO');
        this.eventBus = new EventBus(this.logger);
    }

    async start() {
        this.logger.info('App: Starting...');
        try {
            // 1 — 3D Viewer
            const cesiumViewer = new CesiumViewer(this.containerId, this.logger, this.eventBus);
            const { viewer } = cesiumViewer.initialize();
            this.viewer = viewer;

            // 2 — Model Loader
            this.modelLoader = new ModelLoader(viewer, this.logger, this.eventBus);
            this.modelLoader.initialize();

            // 3 — Interaction (replaces OrbitControls + Raycaster)
            this.interactionController = new InteractionController(viewer, this.logger, this.eventBus);

            // 4 — UI
            this.uiManager = new UIManager(this.logger, this.eventBus);
            this.uiManager.initialize();

            this.toolController = new ToolController(this.logger, this.eventBus, this.interactionController);

            // 5 — Feature Modules
            this.collaboration = new Collaboration(viewer, this.logger, this.eventBus);
            this.measurements  = new Measurements(viewer, this.logger, this.eventBus, this.collaboration);

            // 6 — Cross-module wiring
            this._setupCrossModuleIntegration();

            this.logger.info('App: Started successfully.');
        } catch (error) {
            this.logger.error('App: Critical error during initialization.', error);
            throw error;
        }
    }

    _setupCrossModuleIntegration() {
        // Store model blob for P2P sharing
        this.eventBus.on('model:loaded', (payload) => {
            if (payload.modelBlob && this.collaboration) {
                this.collaboration.setModelData(payload.modelBlob, payload.fileName);
            }
        });

        // Measurement delete: if in a room, broadcast; otherwise delete locally
        this.eventBus.on('measurement:delete', (payload) => {
            if (this.collaboration?.isConnected()) {
                this.collaboration.deleteAnnotation(payload.id);
            } else {
                this.measurements.clearMeasurement(payload.id);
            }
        });

        // Collaboration room requests
        this.eventBus.on('collaboration:create:request', async (payload) => {
            if (!this.collaboration) return;
            try {
                this.collaboration.userName = payload.userName;
                await this.collaboration.connect();
            } catch (err) {
                this.logger.error('App: Failed to create room', err);
                this.eventBus.emit('ui:progress:end');
                this.eventBus.emit('ui:notification:show', { message: 'Erro ao criar sala', type: 'error' });
            }
        });

        this.eventBus.on('collaboration:join:request', async (payload) => {
            if (!this.collaboration) return;
            try {
                this.collaboration.userName = payload.userName;
                await this.collaboration.connect(payload.roomId);
            } catch (err) {
                this.logger.error('App: Failed to join room', err);
                this.eventBus.emit('ui:progress:end');
                this.eventBus.emit('ui:notification:show', { message: 'Erro ao entrar na sala', type: 'error' });
            }
        });

        this.eventBus.on('collaboration:disconnect:request', () => {
            this.collaboration?.disconnect();
        });

        this.eventBus.on('collaboration:peers:request', () => {
            if (this.collaboration) {
                this.eventBus.emit('collaboration:peers:update', this.collaboration.getPeerProfileData());
            }
        });

        this.logger.info('App: Cross-module integrations configured.');
    }
}
