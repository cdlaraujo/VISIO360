// src/modules/CollaborationManager.js
import * as THREE from 'three';

export class CollaborationManager {
    constructor(scene, logger, eventBus) {
        this.scene = scene;
        this.logger = logger;
        this.eventBus = eventBus;
        this.peer = null;
        this.connections = new Map();
        this.peerInfo = new Map();
        this.modelBlob = null;
        this.modelFileName = null;
        this.fileReceiver = {};
        this.CHUNK_SIZE = 64 * 1024; // 64KB
        this.userName = `User_${Math.random().toString(36).substr(2, 4)}`;
        this.userColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
        this.remoteAnnotationGroup = new THREE.Group();
        this.remoteAnnotationGroup.name = 'remote-annotations';
        this.scene.add(this.remoteAnnotationGroup);
        this._checkURLForRoom();
    }

    /**
     * FIX #1: When host loads a new model, broadcast it to ALL connected peers
     * This now actively pushes the model instead of just announcing availability
     */
    setModelData(blob, fileName) {
        this.modelBlob = blob;
        this.modelFileName = fileName;
        
        this.logger.info(`CollaborationManager: Model data set - "${fileName}" (${(blob.size / 1024 / 1024).toFixed(2)}MB), ${this.connections.size} peer(s) connected`);
        
        // If we have connected peers, send the model to everyone
        if (this.connections.size > 0) {
            this.logger.info(`CollaborationManager: Broadcasting new model "${fileName}" to ${this.connections.size} peer(s)`);
            
            // Send file to each connected peer
            this.connections.forEach((conn, peerId) => {
                if (conn.open) {
                    this.logger.info(`CollaborationManager: Sending model to peer ${peerId}`);
                    this._sendFile(peerId);
                } else {
                    this.logger.warn(`CollaborationManager: Connection to ${peerId} not open, skipping`);
                }
            });
        } else {
            this.logger.info(`CollaborationManager: No peers connected yet, model will be sent when peers join`);
        }
    }
    
    _checkURLForRoom() {
        const roomId = new URLSearchParams(window.location.hash.substring(1)).get('room');
        if (roomId) this._urlRoomId = roomId;
    }

