// src/core/ModelLoader.js
// Handles: glTF/glb (Cesium.Model), 3D Tiles (Cesium3DTileset), CZML

export class ModelLoader {
    constructor(viewer, logger, eventBus) {
        this.viewer = viewer;
        this.logger = logger;
        this.eventBus = eventBus;
        this._currentPrimitive = null;
    }

    initialize() {
        this.eventBus.on('model:load', (payload) => {
            if (payload.fileData) {
                this._loadFromFile(payload.fileData, payload.fileName);
            } else if (payload.url) {
                this._loadFromUrl(payload.url, payload.fileName || payload.url);
            }
        });
    }

    async _loadFromUrl(url, fileName) {
        const ext = this._ext(url);
        this.logger.info(`ModelLoader: Loading from URL — ${url} (${ext})`);
        try {
            if (ext === 'json' || ext === 'b3dm' || url.includes('tileset')) {
                await this._load3DTileset(url, fileName);
            } else if (ext === 'czml') {
                await this._loadCzml(url, fileName);
            } else {
                // glTF/glb via URL
                await this._loadGltfUrl(url, fileName);
            }
        } catch (err) {
            this._emitError(fileName, err.message, 'network');
        }
    }

    async _loadFromFile(fileData, fileName) {
        const ext = this._ext(fileName);
        this.logger.info(`ModelLoader: Loading file — ${fileName} (${ext})`);
        const localUrl = URL.createObjectURL(fileData);
        try {
            if (ext === 'glb' || ext === 'gltf') {
                await this._loadGltfUrl(localUrl, fileName, fileData.size);
            } else if (ext === 'czml') {
                await this._loadCzml(localUrl, fileName);
            } else {
                throw new Error(`Formato não suportado: .${ext}. Use .glb, .gltf, .czml ou URL de 3D Tiles.`);
            }
        } catch (err) {
            URL.revokeObjectURL(localUrl);
            this._emitError(fileName, err.message, 'parsing');
        }
    }

    async _load3DTileset(url, fileName) {
        this._clearScene();
        const tileset = new Cesium.Cesium3DTileset({ url });
        await this.viewer.scene.primitives.add(tileset).readyPromise;
        this._currentPrimitive = tileset;
        this.viewer.zoomTo(tileset);
        this.eventBus.emit('model:loaded', {
            model: tileset,
            modelBlob: null,
            fileName,
            fileSize: 0,
            format: '3D Tiles'
        });
        this.logger.info(`ModelLoader: 3D Tileset loaded — ${fileName}`);
    }

    async _loadGltfUrl(url, fileName, fileSize = 0) {
        this._clearScene();
        const entity = this.viewer.entities.add({
            name: fileName,
            position: Cesium.Cartesian3.fromDegrees(0, 0, 0),
            model: {
                uri: url,
                minimumPixelSize: 64,
                maximumScale: 20000
            }
        });
        await this.viewer.zoomTo(entity);
        this._currentPrimitive = entity;
        this.eventBus.emit('model:loaded', {
            model: entity,
            modelBlob: null,
            fileName,
            fileSize,
            format: this._ext(fileName).toUpperCase()
        });
        this.logger.info(`ModelLoader: glTF/glb loaded — ${fileName}`);
    }

    async _loadCzml(url, fileName) {
        this._clearScene();
        const dataSource = await Cesium.CzmlDataSource.load(url);
        await this.viewer.dataSources.add(dataSource);
        this._currentPrimitive = dataSource;
        this.viewer.flyTo(dataSource);
        this.eventBus.emit('model:loaded', {
            model: dataSource,
            modelBlob: null,
            fileName,
            fileSize: 0,
            format: 'CZML'
        });
        this.logger.info(`ModelLoader: CZML loaded — ${fileName}`);
    }

    _clearScene() {
        if (this._currentPrimitive) {
            if (this._currentPrimitive.isCesium3DTileset) {
                this.viewer.scene.primitives.remove(this._currentPrimitive);
            } else if (this._currentPrimitive.isDataSource) {
                this.viewer.dataSources.remove(this._currentPrimitive);
            } else {
                this.viewer.entities.remove(this._currentPrimitive);
            }
            this._currentPrimitive = null;
        }
    }

    _emitError(fileName, message, type) {
        this.logger.error(`ModelLoader: ${message}`);
        this.eventBus.emit('model:load:error', { fileName, error: message, type });
    }

    _ext(name) {
        const match = (name || '').match(/\.([^.?#]+)(?:[?#]|$)/i);
        return match ? match[1].toLowerCase() : '';
    }

    getSupportedExtensions() {
        return ['glb', 'gltf', 'czml'];
    }
}

export default ModelLoader;
