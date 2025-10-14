// ============================================================================
// FILE 7: src/modules/CollaborationManager.js (REFACTORED ORCHESTRATOR)
// ============================================================================

import { ConnectionManager } from './collaboration/ConnectionManager.js';
import { RoomManager } from './collaboration/RoomManager.js';
import { FileTransferSender } from './collaboration/FileTransferSender.js';
import { FileTransferReceiver } from './collaboration/FileTransferReceiver.js';
import { PeerProfileManager } from './collaboration/PeerProfileManager.js';
import { AnnotationSync } from './collaboration/AnnotationSync.js';

/**
 * @class CollaborationManager
 * @description Orchestrates all collaboration features by coordinating focused sub-modules.
 * This is now a COORDINATOR, not a god object - it delegates to specialized modules.
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

        // Store model data for sharing with new peers
        this.currentModelBlob = null;
        this.currentModelFileName = null;

        this._setupIntegration();

        this.logger.info('CollaborationManager: Initialized (refactored architecture)');
    }

    _setupIntegration() {
        // When a new peer connects, send them the current model if we have one
        this.eventBus.on('connection:opened', (payload) => {
            if (this.currentModelBlob && this.roomManager.isHost) {
                this.logger.info(`CollaborationManager: Sending model to newly connected peer ${payload.peerId}`);
                setTimeout(() => {
                    this.fileSender.sendFile(
                        payload.peerId, 
                        this.currentModelBlob, 
                        this.currentModelFileName
                    ).catch(error => {
                        this.logger.error(`Failed to send model to ${payload.peerId}`, error);
                    });
                }, 100);
            }
        });

        // When we receive a complete file, load it
        this.eventBus.on('file-transfer:receive:complete', (payload) => {
            this.logger.info(`CollaborationManager: Received file "${payload.fileName}", loading into scene`);
            this.eventBus.emit('model:load', {
                fileData: payload.blob,
                fileName: payload.fileName
            });
        });

        // Forward UI events for file transfer progress
        this.eventBus.on('file-transfer:send:start', (payload) => {
            this.eventBus.emit('ui:p2p-progress:start', { 
                from: 'Sending...' 
            });
        });

        this.eventBus.on('file-transfer:send:progress', (payload) => {
            this.eventBus.emit('ui:p2p-progress:update', { 
                progress: payload.progress 
            });
        });

        this.eventBus.on('file-transfer:send:complete', () => {
            this.eventBus.emit('ui:p2p-progress:end');
        });

        this.eventBus.on('file-transfer:receive:start', (payload) => {
            const peerProfile = this.profileManager.getPeerProfile(payload.peerId);
            const senderName = peerProfile ? peerProfile.name : 'Peer';
            this.eventBus.emit('ui:p2p-progress:start', { 
                from: senderName 
            });
        });

        this.eventBus.on('file-transfer:receive:progress', (payload) => {
            this.eventBus.emit('ui:p2p-progress:update', { 
                progress: payload.progress 
            });
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
    }
}

export default CollaborationManager;