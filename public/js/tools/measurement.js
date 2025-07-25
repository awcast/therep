/**
 * Measurement tools for PCB design
 */

class MeasurementTool {
    constructor(pcbEditor) {
        this.pcbEditor = pcbEditor;
        this.measurements = [];
        this.currentMeasurement = null;
        this.isActive = false;
        this.startPoint = null;
        this.endPoint = null;
        this.snapToObjects = true;
    }

    /**
     * Activate measurement tool
     */
    activate() {
        this.isActive = true;
        this.pcbEditor.canvas.style.cursor = 'crosshair';
    }

    /**
     * Deactivate measurement tool
     */
    deactivate() {
        this.isActive = false;
        this.currentMeasurement = null;
        this.startPoint = null;
        this.endPoint = null;
        this.pcbEditor.canvas.style.cursor = 'default';
    }

    /**
     * Handle mouse down for measurement
     */
    onMouseDown(e, worldPosition) {
        if (!this.isActive) return false;

        if (!this.startPoint) {
            // Start new measurement
            this.startPoint = this.snapToObjects ? 
                this.findSnapPoint(worldPosition) : worldPosition.clone();
            this.currentMeasurement = new Measurement(this.startPoint, this.startPoint);
            return true;
        } else {
            // Complete measurement
            this.endPoint = this.snapToObjects ? 
                this.findSnapPoint(worldPosition) : worldPosition.clone();
            this.currentMeasurement.setEndPoint(this.endPoint);
            this.measurements.push(this.currentMeasurement);
            
            // Start new measurement from this point
            this.startPoint = this.endPoint;
            this.currentMeasurement = new Measurement(this.startPoint, this.startPoint);
            return true;
        }
    }

    /**
     * Handle mouse move for measurement
     */
    onMouseMove(e, worldPosition) {
        if (!this.isActive || !this.currentMeasurement) return false;

        const snapPoint = this.snapToObjects ? 
            this.findSnapPoint(worldPosition) : worldPosition;
        this.currentMeasurement.setEndPoint(snapPoint);
        return true;
    }

    /**
     * Handle escape key to finish measurement
     */
    onEscape() {
        if (this.isActive) {
            this.currentMeasurement = null;
            this.startPoint = null;
            this.endPoint = null;
            return true;
        }
        return false;
    }

    /**
     * Find nearest snap point
     */
    findSnapPoint(position) {
        const snapDistance = 0.5; // 0.5mm snap distance
        let nearestPoint = position;
        let minDistance = snapDistance;

        // Check all objects for snap points
        this.pcbEditor.objects.forEach(obj => {
            if (obj.getSnapPoints) {
                obj.getSnapPoints().forEach(snapPoint => {
                    const distance = position.distance(snapPoint);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestPoint = snapPoint;
                    }
                });
            }
        });

        // Snap to grid if enabled
        if (this.pcbEditor.snapToGrid && minDistance === snapDistance) {
            nearestPoint = this.pcbEditor.grid.snapPoint(position);
        }

        return nearestPoint;
    }

    /**
     * Clear all measurements
     */
    clearAll() {
        this.measurements = [];
        this.currentMeasurement = null;
        this.startPoint = null;
        this.endPoint = null;
    }

    /**
     * Remove last measurement
     */
    removeLast() {
        if (this.measurements.length > 0) {
            this.measurements.pop();
        }
    }

    /**
     * Get all measurements
     */
    getMeasurements() {
        const result = [...this.measurements];
        if (this.currentMeasurement) {
            result.push(this.currentMeasurement);
        }
        return result;
    }

    /**
     * Export measurements to text
     */
    exportToText() {
        let text = 'PCB Measurements\n';
        text += '================\n\n';
        
        this.measurements.forEach((measurement, index) => {
            text += `Measurement ${index + 1}:\n`;
            text += `  Start: (${measurement.startPoint.x.toFixed(3)}, ${measurement.startPoint.y.toFixed(3)}) mm\n`;
            text += `  End: (${measurement.endPoint.x.toFixed(3)}, ${measurement.endPoint.y.toFixed(3)}) mm\n`;
            text += `  Distance: ${measurement.getDistance().toFixed(3)} mm\n`;
            text += `  Angle: ${measurement.getAngle().toFixed(1)}°\n`;
            text += `  Delta X: ${measurement.getDeltaX().toFixed(3)} mm\n`;
            text += `  Delta Y: ${measurement.getDeltaY().toFixed(3)} mm\n\n`;
        });
        
        return text;
    }
}

/**
 * Individual measurement object
 */
class Measurement {
    constructor(startPoint, endPoint) {
        this.id = MathUtils.generateUUID();
        this.startPoint = startPoint.clone();
        this.endPoint = endPoint.clone();
        this.createdAt = Date.now();
        this.label = '';
        this.visible = true;
        this.color = '#ffff00'; // Yellow by default
    }

    /**
     * Set end point
     */
    setEndPoint(point) {
        this.endPoint = point.clone();
    }

    /**
     * Get distance
     */
    getDistance() {
        return this.startPoint.distance(this.endPoint);
    }

    /**
     * Get angle in degrees
     */
    getAngle() {
        const radians = Math.atan2(
            this.endPoint.y - this.startPoint.y,
            this.endPoint.x - this.startPoint.x
        );
        return MathUtils.radToDeg(radians);
    }

    /**
     * Get delta X
     */
    getDeltaX() {
        return this.endPoint.x - this.startPoint.x;
    }

