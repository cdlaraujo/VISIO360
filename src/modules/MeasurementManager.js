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
        
        // Track active handler to clean it up properly
        this.activeDistanceHandler = null;
        
        // Grupos para organizar objetos visuais na cena
        this.measurementGroup = new THREE.Group();
        this.measurementGroup.name = 'measurements';
        this.scene.add(this.measurementGroup);
        
        // Materiais reutilizáveis - MELHORADOS PARA MELHOR VISIBILIDADE
        this.materials = {
            point: new THREE.MeshBasicMaterial({ 
                color: 0xff0000,
                depthTest: false,  // Always visible on top
                depthWrite: false
            }),
            line: new THREE.LineBasicMaterial({ 
                color: 0xff0000,
                linewidth: 3,
                depthTest: false,  // Always visible on top
                depthWrite: false
            }),
            areaPoint: new THREE.MeshBasicMaterial({ 
                color: 0x00ff00,
                depthTest: false,
                depthWrite: false
            }),
            areaLine: new THREE.LineBasicMaterial({ 
                color: 0x00ff00,
                linewidth: 3,
                depthTest: false,
                depthWrite: false
            }),
            areaFill: new THREE.MeshBasicMaterial({ 
                color: 0x00ff00,
                transparent: true, 
                opacity: 0.4,
                side: THREE.DoubleSide,
                depthTest: true  // Fill respects depth
            }),
            previewLine: new THREE.LineDashedMaterial({
                color: 0x00ff00,
                linewidth: 2,
                dashSize: 0.1,
                gapSize: 0.05,
                depthTest: false,
                depthWrite: false,
                transparent: true,
                opacity: 0.7
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
        // CRITICAL: Clean up any pending distance measurement handler
        this._cleanupActiveDistanceHandler();
        
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

    _cleanupActiveDistanceHandler() {
        if (this.activeDistanceHandler) {
            this.eventBus.off('measurement:point:selected', this.activeDistanceHandler);
            this.activeDistanceHandler = null;
            this.logger.debug('MeasurementManager: Limpou handler de distância pendente.');
        }
    }

    _handleDistanceMeasurement(point) {
        // CRITICAL: Clean up any previous incomplete measurement
        this._cleanupActiveDistanceHandler();
        
        // Inicia nova medição de distância
        const measurement = {
            id: this._generateId(),
            type: 'distance',
            points: [point],
            visuals: {
                points: [],
                lines: [],
                labels: []
            }
        };

        this.measurements.distance.push(measurement);
        
        // Adiciona ponto visual MAIOR
        this._addPointVisual(point, 'point', measurement);
        
        // Create handler for the second point
        const secondPointHandler = (payload) => {
            // Check if we should process this click
            if (payload.tool !== 'measure') {
                return; // Wrong tool, ignore but keep listening
            }
            
            if (measurement.points.length >= 2) {
                return; // Already complete, ignore
            }
            
            const secondPoint = payload.point;
            measurement.points.push(secondPoint);
            
            // Clean up the handler now that we're done
            this._cleanupActiveDistanceHandler();
            
            // Adiciona segundo ponto visual
            this._addPointVisual(secondPoint, 'point', measurement);
            
            // Adiciona linha conectando os pontos - MAIS GROSSA
            this._addLineVisual(measurement.points[0], measurement.points[1], 'line', measurement);
            
            // Calcula e armazena a distância
            measurement.distance = measurement.points[0].distanceTo(measurement.points[1]);
            measurement.finished = true;
            
            // Adiciona label de texto 3D com a distância
            this._addDistanceLabel(measurement);
            
            this._updateUI();
            this.eventBus.emit('measurement:distance:completed', { measurement });
            
            this.logger.info(`MeasurementManager: Medição de distância concluída: ${measurement.distance.toFixed(3)}m`);
        };
        
        // Store the handler so we can clean it up later
        this.activeDistanceHandler = secondPointHandler;
        
        // Register the handler
        this.eventBus.on('measurement:point:selected', secondPointHandler);
        
        this._updateUI();
        this.logger.info('MeasurementManager: Iniciada medição de distância.');
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
                    fill: null,
                    previewLine: null,
                    labels: []
                },
                finished: false
            };
            this.measurements.area.push(currentArea);
            this.logger.info('MeasurementManager: Iniciada medição de área. Duplo-clique para finalizar.');
        }
        
        // Adiciona ponto à medição atual
        currentArea.points.push(point);
        this._addPointVisual(point, 'areaPoint', currentArea);
        
        // Se há mais de um ponto, conecta com linha
        if (currentArea.points.length > 1) {
            const prevPoint = currentArea.points[currentArea.points.length - 2];
            this._addLineVisual(prevPoint, point, 'areaLine', currentArea);
        }
        
        // Se há 2 ou mais pontos, mostra linha de preview para o primeiro ponto
        if (currentArea.points.length >= 2) {
            this._updateAreaPreview(currentArea);
        }
        
        // Se há 3 ou mais pontos, calcula e mostra área
        if (currentArea.points.length >= 3) {
            this._updateAreaFill(currentArea);
        }
        
        this._updateUI();
    }

    _finishAreaMeasurement() {
        this.logger.info('MeasurementManager: _finishAreaMeasurement chamado');
        
        const currentArea = this.measurements.area.find(area => !area.finished);
        
        if (!currentArea) {
            this.logger.warn('MeasurementManager: Nenhuma área em progresso encontrada.');
            return;
        }
        
        this.logger.info(`MeasurementManager: Área tem ${currentArea.points.length} pontos`);
        
        if (currentArea.points.length < 3) {
            this.logger.warn('MeasurementManager: Pontos insuficientes (mínimo 3).');
            return;
        }
        
        // Remove preview line
        if (currentArea.visuals.previewLine) {
            this.measurementGroup.remove(currentArea.visuals.previewLine);
            currentArea.visuals.previewLine.geometry.dispose();
            currentArea.visuals.previewLine = null;
            this.logger.debug('MeasurementManager: Preview line removida');
        }
        
        // Conecta último ponto ao primeiro para fechar o polígono
        const firstPoint = currentArea.points[0];
        const lastPoint = currentArea.points[currentArea.points.length - 1];
        this._addLineVisual(lastPoint, firstPoint, 'areaLine', currentArea);
        this.logger.debug('MeasurementManager: Linha de fechamento adicionada');
        
        currentArea.finished = true;
        this._updateAreaFill(currentArea);
        this.logger.debug('MeasurementManager: Área preenchida atualizada');
        
        // Adiciona label com a área
        this._addAreaLabel(currentArea);
        this.logger.info(`MeasurementManager: Label adicionada: ${currentArea.area?.toFixed(3)}m²`);
        
        this._updateUI();
        this.eventBus.emit('measurement:area:completed', { measurement: currentArea });
        this.logger.info(`MeasurementManager: Medição de área concluída: ${currentArea.area?.toFixed(3)}m²`);
    }

    _updateAreaPreview(areaMeasurement) {
        // Remove preview anterior
        if (areaMeasurement.visuals.previewLine) {
            this.measurementGroup.remove(areaMeasurement.visuals.previewLine);
            areaMeasurement.visuals.previewLine.geometry.dispose();
        }
        
        // Cria linha tracejada do último ponto até o primeiro
        const firstPoint = areaMeasurement.points[0];
        const lastPoint = areaMeasurement.points[areaMeasurement.points.length - 1];
        
        const geometry = new THREE.BufferGeometry().setFromPoints([lastPoint, firstPoint]);
        const line = new THREE.Line(geometry, this.materials.previewLine);
        line.computeLineDistances(); // Necessário para linhas tracejadas
        
        this.measurementGroup.add(line);
        areaMeasurement.visuals.previewLine = line;
    }

    _addPointVisual(point, materialType, measurement) {
        // Pontos MAIORES e mais visíveis
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const sphere = new THREE.Mesh(geometry, this.materials[materialType]);
        sphere.position.copy(point);
        sphere.renderOrder = 999; // Renderiza por último (sempre visível)
        
        this.measurementGroup.add(sphere);
        measurement.visuals.points.push(sphere);
    }

    _addLineVisual(startPoint, endPoint, materialType, measurement) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials[materialType]);
        line.renderOrder = 998; // Alta prioridade de renderização
        
        this.measurementGroup.add(line);
        measurement.visuals.lines.push(line);
    }

    _addDistanceLabel(measurement) {
        const midPoint = new THREE.Vector3()
            .addVectors(measurement.points[0], measurement.points[1])
            .multiplyScalar(0.5);
        
        const text = `${measurement.distance.toFixed(2)}m`;
        const label = this._createTextSprite(text, '#ff0000');
        label.position.copy(midPoint);
        
        this.measurementGroup.add(label);
        measurement.visuals.labels.push(label);
    }

    _addAreaLabel(measurement) {
        // Calcula centro do polígono
        const center = new THREE.Vector3();
        measurement.points.forEach(p => center.add(p));
        center.divideScalar(measurement.points.length);
        
        const text = `${measurement.area.toFixed(2)}m²`;
        const label = this._createTextSprite(text, '#00ff00');
        label.position.copy(center);
        label.position.y += 0.1; // Levanta um pouco
        
        this.measurementGroup.add(label);
        measurement.visuals.labels.push(label);
    }

    _createTextSprite(text, color) {
        // Cria canvas para o texto
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Desenha fundo semi-transparente
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Desenha texto
        context.font = 'Bold 64px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Cria textura e sprite
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1, 0.25, 1);
        sprite.renderOrder = 1000; // Sempre no topo
        
        return sprite;
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
        mesh.renderOrder = 1; // Renderiza primeiro (atrás dos pontos/linhas)
        
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
            'area': 'Clique em pontos para definir uma área. Duplo-clique ou pressione ESC para finalizar.'
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
        // Clean up any pending handlers
        this._cleanupActiveDistanceHandler();
        
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
                    if (obj.geometry) obj.geometry.dispose();
                });
                
                if (measurement.visuals.labels) {
                    measurement.visuals.labels.forEach(label => {
                        this.measurementGroup.remove(label);
                        if (label.material.map) label.material.map.dispose();
                        label.material.dispose();
                    });
                }
                
                if (measurement.visuals.fill) {
                    this.measurementGroup.remove(measurement.visuals.fill);
                    measurement.visuals.fill.geometry.dispose();
                }
                
                if (measurement.visuals.previewLine) {
                    this.measurementGroup.remove(measurement.visuals.previewLine);
                    measurement.visuals.previewLine.geometry.dispose();
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