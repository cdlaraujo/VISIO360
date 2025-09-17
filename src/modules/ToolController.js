// src/modules/ToolController.js
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import Logger from '../utils/Logger.js';

export class ToolController {
    constructor({ state, eventBus, sceneManager }) {
        this.state = state;
        this.eventBus = eventBus;
        this.sceneManager = sceneManager; // Para criar/remover objetos da cena
        this.origin = { module: 'ToolController', function: 'constructor' };

        this.tempVisuals = new THREE.Group();
        this.sceneManager.scene.add(this.tempVisuals);

        this.subscribeToEvents();
        Logger.info(this.origin, 'ToolController initialized.');
    }

    subscribeToEvents() {
        this.eventBus.on('tool:mode_changed', ({ mode }) => {
            this.state.set({ activeTool: mode });
            this._clearCurrentPoints();
            this._updateStatusMessage(mode);
        });

        this.eventBus.on('interaction:click_on_model', ({ point, event }) => {
            const { activeTool } = this.state.get();
            if (!activeTool) return;
            
            switch (activeTool) {
                case 'distance': this._handleDistance(point); break;
                case 'area': this._handleArea(point); break;
                // etc.
            }
        });

        // Limpa as ferramentas se um novo modelo for carregado
        this.eventBus.on('model:loaded', () => this.state.set({ activeTool: null }));
    }

    _updateStatusMessage(mode) {
        let message = 'Ready.';
        switch(mode) {
            case 'distance': message = 'Distance Mode: Click two points to measure.'; break;
            case 'area': message = 'Area Mode: Click points to define area. Double-click to finish.'; break;
            // etc.
        }
        this.eventBus.emit('status:update', { message });
    }
    
    _clearCurrentPoints() {
        this.state.get().currentPoints.forEach(p => this.tempVisuals.remove(p.marker));
        this.state.set({ currentPoints: [] });
    }

    // --- Lógica da Ferramenta de Distância ---
    _handleDistance(point) {
        const { currentPoints } = this.state.get();
        const marker = this._createMarker(point);
        this.tempVisuals.add(marker);
        
        const newPoints = [...currentPoints, { position: point.clone(), marker }];
        this.state.set({ currentPoints: newPoints });

        if (newPoints.length === 2) {
            const [p1, p2] = newPoints;
            const distance = p1.position.distanceTo(p2.position);
            
            const line = this._createLine(p1.position, p2.position);
            const midpoint = new THREE.Vector3().addVectors(p1.position, p2.position).multiplyScalar(0.5);
            const label = this._createLabel(`${distance.toFixed(2)} units`, midpoint);
            
            const measurementGroup = new THREE.Group();
            measurementGroup.add(p1.marker, p2.marker, line, label);
            measurementGroup.userData = { type: 'distance', value: distance };
            
            // Adiciona medição final à cena principal e limpa temporários
            this.sceneManager.scene.add(measurementGroup);
            this.state.set({ 
                allMeasurements: [...this.state.get().allMeasurements, measurementGroup],
                currentPoints: [] 
            });
            this.tempVisuals.remove(p1.marker, p2.marker);

            this.eventBus.emit('status:update', { message: `Distance: ${distance.toFixed(2)}. Click to start new measurement.`});
        } else {
            this.eventBus.emit('status:update', { message: 'Click the second point.' });
        }
    }
    
    // --- Lógica da Ferramenta de Área (simplificada) ---
    _handleArea(point) {
        // ... implementação similar ...
    }

    // --- Funções de Ajuda para Criação de Visuais ---
    _createMarker(position) {
        const distance = this.state.get().camera.position.distanceTo(position);
        const markerSize = Math.max(0.005, distance / 500);
        const markerGeo = new THREE.SphereGeometry(markerSize, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.copy(position);
        return marker;
    }

    _createLine(start, end) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
        return new THREE.Line(lineGeo, lineMat);
    }
    
    _createLabel(text, position) {
        const div = document.createElement('div');
        div.className = 'measurement-label';
        div.textContent = text;
        const label = new CSS2DObject(div);
        label.position.copy(position);
        return label;
    }
}
