/**
 * Base class for all PCB objects (traces, vias, components, etc.)
 */

class PCBObject {
    constructor(type, layer = 'top-copper') {
        this.id = MathUtils.generateUUID();
        this.type = type;
        this.layer = layer;
        this.position = new Point(0, 0);
        this.rotation = 0; // in radians
        this.visible = true;
        this.selected = false;
        this.locked = false;
        
        // Properties that can be edited
        this.properties = {};
        
        // Bounding box cache
        this._boundingBoxCache = null;
        this._boundingBoxDirty = true;
        
        // Creation timestamp
        this.createdAt = Date.now();
        this.modifiedAt = Date.now();
    }

    /**
     * Get object type
     */
    getType() {
        return this.type;
    }

    /**
     * Get object ID
     */
    getId() {
        return this.id;
    }

    /**
     * Set position
     */
    setPosition(x, y) {
        if (x instanceof Point) {
            this.position = x.clone();
        } else {
            this.position.x = x;
            this.position.y = y;
        }
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Get position
     */
    getPosition() {
        return this.position.clone();
    }

    /**
     * Move by delta
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
     * Set rotation in radians
     */
    setRotation(rotation) {
        this.rotation = rotation;
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Get rotation in radians
     */
    getRotation() {
        return this.rotation;
    }

    /**
     * Rotate by delta (in radians)
     */
    rotate(deltaRotation) {
        this.rotation += deltaRotation;
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Set layer
     */
    setLayer(layer) {
        this.layer = layer;
        this.touch();
    }

    /**
     * Get layer
     */
    getLayer() {
        return this.layer;
    }

    /**
     * Set visibility
     */
    setVisible(visible) {
        this.visible = visible;
    }

    /**
     * Check if object is visible
     */
    isVisible() {
        return this.visible;
    }

    /**
     * Set selection state
     */
    setSelected(selected) {
        this.selected = selected;
    }

    /**
     * Check if object is selected
     */
    isSelected() {
        return this.selected;
    }

    /**
     * Set locked state
     */
    setLocked(locked) {
        this.locked = locked;
    }

    /**
     * Check if object is locked
     */
    isLocked() {
        return this.locked;
    }

    /**
     * Set property value
     */
    setProperty(name, value) {
        this.properties[name] = value;
        this.touch();
    }

    /**
     * Get property value
     */
    getProperty(name, defaultValue = null) {
        return this.properties.hasOwnProperty(name) ? this.properties[name] : defaultValue;
    }

    /**
     * Get all properties
     */
    getProperties() {
        return { ...this.properties };
    }

    /**
     * Update modification timestamp
     */
    touch() {
        this.modifiedAt = Date.now();
    }

    /**
     * Invalidate bounding box cache
     */
    invalidateBoundingBox() {
        this._boundingBoxDirty = true;
        this._boundingBoxCache = null;
    }

    /**
     * Get bounding box (must be implemented by subclasses)
     */
    getBoundingBox() {
        if (this._boundingBoxDirty || !this._boundingBoxCache) {
            this._boundingBoxCache = this.calculateBoundingBox();
            this._boundingBoxDirty = false;
        }
        return this._boundingBoxCache;
    }

    /**
     * Calculate bounding box (to be implemented by subclasses)
     */
    calculateBoundingBox() {
        return new Rectangle(this.position.x, this.position.y, 0, 0);
    }

    /**
     * Check if point is inside object (to be implemented by subclasses)
     */
    containsPoint(point) {
        return this.getBoundingBox().contains(point);
    }

    /**
     * Get distance from point to object (to be implemented by subclasses)
     */
    distanceToPoint(point) {
        const bbox = this.getBoundingBox();
        const center = bbox.center;
        return point.distance(center);
    }

    /**
     * Render object (to be implemented by subclasses)
     */
    render(ctx, viewport, layer) {
        // Default implementation - draw bounding box
        if (this.selected) {
            const bbox = this.getBoundingBox();
            ctx.save();
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 1 / viewport.scale;
            ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
            ctx.restore();
        }
    }

    /**
     * Create a copy of this object
     */
    clone() {
        const cloned = new this.constructor();
        cloned.type = this.type;
        cloned.layer = this.layer;
        cloned.position = this.position.clone();
        cloned.rotation = this.rotation;
        cloned.visible = this.visible;
        cloned.properties = MathUtils.deepClone(this.properties);
        return cloned;
    }

    /**
     * Serialize object to JSON
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            layer: this.layer,
            position: { x: this.position.x, y: this.position.y },
            rotation: this.rotation,
            visible: this.visible,
            properties: this.properties,
            createdAt: this.createdAt,
            modifiedAt: this.modifiedAt
        };
    }

    /**
     * Deserialize object from JSON
     */
    static fromJSON(data) {
        const obj = new this();
        obj.id = data.id || MathUtils.generateUUID();
        obj.type = data.type;
        obj.layer = data.layer || 'top-copper';
        obj.position = new Point(data.position.x, data.position.y);
        obj.rotation = data.rotation || 0;
        obj.visible = data.visible !== false;
        obj.properties = data.properties || {};
        obj.createdAt = data.createdAt || Date.now();
        obj.modifiedAt = data.modifiedAt || Date.now();
        return obj;
    }

    /**
     * Get object info for properties panel
     */
    getInfo() {
        return {
            id: this.id,
            type: this.type,
            layer: this.layer,
            position: this.position,
            rotation: MathUtils.radToDeg(this.rotation),
            visible: this.visible,
            selected: this.selected,
            locked: this.locked,
            properties: this.getProperties()
        };
    }

    /**
     * Apply transform to object
     */
    applyTransform(transform) {
        this.position = transform.transformPoint(this.position);
        this.invalidateBoundingBox();
        this.touch();
    }

    /**
     * Check if object intersects with rectangle
     */
    intersects(rect) {
        return this.getBoundingBox().intersects(rect);
    }

    /**
     * Get snap points for this object
     */
    getSnapPoints() {
        const bbox = this.getBoundingBox();
        return [
            this.position,
            bbox.center,
            new Point(bbox.left, bbox.top),
            new Point(bbox.right, bbox.top),
            new Point(bbox.left, bbox.bottom),
            new Point(bbox.right, bbox.bottom)
        ];
    }

    /**
     * Validate object properties
     */
    validate() {
        const errors = [];
        
        if (!this.type) {
            errors.push('Object type is required');
        }
        
        if (!this.layer) {
            errors.push('Layer is required');
        }
        
        if (!this.position) {
            errors.push('Position is required');
        }
        
        return errors;
    }

    /**
     * Get object description for display
     */
    getDescription() {
        return `${this.type} on ${this.layer}`;
    }

    /**
     * Check if object can be edited
     */
    canEdit() {
        return !this.locked;
    }

    /**
     * Check if object can be deleted
     */
    canDelete() {
        return !this.locked;
    }

    /**
     * Check if object can be moved
     */
    canMove() {
        return !this.locked;
    }

    /**
     * Get object's electrical connections (for routing)
     */
    getConnections() {
        return [];
    }

    /**
     * Check if object is electrically connected to another object
     */
    isConnectedTo(other) {
        return false;
    }

    /**
     * Get object's net (electrical network)
     */
    getNet() {
        return this.getProperty('net', null);
    }

    /**
     * Set object's net
     */
    setNet(net) {
        this.setProperty('net', net);
    }
}

// Export for use in other modules
window.PCBObject = PCBObject;
