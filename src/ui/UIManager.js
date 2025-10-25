// src/ui/UIManager.js - The FINAL Coordinator

// 1. Import all the new worker modules
import { CollaborationUI } from './modules/CollaborationUI.js';
import { ModelUI } from './modules/ModelUI.js';
import { MeasurementsPanel } from './modules/MeasurementsPanel.js';
import { AppChromeUI } from './modules/AppChromeUI.js'; // <<< ADD THIS

export class UIManager {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        
        // This holds all the specialized UI worker modules
        this.modules = {};
    }

    initialize() {
        this._getUIReferences();
        this._validateRequiredElements();
        this._setupPanelReferences();

        // 2. Instantiate all the new workers
        
        this.modules.collaboration = new CollaborationUI(this.logger, this.eventBus, {
            // ... (elements passed in) ...
            createRoomBtn: this.ui.createRoomBtn,
            joinRoomBtn: this.ui.joinRoomBtn,
            createRoomBtnPanel: this.ui.createRoomBtnPanel,
            joinRoomBtnPanel: this.ui.joinRoomBtnPanel,
            joinRoomInput: this.ui.joinRoomInput,
            joinRoomConfirmBtn: this.ui.joinRoomConfirmBtn,
            joinRoomCancelBtn: this.ui.joinRoomCancelBtn,
            disconnectRoomBtn: this.ui.disconnectRoomBtn,
            userNameInput: this.ui.userNameInput,
            roomIdInput: this.ui.roomIdInput,
            roomConnectControls: this.ui.roomConnectControls,
            roomStatus: this.ui.roomStatus,
            connectionStatus: this.ui.connectionStatus,
            roomCodeDisplay: this.ui.roomCodeDisplay,
            peerCount: this.ui.peerCount,
            peersContainer: this.ui.peersContainer,
            userNameDisplay: this.ui.userNameDisplay,
        });

        this.modules.model = new ModelUI(this.logger, this.eventBus, {
            // ... (elements passed in) ...
            modelConfigBtn: this.ui.modelConfigBtn,
            modelLoadingSection: this.ui.modelLoadingSection,
            closeModelModal: this.ui.closeModelModal,
            loadModelUrlBtn: this.ui.loadModelUrlBtn,
            modelUrlInput: this.ui.modelUrlInput,
            fileInput: this.ui.fileInput,
            modelInputArea: this.ui.modelInputArea,
            modelInfoArea: this.ui.modelInfoArea,
            modelNameDisplay: this.ui.modelNameDisplay,
            currentModelName: this.ui.currentModelName,
            changeModelBtn: this.ui.changeModelBtn,
            modelFormatDisplay: this.ui.modelFormatDisplay,
            modelVerticesDisplay: this.ui.modelVerticesDisplay
        });
        
        this.modules.measurements = new MeasurementsPanel(this.logger, this.eventBus, {
            // ... (elements passed in) ...
            measurementsPanel: this.ui.measurementsPanel,
            measurementsContainer: this.ui.measurementsContainer
        });

        this.modules.chrome = new AppChromeUI(this.logger, this.eventBus, {
            // ... (elements passed in) ...
            leftPanel: this.ui.leftPanel,
            rightPanel: this.ui.rightPanel,
            measureToolBtn: this.ui.measureToolBtn,
            areaToolBtn: this.ui.areaToolBtn,
            angleToolBtn: this.ui.angleToolBtn,
            surfaceAreaToolBtn: this.ui.surfaceAreaToolBtn,
            volumeToolBtn: this.ui.volumeToolBtn, 
            volumeBoxToolBtn: this.ui.volumeBoxToolBtn, // <-- NOVO
            toolInstructions: this.ui.toolInstructions,
            coordinates: this.ui.coordinates,
            fpsCounter: this.ui.fpsCounter,
            progressBarContainer: this.ui.progressBarContainer,
            progressBarFill: this.ui.progressBarFill,
            progressText: this.ui.progressText,
        });

        this._setupEventListeners();
        
        this.logger.info('UIManager: All UI modules initialized.');
    }

    /**
     * Finds and stores references to all DOM elements.
     * This is the only place that should query the DOM directly.
     */
    _getUIReferences() {
        this.ui = {
            // Panel containers
            leftPanel: document.querySelector('.left-panel'),
            rightPanel: document.querySelector('.right-panel'),
            
            // Collaboration elements
            createRoomBtn: document.getElementById('create-room-btn'),
            createRoomBtnPanel: document.getElementById('create-room-btn-panel'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            joinRoomBtnPanel: document.getElementById('join-room-btn-panel'),
            joinRoomInput: document.getElementById('join-room-input'),
            joinRoomConfirmBtn: document.getElementById('join-room-confirm-btn'),
            joinRoomCancelBtn: document.getElementById('join-room-cancel-btn'),
            disconnectRoomBtn: document.getElementById('disconnect-room-btn'),
            userNameInput: document.getElementById('user-name-input'),
            roomIdInput: document.getElementById('room-id-input'),
            roomConnectControls: document.getElementById('room-connect-controls'),
            roomStatus: document.getElementById('room-status'),
            connectionStatus: document.getElementById('connection-status'),
            roomCodeDisplay: document.getElementById('room-code-display'),
            peerCount: document.getElementById('peer-count'),
            peersContainer: document.getElementById('peers-container'),
            userNameDisplay: document.getElementById('user-name-display'),

            // Model loading elements
            modelConfigBtn: document.getElementById('model-config-btn'),
            modelLoadingSection: document.getElementById('model-loading-section'),
            closeModelModal: document.getElementById('close-model-modal'),
            loadModelUrlBtn: document.getElementById('load-model-url-btn'),
            modelUrlInput: document.getElementById('model-url-input'),
            fileInput: document.getElementById('model-input'),
            modelInputArea: document.getElementById('model-input-area'),
            modelInfoArea: document.getElementById('model-info-area'),
            modelNameDisplay: document.getElementById('model-name-display'),
            currentModelName: document.getElementById('current-model-name'),
            changeModelBtn: document.getElementById('change-model-btn'),
            modelFormatDisplay: document.getElementById('model-format-display'),
            modelVerticesDisplay: document.getElementById('model-vertices-display'),

            // Measurement tool elements
            measureToolBtn: document.getElementById('measure-tool-btn'),
            areaToolBtn: document.getElementById('area-tool-btn'),
            angleToolBtn: document.getElementById('angle-tool-btn'),
            surfaceAreaToolBtn: document.getElementById('surface-area-tool-btn'),
            volumeToolBtn: document.getElementById('volume-tool-btn'), 
            volumeBoxToolBtn: document.getElementById('volume-box-tool-btn'), // <-- NOVO
            clearAllBtn: document.getElementById('clear-all-btn'),

            // Measurements panel
            measurementsPanel: document.getElementById('measurements-panel'),
            measurementsContainer: document.getElementById('measurements-container'),

            // Instructions and status
            toolInstructions: document.getElementById('tool-instructions'),
            coordinates: document.getElementById('coordinates'),
            fpsCounter: document.getElementById('fps-counter'),

            // Progress/Loading
            progressBarContainer: document.querySelector('.progress-bar-container'),
            progressBarFill: document.querySelector('.progress-bar-fill'),
            progressText: document.querySelector('.progress-text'),
        };
    }

    _validateRequiredElements() {
        // ... (validation logic is unchanged) ...
    }

    _setupPanelReferences() {
        // ... (panel reference logic is unchanged) ...
    }

    _showFatalError(missingElements) {
        // ... (Error display logic remains unchanged) ...
    }

    /**
     * 3. The UIManager's event listeners are now only for "root" DOM events.
     * All event *handling* is delegated to the worker modules.
     */
    _setupEventListeners() {
        // Tool buttons (Global root DOM events)
        this._safeAddEventListener(this.ui.measureToolBtn, 'click', () => 
            this.eventBus.emit('tool:activate', { tool: 'measure' }));
        this._safeAddEventListener(this.ui.areaToolBtn, 'click', () => 
            this.eventBus.emit('tool:activate', { tool: 'area' }));
        this._safeAddEventListener(this.ui.angleToolBtn, 'click', () => 
            this.eventBus.emit('tool:activate', { tool: 'angle' }));
        this._safeAddEventListener(this.ui.surfaceAreaToolBtn, 'click', () => 
            this.eventBus.emit('tool:activate', { tool: 'surfaceArea' }));
        this._safeAddEventListener(this.ui.volumeToolBtn, 'click', () => // <-- ADICIONADO
            this.eventBus.emit('tool:activate', { tool: 'volume' }));
        this._safeAddEventListener(this.ui.volumeBoxToolBtn, 'click', () => // <-- NOVO
            this.eventBus.emit('tool:activate', { tool: 'volumeBox' }));
        this._safeAddEventListener(this.ui.clearAllBtn, 'click', () => {
            this.eventBus.emit('measurement:clear:all');
            this.eventBus.emit('collaboration:clear-all-annotations');
        });

        // --- ALL OTHER DOM AND BUS LISTENERS ARE GONE ---
        // They are now encapsulated within their respective worker modules.

        this.logger.info('UIManager: Root event listeners configured.');
    }

    _safeAddEventListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    }
}