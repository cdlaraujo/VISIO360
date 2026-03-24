// src/modules/measurements/common/BaseMeasurement.js
// Replaces Three.js scene/mesh with Cesium viewer.entities

export class BaseMeasurement {
    constructor(viewer, colors, logger, eventBus, toolName) {
        this.viewer = viewer;
        this.colors = colors;
        this.logger = logger;
        this.eventBus = eventBus;
        this.toolName = toolName;

        this.measurements = [];
        this.activeMeasurement = null;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('measurement:point:selected', (payload) => {
            if (payload.tool === this.toolName) {
                this._handlePointSelected(payload.point);
            }
        });
    }

    _handlePointSelected(point) {
        if (!this.activeMeasurement) this._startMeasurement();
        this.activeMeasurement.points.push(point);
        this._addPointVisual(point);
    }

    _startMeasurement() {
        this.activeMeasurement = {
            id: this._generateId(),
            type: this.toolName,
            points: [],
            visuals: { points: [], lines: [], fill: null, previewLine: null, labels: [] },
            finished: false
        };
        this.measurements.push(this.activeMeasurement);
        this.logger.info(`${this.constructor.name}: Started new measurement.`);
    }

    // --- Visual helpers (Cesium entities) ---

    _addPointVisual(point, color) {
        const entity = this.viewer.entities.add({
            position: point,
            point: {
                pixelSize: 10,
                color: color || this.colors.point,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        this.activeMeasurement.visuals.points.push(entity);
        return entity;
    }

    _addLineVisual(p1, p2, color) {
        const entity = this.viewer.entities.add({
            polyline: {
                positions: [p1, p2],
                width: 2,
                material: color || this.colors.line,
                depthFailMaterial: (color || this.colors.line).withAlpha(0.4),
                clampToGround: false
            }
        });
        this.activeMeasurement.visuals.lines.push(entity);
        return entity;
    }

    _addLabel(text, position, color) {
        const labelColor = color
            ? Cesium.Color.fromCssColorString(color)
            : Cesium.Color.WHITE;
        const entity = this.viewer.entities.add({
            position,
            label: {
                text,
                font: 'bold 14px sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                pixelOffset: new Cesium.Cartesian2(0, -10)
            }
        });
        this.activeMeasurement.visuals.labels.push(entity);
        return entity;
    }

    // --- Lifecycle ---

    cancelActiveMeasurement() {
        if (this.activeMeasurement && !this.activeMeasurement.finished) {
            this.eventBus.emit('measurement:delete', { id: this.activeMeasurement.id });
            this.activeMeasurement = null;
        }
    }

    getFinishedMeasurements() {
        return this.measurements
            .filter(m => m.finished)
            .map(m => ({ id: m.id, value: m.value ?? 0 }));
    }

    getMeasurementById(id) {
        return this.measurements.find(m => m.id === id);
    }

    _generateId() {
        return `${this.toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
