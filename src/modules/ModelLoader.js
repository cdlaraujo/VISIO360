import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'; // Descomente para adicionar suporte a OBJ

/**
 * @class ModelLoader
 * @description Lida com o carregamento de modelos 3D usando o loader apropriado.
 */
export class ModelLoader {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.loaders = {
            'ply': new PLYLoader(),
            'gltf': new GLTFLoader(),
            'glb': new GLTFLoader(),
            // 'obj': new OBJLoader(), // Descomente para adicionar suporte a OBJ
        };
    }

    initialize() {
        this.eventBus.on('model:load', (payload) => this.loadModel(payload.url, payload.fileName));
        this.logger.info('ModelLoader: Inicializado e pronto para carregar modelos.');
    }
    
    /**
     * Obtém a extensão de um arquivo a partir do seu nome.
     * @param {string} fileName - O nome do arquivo (ex: 'modelo.ply').
     * @returns {string|null} A extensão em minúsculas ou null.
     */
    _getFileExtension(fileName) {
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot === -1) {
            return null;
        }
        return fileName.slice(lastDot + 1).toLowerCase();
    }

    loadModel(url, fileName) {
        const extension = this._getFileExtension(fileName);
        const loader = this.loaders[extension];

        if (!loader) {
            const errorMsg = `Nenhum loader encontrado para a extensão de arquivo: "${extension}".`;
            this.logger.error(errorMsg);
            this.eventBus.emit('model:load:error', { url, error: new Error(errorMsg) });
            return;
        }

        this.logger.info(`ModelLoader: Carregando modelo "${fileName}" com o loader de ${extension.toUpperCase()}.`);
        
        loader.load(
            url,
            // Sucesso
            (loadedData) => {
                let model;
                let geometry;

                // GLTFLoader retorna uma cena, PLYLoader retorna uma geometria
                if (loadedData.scene) {
                    model = loadedData.scene.children[0];
                    geometry = model.geometry;
                } else {
                    geometry = loadedData;
                    geometry.computeVertexNormals();
                    const material = new THREE.MeshStandardMaterial({
                        color: 0xcccccc,
                        vertexColors: true,
                    });
                    model = new THREE.Mesh(geometry, material);
                }

                geometry.computeBoundingBox();
                geometry.center();

                model.name = fileName;
                model.rotation.x = -Math.PI / 2; // Rotação padrão

                this.logger.info(`ModelLoader: Modelo "${model.name}" carregado com sucesso.`);
                this.eventBus.emit('model:loaded', { model });
            },
            // Progresso
            (xhr) => {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                this.eventBus.emit('model:loading:progress', { url, progress: percentComplete });
            },
            // Erro
            (error) => {
                this.logger.error(`ModelLoader: Erro ao carregar o modelo ${fileName}.`, error);
                this.eventBus.emit('model:load:error', { url, error });
            }
        );
    }
}