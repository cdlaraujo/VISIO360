import * as THREE from 'three';

// --- Logger Falso para o Worker ---
class WorkerLogger {
    info(message, data = '') { console.log(`[WORKER-INFO] ${message}`, data); }
    warn(message, data = '') { console.warn(`[WORKER-WARN] ${message}`, data); }
    error(message, data = '') { console.error(`[WORKER-ERROR] ${message}`, data); }
    debug(message, data = '') { console.debug(`[WORKER-DEBUG] ${message}`, data); }
}

// --- CLASSE SURFACE AREA CALCULATOR ---
// (Copie e cole a classe SurfaceAreaCalculator inteira aqui)
class SurfaceAreaCalculator {
    constructor(logger) {
        this.logger = logger;
    }
    calculateSurfaceArea(model, polygonPoints) {
        if (polygonPoints.length < 3) {
            this.logger.warn("SurfaceAreaCalculator: Need at least 3 points for a polygon.");
            return { surfaceArea: 0, highlightedGeometry: null, method: 'invalid' };
        }
        const boundingBox = this._getBoundingBox(polygonPoints);
        const margin = this._calculateMargin(boundingBox);
        boundingBox.expandByScalar(margin); 
        this.logger.info(`SurfaceAreaCalculator: Bounding box - Min: ${boundingBox.min.toArray()}, Max: ${boundingBox.max.toArray()}`);
        const plane = this._getBestFitPlane(polygonPoints);
        const projectedPolygon = polygonPoints.map(p => this._projectPointToPlane(p, plane));
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
            if (indices) {
                for (let i = 0; i < indices.length; i += 3) {
                    const v1 = this._getVertex(positionAttribute, indices[i], matrix);
                    const v2 = this._getVertex(positionAttribute, indices[i + 1], matrix);
                    const v3 = this._getVertex(positionAttribute, indices[i + 2], matrix);
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
                for (let i = 0; i < vertexCount; i += 3) {
                    const v1 = this._getVertex(positionAttribute, i, matrix);
                    const v2 = this._getVertex(positionAttribute, i + 1, matrix);
                    const v3 = this._getVertex(positionAttribute, i + 2, matrix);
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
    _getBoundingBox(points) {
        const box = new THREE.Box3();
        points.forEach(p => box.expandByPoint(p));
        return box;
    }
    _calculateMargin(box) {
        const size = new THREE.Vector3();
        box.getSize(size);
        const avgSize = (size.x + size.y + size.z) / 3;
        return avgSize * 0.1; 
    }
    _isTriangleInBoundingBox(v1, v2, v3, box) {
        return box.containsPoint(v1) || box.containsPoint(v2) || box.containsPoint(v3);
    }
    _processTriangle(v1, v2, v3, projectedPolygon, plane) {
        const center = new THREE.Vector3()
            .add(v1)
            .add(v2)
            .add(v3)
            .divideScalar(3);
        const projectedCenter = this._projectPointToPlane(center, plane);
        const inside = this._isPointInPolygon(projectedCenter, projectedPolygon);
        const triangle = new THREE.Triangle(v1, v2, v3);
        const area = triangle.getArea();
        return { inside, area };
    }
    _getVertex(positionAttribute, index, matrix) {
        const vertex = new THREE.Vector3(
            positionAttribute.getX(index),
            positionAttribute.getY(index),
            positionAttribute.getZ(index)
        );
        vertex.applyMatrix4(matrix);
        return vertex;
    }
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
    _projectPointToPlane(point, plane) {
        const projected = new THREE.Vector3();
        plane.projectPoint(point, projected);
        return projected;
    }
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
// --- FIM DA CLASSE ---


// --- PONTO DE ENTRADA DO WORKER ---
self.onmessage = (e) => {
    const { meshesData, polygonData } = e.data;
    const logger = new WorkerLogger();
    
    try {
        const calculator = new SurfaceAreaCalculator(logger);
        const polygonPoints = polygonData.map(p => new THREE.Vector3().fromArray(p));

        // 1. Recria um "modelo falso" (Object3D) que o calculator pode atravessar
        const fakeModel = new THREE.Object3D();
        meshesData.forEach(data => {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
            if (data.indices) {
                geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
            }
            const mesh = new THREE.Mesh(geometry);
            mesh.matrixWorld.fromArray(data.matrix);
            mesh.matrixAutoUpdate = false;
            fakeModel.add(mesh);
        });

        // 2. Executa o cálculo (pesado)
        const result = calculator.calculateSurfaceArea(fakeModel, polygonPoints);
        
        // 3. Retorna os dados brutos da geometria
        const positionArray = result.highlightedGeometry 
            ? result.highlightedGeometry.attributes.position.array 
            : null;

        // Limpa a geometria reidratada para liberar memória
        fakeModel.traverse(child => child.geometry?.dispose());

        // Envia os dados de volta para o thread principal
        self.postMessage({
            status: 'success',
            surfaceArea: result.surfaceArea,
            highlightedGeometryData: positionArray,
            method: result.method,
            triangleCount: result.triangleCount
        }, [positionArray.buffer]); // Transfere a propriedade do buffer

    } catch (error) {
        logger.error('Erro no SurfaceArea Worker', error);
        self.postMessage({ status: 'error', error: error.message });
    }
};