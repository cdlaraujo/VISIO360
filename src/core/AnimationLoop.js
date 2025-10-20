/**
 * @class AnimationLoop
 * @description
 * A dedicated worker module responsible for managing the application's
 * requestAnimationFrame loop. Its purpose is to emit distinct events
 * for time-critical visual updates and lower-frequency background tasks.
 */
export class AnimationLoop {
    constructor(eventBus) {
        this.eventBus = eventBus;
        // Introduced state to manage low-frequency updates
        this.lastTickTime = performance.now();
        this.tickInterval = 100; // 100ms interval = 10 updates per second (10Hz)
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

        const now = performance.now();

        // 1. High-Frequency Event (60Hz) - for visual/controls updates
        // This serves as the application's render heartbeat.
        this.eventBus.emit('app:frame');

        // 2. Low-Frequency Event (10Hz) - for background tasks, non-critical UI updates
        if (now - this.lastTickTime > this.tickInterval) {
            this.eventBus.emit('app:tick', { delta: now - this.lastTickTime });
            this.lastTickTime = now;
        }
    }
}
