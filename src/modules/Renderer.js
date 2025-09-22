import * as THREE from 'three';

/**
 * @class Renderer
 * @description Gerencia a configuração da cena e a renderização com THREE.js.
 */
export class Renderer {
    constructor(container, logger, eventBus) {
        this.container = container;
        this.logger = logger;
        this.eventBus = eventBus;

        this.scene = null;
        this.camera = null;
        this.webglRenderer = null;
    }

    /**
     * Configura a cena, a câmera e os listeners de eventos.
     */
    initialize() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        const fov = 50;
        const aspect = this.container.clientWidth / this.container.clientHeight;
        
        // **CORREÇÃO AQUI:** Diminuímos o 'near' plane para permitir um zoom muito mais próximo.
        const near = 0.001; 
        const far = 10000; // Aumentamos o 'far' para garantir que modelos grandes não sejam cortados.

        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera.position.set(0, 5, 10);

        this.webglRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.webglRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.webglRenderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.webglRenderer.domElement);
        
        this._setupLights();

        const gridHelper = new THREE.GridHelper(100, 100, 0xcccccc, 0x777777);
        this.scene.add(gridHelper);
        
        window.addEventListener('resize', this._onWindowResize.bind(this));
        
        this._setupEventListeners();

        this.logger.info('Renderer: Inicializado.');
        
        // Retorna instâncias essenciais para serem usadas por outros módulos
        return {
            camera: this.camera,
            domElement: this.webglRenderer.domElement
        };
    }

    _setupEventListeners() {
        this.eventBus.on('model:loaded', (payload) => {
            this.addObject(payload.model);
            this.focusOnObject(payload.model); // Continua focando a câmera na carga
        });

        // O Renderer agora só precisa atualizar a si mesmo no loop do app
        this.eventBus.on('app:update', () => this.render());
    }

    _setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(5, 10, 7.5).normalize();
        this.scene.add(directionalLight);
    }

    addObject(object) {
        if (object) {
            // Limpa a cena antes de adicionar um novo objeto para evitar sobreposição
            // Percorre ao contrário para evitar problemas ao remover itens da lista que está sendo iterada
            for (let i = this.scene.children.length - 1; i >= 0; i--) {
                const child = this.scene.children[i];
                if (child.isMesh) {
                    this.scene.remove(child);
                }
            }
            this.scene.add(object);
            this.logger.info(`Renderer: Objeto "${object.name}" adicionado à cena.`);
        } else {
            this.logger.warn('Renderer: Tentativa de adicionar um objeto inválido à cena.');
        }
    }
    
    focusOnObject(object) {
        // Lógica de posicionamento inicial da câmera ao carregar um modelo
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5; // Fator de distância
        
        // Garante que a câmera não fique dentro de modelos muito pequenos
        const minZ = box.min.z || 0.1;
        this.camera.position.set(center.x, center.y, center.z + Math.max(cameraZ, minZ));
        
        // Emite um evento para que o InteractionController atualize seu alvo
        this.eventBus.emit('camera:focus', { object });

        this.logger.info('Renderer: Posição da câmera ajustada para o novo objeto.');
    }

    render() {
        this.webglRenderer.render(this.scene, this.camera);
    }
    
    _onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.webglRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
}