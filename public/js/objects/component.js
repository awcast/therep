/**
 * PCB Component class
 * Represents electronic components on the PCB
 */

class Component extends PCBObject {
    constructor(position, size, rotation = 0, layer = 'top-copper') {
        super();
        this.position = position.clone ? position.clone() : new Point(position.x, position.y);
        this.size = { width: size.width, height: size.height };
        this.rotation = rotation;
        this.layer = layer;
        this.designator = '';
        this.footprint = '';
        this.description = '';
        this.pads = [];
        this.selected = false;
        this.visible = true;
    }

    /**
     * Set component designator (e.g., U1, R1, C1)
     */
    setDesignator(designator) {
        this.designator = designator;
    }

    /**
     * Set component footprint
     */
    setFootprint(footprint) {
        this.footprint = footprint;
    }

    /**
     * Set component description
     */
    setDescription(description) {
        this.description = description;
    }

    /**
     * Add a pad to the component
     */
    addPad(pad) {
        this.pads.push(pad);
    }

    /**
     * Get component bounds
     */
    getBounds() {
        const halfWidth = this.size.width / 2;
        const halfHeight = this.size.height / 2;
        
        return {
            left: this.position.x - halfWidth,
            right: this.position.x + halfWidth,
            top: this.position.y - halfHeight,
            bottom: this.position.y + halfHeight
        };
    }

    /**
     * Check if point is inside component
     */
    containsPoint(point) {
        const bounds = this.getBounds();
        return point.x >= bounds.left && point.x <= bounds.right &&
               point.y >= bounds.top && point.y <= bounds.bottom;
    }

    /**
     * Move component by delta
     */
    move(delta) {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }

    /**
     * Set component position
     */
    setPosition(position) {
        this.position = position.clone ? position.clone() : new Point(position.x, position.y);
    }

    /**
     * Rotate component
     */
    rotate(angle) {
        this.rotation = (this.rotation + angle) % 360;
    }

    /**
     * Set rotation
     */
    setRotation(angle) {
        this.rotation = angle % 360;
    }

    /**
     * Get component center point
     */
    getCenter() {
        return this.position.clone();
    }

    /**
     * Check if component can be moved
     */
    canMove() {
        return true;
    }

    /**
     * Check if component can be deleted
     */
    canDelete() {
        return true;
    }

    /**
     * Set selection state
     */
    setSelected(selected) {
        this.selected = selected;
    }

    /**
     * Check if component is selected
     */
    isSelected() {
        return this.selected;
    }

    /**
     * Set visibility
     */
    setVisible(visible) {
        this.visible = visible;
    }

    /**
     * Check if component is visible
     */
    isVisible() {
        return this.visible;
    }

    /**
     * Get component description
     */
    getDescription() {
        return `Component ${this.designator} (${this.footprint})`;
    }

    /**
     * Get component information
     */
    getInfo() {
        return {
            type: 'component',
            id: this.id,
            position: this.position,
            size: this.size,
            rotation: this.rotation,
            layer: this.layer,
            designator: this.designator,
            footprint: this.footprint,
            description: this.description,
            padCount: this.pads.length
        };
    }

    /**
     * Clone component
     */
    clone() {
        const cloned = new Component(this.position, this.size, this.rotation, this.layer);
        cloned.designator = this.designator;
        cloned.footprint = this.footprint;
        cloned.description = this.description;
        cloned.pads = this.pads.map(pad => ({ ...pad }));
        return cloned;
    }

    /**
     * Convert to JSON
     */
    toJSON() {
        return {
            type: 'component',
            id: this.id,
            position: { x: this.position.x, y: this.position.y },
            size: { width: this.size.width, height: this.size.height },
            rotation: this.rotation,
            layer: this.layer,
            designator: this.designator,
            footprint: this.footprint,
            description: this.description,
            pads: this.pads
        };
    }

    /**
     * Create component from JSON
     */
    static fromJSON(data) {
        const component = new Component(
            new Point(data.position.x, data.position.y),
            { width: data.size.width, height: data.size.height },
            data.rotation || 0,
            data.layer || 'top-copper'
        );
        
        component.id = data.id;
        component.designator = data.designator || '';
        component.footprint = data.footprint || '';
        component.description = data.description || '';
        component.pads = data.pads || [];
        
        return component;
    }

    /**
     * Render component on canvas
     */
    render(ctx, viewport, renderer) {
        if (!this.visible) return;

        const screenPos = viewport.worldToScreen(this.position);
        const screenSize = {
            width: this.size.width * viewport.zoom,
            height: this.size.height * viewport.zoom
        };

        // Save context for rotation
        ctx.save();
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(this.rotation * Math.PI / 180);

        // Set component style
        if (this.selected) {
            ctx.strokeStyle = '#FFD700'; // Gold for selected
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = '#FFFFFF'; // White for normal
            ctx.lineWidth = 1;
        }

        // Draw component body
        ctx.fillStyle = this.layer === 'top-copper' ? 'rgba(204, 0, 0, 0.3)' : 'rgba(0, 102, 204, 0.3)';
        ctx.fillRect(-screenSize.width/2, -screenSize.height/2, screenSize.width, screenSize.height);
        ctx.strokeRect(-screenSize.width/2, -screenSize.height/2, screenSize.width, screenSize.height);

        // Draw designator text
        if (viewport.zoom > 0.5) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `${Math.max(10, 12 * viewport.zoom)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.designator, 0, 0);
        }

        // Draw pads if zoomed in enough
        if (viewport.zoom > 1.0 && this.pads.length > 0) {
            ctx.fillStyle = '#FFD700';
            this.pads.forEach(pad => {
                const padX = pad.x * viewport.zoom;
                const padY = pad.y * viewport.zoom;
                const padSize = Math.max(2, pad.size * viewport.zoom);
                
                if (pad.shape === 'round') {
                    ctx.beginPath();
                    ctx.arc(padX, padY, padSize/2, 0, 2 * Math.PI);
                    ctx.fill();
                } else {
                    ctx.fillRect(padX - padSize/2, padY - padSize/2, padSize, padSize);
                }
            });
        }

        ctx.restore();

        // Draw selection handles if selected
        if (this.selected) {
            this.drawSelectionHandles(ctx, viewport);
        }
    }

    /**
     * Draw selection handles
     */
    drawSelectionHandles(ctx, viewport) {
        const bounds = this.getBounds();
        const corners = [
            { x: bounds.left, y: bounds.top },
            { x: bounds.right, y: bounds.top },
            { x: bounds.right, y: bounds.bottom },
            { x: bounds.left, y: bounds.bottom }
        ];

        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;

        corners.forEach(corner => {
            const screenPos = viewport.worldToScreen(corner);
            const handleSize = 6;
            
            ctx.fillRect(screenPos.x - handleSize/2, screenPos.y - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(screenPos.x - handleSize/2, screenPos.y - handleSize/2, handleSize, handleSize);
        });
    }
}

// Export for use in other modules
window.Component = Component;
