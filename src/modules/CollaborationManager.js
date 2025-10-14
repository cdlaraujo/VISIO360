// ============================================================================
// FILE: src/modules/CollaborationManager.js (PURE COORDINATOR)
// ============================================================================

import { ConnectionManager } from './collaboration/ConnectionManager.js';
import { RoomManager } from './collaboration/RoomManager.js';
import { FileTransferSender } from './collaboration/FileTransferSender.js';
import { FileTransferReceiver } from './collaboration/FileTransferReceiver.js';
import { PeerProfileManager } from './collaboration/PeerProfileManager.js';
import { AnnotationSync } from './collaboration/AnnotationSync.js';
import { ModelSyncManager } from './collaboration/ModelSyncManager.js';

/**
 * @class CollaborationManager
 * @description Pure orchestrator that coordinates collaboration sub-modules.
 * Contains NO business logic - only delegates to specialized modules.
 */
export class CollaborationManager {
    constructor(scene, logger, eventBus) {
        this.scene = scene;
        this.logger = logger;
        this.eventBus = eventBus;

        // Initialize all sub-modules
        this.connectionManager = new ConnectionManager(logger, eventBus);
        this.roomManager = new RoomManager(this.connectionManager, logger, eventBus);
        this.fileSender = new FileTransferSender(this.connectionManager, logger, eventBus);
        this.fileReceiver = new FileTransferReceiver(this.connectionManager, logger, eventBus);
        this.profileManager = new PeerProfileManager(this.connectionManager, logger, eventBus);
        this.annotationSync = new AnnotationSync(scene, this.connectionManager, logger, eventBus);
        this.modelSync = new ModelSyncManager(this.connectionManager, this.fileSender, logger, eventBus);

        this._setupIntegration();

        this.logger.info('CollaborationManager: Initialized (pure coordinator)');
    }

    // ========================================================================
    // PUBLIC API - Simple delegation to sub-modules
    // ========================================================================

    setModelData(blob, fileName) {
        this.modelSync.setModelData(blob, fileName);
    }

    createAnnotation(annotationData) {
        // AnnotationSync already listens to measurement events, but expose for direct calls
        if (this.isConnected()) {
            this.annotationSync._broadcastMeasurement(
                annotationData.type,
                annotationData
            );
        }
    }
    
    deleteAnnotation(annotationId) {
        this.annotationSync.deleteAnnotation(annotationId);
    }

    getAnnotations() {
        return this.annotationSync.getAnnotations();
    }

    isConnected() {
        return this.connectionManager.hasConnections();
    }

    async connect(roomId = null) {
        if (roomId) {
            await this.roomManager.joinRoom(roomId);
        } else {
            await this.roomManager.createRoom();
        }

        // Update ModelSync with host status
        this.modelSync.setHostStatus(this.roomManager.isHost);

        return this.roomManager.roomId;
    }

    disconnect() {
        this.roomManager.leaveRoom();
    }

    getRoomURL() {
        return this.roomManager.getRoomURL();
    }

    getRoomInfo() {
        return this.roomManager.getRoomInfo();
    }

    // ========================================================================
    // Properties for backward compatibility with existing code
    // ========================================================================

    get isHost() {
        return this.roomManager.isHost;
    }

    get connections() {
        return this.connectionManager.connections;
    }

    get peerInfo() {
        return this.profileManager.getAllPeerProfiles();
    }

    get userName() {
        return this.profileManager.getMyProfile().name;
    }

    set userName(name) {
        this.profileManager.setMyProfile(name, null);
    }

    get userColor() {
        return this.profileManager.getMyProfile().color;
    }

    // ========================================================================
    // Integration - Wire up events between modules
    // ========================================================================

    _setupIntegration() {
        // ModelSync now handles sending models to new peers automatically

        // When we receive a complete file, load it
        this.eventBus.on('file-transfer:receive:complete', (payload) => {
            this.logger.info(`CollaborationManager: Received file "${payload.fileName}", loading into scene`);
            this.eventBus.emit('model:load', {
                fileData: payload.blob,
                fileName: payload.fileName
            });
        });

        // Forward file transfer progress to UI
        this.eventBus.on('file-transfer:send:start', (payload) => {
            this.eventBus.emit('ui:p2p-progress:start', { from: 'Sending...' });
        });

        this.eventBus.on('file-transfer:send:progress', (payload) => {
            this.eventBus.emit('ui:p2p-progress:update', { progress: payload.progress });
        });

        this.eventBus.on('file-transfer:send:complete', () => {
            this.eventBus.emit('ui:p2p-progress:end');
        });

        this.eventBus.on('file-transfer:receive:start', (payload) => {
            const peerProfile = this.profileManager.getPeerProfile(payload.peerId);
            const senderName = peerProfile ? peerProfile.name : 'Peer';
            this.eventBus.emit('ui:p2p-progress:start', { from: senderName });
        });

        this.eventBus.on('file-transfer:receive:progress', (payload) => {
            this.eventBus.emit('ui:p2p-progress:update', { progress: payload.progress });
        });

        this.eventBus.on('file-transfer:receive:complete', () => {
            this.eventBus.emit('ui:p2p-progress:end');
        });

        // Forward connection events to UI
        this.eventBus.on('room:created', (payload) => {
            this.eventBus.emit('collaboration:connected', {
                roomId: payload.roomId,
                isHost: payload.isHost,
                peerId: this.connectionManager.myPeerId
            });
        });

        this.eventBus.on('room:joined', (payload) => {
            this.eventBus.emit('collaboration:connected', {
                roomId: payload.roomId,
                isHost: payload.isHost,
                peerId: this.connectionManager.myPeerId
            });
        });

        this.eventBus.on('connection:opened', (payload) => {
            this.eventBus.emit('collaboration:peer-joined', { peerId: payload.peerId });
        });

        this.eventBus.on('connection:peer-disconnected', (payload) => {
            this.eventBus.emit('collaboration:peer-left', { peerId: payload.peerId });
        });

        this.eventBus.on('peer:profile-received', (payload) => {
            this.eventBus.emit('collaboration:peer-info', {
                peerId: payload.peerId,
                info: payload.profile
            });
        });

        this.eventBus.on('connection:error', (payload) => {
            this.eventBus.emit('collaboration:connection-error', {
                error: payload.error.message || 'Connection failed'
            });
        });

        // Listen for requests to clear all annotations from the UI
        this.eventBus.on('collaboration:clear-all-annotations', () => {
            if (this.isHost) { // Or any other logic to prevent spamming
                this.annotationSync.clearAllAnnotations();
            }
        });
    }
}

export default CollaborationManager;