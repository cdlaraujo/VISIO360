import * as THREE from 'three';

/**
 * @class MeasurementTools
 * @description Gerencia a lógica e visualização das ferramentas de medição (distância e área).
 * Ouve eventos de interação e de mudança de ferramenta para gerenciar seu estado.
 */
export class MeasurementTools {
    constructor(logger, eventBus, scene) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.scene = scene;
        this.currentTool = 'none';
        this.points = [];
        this.lineMesh = null;
        this.lineMaterial = null;
        this.pointMeshes = [];
        this.areaMesh = null;
        this.infoDistanceEl = document.getElementById('distance-info');
        this.infoAreaEl = document.getElementById('area-info');
        this.instructionsEl = document.getElementById('tool-instructions');

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('tool:changed', (payload) => this.onToolChanged(payload.activeTool));
        this.eventBus.on('interaction:click', (payload) => this.onInteractionClick(payload.point));
    }

    onToolChanged(toolName) {
        this.currentTool = toolName;
        this.resetState();
        this._updateInstructions();
    }

    onInteractionClick(point) {
        if (this.currentTool === 'measure') {
            this.handleMeasureTool(point);
        } else if (this.currentTool === 'area') {
            this.handleAreaTool(point);
        }
    }

    _updateInstructions() {
        switch (this.currentTool) {
            case 'measure':
                this.instructionsEl.textContent = 'Clique em dois pontos para medir a distância.';
                break;
            case 'area':
                this.instructionsEl.textContent = 'Clique em 3 ou mais pontos para medir a área. Pressione ESC para finalizar.';
                break;
            default:
                this.instructionsEl.textContent = '';
                break;
        }
    }

    resetState() {
        this.points = [];
        this.clearVisuals();
        if (this.infoDistanceEl) this.infoDistanceEl.style.display = 'none';
        if (this.infoAreaEl) this.infoAreaEl.style.display = 'none';
        this.logger.info(`MeasurementTools: Estado redefinido para a ferramenta "${this.currentTool}".`);
    }

    clearVisuals() {
        if (this.lineMesh) {
            this.scene.remove(this.lineMesh);
            this.lineMesh.geometry.dispose();
            this.lineMesh = null;
        }
        if (this.areaMesh) {
            this.scene.remove(this.areaMesh);
            this.areaMesh.geometry.dispose();
            this.areaMesh = null;
        }
        this.pointMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });
        this.pointMeshes = [];
    }

    handleMeasureTool(point) {
        this.points.push(point);
        this._addPointVisual(point, 0xff0000);

        if (this.points.length === 2) {
            const distance = this.points[0].distanceTo(this.points[1]);
            if (this.infoDistanceEl) {
                this.infoDistanceEl.textContent = `Distância: ${distance.toFixed(2)}m`;
                this.infoDistanceEl.style.display = 'block';
            }
            this.drawLine(this.points[0], this.points[1], 0xff0000);
            this.logger.info(`MeasurementTools: Medição de distância concluída: ${distance.toFixed(2)}m.`);
            this.points = []; // Prepara para a próxima medição
        }
    }

    handleAreaTool(point) {
        this.points.push(point);
        this._addPointVisual(point, 0x00ff00);

        if (this.points.length >= 2) {
            // Desenha a linha temporária para a pré-visualização
            this.drawTempLine(this.points);
        }

        if (this.points.length >= 3) {
            this._calculateAndDrawArea(this.points);
        }
    }

    _calculateAndDrawArea(points) {
        const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, p.z)));
        const area = shape.area();
        if (this.infoAreaEl) {
            this.infoAreaEl.textContent = `Área: ${area.toFixed(2)}m²`;
            this.infoAreaEl.style.display = 'block';
        }
        
        this.drawArea(points, 0x00ff00);
        this.logger.info(`MeasurementTools: Área calculada: ${area.toFixed(2)}m².`);
    }

    _addPointVisual(point, color) {
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(point);
        this.scene.add(sphere);
        this.pointMeshes.push(sphere);
    }
    
    drawLine(startPoint, endPoint, color) {
        const material = new THREE.LineBasicMaterial({ color: color });
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        this.lineMesh = line;
    }

    drawTempLine(points) {
        if (this.lineMesh) {
            this.scene.remove(this.lineMesh);
            this.lineMesh.geometry.dispose();
        }

        const material = new THREE.LineBasicMaterial({ color: 0xcccccc, dashed: true, transparent: true, opacity: 0.5 });
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.lineMesh = new THREE.Line(geometry, material);
        this.scene.add(this.lineMesh);
    }
    
    drawArea(points, color) {
        if (this.areaMesh) {
            this.scene.remove(this.areaMesh);
            this.areaMesh.geometry.dispose();
        }
        const shapePoints = points.map(p => new THREE.Vector2(p.x, p.z));
        const shape = new THREE.Shape(shapePoints);
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.2 });
        this.areaMesh = new THREE.Mesh(geometry, material);
        this.areaMesh.rotation.x = Math.PI / 2; // Gira para alinhar ao plano
        this.scene.add(this.areaMesh);
    }
}