    /**
     * Get delta Y
     */
    getDeltaY() {
        return this.endPoint.y - this.startPoint.y;
    }

    /**
     * Get center point
     */
    getCenter() {
        return new Point(
            (this.startPoint.x + this.endPoint.x) / 2,
            (this.startPoint.y + this.endPoint.y) / 2
        );
    }

    /**
     * Render measurement
     */
    render(ctx, viewport) {
        if (!this.visible) return;

        ctx.save();
        
        // Set measurement style
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]); // Dashed line
        
        // Draw main line
        ctx.beginPath();
        ctx.moveTo(this.startPoint.x, this.startPoint.y);
        ctx.lineTo(this.endPoint.x, this.endPoint.y);
        ctx.stroke();
        
        // Draw arrow heads
        const arrowSize = 0.5; // 0.5mm arrows
        this.drawArrowHead(ctx, this.startPoint, this.endPoint, arrowSize);
        this.drawArrowHead(ctx, this.endPoint, this.startPoint, arrowSize);
        
        // Draw measurement text
        this.drawMeasurementText(ctx, viewport);
        
        // Draw dimension lines if distance is significant
        if (this.getDistance() > 2.0) {
            this.drawDimensionLines(ctx, viewport);
        }
        
        ctx.restore();
    }

    /**
     * Draw arrow head
     */
    drawArrowHead(ctx, from, to, size) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(
            from.x + size * Math.cos(angle + arrowAngle),
            from.y + size * Math.sin(angle + arrowAngle)
        );
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(
            from.x + size * Math.cos(angle - arrowAngle),
            from.y + size * Math.sin(angle - arrowAngle)
        );
        ctx.stroke();
    }

    /**
     * Draw measurement text
     */
    drawMeasurementText(ctx, viewport) {
        const center = this.getCenter();
        const distance = this.getDistance();
        const angle = this.getAngle();
        
        const fontSize = 1.0; // 1mm font size
        const screenFontSize = fontSize * viewport.scale;
        
        if (screenFontSize < 8) return; // Don't draw if too small
        
        ctx.save();
        ctx.setLineDash([]); // Solid line for text
        ctx.font = `${screenFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Create measurement text
        let text = `${distance.toFixed(2)}mm`;
        if (this.label) {
            text += ` (${this.label})`;
        }
        
        // Background for text
        const textMetrics = ctx.measureText(text);
        const padding = 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(
            center.x - textMetrics.width / 2 - padding,
            center.y - screenFontSize / 2 - padding,
            textMetrics.width + padding * 2,
            screenFontSize + padding * 2
        );
        
        // Text
        ctx.fillStyle = this.color;
        ctx.fillText(text, center.x, center.y);
        
        ctx.restore();
    }

    /**
     * Draw dimension lines
     */
    drawDimensionLines(ctx, viewport) {
        const extensionLength = 1.0; // 1mm extension lines
        const offset = 0.5; // 0.5mm offset from objects
        
        // Calculate perpendicular direction
        const mainAngle = Math.atan2(
            this.endPoint.y - this.startPoint.y,
            this.endPoint.x - this.startPoint.x
        );
        const perpAngle = mainAngle + Math.PI / 2;
        
        const perpX = Math.cos(perpAngle);
        const perpY = Math.sin(perpAngle);
        
        ctx.save();
        ctx.setLineDash([1, 1]); // Small dashes for extension lines
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = 0.7;
        
        // Start extension line
        ctx.beginPath();
        ctx.moveTo(
            this.startPoint.x + perpX * offset,
            this.startPoint.y + perpY * offset
        );
        ctx.lineTo(
            this.startPoint.x + perpX * (offset + extensionLength),
            this.startPoint.y + perpY * (offset + extensionLength)
        );
        ctx.stroke();
        
        // End extension line
        ctx.beginPath();
        ctx.moveTo(
            this.endPoint.x + perpX * offset,
            this.endPoint.y + perpY * offset
        );
        ctx.lineTo(
            this.endPoint.x + perpX * (offset + extensionLength),
            this.endPoint.y + perpY * (offset + extensionLength)
        );
        ctx.stroke();
        
        ctx.restore();
    }

    /**
     * Check if point is near measurement line
     */
    containsPoint(point, tolerance = 0.2) {
        const distance = MathUtils.pointToLineDistance(
            point.x, point.y,
            this.startPoint.x, this.startPoint.y,
            this.endPoint.x, this.endPoint.y
        );
        return distance <= tolerance;
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            id: this.id,
            startPoint: { x: this.startPoint.x, y: this.startPoint.y },
            endPoint: { x: this.endPoint.x, y: this.endPoint.y },
            label: this.label,
            color: this.color,
            visible: this.visible,
            createdAt: this.createdAt
        };
    }

    /**
     * Deserialize from JSON
     */
    static fromJSON(data) {
        const measurement = new Measurement(
            new Point(data.startPoint.x, data.startPoint.y),
            new Point(data.endPoint.x, data.endPoint.y)
        );
        
        measurement.id = data.id;
        measurement.label = data.label || '';
        measurement.color = data.color || '#ffff00';
        measurement.visible = data.visible !== false;
        measurement.createdAt = data.createdAt || Date.now();
        
        return measurement;
    }
}

// Export for use in other modules
window.MeasurementTool = MeasurementTool;
window.Measurement = Measurement;
