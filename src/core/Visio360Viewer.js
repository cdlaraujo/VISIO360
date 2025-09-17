// src/core/Visio360Viewer.js
import * as THREE from 'three';
import { StateManager } from './StateManager.js';
import { EventBus } from './EventBus.js';
import { UIManager } from '../modules/UIManager.js';
import { SceneManager } from '../modules/SceneManager.js';
import { InteractionController } from '../modules/InteractionController.js';
import { ToolController } from '../modules/ToolController.js';

export class Visio360Viewer {
    constructor(container) {
        this.container = container;
        
        // 1. Inicializa os módulos centrais
        this.state = new StateManager();
        this.eventBus = new EventBus();
        
        // 2. Inicializa os módulos de funcionalidades, injetando as dependências
        // que cada um precisa.
        this.sceneManager = new SceneManager({ state: this.state, eventBus: this.eventBus });
        this.uiManager = new UIManager({ state: this.state, eventBus: this.eventBus, container: this.container });
        this.interactionController = new InteractionController({ 
            state: this.state, 
            eventBus: this.eventBus, 
            domElement: this.sceneManager.renderer.domElement 
        });
        this.toolController = new ToolController({ state: this.state, eventBus: this.eventBus, sceneManager: this.sceneManager });

        this.clock = new THREE.Clock();
    }

    init() {
        // Os módulos se autoconfiguram e ouvem os eventos necessários
        // em seus construtores ou em um método init() próprio.
        console.log('Visio360 Viewer Initialized');
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const delta = this.clock.getDelta();
        
        // Atualiza os módulos que precisam de um loop de renderização
        this.sceneManager.update(delta); // Para TWEEN, Controls, etc.
        this.uiManager.update(delta);     // Para o dashboard de FPS, etc.
    }
}
