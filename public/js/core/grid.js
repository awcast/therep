/**
 * Grid system for PCB editor
 */

class Grid {
    constructor(size = 1.27, visible = true) {
        this.size = size; // Grid size in mm
        this.visible = visible;
        this.origin = new Point(0, 0);
        this.majorGridMultiplier = 5; // Every 5th line is major
        this.color = '#333333';
        this.majorColor = '#444444';
        this.alpha = 0.5;
        this.minPixelSpacing = 10; // Minimum pixels between grid lines
    }

    /**
     * Set grid size in millimeters
     */
    setSize(size) {
        this.size = Math.max(0.01, size); // Minimum 0.01mm
    }

    /**
     * Get grid size in pixels for current zoom level
     */
    getPixelSize(viewport) {
        return this.size * viewport.scale;
    }

    /**
     * Check if grid should be visible at current zoom level
     */
    shouldRender(viewport) {
        if (!this.visible) return false;
        return this.getPixelSize(viewport) >= this.minPixelSpacing;
    }

    /**
     * Snap a point to the grid
     */
    snapPoint(point) {
        if (this.size <= 0) return point.clone();
        
        return new Point(
            MathUtils.snapToGrid(point.x - this.origin.x, this.size) + this.origin.x,
            MathUtils.snapToGrid(point.y - this.origin.y, this.size) + this.origin.y
        );
    }

    /**
     * Snap a value to the grid
     */
    snapValue(value) {
        if (this.size <= 0) return value;
        return MathUtils.snapToGrid(value, this.size);
    }

    /**
     * Get the nearest grid point to a given point
     */
    getNearestGridPoint(point) {
        return this.snapPoint(point);
    }

    /**
     * Get grid lines that should be visible in the viewport
     */
    getVisibleLines(viewport) {
        if (!this.shouldRender(viewport)) return { vertical: [], horizontal: [] };

        const pixelSize = this.getPixelSize(viewport);
        const bounds = viewport.getVisibleBounds();
        
        // Calculate grid line positions
        const startX = Math.floor((bounds.left - this.origin.x) / this.size) * this.size + this.origin.x;
        const endX = Math.ceil((bounds.right - this.origin.x) / this.size) * this.size + this.origin.x;
        const startY = Math.floor((bounds.top - this.origin.y) / this.size) * this.size + this.origin.y;
        const endY = Math.ceil((bounds.bottom - this.origin.y) / this.size) * this.size + this.origin.y;

        const vertical = [];
        const horizontal = [];

        // Generate vertical lines
        for (let x = startX; x <= endX; x += this.size) {
            const gridIndex = Math.round((x - this.origin.x) / this.size);
            const isMajor = gridIndex % this.majorGridMultiplier === 0;
            vertical.push({
                x: x,
                y1: bounds.top,
                y2: bounds.bottom,
                isMajor: isMajor
            });
        }

        // Generate horizontal lines
        for (let y = startY; y <= endY; y += this.size) {
            const gridIndex = Math.round((y - this.origin.y) / this.size);
            const isMajor = gridIndex % this.majorGridMultiplier === 0;
            horizontal.push({
                y: y,
                x1: bounds.left,
                x2: bounds.right,
                isMajor: isMajor
            });
        }

        return { vertical, horizontal };
    }

