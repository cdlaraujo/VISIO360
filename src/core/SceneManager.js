// src/core/SceneManager.js
import * as THREE from 'three';

/**
 * @class SceneManager
 * @description Gerencia a cena, iluminação e objetos auxiliares do Three.js.
 */
export class SceneManager {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.scene = null;

        this._setupEventListeners();
    }

    initialize() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        this._setupLights();
        this._setupHelpers();

        this.logger.info('SceneManager: Inicializado.');
        
        // Retorna a cena para ser usada por outros módulos
        return {
            scene: this.scene
        };
    }

    _setupEventListeners() {
        this.eventBus.on('model:loaded', (payload) => {
            this.addObject(payload.model);
        });
    }

    _setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(5, 10, 7.5).normalize();
        this.scene.add(directionalLight);
    }

    _setupHelpers() {
        const gridHelper = new THREE.GridHelper(100, 100, 0xcccccc, 0x777777);
        this.scene.add(gridHelper);
    }

    addObject(object) {
        if (object) {
            // Limpa a cena antes de adicionar um novo objeto para evitar sobreposição
            for (let i = this.scene.children.length - 1; i >= 0; i--) {
                const child = this.scene.children[i];
                if (child.isMesh) {
                    this.scene.remove(child);
                }
            }
            this.scene.add(object);
            this.logger.info(`SceneManager: Objeto "${object.name}" adicionado à cena.`);
        } else {
            this.logger.warn('SceneManager: Tentativa de adicionar um objeto inválido à cena.');
        }
    }
}