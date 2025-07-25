/**
 * Tool for creating and editing polygons (copper pours).
 */
class PolygonTool {
    constructor(pcbEditor) {
        this.pcbEditor = pcbEditor;
        this.active = false;
        this.currentPolygon = null;
        this.points = [];
    }

    /**
     * Activate the polygon tool.
     */
    activate() {
        this.active = true;
        this.pcbEditor.canvas.style.cursor = 'crosshair';
        this.points = [];
        console.log('Polygon tool activated.');
    }

    /**
     * Deactivate the tool.
     */
    deactivate() {
        this.active = false;
        this.pcbEditor.canvas.style.cursor = 'default';
        this.finishPolygon();
        console.log('Polygon tool deactivated.');
    }

    /**
     * Handle mouse down events.
     * @param {MouseEvent} event - The mouse event.
     */
    onMouseDown(event) {
        if (!this.active || event.button !== 0) return;

        const worldPos = this.pcbEditor.viewport.screenToWorld(event.offsetX, event.offsetY);
        const snappedPos = this.pcbEditor.grid.snap(worldPos);

        this.points.push(snappedPos);

        if (this.points.length === 1) {
            // Start a new polygon
            this.currentPolygon = new Polygon(this.pcbEditor.getActiveLayer(), this.points);
            this.pcbEditor.addObject(this.currentPolygon);
        } else {
            // Update the current polygon
            this.currentPolygon.points = this.points;
        }

        // If the user clicks near the start point, close the polygon
        if (this.points.length > 2) {
            const firstPoint = this.points[0];
            const lastPoint = this.points[this.points.length - 1];
            const distance = Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y);
            if (distance < this.pcbEditor.grid.size * 2) {
                this.finishPolygon();
            }
        }
        
        this.pcbEditor.render();
    }

    /**
     * Handle mouse move events to show a preview.
     * @param {MouseEvent} event - The mouse event.
     */
    onMouseMove(event) {
        if (!this.active || !this.currentPolygon) return;

        const worldPos = this.pcbEditor.viewport.screenToWorld(event.offsetX, event.offsetY);
        const snappedPos = this.pcbEditor.grid.snap(worldPos);

        // Render a temporary line from the last point to the current mouse position
        this.pcbEditor.render(); // Redraw the board
        const ctx = this.pcbEditor.canvas.getContext('2d');
        const transform = this.pcbEditor.viewport.getTransform();
        
        const lastPoint = this.points[this.points.length - 1];
        const screenLast = transform.apply(lastPoint);
        const screenCurrent = transform.apply(snappedPos);

        ctx.save();
        ctx.strokeStyle = this.pcbEditor.getLayerColor(this.pcbEditor.getActiveLayer());
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(screenLast.x, screenLast.y);
        ctx.lineTo(screenCurrent.x, screenCurrent.y);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Handle key press events, e.g., 'Escape' to cancel.
     * @param {KeyboardEvent} event - The keyboard event.
     */
    onKeyDown(event) {
        if (!this.active) return;

        if (event.key === 'Escape') {
            this.cancel();
        } else if (event.key === 'Enter') {
            this.finishPolygon();
        }
    }

    /**
     * Finalize the current polygon.
     */
    finishPolygon() {
        if (this.currentPolygon && this.points.length > 2) {
            // Remove the last point if it's the same as the closing click
            const firstPoint = this.points[0];
            const lastPoint = this.points[this.points.length - 1];
            if (lastPoint.x === firstPoint.x && lastPoint.y === firstPoint.y) {
                this.points.pop();
            }
            
            this.currentPolygon.points = this.points;
            this.currentPolygon.recalculate(this.pcbEditor.getObjects());
            console.log('Polygon finished.');
        } else if (this.currentPolygon) {
            // If not enough points, remove the temporary polygon
            this.pcbEditor.removeObject(this.currentPolygon);
        }
        
        this.reset();
        this.pcbEditor.render();
    }

    /**
     * Cancel the current polygon creation.
     */
    cancel() {
        if (this.currentPolygon) {
            this.pcbEditor.removeObject(this.currentPolygon);
        }
        this.reset();
        this.pcbEditor.render();
        console.log('Polygon creation cancelled.');
    }

    /**
     * Reset the tool state.
     */
    reset() {
        this.currentPolygon = null;
        this.points = [];
    }
}

// Export for use in other modules
window.PolygonTool = PolygonTool;
