/**
 * Represents a copper pour or polygon on a PCB layer.
 * Inherits from PCBObject.
 */
class Polygon extends PCBObject {
    constructor(layer, points = [], settings = {}) {
        super();
        this.type = 'polygon';
        this.layer = layer;
        this.points = points; // Array of {x, y} points defining the polygon boundary
        this.settings = {
            clearance: settings.clearance || 0.254, // Default 10 mils
            thermalRelief: settings.thermalRelief || true,
            thermalSpokeWidth: settings.thermalSpokeWidth || 0.5, // Default 20 mils
            removeIslands: settings.removeIslands || true,
            ...settings
        };
        
        // The filled geometry, calculated later
        this.filledGeometry = null; 
        this.thermals = []; // Calculated thermal relief connections
    }

    /**
     * Add a point to the polygon boundary.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     */
    addPoint(x, y) {
        this.points.push({ x, y });
        this.recalculate();
    }

    /**
     * Recalculates the polygon's filled geometry based on other objects.
     * This is a complex operation that needs to be triggered when the board changes.
     * @param {Array<PCBObject>} allObjects - All other objects on the board for clearance calculation.
     */
    recalculate(allObjects = []) {
        if (this.points.length < 3) {
            this.filledGeometry = null;
            this.thermals = [];
            return;
        }

        // 1. Start with the main polygon shape.
        let polygonShape = this.points.map(p => [p.x, p.y]);

        // 2. Create clearance voids for all other objects on the same layer.
        const voids = [];
        allObjects.forEach(obj => {
            if (obj === this || obj.layer !== this.layer) return;

            const clearance = this.settings.clearance;
            let clearanceShape = null;

            if (obj.type === 'trace') {
                // Create a polygon representing the trace with clearance
                clearanceShape = this.createTraceClearance(obj, clearance);
            } else if (obj.type === 'pad' || obj.type === 'via') {
                // Create a circular or rectangular clearance for pads/vias
                clearanceShape = this.createPadViaClearance(obj, clearance);
            }

            if (clearanceShape) {
                voids.push(clearanceShape);
            }
        });

        // 3. Use a geometry library to subtract the voids from the main polygon.
        // This is a placeholder for a real polygon clipping library (like Clipper.js or Polygon-clipping).
        // For now, we'll just store the main shape and the voids separately.
        this.filledGeometry = {
            main: polygonShape,
            voids: voids
        };

        // 4. Calculate thermal reliefs for connected pads.
        this.calculateThermals(allObjects);
        
        console.log(`Polygon on layer ${this.layer} recalculated.`);
    }

    /**
     * Creates a clearance shape for a trace.
     * @param {Trace} trace - The trace object.
     * @param {number} clearance - The clearance distance.
     * @returns {Array} - An array of points for the clearance polygon.
     */
    createTraceClearance(trace, clearance) {
        const halfWidth = trace.width / 2 + clearance;
        const angle = Math.atan2(trace.end.y - trace.start.y, trace.end.x - trace.start.x);
        const dx = halfWidth * Math.sin(angle);
        const dy = halfWidth * Math.cos(angle);

        return [
            [trace.start.x - dx, trace.start.y + dy],
            [trace.start.x + dx, trace.start.y - dy],
            [trace.end.x + dx, trace.end.y - dy],
            [trace.end.x - dx, trace.end.y + dy]
        ];
    }

