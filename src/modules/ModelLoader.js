import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

/**
 * @class ModelLoader
 * @description Lida com o carregamento de modelos 3D e se comunica
 * com o resto da aplicação via EventBus.
 */
export class ModelLoader {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.plyLoader = new PLYLoader();
    }

    /**
     * Prepara o ModelLoader para ouvir eventos de carregamento.
     */
    initialize() {
        this.eventBus.on('model:load', (payload) => this.loadModel(payload.url));
        this.logger.info('ModelLoader: Initialized and ready to load models.');
    }

    /**
     * Carrega um modelo 3D. Em vez de retornar uma Promise,
     * emite um evento de sucesso ou falha.
     * @param {string} url - O caminho para o arquivo do modelo.
     */
    loadModel(url) {
        this.logger.info(`ModelLoader: Received request to load model from: ${url}`);
        
        this.plyLoader.load(
            url,
            // Sucesso
            (geometry) => {
                geometry.computeBoundingBox();
                geometry.center();

                const material = new THREE.MeshStandardMaterial({
                    color: 0xcccccc,
                    vertexColors: true,
                });
                
                const model = new THREE.Mesh(geometry, material);
                model.name = url.split('/').pop();
                model.rotation.x = -Math.PI / 2;

                this.logger.info(`ModelLoader: Model "${model.name}" loaded successfully.`);
                // Emite o evento de sucesso com o modelo como payload
                this.eventBus.emit('model:loaded', { model });
            },
            // Progresso
            (xhr) => {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                this.eventBus.emit('model:loading:progress', { url, progress: percentComplete });
            },
            // Erro
            (error) => {
                this.logger.error('ModelLoader: An error occurred while loading the model.', error);
                // Emite o evento de erro
                this.eventBus.emit('model:load:error', { url, error });
            }
        );
    }
}
