// NOVO ARQUIVO: src/modules/measurements/VolumeBoxMeasurement.js
import * as THREE from 'three';
import { BaseMeasurement } from './common/BaseMeasurement.js';
import { createTextSprite } from '../../utils/DrawingUtils.js';

export class VolumeBoxMeasurement extends BaseMeasurement {
    constructor(measurementGroup, materials, logger, eventBus) {
        // O nome da nova ferramenta é 'volumeBox'
        super(measurementGroup, materials, logger, eventBus, 'volumeBox');
        this.measurementGroup = measurementGroup;
    }

    /**
     * Sobrescreve o método base para usar o material correto
     */
    _addPointVisual(point) {
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const material = this.materials.volumeBoxPoint; // Material personalizado
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.measurementGroup.add(sphere);
        this.activeMeasurement.visuals.points.push(sphere);
    }

    /**
     * Lida com a seleção de pontos. A medição está completa com 2 pontos.
     */
    _handlePointSelected(point) {
        super._handlePointSelected(point); // Chama o método base para adicionar o ponto

        if (this.activeMeasurement.points.length === 2) {
            this._completeMeasurement();
        }
    }

    /**
     * Calcula o volume e adiciona os visuais finais.
     * @private
     */
    _completeMeasurement() {
        const [p1, p2] = this.activeMeasurement.points;

        // Calcula as dimensões
        const width = Math.abs(p2.x - p1.x);
        const height = Math.abs(p2.y - p1.y);
        const depth = Math.abs(p2.z - p1.z);

        // Calcula o volume
        const volume = width * height * depth;

        this.activeMeasurement.value = volume;
        this.activeMeasurement.finished = true;

        // Adiciona o visual da caixa
        this._addBoxVisual(p1, p2, width, height, depth);

        // Adiciona o rótulo no centro da caixa
        const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        this._addLabel(`${volume.toFixed(2)}m³`, midPoint, '#00ccff'); // Cor Ciano

        this.logger.info(`VolumeBoxMeasurement: Concluído - ${volume.toFixed(2)}m³`);
        
        // Notifica a aplicação
        this.eventBus.emit('measurement:volumeBox:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }

    /**
     * Adiciona o visual da caixa (Mesh) à cena.
     * @private
     */
    _addBoxVisual(p1, p2, width, height, depth) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = this.materials.volumeBox; // Material personalizado
        const boxMesh = new THREE.Mesh(geometry, material);

        // Posiciona a caixa no centro entre os dois pontos
        const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        boxMesh.position.copy(center);

        boxMesh.renderOrder = 997;
        this.measurementGroup.add(boxMesh);
        this.activeMeasurement.visuals.fill = boxMesh; // Armazena como 'fill'
    }
    
    /**
     * Re-implementa _addLabel para usar a importação de createTextSprite
     */
    _addLabel(text, position, color = '#ffffff') {
        const label = createTextSprite(text, color);
        label.position.copy(position);
        this.measurementGroup.add(label);
        this.activeMeasurement.visuals.labels.push(label);
    }
}