    async connect(roomId = null) {
        if (this.peer) {
            this.logger.warn('CollaborationManager: Already connected');
            return;
        }
        
        try {
            this.logger.info('CollaborationManager: Initializing PeerJS connection...');
            this.peer = new Peer({ 
                debug: 0,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
            
            this.myPeerId = await new Promise((resolve, reject) => {
                this.peer.on('open', (id) => {
                    this.logger.info(`CollaborationManager: Connected to PeerJS with ID: ${id}`);
                    resolve(id);
                });
                this.peer.on('error', (error) => {
                    this.logger.error('CollaborationManager: PeerJS connection error', error);
                    reject(error);
                });
            });
            
            this._setupPeerEventHandlers();
            
            const targetRoomId = roomId || this._urlRoomId;
            this.isHost = !targetRoomId;
            
            // CRITICAL FIX: Room ID is the HOST's peer ID
            if (this.isHost) {
                // As host, our peer ID IS the room ID
                this.roomId = this.myPeerId;
            } else {
                // As client, the room ID is the host's peer ID we're connecting to
                this.roomId = targetRoomId;
            }
            
            if (!this.isHost) {
                this._joinRoom();
            } else {
                this._createRoom();
            }
            
            this.eventBus.emit('collaboration:connected', { 
                roomId: this.roomId, 
                isHost: this.isHost,
                peerId: this.myPeerId
            });
            
            this.logger.info(`CollaborationManager: ${this.isHost ? 'Hosting' : 'Joined'} room ${this.roomId}`);
            
        } catch (error) {
            this.logger.error('P2P connection failed.', error);
            if (this.peer) this.peer.destroy();
            throw error;
        }
    }

    _createRoom() {
        // Room code is just our peer ID
        // Update the URL hash so people can join via link
        window.location.hash = `room=${this.roomId}`;
        this.logger.info(`Room created with ID: ${this.roomId}`);
        this.logger.info('Waiting for peers to connect...');
    }

    _joinRoom() {
        this.logger.info(`Joining room: ${this.roomId}`);
        this.logger.info(`Connecting to host peer ID: ${this.roomId}`);
        
        // Connect to the host using their peer ID (which IS the room ID)
        const hostConnection = this.peer.connect(this.roomId, {
            reliable: true,
            serialization: 'binary'
        });
        
        hostConnection.on('open', () => {
            this.logger.info(`✅ Successfully connected to host!`);
            
            // CRITICAL FIX: Store the host connection and set up handlers
            this.connections.set(this.roomId, hostConnection);
            
            // Send introduction
            this._sendToPeer(this.roomId, { type: 'intro', name: this.userName, color: this.userColor });
            
            this.eventBus.emit('collaboration:peer-joined', { peerId: this.roomId });
        });
        
        // CRITICAL FIX: Set up data handler to receive messages from host
        hostConnection.on('data', (data) => {
            this._handleMessage(this.roomId, data);
        });
        
        hostConnection.on('error', (error) => {
            this.logger.error('❌ Error connecting to host:', error);
            this.eventBus.emit('collaboration:connection-error', { 
                error: 'Could not connect to host. Check room code or try again.' 
            });
        });
        
        hostConnection.on('close', () => {
            this.logger.warn('Connection to host closed');
            this.connections.delete(this.roomId);
            this.peerInfo.delete(this.roomId);
            this.eventBus.emit('collaboration:peer-left', { peerId: this.roomId });
        });
    }

    _setupPeerEventHandlers() {
        this.peer.on('connection', conn => this._handleNewConnection(conn));
    }

    /**
     * FIX #2: Simplified new connection flow
     * Only send model if one is already loaded
     */
    _handleNewConnection(conn) {
        this.logger.info(`CollaborationManager: New peer ${conn.peer} connecting...`);
        
        conn.on('open', () => {
            this.logger.info(`CollaborationManager: Peer ${conn.peer} connection opened`);
            this.connections.set(conn.peer, conn);
            this._sendToPeer(conn.peer, { type: 'intro', name: this.userName, color: this.userColor });
            
            // If host has a model already loaded, send it to the new peer
            if (this.modelBlob) {
                this.logger.info(`CollaborationManager: Sending existing model "${this.modelFileName}" to new peer ${conn.peer}`);
                // Use setTimeout to ensure connection is fully established
                setTimeout(() => {
                    if (conn.open) {
                        this._sendFile(conn.peer);
                    } else {
                        this.logger.warn(`CollaborationManager: Connection to ${conn.peer} closed before file transfer`);
                    }
                }, 100);
            } else {
                this.logger.info(`CollaborationManager: No model loaded yet for peer ${conn.peer}`);
            }
            
            this.eventBus.emit('collaboration:peer-joined', { peerId: conn.peer });
        });
        
        conn.on('data', data => this._handleMessage(conn.peer, data));
        
        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.peerInfo.delete(conn.peer);
            this.eventBus.emit('collaboration:peer-left', { peerId: conn.peer });
        });
        
        conn.on('error', (error) => {
            this.logger.error(`Connection error with peer ${conn.peer}:`, error);
        });
    }

    /**
     * FIX #3: Removed 'request-model' handling since we now push automatically
     * Removed unused 'model-available' case
     */
    _handleMessage(peerId, data) {
        switch (data.type) {
            case 'intro':
                this.peerInfo.set(peerId, { name: data.name, color: data.color });
                this.eventBus.emit('collaboration:peer-info', { peerId, info: data });
                break;
                
            case 'file-header':
                this.logger.info(`CollaborationManager: Receiving file "${data.fileName}" from ${this.peerInfo.get(peerId)?.name || peerId}`);
                this.fileReceiver[peerId] = { 
                    chunks: [], 
                    fileName: data.fileName,
                    fileSize: data.fileSize,
                    receivedSize: 0
                };
                this.eventBus.emit('ui:p2p-progress:start', { 
                    from: this.peerInfo.get(peerId)?.name || 'Peer' 
                });
                break;
                
            case 'file-chunk':
                this._handleFileChunk(peerId, data.chunk);
                break;
                
            case 'annotation-create':
                this._handleRemoteAnnotation(data.annotation);
                break;
                
            default:
                this.logger.warn(`CollaborationManager: Unknown message type "${data.type}" from ${peerId}`);
        }
    }
    
