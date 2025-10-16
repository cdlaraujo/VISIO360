import * as THREE from 'three';

/**
 * @class SurfaceAreaCalculator
 * @description Calculates surface area using a robust "Projected Area Correction" method.
 * It finds the flat (2D) area and corrects it based on the average slope of the underlying terrain.
 */
export class SurfaceAreaCalculator {
    constructor(logger) {
        this.logger = logger;
        this.raycaster = new THREE.Raycaster();
    }

    /**
     * Calculates the 2D area of a polygon defined by 3D points projected onto a plane.
     * @param {Array<THREE.Vector3>} points - The 3D vertices of the polygon.
     * @returns {{area: number, plane: THREE.Plane}}
     * @private
     */
    _getProjectedAreaAndPlane(points) {
        if (points.length < 3) return { area: 0, plane: null };
        
        let totalArea = 0;
        const plane = new THREE.Plane().setFromCoplanarPoints(points[0], points[1], points[2]);
        
        // Use Newell's method to handle non-planar polygons gracefully
        let normal = new THREE.Vector3();
        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            const next = points[(i + 1) % points.length];
            normal.x += (current.y - next.y) * (current.z + next.z);
            normal.y += (current.z - next.z) * (current.x + next.x);
            normal.z += (current.x - next.x) * (current.y + next.y);
        }
        
        normal.normalize();
        totalArea = new THREE.Vector3().copy(normal).dot(plane.normal) * new THREE.Triangle(points[0], points[1], points[2]).getArea();

        for (let i = 1; i < points.length - 1; i++) {
             totalArea += new THREE.Triangle(points[0], points[i], points[i + 1]).getArea();
        }

        return { area: Math.abs(totalArea / 2), plane };
    }


    /**
     * Main calculation method.
     * @param {THREE.Object3D} model - The 3D model to measure.
     * @param {Array<THREE.Vector3>} polygonPoints - The 3D points of the user's selection.
     * @returns {{surfaceArea: number, highlightedGeometry: THREE.BufferGeometry|null}}
     */
    calculateSurfaceArea(model, polygonPoints) {
        // --- Step 1: Calculate the simple, flat (projected) area ---
        const { area: flatArea, plane } = this._getProjectedAreaAndPlane(polygonPoints);

        if (flatArea === 0) {
            this.logger.warn("SurfaceAreaCalculator: Initial flat area is zero.");
            return { surfaceArea: 0, highlightedGeometry: null };
        }

        // --- Step 2: Sample the terrain to find the average slope ---
        const samples = 9; // Number of points to sample inside the polygon
        const barycenter = new THREE.Vector3();
        polygonPoints.forEach(p => barycenter.add(p));
        barycenter.divideScalar(polygonPoints.length);

        const samplePoints = [barycenter]; // Always include the center
        // Add more sample points for better accuracy if needed
        for (let i = 0; i < polygonPoints.length; i++) {
            samplePoints.push(new THREE.Vector3().lerpVectors(barycenter, polygonPoints[i], 0.5));
        }

        const surfaceNormals = [];
        samplePoints.forEach(originPoint => {
             // Cast rays from well above and below the sample point
            const rayOrigin = originPoint.clone().add(plane.normal.clone().multiplyScalar(10000));
            this.raycaster.set(rayOrigin, plane.normal.clone().negate());
            let intersects = this.raycaster.intersectObject(model, true);

            if (intersects.length === 0) { // If missed, try from the other side
                const oppositeRayOrigin = originPoint.clone().add(plane.normal.clone().multiplyScalar(-10000));
                this.raycaster.set(oppositeRayOrigin, plane.normal);
                intersects = this.raycaster.intersectObject(model, true);
            }

            if (intersects.length > 0 && intersects[0].face) {
                surfaceNormals.push(intersects[0].face.normal);
            }
        });

        if (surfaceNormals.length === 0) {
            this.logger.warn("SurfaceAreaCalculator: Could not find any surface normals. Returning flat area.");
            // Graceful fallback: if we can't find the surface, return the 2D area.
            return { surfaceArea: flatArea, highlightedGeometry: null };
        }

        // --- Step 3: Average the normals and calculate the correction factor ---
        const avgSurfaceNormal = new THREE.Vector3();
        surfaceNormals.forEach(n => avgSurfaceNormal.add(n));
        avgSurfaceNormal.divideScalar(surfaceNormals.length);

        // The correction factor is based on the angle between the flat plane and the average surface
        const cosAngle = Math.abs(plane.normal.dot(avgSurfaceNormal));
        const correctionFactor = 1 / (cosAngle > 1e-6 ? cosAngle : 1); // Avoid division by zero
        
        const finalSurfaceArea = flatArea * correctionFactor;

        this.logger.info(`Calculation: FlatArea(${flatArea.toFixed(2)}) * Correction(${correctionFactor.toFixed(2)}) = ${finalSurfaceArea.toFixed(2)}`);

        // We no longer generate a complex mesh, so highlightedGeometry is null.
        // The visual feedback is the polygon the user already drew.
        return { surfaceArea: finalSurfaceArea, highlightedGeometry: null };
    }
}