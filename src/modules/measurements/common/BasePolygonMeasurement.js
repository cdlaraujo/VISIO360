import * as THREE from 'three';
import { BaseMeasurement } from './BaseMeasurement.js';

/**
 * @class BasePolygonMeasurement
 * @description An abstract base class for polygon-based measurement tools (e.g., Area, SurfaceArea).
 * Inherits from BaseMeasurement and adds logic for creating multi-point shapes.
 *
 * (REFATORADO para centralizar TODA a lógica de polígono, incluindo desenho com
 * materiais específicos, finalização e busca de modelo).
 */
export class BasePolygonMeasurement extends BaseMeasurement {
    /**
     * @param {THREE.Group} scene - O grupo da cena para adicionar visuais.
     * @param {Object} materials - O objeto de materiais compartilhados.
     * @param {Logger} logger - Instância do Logger.
     * @param {EventBus} eventBus - Instância do EventBus.
     * @param {string} toolName - O nome da ferramenta (ex: 'area', 'volume').
     * @param {THREE.Material} pointMaterial - O material para os pontos (MeshBasicMaterial).
     * @param {THREE.Material} lineMaterial - O material para as linhas (LineBasicMaterial).
     */
    constructor(scene, materials, logger, eventBus, toolName, pointMaterial, lineMaterial) {
        super(scene, materials, logger, eventBus, toolName);

        // Materiais específicos da ferramenta filha
        this.pointMaterial = pointMaterial;
        this.lineMaterial = lineMaterial;

        // Listen for the event to finish the polygon
        this.eventBus.on('measurement:area:finish', () => {
            if (this.activeMeasurement && this.toolName === this.activeMeasurement.type) {
                this._finishMeasurement();
            }
        });
    }

    /**
     * @override
     * Inicia uma nova medição de polígono.
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
        this.logger.info(`${this.constructor.name}: Started new measurement.`);
    }

    /**
     * @override
     * Adiciona um ponto visual usando o material específico da ferramenta.
     */
    _addPointVisual(point) {
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const sphere = new THREE.Mesh(geometry, this.pointMaterial); // <-- Usa material injetado
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.scene.add(sphere);
        this.activeMeasurement.visuals.points.push(sphere);
    }

    /**
     * @override
     * Adiciona uma linha visual usando o material específico da ferramenta.
     */
    _addLineVisual(startPoint, endPoint) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.lineMaterial); // <-- Usa material injetado
        line.renderOrder = 998;
        this.scene.add(line);
        this.activeMeasurement.visuals.lines.push(line);
    }

    /**
     * @override
     * Lida com a seleção de pontos para polígonos.
     */
    _handlePointSelected(point) {
        if (!this.activeMeasurement) {
            this._startMeasurement();
        }
        
        this.activeMeasurement.points.push(point);
        this._addPointVisual(point); // <-- Chama a versão sobrescrita

        const points = this.activeMeasurement.points;
        if (points.length > 1) {
            // Add a line from the previous point to the new one
            this._addLineVisual(points[points.length - 2], points[points.length - 1]); // <-- Chama a versão sobrescrita
        }
        if (points.length >= 2) {
            // Update the dashed "preview" line that shows the closing segment
            this._updatePreviewLine();
        }
    }

    /**
     * Atualiza a linha tracejada de fechamento.
     * @private
     */
    _updatePreviewLine() {
        if (this.activeMeasurement.visuals.previewLine) {
            this.scene.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
        }

        const firstPoint = this.activeMeasurement.points[0];
        const lastPoint = this.activeMeasurement.points[this.activeMeasurement.points.length - 1];

        const geometry = new THREE.BufferGeometry().setFromPoints([lastPoint, firstPoint]);
        const line = new THREE.Line(geometry, this.materials.previewLine);
        line.computeLineDistances();
        this.scene.add(line);
        this.activeMeasurement.visuals.previewLine = line;
    }

    /**
     * Lógica base de finalização. Limpa a linha de preview e adiciona a linha de fechamento.
     * As classes filhas DEVEM chamar super._finishMeasurement() primeiro.
     * @protected
     */
    _finishMeasurement() {
        if (!this.activeMeasurement || this.activeMeasurement.points.length < 3) {
            this.logger.warn(`${this.constructor.name}: Cannot finish, requires at least 3 points.`);
            if (this.activeMeasurement) {
                this.cancelActiveMeasurement();
            }
            return;
        }

        // Clean up the preview line
        if (this.activeMeasurement.visuals.previewLine) {
            this.scene.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
            this.activeMeasurement.visuals.previewLine = null;
        }

        // Add the final closing line
        const points = this.activeMeasurement.points;
        this._addLineVisual(points[points.length - 1], points[0]);

        // Child classes will implement their specific calculation and labeling
    }

    /**
     * @protected
     * @description Robustly searches the scene for the main 3D model object.
     * (Movido de SurfaceArea/Volume para cá, pois é uma lógica de polígono compartilhada).
     */
    _findActiveModel() {
        const EXCLUDE_NAMES = ['measurements', 'remote-annotations', 'GridHelper'];
        const EXCLUDE_TYPES = ['AmbientLight', 'DirectionalLight', 'PerspectiveCamera', 'Line', 'LineSegments', 'Points', 'Sprite'];
        
        let activeModel = null;
        let largestMesh = null;
        let maxVertices = 0;

        // Get the actual Three.js scene (parent of measurementGroup/this.scene)
        const scene = this.scene.parent;
        if (!scene) {
            this.logger.error(`${this.constructor.name}: Could not access scene parent`);
            return null;
        }

        scene.traverse((child) => {
            // Skip excluded types and names
            if (EXCLUDE_TYPES.includes(child.type) || EXCLUDE_NAMES.includes(child.name)) return;
            
            // Look for mesh objects that could be the model
            if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                const vertexCount = child.geometry.attributes.position.count;
                
                // Track the largest mesh (likely the main model)
                if (vertexCount > maxVertices) {
                    maxVertices = vertexCount;
                    largestMesh = child;
                }
                
                // If this is a substantial mesh at the scene root level, it's likely the model
                if (vertexCount > 100 && child.parent === scene) {
                    activeModel = child;
                }
            }
            
            // Also check for groups that contain meshes (common for GLTF models)
            if (child.isGroup && child.children.some(c => c.isMesh) && child.parent === scene) {
                activeModel = child;
            }
        });

        // Fallback to the largest mesh if no root-level model found
        if (!activeModel && largestMesh) {
            activeModel = largestMesh;
            this.logger.info(`${this.constructor.name}: Using largest mesh as active model`);
        }

        return activeModel;
    }
}