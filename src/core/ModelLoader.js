// src/core/ModelLoader.js
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ModelLoader {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.loaders = {
            'gltf': new GLTFLoader(),
            'glb': new GLTFLoader(),
            'ply': new PLYLoader(),
        };
    }

    initialize() {
        this.eventBus.on('model:load', (payload) => {
            if (payload.fileData) {
                this.loadModelFromData(payload.fileData, payload.fileName);
            } else if (payload.url) {
                this.fetchAndLoadModel(payload.url, payload.fileName);
            }
        });
    }

    async fetchAndLoadModel(url, fileName) {
        try {
            this.logger.info(`Fetching model from ${url}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const blob = await response.blob();
            this.loadModelFromData(blob, fileName, url);
        } catch (error) {
            this.logger.error(`Failed to fetch model from ${url}`, error);
            this.eventBus.emit('model:load:error', { url, error });
        }
    }
    
    loadModelFromData(fileData, fileName, originalUrl = null) {
        const localUrl = URL.createObjectURL(fileData);
        // Best guess for extension if not obvious
        const extension = this._getFileExtension(fileName) || (fileData.type.includes('gltf') ? 'glb' : null);
        const loader = this.loaders[extension];

        if (!loader) {
            this.logger.error(`No loader for determined extension: ${extension}`);
            this.eventBus.emit('model:load:error', { error: new Error('Unsupported file type') });
            return;
        }

        const onProgress = (xhr) => {
            if (xhr.lengthComputable) {
                this.eventBus.emit('model:loading:progress', { progress: (xhr.loaded / xhr.total) * 100 });
            }
        };

        const onError = (error) => {
            this.logger.error(`Error loading model data for ${fileName}`, error);
            this.eventBus.emit('model:load:error', { error });
            URL.revokeObjectURL(localUrl);
        };
        
        loader.load(localUrl, (loadedData) => {
            let model;
            if (loadedData.scene) { model = loadedData.scene; } 
            else {
                const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, vertexColors: loadedData.hasAttribute('color') });
                model = new THREE.Mesh(loadedData, material);
            }
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            model.rotation.x = -Math.PI / 2;
            model.name = fileName;
            model.userData.url = originalUrl || `local-${fileName}`;
            
            this.eventBus.emit('model:loaded', { model, modelBlob: fileData });
            URL.revokeObjectURL(localUrl);
        }, onProgress, onError);
    }

    _getFileExtension(fileName) {
        const match = fileName.match(/\.([^.?#]+)(?:[?#]|$)/i);
        return match ? match[1].toLowerCase() : null;
    }
}