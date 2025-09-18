import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * @class Renderer
 * @description Gerencia a renderização com THREE.js e reage a eventos da aplicação.
 */
export class Renderer {
    constructor(container, logger, eventBus) {
        this.container = container;
        this.logger = logger;
        this.eventBus = eventBus;

        this.scene = null;
        this.camera = null;
        this.webglRenderer = null;
        this.controls = null;
    }

    /**
     * Configura a cena, a câmera e os listeners de eventos.
     */
    initialize() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        const fov = 50;
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const near = 0.1;
        const far = 2000;
        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera.position.set(0, 5, 10);

        this.webglRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.webglRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.webglRenderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.webglRenderer.domElement);
        
        this.controls = new OrbitControls(this.camera, this.webglRenderer.domElement);
        this.controls.enableDamping = true;
        
        this._setupLights();

        // CORREÇÃO: Usando cores mais claras para o grid para garantir visibilidade.
        const gridHelper = new THREE.GridHelper(100, 100, 0xcccccc, 0x777777);
        this.scene.add(gridHelper);
        
        window.addEventListener('resize', this._onWindowResize.bind(this));
        
        this._setupEventListeners();

        this.logger.info('Renderer: Initialized and listening for events.');
    }

    /**
     * Centraliza o registro de todos os ouvintes de eventos para este módulo.
     * @private
     */
    _setupEventListeners() {
        this.eventBus.on('model:loaded', (payload) => {
            this.addObject(payload.model);
            this.focusOnObject(payload.model);
        });

        this.eventBus.on('app:update', () => this.update());
    }

    _setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(5, 10, 7.5).normalize();
        this.scene.add(directionalLight);
    }

    addObject(object) {
        if (object) {
            this.scene.add(object);
        } else {
            this.logger.warn('Renderer: Attempted to add an invalid object to the scene.');
        }
    }
    
    focusOnObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5;
        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.controls.target.copy(center);
        this.controls.update();
        this.logger.info('Renderer: Camera focused on object.', { center, size });
    }

    update() {
        this.controls.update();
        this.webglRenderer.render(this.scene, this.camera);
    }
    
    _onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.webglRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        // Não é mais necessário logar isso em modo INFO
        // this.logger.debug('Renderer: Window resized.');
    }
}
