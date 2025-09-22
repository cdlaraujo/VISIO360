import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * @class InteractionController
 * @description Gerencia todas as interações do usuário com a cena 3D, como controles de câmera e picking de objetos.
 */
export class InteractionController {
    constructor(camera, domElement, logger, eventBus) {
        this.camera = camera;
        this.domElement = domElement;
        this.logger = logger;
        this.eventBus = eventBus;
        this.controls = null;

        this._initializeControls();
        this._setupEventListeners();
    }

    /**
     * Inicializa os controles de órbita da câmera.
     * @private
     */
    _initializeControls() {
        this.controls = new OrbitControls(this.camera, this.domElement);
        this.controls.enableDamping = true;
        this.logger.info('InteractionController: OrbitControls inicializado.');
    }

    /**
     * Configura os listeners de eventos do EventBus.
     * @private
     */
    _setupEventListeners() {
        // Ouve o evento 'app:update' para atualizar o estado dos controles (ex: damping)
        this.eventBus.on('app:update', () => this.update());

        // Ouve um evento para focar a câmera em um objeto específico
        this.eventBus.on('camera:focus', (payload) => this.focusOnObject(payload.object));
    }
    
    /**
     * Foca a câmera em um objeto 3D.
     * @param {THREE.Object3D} object - O objeto a ser focado.
     */
    focusOnObject(object) {
        // A lógica para focar no objeto foi movida do Renderer para cá.
        // O cálculo do foco permanece o mesmo.
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        
        this.controls.target.copy(center);
        this.logger.info('InteractionController: Alvo da câmera atualizado para o centro do objeto.');
    }

    /**
     * Método de atualização chamado a cada quadro pelo evento 'app:update'.
     */
    update() {
        this.controls.update();
    }
}