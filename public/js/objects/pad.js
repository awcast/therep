/**
 * Pad object for component pins and standalone pads
 */

class Pad extends PCBObject {
    constructor(position, shape = 'circle', size = 1.0, layer = 'top-copper') {
        super('pad', layer);
        
        this.position = position ? position.clone() : new Point(0, 0);
        this.shape = shape; // 'circle', 'square', 'rect', 'oval'
        this.size = size; // Diameter for circle, side length for square, or {width, height} for rect/oval
        
        // Pad properties
        this.setProperty('shape', shape);
        this.setProperty('size', size);
        this.setProperty('drill', null); // Drill diameter for through-hole pads
        this.setProperty('net', null);
        this.setProperty('pinNumber', null);
        this.setProperty('pinName', null);
        this.setProperty('thermal', false); // Thermal relief for polygon connections
        this.setProperty('solder_mask_margin', 0.1); // Solder mask expansion
        this.setProperty('paste_margin', -0.05); // Solder paste margin
        
        // Pad types
        this.setProperty('padType', 'smd'); // 'smd', 'through_hole', 'np_through_hole'
        
        this.updateBoundingBox();
    }

    /**
     * Set pad shape
     */
    setShape(shape) {
        this.shape = shape;
        this.setProperty('shape', shape);
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Set pad size
     */
    setSize(size) {
        this.size = size;
        this.setProperty('size', size);
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Set drill diameter for through-hole pads
     */
    setDrill(drill) {
        this.setProperty('drill', drill);
        if (drill > 0) {
            this.setProperty('padType', 'through_hole');
        }
        this.touch();
    }

    /**
     * Calculate bounding box
     */
    calculateBoundingBox() {
        let width, height;
        
        if (typeof this.size === 'object') {
            width = this.size.width;
            height = this.size.height;
        } else {
            width = height = this.size;
        }
        
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        return new Rectangle(
            this.position.x - halfWidth,
            this.position.y - halfHeight,
            width,
            height
        );
    }

    /**
     * Check if point is inside pad
     */
    containsPoint(point) {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        
        if (typeof this.size === 'object') {
            const halfWidth = this.size.width / 2;
            const halfHeight = this.size.height / 2;
            
            switch (this.shape) {
                case 'rect':
                case 'square':
                    return Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight;
                case 'oval':
                    return (dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight) <= 1;
                default:
                    return Math.sqrt(dx * dx + dy * dy) <= Math.max(halfWidth, halfHeight);
            }
        } else {
            const radius = this.size / 2;
            
            switch (this.shape) {
                case 'square':
                    return Math.abs(dx) <= radius && Math.abs(dy) <= radius;
                case 'circle':
                default:
                    return Math.sqrt(dx * dx + dy * dy) <= radius;
            }
        }
    }

    /**
     * Render pad
     */
    render(ctx, viewport, layer) {
        if (!this.isVisible()) return;

        ctx.save();
        
        // Set fill style based on layer
        ctx.fillStyle = this.getLayerColor(layer);
        
        // Apply selection highlight
        if (this.selected) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 0.1 * viewport.scale;
        }
        
        this.renderPadShape(ctx, viewport);
        
        // Render drill hole if through-hole
        const drill = this.getProperty('drill');
        if (drill && drill > 0) {
            this.renderDrillHole(ctx, viewport, drill);
        }
        
        // Render pin number/name if visible
        if (viewport.scale > 2) { // Only show when zoomed in enough
            this.renderPinLabel(ctx, viewport);
        }
        
        ctx.restore();
    }

    /**
     * Render pad shape
     */
    renderPadShape(ctx, viewport) {
        ctx.beginPath();
        
        if (typeof this.size === 'object') {
            const halfWidth = this.size.width / 2;
            const halfHeight = this.size.height / 2;
            
            switch (this.shape) {
                case 'rect':
                case 'square':
                    ctx.rect(
                        this.position.x - halfWidth,
                        this.position.y - halfHeight,
                        this.size.width,
                        this.size.height
                    );
                    break;
                case 'oval':
                    // Draw oval using ellipse
                    ctx.ellipse(
                        this.position.x, this.position.y,
                        halfWidth, halfHeight,
                        0, 0, Math.PI * 2
                    );
                    break;
            }
        } else {
            const radius = this.size / 2;
            
            switch (this.shape) {
                case 'square':
                    ctx.rect(
                        this.position.x - radius,
                        this.position.y - radius,
                        this.size,
                        this.size
                    );
                    break;
                case 'circle':
                default:
                    ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
                    break;
            }
        }
        
        ctx.fill();
        
        if (this.selected) {
            ctx.stroke();
        }
    }

    /**
     * Render drill hole
     */
    renderDrillHole(ctx, viewport, drill) {
        ctx.save();
        ctx.fillStyle = '#000000'; // Black for drill holes
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, drill / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Render pin label
     */
    renderPinLabel(ctx, viewport) {
        const pinNumber = this.getProperty('pinNumber');
        const pinName = this.getProperty('pinName');
        
        if (!pinNumber && !pinName) return;
        
        const fontSize = 0.5; // 0.5mm font size
        const screenFontSize = fontSize * viewport.scale;
        
        if (screenFontSize < 8) return;
        
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.font = `${screenFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 1;
        
        const text = pinNumber || pinName;
        
        // Draw text with outline
        ctx.strokeText(text, this.position.x, this.position.y);
        ctx.fillText(text, this.position.x, this.position.y);
        
        ctx.restore();
    }

    /**
     * Get layer color
     */
    getLayerColor(layer) {
        const colors = {
            'top-copper': '#cc0000',
            'bottom-copper': '#0066cc',
            'top-silk': '#ffffff',
            'bottom-silk': '#ffff00'
        };
        return colors[this.layer] || '#888888';
    }

    /**
     * Get electrical connections
     */
    getConnections() {
        return [this.position];
    }

    /**
     * Move pad
     */
    move(deltaX, deltaY) {
        if (deltaX instanceof Point) {
            this.position = this.position.add(deltaX);
        } else {
            this.position.x += deltaX;
            this.position.y += deltaY;
        }
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Get pad info
     */
    getInfo() {
        const info = super.getInfo();
        info.shape = this.shape;
        info.size = this.size;
        info.drill = this.getProperty('drill');
        info.pinNumber = this.getProperty('pinNumber');
        info.pinName = this.getProperty('pinName');
        info.padType = this.getProperty('padType');
        return info;
    }

    /**
     * Clone pad
     */
    clone() {
        const cloned = new Pad(this.position, this.shape, this.size, this.layer);
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
        data.position = { x: this.position.x, y: this.position.y };
        data.shape = this.shape;
        data.size = this.size;
        return data;
    }

    /**
     * Deserialize from JSON
     */
    static fromJSON(data) {
        const position = new Point(data.position.x, data.position.y);
        const pad = new Pad(position, data.shape, data.size, data.layer);
        
        // Restore base properties
        pad.id = data.id || MathUtils.generateUUID();
        pad.rotation = data.rotation || 0;
        pad.visible = data.visible !== false;
        pad.properties = data.properties || {};
        pad.createdAt = data.createdAt || Date.now();
        pad.modifiedAt = data.modifiedAt || Date.now();
        
        return pad;
    }
}

// Export for use in other modules
window.Pad = Pad;
