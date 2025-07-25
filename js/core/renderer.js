/**
 * Rendering system for PCB editor
 */

class Renderer {
    constructor(canvas, viewport) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.viewport = viewport;
        
        // Layer definitions
        this.layers = {
            'top-copper': { color: '#cc0000', visible: true, order: 10 },
            'bottom-copper': { color: '#0066cc', visible: true, order: 9 },
            'top-silk': { color: '#ffffff', visible: true, order: 20 },
            'bottom-silk': { color: '#ffff00', visible: true, order: 8 },
            'drill': { color: '#666666', visible: true, order: 30 },
            'outline': { color: '#00ff00', visible: true, order: 25 }
        };
        
        // Rendering settings
        this.antiAlias = true;
        this.showGrid = true;
        this.showOrigin = true;
        this.backgroundColor = '#0a0a0a';
        
        // Performance settings
        this.enableCulling = true;
        this.maxObjectsPerFrame = 10000;
        
        // Render statistics
        this.stats = {
            objectsRendered: 0,
            renderTime: 0,
            fps: 0,
            lastFrameTime: 0
        };
    }

    /**
     * Set layer visibility
     */
    setLayerVisible(layerName, visible) {
        if (this.layers[layerName]) {
            this.layers[layerName].visible = visible;
        }
    }

    /**
     * Get layer visibility
     */
    isLayerVisible(layerName) {
        return this.layers[layerName] ? this.layers[layerName].visible : false;
    }

    /**
     * Set layer color
     */
    setLayerColor(layerName, color) {
        if (this.layers[layerName]) {
            this.layers[layerName].color = color;
        }
    }

    /**
     * Get sorted layers by render order
     */
    getSortedLayers() {
        return Object.entries(this.layers)
            .sort(([,a], [,b]) => a.order - b.order)
            .map(([name, layer]) => ({ name, ...layer }));
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.viewport.resetTransform();
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Setup rendering context
     */
    setupContext() {
        if (this.antiAlias) {
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
        } else {
            this.ctx.imageSmoothingEnabled = false;
        }
        
        // Set line join and cap for better appearance
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
    }

    /**
     * Render a single PCB object
     */
    renderObject(obj, layerName) {
        if (!obj || !obj.isVisible()) return false;
        
        // Culling check
        if (this.enableCulling && !this.viewport.isVisible(obj.getBoundingBox())) {
            return false;
        }
        
        const layer = this.layers[layerName];
        if (!layer || !layer.visible) return false;
        
        this.ctx.save();
        
        // Set layer color
        this.ctx.strokeStyle = layer.color;
        this.ctx.fillStyle = layer.color;
        
        // Render the object
        obj.render(this.ctx, this.viewport, layer);
        
        this.ctx.restore();
        
        this.stats.objectsRendered++;
        return true;
    }

    /**
     * Render a collection of objects by layer
     */
    renderObjects(objects) {
        const sortedLayers = this.getSortedLayers();
        
        for (const layer of sortedLayers) {
            if (!layer.visible) continue;
            
            this.ctx.save();
            this.ctx.strokeStyle = layer.color;
            this.ctx.fillStyle = layer.color;
            
            // Render all objects on this layer
            for (const obj of objects) {
                if (obj.layer === layer.name) {
                    this.renderObject(obj, layer.name);
                }
            }
            
            this.ctx.restore();
        }
    }

    /**
     * Render grid
     */
    renderGrid(grid) {
        if (!this.showGrid || !grid) return;
        
        this.viewport.resetTransform();
        grid.render(this.ctx, this.viewport);
    }

    /**
     * Render coordinate system origin
     */
    renderOrigin() {
        if (!this.showOrigin) return;
        
        this.viewport.applyTransform();
        
        const size = 5 / this.viewport.scale; // Scale-independent size
        
        this.ctx.save();
        this.ctx.strokeStyle = '#ff6600';
        this.ctx.lineWidth = 2 / this.viewport.scale;
        this.ctx.globalAlpha = 0.8;
        
        // Draw crosshair
        this.ctx.beginPath();
        this.ctx.moveTo(-size, 0);
        this.ctx.lineTo(size, 0);
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(0, size);
        this.ctx.stroke();
        
        // Draw circle
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    /**
     * Render selection highlights
     */
    renderSelection(selectedObjects) {
        if (!selectedObjects || selectedObjects.length === 0) return;
        
        this.viewport.applyTransform();
        
        this.ctx.save();
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2 / this.viewport.scale;
        this.ctx.setLineDash([5 / this.viewport.scale, 5 / this.viewport.scale]);
        this.ctx.globalAlpha = 0.8;
        
        for (const obj of selectedObjects) {
            const bbox = obj.getBoundingBox();
            this.ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
        }
        
        this.ctx.restore();
    }

    /**
     * Render hover highlights
     */
    renderHover(hoveredObject) {
        if (!hoveredObject) return;
        
        this.viewport.applyTransform();
        
        this.ctx.save();
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 1 / this.viewport.scale;
        this.ctx.globalAlpha = 0.6;
        
        const bbox = hoveredObject.getBoundingBox();
        this.ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
        
        this.ctx.restore();
    }

    /**
     * Render measurement overlays
     */
    renderMeasurements(measurements) {
        if (!measurements || measurements.length === 0) return;
        
        this.viewport.resetTransform();
        
        this.ctx.save();
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.lineWidth = 1;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        for (const measurement of measurements) {
            this.renderMeasurement(measurement);
        }
        
        this.ctx.restore();
    }

    /**
     * Render a single measurement
     */
    renderMeasurement(measurement) {
        const start = this.viewport.worldToScreen(measurement.start);
        const end = this.viewport.worldToScreen(measurement.end);
        
        // Draw line
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
        
        // Draw end markers
        const markerSize = 5;
        this.ctx.fillRect(start.x - markerSize/2, start.y - markerSize/2, markerSize, markerSize);
        this.ctx.fillRect(end.x - markerSize/2, end.y - markerSize/2, markerSize, markerSize);
        
        // Draw distance text
        const midpoint = new Point((start.x + end.x) / 2, (start.y + end.y) / 2);
        const distance = measurement.start.distance(measurement.end);
        const text = `${distance.toFixed(2)}mm`;
        
        // Background for text
        const textMetrics = this.ctx.measureText(text);
        const padding = 4;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(
            midpoint.x - textMetrics.width/2 - padding,
            midpoint.y - 8 - padding,
            textMetrics.width + padding * 2,
            16 + padding * 2
        );
        
        // Text
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.fillText(text, midpoint.x, midpoint.y);
    }

    /**
     * Render DRC violation markers
     */
    renderDrcViolations(violations) {
        if (!violations || violations.length === 0) return;

        this.viewport.applyTransform();
        this.ctx.save();

        violations.forEach(error => {
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            this.ctx.lineWidth = 0.1 / this.viewport.scale;

            const pos = error.position;
            const size = (error.size || 0.5);
            
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, size, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
        });

        this.ctx.restore();
    }

    /**
     * Render debug information
     */
    renderDebugInfo() {
        this.viewport.resetTransform();
        
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 200, 100);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        const info = this.viewport.getInfo();
        const lines = [
            `Zoom: ${info.zoom}%`,
            `Objects: ${this.stats.objectsRendered}`,
            `Render: ${this.stats.renderTime.toFixed(1)}ms`,
            `FPS: ${this.stats.fps}`,
            `Center: ${info.center.x.toFixed(1)}, ${info.center.y.toFixed(1)}`
        ];
        
        lines.forEach((line, index) => {
            this.ctx.fillText(line, 15, 15 + index * 15);
        });
        
        this.ctx.restore();
    }

    /**
     * Main render function
     */
    render(scene) {
        const startTime = performance.now();
        
        // Reset stats
        this.stats.objectsRendered = 0;
        
        // Clear canvas
        this.clear();
        
        // Setup context
        this.setupContext();
        
        // Render grid
        if (scene.grid) {
            this.renderGrid(scene.grid);
        }
        
        // Apply viewport transform for world objects
        this.viewport.applyTransform();
        
        // Render origin
        this.renderOrigin();
        
        // Render PCB objects
        if (scene.objects) {
            this.renderObjects(scene.objects);
        }
        
        // Render selection and hover (screen space)
        this.renderSelection(scene.selectedObjects);
        this.renderHover(scene.hoveredObject);
        
        // Render measurements (screen space)
        this.renderMeasurements(scene.measurements);

        // Render DRC violations
        if (scene.drcViolations) {
            this.renderDrcViolations(scene.drcViolations);
        }
        
        // Render debug info if enabled
        if (scene.showDebug) {
            this.renderDebugInfo();
        }
        
        // Update stats
        this.stats.renderTime = performance.now() - startTime;
        this.updateFPS();
    }

    /**
     * Update FPS counter
     */
    updateFPS() {
        const now = performance.now();
        if (this.stats.lastFrameTime > 0) {
            const deltaTime = now - this.stats.lastFrameTime;
            this.stats.fps = Math.round(1000 / deltaTime);
        }
        this.stats.lastFrameTime = now;
    }

    /**
     * Export canvas as image
     */
    exportImage(format = 'png', quality = 1.0) {
        return this.canvas.toDataURL(`image/${format}`, quality);
    }

    /**
     * Get render statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Set rendering quality
     */
    setQuality(high = true) {
        this.antiAlias = high;
        if (high) {
            this.ctx.imageSmoothingQuality = 'high';
            this.maxObjectsPerFrame = 10000;
        } else {
            this.ctx.imageSmoothingQuality = 'low';
            this.maxObjectsPerFrame = 5000;
        }
    }

    /**
     * Toggle layer visibility
     */
    toggleLayer(layerName) {
        if (this.layers[layerName]) {
            this.layers[layerName].visible = !this.layers[layerName].visible;
            return this.layers[layerName].visible;
        }
        return false;
    }

    /**
     * Get all layer information
     */
    getLayerInfo() {
        return Object.entries(this.layers).map(([name, layer]) => ({
            name,
            color: layer.color,
            visible: layer.visible,
            order: layer.order
        }));
    }
}

// Export for use in other modules
window.Renderer = Renderer;
