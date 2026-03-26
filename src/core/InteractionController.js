import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * @class InteractionController
 * @description Gerencia todas as interações do usuário com a cena 3D.
 * (REFATORADO para usar o Padrão State. Agora delega eventos para um objeto 'currentState').
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
        
        this.currentState = null; // <-- O estado de interação ativo
        this.currentTool = 'none'; // <-- Mantido APENAS para compatibilidade de eventos

        // Configurações de zoom
        this.zoomConfig = {
            minDistance: 0.01,
            maxDistance: 10000,
            zoomFactor: 0.8,
            autoAdjustLimits: true
        };

        this._initializeControls();
        this._setupEventListeners();
    }

    _initializeControls() {
        this.controls = new OrbitControls(this.camera, this.domElement);
        // ... (configurações dos controles)
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = false; // Zoom é tratado manualmente
        this.controls.enableRotate = true;
        this.controls.rotateSpeed = 1.0;
        this.controls.enablePan = true;
        this.controls.panSpeed = 1.0;
        this.controls.screenSpacePanning = false;
        this.controls.maxPolarAngle = Math.PI;
        this.controls.minPolarAngle = 0;

        this._setupSimpleZoom();
        this.logger.info('InteractionController: OrbitControls inicializado.');
    }

    _setupEventListeners() {
        this.eventBus.on('app:update', () => this.update());
        this.eventBus.on('camera:focus', (payload) => this.focusOnObject(payload.object));
        this.eventBus.on('model:loaded', (payload) => {
            this.intersectableObjects = [payload.model];
            this._adjustZoomLimitsForModel(payload.model);
            this.logger.info('InteractionController: Novo objeto de interseção definido.');
        });
        
        // Ouve 'tool:changed' apenas para atualizar o cursor (compatibilidade)
        this.eventBus.on('tool:changed', (payload) => {
            this.currentTool = payload.activeTool;
            // A lógica de cursor real é tratada pelo Estado em onEnter()
        });

        // Eventos do mouse
        this.domElement.addEventListener('click', this._onClick.bind(this));
        this.domElement.addEventListener('dblclick', this._onDoubleClick.bind(this));
        this.domElement.addEventListener('mousemove', this._onMouseMove.bind(this));
        this.domElement.addEventListener('wheel', this._handleSimpleZoom.bind(this), { passive: false });

        // Eventos de teclado
        document.addEventListener('keydown', (event) => {
            if (this.currentState) {
                this.currentState.onKeyDown(event, this);
            }
        });
    }

    // --- Gerenciamento de Estado (Novos Métodos) ---

    /**
     * Define o estado de interação atual. Chamado pelo ToolController.
     * @param {BaseInteractionState} state 
     */
    setState(state) {
        this.currentState = state;
        this.logger.debug(`InteractionController: State changed to ${state?.constructor.name || 'null'}`);
    }

    /**
     * Permite que os estados controlem o cursor.
     * @param {string} cursorType 
     */
    setCursor(cursorType) {
        this.domElement.style.cursor = cursorType || 'default';
    }

    /**
     * Permite que os estados habilitem/desabilitem os OrbitControls.
     * @param {boolean} enabled 
     */
    setOrbitControlsEnabled(enabled) {
        if(this.controls) {
            this.controls.enabled = enabled;
        }
    }

    // --- Delegação de Eventos (Métodos Modificados) ---

    _onClick(event) {
        event.preventDefault();
        
        // Se os controles da órbita estiverem ativos, não faça nada (permite rotação/pan)
        if (this.controls.enabled) return;

        this._updateMousePosition(event);

        if (!this.currentState || !this.intersectableObjects.length) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.intersectableObjects, true);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            const intersection = intersects[0];
            
            // Delega o clique para o estado ativo
            this.currentState.onClick(point, intersection, this);
        }
    }

    _onDoubleClick(event) {
        event.preventDefault();
        if (this.currentState) {
            // Delega o duplo-clique
            this.currentState.onDoubleClick(event, this);
        }
    }

    _onMouseMove(event) {
        this._updateMousePosition(event);
        
        if (this.currentState) {
            // (Opcional: podemos fazer o raycast aqui e passar o ponto)
            this.currentState.onMouseMove(null, this);
        }
    }

    _updateMousePosition(event) {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    // --- Lógica de Zoom (Sem Alteração) ---
    _setupSimpleZoom() {
        // (este método não foi modificado, mas o 'wheel' listener está em _setupEventListeners)
    }
    
    _handleSimpleZoom(event) {
        event.preventDefault();
        // ... (toda a lógica de zoom existente permanece a mesma)
        this._updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const currentDistance = this.camera.position.distanceTo(this.controls.target);
        const zoomIn = event.deltaY < 0;

        const newDistance = zoomIn
            ? currentDistance * this.zoomConfig.zoomFactor
            : currentDistance / this.zoomConfig.zoomFactor;

        const clampedDistance = Math.max(
            this.zoomConfig.minDistance,
            Math.min(newDistance, this.zoomConfig.maxDistance)
        );

        if (Math.abs(clampedDistance - currentDistance) < 0.001) return;

        let zoomTarget = this.controls.target.clone();

        if (this.intersectableObjects.length > 0) {
            const intersects = this.raycaster.intersectObjects(this.intersectableObjects, true);
            if (intersects.length > 0) {
                zoomTarget = intersects[0].point;
            } else {
                const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                    this.camera.getWorldDirection(new THREE.Vector3()),
                    this.controls.target
                );
                const projectedPoint = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(plane, projectedPoint);
                if (projectedPoint) {
                    zoomTarget = projectedPoint;
                }
            }
        }

        const zoomRatio = 1 - (clampedDistance / currentDistance);
        const targetOffset = zoomTarget.clone().sub(this.controls.target);
        const newTarget = this.controls.target.clone().add(targetOffset.multiplyScalar(zoomRatio * 0.5));

        const direction = this.camera.position.clone().sub(newTarget).normalize();
        this.camera.position.copy(newTarget).add(direction.multiplyScalar(clampedDistance));

        this.controls.target.copy(newTarget);
    }

    _adjustZoomLimitsForModel(model) {
        // ... (lógica de ajuste de zoom existente)
        if (!this.zoomConfig.autoAdjustLimits) return;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        this.zoomConfig.minDistance = maxDimension * 0.001;
        this.zoomConfig.maxDistance = maxDimension * 20;
        this.logger.info(`InteractionController: Limites ajustados - Min: ${this.zoomConfig.minDistance.toFixed(3)}, Max: ${this.zoomConfig.maxDistance.toFixed(1)}`);
    }

    // --- Lógica de Foco (Sem Alteração) ---
    focusOnObject(object) {
        // ... (lógica de foco existente)
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let optimalDistance = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
        optimalDistance *= 1.5;
        optimalDistance = Math.max(optimalDistance, this.zoomConfig.minDistance);
        optimalDistance = Math.min(optimalDistance, this.zoomConfig.maxDistance);
        const direction = this.camera.position.clone().sub(center).normalize();
        if (direction.length() === 0) {
            direction.set(0, 1, 1).normalize();
        }
        this.camera.position.copy(center).add(direction.multiplyScalar(optimalDistance));
        this.controls.target.copy(center);
        this.controls.update();
        this.logger.info('InteractionController: Câmera focada no objeto com distância otimizada.');
    }

    update() {
        this.controls.update();
    }

    setZoomConfig(config) {
        this.zoomConfig = { ...this.zoomConfig, ...config };
        this.logger.info('InteractionController: Configuração de zoom atualizada.', this.zoomConfig);
    }

    resetCamera() {
        if (this.intersectableObjects.length > 0) {
            this.focusOnObject(this.intersectableObjects[0]);
        } else {
            this.camera.position.set(0, 5, 10);
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
        this.logger.info('InteractionController: Câmera resetada para posição inicial.');
    }
}