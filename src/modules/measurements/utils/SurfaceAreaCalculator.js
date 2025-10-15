// ============================================================================
// FILE: src/modules/measurements/SurfaceAreaCalculator.js (FIXED: Missing Import)
// ============================================================================

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'; // <-- FIX: Import required utility

/**
 * @class SurfaceAreaCalculator
 * @description Handles complex surface area calculations on 3D models.
 * Single Responsibility: Calculate real surface area within polygon boundaries.
 */
export class SurfaceAreaCalculator {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Calculate the surface area of a model within a polygon boundary
     * @param {THREE.Mesh} model - The 3D model
     * @param {Array<THREE.Vector3>} polygonPoints - Polygon vertices in world space
     * @returns {Object} { surfaceArea: number, highlightedGeometry: THREE.BufferGeometry }
     */
    calculateSurfaceArea(model, polygonPoints) {
        if (!model || !model.geometry) {
            this.logger.warn('SurfaceAreaCalculator: Invalid model or geometry');
            return { surfaceArea: 0, highlightedGeometry: null };
        }

        const geometry = model.geometry;
        const positionAttribute = geometry.attributes.position;

        if (!positionAttribute) {
            this.logger.error('SurfaceAreaCalculator: Geometry has no position attribute');
            return { surfaceArea: 0, highlightedGeometry: null };
        }

        // Calculate polygon plane and projection
        const polygonNormal = this._calculatePolygonNormal(polygonPoints);
        const { polygon2D, projectionBasis } = this._projectPolygonTo2D(
            polygonPoints, 
            polygonNormal
        );

        let totalArea = 0;
        const facesToHighlight = [];

        // Process all faces
        const indexAttribute = geometry.index;
        const isIndexed = indexAttribute !== null;
        const faceCount = isIndexed 
            ? indexAttribute.count / 3 
            : positionAttribute.count / 3;

        this.logger.info(`SurfaceAreaCalculator: Processing ${faceCount} faces`);

        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();
        const vC = new THREE.Vector3();

        for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
            // Get vertex indices
            let iA, iB, iC;
            
            if (isIndexed) {
                iA = indexAttribute.getX(faceIndex * 3);
                iB = indexAttribute.getX(faceIndex * 3 + 1);
                iC = indexAttribute.getX(faceIndex * 3 + 2);
            } else {
                iA = faceIndex * 3;
                iB = faceIndex * 3 + 1;
                iC = faceIndex * 3 + 2;
            }

            // Get vertices in local space
            vA.fromBufferAttribute(positionAttribute, iA);
            vB.fromBufferAttribute(positionAttribute, iB);
            vC.fromBufferAttribute(positionAttribute, iC);

            // Transform to world space
            model.localToWorld(vA);
            model.localToWorld(vB);
            model.localToWorld(vC);

            // Calculate triangle center
            const triangleCenter = new THREE.Vector3()
                .add(vA).add(vB).add(vC)
                .divideScalar(3);

            // Project to 2D and test
            const center2D = this._projectPointTo2D(triangleCenter, projectionBasis);

            if (this._isPointInPolygon(center2D, polygon2D)) {
                const area = this._calculateTriangleArea(vA, vB, vC);
                totalArea += area;
                facesToHighlight.push(new THREE.Triangle(vA.clone(), vB.clone(), vC.c‌lone()));
            }
        }

        this.logger.info(
            `SurfaceAreaCalculator: Area = ${totalArea.toFixed(4)}m² (${facesToHighlight.length} faces)`
        );

        // Create highlighted geometry
        const highlightedGeometry = this._createHighlightGeometry(facesToHighlight);

        return { surfaceArea: totalArea, highlightedGeometry };
    }

    _calculatePolygonNormal(points) {
        const normal = new THREE.Vector3(0, 0, 0);
        const n = points.length;

        for (let i = 0; i < n; i++) {
            const current = points[i];
            const next = points[(i + 1) % n];

            normal.x += (current.y - next.y) * (current.z + next.z);
            normal.y += (current.z - next.z) * (current.x + next.x);
            normal.z += (current.x - next.x) * (current.y + next.y);
        }

        normal.normalize();
        return normal;
    }

    _projectPolygonTo2D(points, normal) {
        const up = Math.abs(normal.y) < 0.999 
            ? new THREE.Vector3(0, 1, 0) 
            : new THREE.Vector3(1, 0, 0);
        
        const uAxis = new THREE.Vector3().crossVectors(up, normal).normalize();
        const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();

        const projectionBasis = {
            origin: points[0].clone(),
            uAxis,
            vAxis
        };

        const polygon2D = points.map(p => this._projectPointTo2D(p, projectionBasis));

        return { polygon2D, projectionBasis };
    }

    _projectPointTo2D(point, basis) {
        const relativePoint = point.clone().sub(basis.origin);
        return new THREE.Vector2(
            relativePoint.dot(basis.uAxis),
            relativePoint.dot(basis.vAxis)
        );
    }

    _isPointInPolygon(point, polygon) {
        let inside = false;
        const n = polygon.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 1e-10) + xi);
            
            if (intersect) inside = !inside;
        }

        return inside;
    }

    _calculateTriangleArea(vA, vB, vC) {
        const edge1 = new THREE.Vector3().subVectors(vB, vA);
        const edge2 = new THREE.Vector3().subVectors(vC, vA);
        const cross = new THREE.Vector3().crossVectors(edge1, edge2);
        return cross.length() / 2;
    }

    _createHighlightGeometry(triangles) {
        if (triangles.length === 0) return null;

        const geometries = triangles.map(tri => {
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute([
                tri.a.x, tri.a.y, tri.a.z,
                tri.b.x, tri.b.y, tri.b.z,
                tri.c.x, tri.c.y, tri.c.z
            ], 3));
            geom.computeVertexNormals();
            return geom;
        });

        try {
            return BufferGeometryUtils.mergeGeometries(geometries);
        } catch (error) {
            this.logger.error('SurfaceAreaCalculator: Error merging geometries', error);
            return geometries[0];
        }
    }
}