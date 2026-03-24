// src/core/CesiumViewer.js
// Replaces Renderer.js + SceneManager.js + AnimationLoop.js

export class CesiumViewer {
    constructor(containerId, logger, eventBus) {
        this.containerId = containerId;
        this.logger = logger;
        this.eventBus = eventBus;
        this.viewer = null;
    }

    initialize() {
        Cesium.Ion.defaultAccessToken = '';

        this.viewer = new Cesium.Viewer(this.containerId, {
            timeline: false,
            animation: false,
            vrButton: false,
            sceneModePicker: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: true,
            navigationHelpButton: false,
            infoBox: false,
            scene3DOnly: true,
            showCreditContainer: false,
            imageryProvider: false,
            terrainProvider: new Cesium.EllipsoidTerrainProvider()
        });

        // Keep globe ALIVE for raycasting (zoom anchor), just make it invisible.
        // globe.show = false breaks Cesium's zoom: pivot falls back to Cartesian3.ZERO
        // (center of Earth) and every scroll zooms toward the core indefinitely.
        this.viewer.scene.globe.baseColor = Cesium.Color.BLACK;
        this.viewer.scene.backgroundColor = Cesium.Color.BLACK;
        this.viewer.scene.skyBox.show = false;
        this.viewer.scene.sun.show = false;
        this.viewer.scene.moon.show = false;
        this.viewer.scene.skyAtmosphere.show = false;

        // Start camera at a useful altitude (Cesium default is ~20,000km over N. America).
        this.viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(0.0, 0.0, 2000000.0),
            orientation: {
                heading: 0.0,
                pitch: Cesium.Math.toRadians(-90.0),
                roll: 0.0
            }
        });

        // Grace period: block camera controls on the first render frame to absorb
        // OS-level scroll/focus events that Edge delivers when the window gains focus.
        // Must be postRender (not synchronous) — ToolController.setState(idleState)
        // re-enables controls synchronously during init, so we override it here.
        const sscc = this.viewer.scene.screenSpaceCameraController;
        const unsubscribe = this.viewer.scene.postRender.addEventListener(() => {
            sscc.enableZoom      = false;
            sscc.enableRotate    = false;
            sscc.enableTilt      = false;
            sscc.enableTranslate = false;
            unsubscribe();
            setTimeout(() => {
                sscc.enableZoom      = true;
                sscc.enableRotate    = true;
                sscc.enableTilt      = true;
                sscc.enableTranslate = true;
            }, 500);
        });

        this._trackFps();
        this._trackCoordinates();

        this.logger.info('CesiumViewer: Inicializado.');

        return {
            viewer: this.viewer,
            scene: this.viewer.scene
        };
    }

    flyTo(target) {
        this.viewer.flyTo(target);
    }

    zoomTo(target) {
        this.viewer.zoomTo(target);
    }

    _trackFps() {
        const fpsEl = document.getElementById('fps-counter');
        if (!fpsEl) return;
        this.viewer.scene.postRender.addEventListener(() => {
            const fps = Math.round(1 / this.viewer.clock.lastSystemTime * 1000) || 0;
            fpsEl.textContent = `FPS: ${this.viewer.scene.lastRenderTime ? Math.round(this.viewer.scene.frameState.frameNumber / (performance.now() / 1000)) : '-'}`;
        });
        // Simpler FPS using requestAnimationFrame
        let last = performance.now();
        let frames = 0;
        const loop = () => {
            frames++;
            const now = performance.now();
            if (now - last >= 1000) {
                fpsEl.textContent = `FPS: ${frames}`;
                frames = 0;
                last = now;
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    _trackCoordinates() {
        const coordEl = document.getElementById('coordinates');
        if (!coordEl) return;
        const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        handler.setInputAction((movement) => {
            const cartesian = this.viewer.camera.pickEllipsoid(movement.endPosition);
            if (cartesian) {
                const carto = Cesium.Cartographic.fromCartesian(cartesian);
                const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(4);
                const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(4);
                const alt = (carto.height).toFixed(1);
                coordEl.textContent = `Lon: ${lon} | Lat: ${lat} | Alt: ${alt}m`;
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }
}
