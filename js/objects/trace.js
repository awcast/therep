/**
 * Trace object for PCB routing
 */

class Trace extends PCBObject {
    constructor(startPoint, endPoint, width = 0.2, layer = 'top-copper') {
        super('trace', layer);
        
        this.startPoint = startPoint ? startPoint.clone() : new Point(0, 0);
        this.endPoint = endPoint ? endPoint.clone() : new Point(0, 0);
        this.width = width; // in mm
        
        // Trace properties
        this.setProperty('width', width);
        this.setProperty('net', null);
        this.setProperty('impedance', null);
        this.setProperty('minWidth', 0.1);
        this.setProperty('maxWidth', 10.0);
        
        // Visual properties
        this.setProperty('showWidth', true);
        this.setProperty('showNet', false);
        
        // Update position to center of trace
        this.updatePosition();
    }

    /**
     * Update position to center of trace
     */
    updatePosition() {
        this.position = new Point(
            (this.startPoint.x + this.endPoint.x) / 2,
            (this.startPoint.y + this.endPoint.y) / 2
        );
        this.invalidateBoundingBox();
    }

    /**
     * Set start point
     */
    setStartPoint(point) {
        this.startPoint = point.clone();
        this.updatePosition();
        this.touch();
    }

    /**
     * Get start point
     */
    getStartPoint() {
        return this.startPoint.clone();
    }

    /**
     * Set end point
     */
    setEndPoint(point) {
        this.endPoint = point.clone();
        this.updatePosition();
        this.touch();
    }

    /**
     * Get end point
     */
    getEndPoint() {
        return this.endPoint.clone();
    }

    /**
     * Set trace width
     */
    setWidth(width) {
        this.width = Math.max(this.getProperty('minWidth', 0.1), 
                             Math.min(width, this.getProperty('maxWidth', 10.0)));
        this.setProperty('width', this.width);
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Get trace width
     */
    getWidth() {
        return this.width;
    }

    /**
     * Get trace length
     */
    getLength() {
        return this.startPoint.distance(this.endPoint);
    }

    /**
     * Get trace angle in radians
     */
    getAngle() {
        return this.startPoint.angle(this.endPoint);
    }

    /**
     * Calculate bounding box
     */
    calculateBoundingBox() {
        const halfWidth = this.width / 2;
        const minX = Math.min(this.startPoint.x, this.endPoint.x) - halfWidth;
        const minY = Math.min(this.startPoint.y, this.endPoint.y) - halfWidth;
        const maxX = Math.max(this.startPoint.x, this.endPoint.x) + halfWidth;
        const maxY = Math.max(this.startPoint.y, this.endPoint.y) + halfWidth;
        
        return new Rectangle(minX, minY, maxX - minX, maxY - minY);
    }

    /**
     * Check if point is inside trace
     */
    containsPoint(point) {
        const distance = MathUtils.pointToLineDistance(
            point.x, point.y,
            this.startPoint.x, this.startPoint.y,
            this.endPoint.x, this.endPoint.y
        );
        return distance <= this.width / 2;
    }

    /**
     * Get distance from point to trace
     */
    distanceToPoint(point) {
        const lineDistance = MathUtils.pointToLineDistance(
            point.x, point.y,
            this.startPoint.x, this.startPoint.y,
            this.endPoint.x, this.endPoint.y
        );
        return Math.max(0, lineDistance - this.width / 2);
    }

    /**
     * Render trace
     */
    render(ctx, viewport, layer) {
        if (!this.isVisible()) return;

        ctx.save();
        
        // Set line properties
        ctx.lineWidth = this.width * viewport.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw main trace
        ctx.beginPath();
        ctx.moveTo(this.startPoint.x, this.startPoint.y);
        ctx.lineTo(this.endPoint.x, this.endPoint.y);
        ctx.stroke();
        
        // Draw selection highlight
        if (this.selected) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = (this.width + 0.2) * viewport.scale;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(this.startPoint.x, this.startPoint.y);
            ctx.lineTo(this.endPoint.x, this.endPoint.y);
            ctx.stroke();
        }
        
        // Draw connection points
        this.renderConnectionPoints(ctx, viewport);
        
        // Draw net label if enabled
        if (this.getProperty('showNet', false) && this.getNet()) {
            this.renderNetLabel(ctx, viewport);
        }
        
        ctx.restore();
    }

