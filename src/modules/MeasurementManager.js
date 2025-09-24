import * as THREE from 'three';

/**
 * @class MeasurementManager
 * @description Gerencia todas as funcionalidades de medição (distância e área) de forma modular e escalável.
 */
export class MeasurementManager {
    constructor(scene, logger, eventBus) {
        this.scene = scene;
        this.logger = logger;
        this.eventBus = eventBus;
        
        // Estado das medições
        this.currentTool = 'none';
        this.measurements = {
            distance: [],
            area: []
        };
        
        // Grupos para organizar objetos visuais na cena
        this.measurementGroup = new THREE.Group();
        this.measurementGroup.name = 'measurements';
        this.scene.add(this.measurementGroup);
        
        // Materiais reutilizáveis
        this.materials = {
            point: new THREE.MeshBasicMaterial({ color: 0xff4444 }),
            line: new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 }),
            areaPoint: new THREE.MeshBasicMaterial({ color: 0x44ff44 }),
            areaLine: new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 2 }),
            areaFill: new THREE.MeshBasicMaterial({ 
                color: 0x44ff44, 
                transparent: true, 
                opacity: 0.3, 
                side: THREE.DoubleSide 
            })
        };
        
        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('tool:changed', (payload) => this._onToolChanged(payload.activeTool));
        this.eventBus.on('measurement:point:selected', (payload) => this._onPointSelected(payload));
        this.eventBus.on('measurement:area:finish', () => this._finishAreaMeasurement());
        this.eventBus.on('measurement:clear:all', () => this.clearAllMeasurements());
    }

    _onToolChanged(activeTool) {
        this.currentTool = activeTool;
        this._updateInstructions();
        
        // Se mudou de ferramenta, finaliza medição atual se necessário
        if (this.currentTool !== 'area' && this.measurements.area.length > 0) {
            const lastArea = this.measurements.area[this.measurements.area.length - 1];
            if (!lastArea.finished) {
                this._finishAreaMeasurement();
            }
        }
        
        this.logger.info(`MeasurementManager: Ferramenta alterada para "${activeTool}".`);
    }

    _onPointSelected(payload) {
        const { point, tool } = payload;
        
        if (tool === 'measure') {
            this._handleDistanceMeasurement(point);
        } else if (tool === 'area') {
            this._handleAreaMeasurement(point);
        }
    }

    _handleDistanceMeasurement(point) {
        // Inicia nova medição de distância
        const measurement = {
            id: this._generateId(),
            type: 'distance',
            points: [point],
            visuals: {
                points: [],
                lines: []
            }
        };

        this.measurements.distance.push(measurement);
        
        // Adiciona ponto visual
        this._addPointVisual(point, 'point', measurement);
        
        this.eventBus.on('measurement:point:selected', this._handleDistanceSecondPoint.bind(this, measurement));
        
        this._updateUI();
        this.logger.info('MeasurementManager: Iniciada medição de distância.');
    }

    _handleDistanceSecondPoint(measurement, payload) {
        if (payload.tool !== 'measure' || measurement.points.length >= 2) return;
        
        const secondPoint = payload.point;
        measurement.points.push(secondPoint);
        
        // Remove o listener temporário
        this.eventBus.off('measurement:point:selected', this._handleDistanceSecondPoint);
        
        // Adiciona segundo ponto visual
        this._addPointVisual(secondPoint, 'point', measurement);
        
        // Adiciona linha conectando os pontos
        this._addLineVisual(measurement.points[0], measurement.points[1], 'line', measurement);
        
        // Calcula e armazena a distância
        measurement.distance = measurement.points[0].distanceTo(measurement.points[1]);
        measurement.finished = true;
        
        this._updateUI();
        this.eventBus.emit('measurement:distance:completed', { measurement });
        
        this.logger.info(`MeasurementManager: Medição de distância concluída: ${measurement.distance.toFixed(3)}m`);
    }

    _handleAreaMeasurement(point) {
        let currentArea = this.measurements.area.find(area => !area.finished);
        
        if (!currentArea) {
            // Inicia nova medição de área
            currentArea = {
                id: this._generateId(),
                type: 'area',
                points: [],
                visuals: {
                    points: [],
                    lines: [],
                    fill: null
                },
                finished: false
            };
            this.measurements.area.push(currentArea);
            this.logger.info('MeasurementManager: Iniciada medição de área.');
        }
        
        // Adiciona ponto à medição atual
        currentArea.points.push(point);
        this._addPointVisual(point, 'areaPoint', currentArea);
        
        // Se há mais de um ponto, conecta com linha
        if (currentArea.points.length > 1) {
            const prevPoint = currentArea.points[currentArea.points.length - 2];
            this._addLineVisual(prevPoint, point, 'areaLine', currentArea);
        }
        
        // Se há 3 ou mais pontos, calcula e mostra área
        if (currentArea.points.length >= 3) {
            this._updateAreaFill(currentArea);
        }
        
        this._updateUI();
    }

    _finishAreaMeasurement() {
        const currentArea = this.measurements.area.find(area => !area.finished);
        if (!currentArea || currentArea.points.length < 3) return;
        
        // Conecta último ponto ao primeiro para fechar o polígono
        const firstPoint = currentArea.points[0];
        const lastPoint = currentArea.points[currentArea.points.length - 1];
        this._addLineVisual(lastPoint, firstPoint, 'areaLine', currentArea);
        
        currentArea.finished = true;
        this._updateAreaFill(currentArea);
        
        this.eventBus.emit('measurement:area:completed', { measurement: currentArea });
        this.logger.info(`MeasurementManager: Medição de área concluída: ${currentArea.area?.toFixed(3)}m²`);
    }

    _addPointVisual(point, materialType, measurement) {
        const geometry = new THREE.SphereGeometry(0.05, 8, 6);
        const sphere = new THREE.Mesh(geometry, this.materials[materialType]);
        sphere.position.copy(point);
        
        this.measurementGroup.add(sphere);
        measurement.visuals.points.push(sphere);
    }

    _addLineVisual(startPoint, endPoint, materialType, measurement) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials[materialType]);
        
        this.measurementGroup.add(line);
        measurement.visuals.lines.push(line);
    }

    _updateAreaFill(areaMeasurement) {
        // Remove área anterior se existir
        if (areaMeasurement.visuals.fill) {
            this.measurementGroup.remove(areaMeasurement.visuals.fill);
            areaMeasurement.visuals.fill.geometry.dispose();
        }
        
        if (areaMeasurement.points.length < 3) return;
        
        // Calcula área usando triangulação
        areaMeasurement.area = this._calculatePolygonArea(areaMeasurement.points);
        
        // Cria geometria da área
        const shape = this._createShapeFromPoints(areaMeasurement.points);
        const geometry = new THREE.ShapeGeometry(shape);
        
        const mesh = new THREE.Mesh(geometry, this.materials.areaFill);
        mesh.rotation.x = -Math.PI / 2; // Alinha com o plano XZ
        
        this.measurementGroup.add(mesh);
        areaMeasurement.visuals.fill = mesh;
    }

    _createShapeFromPoints(points3D) {
        // Projeta pontos 3D para 2D (assumindo plano XZ)
        const points2D = points3D.map(p => new THREE.Vector2(p.x, p.z));
        return new THREE.Shape(points2D);
    }

    _calculatePolygonArea(points) {
        if (points.length < 3) return 0;
        
        // Usa fórmula do shoelace para calcular área do polígono
        let area = 0;
        const n = points.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].z;
            area -= points[j].x * points[i].z;
        }
        
        return Math.abs(area) / 2;
    }

    _updateInstructions() {
        const instructions = {
            'none': '',
            'measure': 'Clique em dois pontos no modelo para medir a distância entre eles.',
            'area': 'Clique em múltiplos pontos para definir uma área. Pressione ESC para finalizar.'
        };
        
        this.eventBus.emit('ui:instructions:update', {
            text: instructions[this.currentTool] || ''
        });
    }

    _updateUI() {
        // Calcula estatísticas das medições
        const stats = {
            distances: this.measurements.distance
                .filter(m => m.finished)
                .map(m => ({ id: m.id, value: m.distance })),
            areas: this.measurements.area
                .filter(m => m.finished)
                .map(m => ({ id: m.id, value: m.area }))
        };
        
        this.eventBus.emit('ui:measurements:update', stats);
    }

    clearAllMeasurements() {
        // Remove todos os objetos visuais da cena
        this.measurementGroup.clear();
        
        // Limpa arrays de medições
        this.measurements.distance = [];
        this.measurements.area = [];
        
        this._updateUI();
        this.logger.info('MeasurementManager: Todas as medições foram removidas.');
    }

    clearMeasurement(id) {
        // Remove medição específica
        ['distance', 'area'].forEach(type => {
            const index = this.measurements[type].findIndex(m => m.id === id);
            if (index !== -1) {
                const measurement = this.measurements[type][index];
                
                // Remove objetos visuais da cena
                [...measurement.visuals.points, ...measurement.visuals.lines].forEach(obj => {
                    this.measurementGroup.remove(obj);
                    obj.geometry.dispose();
                });
                
                if (measurement.visuals.fill) {
                    this.measurementGroup.remove(measurement.visuals.fill);
                    measurement.visuals.fill.geometry.dispose();
                }
                
                this.measurements[type].splice(index, 1);
                this.logger.info(`MeasurementManager: Medição ${id} removida.`);
            }
        });
        
        this._updateUI();
    }

    _generateId() {
        return `measurement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // API pública para obter medições
    getAllMeasurements() {
        return {
            distances: [...this.measurements.distance],
            areas: [...this.measurements.area]
        };
    }

    getMeasurementById(id) {
        const allMeasurements = [
            ...this.measurements.distance,
            ...this.measurements.area
        ];
        return allMeasurements.find(m => m.id === id);
    }
}