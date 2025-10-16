import * as THREE from 'three';
import { BaseMeasurement } from './common/BaseMeasurement.js';
import { SurfaceAreaCalculator } from './utils/SurfaceAreaCalculator.js';

export class SurfaceAreaMeasurement extends BaseMeasurement {
    constructor(scene, materials, logger, eventBus) {
        super(scene, materials, logger, eventBus, 'surfaceArea');
        this.calculator = new SurfaceAreaCalculator(logger); // Instantiate calculator

        // Listen for the event to finish the polygon (logic moved from BasePolygonMeasurement)
        this.eventBus.on('measurement:area:finish', () => {
            if (this.activeMeasurement && this.toolName === this.activeMeasurement.type) {
                this._finishMeasurement();
            }
        });
    }

    /**
     * @private
     * @description Handles point selection for polygons, drawing lines between them.
     * Logic moved from BasePolygonMeasurement.
     */
    _handlePointSelected(point) {
        super._handlePointSelected(point); // Calls BaseMeasurement to add the point visual

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
     * @description Updates the dashed preview line from the last point to the first.
     * Logic moved from BasePolygonMeasurement.
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
     * @private
     * @description Robustly searches the scene for the main 3D model object.
     */
    _findActiveModel(scene) {
        const EXCLUDE_NAMES = ['measurements', 'remote-annotations', 'GridHelper'];
        const EXCLUDE_TYPES = ['AmbientLight', 'DirectionalLight', 'PerspectiveCamera'];
        let activeModel = null;

        scene.traverse((child) => {
            if (activeModel) return;
            if (EXCLUDE_TYPES.includes(child.type) || EXCLUDE_NAMES.includes(child.name)) return;
            if (child.isObject3D && child.parent === scene) {
                activeModel = child;
            }
        });
        return activeModel;
    }

    /**
     * @private
     * @description Finalizes the measurement, calculates the surface area, and adds visuals.
     */
    _finishMeasurement() {
        // --- Logic moved from BasePolygonMeasurement ---
        if (!this.activeMeasurement || this.activeMeasurement.points.length < 3) {
            this.logger.warn(`${this.constructor.name}: Cannot finish, requires at least 3 points.`);
            if (this.activeMeasurement) {
                this.cancelActiveMeasurement(); // Clean up invalid measurement
            }
            return;
        }

        if (this.activeMeasurement.visuals.previewLine) {
            this.scene.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
            this.activeMeasurement.visuals.previewLine = null;
        }

        const points = this.activeMeasurement.points;
        this._addLineVisual(points[points.length - 1], points[0]);
        // --- End of moved logic ---

        const activeModel = this._findActiveModel(this.scene);
        
        if (!activeModel) {
            this.logger.error("SurfaceAreaMeasurement: No model loaded to calculate surface area on.");
            this.activeMeasurement = null;
            return;
        }

        const { surfaceArea, highlightedGeometry } = this.calculator.calculateSurfaceArea(activeModel, this.activeMeasurement.points);
        
        this.activeMeasurement.value = surfaceArea;
        this.activeMeasurement.finished = true;

        if (highlightedGeometry) { 
            const mesh = new THREE.Mesh(highlightedGeometry, this.materials.highlightedFaces);
            mesh.renderOrder = 996;
            this.scene.add(mesh);
            this.activeMeasurement.visuals.fill = mesh;
        } else {
            this.logger.warn("SurfaceAreaMeasurement: No geometry to highlight (area is 0 or calculation failed).");
        }

        this._addAreaLabel(this.activeMeasurement.points, surfaceArea);

        this.logger.info(`SurfaceAreaMeasurement: Completed - ${surfaceArea.toFixed(2)}m²`);
        this.eventBus.emit('measurement:surfaceArea:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }

    _addAreaLabel(points, area) {
        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        this._addLabel(`${area.toFixed(2)}m²`, center.add(new THREE.Vector3(0, 0.2, 0)), '#00aaff');
    }
}