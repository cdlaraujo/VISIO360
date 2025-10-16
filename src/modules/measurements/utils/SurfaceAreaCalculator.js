import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import polygonClipping from 'polygon-clipping';

/**
 * @class SurfaceAreaCalculator
 * @description Handles complex surface area calculations using proper geometric clipping.
 * Single Responsibility: Calculate real surface area within polygon boundaries.
 */
export class SurfaceAreaCalculator {
    constructor(logger) {
        this.logger = logger;
        // Pre-allocate temporary vectors for efficiency
        this._temp = {
            vA_world: new THREE.Vector3(),
            vB_world: new THREE.Vector3(),
            vC_world: new THREE.Vector3(),
            relative: new THREE.Vector3(),
        };
    }

    calculateSurfaceArea(model, polygonPoints) {
        if (!model) return { surfaceArea: 0, highlightedGeometry: null };

        // Find the first renderable mesh in the model
        let mesh = model.isMesh ? model : model.getObjectByProperty('isMesh', true);
        if (!mesh || !mesh.geometry) {
            this.logger.warn('SurfaceAreaCalculator: No renderable mesh found.');
            return { surfaceArea: 0, highlightedGeometry: null };
        }

        mesh.updateWorldMatrix(true, false);
        const modelWorldMatrix = mesh.matrixWorld;
        const geometry = mesh.geometry;
        const positionAttribute = geometry.attributes.position;
        if (!positionAttribute) return { surfaceArea: 0, highlightedGeometry: null };

        // Project the user's 3D selection into a 2D polygon for clipping
        const { projectionBasis, polygon2D } = this._projectPolygonTo2D(polygonPoints);

        let totalArea = 0;
        const facesToHighlight = [];
        const indexAttribute = geometry.index;
        const faceCount = indexAttribute ? indexAttribute.count / 3 : positionAttribute.count / 3;

        this.logger.info(`SurfaceAreaCalculator: Processing ${faceCount} faces with clipping.`);

        const { vA_world, vB_world, vC_world } = this._temp;

        // Iterate over each face of the model's geometry
        for (let i = 0; i < faceCount; i++) {
            const iA = indexAttribute ? indexAttribute.getX(i * 3) : i * 3;
            const iB = indexAttribute ? indexAttribute.getX(i * 3 + 1) : i * 3 + 1;
            const iC = indexAttribute ? indexAttribute.getX(i * 3 + 2) : i * 3 + 2;

            vA_world.fromBufferAttribute(positionAttribute, iA).applyMatrix4(modelWorldMatrix);
            vB_world.fromBufferAttribute(positionAttribute, iB).applyMatrix4(modelWorldMatrix);
            vC_world.fromBufferAttribute(positionAttribute, iC).applyMatrix4(modelWorldMatrix);

            // Project the 3D face triangle to the same 2D plane as the user's selection
            const faceTriangle2D = [
                this._projectPointTo2D(vA_world, projectionBasis),
                this._projectPointTo2D(vB_world, projectionBasis),
                this._projectPointTo2D(vC_world, projectionBasis)
            ];

            // Use the clipping library to find the exact intersection
            const clippedPolygons = polygonClipping.intersection([polygon2D], [faceTriangle2D]);

            if (clippedPolygons && clippedPolygons.length > 0) {
                const faceNormal = new THREE.Plane().setFromCoplanarPoints(vA_world, vB_world, vC_world).normal;

                // Process the resulting clipped shapes
                clippedPolygons.forEach(multiPolygon => {
                    multiPolygon.forEach(ring => {
                        // Calculate the 3D area of the clipped 2D polygon
                        const area = this._calculate3DPolygonAreaFrom2D(ring, projectionBasis, faceNormal);
                        totalArea += area;

                        // Create geometry for highlighting the exact clipped area
                        const highlightVertices = ring.map(p => this._unprojectPointTo3D(p, projectionBasis, faceNormal, vA_world));
                        for (let j = 1; j < highlightVertices.length - 1; j++) {
                            facesToHighlight.push(new THREE.Triangle(
                                highlightVertices[0].clone(),
                                highlightVertices[j].clone(),
                                highlightVertices[j + 1].clone()
                            ));
                        }
                    });
                });
            }
        }

        this.logger.info(`SurfaceAreaCalculator: Final Area = ${totalArea.toFixed(4)}m²`);
        const highlightedGeometry = this._createHighlightGeometry(facesToHighlight);
        return { surfaceArea: totalArea, highlightedGeometry };
    }

    _projectPolygonTo2D(points) {
        const normal = new THREE.Plane().setFromCoplanarPoints(points[0], points[1], points[2]).normal;
        const uAxis = new THREE.Vector3().crossVectors(Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), normal).normalize();
        const vAxis = new THREE.Vector3().crossVectors(normal, uAxis);
        const projectionBasis = { origin: points[0], uAxis, vAxis, normal };
        const polygon2D = points.map(p => this._projectPointTo2D(p, projectionBasis));
        return { projectionBasis, polygon2D };
    }

    _projectPointTo2D(point, basis) {
        const p = this._temp.relative.copy(point).sub(basis.origin);
        return [p.dot(basis.uAxis), p.dot(basis.vAxis)];
    }
    
    _unprojectPointTo3D(point2D, basis, faceNormal, originalFacePoint) {
        const pointOnProjectionPlane = basis.origin.clone()
            .add(basis.uAxis.clone().multiplyScalar(point2D[0]))
            .add(basis.vAxis.clone().multiplyScalar(point2D[1]));

        const facePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(faceNormal, originalFacePoint);
        const projectedPoint = new THREE.Vector3();
        facePlane.projectPoint(pointOnProjectionPlane, projectedPoint);
        return projectedPoint;
    }

    _calculate3DPolygonAreaFrom2D(polygon2D, basis, faceNormal) {
        let area = 0;
        for (let i = 0; i < polygon2D.length; i++) {
            const p1 = polygon2D[i];
            const p2 = polygon2D[(i + 1) % polygon2D.length];
            area += (p1[0] * p2[1] - p2[0] * p1[1]);
        }
        const twoDArea = Math.abs(area / 2);
        // Correct the 2D area to its true 3D area by accounting for the angle between the planes
        const cosAngle = Math.abs(basis.normal.dot(faceNormal));
        return twoDArea / (cosAngle > 1e-6 ? cosAngle : 1);
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
            return geom;
        });
        return BufferGeometryUtils.mergeGeometries(geometries);
    }
}