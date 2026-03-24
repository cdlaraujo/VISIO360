// src/modules/measurements/MeasurementRegistry.js
// Central registry for all measurement types (Cesium version)

import { DistanceMeasurement }   from './DistanceMeasurement.js';
import { AreaMeasurement }        from './AreaMeasurement.js';
import { SurfaceAreaMeasurement } from './SurfaceAreaMeasurement.js';
import { AngleMeasurement }       from './AngleMeasurement.js';
import { VolumeMeasurement }      from './VolumeMeasurement.js';
import { VolumeBoxMeasurement }   from './VolumeBoxMeasurement.js';

const registry   = new Map();
const byToolName = new Map();

export function register(descriptor) {
    registry.set(descriptor.id, descriptor);
    byToolName.set(descriptor.toolName, descriptor);
}

export function getAll()              { return [...registry.values()]; }
export function getById(id)           { return registry.get(id); }
export function getByToolName(name)   { return byToolName.get(name); }

// --- Helpers ---

function toCartesian3(pts) {
    return pts.map(p => new Cesium.Cartesian3(p.x, p.y, p.z));
}

function centroid(pts) {
    const sum = pts.reduce(
        (acc, p) => Cesium.Cartesian3.add(acc, p, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
    );
    return new Cesium.Cartesian3(sum.x / pts.length, sum.y / pts.length, sum.z / pts.length);
}

/**
 * createVisual: creates Cesium entities for remote (collaboration) annotations.
 * Returns an array of entity descriptors { position, polyline, label, polygon, point }
 * that can be added to viewer.entities. The caller (AnnotationSync) is responsible for
 * adding them to the viewer.
 */

// ---------------------------------------------------------------------------

register({
    id: 'distance',
    toolName: 'measure',
    eventName: 'measurement:distance:completed',
    stateType: 'point',
    statsKey: 'distances',

    createModule: (viewer, colors, logger, eventBus) =>
        new DistanceMeasurement(viewer, colors, logger, eventBus),

    serialize: (m) => ({
        distance: m.value,
        points: m.points.map(p => ({ x: p.x, y: p.y, z: p.z }))
    }),

    getStatValue: (ann, getPeerName) =>
        ({ id: ann.id, value: ann.distance, peerName: getPeerName(ann.peerId) }),

    createVisual: (annotation) => {
        const pts = toCartesian3(annotation.points);
        const mid = Cesium.Cartesian3.midpoint(pts[0], pts[1], new Cesium.Cartesian3());
        return [
            { polyline: { positions: pts, width: 2, material: Cesium.Color.CYAN, depthFailMaterial: Cesium.Color.CYAN.withAlpha(0.3) } },
            { position: mid, label: { text: `${annotation.distance.toFixed(2)}m`, fillColor: Cesium.Color.CYAN, font: 'bold 13px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } }
        ];
    }
});

// ---------------------------------------------------------------------------

register({
    id: 'area',
    toolName: 'area',
    eventName: 'measurement:area:completed',
    stateType: 'polygon',
    statsKey: 'areas',

    createModule: (viewer, colors, logger, eventBus) =>
        new AreaMeasurement(viewer, colors, logger, eventBus),

    serialize: (m) => ({
        area: m.value,
        points: m.points.map(p => ({ x: p.x, y: p.y, z: p.z }))
    }),

    getStatValue: (ann, getPeerName) =>
        ({ id: ann.id, value: ann.area, peerName: getPeerName(ann.peerId) }),

    createVisual: (annotation) => {
        const pts = toCartesian3(annotation.points);
        const c = centroid(pts);
        return [
            { polyline: { positions: [...pts, pts[0]], width: 2, material: Cesium.Color.LIME, depthFailMaterial: Cesium.Color.LIME.withAlpha(0.3) } },
            { polygon: { hierarchy: new Cesium.PolygonHierarchy(pts), material: Cesium.Color.LIME.withAlpha(0.3), perPositionHeight: true } },
            { position: c, label: { text: `${annotation.area.toFixed(2)}m²`, fillColor: Cesium.Color.LIME, font: 'bold 13px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } }
        ];
    }
});

// ---------------------------------------------------------------------------

register({
    id: 'surfaceArea',
    toolName: 'surfaceArea',
    eventName: 'measurement:surfaceArea:completed',
    stateType: 'polygon',
    statsKey: 'surfaceAreas',

    createModule: (viewer, colors, logger, eventBus) =>
        new SurfaceAreaMeasurement(viewer, colors, logger, eventBus),

    serialize: (m) => ({
        surfaceArea: m.value,
        points: m.points.map(p => ({ x: p.x, y: p.y, z: p.z }))
    }),

    getStatValue: (ann, getPeerName) =>
        ({ id: ann.id, value: ann.surfaceArea, peerName: getPeerName(ann.peerId) }),

    createVisual: (annotation) => {
        const pts = toCartesian3(annotation.points);
        const c = centroid(pts);
        const color = Cesium.Color.fromCssColorString('#00aaff');
        return [
            { polyline: { positions: [...pts, pts[0]], width: 2, material: color, depthFailMaterial: color.withAlpha(0.3) } },
            { position: c, label: { text: `~${annotation.surfaceArea.toFixed(2)}m²`, fillColor: color, font: 'bold 13px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } }
        ];
    }
});

// ---------------------------------------------------------------------------

register({
    id: 'angle',
    toolName: 'angle',
    eventName: 'measurement:angle:completed',
    stateType: 'point',
    statsKey: 'angles',

    createModule: (viewer, colors, logger, eventBus) =>
        new AngleMeasurement(viewer, colors, logger, eventBus),

    serialize: (m) => ({
        value: m.value,
        points: m.points.map(p => ({ x: p.x, y: p.y, z: p.z }))
    }),

    getStatValue: (ann, getPeerName) =>
        ann.value !== undefined
            ? { id: ann.id, value: ann.value, peerName: getPeerName(ann.peerId) }
            : null,

    createVisual: (annotation) => {
        const pts = toCartesian3(annotation.points);
        return [
            { polyline: { positions: [pts[0], pts[1]], width: 2, material: Cesium.Color.YELLOW, depthFailMaterial: Cesium.Color.YELLOW.withAlpha(0.3) } },
            { polyline: { positions: [pts[0], pts[2]], width: 2, material: Cesium.Color.YELLOW, depthFailMaterial: Cesium.Color.YELLOW.withAlpha(0.3) } },
            { position: pts[0], label: { text: `${annotation.value.toFixed(2)}°`, fillColor: Cesium.Color.YELLOW, font: 'bold 13px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } }
        ];
    }
});

// ---------------------------------------------------------------------------

register({
    id: 'volume',
    toolName: 'volume',
    eventName: 'measurement:volume:completed',
    stateType: 'polygon',
    statsKey: 'volumes',

    createModule: (viewer, colors, logger, eventBus) =>
        new VolumeMeasurement(viewer, colors, logger, eventBus),

    serialize: (m) => ({
        volume: m.value,
        points: m.points.map(p => ({ x: p.x, y: p.y, z: p.z }))
    }),

    getStatValue: (ann, getPeerName) =>
        ({ id: ann.id, value: ann.volume, peerName: getPeerName(ann.peerId) }),

    createVisual: (annotation) => {
        const pts = toCartesian3(annotation.points);
        const c = centroid(pts);
        return [
            { polyline: { positions: [...pts, pts[0]], width: 2, material: Cesium.Color.MAGENTA, depthFailMaterial: Cesium.Color.MAGENTA.withAlpha(0.3) } },
            { position: c, label: { text: `${annotation.volume.toFixed(2)}m³`, fillColor: Cesium.Color.MAGENTA, font: 'bold 13px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } }
        ];
    }
});

// ---------------------------------------------------------------------------

register({
    id: 'volumeBox',
    toolName: 'volumeBox',
    eventName: 'measurement:volumeBox:completed',
    stateType: 'point',
    statsKey: 'volumeBoxes',

    createModule: (viewer, colors, logger, eventBus) =>
        new VolumeBoxMeasurement(viewer, colors, logger, eventBus),

    serialize: (m) => ({
        volume: m.value,
        points: m.points.map(p => ({ x: p.x, y: p.y, z: p.z }))
    }),

    getStatValue: (ann, getPeerName) =>
        ann.volume !== undefined
            ? { id: ann.id, value: ann.volume, peerName: getPeerName(ann.peerId) }
            : null,

    createVisual: (annotation) => {
        const [p1, p2] = toCartesian3(annotation.points);
        const c = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());
        return [
            { position: c, label: { text: `${annotation.volume.toFixed(2)}m³`, fillColor: Cesium.Color.CYAN, font: 'bold 13px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } }
        ];
    }
});
