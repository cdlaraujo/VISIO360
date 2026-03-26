// ============================================================================
// FILE: src/core/ModelLoader.js (FIX #4 - Consistent Error Handling)
// ============================================================================

import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * @class ModelLoader
 * @description Handles loading 3D models from various sources with robust error handling.
 * ✅ FIX #4: All loading paths now have consistent try-catch error handling.
 */
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

    /**
     * ✅ FIX #4: Added try-catch wrapper for network errors
     */
    async fetchAndLoadModel(url, fileName) {
        try {
            this.logger.info(`ModelLoader: Fetching model from ${url}`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const blob = await response.blob();
            this.loadModelFromData(blob, fileName, url);
        } catch (error) {
            this.logger.error(`ModelLoader: Failed to fetch model from ${url}`, error);
            this.eventBus.emit('model:load:error', { 
                url, 
                fileName,
                error: error.message || 'Network error',
                type: 'network'
            });
        }
    }
    
    /**
     * ✅ FIX #4: Wrapped entire method in try-catch for robust error handling
     */
    loadModelFromData(fileData, fileName, originalUrl = null) {
        let localUrl = null;

        try {
            // Validate inputs
            if (!fileData) {
                throw new Error('No file data provided');
            }

            if (!fileName) {
                throw new Error('No file name provided');
            }

            // Create object URL
            localUrl = URL.createObjectURL(fileData);
            
            // Determine file extension
            const extension = this._getFileExtension(fileName);
            
            if (!extension) {
                throw new Error(`Cannot determine file extension from: ${fileName}`);
            }

            // Get appropriate loader
            const loader = this.loaders[extension];

            if (!loader) {
                throw new Error(`Unsupported file type: .${extension}. Supported types: ${Object.keys(this.loaders).join(', ')}`);
            }

            this.logger.info(`ModelLoader: Loading ${fileName} (${extension}) from blob`);

            // Progress callback
            const onProgress = (xhr) => {
                if (xhr.lengthComputable) {
                    const progress = (xhr.loaded / xhr.total) * 100;
                    this.eventBus.emit('model:loading:progress', { progress });
                }
            };

            // Error callback
            const onError = (error) => {
                this.logger.error(`ModelLoader: Error loading model data for ${fileName}`, error);
                
                // Cleanup object URL
                if (localUrl) {
                    URL.revokeObjectURL(localUrl);
                }

                // Emit error event
                this.eventBus.emit('model:load:error', { 
                    fileName,
                    error: error.message || 'Failed to parse model file',
                    type: 'parsing'
                });
            };

            // Success callback
            const onLoad = (loadedData) => {
                try {
                    // Process loaded data
                    let model;
                    
                    if (loadedData.scene) {
                        // GLTF/GLB format
                        model = loadedData.scene;
                    } else if (loadedData.isBufferGeometry) {
                        // PLY format (returns BufferGeometry)
                        const material = new THREE.MeshStandardMaterial({ 
                            color: 0xcccccc, 
                            vertexColors: loadedData.hasAttribute('color') 
                        });
                        model = new THREE.Mesh(loadedData, material);
                    } else {
                        throw new Error('Unknown model format returned by loader');
                    }

                    // Center the model
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    model.position.sub(center);
                    
                    // Rotate model (common convention: Y-up to Z-up)
                    model.rotation.x = -Math.PI / 2;
                    
                    // Set model metadata
                    model.name = fileName;
                    model.userData.url = originalUrl || `local-${fileName}`;
                    model.userData.loadedAt = new Date().toISOString();
                    model.userData.fileSize = fileData.size;

                    this.logger.info(`ModelLoader: Successfully loaded ${fileName} (${(fileData.size / 1024 / 1024).toFixed(2)}MB)`);

                    // Emit success event
                    this.eventBus.emit('model:loaded', { 
                        model, 
                        modelBlob: fileData,
                        fileName,
                        fileSize: fileData.size
                    });

                    // Cleanup object URL
                    URL.revokeObjectURL(localUrl);

                } catch (processingError) {
                    this.logger.error(`ModelLoader: Error processing loaded model ${fileName}`, processingError);
                    
                    // Cleanup object URL
                    if (localUrl) {
                        URL.revokeObjectURL(localUrl);
                    }

                    // Emit error event
                    this.eventBus.emit('model:load:error', { 
                        fileName,
                        error: processingError.message || 'Failed to process model',
                        type: 'processing'
                    });
                }
            };

            // Start loading
            loader.load(localUrl, onLoad, onProgress, onError);

        } catch (error) {
            // Catch any synchronous errors (validation, URL creation, etc.)
            this.logger.error(`ModelLoader: Failed to initiate model loading for ${fileName}`, error);
            
            // Cleanup object URL if it was created
            if (localUrl) {
                try {
                    URL.revokeObjectURL(localUrl);
                } catch (cleanupError) {
                    this.logger.warn('ModelLoader: Failed to cleanup object URL', cleanupError);
                }
            }

            // Emit error event
            this.eventBus.emit('model:load:error', { 
                fileName,
                error: error.message || 'Failed to load model',
                type: 'initialization'
            });
        }
    }

    /**
     * Extract file extension from filename
     * @param {string} fileName - The file name
     * @returns {string|null} The file extension (lowercase) or null
     * @private
     */
    _getFileExtension(fileName) {
        if (!fileName || typeof fileName !== 'string') {
            return null;
        }

        const match = fileName.match(/\.([^.?#]+)(?:[?#]|$)/i);
        return match ? match[1].toLowerCase() : null;
    }

    /**
     * Check if a file type is supported
     * @param {string} fileName - The file name
     * @returns {boolean} True if supported
     * @public
     */
    isFileTypeSupported(fileName) {
        const extension = this._getFileExtension(fileName);
        return extension && this.loaders.hasOwnProperty(extension);
    }

    /**
     * Get list of supported file extensions
     * @returns {Array<string>} Array of supported extensions
     * @public
     */
    getSupportedExtensions() {
        return Object.keys(this.loaders);
    }

    /**
     * Add a new loader for a file type
     * @param {string} extension - File extension (without dot)
     * @param {Object} loader - Three.js loader instance
     * @public
     */
    addLoader(extension, loader) {
        if (!extension || !loader) {
            this.logger.warn('ModelLoader: Invalid extension or loader provided');
            return false;
        }

        const normalizedExt = extension.toLowerCase().replace(/^\./, '');
        this.loaders[normalizedExt] = loader;
        this.logger.info(`ModelLoader: Added loader for .${normalizedExt} files`);
        return true;
    }

    /**
     * Remove a loader for a file type
     * @param {string} extension - File extension to remove
     * @public
     */
    removeLoader(extension) {
        const normalizedExt = extension.toLowerCase().replace(/^\./, '');
        if (this.loaders.hasOwnProperty(normalizedExt)) {
            delete this.loaders[normalizedExt];
            this.logger.info(`ModelLoader: Removed loader for .${normalizedExt} files`);
            return true;
        }
        return false;
    }
}

export default ModelLoader;