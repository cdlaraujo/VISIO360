// src/modules/SceneManager.js
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import Logger from '../utils/Logger.js';

export default class SceneManager {
    constructor({ state, eventBus }) {
        this.logger = new Logger('SceneManager');
        this.state = state;
        this.eventBus = eventBus;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 3);
        this.scene.add(ambientLight);

        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        this.logger.info('SceneManager initialized.');
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.logger.info('Window resized.');
    }

    update(delta) {
        TWEEN.update();
    }
    
    getDomElement() {
        return this.renderer.domElement;
    }
}