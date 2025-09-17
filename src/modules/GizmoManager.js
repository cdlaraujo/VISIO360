// src/modules/GizmoManager.js
import * as THREE from 'three';
import Logger from '../utils/Logger.js';

export class GizmoManager {
    constructor({ state, eventBus, sceneManager }) {
        this.state = state;
        this.eventBus = eventBus;
        this.sceneManager = sceneManager;
        this.origin = { module: 'GizmoManager', function: 'constructor' };

        this.controlGroup = null;
        this.orbitRing = null;

        this.subscribeToEvents();
        Logger.info(this.origin, 'GizmoManager initialized.');
    }

    subscribeToEvents() {
        this.eventBus.on('interaction:click_on_model', ({ point }) => {
            // Só cria o gizmo se nenhuma ferramenta estiver ativa
            if (!this.state.get().activeTool) {
                this.createGizmo(point);
                this.eventBus.emit('status:update', { message: 'Focus point set. Drag the blue ring to orbit.' });
            }
        });

        // Remove gizmo se começar a usar uma ferramenta ou carregar novo modelo
        this.eventBus.on('tool:mode_changed', () => this.removeGizmo());
        this.eventBus.on('model:loaded', () => this.removeGizmo());
    }

    createGizmo(point) {
        this.removeGizmo(); // Garante que só um exista

        const { camera } = this.state.get();
        const distance = camera.position.distanceTo(point);
        const gizmoSize = Math.max(0.01, distance / 75);

        this.controlGroup = new THREE.Group();
        this.controlGroup.position.copy(point);

        const pointGeo = new THREE.SphereGeometry(gizmoSize * 0.1, 16, 16);
        const pointMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
        const targetPoint = new THREE.Mesh(pointGeo, pointMat);

        const ringGeo = new THREE.TorusGeometry(gizmoSize, gizmoSize * 0.075, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x007bff, side: THREE.DoubleSide });
        this.orbitRing = new THREE.Mesh(ringGeo, ringMat);
        this.orbitRing.rotation.x = Math.PI / 2;
        this.orbitRing.userData.isOrbitRing = true; // Para identificação no raycast

        this.controlGroup.add(targetPoint);
        this.controlGroup.add(this.orbitRing);
        
        this.sceneManager.scene.add(this.controlGroup);

        this.eventBus.emit('controls:set_target', { target: point });
    }

    removeGizmo() {
        if (this.controlGroup) {
            this.sceneManager.scene.remove(this.controlGroup);
            // Lógica de dispose para geometrias e materiais se necessário
            this.controlGroup = null;
            this.orbitRing = null;
        }
    }
}
