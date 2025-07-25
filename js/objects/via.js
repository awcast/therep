/**
 * Via object for PCB layer connections
 */

class Via extends PCBObject {
    constructor(position, outerDiameter = 0.6, drillDiameter = 0.3, layer = 'drill') {
        super('via', layer);
        
        this.position = position ? position.clone() : new Point(0, 0);
        this.outerDiameter = outerDiameter; // in mm
        this.drillDiameter = drillDiameter; // in mm
        
        // Via properties
        this.setProperty('outerDiameter', outerDiameter);
        this.setProperty('drillDiameter', drillDiameter);
        this.setProperty('net', null);
        this.setProperty('viaType', 'through'); // through, blind, buried
        this.setProperty('startLayer', 'top-copper');
        this.setProperty('endLayer', 'bottom-copper');
        this.setProperty('plated', true);
        
        // Design rule properties
        this.setProperty('minOuterDiameter', 0.2);
        this.setProperty('maxOuterDiameter', 5.0);
        this.setProperty('minDrillDiameter', 0.1);
        this.setProperty('maxDrillDiameter', 3.0);
        this.setProperty('minAnnularRing', 0.05);
        
        // Visual properties
        this.setProperty('showNet', false);
        this.setProperty('showDrill', true);
    }

    /**
     * Set outer diameter
     */
    setOuterDiameter(diameter) {
        this.outerDiameter = Math.max(this.getProperty('minOuterDiameter', 0.2), 
                                     Math.min(diameter, this.getProperty('maxOuterDiameter', 5.0)));
        this.setProperty('outerDiameter', this.outerDiameter);
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Get outer diameter
     */
    getOuterDiameter() {
        return this.outerDiameter;
    }

    /**
     * Set drill diameter
     */
    setDrillDiameter(diameter) {
        const maxDrill = this.outerDiameter - 2 * this.getProperty('minAnnularRing', 0.05);
        this.drillDiameter = Math.max(this.getProperty('minDrillDiameter', 0.1), 
                                     Math.min(diameter, maxDrill));
        this.setProperty('drillDiameter', this.drillDiameter);
        this.touch();
    }

    /**
     * Get drill diameter
     */
    getDrillDiameter() {
        return this.drillDiameter;
    }

    /**
     * Get annular ring width
     */
    getAnnularRing() {
        return (this.outerDiameter - this.drillDiameter) / 2;
    }

    /**
     * Set via type
     */
    setViaType(type) {
        const validTypes = ['through', 'blind', 'buried'];
        if (validTypes.includes(type)) {
            this.setProperty('viaType', type);
            this.touch();
        }
    }

    /**
     * Get via type
     */
    getViaType() {
        return this.getProperty('viaType', 'through');
    }

    /**
     * Calculate bounding box
     */
    calculateBoundingBox() {
        const radius = this.outerDiameter / 2;
        return new Rectangle(
            this.position.x - radius,
            this.position.y - radius,
            this.outerDiameter,
            this.outerDiameter
        );
    }

    /**
     * Check if point is inside via
     */
    containsPoint(point) {
        const distance = this.position.distance(point);
        return distance <= this.outerDiameter / 2;
    }

    /**
     * Get distance from point to via
     */
    distanceToPoint(point) {
        const distance = this.position.distance(point);
        return Math.max(0, distance - this.outerDiameter / 2);
    }

    /**
     * Render via
     */
    render(ctx, viewport, layer) {
        if (!this.isVisible()) return;

        ctx.save();
        
        const outerRadius = this.outerDiameter / 2;
        const drillRadius = this.drillDiameter / 2;
        
        // Draw outer ring (copper)
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, outerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw drill hole
        if (this.getProperty('showDrill', true)) {
            ctx.save();
            ctx.fillStyle = '#000000'; // Black for drill hole
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, drillRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        // Draw plating indication
        if (this.getProperty('plated', true)) {
            ctx.save();
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 0.02 * viewport.scale; // Thin line
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, drillRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        // Draw selection highlight
        if (this.selected) {
            ctx.save();
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 0.05 * viewport.scale;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, outerRadius + 0.1, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        // Draw via type indicator
        this.renderViaTypeIndicator(ctx, viewport);
        
        // Draw net label if enabled
        if (this.getProperty('showNet', false) && this.getNet()) {
            this.renderNetLabel(ctx, viewport);
        }
        
        ctx.restore();
    }

    /**
     * Render via type indicator
     */
    renderViaTypeIndicator(ctx, viewport) {
        const viaType = this.getViaType();
        if (viaType === 'through') return; // No indicator for through vias
        
        const radius = this.outerDiameter / 2;
        const indicatorSize = radius * 0.3;
        
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = `${indicatorSize * 2 * viewport.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const symbol = viaType === 'blind' ? 'B' : 'U'; // U for buried
        ctx.fillText(symbol, this.position.x, this.position.y);
        
        ctx.restore();
    }

    /**
     * Render net label
     */
    renderNetLabel(ctx, viewport) {
        const net = this.getNet();
        if (!net) return;
        
        const fontSize = 0.8; // 0.8mm font size
        const screenFontSize = fontSize * viewport.scale;
        
        if (screenFontSize < 6) return; // Don't draw if too small
        
        const offset = this.outerDiameter / 2 + 0.5; // Offset from via edge
        
        ctx.save();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = `${screenFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.8;
        
        // Background
        const textMetrics = ctx.measureText(net);
        const padding = 0.1 * viewport.scale;
        const textX = this.position.x;
        const textY = this.position.y - offset;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(
            textX - textMetrics.width / 2 - padding,
            textY - screenFontSize / 2 - padding,
            textMetrics.width + padding * 2,
            screenFontSize + padding * 2
        );
        
        // Text
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillText(net, textX, textY);
        
        ctx.restore();
    }

    /**
     * Get snap points
     */
    getSnapPoints() {
        return [this.position];
    }

    /**
     * Get electrical connections
     */
    getConnections() {
        return [this.position];
    }

    /**
     * Check if via is connected to another object
     */
    isConnectedTo(other) {
        if (!other.getConnections) return false;
        
        const otherConnections = other.getConnections();
        const tolerance = this.outerDiameter / 2 + 0.01; // Via radius + small tolerance
        
        for (const otherConn of otherConnections) {
            if (this.position.distance(otherConn) <= tolerance) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if via can connect to another object
     */
    canConnectTo(other) {
        if (!other.getConnections) return false;
        
        const connections = other.getConnections();
        const tolerance = this.outerDiameter / 2 + 0.1; // Via radius + tolerance
        
        return connections.some(conn => this.position.distance(conn) <= tolerance);
    }

    /**
     * Get via info for properties panel
     */
    getInfo() {
        const info = super.getInfo();
        info.outerDiameter = this.outerDiameter;
        info.drillDiameter = this.drillDiameter;
        info.annularRing = this.getAnnularRing();
        info.viaType = this.getViaType();
        info.plated = this.getProperty('plated', true);
        info.startLayer = this.getProperty('startLayer', 'top-copper');
        info.endLayer = this.getProperty('endLayer', 'bottom-copper');
        return info;
    }

    /**
     * Validate via
     */
    validate() {
        const errors = super.validate();
        
        if (this.outerDiameter <= 0) {
            errors.push('Via outer diameter must be positive');
        }
        
        if (this.drillDiameter <= 0) {
            errors.push('Via drill diameter must be positive');
        }
        
        if (this.drillDiameter >= this.outerDiameter) {
            errors.push('Drill diameter must be smaller than outer diameter');
        }
        
        const annularRing = this.getAnnularRing();
        const minAnnularRing = this.getProperty('minAnnularRing', 0.05);
        if (annularRing < minAnnularRing) {
            errors.push(`Annular ring must be at least ${minAnnularRing}mm`);
        }
        
        if (this.outerDiameter < this.getProperty('minOuterDiameter', 0.2)) {
            errors.push(`Outer diameter must be at least ${this.getProperty('minOuterDiameter')}mm`);
        }
        
        if (this.outerDiameter > this.getProperty('maxOuterDiameter', 5.0)) {
            errors.push(`Outer diameter must be at most ${this.getProperty('maxOuterDiameter')}mm`);
        }
        
        if (this.drillDiameter < this.getProperty('minDrillDiameter', 0.1)) {
            errors.push(`Drill diameter must be at least ${this.getProperty('minDrillDiameter')}mm`);
        }
        
        if (this.drillDiameter > this.getProperty('maxDrillDiameter', 3.0)) {
            errors.push(`Drill diameter must be at most ${this.getProperty('maxDrillDiameter')}mm`);
        }
        
        return errors;
    }

    /**
     * Clone via
     */
    clone() {
        const cloned = new Via(this.position, this.outerDiameter, this.drillDiameter, this.layer);
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
        data.outerDiameter = this.outerDiameter;
        data.drillDiameter = this.drillDiameter;
        return data;
    }

    /**
     * Deserialize from JSON
     */
    static fromJSON(data) {
        const position = new Point(data.position.x, data.position.y);
        const via = new Via(position, data.outerDiameter, data.drillDiameter, data.layer);
        
        // Restore base properties
        via.id = data.id || MathUtils.generateUUID();
        via.rotation = data.rotation || 0;
        via.visible = data.visible !== false;
        via.properties = data.properties || {};
        via.createdAt = data.createdAt || Date.now();
        via.modifiedAt = data.modifiedAt || Date.now();
        
        return via;
    }

    /**
     * Get description for display
     */
    getDescription() {
        const viaType = this.getViaType();
        const net = this.getNet();
        return `${viaType} via ${this.outerDiameter}/${this.drillDiameter}mm${net ? ` (${net})` : ''}`;
    }

    /**
     * Check if via connects specific layers
     */
    connectsLayers(layer1, layer2) {
        const startLayer = this.getProperty('startLayer', 'top-copper');
        const endLayer = this.getProperty('endLayer', 'bottom-copper');
        
        return (startLayer === layer1 && endLayer === layer2) ||
               (startLayer === layer2 && endLayer === layer1);
    }

    /**
     * Get layers connected by this via
     */
    getConnectedLayers() {
        const viaType = this.getViaType();
        const startLayer = this.getProperty('startLayer', 'top-copper');
        const endLayer = this.getProperty('endLayer', 'bottom-copper');
        
        if (viaType === 'through') {
            return ['top-copper', 'bottom-copper']; // Simplified - in reality would include all layers
        } else {
            return [startLayer, endLayer];
        }
    }

    /**
     * Set connected layers
     */
    setConnectedLayers(startLayer, endLayer) {
        this.setProperty('startLayer', startLayer);
        this.setProperty('endLayer', endLayer);
        
        // Update via type based on layers
        if (startLayer === 'top-copper' && endLayer === 'bottom-copper') {
            this.setProperty('viaType', 'through');
        } else if (startLayer === 'top-copper' || endLayer === 'bottom-copper') {
            this.setProperty('viaType', 'blind');
        } else {
            this.setProperty('viaType', 'buried');
        }
    }
}

// Export for use in other modules
window.Via = Via;
