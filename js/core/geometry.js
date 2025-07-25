/**
 * Geometry classes and utilities for PCB editor
 */

class Point {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    clone() {
        return new Point(this.x, this.y);
    }

    add(other) {
        return new Point(this.x + other.x, this.y + other.y);
    }

    subtract(other) {
        return new Point(this.x - other.x, this.y - other.y);
    }

    multiply(scalar) {
        return new Point(this.x * scalar, this.y * scalar);
    }

    distance(other) {
        return MathUtils.distance(this.x, this.y, other.x, other.y);
    }

    angle(other) {
        return MathUtils.angle(this.x, this.y, other.x, other.y);
    }

    rotate(center, angle) {
        const rotated = MathUtils.rotatePoint(this.x, this.y, center.x, center.y, angle);
        return new Point(rotated.x, rotated.y);
    }

    snapToGrid(gridSize) {
        return new Point(
            MathUtils.snapToGrid(this.x, gridSize),
            MathUtils.snapToGrid(this.y, gridSize)
        );
    }

    toString() {
        return `Point(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`;
    }
}

class Rectangle {
    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    get left() { return this.x; }
    get right() { return this.x + this.width; }
    get top() { return this.y; }
    get bottom() { return this.y + this.height; }
    get centerX() { return this.x + this.width / 2; }
    get centerY() { return this.y + this.height / 2; }
    get center() { return new Point(this.centerX, this.centerY); }

    clone() {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    contains(point) {
        return MathUtils.pointInRect(point.x, point.y, this.x, this.y, this.width, this.height);
    }

    intersects(other) {
        return MathUtils.rectIntersect(this, other);
    }

    union(other) {
        const left = Math.min(this.left, other.left);
        const top = Math.min(this.top, other.top);
        const right = Math.max(this.right, other.right);
        const bottom = Math.max(this.bottom, other.bottom);
        
        return new Rectangle(left, top, right - left, bottom - top);
    }

    expand(amount) {
        return new Rectangle(
            this.x - amount,
            this.y - amount,
            this.width + amount * 2,
            this.height + amount * 2
        );
    }

    toString() {
        return `Rectangle(${this.x}, ${this.y}, ${this.width}, ${this.height})`;
    }
}

class Circle {
    constructor(x = 0, y = 0, radius = 0) {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }

    get center() { return new Point(this.x, this.y); }
    get diameter() { return this.radius * 2; }

    clone() {
        return new Circle(this.x, this.y, this.radius);
    }

    contains(point) {
        return MathUtils.pointInCircle(point.x, point.y, this.x, this.y, this.radius);
    }

    getBoundingBox() {
        return new Rectangle(
            this.x - this.radius,
            this.y - this.radius,
            this.diameter,
            this.diameter
        );
    }

    toString() {
        return `Circle(${this.x}, ${this.y}, r=${this.radius})`;
    }
}

class Line {
    constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }

    get start() { return new Point(this.x1, this.y1); }
    get end() { return new Point(this.x2, this.y2); }
    get length() { return MathUtils.distance(this.x1, this.y1, this.x2, this.y2); }
    get angle() { return MathUtils.angle(this.x1, this.y1, this.x2, this.y2); }
    get center() { return new Point((this.x1 + this.x2) / 2, (this.y1 + this.y2) / 2); }

    clone() {
        return new Line(this.x1, this.y1, this.x2, this.y2);
    }

    distanceToPoint(point) {
        return MathUtils.pointToLineDistance(point.x, point.y, this.x1, this.y1, this.x2, this.y2);
    }

    getBoundingBox() {
        const minX = Math.min(this.x1, this.x2);
        const minY = Math.min(this.y1, this.y2);
        const maxX = Math.max(this.x1, this.x2);
        const maxY = Math.max(this.y1, this.y2);
        
        return new Rectangle(minX, minY, maxX - minX, maxY - minY);
    }

    toString() {
        return `Line(${this.x1}, ${this.y1} -> ${this.x2}, ${this.y2})`;
    }
}

class Polygon {
    constructor(points = []) {
        this.points = points.map(p => p instanceof Point ? p : new Point(p.x, p.y));
    }

    clone() {
        return new Polygon(this.points.map(p => p.clone()));
    }

    addPoint(point) {
        this.points.push(point instanceof Point ? point : new Point(point.x, point.y));
    }

    getBoundingBox() {
        if (this.points.length === 0) return new Rectangle();
        
        const bbox = MathUtils.getBoundingBox(this.points);
        return new Rectangle(bbox.x, bbox.y, bbox.width, bbox.height);
    }

    contains(point) {
        // Ray casting algorithm
        let inside = false;
        const x = point.x;
        const y = point.y;
        
        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            const xi = this.points[i].x;
            const yi = this.points[i].y;
            const xj = this.points[j].x;
            const yj = this.points[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }

    getArea() {
        if (this.points.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < this.points.length; i++) {
            const j = (i + 1) % this.points.length;
            area += this.points[i].x * this.points[j].y;
            area -= this.points[j].x * this.points[i].y;
        }
        
        return Math.abs(area) / 2;
    }

    toString() {
        return `Polygon(${this.points.length} points)`;
    }
}

class Transform {
    constructor() {
        this.reset();
    }

    reset() {
        this.matrix = [1, 0, 0, 1, 0, 0]; // [a, b, c, d, e, f]
        return this;
    }

    translate(x, y) {
        this.matrix[4] += this.matrix[0] * x + this.matrix[2] * y;
        this.matrix[5] += this.matrix[1] * x + this.matrix[3] * y;
        return this;
    }

    scale(sx, sy = sx) {
        this.matrix[0] *= sx;
        this.matrix[1] *= sx;
        this.matrix[2] *= sy;
        this.matrix[3] *= sy;
        return this;
    }

    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const a = this.matrix[0];
        const b = this.matrix[1];
        const c = this.matrix[2];
        const d = this.matrix[3];
        
        this.matrix[0] = a * cos + c * sin;
        this.matrix[1] = b * cos + d * sin;
        this.matrix[2] = c * cos - a * sin;
        this.matrix[3] = d * cos - b * sin;
        
        return this;
    }

    transformPoint(point) {
        const x = point.x;
        const y = point.y;
        
        return new Point(
            this.matrix[0] * x + this.matrix[2] * y + this.matrix[4],
            this.matrix[1] * x + this.matrix[3] * y + this.matrix[5]
        );
    }

    applyToContext(ctx) {
        ctx.setTransform(...this.matrix);
    }

    clone() {
        const transform = new Transform();
        transform.matrix = [...this.matrix];
        return transform;
    }
}

// Export classes for use in other modules
window.Point = Point;
window.Rectangle = Rectangle;
window.Circle = Circle;
window.Line = Line;
window.Polygon = Polygon;
window.Transform = Transform;
