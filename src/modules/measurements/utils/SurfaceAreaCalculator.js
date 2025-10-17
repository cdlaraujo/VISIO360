import * as THREE from 'three';

/**
 * @class SurfaceAreaCalculator
 * @description Calculates surface area by finding all mesh triangles inside the polygon
 * and summing their actual 3D areas. Uses bounding box optimization.
 */
export class SurfaceAreaCalculator {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Main calculation method
     * @param {THREE.Object3D} model - The 3D model to measure.
     * @param {Array<THREE.Vector3>} polygonPoints - The 3D points of the user's selection.
     * @returns {{surfaceArea: number, highlightedGeometry: THREE.BufferGeometry|null, method: string}}
     */
    calculateSurfaceArea(model, polygonPoints) {
        if (polygonPoints.length < 3) {
            this.logger.warn("SurfaceAreaCalculator: Need at least 3 points for a polygon.");
            return { surfaceArea: 0, highlightedGeometry: null, method: 'invalid' };
        }

        // Step 1: Create bounding box from polygon (the "neighborhood")
        const boundingBox = this._getBoundingBox(polygonPoints);
        const margin = this._calculateMargin(boundingBox);
        boundingBox.expandByScalar(margin); // Add some margin
        
        this.logger.info(`SurfaceAreaCalculator: Bounding box - Min: ${boundingBox.min.toArray()}, Max: ${boundingBox.max.toArray()}`);

        // Step 2: Create a plane for projection
        const plane = this._getBestFitPlane(polygonPoints);
        
        // Step 3: Project polygon points for 2D checking
        const projectedPolygon = polygonPoints.map(p => this._projectPointToPlane(p, plane));

        // Step 4: Find triangles inside the polygon (only in the neighborhood!)
        let totalArea = 0;
        let triangleCount = 0;
        let verticesChecked = 0;
        let verticesSkipped = 0;
        const highlightedTriangles = [];

        model.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;

            const geometry = child.geometry;
            const positionAttribute = geometry.attributes.position;
            
            if (!positionAttribute) return;

            const indices = geometry.index ? geometry.index.array : null;
            const vertexCount = positionAttribute.count;
            const matrix = child.matrixWorld;

            // Process triangles
            if (indices) {
                // Indexed geometry
                for (let i = 0; i < indices.length; i += 3) {
                    const v1 = this._getVertex(positionAttribute, indices[i], matrix);
                    const v2 = this._getVertex(positionAttribute, indices[i + 1], matrix);
                    const v3 = this._getVertex(positionAttribute, indices[i + 2], matrix);
                    
                    // OPTIMIZATION: Skip if triangle is outside bounding box
                    if (!this._isTriangleInBoundingBox(v1, v2, v3, boundingBox)) {
                        verticesSkipped += 3;
                        continue;
                    }
                    
                    verticesChecked += 3;
                    const result = this._processTriangle(v1, v2, v3, projectedPolygon, plane);
                    if (result.inside) {
                        totalArea += result.area;
                        triangleCount++;
                        highlightedTriangles.push(v1, v2, v3);
                    }
                }
            } else {
                // Non-indexed geometry
                for (let i = 0; i < vertexCount; i += 3) {
                    const v1 = this._getVertex(positionAttribute, i, matrix);
                    const v2 = this._getVertex(positionAttribute, i + 1, matrix);
                    const v3 = this._getVertex(positionAttribute, i + 2, matrix);
                    
                    // OPTIMIZATION: Skip if triangle is outside bounding box
                    if (!this._isTriangleInBoundingBox(v1, v2, v3, boundingBox)) {
                        verticesSkipped += 3;
                        continue;
                    }
                    
                    verticesChecked += 3;
                    const result = this._processTriangle(v1, v2, v3, projectedPolygon, plane);
                    if (result.inside) {
                        totalArea += result.area;
                        triangleCount++;
                        highlightedTriangles.push(v1, v2, v3);
                    }
                }
            }
        });

        this.logger.info(`SurfaceAreaCalculator: Optimization - Checked ${verticesChecked} vertices, Skipped ${verticesSkipped} vertices`);
        this.logger.info(`SurfaceAreaCalculator: Found ${triangleCount} triangles inside polygon, total area: ${totalArea.toFixed(2)}m²`);

        // Create highlighted geometry
        let highlightedGeometry = null;
        if (highlightedTriangles.length > 0) {
            highlightedGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(highlightedTriangles.length * 3);
            highlightedTriangles.forEach((vertex, i) => {
                positions[i * 3] = vertex.x;
                positions[i * 3 + 1] = vertex.y;
                positions[i * 3 + 2] = vertex.z;
            });
            highlightedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            highlightedGeometry.computeVertexNormals();
        }

        return { 
            surfaceArea: totalArea, 
            highlightedGeometry: highlightedGeometry,
            method: 'direct_triangle_sum',
            triangleCount: triangleCount
        };
    }

    /**
     * Get bounding box from polygon points
     * @private
     */
    _getBoundingBox(points) {
        const box = new THREE.Box3();
        points.forEach(p => box.expandByPoint(p));
        return box;
    }

    /**
     * Calculate appropriate margin based on bounding box size
     * @private
     */
    _calculateMargin(box) {
        const size = new THREE.Vector3();
        box.getSize(size);
        const avgSize = (size.x + size.y + size.z) / 3;
        return avgSize * 0.1; // 10% margin
    }

    /**
     * Check if a triangle intersects with the bounding box
     * @private
     */
    _isTriangleInBoundingBox(v1, v2, v3, box) {
        // Check if at least one vertex is inside the box
        return box.containsPoint(v1) || box.containsPoint(v2) || box.containsPoint(v3);
    }

    /**
     * Process a single triangle
     * @private
     */
    _processTriangle(v1, v2, v3, projectedPolygon, plane) {
        // Calculate the center of the triangle
        const center = new THREE.Vector3()
            .add(v1)
            .add(v2)
            .add(v3)
            .divideScalar(3);

        // Project the center onto the polygon plane
        const projectedCenter = this._projectPointToPlane(center, plane);

        // Check if center is inside the polygon
        const inside = this._isPointInPolygon(projectedCenter, projectedPolygon);

        // Calculate the actual 3D area
        const triangle = new THREE.Triangle(v1, v2, v3);
        const area = triangle.getArea();

        return { inside, area };
    }

    /**
     * Get a vertex from geometry and transform to world space
     * @private
     */
    _getVertex(positionAttribute, index, matrix) {
        const vertex = new THREE.Vector3(
            positionAttribute.getX(index),
            positionAttribute.getY(index),
            positionAttribute.getZ(index)
        );
        vertex.applyMatrix4(matrix);
        return vertex;
    }

    /**
     * Create best-fit plane using Newell's method
     * @private
     */
    _getBestFitPlane(points) {
        let normal = new THREE.Vector3();
        
        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            const next = points[(i + 1) % points.length];
            normal.x += (current.y - next.y) * (current.z + next.z);
            normal.y += (current.z - next.z) * (current.x + next.x);
            normal.z += (current.x - next.x) * (current.y + next.y);
        }
        
        normal.normalize();
        return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, points[0]);
    }

    /**
     * Project a point onto a plane
     * @private
     */
    _projectPointToPlane(point, plane) {
        const projected = new THREE.Vector3();
        plane.projectPoint(point, projected);
        return projected;
    }

    /**
     * Point-in-polygon test using ray casting
     * @private
     */
    _isPointInPolygon(point, polygon) {
        const p0 = polygon[0];
        const p1 = polygon[1];
        
        const xAxis = new THREE.Vector3().subVectors(p1, p0).normalize();
        const normal = new THREE.Vector3(0, 1, 0);
        const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();

        const to2D = (p) => {
            const v = new THREE.Vector3().subVectors(p, p0);
            return { x: v.dot(xAxis), y: v.dot(yAxis) };
        };

        const polygon2D = polygon.map(to2D);
        const point2D = to2D(point);

        // Ray casting algorithm
        let inside = false;
        for (let i = 0, j = polygon2D.length - 1; i < polygon2D.length; j = i++) {
            const xi = polygon2D[i].x, yi = polygon2D[i].y;
            const xj = polygon2D[j].x, yj = polygon2D[j].y;

            const intersect = ((yi > point2D.y) !== (yj > point2D.y)) &&
                (point2D.x < (xj - xi) * (point2D.y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }

        return inside;
    }
}