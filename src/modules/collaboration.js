// src/modules/collaboration.js (Coordinator File)

import { ConnectionManager } from './collaboration/ConnectionManager.js';
import { RoomManager } from './collaboration/RoomManager.js';
import { FileTransferSender } from './collaboration/file-transfer/FileTransferSender.js';
import { FileTransferReceiver } from './collaboration/file-transfer/FileTransferReceiver.js';
import { PeerProfileManager } from './collaboration/PeerProfileManager.js';
import { AnnotationSync } from './collaboration/AnnotationSync.js';
import { ModelSyncManager } from './collaboration/ModelSyncManager.js';

/**
 * @class Collaboration
 * @description
 * Pure orchestrator for all collaboration-related functionalities.
 */
export class Collaboration {
    constructor(scene, logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.scene = scene;

        // --- 1. Instantiate All Worker Modules ---
        this.connectionManager = new ConnectionManager(logger, eventBus);
        this.roomManager = new RoomManager(this.connectionManager, logger, eventBus);
        this.profileManager = new PeerProfileManager(this.connectionManager, logger, eventBus);
        this.fileSender = new FileTransferSender(this.connectionManager, logger, eventBus);
        this.fileReceiver = new FileTransferReceiver(this.connectionManager, logger, eventBus);
        this.annotationSync = new AnnotationSync(scene, this.connectionManager, logger, eventBus);
        this.modelSync = new ModelSyncManager(this.connectionManager, this.fileSender, logger, eventBus);

        // --- 2. Wire Up Inter-Module Communication ---
        this._setupModuleIntegration();

        this.logger.info('Collaboration Module: Initialized (Coordinator Pattern)');
    }

    /**
     * Sets up event-based communication between the worker modules.
     * @private
     */
    _setupModuleIntegration() {
        // --- File Transfer and Model Loading ---
        this.eventBus.on('file-transfer:receive:complete', (payload) => {
            this.logger.info(`Collaboration Coordinator: Received file "${payload.fileName}", emitting model:load event.`);
            this.eventBus.emit('model:load', {
                fileData: payload.blob,
                fileName: payload.fileName
            });
        });

        // --- UI Progress Updates ---
        this.eventBus.on('file-transfer:send:progress', (payload) => this.eventBus.emit('ui:p2p-progress:update', { progress: payload.progress }));
        this.eventBus.on('file-transfer:receive:progress', (payload) => this.eventBus.emit('ui:p2p-progress:update', { progress: payload.progress }));
        this.eventBus.on('file-transfer:send:start', () => this.eventBus.emit('ui:p2p-progress:start', { from: 'Enviando...' }));
        this.eventBus.on('file-transfer:send:complete', () => this.eventBus.emit('ui:p2p-progress:end'));
        this.eventBus.on('file-transfer:receive:start', (payload) => {
            const peerProfile = this.profileManager.getPeerProfile(payload.peerId);
            const senderName = peerProfile ? peerProfile.name : 'Peer';
            this.eventBus.emit('ui:p2p-progress:start', { from: senderName });
        });
        this.eventBus.on('file-transfer:receive:complete', () => this.eventBus.emit('ui:p2p-progress:end'));

        // --- Room and Peer Status Updates ---

        // Notify the UI when a room is created or joined.
        const onConnected = (payload) => {
            this.eventBus.emit('collaboration:connected', {
                roomId: payload.roomId,
                isHost: payload.isHost,
                peerId: this.connectionManager.myPeerId,
                roomURL: this.roomManager.getRoomURL() // <<< MODIFICATION: Ensure URL is included
            });
        };
        this.eventBus.on('room:created', onConnected);
        this.eventBus.on('room:joined', onConnected);

        // Notify the UI about peers joining, leaving, or updating their profile.
        this.eventBus.on('connection:opened', (payload) => this.eventBus.emit('collaboration:peer-joined', { peerId: payload.peerId }));
        this.eventBus.on('connection:peer-disconnected', (payload) => this.eventBus.emit('collaboration:peer-left', { peerId: payload.peerId }));
        this.eventBus.on('peer:profile-received', (payload) => this.eventBus.emit('collaboration:peer-info', { peerId: payload.peerId, info: payload.profile }));

        // --- Annotation Sync ---
        this.eventBus.on('collaboration:clear-all-annotations', () => {
            if (this.roomManager.isHost) {
                this.annotationSync.clearAllAnnotations();
            }
        });
    }

    // --- PUBLIC API ---

    async connect(roomId = null) {
        if (roomId) {
            await this.roomManager.joinRoom(roomId);
        } else {
            await this.roomManager.createRoom();
        }
        this.modelSync.setHostStatus(this.roomManager.isHost);
        return this.roomManager.roomId;
    }

    disconnect() {
        this.roomManager.leaveRoom();
    }

    setModelData(blob, fileName) {
        this.modelSync.setModelData(blob, fileName);
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

    getRoomURL() {
        return this.roomManager.getRoomURL();
    }
    
    set userName(name) {
        this.profileManager.setMyProfile(name, null);
    }
    
    // --- New methods to provide data to the UI ---
    
    /**
     * Gets the profile data for all connected peers.
     * @returns {{myProfile: Object, peerProfiles: Map<string, Object>}}
     */
    getPeerProfileData() {
        return {
            myProfile: this.profileManager.getMyProfile(),
            peerProfiles: this.profileManager.getAllPeerProfiles(),
            peerIds: this.connectionManager.getConnectedPeerIds()
        };
    }
}