    /**
     * Render the grid
     */
    render(ctx, viewport) {
        if (!this.shouldRender(viewport)) return;

        const lines = this.getVisibleLines(viewport);
        
        ctx.save();
        
        // Set line properties
        ctx.lineWidth = 1;
        ctx.globalAlpha = this.alpha;

        // Draw minor grid lines
        ctx.strokeStyle = this.color;
        ctx.beginPath();
        
        lines.vertical.forEach(line => {
            if (!line.isMajor) {
                const screenX = viewport.worldToScreenX(line.x);
                const screenY1 = viewport.worldToScreenY(line.y1);
                const screenY2 = viewport.worldToScreenY(line.y2);
                ctx.moveTo(screenX, screenY1);
                ctx.lineTo(screenX, screenY2);
            }
        });
        
        lines.horizontal.forEach(line => {
            if (!line.isMajor) {
                const screenY = viewport.worldToScreenY(line.y);
                const screenX1 = viewport.worldToScreenX(line.x1);
                const screenX2 = viewport.worldToScreenX(line.x2);
                ctx.moveTo(screenX1, screenY);
                ctx.lineTo(screenX2, screenY);
            }
        });
        
        ctx.stroke();

        // Draw major grid lines
        ctx.strokeStyle = this.majorColor;
        ctx.beginPath();
        
        lines.vertical.forEach(line => {
            if (line.isMajor) {
                const screenX = viewport.worldToScreenX(line.x);
                const screenY1 = viewport.worldToScreenY(line.y1);
                const screenY2 = viewport.worldToScreenY(line.y2);
                ctx.moveTo(screenX, screenY1);
                ctx.lineTo(screenX, screenY2);
            }
        });
        
        lines.horizontal.forEach(line => {
            if (line.isMajor) {
                const screenY = viewport.worldToScreenY(line.y);
                const screenX1 = viewport.worldToScreenX(line.x1);
                const screenX2 = viewport.worldToScreenX(line.x2);
                ctx.moveTo(screenX1, screenY);
                ctx.lineTo(screenX2, screenY);
            }
        });
        
        ctx.stroke();

        // Draw origin marker
        this.renderOrigin(ctx, viewport);
        
        ctx.restore();
    }

    /**
     * Render origin marker
     */
    renderOrigin(ctx, viewport) {
        const screenOrigin = viewport.worldToScreen(this.origin);
        const size = 10;
        
        ctx.save();
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        
        // Draw crosshair
        ctx.beginPath();
        ctx.moveTo(screenOrigin.x - size, screenOrigin.y);
        ctx.lineTo(screenOrigin.x + size, screenOrigin.y);
        ctx.moveTo(screenOrigin.x, screenOrigin.y - size);
        ctx.lineTo(screenOrigin.x, screenOrigin.y + size);
        ctx.stroke();
        
        // Draw circle
        ctx.beginPath();
        ctx.arc(screenOrigin.x, screenOrigin.y, 3, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }

    /**
     * Set grid visibility
     */
    setVisible(visible) {
        this.visible = visible;
    }

    /**
     * Toggle grid visibility
     */
    toggleVisible() {
        this.visible = !this.visible;
        return this.visible;
    }

    /**
     * Set grid origin
     */
    setOrigin(point) {
        this.origin = point.clone();
    }

    /**
     * Get common grid sizes in mm
     */
    static getCommonSizes() {
        return [
            { name: '0.05mm', value: 0.05 },
            { name: '0.1mm', value: 0.1 },
            { name: '0.25mm', value: 0.25 },
            { name: '0.5mm', value: 0.5 },
            { name: '1.0mm', value: 1.0 },
            { name: '1.27mm (50mil)', value: 1.27 },
            { name: '2.54mm (100mil)', value: 2.54 },
            { name: '5.08mm (200mil)', value: 5.08 }
        ];
    }

    /**
     * Convert between different units
     */
    static convertUnits(value, fromUnit, toUnit) {
        const conversions = {
            'mm': 1,
            'mil': 0.0254,
            'inch': 25.4,
            'cm': 10
        };
        
        if (!conversions[fromUnit] || !conversions[toUnit]) {
            throw new Error(`Unknown unit: ${fromUnit} or ${toUnit}`);
        }
        
        return value * conversions[fromUnit] / conversions[toUnit];
    }

    /**
     * Format grid size for display
     */
    formatSize() {
        if (this.size >= 1) {
            return `${this.size.toFixed(2)}mm`;
        } else if (this.size >= 0.1) {
            return `${this.size.toFixed(3)}mm`;
        } else {
            return `${this.size.toFixed(4)}mm`;
        }
    }

    /**
     * Create a copy of this grid
     */
    clone() {
        const grid = new Grid(this.size, this.visible);
        grid.origin = this.origin.clone();
        grid.majorGridMultiplier = this.majorGridMultiplier;
        grid.color = this.color;
        grid.majorColor = this.majorColor;
        grid.alpha = this.alpha;
        grid.minPixelSpacing = this.minPixelSpacing;
        return grid;
    }
}

// Export for use in other modules
window.Grid = Grid;
