import * as THREE from 'three';
import { BaseMeasurement } from './common/BaseMeasurement.js';
import { SurfaceAreaCalculator } from './utils/SurfaceAreaCalculator.js';
import { createTextSprite } from '../../utils/DrawingUtils.js';

export class SurfaceAreaMeasurement extends BaseMeasurement {
    constructor(measurementGroup, materials, logger, eventBus) {
        super(measurementGroup, materials, logger, eventBus, 'surfaceArea');
        this.measurementGroup = measurementGroup; // Store the measurement group reference
        this.calculator = new SurfaceAreaCalculator(logger);

        // Listen for the event to finish the polygon
        this.eventBus.on('measurement:area:finish', () => {
            if (this.activeMeasurement && this.toolName === this.activeMeasurement.type) {
                this._finishMeasurement();
            }
        });
    }

    /**
     * @private
     * @description Handles point selection for polygons, drawing lines between them.
     */
    _handlePointSelected(point) {
        if (!this.activeMeasurement) {
            this._startMeasurement();
        }
        
        this.activeMeasurement.points.push(point);
        
        // Add point visual with correct material
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const sphere = new THREE.Mesh(geometry, this.materials.surfaceAreaPoint);
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.measurementGroup.add(sphere);
        this.activeMeasurement.visuals.points.push(sphere);

        const points = this.activeMeasurement.points;
        if (points.length > 1) {
            // Add a line from the previous point to the new one
            this._addLineVisual(points[points.length - 2], points[points.length - 1]);
        }
        if (points.length >= 2) {
            // Update the dashed "preview" line that shows the closing segment
            this._updatePreviewLine();
        }
    }

    /**
     * @private
     * @description Adds a line between two points with the correct material.
     */
    _addLineVisual(startPoint, endPoint) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials.surfaceAreaLine);
        line.renderOrder = 998;
        this.measurementGroup.add(line);
        this.activeMeasurement.visuals.lines.push(line);
    }

    /**
     * @private
     * @description Updates the dashed preview line from the last point to the first.
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
     * @description Robustly searches the scene for the main 3D model object.
     */
    _findActiveModel() {
        const EXCLUDE_NAMES = ['measurements', 'remote-annotations', 'GridHelper'];
        const EXCLUDE_TYPES = ['AmbientLight', 'DirectionalLight', 'PerspectiveCamera', 'Line', 'LineSegments', 'Points', 'Sprite'];
        
        let activeModel = null;
        let largestMesh = null;
        let maxVertices = 0;

        // Get the actual Three.js scene (parent of measurementGroup)
        const scene = this.measurementGroup.parent;
        if (!scene) {
            this.logger.error("SurfaceAreaMeasurement: Could not access scene");
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
            this.logger.info("SurfaceAreaMeasurement: Using largest mesh as active model");
        }

        return activeModel;
    }

    /**
     * @private
     * @description Finalizes the measurement, calculates the surface area, and adds visuals.
     */
    _finishMeasurement() {
        if (!this.activeMeasurement || this.activeMeasurement.points.length < 3) {
            this.logger.warn(`${this.constructor.name}: Cannot finish, requires at least 3 points.`);
            if (this.activeMeasurement) {
                this.cancelActiveMeasurement();
            }
            return;
        }

        // Remove preview line
        if (this.activeMeasurement.visuals.previewLine) {
            this.measurementGroup.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
            this.activeMeasurement.visuals.previewLine = null;
        }

        // Add closing line
        const points = this.activeMeasurement.points;
        this._addLineVisual(points[points.length - 1], points[0]);

        // Find the model to measure
        const activeModel = this._findActiveModel();
        
        if (!activeModel) {
            this.logger.error("SurfaceAreaMeasurement: No model loaded to calculate surface area on.");
            // Still show the flat area as fallback
            const flatArea = 0; // Fallback placeholder
            this._addAreaLabel(points, flatArea, true);
            this.activeMeasurement.value = flatArea;
            this.activeMeasurement.finished = true;
            this.eventBus.emit('measurement:surfaceArea:completed', { 
                measurement: this.activeMeasurement,
                isFlatArea: true 
            });
            this.activeMeasurement = null;
            return;
        }

        // Calculate the actual surface area
        const result = this.calculator.calculateSurfaceArea(activeModel, points);
        
        this.activeMeasurement.value = result.surfaceArea;
        this.activeMeasurement.finished = true;

        // Add visual highlight if geometry was generated
        if (result.highlightedGeometry) { 
            const mesh = new THREE.Mesh(result.highlightedGeometry, this.materials.highlightedFaces);
            mesh.renderOrder = 996;
            this.measurementGroup.add(mesh);
            this.activeMeasurement.visuals.fill = mesh;
        }

        // Add the area label
        this._addAreaLabel(points, result.surfaceArea, false);

        this.logger.info(`SurfaceAreaMeasurement: Completed - ${result.surfaceArea.toFixed(2)}m² (method: ${result.method})`);
        
        this.eventBus.emit('measurement:surfaceArea:completed', { 
            measurement: this.activeMeasurement,
            method: result.method
        });
        
        this.activeMeasurement = null;
    }

    /**
     * @private
     * @description Adds a label showing the area value using proper utility function
     */
    _addAreaLabel(points, area, isFlatArea = false) {
        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        center.add(new THREE.Vector3(0, 0.2, 0));
        
        const labelText = isFlatArea 
            ? `${area.toFixed(2)}m² (flat)` 
            : `${area.toFixed(2)}m²`;
            
        // Use the utility function from DrawingUtils (imported at top)
        const label = createTextSprite(labelText, '#00aaff');
        label.position.copy(center);
        this.measurementGroup.add(label);
        this.activeMeasurement.visuals.labels.push(label);
    }

    /**
     * @private
     * @description Creates a new measurement object
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

    _generateId() {
        return `${this.toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}