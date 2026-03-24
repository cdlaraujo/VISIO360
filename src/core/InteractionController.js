// src/core/InteractionController.js
// Replaces Three.js OrbitControls + Raycaster with Cesium.ScreenSpaceEventHandler + scene.pick()

export class InteractionController {
    constructor(viewer, logger, eventBus) {
        this.viewer = viewer;
        this.scene = viewer.scene;
        this.logger = logger;
        this.eventBus = eventBus;

        this.currentState = null;
        this.currentTool = 'none';

        this._handler = new Cesium.ScreenSpaceEventHandler(this.scene.canvas);
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Left click
        this._handler.setInputAction((click) => {
            if (!this.currentState) return;
            const position = this._pickPosition(click.position);
            if (position) {
                this.currentState.onClick(position, click.position, this);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Double click
        this._handler.setInputAction((click) => {
            if (this.currentState) {
                this.currentState.onDoubleClick(click, this);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        // Mouse move
        this._handler.setInputAction((movement) => {
            const position = this._pickPosition(movement.endPosition);
            if (this.currentState) {
                this.currentState.onMouseMove(position, this);
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Keyboard
        document.addEventListener('keydown', (event) => {
            if (this.currentState) {
                this.currentState.onKeyDown(event, this);
            }
        });

        // Tool changed
        this.eventBus.on('tool:changed', (payload) => {
            this.currentTool = payload.activeTool;
        });
    }

    /**
     * Pick a 3D world position from a screen position.
     * Tries scene objects first, falls back to globe/ellipsoid.
     */
    _pickPosition(screenPosition) {
        // Try to pick against scene geometry (models, 3D tiles)
        const cartesian = this.scene.pickPosition(screenPosition);
        if (cartesian && Cesium.defined(cartesian)) {
            return cartesian;
        }
        // Fallback: pick on ellipsoid
        return this.viewer.camera.pickEllipsoid(screenPosition);
    }

    setState(state) {
        // Disable/enable Cesium default camera controls based on state
        const isIdle = !state || state.constructor.name === 'IdleState';
        this.scene.screenSpaceCameraController.enableRotate = isIdle;
        this.scene.screenSpaceCameraController.enableTranslate = isIdle;
        this.scene.screenSpaceCameraController.enableZoom = isIdle;
        this.scene.screenSpaceCameraController.enableTilt = isIdle;
        this.scene.screenSpaceCameraController.enableLook = isIdle;

        this.currentState = state;
        this.logger.debug(`InteractionController: State changed to ${state?.constructor.name || 'null'}`);
    }

    setCursor(cursorType) {
        this.scene.canvas.style.cursor = cursorType || 'default';
    }

    // Kept for API compatibility with ToolController
    setOrbitControlsEnabled(enabled) {
        this.scene.screenSpaceCameraController.enableRotate = enabled;
        this.scene.screenSpaceCameraController.enableTranslate = enabled;
        this.scene.screenSpaceCameraController.enableZoom = enabled;
        this.scene.screenSpaceCameraController.enableTilt = enabled;
        this.scene.screenSpaceCameraController.enableLook = enabled;
    }

    resetCamera() {
        this.viewer.camera.flyHome();
    }
}
