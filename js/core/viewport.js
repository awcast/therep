/**
 * Viewport system for PCB editor - handles zoom, pan, and coordinate transformations
 */

class Viewport {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Viewport properties
        this.x = 0; // Pan offset X
        this.y = 0; // Pan offset Y
        this.scale = 1; // Zoom scale
        this.minScale = 0.01;
        this.maxScale = 100;
        
        // Canvas dimensions
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Center point
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        
        // Mouse interaction state
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Event handlers
        this.setupEventHandlers();
        
        // Fit initial view
        this.fitToSize(100, 80); // 100mm x 80mm PCB
    }

    /**
     * Setup mouse and keyboard event handlers
     */
    setupEventHandlers() {
        // Mouse wheel for zooming
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoomAt(mouseX, mouseY, zoomFactor);
        });

        // Mouse down for panning
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.ctrlKey)) { // Middle mouse or Ctrl+Left
                e.preventDefault();
                this.startPan(e.offsetX, e.offsetY);
            }
        });

        // Mouse move for panning
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.updatePan(e.offsetX, e.offsetY);
            }
        });

        // Mouse up to stop panning
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 1 || e.button === 0) {
                this.stopPan();
            }
        });

        // Context menu disable for middle mouse
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Handle canvas resize
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
        });
    }

    /**
     * Update canvas size when window resizes
     */
    updateCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
    }

    /**
     * Update size with explicit dimensions
     */
    updateSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
    }

    /**
     * Start panning operation
     */
    startPan(mouseX, mouseY) {
        this.isPanning = true;
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        this.canvas.style.cursor = 'grabbing';
    }

    /**
     * Update pan position
     */
    updatePan(mouseX, mouseY) {
        if (!this.isPanning) return;
        
        const deltaX = mouseX - this.lastMouseX;
        const deltaY = mouseY - this.lastMouseY;
        
        this.x += deltaX;
        this.y += deltaY;
        
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
    }

    /**
     * Stop panning operation
     */
    stopPan() {
        this.isPanning = false;
        this.canvas.style.cursor = 'crosshair';
    }

    /**
     * Zoom at a specific screen point
     */
    zoomAt(screenX, screenY, factor) {
        const worldPoint = this.screenToWorld(new Point(screenX, screenY));
        
        this.scale = MathUtils.clamp(this.scale * factor, this.minScale, this.maxScale);
        
        const newScreenPoint = this.worldToScreen(worldPoint);
        this.x += screenX - newScreenPoint.x;
        this.y += screenY - newScreenPoint.y;
    }

    /**
     * Zoom in
     */
    zoomIn(factor = 1.2) {
        this.zoomAt(this.centerX, this.centerY, factor);
    }

    /**
     * Zoom out
     */
    zoomOut(factor = 0.8) {
        this.zoomAt(this.centerX, this.centerY, factor);
    }

    /**
     * Zoom to fit a rectangle
     */
    zoomToFit(rect, padding = 20) {
        const scaleX = (this.width - padding * 2) / rect.width;
        const scaleY = (this.height - padding * 2) / rect.height;
        this.scale = Math.min(scaleX, scaleY);
        this.scale = MathUtils.clamp(this.scale, this.minScale, this.maxScale);
        
        // Center the rectangle
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        this.x = this.centerX - centerX * this.scale;
        this.y = this.centerY - centerY * this.scale;
    }

    /**
     * Fit to a specific size (in mm)
     */
    fitToSize(width, height, padding = 10) {
        const rect = new Rectangle(-width/2, -height/2, width, height);
        this.zoomToFit(rect, padding);
    }

    /**
     * Reset view to default
     */
    resetView() {
        this.x = 0;
        this.y = 0;
        this.scale = 1;
        this.fitToSize(100, 80);
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenPoint) {
        return new Point(
            (screenPoint.x - this.x) / this.scale,
            (screenPoint.y - this.y) / this.scale
        );
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldPoint) {
        return new Point(
            worldPoint.x * this.scale + this.x,
            worldPoint.y * this.scale + this.y
        );
    }

    /**
     * Convert world X coordinate to screen X coordinate
     */
    worldToScreenX(worldX) {
        return worldX * this.scale + this.x;
    }

    /**
     * Convert world Y coordinate to screen Y coordinate
     */
    worldToScreenY(worldY) {
        return worldY * this.scale + this.y;
    }

    /**
     * Convert screen X coordinate to world X coordinate
     */
    screenToWorldX(screenX) {
        return (screenX - this.x) / this.scale;
    }

    /**
     * Convert screen Y coordinate to world Y coordinate
     */
    screenToWorldY(screenY) {
        return (screenY - this.y) / this.scale;
    }

    /**
     * Get the visible bounds in world coordinates
     */
    getVisibleBounds() {
        const topLeft = this.screenToWorld(new Point(0, 0));
        const bottomRight = this.screenToWorld(new Point(this.width, this.height));
        
        return new Rectangle(
            topLeft.x,
            topLeft.y,
            bottomRight.x - topLeft.x,
            bottomRight.y - topLeft.y
        );
    }

    /**
     * Check if a world rectangle is visible
     */
    isVisible(worldRect) {
        const visibleBounds = this.getVisibleBounds();
        return visibleBounds.intersects(worldRect);
    }

    /**
     * Get current zoom percentage
     */
    getZoomPercentage() {
        return Math.round(this.scale * 100);
    }

    /**
     * Set zoom percentage
     */
    setZoomPercentage(percentage) {
        const newScale = percentage / 100;
        const factor = newScale / this.scale;
        this.zoomAt(this.centerX, this.centerY, factor);
    }

    /**
     * Pan to center a world point
     */
    panTo(worldPoint) {
        this.x = this.centerX - worldPoint.x * this.scale;
        this.y = this.centerY - worldPoint.y * this.scale;
    }

    /**
     * Pan by a delta in screen coordinates
     */
    panBy(deltaX, deltaY) {
        this.x += deltaX;
        this.y += deltaY;
    }

    /**
     * Get the current transform matrix
     */
    getTransformMatrix() {
        return [this.scale, 0, 0, this.scale, this.x, this.y];
    }

    /**
     * Apply the viewport transform to the canvas context
     */
    applyTransform(ctx = this.ctx) {
        ctx.setTransform(this.scale, 0, 0, this.scale, this.x, this.y);
    }

    /**
     * Reset the canvas transform
     */
    resetTransform(ctx = this.ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * Get viewport info for display
     */
    getInfo() {
        const bounds = this.getVisibleBounds();
        return {
            zoom: this.getZoomPercentage(),
            scale: this.scale,
            x: this.x,
            y: this.y,
            visibleBounds: bounds,
            center: this.screenToWorld(new Point(this.centerX, this.centerY))
        };
    }

    /**
     * Save viewport state
     */
    saveState() {
        return {
            x: this.x,
            y: this.y,
            scale: this.scale
        };
    }

    /**
     * Restore viewport state
     */
    restoreState(state) {
        this.x = state.x;
        this.y = state.y;
        this.scale = MathUtils.clamp(state.scale, this.minScale, this.maxScale);
    }

    /**
     * Animate to a target state
     */
    animateTo(targetState, duration = 300) {
        const startState = this.saveState();
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            
            this.x = MathUtils.lerp(startState.x, targetState.x, eased);
            this.y = MathUtils.lerp(startState.y, targetState.y, eased);
            this.scale = MathUtils.lerp(startState.scale, targetState.scale, eased);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
}

// Export for use in other modules
window.Viewport = Viewport;
