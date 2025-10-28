// src/modules/measurements.js (FIXED for Duplication)

import * as THREE from 'three';
import { MeasurementMaterials } from './measurements/utils/MeasurementMaterials.js';
import { DistanceMeasurement } from './measurements/DistanceMeasurement.js';
import { AreaMeasurement } from './measurements/AreaMeasurement.js';
import { SurfaceAreaMeasurement } from './measurements/SurfaceAreaMeasurement.js';
import { AngleMeasurement } from './measurements/AngleMeasurement.js';
import { VolumeMeasurement } from './measurements/VolumeMeasurement.js'; // <-- 1. IMPORTAR
import { VolumeBoxMeasurement } from './measurements/VolumeBoxMeasurement.js'; // <-- NOVO
import { MeasurementDisposer } from './measurements/utils/MeasurementDisposer.js';
import { MeasurementUI } from './measurements/MeasurementUI.js';

/**
 * @class Measurements
 * @description
 * Pure orchestrator for all measurement-related functionalities.
 * This module follows the Coordinator pattern. It instantiates and wires up all the
 * specialized "worker" modules.
 */
export class Measurements {
    constructor(scene, logger, eventBus, collaboration) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.scene = scene;
        this.collaboration = collaboration; // For accessing annotation data

        // A group to hold all measurement visuals in the scene
        this.measurementGroup = new THREE.Group();
        this.measurementGroup.name = 'measurements';
        this.scene.add(this.measurementGroup);
        
        // --- NEW: Para Rastrear Destaque ---
        this.highlightedOriginals = new Map(); // Armazena {visual: originalMaterial}
        this.highlightedMeasurementId = null;
        // --- END NEW ---

        // --- 1. Instantiate All Worker Modules ---
        this.materials = new MeasurementMaterials();
        const sharedMaterials = this.materials.getMaterials();

        this.disposer = new MeasurementDisposer(this.measurementGroup, sharedMaterials, logger);

