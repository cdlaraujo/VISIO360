// src/utils/DrawingUtils.js
import * as THREE from 'three';

/**
 * Creates a text label as a Three.js Sprite.
 * This centralized utility is used by all measurement tools to ensure a consistent look and feel.
 * @param {string} text - The text to display on the label.
 * @param {string} color - The CSS color of the text (e.g., '#ff0000').
 * @returns {THREE.Sprite} A Three.js Sprite object ready to be added to the scene.
 */
export function createTextSprite(text, color) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512; // High resolution for sharp text
    canvas.height = 128;

    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Text style
    context.font = 'Bold 48px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false, // Ensures the label is always visible
        depthWrite: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);

    // Set a consistent scale for the labels
    sprite.scale.set(1.2, 0.3, 1.0);
    sprite.renderOrder = 1000; // Render on top of other objects

    return sprite;
}