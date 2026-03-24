// src/modules/measurements/utils/MeasurementDisposer.js
// Removes Cesium entities from viewer.entities

export class MeasurementDisposer {
    constructor(viewer, logger) {
        this.viewer = viewer;
        this.logger = logger;
    }

    disposeMeasurement(measurement) {
        if (!measurement?.visuals) return;

        const { points, lines, fill, previewLine, labels } = measurement.visuals;

        [...(points || []), ...(lines || []), ...(labels || [])].forEach(e => {
            if (e) this.viewer.entities.remove(e);
        });

        if (fill) this.viewer.entities.remove(fill);
        if (previewLine) this.viewer.entities.remove(previewLine);

        this.logger.debug(`MeasurementDisposer: Disposed measurement ${measurement.id}`);
    }

    disposeMeasurements(measurements) {
        if (!Array.isArray(measurements)) return;
        measurements.forEach(m => this.disposeMeasurement(m));
        this.logger.info(`MeasurementDisposer: Disposed ${measurements.length} measurements`);
    }

    disposeSharedMaterials() {} // no-op in Cesium
}
