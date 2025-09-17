// src/modules/SceneManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import Logger from '../utils/Logger.js';

export class SceneManager {
    constructor({ state, eventBus }) {
        this.state = state;
        this.eventBus = eventBus;
        this.origin = { module: 'SceneManager', function: 'constructor' };

        this._setupScene();
        this._setupLights();
        this._setupControls();
        this._setupLoaders();
        
        this.subscribeToEvents();
        
        Logger.info(this.origin, 'SceneManager initialized.');
    }

    _setupScene() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);

        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.state.set({ scene, camera, renderer });

        window.addEventListener('resize', this._onWindowResize.bind(this));
    }

    _setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);
    }

    _setupControls() {
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableRotate = false;
        this.orbitControls.enablePan = true;
    }

    _setupLoaders() {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/');
        this.gltfLoader = new GLTFLoader();
        this.gltfLoader.setDRACOLoader(dracoLoader);
        this.objLoader = new OBJLoader();
        this.stlLoader = new STLLoader();
        this.plyLoader = new PLYLoader();
    }
    
    subscribeToEvents() {
        this.eventBus.on('model:load_request', async ({ url, fileName }) => {
            this.eventBus.emit('ui:show_loading');
            try {
                const model = await this._loadModel(url, fileName, (progress) => {
                    this.eventBus.emit('ui:update_loading', { progress });
                });

                this.clearScene();
                const { pivot, center, size } = this._frameObject(model);
                this.scene.add(pivot);

                this.state.set({ targetModel: model, pivot, allMeasurements: [], currentPoints: [] });
                this.eventBus.emit('model:loaded', { model, fileName, center, size });

            } catch (error) {
                Logger.error({ ...this.origin, function: 'on:model:load_request' }, 'Failed to load model.', { error });
                this.eventBus.emit('ui:show_error', { message: `Failed to load ${fileName}: ${error.message}` });
            }
        });
        
        this.eventBus.on('scene:add', ({ object }) => object && this.scene.add(object));
        this.eventBus.on('scene:remove', ({ object }) => object && this.scene.remove(object));

        this.eventBus.on('controls:set_target', ({ target }) => {
            this.orbitControls.target.copy(target);
        });
    }

    async _loadModel(url, fileName, onProgressCallback) {
        const extension = fileName.split('.').pop().toLowerCase();
        const onProgress = (xhr) => {
            if (xhr.lengthComputable) {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                onProgressCallback(percent);
            }
        };

        switch (extension) {
            case 'glb':
            case 'gltf':
                const gltf = await this.gltfLoader.loadAsync(url, onProgress);
                return gltf.scene;
            case 'obj':
                return await this.objLoader.loadAsync(url, onProgress);
            case 'stl':
                const stlGeo = await this.stlLoader.loadAsync(url, onProgress);
                stlGeo.computeVertexNormals();
                const stlMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, specular: 0x111111, shininess: 200 });
                return new THREE.Mesh(stlGeo, stlMat);
            case 'ply':
                const plyGeo = await this.plyLoader.loadAsync(url, onProgress);
                plyGeo.computeVertexNormals();
                const hasColors = plyGeo.hasAttribute('color');
                const plyMat = new THREE.MeshStandardMaterial({ vertexColors: hasColors, color: hasColors ? 0xffffff : 0xaaaaaa });
                return new THREE.Mesh(plyGeo, plyMat);
            default:
                throw new Error(`Unsupported file format: .${extension}`);
        }
    }
    
    _frameObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        const center = sphere.center;
        const size = sphere.radius * 2 || 1;

        const pivot = new THREE.Group();
        pivot.position.copy(center);
        object.position.sub(center);
        pivot.add(object);

        this.camera.position.copy(center);
        this.camera.position.x += size * 1.5;
        this.camera.position.y += size * 0.5;
        this.camera.position.z += size * 1.5;
        this.camera.lookAt(center);

        this.orbitControls.target.copy(center);
        this.orbitControls.update();
        
        return { pivot, center, size };
    }

    clearScene() {
        const { pivot, allMeasurements } = this.state.get();
        if (pivot) {
            this.scene.remove(pivot);
            // Dispose logic...
        }
        if (allMeasurements) {
            allMeasurements.forEach(group => this.scene.remove(group));
            // Dispose logic...
        }
    }

    _onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    getRendererDomElement() {
        return this.renderer.domElement;
    }
    
    update() {
        this.orbitControls.update();
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }
}
