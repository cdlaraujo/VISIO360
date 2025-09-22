import * as THREE from 'three';
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
        
        // Propriedades para o zoom focado
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.intersectableObject = null; // Armazena o modelo 3D atual

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
     * Configura os listeners de eventos.
     * @private
     */
    _setupEventListeners() {
        this.eventBus.on('app:update', () => this.update());
        this.eventBus.on('camera:focus', (payload) => this.focusOnObject(payload.object));

        // Ouve quando um novo modelo é carregado para saber com qual objeto interagir
        this.eventBus.on('model:loaded', (payload) => {
            this.intersectableObject = payload.model;
            this.logger.info('InteractionController: Novo objeto de interseção definido.');
        });

        // Adiciona o listener para o scroll (wheel) do mouse
        this.domElement.addEventListener('wheel', this._onMouseWheel.bind(this), { passive: false });
    }
    
    /**
     * Lida com o evento de scroll do mouse para implementar o zoom focado.
     * @param {WheelEvent} event
     * @private
     */
    _onMouseWheel(event) {
        if (!this.intersectableObject) return;

        event.preventDefault();

        // Calcula a posição do mouse em coordenadas normalizadas (-1 a +1)
        this.mouse.x = (event.clientX / this.domElement.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.domElement.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Verifica a interseção apenas com o modelo carregado
        const intersects = this.raycaster.intersectObject(this.intersectableObject, true);

        if (intersects.length > 0) {
            // Se houver uma interseção, atualiza o alvo dos controles para esse ponto
            this.controls.target.copy(intersects[0].point);
        }
    }

    /**
     * Foca a câmera no centro de um objeto 3D.
     * @param {THREE.Object3D} object - O objeto a ser focado.
     */
    focusOnObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        
        this.controls.target.copy(center);
        this.logger.info('InteractionController: Alvo da câmera atualizado para o centro do objeto.');
    }

    /**
     * Método de atualização chamado a cada quadro.
     */
    update() {
        this.controls.update();
    }
}