        this.distanceMeasurement = new DistanceMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus);
        this.areaMeasurement = new AreaMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus);
        this.surfaceAreaMeasurement = new SurfaceAreaMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus);
        this.angleMeasurement = new AngleMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus);
        this.volumeMeasurement = new VolumeMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus); // <-- 2. INSTANCIAR
        this.volumeBoxMeasurement = new VolumeBoxMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus); // <-- NOVO

        // This new worker handles all UI-related logic for measurements
        this.measurementUI = new MeasurementUI(eventBus, this);

        // --- 2. Wire Up Inter-Module Communication ---
        this._setupEventListeners();

        this.logger.info('Measurements Module: Initialized (Coordinator Pattern)');
    }

    /**
     * Sets up the event-based communication.
     * @private
     */
    _setupEventListeners() {
        // When any measurement is completed, or annotations change, update the UI.
        this.eventBus.on('measurement:distance:completed', () => this.measurementUI.update());
        this.eventBus.on('measurement:area:completed', () => this.measurementUI.update());
        this.eventBus.on('measurement:surfaceArea:completed', () => this.measurementUI.update());
        this.eventBus.on('measurement:angle:completed', () => this.measurementUI.update());
        this.eventBus.on('measurement:volume:completed', () => this.measurementUI.update()); // <-- 3. ADICIONAR LISTENER
        this.eventBus.on('measurement:volumeBox:completed', () => this.measurementUI.update()); // <-- NOVO
        this.eventBus.on('annotation:changed', () => this.measurementUI.update());
        
        // --- NEW: Ouvinte para destacar medição vindo da UI ---
        this.eventBus.on('measurement:highlight', (payload) => this._highlightMeasurement(payload.id));

        // When a tool changes, cancel any in-progress measurements.
        this.eventBus.on('tool:changed', () => {
            this.distanceMeasurement.cancelActiveMeasurement();
            this.areaMeasurement.cancelActiveMeasurement();
            this.surfaceAreaMeasurement.cancelActiveMeasurement();
            this.angleMeasurement.cancelActiveMeasurement();
            this.volumeMeasurement.cancelActiveMeasurement(); // <-- 4. ADICIONAR LIMPEZA
            this.volumeBoxMeasurement.cancelActiveMeasurement(); // <-- NOVO
            this._unhighlightCurrent(); // Limpa destaque ao trocar ferramenta
        });

        // Handle commands to clear or delete measurements.
        this.eventBus.on('measurement:clear:all', () => this.clearAllMeasurements());
        this.eventBus.on('measurement:delete', (payload) => {
            // Se o item deletado for o destacado, limpa o destaque
            if (payload.id === this.highlightedMeasurementId) {
                this._unhighlightCurrent();
            }
            this.clearMeasurement(payload.id);
        });
    }

    // --- NEW: Métodos de Destaque ---

    /**
     * Restaura os materiais originais da medição atualmente destacada.
     * @private
     */
    _unhighlightCurrent() {
        if (this.highlightedOriginals.size > 0) {
            this.highlightedOriginals.forEach((originalMaterial, visual) => {
                visual.material = originalMaterial;
            });
            this.highlightedOriginals.clear();
        }
        this.highlightedMeasurementId = null;
    }

    /**
     * Destaca uma medição pelo seu ID (local ou remota).
     * @param {string} id - O ID da medição para destacar.
     * @private
     */
    _highlightMeasurement(id) {
        // Se clicar no mesmo item, desativa o destaque
        if (id === this.highlightedMeasurementId) {
            this._unhighlightCurrent();
            return;
        }
        
        // Remove o destaque do item anterior
        this._unhighlightCurrent();

        // Armazena o ID do novo item destacado
        this.highlightedMeasurementId = id;

        // Cria materiais de destaque (brilho branco)
        const highlightFillMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff, // Branco
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthTest: false
        });
        const highlightLineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff, // Branco
            linewidth: 5,
            depthTest: false
        });

        // --- Encontra o visual ---
        let measurement = null;
        let visualGroup = null;

        // 1. Procura nas medições locais
        const modules = [this.distanceMeasurement, this.areaMeasurement, this.surfaceAreaMeasurement, this.angleMeasurement, this.volumeMeasurement, this.volumeBoxMeasurement];
        for (const module of modules) {
            measurement = module.getMeasurementById(id);
            if (measurement) break;
        }

        // 2. Procura nas anotações remotas (se estiver em modo colaborativo)
        if (!measurement && this.collaboration?.isConnected()) {
            visualGroup = this.collaboration.annotationSync.annotationRegistry.get(id);
        }

        // --- Aplica o destaque ---
        try {
            if (measurement) {
                // Caso 1: Encontrou um objeto de medição local
                measurement.visuals.lines.forEach(line => {
                    this.highlightedOriginals.set(line, line.material);
                    line.material = highlightLineMaterial;
                });
                if (measurement.visuals.fill) {
                    this.highlightedOriginals.set(measurement.visuals.fill, measurement.visuals.fill.material);
                    measurement.visuals.fill.material = highlightFillMaterial;
                }
            } else if (visualGroup) {
                // Caso 2: Encontrou um grupo de anotação remota
                visualGroup.traverse(child => {
                    if (child.isLine) {
                        this.highlightedOriginals.set(child, child.material);
                        child.material = highlightLineMaterial;
                    } else if (child.isMesh) {
                        this.highlightedOriginals.set(child, child.material);
                        child.material = highlightFillMaterial;
                    }
                });
            }
        } catch (e) {
            this.logger.error("Falha ao aplicar destaque", e);
            this.highlightedOriginals.clear(); // Limpa o cache em caso de erro
        }
    }
    
    // --- FIM DOS NOVOS MÉTODOS ---


    // --- PUBLIC API ---

    /**
     * Reúne todas as medições finalizadas (locais e remotas) e seus autores.
     * @returns {{distances: Array, areas: Array, surfaceAreas: Array, angles: Array, volumes: Array, volumeBoxes: Array}}
     */
    getMeasurementStats() {
        const stats = {
            distances: [],
            areas: [],
            surfaceAreas: [],
            angles: [],
            volumes: [], // <-- 5. ADICIONAR AO STATS
            volumeBoxes: [] // <-- NOVO
        };

        const isConnected = this.collaboration?.isConnected() || false;
        
        // --- NEW: Helper para buscar nomes ---
        const peerData = this.collaboration?.getPeerProfileData();
        const myPeerId = this.collaboration?.connectionManager?.myPeerId;
        const myName = peerData?.myProfile?.name || 'Você';

        const getPeerName = (peerId) => {
            if (!peerId) return myName; // Fallback
            if (peerId === myPeerId) return myName;
            return peerData?.peerProfiles?.get(peerId)?.name || 'Peer';
        };
        // --- FIM NEW ---

        // MODIFICADO: Agora *sempre* usamos o collaboration.getAnnotations()
        // se o módulo de colaboração existir, pois ele é a fonte única da verdade.
        if (this.collaboration) {
            const allAnnotations = this.collaboration.getAnnotations() || [];
            allAnnotations.forEach(ann => {
                const peerName = getPeerName(ann.peerId); // Pega o nome do autor

                if (ann.type === 'distance') {
                    stats.distances.push({ id: ann.id, value: ann.distance, peerName });
                } else if (ann.type === 'area') {
                    stats.areas.push({ id: ann.id, value: ann.area, peerName });
                } else if (ann.type === 'surfaceArea') {
                    stats.surfaceAreas.push({ id: ann.id, value: ann.surfaceArea, peerName });
                } else if (ann.type === 'angle' && ann.value !== undefined) { // <-- Lógica para Ângulo
                    stats.angles.push({ id: ann.id, value: ann.value, peerName });
                } else if (ann.type === 'volume') { // <-- 7. ADICIONAR AO STATS DE COLABORAÇÃO
                    stats.volumes.push({ id: ann.id, value: ann.volume, peerName });
                } else if (ann.type === 'volumeBox' && ann.volume !== undefined) { // <-- Lógica para VolumeBox
                    stats.volumeBoxes.push({ id: ann.id, value: ann.volume, peerName });
                }
            });
        } 
        // Este 'else' só executa se o módulo de colaboração falhar (modo offline total)
        else if (!isConnected) {
            // Se NÃO conectado, os módulos locais são a fonte da verdade.
            stats.distances.push(...this.distanceMeasurement.getFinishedMeasurements().map(m => ({ ...m, peerName: myName })));
            stats.areas.push(...this.areaMeasurement.getFinishedMeasurements().map(m => ({ ...m, peerName: myName })));
            stats.surfaceAreas.push(...this.surfaceAreaMeasurement.getFinishedMeasurements().map(m => ({ ...m, peerName: myName })));
            stats.angles.push(...this.angleMeasurement.getFinishedMeasurements().map(m => ({ ...m, peerName: myName })));
            stats.volumes.push(...this.volumeMeasurement.getFinishedMeasurements().map(m => ({ ...m, peerName: myName }))); // <-- 6. ADICIONAR AO STATS
            stats.volumeBoxes.push(...this.volumeBoxMeasurement.getFinishedMeasurements().map(m => ({ ...m, peerName: myName }))); // <-- NOVO
        }

        return stats;
    }

    /**
     * Clears a single measurement by its ID.
     * @param {string} id - The ID of the measurement to remove.
     */
    clearMeasurement(id) {
        // Se o item deletado for o destacado, limpa o destaque
        if (id === this.highlightedMeasurementId) {
            this._unhighlightCurrent();
        }
        
        const modules = [this.distanceMeasurement, this.areaMeasurement, this.surfaceAreaMeasurement, this.angleMeasurement, this.volumeMeasurement, this.volumeBoxMeasurement]; // <-- 8. ADICIONAR AO LOOP
        for (const module of modules) {
            const measurement = module.getMeasurementById(id);
            if (measurement) {
                this.disposer.disposeMeasurement(measurement);
                const index = module.measurements.indexOf(measurement);
                if (index > -1) {
                    module.measurements.splice(index, 1);
                }
                this.logger.info(`Measurements Coordinator: Cleared measurement ${id}`);
                this.measurementUI.update(); // Refresh UI after deletion
                return;
            }
        }
    }

    /**
     * Clears all local measurements and their visuals.
     */
    clearAllMeasurements() {
        this._unhighlightCurrent(); // Limpa qualquer destaque
        this.logger.info('Measurements Coordinator: Clearing all local measurements.');
        const allMeasurements = [
            ...this.distanceMeasurement.measurements,
            ...this.areaMeasurement.measurements,
            ...this.surfaceAreaMeasurement.measurements,
            ...this.angleMeasurement.measurements,
            ...this.volumeMeasurement.measurements, // <-- 9. ADICIONAR À LIMPEZA
            ...this.volumeBoxMeasurement.measurements // <-- NOVO
        ];

        this.disposer.disposeMeasurements(allMeasurements);

        this.distanceMeasurement.measurements = [];
        this.areaMeasurement.measurements = [];
        this.surfaceAreaMeasurement.measurements = [];
        this.angleMeasurement.measurements = [];
        this.volumeMeasurement.measurements = []; // <-- 10. LIMPAR ARRAY
        this.volumeBoxMeasurement.measurements = []; // <-- NOVO

        this.measurementUI.update();
    }
}