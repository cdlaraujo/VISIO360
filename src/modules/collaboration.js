// src/modules/collaboration.js (New Coordinator File)

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
 * This module follows the Coordinator pattern. It instantiates and wires up all the
 * specialized "worker" modules but contains no business logic itself. Its sole
 * responsibility is to create the collaboration system.
 *
 * The actual logic is handled by the worker modules located in the `./collaboration/` directory.
 */
export class Collaboration {
    constructor(scene, logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.scene = scene;

        // --- 1. Instantiate All Worker Modules ---
        // Each module has a single, well-defined responsibility.

        this.connectionManager = new ConnectionManager(logger, eventBus);
        this.roomManager = new RoomManager(this.connectionManager, logger, eventBus);
        this.profileManager = new PeerProfileManager(this.connectionManager, logger, eventBus);
        this.fileSender = new FileTransferSender(this.connectionManager, logger, eventBus);
        this.fileReceiver = new FileTransferReceiver(this.connectionManager, logger, eventBus);
        this.annotationSync = new AnnotationSync(scene, this.connectionManager, logger, eventBus);
        this.modelSync = new ModelSyncManager(this.connectionManager, this.fileSender, logger, eventBus);

        // --- 2. Wire Up Inter-Module Communication ---
        // The coordinator defines how the worker modules interact with each other via events.
        this._setupModuleIntegration();

        this.logger.info('Collaboration Module: Initialized (Coordinator Pattern)');
    }

    /**
     * This method sets up the event-based communication between the different worker modules.
     * It ensures that the modules remain decoupled from each other.
     * @private
     */
    _setupModuleIntegration() {
        // --- File Transfer and Model Loading ---

        // When a file is fully received, emit an event for the ModelLoader to load it.
        this.eventBus.on('file-transfer:receive:complete', (payload) => {
            this.logger.info(`Collaboration Coordinator: Received file "${payload.fileName}", emitting model:load event.`);
            this.eventBus.emit('model:load', {
                fileData: payload.blob,
                fileName: payload.fileName
            });
        });

        // --- UI Progress Updates ---

        // Forward file transfer progress events to the UI.
        this.eventBus.on('file-transfer:send:progress', (payload) => this.eventBus.emit('ui:p2p-progress:update', { progress: payload.progress }));
        this.eventBus.on('file-transfer:receive:progress', (payload) => this.eventBus.emit('ui:p2p-progress:update', { progress: payload.progress }));

        // Handle start and end of transfers to show/hide UI elements.
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
                peerId: this.connectionManager.myPeerId
            });
        };
        this.eventBus.on('room:created', onConnected);
        this.eventBus.on('room:joined', onConnected);

        // Notify the UI about peers joining, leaving, or updating their profile.
        this.eventBus.on('connection:opened', (payload) => this.eventBus.emit('collaboration:peer-joined', { peerId: payload.peerId }));
        this.eventBus.on('connection:peer-disconnected', (payload) => this.eventBus.emit('collaboration:peer-left', { peerId: payload.peerId }));
        this.eventBus.on('peer:profile-received', (payload) => this.eventBus.emit('collaboration:peer-info', { peerId: payload.peerId, info: payload.profile }));

        // --- Annotation Sync ---
        // When the UI requests to clear all annotations, if the user is the host,
        // the AnnotationSync module will handle broadcasting the clear command.
        this.eventBus.on('collaboration:clear-all-annotations', () => {
            if (this.roomManager.isHost) {
                this.annotationSync.clearAllAnnotations();
            }
        });
    }

    // --- PUBLIC API ---
    // The coordinator exposes a simplified, high-level API to the rest of the application.
    // It delegates these calls to the appropriate worker module.

    /**
     * Creates a new collaboration room or joins an existing one.
     * @param {string|null} roomId - The ID of the room to join. If null, a new room is created.
     * @returns {Promise<string>} The ID of the room.
     */
    async connect(roomId = null) {
        if (roomId) {
            await this.roomManager.joinRoom(roomId);
        } else {
            await this.roomManager.createRoom();
        }
        // Inform the model sync manager of the user's host status.
        this.modelSync.setHostStatus(this.roomManager.isHost);
        return this.roomManager.roomId;
    }

    /**
     * Disconnects from the current collaboration room.
     */
    disconnect() {
        this.roomManager.leaveRoom();
    }

    /**
     * Sets the 3D model data to be shared with other peers.
     * @param {Blob} blob - The model file as a Blob.
     * @param {string} fileName - The name of the model file.
     */
    setModelData(blob, fileName) {
        this.modelSync.setModelData(blob, fileName);
    }
    
    /**
     * Deletes a specific annotation and syncs the deletion with other peers.
     * @param {string} annotationId - The ID of the annotation to delete.
     */
    deleteAnnotation(annotationId) {
        this.annotationSync.deleteAnnotation(annotationId);
    }

    /**
     * Gets all synchronized annotations.
     * @returns {Array<Object>} A list of all annotation data objects.
     */
    getAnnotations() {
        return this.annotationSync.getAnnotations();
    }

    /**
     * Checks if the user is currently connected to any peers.
     * @returns {boolean}
     */
    isConnected() {
        return this.connectionManager.hasConnections();
    }

    /**
     * Gets the shareable URL for the current collaboration room.
     * @returns {string|null}
     */
    getRoomURL() {
        return this.roomManager.getRoomURL();
    }
    
    /**
     * Sets the user's display name.
     * @param {string} name - The desired display name.
     */
    set userName(name) {
        this.profileManager.setMyProfile(name, null);
    }
}