    /**
     * Creates a clearance shape for a pad or via.
     * @param {Pad|Via} obj - The pad or via object.
     * @param {number} clearance - The clearance distance.
     * @returns {Array} - An array of points for the clearance polygon.
     */
    createPadViaClearance(obj, clearance) {
        const radius = (obj.diameter || obj.width) / 2 + clearance;
        const points = [];
        const segments = 16; // Approximate circle with 16 segments
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            points.push([
                obj.x + radius * Math.cos(angle),
                obj.y + radius * Math.sin(angle)
            ]);
        }
        return points;
    }

    /**
     * Calculates thermal relief connections for pads.
     * @param {Array<PCBObject>} allObjects - All objects on the board.
     */
    calculateThermals(allObjects) {
        this.thermals = [];
        if (!this.settings.thermalRelief) return;

        allObjects.forEach(obj => {
            if (obj.type === 'pad' && obj.layer === this.layer) {
                // Placeholder: In a real implementation, we'd check if the pad's net
                // matches the polygon's net. For now, we assume all pads on the layer
                // should connect if they are inside the polygon.
                if (this.isPointInPolygon({x: obj.x, y: obj.y})) {
                    this.thermals.push(this.createThermalSpokes(obj));
                }
            }
        });
    }

    /**
     * Creates the geometry for thermal spokes for a given pad.
     * @param {Pad} pad - The pad to connect to.
     * @returns {Array} - An array of spoke geometries (each is a line).
     */
    createThermalSpokes(pad) {
        const spokes = [];
        const spokeWidth = this.settings.thermalSpokeWidth;
        const padRadius = pad.width / 2;

        // Create 4 spokes at 45, 135, 225, 315 degrees
        for (let i = 0; i < 4; i++) {
            const angle = Math.PI / 4 + i * Math.PI / 2;
            const startX = pad.x + padRadius * Math.cos(angle);
            const startY = pad.y + padRadius * Math.sin(angle);
            const endX = pad.x + (padRadius + spokeWidth * 2) * Math.cos(angle);
            const endY = pad.y + (padRadius + spokeWidth * 2) * Math.sin(angle);
            spokes.push({
                start: { x: startX, y: startY },
                end: { x: endX, y: endY },
                width: spokeWidth
            });
        }
        return spokes;
    }

    /**
     * Checks if a point is inside the polygon boundary.
     * Uses the ray-casting algorithm.
     * @param {{x: number, y: number}} point - The point to check.
     * @returns {boolean} - True if the point is inside.
     */
    isPointInPolygon(point) {
        let isInside = false;
        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            const xi = this.points[i].x, yi = this.points[i].y;
            const xj = this.points[j].x, yj = this.points[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    /**
     * Renders the polygon on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Viewport} viewport - The current viewport.
     */
    render(ctx, viewport) {
        if (!this.filledGeometry) return;

        const transform = viewport.getTransform();
        ctx.save();
        ctx.fillStyle = this.pcbEditor.getLayerColor(this.layer);
        ctx.strokeStyle = this.pcbEditor.getLayerColor(this.layer);
        ctx.lineWidth = 1 / viewport.zoom;

        // Draw the main filled polygon
        ctx.beginPath();
        this.points.forEach((p, index) => {
            const screenP = transform.apply(p);
            if (index === 0) {
                ctx.moveTo(screenP.x, screenP.y);
            } else {
                ctx.lineTo(screenP.x, screenP.y);
            }
        });
        ctx.closePath();

        // Cut out the voids
        // Note: This requires a proper clipping library for complex shapes.
        // A simple canvas implementation can have issues with complex void overlaps.
        this.filledGeometry.voids.forEach(voidShape => {
            const firstPoint = transform.apply({x: voidShape[0][0], y: voidShape[0][1]});
            ctx.moveTo(firstPoint.x, firstPoint.y);
            for (let i = 1; i < voidShape.length; i++) {
                const p = transform.apply({x: voidShape[i][0], y: voidShape[i][1]});
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
        });
        
        ctx.fill('evenodd');

        // Draw thermal spokes
        ctx.strokeStyle = this.pcbEditor.getLayerColor(this.layer);
        this.thermals.flat().forEach(spoke => {
            const start = transform.apply(spoke.start);
            const end = transform.apply(spoke.end);
            ctx.lineWidth = spoke.width * viewport.zoom;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        });

        ctx.restore();
    }

    /**
     * Serialize the object to a JSON representation.
     * @returns {Object}
     */
    toJSON() {
        return {
            ...super.toJSON(),
            layer: this.layer,
            points: this.points,
            settings: this.settings
        };
    }

    /**
     * Create a Polygon object from a JSON representation.
     * @param {Object} json - The JSON data.
     * @returns {Polygon}
     */
    static fromJSON(json) {
        const poly = new Polygon(json.layer, json.points, json.settings);
        poly.id = json.id;
        poly.selected = json.selected;
        // Note: filledGeometry and thermals will be recalculated when needed.
        return poly;
    }
}

// Export for use in other modules if needed
window.Polygon = Polygon;