    /**
     * Render connection points
     */
    renderConnectionPoints(ctx, viewport) {
        const pointSize = 0.1; // 0.1mm radius
        const screenSize = pointSize * viewport.scale;
        
        if (screenSize < 2) return; // Don't draw if too small
        
        ctx.save();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.globalAlpha = 0.8;
        
        // Start point
        ctx.beginPath();
        ctx.arc(this.startPoint.x, this.startPoint.y, pointSize, 0, Math.PI * 2);
        ctx.fill();
        
        // End point
        ctx.beginPath();
        ctx.arc(this.endPoint.x, this.endPoint.y, pointSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    /**
     * Render net label
     */
    renderNetLabel(ctx, viewport) {
        const net = this.getNet();
        if (!net) return;
        
        const center = this.position;
        const fontSize = 1.0; // 1mm font size
        const screenFontSize = fontSize * viewport.scale;
        
        if (screenFontSize < 8) return; // Don't draw if too small
        
        ctx.save();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = `${screenFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.8;
        
        // Background
        const textMetrics = ctx.measureText(net);
        const padding = 0.2 * viewport.scale;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(
            center.x - textMetrics.width / 2 - padding,
            center.y - screenFontSize / 2 - padding,
            textMetrics.width + padding * 2,
            screenFontSize + padding * 2
        );
        
        // Text
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillText(net, center.x, center.y);
        
        ctx.restore();
    }

    /**
     * Get snap points
     */
    getSnapPoints() {
        return [
            this.startPoint,
            this.endPoint,
            this.position // center point
        ];
    }

    /**
     * Move trace by delta
     */
    move(deltaX, deltaY) {
        if (deltaX instanceof Point) {
            this.startPoint = this.startPoint.add(deltaX);
            this.endPoint = this.endPoint.add(deltaX);
        } else {
            this.startPoint.x += deltaX;
            this.startPoint.y += deltaY;
            this.endPoint.x += deltaX;
            this.endPoint.y += deltaY;
        }
        this.updatePosition();
        this.touch();
    }

    /**
     * Rotate trace around center
     */
    rotate(deltaRotation) {
        const center = this.position;
        this.startPoint = this.startPoint.rotate(center, deltaRotation);
        this.endPoint = this.endPoint.rotate(center, deltaRotation);
        this.rotation += deltaRotation;
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Split trace at point
     */
    splitAt(point) {
        const trace1 = new Trace(this.startPoint, point, this.width, this.layer);
        const trace2 = new Trace(point, this.endPoint, this.width, this.layer);
        
        // Copy properties
        trace1.properties = MathUtils.deepClone(this.properties);
        trace2.properties = MathUtils.deepClone(this.properties);
        
        return [trace1, trace2];
    }

    /**
     * Extend trace to new end point
     */
    extendTo(newEndPoint) {
        this.setEndPoint(newEndPoint);
    }

    /**
     * Check if trace can connect to another object
     */
    canConnectTo(other) {
        if (!other.getConnections) return false;
        
        const connections = other.getConnections();
        const startDistance = Math.min(...connections.map(conn => this.startPoint.distance(conn)));
        const endDistance = Math.min(...connections.map(conn => this.endPoint.distance(conn)));
        
        const tolerance = 0.1; // 0.1mm tolerance
        return startDistance <= tolerance || endDistance <= tolerance;
    }

    /**
     * Get electrical connections
     */
    getConnections() {
        return [this.startPoint, this.endPoint];
    }

    /**
     * Check if trace is connected to another object
     */
    isConnectedTo(other) {
        if (!other.getConnections) return false;
        
        const otherConnections = other.getConnections();
        const tolerance = 0.01; // 0.01mm tolerance
        
        for (const myConn of this.getConnections()) {
            for (const otherConn of otherConnections) {
                if (myConn.distance(otherConn) <= tolerance) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Get trace info for properties panel
     */
    getInfo() {
        const info = super.getInfo();
        info.startPoint = this.startPoint;
        info.endPoint = this.endPoint;
        info.width = this.width;
        info.length = this.getLength();
        info.angle = MathUtils.radToDeg(this.getAngle());
        return info;
    }

    /**
     * Validate trace
     */
    validate() {
        const errors = super.validate();
        
        if (this.width <= 0) {
            errors.push('Trace width must be positive');
        }
        
        if (this.width < this.getProperty('minWidth', 0.1)) {
            errors.push(`Trace width must be at least ${this.getProperty('minWidth')}mm`);
        }
        
        if (this.width > this.getProperty('maxWidth', 10.0)) {
            errors.push(`Trace width must be at most ${this.getProperty('maxWidth')}mm`);
        }
        
        if (this.getLength() < 0.01) {
            errors.push('Trace length must be at least 0.01mm');
        }
        
        return errors;
    }

    /**
     * Clone trace
     */
    clone() {
        const cloned = new Trace(this.startPoint, this.endPoint, this.width, this.layer);
        cloned.properties = MathUtils.deepClone(this.properties);
        cloned.rotation = this.rotation;
        cloned.visible = this.visible;
        return cloned;
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        const data = super.toJSON();
        data.startPoint = { x: this.startPoint.x, y: this.startPoint.y };
        data.endPoint = { x: this.endPoint.x, y: this.endPoint.y };
        data.width = this.width;
        return data;
    }

    /**
     * Deserialize from JSON
     */
    static fromJSON(data) {
        const startPoint = new Point(data.startPoint.x, data.startPoint.y);
        const endPoint = new Point(data.endPoint.x, data.endPoint.y);
        const trace = new Trace(startPoint, endPoint, data.width, data.layer);
        
        // Restore base properties
        trace.id = data.id || MathUtils.generateUUID();
        trace.rotation = data.rotation || 0;
        trace.visible = data.visible !== false;
        trace.properties = data.properties || {};
        trace.createdAt = data.createdAt || Date.now();
        trace.modifiedAt = data.modifiedAt || Date.now();
        
        return trace;
    }
}

// Export for use in other modules
window.Trace = Trace;
