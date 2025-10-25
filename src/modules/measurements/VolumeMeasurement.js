import * as THREE from 'three';
import { BaseMeasurement } from './common/BaseMeasurement.js';
import { VolumeCalculator } from './utils/VolumeCalculator.js';
import { createTextSprite } from '../../utils/DrawingUtils.js';

export class VolumeMeasurement extends BaseMeasurement {
    constructor(measurementGroup, materials, logger, eventBus) {
        super(measurementGroup, materials, logger, eventBus, 'volume'); // <-- Nome da ferramenta
        this.measurementGroup = measurementGroup;
        this.calculator = new VolumeCalculator(logger); // <-- Usa o novo Calculator

        // Ouve o evento para finalizar o polígono
        this.eventBus.on('measurement:area:finish', () => {
            if (this.activeMeasurement && this.toolName === this.activeMeasurement.type) {
                this._finishMeasurement();
            }
        });
    }

    /**
     * @private
     */
    _handlePointSelected(point) {
        if (!this.activeMeasurement) {
            this._startMeasurement();
        }
        
        this.activeMeasurement.points.push(point);
        
        // Adiciona o visual do ponto com o material correto
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const sphere = new THREE.Mesh(geometry, this.materials.volumePoint); // <-- Material
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.measurementGroup.add(sphere);
        this.activeMeasurement.visuals.points.push(sphere);

        const points = this.activeMeasurement.points;
        if (points.length > 1) {
            this._addLineVisual(points[points.length - 2], points[points.length - 1]);
        }
        if (points.length >= 2) {
            this._updatePreviewLine();
        }
    }

    /**
     * @private
     */
    _addLineVisual(startPoint, endPoint) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials.volumeLine); // <-- Material
        line.renderOrder = 998;
        this.measurementGroup.add(line);
        this.activeMeasurement.visuals.lines.push(line);
    }

    /**
     * @private
     */
    _updatePreviewLine() {
        if (this.activeMeasurement.visuals.previewLine) {
            this.measurementGroup.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
        }

        const firstPoint = this.activeMeasurement.points[0];
        const lastPoint = this.activeMeasurement.points[this.activeMeasurement.points.length - 1];

        const geometry = new THREE.BufferGeometry().setFromPoints([lastPoint, firstPoint]);
        const line = new THREE.Line(geometry, this.materials.previewLine);
        line.computeLineDistances();
        this.measurementGroup.add(line);
        this.activeMeasurement.visuals.previewLine = line;
    }

    /**
     * @private
     */
    _findActiveModel() {
        // (Este método é copiado de SurfaceAreaMeasurement - pode ser refatorado para um Base)
        const EXCLUDE_NAMES = ['measurements', 'remote-annotations', 'GridHelper'];
        const EXCLUDE_TYPES = ['AmbientLight', 'DirectionalLight', 'PerspectiveCamera', 'Line', 'LineSegments', 'Points', 'Sprite'];
        
        let activeModel = null;
        let largestMesh = null;
        let maxVertices = 0;

        const scene = this.measurementGroup.parent;
        if (!scene) {
            this.logger.error("VolumeMeasurement: Não foi possível acessar a cena");
            return null;
        }

        scene.traverse((child) => {
            if (EXCLUDE_TYPES.includes(child.type) || EXCLUDE_NAMES.includes(child.name)) return;
            
            if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                const vertexCount = child.geometry.attributes.position.count;
                if (vertexCount > maxVertices) {
                    maxVertices = vertexCount;
                    largestMesh = child;
                }
                if (vertexCount > 100 && child.parent === scene) {
                    activeModel = child;
                }
            }
            
            if (child.isGroup && child.children.some(c => c.isMesh) && child.parent === scene) {
                activeModel = child;
            }
        });

        if (!activeModel && largestMesh) {
            activeModel = largestMesh;
        }

        return activeModel;
    }

    /**
     * @private
     */
    _finishMeasurement() {
        if (!this.activeMeasurement || this.activeMeasurement.points.length < 3) {
            this.logger.warn(`${this.constructor.name}: Não pode finalizar, requer pelo menos 3 pontos.`);
            if (this.activeMeasurement) {
                this.cancelActiveMeasurement();
            }
            return;
        }

        // Remove linha de preview
        if (this.activeMeasurement.visuals.previewLine) {
            this.measurementGroup.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
            this.activeMeasurement.visuals.previewLine = null;
        }

        // Adiciona linha de fechamento
        const points = this.activeMeasurement.points;
        this._addLineVisual(points[points.length - 1], points[0]);

        // Encontra o modelo
        const activeModel = this._findActiveModel();
        
        if (!activeModel) {
            this.logger.error("VolumeMeasurement: Nenhum modelo carregado para calcular o volume.");
            this.activeMeasurement.value = 0;
            this.activeMeasurement.finished = true;
            this.eventBus.emit('measurement:volume:completed', { 
                measurement: this.activeMeasurement,
            });
            this.activeMeasurement = null;
            return;
        }

        // Calcula o volume
        const result = this.calculator.calculateVolume(activeModel, points); // <-- Chama calculateVolume
        
        this.activeMeasurement.value = result.volume; // <-- Salva o volume
        this.activeMeasurement.finished = true;

        // Adiciona destaque visual
        if (result.highlightedGeometry) { 
            const mesh = new THREE.Mesh(result.highlightedGeometry, this.materials.volumeHighlight); // <-- Material
            mesh.renderOrder = 996;
            this.measurementGroup.add(mesh);
            this.activeMeasurement.visuals.fill = mesh;
        }

        // Adiciona o rótulo de volume
        this._addAreaLabel(points, result.volume);

        this.logger.info(`VolumeMeasurement: Concluído - ${result.volume.toFixed(2)}m³ (método: ${result.method})`);
        
        this.eventBus.emit('measurement:volume:completed', { // <-- Evento
            measurement: this.activeMeasurement,
            method: result.method
        });
        
        this.activeMeasurement = null;
    }

    /**
     * @private
     */
    _addAreaLabel(points, volume) {
        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        center.add(new THREE.Vector3(0, 0.2, 0));
            
        const labelText = `${volume.toFixed(2)}m³`; // <-- Label m³
            
        const label = createTextSprite(labelText, '#ff00ff'); // <-- Cor
        label.position.copy(center);
        this.measurementGroup.add(label);
        this.activeMeasurement.visuals.labels.push(label);
    }

    /**
     * @private
     */
    _startMeasurement() {
        this.activeMeasurement = {
            id: this._generateId(),
            type: this.toolName,
            points: [],
            visuals: { points: [], lines: [], fill: null, previewLine: null, labels: [] },
            finished: false
        };
        this.measurements.push(this.activeMeasurement);
        this.logger.info(`${this.constructor.name}: Iniciada nova medição.`);
    }

    _generateId() {
        return `${this.toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}