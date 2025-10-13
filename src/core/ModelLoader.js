// src/core/ModelLoader.js
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * @class ModelLoader
 * @description Handles loading 3D models from URLs using the appropriate Three.js loader.
 */
export class ModelLoader {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.loaders = {
            'ply': new PLYLoader(),
            'gltf': new GLTFLoader(),
            'glb': new GLTFLoader(),
        };
    }

    initialize() {
        this.eventBus.on('model:load', (payload) => this.loadModel(payload.url, payload.fileName));
        this.logger.info('ModelLoader: Ready to load models.');
    }

    /**
     * Gets the file extension from a file name.
     * @param {string} fileName - The name of the file (e.g., 'model.ply').
     * @returns {string|null} The extension in lowercase or null if not found.
     * @private
     */
    _getFileExtension(fileName) {
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot === -1) return null;
        return fileName.slice(lastDot + 1).toLowerCase();
    }

    /**
     * Loads a 3D model from a given URL.
     * @param {string} url - The URL of the model file.
     * @param {string} fileName - The name of the file.
     */
    loadModel(url, fileName) {
        const extension = this._getFileExtension(fileName);
        const loader = this.loaders[extension];

        if (!loader) {
            const errorMsg = `No loader available for file extension: "${extension}".`;
            this.logger.error(errorMsg);
            this.eventBus.emit('model:load:error', { url, error: new Error(errorMsg) });
            return;
        }

        this.logger.info(`ModelLoader: Loading "${fileName}" using ${extension.toUpperCase()} loader.`);

        loader.load(
            url,
            // --- Success Callback ---
            (loadedData) => {
                let model;
                let geometry;

                // GLTFLoader returns a scene object, PLYLoader returns geometry
                if (loadedData.scene) {
                    model = loadedData.scene;
                } else {
                    geometry = loadedData;
                    geometry.computeVertexNormals();
                    const material = new THREE.MeshStandardMaterial({
                        color: 0xcccccc,
                        vertexColors: geometry.hasAttribute('color')
                    });
                    model = new THREE.Mesh(geometry, material);
                }

                // Center the model's geometry
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.sub(center);
                model.rotation.x = -Math.PI / 2; // Default rotation

                model.name = fileName;
                // **CRITICAL CHANGE**: Attach the source URL to the model object
                model.userData.url = url;

                this.logger.info(`ModelLoader: Model "${model.name}" loaded successfully.`);
                this.eventBus.emit('model:loaded', { model });
            },
            // --- Progress Callback ---
            (xhr) => {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                this.eventBus.emit('model:loading:progress', { url, progress: percentComplete });
            },
            // --- Error Callback ---
            (error) => {
                this.logger.error(`ModelLoader: Error loading model from ${fileName}.`, error);
                this.eventBus.emit('model:load:error', { url, error });
                // Also hide spinner on error
                const spinner = document.getElementById('loading');
                if(spinner) spinner.style.display = 'none';
                alert(`Erro ao carregar o modelo: ${fileName}. Verifique a URL e o console para mais detalhes.`);
            }
        );
    }
}