import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * @class MeasurementManager
 * @description Gerencia todas as funcionalidades de medição (distância, área plana e área de superfície).
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
            area: [],
            surfaceArea: []
        };
        this.activeModel = null;

        // Track active handler to clean it up properly
        this.activeDistanceHandler = null;

        // Grupos para organizar objetos visuais na cena
        this.measurementGroup = new THREE.Group();
        this.measurementGroup.name = 'measurements';
        this.scene.add(this.measurementGroup);

        // Materiais reutilizáveis
        this.materials = {
            point: new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, depthWrite: false }),
            line: new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3, depthTest: false, depthWrite: false }),
            areaPoint: new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, depthWrite: false }),
            areaLine: new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3, depthTest: false, depthWrite: false }),
            areaFill: new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthTest: false }),
            surfaceAreaPoint: new THREE.MeshBasicMaterial({ color: 0x00aaff, depthTest: false, depthWrite: false }),
            surfaceAreaLine: new THREE.LineBasicMaterial({ color: 0x00aaff, linewidth: 3, depthTest: false, depthWrite: false }),
            previewLine: new THREE.LineDashedMaterial({ color: 0xffff00, linewidth: 2, dashSize: 0.1, gapSize: 0.05, depthTest: false, depthWrite: false, transparent: true, opacity: 0.8 }),
            highlightedFaces: new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
        };

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('tool:changed', (payload) => this._onToolChanged(payload.activeTool));
        this.eventBus.on('model:loaded', (payload) => { this.activeModel = payload.model; });
        this.eventBus.on('measurement:point:selected', (payload) => this._onPointSelected(payload));
        this.eventBus.on('measurement:area:finish', () => this._finishAreaMeasurement());
        this.eventBus.on('measurement:clear:all', () => this.clearAllMeasurements());
        this.eventBus.on('measurement:delete', (payload) => this.clearMeasurement(payload.id));
    }

    _onToolChanged(activeTool) {
        this._cleanupActiveDistanceHandler();
        this.currentTool = activeTool;
        this._updateInstructions();

        const areaTools = ['area', 'surfaceArea'];
        if (!areaTools.includes(this.currentTool)) {
            const lastArea = [...this.measurements.area, ...this.measurements.surfaceArea].find(a => !a.finished);
            if (lastArea) {
                this._finishAreaMeasurement();
            }
        }
        this.logger.info(`MeasurementManager: Ferramenta alterada para "${activeTool}".`);
    }

    _onPointSelected(payload) {
        const { point, tool } = payload;
        if (tool === 'measure') {
            this._handleDistanceMeasurement(point);
        } else if (tool === 'area' || tool === 'surfaceArea') {
            this._handleAreaMeasurement(point, tool);
        }
    }

    _cleanupActiveDistanceHandler() {
        if (this.activeDistanceHandler) {
            this.eventBus.off('measurement:point:selected', this.activeDistanceHandler);
            this.activeDistanceHandler = null;
        }
    }

    _handleDistanceMeasurement(point) {
        this._cleanupActiveDistanceHandler();
        const measurement = {
            id: this._generateId(), type: 'distance', points: [point], visuals: { points: [], lines: [], labels: [] }
        };
        this.measurements.distance.push(measurement);
        this._addPointVisual(point, 'point', measurement);

        const secondPointHandler = (payload) => {
            if (payload.tool !== 'measure' || measurement.points.length >= 2) return;
            const secondPoint = payload.point;
            measurement.points.push(secondPoint);
            this._cleanupActiveDistanceHandler();
            this._addPointVisual(secondPoint, 'point', measurement);
            this._addLineVisual(measurement.points[0], measurement.points[1], 'line', measurement);
            measurement.distance = measurement.points[0].distanceTo(measurement.points[1]);
            measurement.finished = true;
            this._addDistanceLabel(measurement);
            this._updateUI();
            this.eventBus.emit('measurement:distance:completed', { measurement });
        };
        this.activeDistanceHandler = secondPointHandler;
        this.eventBus.on('measurement:point:selected', secondPointHandler);
        this._updateUI();
    }

    _handleAreaMeasurement(point, tool) {
        let currentArea = [...this.measurements.area, ...this.measurements.surfaceArea].find(area => !area.finished);
        if (!currentArea) {
            currentArea = {
                id: this._generateId(), type: tool, points: [],
                visuals: { points: [], lines: [], fill: null, previewLine: null, labels: [] },
                finished: false
            };
            this.measurements[tool].push(currentArea);
            this.logger.info(`MeasurementManager: Iniciada medição de ${tool}.`);
        }

        currentArea.points.push(point);
        const materialType = tool === 'area' ? 'areaPoint' : 'surfaceAreaPoint';
        this._addPointVisual(point, materialType, currentArea);

        if (currentArea.points.length > 1) {
            const lineMaterial = tool === 'area' ? 'areaLine' : 'surfaceAreaLine';
            const prevPoint = currentArea.points[currentArea.points.length - 2];
            this._addLineVisual(prevPoint, point, lineMaterial, currentArea);
        }
        if (currentArea.points.length >= 2) this._updateAreaPreview(currentArea);
        if (currentArea.points.length >= 3) this._updateAreaFill(currentArea);
        this._updateUI();
    }

    _finishAreaMeasurement() {
        const currentArea = [...this.measurements.area, ...this.measurements.surfaceArea].find(a => !a.finished);
        if (!currentArea || currentArea.points.length < 3) {
            this.logger.warn('MeasurementManager: Pontos insuficientes para finalizar a área.');
            return;
        }

        if (currentArea.visuals.previewLine) {
            this.measurementGroup.remove(currentArea.visuals.previewLine);
            currentArea.visuals.previewLine.geometry.dispose();
            currentArea.visuals.previewLine = null;
        }

        const firstPoint = currentArea.points[0];
        const lastPoint = currentArea.points[currentArea.points.length - 1];
        const lineMaterial = currentArea.type === 'area' ? 'areaLine' : 'surfaceAreaLine';
        this._addLineVisual(lastPoint, firstPoint, lineMaterial, currentArea);

        currentArea.finished = true;
        this._updateAreaFill(currentArea);
        this._addAreaLabel(currentArea);
        this._updateUI();
        this.eventBus.emit(`measurement:${currentArea.type}:completed`, { measurement: currentArea });
        this.logger.info(`MeasurementManager: Medição de ${currentArea.type} concluída.`);
    }

    _updateAreaPreview(areaMeasurement) {
        if (areaMeasurement.visuals.previewLine) {
            this.measurementGroup.remove(areaMeasurement.visuals.previewLine);
            areaMeasurement.visuals.previewLine.geometry.dispose();
        }
        const firstPoint = areaMeasurement.points[0];
        const lastPoint = areaMeasurement.points[areaMeasurement.points.length - 1];
        const geometry = new THREE.BufferGeometry().setFromPoints([lastPoint, firstPoint]);
        const line = new THREE.Line(geometry, this.materials.previewLine);
        line.computeLineDistances();
        this.measurementGroup.add(line);
        areaMeasurement.visuals.previewLine = line;
    }

    _updateAreaFill(areaMeasurement) {
        if (areaMeasurement.visuals.fill) {
            this.measurementGroup.remove(areaMeasurement.visuals.fill);
            areaMeasurement.visuals.fill.geometry.dispose();
        }
        if (areaMeasurement.points.length < 3) return;

        if (areaMeasurement.type === 'area') {
            areaMeasurement.area = this._calculate3DPolygonArea(areaMeasurement.points);
            const geometry = this._createPolygonGeometry(areaMeasurement.points);
            const mesh = new THREE.Mesh(geometry, this.materials.areaFill);
            mesh.renderOrder = 997;
            this.measurementGroup.add(mesh);
            areaMeasurement.visuals.fill = mesh;
        } else if (areaMeasurement.type === 'surfaceArea') {
            const { surfaceArea, highlightedGeometry } = this._calculateSurfaceArea(areaMeasurement.points);
            areaMeasurement.surfaceArea = surfaceArea;
            if (highlightedGeometry) {
                const mesh = new THREE.Mesh(highlightedGeometry, this.materials.highlightedFaces);
                mesh.renderOrder = 1;
                this.measurementGroup.add(mesh);
                areaMeasurement.visuals.fill = mesh;
            }
        }
    }

    _calculateSurfaceArea(polygonPoints) {
        if (!this.activeModel || !this.activeModel.geometry) {
            this.logger.warn("Modelo não ativo ou sem geometria para cálculo de área de superfície.");
            return { surfaceArea: 0, highlightedGeometry: null };
        }

        const modelGeometry = this.activeModel.geometry;
        const positionAttribute = modelGeometry.attributes.position;
        const indexAttribute = modelGeometry.index;

        // Project polygon onto the XY plane for 2D point-in-polygon test
        const polygon2D = polygonPoints.map(p => new THREE.Vector2(p.x, p.z));

        let totalArea = 0;
        const facesToHighlight = [];

        const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();

        for (let i = 0; i < indexAttribute.count; i += 3) {
            const iA = indexAttribute.getX(i);
            const iB = indexAttribute.getX(i + 1);
            const iC = indexAttribute.getX(i + 2);

            vA.fromBufferAttribute(positionAttribute, iA);
            vB.fromBufferAttribute(positionAttribute, iB);
            vC.fromBufferAttribute(positionAttribute, iC);

            // Transform vertices to world space
            this.activeModel.localToWorld(vA);
            this.activeModel.localToWorld(vB);
            this.activeModel.localToWorld(vC);

            const triangleCenter = new THREE.Vector3().add(vA).add(vB).add(vC).divideScalar(3);
            const center2D = new THREE.Vector2(triangleCenter.x, triangleCenter.z);

            if (this._isPointInPolygon(center2D, polygon2D)) {
                const area = THREE.Triangle.getArea(vA, vB, vC);
                totalArea += area;
                facesToHighlight.push(new THREE.Triangle(vA.clone(), vB.clone(), vC.clone()));
            }
        }

        // Create a new geometry for the highlighted faces
        const geometries = facesToHighlight.map(tri => {
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute([
                tri.a.x, tri.a.y, tri.a.z,
                tri.b.x, tri.b.y, tri.b.z,
                tri.c.x, tri.c.y, tri.c.z
            ], 3));
            return geom;
        });

        const highlightedGeometry = geometries.length > 0 ? BufferGeometryUtils.mergeGeometries(geometries) : null;

        return { surfaceArea: totalArea, highlightedGeometry };
    }

    _isPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    _addPointVisual(point, materialType, measurement) {
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const sphere = new THREE.Mesh(geometry, this.materials[materialType]);
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.measurementGroup.add(sphere);
        measurement.visuals.points.push(sphere);
    }

    _addLineVisual(startPoint, endPoint, materialType, measurement) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials[materialType]);
        line.renderOrder = 998;
        this.measurementGroup.add(line);
        measurement.visuals.lines.push(line);
    }

    _addDistanceLabel(measurement) {
        const midPoint = new THREE.Vector3().addVectors(measurement.points[0], measurement.points[1]).multiplyScalar(0.5);
        const text = `${measurement.distance.toFixed(2)}m`;
        const label = this._createTextSprite(text, '#ff0000');
        label.position.copy(midPoint);
        this.measurementGroup.add(label);
        measurement.visuals.labels.push(label);
    }

    _addAreaLabel(measurement) {
        const center = new THREE.Vector3();
        measurement.points.forEach(p => center.add(p));
        center.divideScalar(measurement.points.length);

        let text, color;
        if (measurement.type === 'area') {
            text = `${measurement.area.toFixed(2)}m² (Plana)`;
            color = '#00ff00';
        } else {
            text = `${measurement.surfaceArea.toFixed(2)}m² (Real)`;
            color = '#00aaff';
        }

        const label = this._createTextSprite(text, color);
        label.position.copy(center).y += 0.2; // Elevate label
        this.measurementGroup.add(label);
        measurement.visuals.labels.push(label);
    }

    _createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = 'Bold 48px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1, 0.25, 1);
        sprite.renderOrder = 1000;
        return sprite;
    }

    _createPolygonGeometry(points) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        points.forEach(p => vertices.push(p.x, p.y, p.z));
        const indices = [];
        for (let i = 1; i < points.length - 1; i++) {
            indices.push(0, i, i + 1);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    _calculate3DPolygonArea(points) {
        if (points.length < 3) return 0;
        let area = 0;
        const n = points.length;
        const normal = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(points[1], points[0]), new THREE.Vector3().subVectors(points[2], points[0])).normalize();
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += normal.dot(new THREE.Vector3().crossVectors(points[i], points[j]));
        }
        return Math.abs(area) / 2;
    }

    _updateInstructions() {
        const instructions = {
            'none': 'Selecione uma ferramenta para começar.',
            'measure': 'Clique em dois pontos para medir a distância.',
            'area': 'Clique para criar um polígono. Dê um duplo-clique para calcular a área plana (projeção).',
            'surfaceArea': 'Clique para criar um polígono. Dê um duplo-clique para calcular a área real da superfície do modelo dentro do polígono.'
        };
        this.eventBus.emit('ui:instructions:update', { text: instructions[this.currentTool] || '' });
    }

    _updateUI() {
        const stats = {
            distances: this.measurements.distance.filter(m => m.finished).map(m => ({ id: m.id, value: m.distance })),
            areas: this.measurements.area.filter(m => m.finished).map(m => ({ id: m.id, value: m.area })),
            surfaceAreas: this.measurements.surfaceArea.filter(m => m.finished).map(m => ({ id: m.id, value: m.surfaceArea }))
        };
        this.eventBus.emit('ui:measurements:update', stats);
    }

    clearAllMeasurements() {
        this._cleanupActiveDistanceHandler();
        while(this.measurementGroup.children.length > 0){
            const obj = this.measurementGroup.children[0];
            this.measurementGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        }
        this.measurements = { distance: [], area: [], surfaceArea: [] };
        this._updateUI();
        this.logger.info('MeasurementManager: Todas as medições foram removidas.');
    }

    clearMeasurement(id) {
        for (const type in this.measurements) {
            const index = this.measurements[type].findIndex(m => m.id === id);
            if (index !== -1) {
                const measurement = this.measurements[type][index];
                Object.values(measurement.visuals).flat().forEach(obj => {
                    if (obj) {
                        this.measurementGroup.remove(obj);
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) {
                           if (obj.material.map) obj.material.map.dispose();
                           obj.material.dispose();
                        }
                    }
                });
                this.measurements[type].splice(index, 1);
                this.logger.info(`MeasurementManager: Medição ${id} (${type}) removida.`);
                this._updateUI();
                return;
            }
        }
    }

    _generateId() {
        return `measurement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}