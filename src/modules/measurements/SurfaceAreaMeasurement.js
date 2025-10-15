import * as THREE from 'three';
import { BasePolygonMeasurement } from './common/BasePolygonMeasurement.js';
import { SurfaceAreaCalculator } from './utils/SurfaceAreaCalculator.js';

export class SurfaceAreaMeasurement extends BasePolygonMeasurement {
    constructor(scene, materials, logger, eventBus) {
        super(scene, materials, logger, eventBus, 'surfaceArea');
        // The SurfaceAreaCalculator is instantiated here
        this.calculator = new SurfaceAreaCalculator(logger); // Instantiate calculator
    }

    /**
     * @private
     * @description Robustly searches the scene for the main 3D model object.
     */
    _findActiveModel(scene) {
        // Exclude Three.js helpers, cameras, and measurement groups
        const EXCLUDE_NAMES = ['measurements', 'remote-annotations', 'GridHelper', 'remote-annotations'];
        const EXCLUDE_TYPES = ['AmbientLight', 'DirectionalLight', 'PerspectiveCamera'];

        let activeModel = null;

        // Traverse the scene looking for the main model (a Mesh or a Group)
        scene.traverse((child) => {
            if (activeModel) return; // Stop search once found

            if (EXCLUDE_TYPES.includes(child.type) || EXCLUDE_NAMES.includes(child.name)) {
                return;
            }

            // Check if it's the root model container
            if (child.isObject3D && child.parent === scene) {
                // If it's a Mesh, Group, or Object3D directly under the scene, it's our model.
                activeModel = child;
            }
        });

        // The calculator expects an object that has a geometry or children with geometry
        return activeModel;
    }

    _finishMeasurement() {
        super._finishMeasurement(); // Handles cleanup and adding the closing line
        if (!this.activeMeasurement) return; // Finish was cancelled

        // Find the active 3D model using the robust search
        const activeModel = this._findActiveModel(this.scene);
        
        if (!activeModel) {
            this.logger.error("SurfaceAreaMeasurement: No model loaded to calculate surface area on.");
            this.activeMeasurement = null;
            return;
        }

        // Perform the actual surface area calculation
        const { surfaceArea, highlightedGeometry } = this.calculator.calculateSurfaceArea(activeModel, this.activeMeasurement.points);
        
        this.activeMeasurement.value = surfaceArea;
        this.activeMeasurement.finished = true;

        // Add unique visuals for surface area (highlighting the faces on the model)
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