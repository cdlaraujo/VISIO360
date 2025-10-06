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

        // Configurações de zoom - valores simples e eficazes
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

        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = false;
        this.controls.enableRotate = true;
        this.controls.rotateSpeed = 1.0;
        this.controls.enablePan = true;
        this.controls.panSpeed = 1.0;
        this.controls.screenSpacePanning = false;
        this.controls.maxPolarAngle = Math.PI;
        this.controls.minPolarAngle = 0;

        this._setupSimpleZoom();

        this.logger.info('InteractionController: OrbitControls inicializado com configurações otimizadas.');
    }

    _setupEventListeners() {
        this.eventBus.on('app:update', () => this.update());
        this.eventBus.on('camera:focus', (payload) => this.focusOnObject(payload.object));
        this.eventBus.on('model:loaded', (payload) => {
            this.intersectableObjects = [payload.model];
            this._adjustZoomLimitsForModel(payload.model);
            this.logger.info('InteractionController: Novo objeto de interseção definido e limites ajustados.');
        });
        this.eventBus.on('tool:changed', (payload) => {
            this.currentTool = payload.activeTool;
            this._updateCursor();
        });

        // Eventos do mouse para picking
        this.domElement.addEventListener('click', this._onClick.bind(this));
        this.domElement.addEventListener('dblclick', this._onDoubleClick.bind(this));
        this.domElement.addEventListener('mousemove', this._onMouseMove.bind(this));

        // Evento ESC para finalizar medições de área
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && (this.currentTool === 'area' || this.currentTool === 'surfaceArea')) {
                this.eventBus.emit('measurement:area:finish');
            }
        });
    }

    _setupSimpleZoom() {
        this.domElement.addEventListener('wheel', this._handleSimpleZoom.bind(this), { passive: false });
    }

    _handleSimpleZoom(event) {
        event.preventDefault();

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
        if (!this.zoomConfig.autoAdjustLimits) return;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);

        this.zoomConfig.minDistance = maxDimension * 0.001;
        this.zoomConfig.maxDistance = maxDimension * 20;

        this.logger.info(`InteractionController: Limites ajustados - Min: ${this.zoomConfig.minDistance.toFixed(3)}, Max: ${this.zoomConfig.maxDistance.toFixed(1)}`);
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
            const intersection = intersects[0]; // Store the full intersection
            this.eventBus.emit('measurement:point:selected', {
                point: point.clone(),
                tool: this.currentTool,
                object: intersection.object,
                face: intersection.face
            });
            this.logger.debug(`InteractionController: Ponto selecionado para ferramenta "${this.currentTool}".`);
        }
    }

    _onDoubleClick(event) {
        // Duplo-clique finaliza medição de área
        if (this.currentTool === 'area' || this.currentTool === 'surfaceArea') {
            event.preventDefault();
            this.eventBus.emit('measurement:area:finish');
            this.logger.info('InteractionController: Duplo-clique detectado - finalizando área.');
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
        if (this.currentTool === 'measure' || this.currentTool === 'area' || this.currentTool === 'surfaceArea') {
            this.domElement.style.cursor = 'crosshair';
        } else {
            this.domElement.style.cursor = 'default';
        }
    }

    focusOnObject(object) {
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