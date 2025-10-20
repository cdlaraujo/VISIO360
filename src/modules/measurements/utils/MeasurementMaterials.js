// ============================================================================
// FILE: src/modules/measurements/utils/MeasurementMaterials.js
// ============================================================================

import * as THREE from 'three';

/**
 * @class MeasurementMaterials
 * @description Creates and manages shared materials for measurements.
 * Single Responsibility: Material initialization and configuration.
 */
export class MeasurementMaterials {
    constructor() {
        this.materials = this._createMaterials();
    }

    _createMaterials() {
        return {
            // Distance measurement materials
            point: new THREE.MeshBasicMaterial({ 
                color: 0xff0000, 
                depthTest: false, 
                depthWrite: false 
            }),
            line: new THREE.LineBasicMaterial({ 
                color: 0xff0000, 
                linewidth: 3, 
                depthTest: false, 
                depthWrite: false 
            }),

            // Area measurement materials
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
                opacity: 0.3, 
                side: THREE.DoubleSide, 
                depthTest: false 
            }),

            // Angle measurement materials
            anglePoint: new THREE.MeshBasicMaterial({ 
                color: 0xffff00, 
                depthTest: false, 
                depthWrite: false 
            }),
            angleLine: new THREE.LineBasicMaterial({ 
                color: 0xffff00, 
                linewidth: 3, 
                depthTest: false, 
                depthWrite: false 
            }),

            // Surface area measurement materials
            surfaceAreaPoint: new THREE.MeshBasicMaterial({ 
                color: 0x00aaff, 
                depthTest: false, 
                depthWrite: false 
            }),
            surfaceAreaLine: new THREE.LineBasicMaterial({ 
                color: 0x00aaff, 
                linewidth: 3, 
                depthTest: false, 
                depthWrite: false 
            }),
            highlightedFaces: new THREE.MeshBasicMaterial({ 
                color: 0x00aaff, 
                transparent: true, 
                opacity: 0.5, 
                side: THREE.DoubleSide 
            }),

            // Preview materials
            previewLine: new THREE.LineDashedMaterial({ 
                color: 0xffff00, 
                linewidth: 2, 
                dashSize: 0.1, 
                gapSize: 0.05, 
                depthTest: false, 
                depthWrite: false, 
                transparent: true, 
                opacity: 0.8 
            })
        };
    }

    getMaterials() {
        return this.materials;
    }

    getMaterial(name) {
        return this.materials[name];
    }

    updateMaterial(name, properties) {
        if (this.materials[name]) {
            Object.assign(this.materials[name], properties);
        }
    }

    dispose() {
        Object.values(this.materials).forEach(material => {
            if (material.map) material.map.dispose();
            material.dispose();
        });
    }
}