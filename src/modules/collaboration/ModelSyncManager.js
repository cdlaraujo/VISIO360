// ============================================================================
// FILE: src/modules/collaboration/ModelSyncManager.js
// ============================================================================

/**
 * @class ModelSyncManager
 * @description Handles model data storage and synchronization with peers.
 * Single Responsibility: Manage model data for P2P sharing.
 */
export class ModelSyncManager {
    constructor(connectionManager, fileSender, logger, eventBus) {
        this.connectionManager = connectionManager;
        this.fileSender = fileSender;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.currentModelBlob = null;
        this.currentModelFileName = null;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // When a new peer connects, send them the current model if we're host
        this.eventBus.on('connection:opened', (payload) => {
            if (this.currentModelBlob && this._isHost()) {
                this._sendModelToPeer(payload.peerId);
            }
        });
    }

    /**
     * Store model data for sharing with peers
     * @param {Blob} blob - The model file as a Blob
     * @param {string} fileName - The name of the model file
     */
    setModelData(blob, fileName) {
        if (!blob || !fileName) {
            this.logger.warn('ModelSyncManager: Invalid model data provided');
            return;
        }

        this.currentModelBlob = blob;
        this.currentModelFileName = fileName;
        this.logger.info(`ModelSyncManager: Model data stored - "${fileName}" (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    /**
     * Send the current model to a specific peer
     * @param {string} peerId - The peer ID to send to
     */
    async _sendModelToPeer(peerId) {
        if (!this.currentModelBlob) {
            this.logger.warn(`ModelSyncManager: No model to send to ${peerId}`);
            return;
        }

        this.logger.info(`ModelSyncManager: Sending model to newly connected peer ${peerId}`);
        
        // Small delay to ensure connection is fully established
        setTimeout(async () => {
            try {
                await this.fileSender.sendFile(
                    peerId, 
                    this.currentModelBlob, 
                    this.currentModelFileName
                );
            } catch (error) {
                this.logger.error(`ModelSyncManager: Failed to send model to ${peerId}`, error);
            }
        }, 100);
    }

    /**
     * Broadcast current model to all connected peers
     */
    async broadcastModel() {
        if (!this.currentModelBlob) {
            this.logger.warn('ModelSyncManager: No model to broadcast');
            return;
        }

        try {
            await this.fileSender.broadcastFile(this.currentModelBlob, this.currentModelFileName);
            this.logger.info('ModelSyncManager: Model broadcasted to all peers');
        } catch (error) {
            this.logger.error('ModelSyncManager: Failed to broadcast model', error);
        }
    }

    /**
     * Check if we're the host (helper method)
     */
    _isHost() {
        // This will be injected via the constructor or accessed from RoomManager
        return this.eventBus && this._hostStatus;
    }

    /**
     * Set host status (called by coordinator)
     */
    setHostStatus(isHost) {
        this._hostStatus = isHost;
    }

    /**
     * Get current model info
     */
    getModelInfo() {
        if (!this.currentModelBlob) {
            return null;
        }

        return {
            fileName: this.currentModelFileName,
            fileSize: this.currentModelBlob.size,
            fileSizeMB: (this.currentModelBlob.size / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Clear stored model data
     */
    clearModelData() {
        this.currentModelBlob = null;
        this.currentModelFileName = null;
        this.logger.info('ModelSyncManager: Model data cleared');
    }
}