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

    setModelData(blob, fileName) {
        this.modelBlob = blob;
        this.modelFileName = fileName;
        if (this.isHost) {
            this._broadcast({ type: 'model-available', fileName: this.modelFileName, fileSize: this.modelBlob.size });
        }
    }
    
    _checkURLForRoom() {
        const roomId = new URLSearchParams(window.location.hash.substring(1)).get('room');
        if (roomId) this._urlRoomId = roomId;
    }

    async connect(roomId = null) {
        if (this.peer) return;
        try {
            this.peer = new Peer({ debug: 0 });
            this.myPeerId = await new Promise((resolve, reject) => {
                this.peer.on('open', resolve);
                this.peer.on('error', reject);
            });
            this._setupPeerEventHandlers();
            const targetRoomId = roomId || this._urlRoomId;
            this.isHost = !targetRoomId;
            this.roomId = targetRoomId || this._generateRoomId();
            if (!this.isHost) this._joinRoom(); else this._createRoom();
            this.eventBus.emit('collaboration:connected', { roomId: this.roomId, isHost: this.isHost });
        } catch (error) {
            this.logger.error('P2P connection failed.', error);
            if (this.peer) this.peer.destroy();
        }
    }

    _createRoom() {
        window.location.hash = `room=${this.roomId}`;
        this.logger.info(`Room created: ${this.roomId}`);
    }

    _joinRoom() {
        this.logger.info(`Attempting to join room: ${this.roomId}`);
        // We don't need to do anything special; peers will connect to us
    }

    _setupPeerEventHandlers() {
        this.peer.on('connection', conn => this._handleNewConnection(conn));
    }

    _handleNewConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this._sendToPeer(conn.peer, { type: 'intro', name: this.userName, color: this.userColor });
            // New peer will ask for the model
            this._sendToPeer(conn.peer, { type: 'request-model' });
        });
        conn.on('data', data => this._handleMessage(conn.peer, data));
        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.peerInfo.delete(conn.peer);
            this.eventBus.emit('collaboration:peer-left', { peerId: conn.peer });
        });
    }

    _handleMessage(peerId, data) {
        switch (data.type) {
            case 'intro':
                this.peerInfo.set(peerId, { name: data.name, color: data.color });
                this.eventBus.emit('collaboration:peer-info', { peerId, info: data });
                break;
            case 'request-model':
                if (this.modelBlob) this._sendFile(peerId);
                break;
            case 'file-header':
                this.fileReceiver[peerId] = { chunks: [], ...data };
                this.eventBus.emit('ui:p2p-progress:start', { from: this.peerInfo.get(peerId)?.name || 'Host' });
                break;
            case 'file-chunk':
                this._handleFileChunk(peerId, data.chunk);
                break;
            case 'annotation-create':
                this._handleRemoteAnnotation(data.annotation);
                break;
        }
    }
    
    _sendFile(peerId) {
        this._sendToPeer(peerId, { type: 'file-header', fileName: this.modelFileName, fileSize: this.modelBlob.size });
        let offset = 0;
        const readSlice = o => {
            const slice = this.modelBlob.slice(offset, o + this.CHUNK_SIZE);
            slice.arrayBuffer().then(buffer => {
                this._sendToPeer(peerId, { type: 'file-chunk', chunk: buffer });
                offset += buffer.byteLength;
                if (offset < this.modelBlob.size) readSlice(offset);
            });
        };
        readSlice(0);
    }

    _handleFileChunk(peerId, chunk) {
        const receiver = this.fileReceiver[peerId];
        if (!receiver) return;
        receiver.chunks.push(chunk);
        receiver.receivedSize = (receiver.receivedSize || 0) + chunk.byteLength;
        const progress = (receiver.receivedSize / receiver.fileSize) * 100;
        this.eventBus.emit('ui:p2p-progress:update', { progress });
        if (receiver.receivedSize === receiver.fileSize) {
            const completeFile = new Blob(receiver.chunks);
            this.eventBus.emit('model:load', { fileData: completeFile, fileName: receiver.fileName });
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
        canvas.width = 256; canvas.height = 64;
        context.font = 'Bold 24px Arial';
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
        sprite.scale.set(0.5, 0.125, 1);
        return sprite;
    }

    createAnnotation(data) { this._broadcast({ type: 'annotation-create', annotation: {id: `ann_${this.myPeerId}_${Date.now()}`, ...data}}); }
    _broadcast(data) { this.connections.forEach(conn => conn.open && conn.send(data)); }
    _sendToPeer(peerId, data) { const c = this.connections.get(peerId); if (c && c.open) c.send(data); }
    isConnected() { return this.peer && !this.peer.disconnected; }
    getRoomURL() { return this.roomId ? `${window.location.origin}${window.location.pathname}#room=${this.roomId}` : null; }
    _generateRoomId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
}