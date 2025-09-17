// src/modules/InteractionController.js
import * as THREE from 'three';
import Logger from '../utils/Logger.js';

const DRAG_THRESHOLD = 5;

export class InteractionController {
    constructor({ state, eventBus, domElement }) {
        this.state = state;
        this.eventBus = eventBus;
        this.domElement = domElement;
        this.origin = { module: 'InteractionController', function: 'constructor' };

        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.dragStartState = { x: 0, y: 0 };

        this._bindListeners();
        Logger.info(this.origin, 'InteractionController initialized.');
    }

    _bindListeners() {
        this.domElement.addEventListener('mousedown', this._onMouseDown.bind(this));
        this.domElement.addEventListener('mousemove', this._onMouseMove.bind(this));
        this.domElement.addEventListener('mouseup', this._onMouseUp.bind(this));
        this.domElement.addEventListener('dblclick', this._onDblClick.bind(this));
    }

    _updateMouse(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    _onMouseDown(e) {
        const { targetModel, activeTool } = this.state.get();
        if (!targetModel || e.button !== 0) return;

        this.state.set({ interactionState: 'PENDING' });
        this.dragStartState = { x: e.clientX, y: e.clientY };

        this._updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.state.get().camera);

        // A lógica de intersecção com o Gizmo será tratada pelo GizmoManager
        // que também ouvirá o evento mousedown.
        this.eventBus.emit('interaction:mousedown', { event: e, raycaster: this.raycaster });
    }

    _onMouseMove(e) {
        if (this.state.get().interactionState === 'PENDING') {
            const dx = Math.abs(e.clientX - this.dragStartState.x);
            const dy = Math.abs(e.clientY - this.dragStartState.y);
            
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                this.state.set({ interactionState: 'PANNING' });
                this.eventBus.emit('interaction:panning_started');
            }
        }
    }

    _onMouseUp(e) {
        const currentState = this.state.get();
        if (e.button !== 0 || !currentState.targetModel) return;

        if (currentState.interactionState === 'PENDING') {
            this._updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, currentState.camera);
            const intersects = this.raycaster.intersectObject(currentState.targetModel, true);

            if (intersects.length > 0) {
                const clickPoint = intersects[0].point;
                const face = intersects[0].face;
                Logger.debug(this.origin, 'Click on model detected.', { point: clickPoint });
                // Emite um evento com o ponto de clique, o resto da aplicação decide o que fazer.
                this.eventBus.emit('interaction:click_on_model', { point: clickPoint, face: face, event: e });
            }
        }
        
        this.state.set({ interactionState: 'NONE' });
        this.eventBus.emit('interaction:mouseup');
    }

    _onDblClick(e) {
        // Lógica de double click para centralizar a câmera, se desejado.
    }
}
