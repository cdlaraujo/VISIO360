import * as THREE from 'three';

/**
 * @class VolumeCalculator
 * @description Calcula o volume (corte/aterro) encontrando todos os triângulos da malha
 * dentro de um polígono e somando o volume de seus "prismas" até um plano base.
 */
export class VolumeCalculator {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Método principal de cálculo
     * @param {THREE.Object3D} model - O modelo 3D para medir.
     * @param {Array<THREE.Vector3>} polygonPoints - Os pontos 3D da seleção do usuário.
     * @returns {{volume: number, highlightedGeometry: THREE.BufferGeometry|null, method: string}}
     */
    calculateVolume(model, polygonPoints) {
        if (polygonPoints.length < 3) {
            this.logger.warn("VolumeCalculator: São necessários pelo menos 3 pontos para um polígono.");
            return { volume: 0, highlightedGeometry: null, method: 'invalid' };
        }

        // Etapa 1: Criar bounding box do polígono
        const boundingBox = this._getBoundingBox(polygonPoints);
        const margin = this._calculateMargin(boundingBox);
        boundingBox.expandByScalar(margin);
        
        // Etapa 2: Criar um plano base para projeção e cálculo de altura
        const plane = this._getBestFitPlane(polygonPoints);
        
        // Etapa 3: Projetar pontos do polígono para verificação 2D
        const projectedPolygon = polygonPoints.map(p => this._projectPointToPlane(p, plane));

        // Etapa 4: Encontrar triângulos dentro do polígono
        let totalVolume = 0;
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
                // Geometria indexada
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
                        totalVolume += result.volume;
                        triangleCount++;
                        highlightedTriangles.push(v1, v2, v3);
                    }
                }
            } else {
                // Geometria não indexada
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
                        totalVolume += result.volume;
                        triangleCount++;
                        highlightedTriangles.push(v1, v2, v3);
                    }
                }
            }
        });

        this.logger.info(`VolumeCalculator: Otimização - Verificados ${verticesChecked} vértices, Pulados ${verticesSkipped} vértices`);
        this.logger.info(`VolumeCalculator: Encontrados ${triangleCount} triângulos, volume total: ${totalVolume.toFixed(2)}m³`);

        // Criar geometria de destaque
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
            volume: Math.abs(totalVolume), // Retorna o valor absoluto
            highlightedGeometry: highlightedGeometry,
            method: 'prism_volume_sum',
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
        return avgSize * 0.1; // 10% de margem
    }

    _isTriangleInBoundingBox(v1, v2, v3, box) {
        return box.containsPoint(v1) || box.containsPoint(v2) || box.containsPoint(v3);
    }

    /**
     * Processa um único triângulo, verificando se está dentro do polígono
     * e calculando seu volume prismático em relação ao plano base.
     * @private
     */
    _processTriangle(v1, v2, v3, projectedPolygon, plane) {
        // Calcula o centro do triângulo
        const center = new THREE.Vector3().add(v1).add(v2).add(v3).divideScalar(3);

        // Projeta o centro no plano do polígono
        const projectedCenter = this._projectPointToPlane(center, plane);

        // Verifica se o centro está dentro do polígono
        const inside = this._isPointInPolygon(projectedCenter, projectedPolygon);
        
        if (!inside) {
            return { inside: false, volume: 0 };
        }

        // --- Cálculo do Volume (Método Prismoidal) ---
        
        // 1. Projeta os vértices do triângulo 3D no plano base
        const p1 = this._projectPointToPlane(v1, plane);
        const p2 = this._projectPointToPlane(v2, plane);
        const p3 = this._projectPointToPlane(v3, plane);

        // 2. Calcula a área 2D do triângulo projetado (a base do prisma)
        const projectedTriangle = new THREE.Triangle(p1, p2, p3);
        const projectedArea = projectedTriangle.getArea();

        // 3. Calcula a altura (distância assinada) de cada vértice 3D ao plano base
        const h1 = plane.distanceToPoint(v1);
        const h2 = plane.distanceToPoint(v2);
        const h3 = plane.distanceToPoint(v3);
        
        // 4. Calcula a altura média
        const averageHeight = (h1 + h2 + h3) / 3;

        // 5. Volume = Área da Base * Altura Média
        const volume = projectedArea * averageHeight;

        return { inside: true, volume: volume };
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
        
        // Tenta criar um eixo Y "para cima" robusto
        const tempUp = Math.abs(xAxis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        const yAxis = new THREE.Vector3().crossVectors(xAxis, tempUp).normalize();
         // Recalcula o eixo X para garantir ortogonalidade
        xAxis.crossVectors(tempUp, yAxis).normalize();

        const to2D = (p) => {
            const v = new THREE.Vector3().subVectors(p, p0);
            return { x: v.dot(xAxis), y: v.dot(yAxis) };
        };

        const polygon2D = polygon.map(to2D);
        const point2D = to2D(point);

        // Algoritmo Ray casting
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