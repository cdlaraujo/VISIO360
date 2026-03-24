// src/modules/measurements/utils/MeasurementMaterials.js
// Cesium color config — replaces Three.js materials

export class MeasurementMaterials {
    constructor() {
        this.materials = {
            point:            Cesium.Color.RED,
            line:             Cesium.Color.RED,
            areaPoint:        Cesium.Color.LIME,
            areaLine:         Cesium.Color.LIME,
            areaFill:         Cesium.Color.LIME.withAlpha(0.3),
            anglePoint:       Cesium.Color.YELLOW,
            angleLine:        Cesium.Color.YELLOW,
            surfaceAreaPoint: Cesium.Color.fromCssColorString('#00aaff'),
            surfaceAreaLine:  Cesium.Color.fromCssColorString('#00aaff'),
            volumePoint:      Cesium.Color.MAGENTA,
            volumeLine:       Cesium.Color.MAGENTA,
            volumeFill:       Cesium.Color.MAGENTA.withAlpha(0.3),
            volumeBox:        Cesium.Color.CYAN.withAlpha(0.3),
            volumeBoxPoint:   Cesium.Color.CYAN,
            previewLine:      Cesium.Color.YELLOW.withAlpha(0.6)
        };
    }

    getMaterials() { return this.materials; }
    getMaterial(name) { return this.materials[name]; }
    dispose() {} // no-op in Cesium
}
