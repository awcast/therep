/**
 * Mathematical utilities for PCB editor
 */

class MathUtils {
    /**
     * Convert degrees to radians
     */
    static degToRad(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Convert radians to degrees
     */
    static radToDeg(radians) {
        return radians * 180 / Math.PI;
    }

    /**
     * Calculate distance between two points
     */
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate angle between two points in radians
     */
    static angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    /**
     * Clamp a value between min and max
     */
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Linear interpolation between two values
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Check if a point is inside a rectangle
     */
    static pointInRect(px, py, rx, ry, rw, rh) {
        return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    }

    /**
     * Check if a point is inside a circle
     */
    static pointInCircle(px, py, cx, cy, radius) {
        return this.distance(px, py, cx, cy) <= radius;
    }

    /**
     * Snap value to grid
     */
    static snapToGrid(value, gridSize) {
        return Math.round(value / gridSize) * gridSize;
    }

    /**
     * Convert millimeters to pixels
     */
    static mmToPixels(mm, dpi = 96) {
        return mm * dpi / 25.4;
    }

    /**
     * Convert pixels to millimeters
     */
    static pixelsToMm(pixels, dpi = 96) {
        return pixels * 25.4 / dpi;
    }

    /**
     * Rotate a point around another point
     */
    static rotatePoint(px, py, cx, cy, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = px - cx;
        const dy = py - cy;
        
        return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos
        };
    }

    /**
     * Calculate bounding box for a set of points
     */
    static getBoundingBox(points) {
        if (points.length === 0) return null;
        
        let minX = points[0].x;
        let minY = points[0].y;
        let maxX = points[0].x;
        let maxY = points[0].y;
        
        for (let i = 1; i < points.length; i++) {
            minX = Math.min(minX, points[i].x);
            minY = Math.min(minY, points[i].y);
            maxX = Math.max(maxX, points[i].x);
            maxY = Math.max(maxY, points[i].y);
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Check if two rectangles intersect
     */
    static rectIntersect(r1, r2) {
        return !(r2.x > r1.x + r1.width || 
                r2.x + r2.width < r1.x || 
                r2.y > r1.y + r1.height ||
                r2.y + r2.height < r1.y);
    }

    /**
     * Calculate the shortest distance from a point to a line segment
     */
    static pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
            return this.distance(px, py, x1, y1);
        }
        
        let param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        return this.distance(px, py, xx, yy);
    }

    /**
     * Generate a UUID v4
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Deep clone an object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }
}

// Export for use in other modules
window.MathUtils = MathUtils;
