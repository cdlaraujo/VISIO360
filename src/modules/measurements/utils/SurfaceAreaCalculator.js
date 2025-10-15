// ============================================================================
// FILE: src/modules/measurements/utils/SurfaceAreaCalculator.js (FIXED: Robust Geometric Predicate)
// ============================================================================

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * @class SurfaceAreaCalculator
 * @description Handles complex surface area calculations on 3D models.
 * Single Responsibility: Calculate real surface area within polygon boundaries.
 */
export class SurfaceAreaCalculator {
    constructor(logger) {
        this.logger = logger;
        // Pre-allocate temporary vectors for efficiency and safety
        this._temp = {
            vA_world: new THREE.Vector3(),
            vB_world: new THREE.Vector3(),
            vC_world: new THREE.Vector3(),
            center: new THREE.Vector3(),
            relative: new THREE.Vector3(),
            edge1: new THREE.Vector3(),
            edge2: new THREE.Vector3(),
            cross: new THREE.Vector3()
        };
    }

    /**
     * Calculate the surface area of a model within a polygon boundary
     * @param {THREE.Mesh|THREE.Group} model - The 3D model or group containing it
     * @param {Array<THREE.Vector3>} polygonPoints - Polygon vertices in world space
     * @returns {Object} { surfaceArea: number, highlightedGeometry: THREE.BufferGeometry }
     */
    calculateSurfaceArea(model, polygonPoints) {
        if (!model) {
            this.logger.warn('SurfaceAreaCalculator: Invalid model provided');
            return { surfaceArea: 0, highlightedGeometry: null };
        }
        
        let mesh = model.isMesh ? model : null;
        if (!mesh) {
            model.traverse(child => {
                if (child.isMesh && !mesh) {
                    mesh = child;
                }
            });
        }
        
        if (!mesh || !mesh.geometry) {
            this.logger.warn('SurfaceAreaCalculator: No renderable mesh found in model/group');
            return { surfaceArea: 0, highlightedGeometry: null };
        }
        
        // Ensure the mesh's world matrix is up to date (CRITICAL STEP)
        mesh.updateWorldMatrix(true, false);
        const modelWorldMatrix = mesh.matrixWorld;

        const geometry = mesh.geometry;
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

        const { vA_world, vB_world, vC_world } = this._temp;

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

            // Get vertices in world space
            vA_world.fromBufferAttribute(positionAttribute, iA).applyMatrix4(modelWorldMatrix);
            vB_world.fromBufferAttribute(positionAttribute, iB).applyMatrix4(modelWorldMatrix);
            vC_world.fromBufferAttribute(positionAttribute, iC).applyMatrix4(modelWorldMatrix);

            // Project all three vertices to 2D
            const vA_2D = this._projectPointTo2D(vA_world, projectionBasis);
            const vB_2D = this._projectPointTo2D(vB_world, projectionBasis);
            const vC_2D = this._projectPointTo2D(vC_world, projectionBasis);
            
            // === CRITICAL GEOMETRIC PREDICATE FIX ===
            // Check if ANY of the three vertices is inside the projected polygon. 
            const isInside = this._isPointInPolygon(vA_2D, polygon2D) || 
                             this._isPointInPolygon(vB_2D, polygon2D) || 
                             this._isPointInPolygon(vC_2D, polygon2D);


            if (isInside) {
                // Calculate the true 3D area of the face in world space
                const area = this._calculateTriangleArea(vA_world, vB_world, vC_world);
                totalArea += area;
                // Store clones for highlighting
                facesToHighlight.push(new THREE.Triangle(vA_world.clone(), vB_world.clone(), vC_world.clone()));
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
        const relativePoint = this._temp.relative.copy(point).sub(basis.origin);
        return new THREE.Vector2(
            relativePoint.dot(basis.uAxis),
            relativePoint.dot(basis.vAxis)
        );
    }
    
    /**
     * @private
     * @description Robust ray-casting algorithm for 2D Point-in-Polygon test.
     */
    _isPointInPolygon(point, polygon) {
        let inside = false;
        const n = polygon.length;
        const tolerance = 1e-6; 

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;
            
            // Check if point is on a boundary (simple check for robustness)
            if (Math.abs(point.y - yi) < tolerance && Math.abs(point.x - xi) < tolerance) {
                return true; 
            }
            
            // Ray casting check
            const isIntersecting = ((yi > point.y) !== (yj > point.y));
            
            if (isIntersecting) {
                const yDiff = yj - yi;
                
                if (Math.abs(yDiff) > tolerance) {
                    const xIntersect = (xj - xi) * (point.y - yi) / yDiff + xi;
                    if (point.x < xIntersect) {
                        inside = !inside;
                    }
                }
            }
        }

        return inside;
    }

    _calculateTriangleArea(vA, vB, vC) {
        // Area of a triangle in 3D using the magnitude of the cross product
        this._temp.edge1.subVectors(vB, vA);
        this._temp.edge2.subVectors(vC, vA);
        this._temp.cross.crossVectors(this._temp.edge1, this._temp.edge2);
        return this._temp.cross.length() / 2;
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
            return geometries[0] || null;
        }
    }
}