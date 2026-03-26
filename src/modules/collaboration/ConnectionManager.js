// ============================================================================
// FILE 1: src/modules/collaboration/ConnectionManager.js
// ============================================================================

/**
 * @class ConnectionManager
 * @description Manages the PeerJS connection lifecycle and peer-to-peer connections.
 * Single Responsibility: Handle PeerJS initialization and connection establishment.
 */
export class ConnectionManager {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.peer = null;
        this.myPeerId = null;
        this.connections = new Map(); // peerId -> DataConnection
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            this.logger.warn('ConnectionManager: Already initialized');
            return this.myPeerId;
        }

        this.logger.info('ConnectionManager: Initializing PeerJS...');

        this.peer = new Peer({
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                this.myPeerId = id;
                this.isInitialized = true;
                this.logger.info(`ConnectionManager: Connected with ID: ${id}`);
                this._setupPeerEventHandlers();
                this.eventBus.emit('connection:initialized', { peerId: id });
                resolve(id);
            });

            this.peer.on('error', (error) => {
                this.logger.error('ConnectionManager: PeerJS error', error);
                this.eventBus.emit('connection:error', { error });
                reject(error);
            });

            this.peer.on('disconnected', () => {
                this.logger.warn('ConnectionManager: Disconnected from PeerJS server');
                this.eventBus.emit('connection:disconnected');
            });

            this.peer.on('close', () => {
                this.logger.info('ConnectionManager: PeerJS connection closed');
                this.isInitialized = false;
                this.eventBus.emit('connection:closed');
            });
        });
    }

    connectToPeer(remotePeerId) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized) {
                reject(new Error('ConnectionManager not initialized'));
                return;
            }

            this.logger.info(`ConnectionManager: Connecting to peer ${remotePeerId}`);

            const conn = this.peer.connect(remotePeerId, {
                reliable: true,
                serialization: 'binary'
            });

            this._setupConnectionHandlers(conn, resolve, reject);
        });
    }

    _setupPeerEventHandlers() {
        this.peer.on('connection', (conn) => {
            this.logger.info(`ConnectionManager: Incoming connection from ${conn.peer}`);
            this.eventBus.emit('connection:incoming', { peerId: conn.peer });
            
            this._setupConnectionHandlers(conn, 
                () => this.eventBus.emit('connection:established', { peerId: conn.peer, connection: conn }),
                (error) => this.logger.error(`ConnectionManager: Error with incoming connection from ${conn.peer}`, error)
            );
        });
    }

    _setupConnectionHandlers(conn, onSuccess, onError) {
        conn.on('open', () => {
            this.logger.info(`ConnectionManager: Connection opened with ${conn.peer}`);
            this.connections.set(conn.peer, conn);
            this.eventBus.emit('connection:opened', { peerId: conn.peer, connection: conn });
            if (onSuccess) onSuccess(conn);
        });

        conn.on('data', (data) => {
            this.eventBus.emit('connection:data', { peerId: conn.peer, data });
        });

        conn.on('close', () => {
            this.logger.info(`ConnectionManager: Connection closed with ${conn.peer}`);
            this.connections.delete(conn.peer);
            this.eventBus.emit('connection:peer-disconnected', { peerId: conn.peer });
        });

        conn.on('error', (error) => {
            this.logger.error(`ConnectionManager: Connection error with ${conn.peer}`, error);
            this.eventBus.emit('connection:peer-error', { peerId: conn.peer, error });
            if (onError) onError(error);
        });
    }

    sendToPeer(peerId, data) {
        const conn = this.connections.get(peerId);
        if (!conn || !conn.open) {
            this.logger.warn(`ConnectionManager: Cannot send to ${peerId} - connection not available`);
            return false;
        }

        try {
            conn.send(data);
            return true;
        } catch (error) {
            this.logger.error(`ConnectionManager: Error sending to ${peerId}`, error);
            return false;
        }
    }

    broadcast(data) {
        let successCount = 0;
        this.connections.forEach((conn, peerId) => {
            if (this.sendToPeer(peerId, data)) {
                successCount++;
            }
        });
        return successCount;
    }

    getConnectedPeerIds() {
        return Array.from(this.connections.keys());
    }

    isConnectedToPeer(peerId) {
        const conn = this.connections.get(peerId);
        return conn && conn.open;
    }

    hasConnections() {
        return this.connections.size > 0;
    }

    disconnectFromPeer(peerId) {
        const conn = this.connections.get(peerId);
        if (conn) {
            conn.close();
            this.connections.delete(peerId);
            this.logger.info(`ConnectionManager: Disconnected from ${peerId}`);
        }
    }

    destroy() {
        this.logger.info('ConnectionManager: Destroying all connections');
        
        this.connections.forEach((conn) => conn.close());
        this.connections.clear();
        
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.isInitialized = false;
        this.myPeerId = null;
    }
}