    /**
     * FIX #4: Added better error handling and progress tracking
     */
    _sendFile(peerId) {
        if (!this.modelBlob || !this.modelFileName) {
            this.logger.error('CollaborationManager: Cannot send file - no model loaded');
            return;
        }
        
        const conn = this.connections.get(peerId);
        if (!conn || !conn.open) {
            this.logger.warn(`CollaborationManager: Cannot send file to ${peerId} - connection not open`);
            return;
        }
        
        this.logger.info(`CollaborationManager: Sending file header to ${peerId}`);
        this._sendToPeer(peerId, { 
            type: 'file-header', 
            fileName: this.modelFileName, 
            fileSize: this.modelBlob.size 
        });
        
        let offset = 0;
        const totalChunks = Math.ceil(this.modelBlob.size / this.CHUNK_SIZE);
        let sentChunks = 0;
        
        const readSlice = o => {
            const slice = this.modelBlob.slice(offset, o + this.CHUNK_SIZE);
            slice.arrayBuffer().then(buffer => {
                this._sendToPeer(peerId, { type: 'file-chunk', chunk: buffer });
                offset += buffer.byteLength;
                sentChunks++;
                
                if (sentChunks % 10 === 0) {
                    this.logger.debug(`CollaborationManager: Sent ${sentChunks}/${totalChunks} chunks to ${peerId}`);
                }
                
                if (offset < this.modelBlob.size) {
                    readSlice(offset);
                } else {
                    this.logger.info(`CollaborationManager: Finished sending file to ${peerId}`);
                }
            }).catch(error => {
                this.logger.error(`CollaborationManager: Error reading file chunk for ${peerId}:`, error);
            });
        };
        
        readSlice(0);
    }

    _handleFileChunk(peerId, chunk) {
        const receiver = this.fileReceiver[peerId];
        if (!receiver) {
            this.logger.warn(`CollaborationManager: Received chunk from ${peerId} but no receiver initialized`);
            return;
        }
        
        receiver.chunks.push(chunk);
        receiver.receivedSize = (receiver.receivedSize || 0) + chunk.byteLength;
        const progress = (receiver.receivedSize / receiver.fileSize) * 100;
        
        this.eventBus.emit('ui:p2p-progress:update', { progress });
        
        if (receiver.receivedSize >= receiver.fileSize) {
            this.logger.info(`CollaborationManager: File transfer complete from ${peerId}`);
            const completeFile = new Blob(receiver.chunks);
            this.eventBus.emit('model:load', { 
                fileData: completeFile, 
                fileName: receiver.fileName 
            });
            this.eventBus.emit('ui:p2p-progress:end');
            delete this.fileReceiver[peerId];
        }
    }

    _handleRemoteAnnotation(annotation) {
        let visual = (annotation.type === 'measurement') ? this._createMeasurementVisual(annotation) : null;
        if (visual) {
            visual.userData.annotationId = annotation.id;
            this.remoteAnnotationGroup.add(visual);
        }
    }

    _createMeasurementVisual(annotation) {
        const group = new THREE.Group();
        const points = annotation.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2, depthTest: false });
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
        const label = this._createTextSprite(`${annotation.distance.toFixed(2)}m`, '#00ffff');
        label.position.copy(new THREE.Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5));
        group.add(line, label);
        return group;
    }

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
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(canvas), 
            depthTest: false 
        }));
        sprite.scale.set(0.5, 0.125, 1);
        return sprite;
    }

    createAnnotation(data) { 
        this._broadcast({ 
            type: 'annotation-create', 
            annotation: {
                id: `ann_${this.myPeerId}_${Date.now()}`, 
                ...data
            }
        }); 
    }
    
    _broadcast(data) { 
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        }); 
    }
    
    _sendToPeer(peerId, data) { 
        const c = this.connections.get(peerId); 
        if (c && c.open) {
            c.send(data);
        } else {
            this.logger.warn(`CollaborationManager: Cannot send to ${peerId} - connection not available`);
        }
    }
    
    isConnected() { 
        return this.peer && !this.peer.disconnected; 
    }
    
    getRoomURL() { 
        if (!this.roomId) return null;
        return `${window.location.origin}${window.location.pathname}#room=${this.roomId}`; 
    }
    
    _generateRoomId() { 
        // Not used anymore - we use peer ID as room ID
        return Math.random().toString(36).substring(2, 8).toUpperCase(); 
    }
}