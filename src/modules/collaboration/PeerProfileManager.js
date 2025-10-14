// ============================================================================
// FILE 5: src/modules/collaboration/PeerProfileManager.js
// ============================================================================

/**
 * @class PeerProfileManager
 * @description Manages peer profiles (names, colors) and profile exchange.
 * Single Responsibility: Handle user profile information.
 */
export class PeerProfileManager {
    constructor(connectionManager, logger, eventBus) {
        this.connectionManager = connectionManager;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.myProfile = {
            name: this._generateDefaultName(),
            color: this._generateRandomColor()
        };

        this.peerProfiles = new Map();

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('connection:opened', (payload) => {
            this._sendProfileTo(payload.peerId);
        });

        this.eventBus.on('connection:data', (payload) => {
            if (payload.data.type === 'profile-intro') {
                this._handleProfileIntro(payload.peerId, payload.data);
            }
        });

        this.eventBus.on('connection:peer-disconnected', (payload) => {
            this.peerProfiles.delete(payload.peerId);
            this.eventBus.emit('peer:profile-removed', { peerId: payload.peerId });
        });
    }

    setMyProfile(name, color) {
        if (name) {
            this.myProfile.name = name;
        }
        if (color) {
            this.myProfile.color = color;
        }

        this.logger.info(`PeerProfileManager: Profile updated - ${this.myProfile.name} (${this.myProfile.color})`);
        
        this._broadcastMyProfile();
        
        this.eventBus.emit('peer:my-profile-updated', { profile: this.myProfile });
    }

    getMyProfile() {
        return { ...this.myProfile };
    }

    getPeerProfile(peerId) {
        return this.peerProfiles.get(peerId) || null;
    }

    getAllPeerProfiles() {
        return new Map(this.peerProfiles);
    }

    _sendProfileTo(peerId) {
        this.logger.debug(`PeerProfileManager: Sending profile to ${peerId}`);
        
        this.connectionManager.sendToPeer(peerId, {
            type: 'profile-intro',
            name: this.myProfile.name,
            color: this.myProfile.color
        });
    }

    _broadcastMyProfile() {
        this.connectionManager.broadcast({
            type: 'profile-intro',
            name: this.myProfile.name,
            color: this.myProfile.color
        });
    }

    _handleProfileIntro(peerId, data) {
        this.logger.info(`PeerProfileManager: Received profile from ${peerId} - ${data.name} (${data.color})`);
        
        const profile = {
            name: data.name,
            color: data.color
        };

        this.peerProfiles.set(peerId, profile);

        this.eventBus.emit('peer:profile-received', { 
            peerId, 
            profile 
        });
    }

    _generateDefaultName() {
        const adjectives = ['Swift', 'Bright', 'Clever', 'Bold', 'Calm', 'Wise', 'Quick', 'Cool'];
        const nouns = ['Fox', 'Eagle', 'Wolf', 'Bear', 'Hawk', 'Tiger', 'Lion', 'Owl'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return `${adj}${noun}`;
    }

    _generateRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
            '#52B788', '#F4A582', '#8E44AD', '#3498DB'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getTotalPeerCount() {
        return this.peerProfiles.size + 1;
    }

    clearAllProfiles() {
        this.peerProfiles.clear();
        this.logger.info('PeerProfileManager: All peer profiles cleared');
    }
}