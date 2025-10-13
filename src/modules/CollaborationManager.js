// src/modules/CollaborationManager.js
import * as THREE from 'three';

/**
 * @class CollaborationManager
 * @description Manages peer-to-peer collaboration using WebRTC via PeerJS
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
            maxPeers: config.maxPeers || 10,
            ...config
        };

        // Peer connection
        this.peer = null;
        this.myPeerId = null;
        this.roomId = null;
        
        // Connected peers
        this.connections = new Map(); // peerId -> DataConnection
        this.peerInfo = new Map();    // peerId -> {name, color}
        
        // Room management
        this.isHost = false;
        this.hostPeerId = null;
        
        // State
        this.localAnnotations = new Map();
        this.userName = config.userName || `User_${Math.random().toString(36).substr(2, 6)}`;
        this.userColor = config.userColor || this._generateColor();
        
        // Visual elements
        this.annotationGroup = new THREE.Group();
        this.annotationGroup.name = 'p2p-annotations';
        this.scene.add(this.annotationGroup);

        // Check if joining from URL
        if (this.config.autoJoinRoom) {
            this._checkURLForRoom();
        }
    }

    /**
     * Check URL for room parameter
     */
    _checkURLForRoom() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const roomId = params.get('room');
        const hostPeerId = params.get('host');
        
        if (roomId) {
            this.logger.info(`CollaborationManager: Room detected in URL: ${roomId}`);
            // Store for later connection
            this._urlRoomId = roomId;
            this._urlHostPeerId = hostPeerId;
        }
    }

    /**
     * Initialize peer connection and join/create room
     */
    async connect(roomId = null) {
        this.logger.info('CollaborationManager: Initializing P2P connection...');

        try {
            // Initialize PeerJS
            const peerConfig = this._getPeerConfig();
            this.peer = new Peer(peerConfig);

            // Wait for peer to be ready
            await new Promise((resolve, reject) => {
                this.peer.on('open', (id) => {
                    this.myPeerId = id;
                    this.logger.info(`CollaborationManager: Peer ID: ${id}`);
                    resolve();
                });

                this.peer.on('error', (error) => {
                    this.logger.error('CollaborationManager: Peer error', error);
                    reject(error);
                });

                setTimeout(() => reject(new Error('Connection timeout')), 10000);
            });

            // Setup peer event handlers
            this._setupPeerHandlers();

            // Join or create room
            if (roomId || this._urlRoomId) {
                await this._joinRoom(roomId || this._urlRoomId);
            } else {
                this._createRoom();
            }

            this.eventBus.emit('collaboration:connected', {
                peerId: this.myPeerId,
                roomId: this.roomId,
                isHost: this.isHost
            });

            this.logger.info(`CollaborationManager: Connected to room ${this.roomId}`);

        } catch (error) {
            this.logger.error('CollaborationManager: Connection failed', error);
            this.eventBus.emit('collaboration:error', { error });
            throw error;
        }
    }

    /**
     * Get PeerJS configuration
     */
    _getPeerConfig() {
        if (this.config.usePeerJSCloud) {
            // Use free PeerJS cloud server
            return {
                debug: 0 // Set to 2 for verbose logging
            };
        } else if (this.config.signalingServer) {
            // Use custom signaling server
            const url = new URL(this.config.signalingServer);
            return {
                host: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 9000),
                path: url.pathname || '/peerjs',
                secure: url.protocol === 'https:',
                debug: 0
            };
        } else {
            return { debug: 0 };
        }
    }

    /**
     * Create a new room
     */
    _createRoom() {
        this.roomId = this._generateRoomId();
        this.isHost = true;
        this.hostPeerId = this.myPeerId;
        
        // Update URL with room info
        window.location.hash = `room=${this.roomId}&host=${this.myPeerId}`;
        
        this.logger.info(`CollaborationManager: Created room ${this.roomId}`);
        this.eventBus.emit('collaboration:room-created', { roomId: this.roomId });
    }

    /**
     * Join existing room
     */
    async _joinRoom(roomId) {
        this.roomId = roomId;
        this.isHost = false;
        
        // Get host from URL
        this.hostPeerId = this._urlHostPeerId;
        
        if (this.hostPeerId) {
            // Connect to host
            await this._connectToPeer(this.hostPeerId);
        } else {
            this.logger.warn('CollaborationManager: No host specified');
        }
        
        this.logger.info(`CollaborationManager: Joined room ${this.roomId}`);
    }

    /**
     * Setup peer connection event handlers
     */
    _setupPeerHandlers() {
        // Incoming connection
        this.peer.on('connection', (conn) => {
            this.logger.info(`CollaborationManager: Incoming connection from ${conn.peer}`);
            this._handleConnection(conn);
        });

        // Disconnected
        this.peer.on('disconnected', () => {
            this.logger.warn('CollaborationManager: Disconnected from signaling server');
            this.eventBus.emit('collaboration:disconnected');
        });

        // Error
        this.peer.on('error', (error) => {
            this.logger.error('CollaborationManager: Peer error', error);
            this.eventBus.emit('collaboration:error', { error });
        });
    }

    /**
     * Connect to another peer
     */
    async _connectToPeer(peerId) {
        if (this.connections.has(peerId)) {
            this.logger.debug(`Already connected to ${peerId}`);
            return;
        }

        try {
            const conn = this.peer.connect(peerId, {
                reliable: true,
                serialization: 'json'
            });

            await new Promise((resolve, reject) => {
                conn.on('open', () => {
                    this._handleConnection(conn);
                    resolve();
                });

                conn.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 10000);
            });

            this.logger.info(`CollaborationManager: Connected to peer ${peerId}`);

        } catch (error) {
            this.logger.error(`Failed to connect to peer ${peerId}`, error);
        }
    }

    /**
     * Handle new peer connection
     */
    _handleConnection(conn) {
        const peerId = conn.peer;

        conn.on('open', () => {
            this.connections.set(peerId, conn);
            
            // Send introduction
            this._sendToPeer(peerId, {
                type: 'intro',
                name: this.userName,
                color: this.userColor,
                peerId: this.myPeerId,
                roomId: this.roomId
            });

            // If host, share peer list
            if (this.isHost) {
                this._sendToPeer(peerId, {
                    type: 'peer-list',
                    peers: Array.from(this.connections.keys()).filter(id => id !== peerId),
                    hostPeerId: this.hostPeerId
                });
            }

            // Request current state
            this._sendToPeer(peerId, {
                type: 'request-state'
            });

            this.eventBus.emit('collaboration:peer-joined', { peerId });
        });

        conn.on('data', (data) => {
            this._handleMessage(peerId, data);
        });

        conn.on('close', () => {
            this.connections.delete(peerId);
            this.peerInfo.delete(peerId);
            this.logger.info(`Peer ${peerId} disconnected`);
            this.eventBus.emit('collaboration:peer-left', { peerId });
        });

        conn.on('error', (error) => {
            this.logger.error(`Connection error with peer ${peerId}`, error);
        });
    }

    /**
     * Handle incoming message from peer
     */
    _handleMessage(peerId, data) {
        switch (data.type) {
            case 'intro':
                this.peerInfo.set(peerId, {
                    name: data.name,
                    color: data.color,
                    peerId: data.peerId
                });
                this.eventBus.emit('collaboration:peer-info', { peerId, info: data });
                break;

            case 'peer-list':
                // Connect to other peers
                data.peers.forEach(otherPeerId => {
                    if (otherPeerId !== this.myPeerId && !this.connections.has(otherPeerId)) {
                        this._connectToPeer(otherPeerId);
                    }
                });
                if (data.hostPeerId) {
                    this.hostPeerId = data.hostPeerId;
                }
                break;

            case 'request-state':
                // Send current annotations
                this._sendToPeer(peerId, {
                    type: 'state-sync',
                    annotations: Array.from(this.localAnnotations.values())
                });
                break;

            case 'state-sync':
                // Receive initial state
                data.annotations.forEach(annotation => {
                    this._handleRemoteAnnotation(annotation);
                });
                break;

            case 'annotation-create':
                this._handleRemoteAnnotation(data.annotation);
                this.eventBus.emit('collaboration:annotation-created', data.annotation);
                break;

            case 'annotation-update':
                this._handleRemoteAnnotation(data.annotation, true);
                this.eventBus.emit('collaboration:annotation-updated', data.annotation);
                break;

            case 'annotation-delete':
                this._removeRemoteAnnotation(data.annotationId);
                this.eventBus.emit('collaboration:annotation-deleted', { id: data.annotationId });
                break;
        }
    }

    /**
     * Broadcast message to all connected peers
     */
    _broadcast(data) {
        this.connections.forEach((conn, peerId) => {
            if (conn.open) {
                try {
                    conn.send(data);
                } catch (error) {
                    this.logger.error(`Failed to send to ${peerId}`, error);
                }
            }
        });
    }

    /**
     * Send message to specific peer
     */
    _sendToPeer(peerId, data) {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            try {
                conn.send(data);
            } catch (error) {
                this.logger.error(`Failed to send to ${peerId}`, error);
            }
        }
    }

    /**
     * Create and broadcast an annotation
     */
    createAnnotation(annotationData) {
        const annotation = {
            id: this._generateId(),
            ...annotationData,
            creator: this.myPeerId,
            creatorName: this.userName,
            timestamp: Date.now()
        };

        this.localAnnotations.set(annotation.id, annotation);
        this._handleRemoteAnnotation(annotation);

        this._broadcast({
            type: 'annotation-create',
            annotation
        });

        this.logger.debug('Annotation created and broadcast', annotation);
    }

    /**
     * Delete annotation
     */
    deleteAnnotation(annotationId) {
        this.localAnnotations.delete(annotationId);
        this._removeRemoteAnnotation(annotationId);

        this._broadcast({
            type: 'annotation-delete',
            annotationId
        });
    }

    /**
     * Disconnect from all peers
     */
    disconnect() {
        if (this.peer) {
            this.connections.forEach(conn => conn.close());
            this.peer.destroy();
            this.peer = null;
        }

        this.connections.clear();
        this.peerInfo.clear();
        this.localAnnotations.clear();

        this._clearAnnotations();

        this.logger.info('CollaborationManager: Disconnected');
        this.eventBus.emit('collaboration:disconnected');
    }

    /**
     * Get shareable room URL
     */
    getRoomURL() {
        if (!this.roomId) return null;
        const baseURL = window.location.origin + window.location.pathname;
        return `${baseURL}#room=${this.roomId}&host=${this.hostPeerId || this.myPeerId}`;
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.peer && this.peer.open;
    }

    /**
     * Handle remote annotation (create visual)
     */
    _handleRemoteAnnotation(annotation, isUpdate = false) {
        if (isUpdate) {
            this._removeRemoteAnnotation(annotation.id);
        }

        // Create visual based on type
        let visual = null;

        switch (annotation.type) {
            case 'measurement':
                visual = this._createMeasurementVisual(annotation);
                break;
            case 'area':
                visual = this._createAreaVisual(annotation);
                break;
            case 'surfaceArea':
                visual = this._createSurfaceAreaVisual(annotation);
                break;
        }

        if (visual) {
            visual.userData.annotationId = annotation.id;
            this.annotationGroup.add(visual);
        }
    }

    _createMeasurementVisual(annotation) {
        const group = new THREE.Group();
        
        // Create line
        const points = annotation.data.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
        const line = new THREE.Line(geometry, material);
        
        group.add(line);
        
        // Create label
        const midPoint = new THREE.Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5);
        const label = this._createTextSprite(`${annotation.data.distance.toFixed(2)}m`, '#00ffff');
        label.position.copy(midPoint);
        group.add(label);
        
        return group;
    }

    _createAreaVisual(annotation) {
        const group = new THREE.Group();
        
        // Create polygon outline
        const points = annotation.data.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        points.push(points[0]); // Close the loop
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
        const line = new THREE.Line(geometry, material);
        
        group.add(line);
        
        // Create label
        const center = new THREE.Vector3();
        annotation.data.points.forEach(p => center.add(new THREE.Vector3(p.x, p.y, p.z)));
        center.divideScalar(annotation.data.points.length);
        
        const label = this._createTextSprite(`${annotation.data.area.toFixed(2)}m²`, '#00ff00');
        label.position.copy(center);
        group.add(label);
        
        return group;
    }

    _createSurfaceAreaVisual(annotation) {
        const group = new THREE.Group();
        
        // Create polygon outline
        const points = annotation.data.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        points.push(points[0]); // Close the loop
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x00aaff, linewidth: 2 });
        const line = new THREE.Line(geometry, material);
        
        group.add(line);
        
        // Create label
        const center = new THREE.Vector3();
        annotation.data.points.forEach(p => center.add(new THREE.Vector3(p.x, p.y, p.z)));
        center.divideScalar(annotation.data.points.length);
        
        const label = this._createTextSprite(`${annotation.data.surfaceArea.toFixed(2)}m² (3D)`, '#00aaff');
        label.position.copy(center);
        group.add(label);
        
        return group;
    }

    _createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = 'Bold 48px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1, 0.25, 1);
        sprite.renderOrder = 1000;
        
        return sprite;
    }

    _removeRemoteAnnotation(annotationId) {
        const toRemove = [];
        this.annotationGroup.traverse((obj) => {
            if (obj.userData.annotationId === annotationId) {
                toRemove.push(obj);
            }
        });
        
        toRemove.forEach(obj => {
            this.annotationGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        });
    }

    _clearAnnotations() {
        while (this.annotationGroup.children.length > 0) {
            const obj = this.annotationGroup.children[0];
            this.annotationGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        }
    }

    _generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    _generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    _generateColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}