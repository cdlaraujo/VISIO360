// src/modules/CollaborationManager.js
import * as THREE from 'three';

/**
 * @class CollaborationManager
 * @description Manages peer-to-peer collaboration using WebRTC (via PeerJS).
 */
export class CollaborationManager {
    constructor(scene, logger, eventBus, config = {}) {
        this.scene = scene;
        this.logger = logger;
        this.eventBus = eventBus;

        // Configuration
        this.config = {
            usePeerJSCloud: config.usePeerJSCloud !== false,
            signalingServer: config.signalingServer || null,
            autoJoinRoom: config.autoJoinRoom !== false,
            ...config
        };

        // PeerJS Connection State
        this.peer = null;
        this.myPeerId = null;
        this.roomId = null;
        this.isHost = false;
        this.connections = new Map(); // Stores peerId -> DataConnection
        this.peerInfo = new Map();    // Stores peerId -> {name, color}

        // Application State
        this.currentModelURL = null; // The URL of the currently loaded model
        this.userName = `User_${Math.random().toString(36).substr(2, 4)}`;
        this.userColor = this._generateRandomColor();

        // Scene Group for Remote Objects
        this.remoteAnnotationGroup = new THREE.Group();
        this.remoteAnnotationGroup.name = 'remote-annotations';
        this.scene.add(this.remoteAnnotationGroup);

        if (this.config.autoJoinRoom) {
            this._checkURLForRoom();
        }
    }

