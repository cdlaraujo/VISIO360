/**
 * @class AnimationLoop
 * @description
 * A dedicated worker module responsible for managing the application's
 * requestAnimationFrame loop. Its sole purpose is to emit a global
 * 'app:update' event on each frame, serving as the application's heartbeat.
 */
export class AnimationLoop {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }

    /**
     * Starts the animation loop.
     */
    start() {
        this._tick();
    }

    /**
     * The core loop function that requests the next frame and emits the update event.
     * @private
     */
    _tick() {
        // This creates a perpetual loop that is synchronized with the browser's refresh rate.
        requestAnimationFrame(this._tick.bind(this));

        // Emit the global update event that other modules (like Renderer, InteractionController) listen to.
        this.eventBus.emit('app:update');
    }
}
