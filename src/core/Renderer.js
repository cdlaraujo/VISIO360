// src/core/Renderer.js
import * as THREE from 'three';

/**
 * @class Renderer
 * @description Gerencia a câmera e o loop de renderização com THREE.js.
 */
export class Renderer {
    constructor(container, scene, logger, eventBus) {
        this.container = container;
        this.scene = scene; // Recebe a cena do SceneManager
        this.logger = logger;
        this.eventBus = eventBus;

        this.camera = null;
        this.webglRenderer = null;
    }

    initialize() {
        const fov = 50;
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const near = 0.001; 
        const far = 10000;

        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera.position.set(0, 5, 10);

        this.webglRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.webglRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.webglRenderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.webglRenderer.domElement);
        
        window.addEventListener('resize', this._onWindowResize.bind(this));
        
        this._setupEventListeners();

        this.logger.info('Renderer: Inicializado.');
        
        return {
            camera: this.camera,
            domElement: this.webglRenderer.domElement
        };
    }

    _setupEventListeners() {
        this.eventBus.on('model:loaded', (payload) => {
            this.focusOnObject(payload.model);
        });

        this.eventBus.on('app:update', () => this.render());
    }
    
    focusOnObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5;
        
        const minZ = box.min.z || 0.1;
        this.camera.position.set(center.x, center.y, center.z + Math.max(cameraZ, minZ));
        
        this.eventBus.emit('camera:focus', { object });
        this.logger.info('Renderer: Posição da câmera ajustada para o novo objeto.');
    }

    render() {
        this.webglRenderer.render(this.scene, this.camera);
    }
    
    _onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.webglRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
}