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
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.intersectableObject = null;

        this._initializeControls();
        this._setupEventListeners();
    }

    _initializeControls() {
        this.controls = new OrbitControls(this.camera, this.domElement);
        this.controls.enableDamping = true;
        this.logger.info('InteractionController: OrbitControls inicializado.');
    }

    _setupEventListeners() {
        this.eventBus.on('app:update', () => this.update());
        this.eventBus.on('camera:focus', (payload) => this.focusOnObject(payload.object));
        this.eventBus.on('model:loaded', (payload) => {
            this.intersectableObject = payload.model;
            this.logger.info('InteractionController: Novo objeto de interseção definido.');
        });
        this.domElement.addEventListener('wheel', this._onMouseWheel.bind(this), { passive: false });
    }
    
    /**
     * Lida com o evento de scroll do mouse para implementar o zoom focado e estável.
     * @param {WheelEvent} event
     * @private
     */
    _onMouseWheel(event) {
        event.preventDefault();

        // **CORREÇÃO AQUI:** Invertemos o sinal de event.deltaY para que o zoom siga a direção natural do scroll.
        // Rolar para cima (deltaY negativo) -> zoom in (escala < 1)
        // Rolar para baixo (deltaY positivo) -> zoom out (escala > 1)
        const dollyScale = Math.pow(0.95, -event.deltaY * 0.05);

        // Ponto de referência atual da câmera
        const target = this.controls.target;
        const camera = this.controls.object;
        
        // Vetor do offset da câmera em relação ao alvo atual
        const cameraOffset = new THREE.Vector3().subVectors(camera.position, target);

        // Calcula a nova posição do alvo, movendo-o em direção ao ponto sob o cursor
        this.mouse.x = (event.clientX / this.domElement.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.domElement.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, camera);

        // Projeta um ponto em um plano que passa pelo alvo atual. Isso cria um ponto focal estável.
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            camera.getWorldDirection(new THREE.Vector3()),
            target
        );
        const pointUnderCursor = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, pointUnderCursor);

        // Interpola o alvo atual em direção ao ponto sob o cursor
        const newTarget = target.clone().lerp(pointUnderCursor, 1 - dollyScale);
        
        // Calcula a nova posição da câmera, mantendo o offset escalado em relação ao novo alvo
        const newCameraPosition = newTarget.clone().add(cameraOffset.multiplyScalar(dollyScale));

        // Aplica as novas posições
        camera.position.copy(newCameraPosition);
        this.controls.target.copy(newTarget);
        
        this.controls.update();
    }

    focusOnObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        
        this.controls.target.copy(center);
        this.logger.info('InteractionController: Alvo da câmera atualizado para o centro do objeto.');
    }

    update() {
        this.controls.update();
    }
}