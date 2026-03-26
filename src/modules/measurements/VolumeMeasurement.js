import * as THREE from 'three';
import { BasePolygonMeasurement } from './common/BasePolygonMeasurement.js';
import { createTextSprite } from '../../utils/DrawingUtils.js';

// 1. Importamos a URL do worker, e não o worker em si.
import VolumeWorkerUrl from './workers/volume.worker.js?url';

export class VolumeMeasurement extends BasePolygonMeasurement {
    
    constructor(measurementGroup, materials, logger, eventBus) {
        super(
            measurementGroup, 
            materials, 
            logger, 
            eventBus, 
            'volume',
            materials.volumePoint,
            materials.volumeLine
        );
        
        // 2. Usamos o construtor "new Worker()" e passamos a URL importada.
        this.worker = new Worker(VolumeWorkerUrl, { type: 'module' });
    }

    _finishMeasurement() {
        super._finishMeasurement();

        if (!this.activeMeasurement) {
            this.logger.warn(`${this.constructor.name}: Finish cancelled by base class.`);
            return;
        }

        const points = this.activeMeasurement.points;
        const activeModel = this._findActiveModel();
        
        if (!activeModel) {
            this.logger.error("VolumeMeasurement: Nenhum modelo carregado para calcular o volume.");
            this.activeMeasurement.value = 0;
            this.activeMeasurement.finished = true;
            this.eventBus.emit('measurement:volume:completed', { 
                measurement: this.activeMeasurement,
            });
            this.activeMeasurement = null;
            return;
        }

        // --- LÓGICA DO WORKER ---

        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        center.add(new THREE.Vector3(0, 0.2, 0));
        const tempLabel = createTextSprite('Calculando...', '#ff00ff');
        tempLabel.position.copy(center);
        this.scene.add(tempLabel);
        this.activeMeasurement.visuals.labels.push(tempLabel);

        const meshesData = [];
        activeModel.traverse((child) => {
            if (child.isMesh && child.geometry?.attributes.position) {
                const positions = child.geometry.attributes.position.array.slice();
                const indices = child.geometry.index ? child.geometry.index.array.slice() : null;
                meshesData.push({
                    positions: positions,
                    indices: indices,
                    matrix: child.matrixWorld.toArray()
                });
            }
        });
        const polygonData = points.map(p => p.toArray());
        
        const currentMeasurement = this.activeMeasurement; 
        
        this.worker.onmessage = (e) => {
            if (!currentMeasurement) return; // Medição foi cancelada

            if (e.data.status === 'error') {
                this.logger.error('VolumeWorker falhou', e.data.error);
                tempLabel.material.map.dispose();
                tempLabel.material.dispose();
                this.scene.remove(tempLabel);
                this._addAreaLabel(points, 0, true); 
                return;
            }

            const { volume, highlightedGeometryData, method, triangleCount } = e.data;

            currentMeasurement.value = volume;
            currentMeasurement.finished = true;

            if (highlightedGeometryData) { 
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(highlightedGeometryData, 3));
                geometry.computeVertexNormals();
                
                const mesh = new THREE.Mesh(geometry, this.materials.volumeHighlight);
                mesh.renderOrder = 996;
                this.scene.add(mesh);
                currentMeasurement.visuals.fill = mesh;
            }

            tempLabel.material.map.dispose();
            tempLabel.material.dispose();
            this.scene.remove(tempLabel);
            const labelIndex = currentMeasurement.visuals.labels.indexOf(tempLabel);
            if (labelIndex > -1) {
                currentMeasurement.visuals.labels.splice(labelIndex, 1);
            }
            this._addAreaLabel(points, volume);

            this.logger.info(`VolumeMeasurement: Concluído - ${volume.toFixed(2)}m³ (método: ${method}, ${triangleCount} triângulos)`);
            
            this.eventBus.emit('measurement:volume:completed', {
                measurement: currentMeasurement,
                method: method
            });
            
            if (this.activeMeasurement === currentMeasurement) {
                this.activeMeasurement = null;
            }
        };

        this.worker.onerror = (err) => {
             this.logger.error('Erro fatal no VolumeWorker', err.message);
             // Limpa o label de "calculando" em caso de erro
             if (tempLabel) {
                tempLabel.material.map.dispose();
                tempLabel.material.dispose();
                this.scene.remove(tempLabel);
             }
        };

        const transferable = [];
        meshesData.forEach(data => {
            transferable.push(data.positions.buffer);
            if (data.indices) {
                transferable.push(data.indices.buffer);
            }
        });

        this.worker.postMessage({ meshesData, polygonData }, transferable);
    }

    _addAreaLabel(points, volume, isError = false) {
        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        center.add(new THREE.Vector3(0, 0.2, 0));
            
        const labelText = isError ? 'Erro' : `${volume.toFixed(2)}m³`;
        const color = isError ? '#ff0000' : '#ff00ff';
            
        const label = createTextSprite(labelText, color);
        label.position.copy(center);
        this.scene.add(label);
        // Adiciona uma verificação para garantir que activeMeasurement não é nulo
        this.activeMeasurement?.visuals.labels.push(label);
    }
}