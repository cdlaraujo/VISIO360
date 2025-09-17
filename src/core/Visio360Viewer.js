// src/core/Visio360Viewer.js
import * as THREE from 'three';
import StateManager from './StateManager.js';
import { EventBus } from './EventBus.js';
import { UIManager } from '../modules/UIManager.js';
import { SceneManager } from '../modules/SceneManager.js';
import { InteractionController } from '../modules/InteractionController.js';
import { ToolController } from '../modules/ToolController.js';
import Logger from '../utils/Logger.js';

export class Visio360Viewer {
    constructor(container) {
        this.logger = new Logger('Visio360Viewer');
        this.container = container;
        
        this.state = new StateManager();
        this.eventBus = new EventBus();
        
        // 1. Cria o SceneManager PRIMEIRO, pois ele cria o canvas (renderer.domElement)
        this.sceneManager = new SceneManager({ state: this.state, eventBus: this.eventBus });

        // 2. AGORA podemos criar o UIManager, passando o canvas que o SceneManager criou
        this.uiManager = new UIManager({ 
            state: this.state, 
            eventBus: this.eventBus, 
            container: this.container,
            rendererDomElement: this.sceneManager.getDomElement() // Passa o elemento do DOM
        });

        // 3. Os outros módulos podem ser inicializados
        this.interactionController = new InteractionController({ 
            state: this.state, 
            eventBus: this.eventBus, 
            domElement: this.sceneManager.getDomElement()
        });
        this.toolController = new ToolController({ 
            state: this.state, 
            eventBus: this.eventBus, 
            sceneManager: this.sceneManager 
        });

        this.clock = new THREE.Clock();
        this.logger.info('Core modules initialized.');
    }

    init() {
        this.logger.info('Visio360 Viewer Initialized');
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();
        
        this.sceneManager.update(delta);
        this.uiManager.update(delta);
        
        // Renderiza a cena
        this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    }
}