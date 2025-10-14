// ============================================================================
// FILE 2: src/modules/collaboration/RoomManager.js
// ============================================================================

/**
 * @class RoomManager
 * @description Manages room creation, joining, and room-related state.
 * Single Responsibility: Handle room lifecycle and URL management.
 */
export class RoomManager {
    constructor(connectionManager, logger, eventBus) {
        this.connectionManager = connectionManager;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.roomId = null;
        this.isHost = false;
        
        this._checkURLForRoom();
    }

    _checkURLForRoom() {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const roomId = params.get('room');
        if (roomId) {
            this._urlRoomId = roomId;
            this.logger.info(`RoomManager: Found room ID in URL: ${roomId}`);
        }
    }

    async createRoom() {
        this.logger.info('RoomManager: Creating new room as host');
        
        if (!this.connectionManager.isInitialized) {
            await this.connectionManager.initialize();
        }

        this.roomId = this.connectionManager.myPeerId;
        this.isHost = true;

        this._updateURL();

        this.logger.info(`RoomManager: Room created with ID: ${this.roomId}`);
        this.eventBus.emit('room:created', { 
            roomId: this.roomId, 
            isHost: true 
        });

        return this.roomId;
    }

    async joinRoom(roomId) {
        if (!roomId) {
            throw new Error('Room ID is required');
        }

        this.logger.info(`RoomManager: Joining room: ${roomId}`);
        
        roomId = this._extractRoomIdFromURL(roomId);

        if (!this.connectionManager.isInitialized) {
            await this.connectionManager.initialize();
        }

        this.roomId = roomId;
        this.isHost = false;

        try {
            await this.connectionManager.connectToPeer(roomId);
            this.logger.info(`RoomManager: Successfully joined room ${roomId}`);
            this.eventBus.emit('room:joined', { 
                roomId: this.roomId, 
                isHost: false 
            });
        } catch (error) {
            this.logger.error('RoomManager: Failed to join room', error);
            this.eventBus.emit('room:join-failed', { roomId, error });
            throw error;
        }
    }

    _extractRoomIdFromURL(input) {
        if (input.includes('#room=')) {
            const match = input.match(/#room=([^&]+)/);
            if (match) {
                this.logger.info(`RoomManager: Extracted room ID from URL: ${match[1]}`);
                return match[1];
            }
        }
        return input;
    }

    _updateURL() {
        if (this.roomId) {
            window.location.hash = `room=${this.roomId}`;
        }
    }

    getRoomURL() {
        if (!this.roomId) return null;
        return `${window.location.origin}${window.location.pathname}#room=${this.roomId}`;
    }

    leaveRoom() {
        if (!this.roomId) return;

        this.logger.info(`RoomManager: Leaving room ${this.roomId}`);
        
        if (!this.isHost && this.roomId) {
            this.connectionManager.disconnectFromPeer(this.roomId);
        }
        
        if (this.isHost) {
            this.connectionManager.getConnectedPeerIds().forEach(peerId => {
                this.connectionManager.disconnectFromPeer(peerId);
            });
        }

        this.eventBus.emit('room:left', { roomId: this.roomId });
        
        this.roomId = null;
        this.isHost = false;
        window.location.hash = '';
    }

    getRoomInfo() {
        if (!this.roomId) return null;
        
        return {
            roomId: this.roomId,
            isHost: this.isHost,
            peerCount: this.isHost 
                ? this.connectionManager.getConnectedPeerIds().length + 1 
                : 2,
            connectedPeers: this.connectionManager.getConnectedPeerIds()
        };
    }

    isInRoom() {
        return this.roomId !== null;
    }

    getURLRoomId() {
        return this._urlRoomId || null;
    }
}