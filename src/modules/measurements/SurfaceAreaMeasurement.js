import * as THREE from 'three';
import { BasePolygonMeasurement } from './common/BasePolygonMeasurement.js';
import { SurfaceAreaCalculator } from './utils/SurfaceAreaCalculator.js'; // New Import

export class SurfaceAreaMeasurement extends BasePolygonMeasurement {
    constructor(scene, materials, logger, eventBus) {
        super(scene, materials, logger, eventBus, 'surfaceArea');
        // The SurfaceAreaCalculator is instantiated here
        this.calculator = new SurfaceAreaCalculator(logger); // Instantiate calculator
    }

    _finishMeasurement() {
        super._finishMeasurement(); // Handles cleanup and adding the closing line
        if (!this.activeMeasurement) return; // Finish was cancelled

        // Find the active 3D model dynamically
        const activeModel = this.scene.children.find(child => 
            // Exclude measurement groups, lights, and helpers added by SceneManager
            child.name !== 'measurements' && 
            child.name !== 'remote-annotations' &&
            child.type !== 'AmbientLight' && 
            child.type !== 'DirectionalLight' &&
            child.type !== 'GridHelper' &&
            !child.isCamera
        );
        
        if (!activeModel) {
            this.logger.error("SurfaceAreaMeasurement: No model loaded to calculate surface area on.");
            this.activeMeasurement = null;
            return;
        }

        // Perform the actual surface area calculation
        const { surfaceArea, highlightedGeometry } = this.calculator.calculateSurfaceArea(activeModel, this.activeMeasurement.points);
        // Placeholder removed
        
        this.activeMeasurement.value = surfaceArea;
        this.activeMeasurement.finished = true;

        // Add unique visuals for surface area (highlighting the faces on the model)
        if (highlightedGeometry) { // Only add mesh if geometry exists
            const mesh = new THREE.Mesh(highlightedGeometry, this.materials.highlightedFaces);
            mesh.renderOrder = 996; // Ensure it renders slightly below lines/points
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