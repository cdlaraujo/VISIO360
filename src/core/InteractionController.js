import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * @class InteractionController
 * @description Gerencia todas as interações do usuário com a cena 3D, incluindo controles de câmera e picking de objetos.
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
        this.intersectableObjects = [];
        this.currentTool = 'none';

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
            this.intersectableObjects = [payload.model];
            this.logger.info('InteractionController: Novo objeto de interseção definido.');
        });
        this.eventBus.on('tool:changed', (payload) => {
            this.currentTool = payload.activeTool;
            this._updateCursor();
        });

        // Eventos do mouse para picking
        this.domElement.addEventListener('click', this._onClick.bind(this));
        this.domElement.addEventListener('wheel', this._onMouseWheel.bind(this), { passive: false });
        this.domElement.addEventListener('mousemove', this._onMouseMove.bind(this));

        // Evento ESC para finalizar medições de área
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.currentTool === 'area') {
                this.eventBus.emit('measurement:area:finish');
            }
        });
    }

    _onClick(event) {
        // Só processa cliques se uma ferramenta de medição estiver ativa
        if (this.currentTool === 'none') return;

        event.preventDefault();
        this._updateMousePosition(event);

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.intersectableObjects, true);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.eventBus.emit('measurement:point:selected', {
                point: point.clone(),
                tool: this.currentTool
            });
            this.logger.debug(`InteractionController: Ponto selecionado para ferramenta "${this.currentTool}".`);
        }
    }

    _onMouseMove(event) {
        this._updateMousePosition(event);
    }

    _updateMousePosition(event) {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    _updateCursor() {
        if (this.currentTool === 'measure' || this.currentTool === 'area') {
            this.domElement.style.cursor = 'crosshair';
        } else {
            this.domElement.style.cursor = 'default';
        }
    }
    
    /**
     * Lida com o evento de scroll do mouse para implementar o zoom focado e estável.
     * @param {WheelEvent} event
     * @private
     */
    _onMouseWheel(event) {
        event.preventDefault();

        // Inverte o sinal de event.deltaY para que o zoom siga a direção natural do scroll
        const dollyScale = Math.pow(0.95, -event.deltaY * 0.05);

        // Ponto de referência atual da câmera
        const target = this.controls.target;
        const camera = this.controls.object;
        
        // Vetor do offset da câmera em relação ao alvo atual
        const cameraOffset = new THREE.Vector3().subVectors(camera.position, target);

        // Calcula a nova posição do alvo, movendo-o em direção ao ponto sob o cursor
        this._updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, camera);

        // Projeta um ponto em um plano que passa pelo alvo atual
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