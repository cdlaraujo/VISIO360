import * as THREE from 'three';
import { BasePolygonMeasurement } from './common/BasePolygonMeasurement.js';

export class AreaMeasurement extends BasePolygonMeasurement {
    constructor(scene, materials, logger, eventBus) {
        super(scene, materials, logger, eventBus, 'area');
    }

    _finishMeasurement() {
        super._finishMeasurement(); // Handles cleanup and adding the closing line
        if (!this.activeMeasurement) return; // Finish was cancelled

        const points = this.activeMeasurement.points;
        const area = this._calculate3DPolygonArea(points);
        this.activeMeasurement.value = area;
        this.activeMeasurement.finished = true;

        this._addFillMesh(points);
        this._addAreaLabel(points, area);

        this.logger.info(`AreaMeasurement: Completed - ${area.toFixed(2)}m²`);
        this.eventBus.emit('measurement:area:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }

    _addFillMesh(points) {
        // 1. Calculate the Centroid and Normal of the 3D polygon to define its plane.
        const centroid = new THREE.Vector3();
        points.forEach(p => centroid.add(p));
        centroid.divideScalar(points.length);

        const p1 = points[0];
        const p2 = points[1];
        const p3 = points[2];
        
        // Calculate the plane normal using the cross product of two edges.
        const edge1 = new THREE.Vector3().subVectors(p2, p1);
        const edge2 = new THREE.Vector3().subVectors(p3, p1);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

        // 2. Create the Shape and Geometry in 2D (projected space).
        // To use ShapeGeometry, we must project the 3D points onto a 2D plane (the mesh's local XY plane).
        const xAxis = new THREE.Vector3().subVectors(p2, p1).normalize(); // Local X-axis
        const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize(); // Local Y-axis
        
        const shape = new THREE.Shape(
            points.map(p => {
                const vector = new THREE.Vector3().subVectors(p, centroid);
                // Project the vector onto the local XY plane defined by xAxis and yAxis
                return new THREE.Vector2(
                    vector.dot(xAxis),
                    vector.dot(yAxis)
                );
            })
        );

        const geometry = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geometry, this.materials.areaFill);
        
        // 3. Apply the 3D transformation to the mesh.
        
        // Set the mesh position to the calculated centroid
        mesh.position.copy(centroid);
        
        // FIX: Use Matrix4.makeBasis and Quaternion.setFromRotationMatrix for reliable orientation.
        const orientationMatrix = new THREE.Matrix4();
        // The basis vectors define the mesh's new local coordinate system:
        // xAxis (local X), yAxis (local Y), normal (local Z)
        orientationMatrix.makeBasis(xAxis, yAxis, normal);

        const orientationQuaternion = new THREE.Quaternion().setFromRotationMatrix(orientationMatrix);
        mesh.quaternion.copy(orientationQuaternion);

        // This ensures the mesh is rendered relative to other objects
        mesh.renderOrder = 997; 

        this.scene.add(mesh);
        this.activeMeasurement.visuals.fill = mesh;
    }

    _addAreaLabel(points, area) {
        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        this._addLabel(`${area.toFixed(2)}m²`, center.add(new THREE.Vector3(0, 0.2, 0)), '#00ff00');
    }

    _calculate3DPolygonArea(points) {
        if (points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    }
}