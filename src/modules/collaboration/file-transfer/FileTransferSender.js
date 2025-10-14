// ============================================================================
// FILE 3: src/modules/collaboration/FileTransferSender.js
// ============================================================================

/**
 * @class FileTransferSender
 * @description Handles sending files to peers in chunks with progress tracking.
 * Single Responsibility: Send files via chunked transfer.
 */
export class FileTransferSender {
    constructor(connectionManager, logger, eventBus) {
        this.connectionManager = connectionManager;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.CHUNK_SIZE = 64 * 1024; // 64KB chunks
        this.activeTransfers = new Map();
    }

    async sendFile(peerId, blob, fileName) {
        if (!blob || !fileName) {
            throw new Error('Blob and fileName are required');
        }

        if (!this.connectionManager.isConnectedToPeer(peerId)) {
            throw new Error(`Not connected to peer ${peerId}`);
        }

        this.logger.info(`FileTransferSender: Sending "${fileName}" (${(blob.size / 1024 / 1024).toFixed(2)}MB) to ${peerId}`);

        const headerSent = this.connectionManager.sendToPeer(peerId, {
            type: 'file-header',
            fileName: fileName,
            fileSize: blob.size
        });

        if (!headerSent) {
            throw new Error('Failed to send file header');
        }

        const transferState = {
            fileName,
            totalSize: blob.size,
            sentSize: 0,
            startTime: Date.now(),
            lastProgressTime: Date.now()
        };
        this.activeTransfers.set(peerId, transferState);

        this.eventBus.emit('file-transfer:send:start', {
            peerId,
            fileName,
            fileSize: blob.size
        });

        await this._sendInChunks(peerId, blob, transferState);

        this.activeTransfers.delete(peerId);

        this.logger.info(`FileTransferSender: Finished sending "${fileName}" to ${peerId}`);
        this.eventBus.emit('file-transfer:send:complete', {
            peerId,
            fileName,
            fileSize: blob.size
        });
    }

    async broadcastFile(blob, fileName) {
        const peerIds = this.connectionManager.getConnectedPeerIds();
        
        if (peerIds.length === 0) {
            this.logger.warn('FileTransferSender: No peers to broadcast to');
            return;
        }

        this.logger.info(`FileTransferSender: Broadcasting "${fileName}" to ${peerIds.length} peer(s)`);

        const sendPromises = peerIds.map(peerId => 
            this.sendFile(peerId, blob, fileName).catch(error => {
                this.logger.error(`FileTransferSender: Failed to send to ${peerId}`, error);
            })
        );

        await Promise.all(sendPromises);
    }

    async _sendInChunks(peerId, blob, transferState) {
        let offset = 0;
        const totalChunks = Math.ceil(blob.size / this.CHUNK_SIZE);
        let sentChunks = 0;

        while (offset < blob.size) {
            const chunk = blob.slice(offset, offset + this.CHUNK_SIZE);
            const arrayBuffer = await chunk.arrayBuffer();

            const sent = this.connectionManager.sendToPeer(peerId, {
                type: 'file-chunk',
                chunk: arrayBuffer
            });

            if (!sent) {
                throw new Error(`Failed to send chunk at offset ${offset}`);
            }

            offset += arrayBuffer.byteLength;
            transferState.sentSize = offset;
            sentChunks++;

            if (sentChunks % 5 === 0 || offset >= blob.size) {
                this._emitProgress(peerId, transferState);
            }

            await new Promise(resolve => setTimeout(resolve, 5));
        }
    }

    _emitProgress(peerId, transferState) {
        const progress = (transferState.sentSize / transferState.totalSize) * 100;
        const elapsed = (Date.now() - transferState.startTime) / 1000;
        const speed = transferState.sentSize / elapsed;
        const remaining = (transferState.totalSize - transferState.sentSize) / speed;

        this.eventBus.emit('file-transfer:send:progress', {
            peerId,
            fileName: transferState.fileName,
            progress: Math.round(progress),
            sentSize: transferState.sentSize,
            totalSize: transferState.totalSize,
            speed: Math.round(speed),
            eta: Math.round(remaining)
        });

        transferState.lastProgressTime = Date.now();
    }

    cancelTransfer(peerId) {
        if (this.activeTransfers.has(peerId)) {
            this.logger.info(`FileTransferSender: Cancelling transfer to ${peerId}`);
            this.activeTransfers.delete(peerId);
            this.eventBus.emit('file-transfer:send:cancelled', { peerId });
        }
    }

    getTransferState(peerId) {
        return this.activeTransfers.get(peerId) || null;
    }

    isSending(peerId) {
        return this.activeTransfers.has(peerId);
    }
}
