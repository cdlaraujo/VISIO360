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
            minDistance: 0.01,      // Distância mínima
            maxDistance: 10000,     // Distância máxima  
            zoomFactor: 0.8,        // Fator de zoom (80% = aproxima 20% por scroll)
            autoAdjustLimits: true  // Ajusta limites baseado no modelo carregado
        };

        this._initializeControls();
        this._setupEventListeners();
    }

    _initializeControls() {
        this.controls = new OrbitControls(this.camera, this.domElement);
        
        // Configurações básicas do OrbitControls
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // DESABILITA zoom nativo para usar nosso sistema customizado
        this.controls.enableZoom = false;
        
        // Configurações de rotação e pan normais
        this.controls.enableRotate = true;
        this.controls.rotateSpeed = 1.0;
        this.controls.enablePan = true;
        this.controls.panSpeed = 1.0;
        this.controls.screenSpacePanning = false;
        
        // Limites de rotação
        this.controls.maxPolarAngle = Math.PI;
        this.controls.minPolarAngle = 0;

        // Implementa zoom simples e eficiente
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
        this.domElement.addEventListener('mousemove', this._onMouseMove.bind(this));

        // Evento ESC para finalizar medições de área
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.currentTool === 'area') {
                this.eventBus.emit('measurement:area:finish');
            }
        });

        // Event listener para mudanças nos controles (removido - não precisa mais)
        // this.controls.addEventListener('change', () => {
        //     this._enforceZoomLimits();
        // });
    }

    /**
     * Configura zoom simples e performático
     * @private
     */
    _setupSimpleZoom() {
        this.domElement.addEventListener('wheel', this._handleSimpleZoom.bind(this), { passive: false });
    }

    /**
     * Zoom simples com foco no cursor: o ponto sob o mouse permanece fixo
     * @param {WheelEvent} event 
     * @private
     */
    _handleSimpleZoom(event) {
        event.preventDefault();
        
        // Atualiza posição do mouse
        this._updateMousePosition(event);
        
        // Configura raycaster para encontrar ponto sob o cursor
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const currentDistance = this.camera.position.distanceTo(this.controls.target);
        const zoomIn = event.deltaY < 0;
        
        // Calcula nova distância
        const newDistance = zoomIn 
            ? currentDistance * this.zoomConfig.zoomFactor 
            : currentDistance / this.zoomConfig.zoomFactor;
        
        // Aplica limites
        const clampedDistance = Math.max(
            this.zoomConfig.minDistance,
            Math.min(newDistance, this.zoomConfig.maxDistance)
        );
        
        // Se não mudou, não faz nada
        if (Math.abs(clampedDistance - currentDistance) < 0.001) return;
        
        // Tenta encontrar ponto de interseção sob o cursor
        let zoomTarget = this.controls.target.clone();
        
        if (this.intersectableObjects.length > 0) {
            const intersects = this.raycaster.intersectObjects(this.intersectableObjects, true);
            if (intersects.length > 0) {
                // Usa o ponto de interseção como foco do zoom
                zoomTarget = intersects[0].point;
            } else {
                // Se não há interseção, projeta um ponto no plano do alvo atual
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
        
        // Calcula quanto o alvo deve se mover em direção ao ponto focal
        const zoomRatio = 1 - (clampedDistance / currentDistance);
        const targetOffset = zoomTarget.clone().sub(this.controls.target);
        const newTarget = this.controls.target.clone().add(targetOffset.multiplyScalar(zoomRatio * 0.5));
        
        // Atualiza posição da câmera mantendo a direção relativa ao novo alvo
        const direction = this.camera.position.clone().sub(newTarget).normalize();
        this.camera.position.copy(newTarget).add(direction.multiplyScalar(clampedDistance));
        
        // Atualiza o alvo dos controles
        this.controls.target.copy(newTarget);
    }

    /**
     * Ajusta os limites de zoom baseado no tamanho do modelo carregado
     * @param {THREE.Object3D} model 
     * @private
     */
    _adjustZoomLimitsForModel(model) {
        if (!this.zoomConfig.autoAdjustLimits) return;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        // Limites simples baseados no modelo
        this.zoomConfig.minDistance = maxDimension * 0.001;  // 0.1% do modelo
        this.zoomConfig.maxDistance = maxDimension * 20;     // 20x o modelo
        
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

    focusOnObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Calcula uma distância segura para visualizar todo o objeto
        const fov = this.camera.fov * (Math.PI / 180);
        let optimalDistance = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
        optimalDistance *= 1.5; // Margem de segurança
        
        // Garante que a distância está dentro dos limites
        optimalDistance = Math.max(optimalDistance, this.zoomConfig.minDistance);
        optimalDistance = Math.min(optimalDistance, this.zoomConfig.maxDistance);
        
        // Posiciona a câmera
        const direction = this.camera.position.clone().sub(center).normalize();
        if (direction.length() === 0) {
            // Se não há direção definida, usa uma direção padrão
            direction.set(0, 1, 1).normalize();
        }
        
        this.camera.position.copy(center).add(direction.multiplyScalar(optimalDistance));
        this.controls.target.copy(center);
        
        this.controls.update();
        this.logger.info('InteractionController: Câmera focada no objeto com distância otimizada.');
    }

    update() {
        this.controls.update();
        // Remove _enforceZoomLimits() - não precisa mais
    }

    /**
     * API pública para configurar zoom simples
     * @param {object} config - Configuração de zoom
     * @param {number} [config.minDistance] - Distância mínima
     * @param {number} [config.maxDistance] - Distância máxima
     * @param {number} [config.zoomFactor] - Fator de zoom (0.5 = aproxima 50%, 0.8 = aproxima 20%)
     * @param {boolean} [config.autoAdjustLimits] - Ajuste automático baseado no modelo
     */
    setZoomConfig(config) {
        this.zoomConfig = { ...this.zoomConfig, ...config };
        this.logger.info('InteractionController: Configuração de zoom atualizada.', this.zoomConfig);
    }

    /**
     * API pública para resetar a posição da câmera
     */
    resetCamera() {
        if (this.intersectableObjects.length > 0) {
            this.focusOnObject(this.intersectableObjects[0]);
        } else {
            // Posição padrão se não há objeto
            this.camera.position.set(0, 5, 10);
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
        this.logger.info('InteractionController: Câmera resetada para posição inicial.');
    }
}