// ============================================================================
// FILE 4: src/modules/collaboration/FileTransferReceiver.js
// ============================================================================

/**
 * @class FileTransferReceiver
 * @description Handles receiving files from peers in chunks with progress tracking.
 * Single Responsibility: Receive and reconstruct files from chunked transfer.
 */
export class FileTransferReceiver {
    constructor(connectionManager, logger, eventBus) {
        this.connectionManager = connectionManager;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.activeReceives = new Map();
        
        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('connection:data', (payload) => {
            const { peerId, data } = payload;
            
            if (data.type === 'file-header') {
                this._handleFileHeader(peerId, data);
            } else if (data.type === 'file-chunk') {
                this._handleFileChunk(peerId, data);
            }
        });
    }

    _handleFileHeader(peerId, data) {
        this.logger.info(`FileTransferReceiver: Receiving "${data.fileName}" (${(data.fileSize / 1024 / 1024).toFixed(2)}MB) from ${peerId}`);

        const receiveState = {
            fileName: data.fileName,
            fileSize: data.fileSize,
            chunks: [],
            receivedSize: 0,
            startTime: Date.now(),
            lastProgressTime: Date.now()
        };

        this.activeReceives.set(peerId, receiveState);

        this.eventBus.emit('file-transfer:receive:start', {
            peerId,
            fileName: data.fileName,
            fileSize: data.fileSize
        });
    }

    _handleFileChunk(peerId, data) {
        const receiveState = this.activeReceives.get(peerId);
        
        if (!receiveState) {
            this.logger.warn(`FileTransferReceiver: Received chunk from ${peerId} but no active receive`);
            return;
        }

        receiveState.chunks.push(data.chunk);
        receiveState.receivedSize += data.chunk.byteLength;
        
        this._emitProgress(peerId, receiveState);

        if (receiveState.receivedSize >= receiveState.fileSize) {
            this._completeReceive(peerId, receiveState);
        }
    }

    _completeReceive(peerId, receiveState) {
        this.logger.info(`FileTransferReceiver: Completed receiving "${receiveState.fileName}" from ${peerId}`);

        const completeBlob = new Blob(receiveState.chunks);

        this.activeReceives.delete(peerId);

        this.eventBus.emit('file-transfer:receive:complete', {
            peerId,
            fileName: receiveState.fileName,
            fileSize: receiveState.fileSize,
            blob: completeBlob
        });
    }

    _emitProgress(peerId, receiveState) {
        const progress = (receiveState.receivedSize / receiveState.fileSize) * 100;
        const elapsed = (Date.now() - receiveState.startTime) / 1000;
        const speed = receiveState.receivedSize / elapsed;
        const remaining = (receiveState.fileSize - receiveState.receivedSize) / speed;

        const now = Date.now();
        if (now - receiveState.lastProgressTime < 100 && receiveState.receivedSize < receiveState.fileSize) {
            return;
        }

        this.eventBus.emit('file-transfer:receive:progress', {
            peerId,
            fileName: receiveState.fileName,
            progress: Math.round(progress),
            receivedSize: receiveState.receivedSize,
            totalSize: receiveState.fileSize,
            speed: Math.round(speed),
            eta: Math.round(remaining)
        });

        receiveState.lastProgressTime = now;
    }

    cancelReceive(peerId) {
        if (this.activeReceives.has(peerId)) {
            const state = this.activeReceives.get(peerId);
            this.logger.info(`FileTransferReceiver: Cancelling receive of "${state.fileName}" from ${peerId}`);
            this.activeReceives.delete(peerId);
            this.eventBus.emit('file-transfer:receive:cancelled', { 
                peerId, 
                fileName: state.fileName 
            });
        }
    }

    getReceiveState(peerId) {
        return this.activeReceives.get(peerId) || null;
    }

    isReceiving(peerId) {
        return this.activeReceives.has(peerId);
    }

    getAllActiveReceives() {
        const receives = [];
        this.activeReceives.forEach((state, peerId) => {
            receives.push({
                peerId,
                fileName: state.fileName,
                progress: (state.receivedSize / state.fileSize) * 100,
                receivedSize: state.receivedSize,
                totalSize: state.fileSize
            });
        });
        return receives;
    }
}