    /**
     * Checks if the window's URL hash contains room information to auto-join.
     * @private
     */
    _checkURLForRoom() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const roomId = params.get('room');
        if (roomId) {
            this.logger.info(`CollaborationManager: Room ID "${roomId}" found in URL. Will attempt to auto-join.`);
            this._urlRoomId = roomId;
        }
    }

    /**
     * Connects to the PeerJS server and either creates a new room or joins an existing one.
     * @param {string|null} roomId - The ID of the room to join. If null, a new room is created.
     */
    async connect(roomId = null) {
        this.logger.info('CollaborationManager: Initializing P2P connection...');
        if (this.peer) {
            this.logger.warn('CollaborationManager: A connection already exists.');
            return;
        }

        try {
            this.peer = new Peer(this._getPeerConfig()); // Initialize PeerJS

            // Wait for the connection to the PeerJS server to open
            await new Promise((resolve, reject) => {
                this.peer.on('open', id => {
                    this.myPeerId = id;
                    this.logger.info(`CollaborationManager: PeerJS connection open. My ID is ${id}`);
                    resolve(id);
                });
                this.peer.on('error', err => reject(err));
                setTimeout(() => reject(new Error('PeerJS connection timed out')), 10000);
            });

            this._setupPeerEventHandlers();

            // Decide whether to create or join a room
            const targetRoomId = roomId || this._urlRoomId;
            if (targetRoomId) {
                await this._joinRoom(targetRoomId);
            } else {
                this._createRoom();
            }

            this.eventBus.emit('collaboration:connected', {
                peerId: this.myPeerId,
                roomId: this.roomId,
                isHost: this.isHost
            });

        } catch (error) {
            this.logger.error('CollaborationManager: Failed to establish P2P connection.', error);
            this.eventBus.emit('collaboration:error', { error });
            if (this.peer) this.peer.destroy();
            this.peer = null;
        }
    }

    /**
     * Creates a new collaboration room and sets the current user as the host.
     * @private
     */
    _createRoom() {
        this.roomId = this._generateRoomId();
        this.isHost = true;
        this.logger.info(`CollaborationManager: New room created with ID: ${this.roomId}`);
        // Update the URL so it can be shared
        window.location.hash = `room=${this.roomId}`;
    }

    /**
     * Joins an existing collaboration room by connecting to all known peers.
     * @param {string} roomId - The ID of the room to join.
     * @private
     */
    async _joinRoom(roomId) {
        this.roomId = roomId;
        this.isHost = false;
        this.logger.info(`CollaborationManager: Attempting to join room: ${roomId}`);
        // In a more robust system, you'd use a server to get the list of peers.
        // For pure P2P, we assume the host's ID might be in the URL or known.
        // For now, we rely on new connections being announced by peers.
    }

    /**
     * Sets up the main event handlers for the PeerJS connection.
     * @private
     */
    _setupPeerEventHandlers() {
        // Handle incoming data connections from other peers
        this.peer.on('connection', (conn) => {
            this.logger.info(`CollaborationManager: Incoming connection from ${conn.peer}`);
            this._handleNewConnection(conn);
        });
        // Handle disconnection from the signaling server
        this.peer.on('disconnected', () => {
            this.logger.warn('CollaborationManager: Disconnected from the signaling server. Reconnecting...');
            this.peer.reconnect();
        });
    }

    /**
     * Manages a newly established connection to another peer.
     * @param {object} conn - The PeerJS DataConnection object.
     * @private
     */
    _handleNewConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.eventBus.emit('collaboration:peer-joined', { peerId: conn.peer });

            // Send an introduction message to the new peer
            this._sendToPeer(conn.peer, {
                type: 'intro',
                name: this.userName,
                color: this.userColor
            });

            // If we have a model loaded, tell the new peer about it
            if (this.currentModelURL) {
                this._sendToPeer(conn.peer, {
                    type: 'set-model',
                    url: this.currentModelURL
                });
            }
        });

        // Handle incoming data from the peer
        conn.on('data', (data) => this._handleMessage(conn.peer, data));

        // Handle the peer disconnecting
        conn.on('close', () => {
            this.logger.info(`CollaborationManager: Connection closed with ${conn.peer}`);
            this.connections.delete(conn.peer);
            this.peerInfo.delete(conn.peer);
            this.eventBus.emit('collaboration:peer-left', { peerId: conn.peer });
        });
    }

    /**
     * Routes incoming messages from peers to the appropriate handler.
     * @param {string} peerId - The ID of the peer who sent the message.
     * @param {object} data - The message data.
     * @private
     */
    _handleMessage(peerId, data) {
        switch (data.type) {
            case 'intro':
                this.peerInfo.set(peerId, { name: data.name, color: data.color });
                this.eventBus.emit('collaboration:peer-info', { peerId, info: { name: data.name, color: data.color } });
                break;
            case 'set-model':
                if (data.url && this.currentModelURL !== data.url) {
                    this.logger.info(`CollaborationManager: Received model URL from peer: ${data.url}`);
                    this.currentModelURL = data.url;
                    this.eventBus.emit('model:load', { url: data.url, fileName: data.url.split('/').pop() });
                }
                break;
            case 'annotation-create':
                this._handleRemoteAnnotation(data.annotation);
                break;
        }
    }

    /**
     * Creates a visual representation of an annotation received from another peer.
     * @param {object} annotation - The annotation data.
     * @private
     */
    _handleRemoteAnnotation(annotation) {
        let visual = null;
        if (annotation.type === 'measurement') {
            visual = this._createMeasurementVisual(annotation);
        }
        // Add other annotation types here...

        if (visual) {
            visual.userData.annotationId = annotation.id;
            this.remoteAnnotationGroup.add(visual);
        }
    }

    /**
     * Creates a 3D line and a text label for a remote distance measurement.
     * @param {object} annotation - The measurement annotation data.
     * @returns {THREE.Group} A group containing the line and label.
     * @private
     */
    _createMeasurementVisual(annotation) {
        const group = new THREE.Group();
        const points = annotation.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        
        // Create the line
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2, depthTest: false });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 998;
        group.add(line);
        
        // Create the text label
        const midPoint = new THREE.Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5);
        const label = this._createTextSprite(`${annotation.distance.toFixed(2)}m`, '#00ffff');
        label.position.copy(midPoint);
        group.add(label);

        return group;
    }

    /**
     * Creates a text sprite for displaying information in the 3D scene.
     * @param {string} text - The text to display.
     * @param {string} color - The color of the text.
     * @returns {THREE.Sprite} The created text sprite.
     * @private
     */
    _createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        context.font = 'Bold 24px Arial';
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.5, 0.125, 1);
        sprite.renderOrder = 999;
        return sprite;
    }

    /**
     * Creates and broadcasts an annotation to all connected peers.
     * @param {object} annotationData - The data for the annotation to be created.
     */
    createAnnotation(annotationData) {
        const annotation = {
            id: `ann_${this.myPeerId}_${Date.now()}`,
            ...annotationData
        };
        this._broadcast({
            type: 'annotation-create',
            annotation: annotation
        });
    }

    /**
     * Sends data to all connected peers.
     * @param {object} data - The data to broadcast.
     * @private
     */
    _broadcast(data) {
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    /**
     * Sends data to a specific peer.
     * @param {string} peerId - The ID of the peer to send data to.
     * @param {object} data - The data to send.
     * @private
     */
    _sendToPeer(peerId, data) {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            conn.send(data);
        }
    }
    
    // Helper methods
    isConnected() { return this.peer && !this.peer.disconnected; }
    getRoomURL() { return this.roomId ? `${window.location.origin}${window.location.pathname}#room=${this.roomId}` : null; }
    _generateRoomId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
    _generateRandomColor() { const letters = '0123456789ABCDEF'; let color = '#'; for (let i = 0; i < 6; i++) { color += letters[Math.floor(Math.random() * 16)]; } return color; }
    _getPeerConfig() { return { debug: 0 }; /* Use public PeerJS server */ }
}