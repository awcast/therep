/**
 * Gerber file parser for PCB manufacturing files
 * Supports RS-274X format (Extended Gerber)
 */

class GerberParser {
    constructor() {
        this.apertures = new Map();
        this.currentAperture = null;
        this.currentX = 0;
        this.currentY = 0;
        this.format = { integer: 2, decimal: 4 }; // Default format
        this.units = 'mm'; // Default units
        this.elements = [];
        this.layers = [];
        this.polarity = 'positive';
    }

    /**
     * Parse Gerber file content
     */
    parse(content) {
        this.elements = [];
        this.apertures.clear();
        
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            try {
                this.parseLine(line);
            } catch (error) {
                console.warn(`Error parsing Gerber line ${i + 1}: ${line}`, error);
            }
        }
        
        return {
            elements: this.elements,
            apertures: Array.from(this.apertures.entries()),
            format: this.format,
            units: this.units,
            layers: this.layers
        };
    }

    /**
     * Parse a single Gerber line
     */
    parseLine(line) {
        // Skip empty lines and comments
        if (!line || line.startsWith('G04')) return;
        
        // Extended commands (start with %)
        if (line.startsWith('%')) {
            this.parseExtendedCommand(line);
            return;
        }
        
        // G-codes
        if (line.includes('G01') || line.includes('G02') || line.includes('G03')) {
            this.parseGCode(line);
            return;
        }
        
        // D-codes (aperture operations)
        if (line.includes('D') && /D\d+/.test(line)) {
            this.parseDCode(line);
            return;
        }
        
        // M-codes (miscellaneous)
        if (line.startsWith('M')) {
            this.parseMCode(line);
            return;
        }
        
        // Coordinate data
        if (line.includes('X') || line.includes('Y')) {
            this.parseCoordinates(line);
            return;
        }
    }

    /**
     * Parse extended commands
     */
    parseExtendedCommand(line) {
        const content = line.slice(1, -1); // Remove % markers
        
        // Format specification
        if (content.startsWith('FSLAX')) {
            const match = content.match(/FSLAX(\d)(\d)Y(\d)(\d)/);
            if (match) {
                this.format = {
                    integer: parseInt(match[1]),
                    decimal: parseInt(match[2])
                };
            }
        }
        
        // Units
        else if (content === 'MOMM') {
            this.units = 'mm';
        }
        else if (content === 'MOIN') {
            this.units = 'inch';
        }
        
        // Aperture definition
        else if (content.startsWith('ADD')) {
            this.parseApertureDefinition(content);
        }
        
        // Layer polarity
        else if (content.startsWith('LPD')) {
            this.polarity = 'positive';
        }
        else if (content.startsWith('LPC')) {
            this.polarity = 'negative';
        }
        
        // Layer name
        else if (content.startsWith('LN')) {
            const layerName = content.substring(2);
            this.layers.push(layerName);
        }
    }

    /**
     * Parse aperture definition
     */
    parseApertureDefinition(content) {
        // ADD10C,0.152400*  (Circle, diameter 0.1524mm)
        // ADD11R,1.524000X0.508000*  (Rectangle, 1.524x0.508mm)
        const match = content.match(/ADD(\d+)([CRO])(?:,([^*]+))?/);
        if (!match) return;
        
        const dCode = parseInt(match[1]);
        const shape = match[2];
        const params = match[3] ? match[3].split('X').map(p => parseFloat(p)) : [];
        
        let aperture = { shape, params };
        
        switch (shape) {
            case 'C': // Circle
                aperture.diameter = params[0] || 0;
                break;
            case 'R': // Rectangle
                aperture.width = params[0] || 0;
                aperture.height = params[1] || params[0] || 0;
                break;
            case 'O': // Obround
                aperture.width = params[0] || 0;
                aperture.height = params[1] || 0;
                break;
        }
        
        this.apertures.set(dCode, aperture);
    }

    /**
     * Parse G-codes
     */
    parseGCode(line) {
        if (line.includes('G01')) {
            // Linear interpolation
            this.parseCoordinates(line, 'linear');
        } else if (line.includes('G02')) {
            // Clockwise circular interpolation
            this.parseCoordinates(line, 'cw_arc');
        } else if (line.includes('G03')) {
            // Counter-clockwise circular interpolation
            this.parseCoordinates(line, 'ccw_arc');
        }
    }

    /**
     * Parse D-codes
     */
    parseDCode(line) {
        const dMatch = line.match(/D(\d+)/);
        if (!dMatch) return;
        
        const dCode = parseInt(dMatch[1]);
        
        if (dCode >= 10) {
            // Aperture selection
            this.currentAperture = dCode;
        } else {
            // Operation code
            switch (dCode) {
                case 1: // Interpolate (draw)
                    this.parseCoordinates(line, 'draw');
                    break;
                case 2: // Move (no draw)
                    this.parseCoordinates(line, 'move');
                    break;
                case 3: // Flash
                    this.flash(this.currentX, this.currentY);
                    break;
            }
        }
    }

    /**
     * Parse M-codes
     */
    parseMCode(line) {
        if (line.startsWith('M02')) {
            // End of file
            return;
        }
    }

    /**
     * Parse coordinate data
     */
    parseCoordinates(line, operation = 'move') {
        const xMatch = line.match(/X([+-]?\d+)/);
        const yMatch = line.match(/Y([+-]?\d+)/);
        const iMatch = line.match(/I([+-]?\d+)/); // Arc center offset
        const jMatch = line.match(/J([+-]?\d+)/); // Arc center offset
        
        let newX = this.currentX;
        let newY = this.currentY;
        
        if (xMatch) {
            newX = this.parseCoordinate(xMatch[1]);
        }
        if (yMatch) {
            newY = this.parseCoordinate(yMatch[1]);
        }
        
        // Create element based on operation
        if (operation === 'draw' || operation === 'linear') {
            this.addLine(this.currentX, this.currentY, newX, newY);
        } else if (operation === 'cw_arc' || operation === 'ccw_arc') {
            const i = iMatch ? this.parseCoordinate(iMatch[1]) : 0;
            const j = jMatch ? this.parseCoordinate(jMatch[1]) : 0;
            this.addArc(this.currentX, this.currentY, newX, newY, i, j, operation === 'cw_arc');
        }
        
        this.currentX = newX;
        this.currentY = newY;
    }

    /**
     * Parse coordinate value according to format
     */
    parseCoordinate(coordStr) {
        const value = parseInt(coordStr);
        const divisor = Math.pow(10, this.format.decimal);
        return value / divisor;
    }

    /**
     * Add line element
     */
    addLine(x1, y1, x2, y2) {
        if (!this.currentAperture) return;
        
        const aperture = this.apertures.get(this.currentAperture);
        if (!aperture) return;
        
        this.elements.push({
            type: 'line',
            x1, y1, x2, y2,
            aperture: this.currentAperture,
            width: aperture.diameter || aperture.width || 0,
            polarity: this.polarity
        });
    }

    /**
     * Add arc element
     */
    addArc(x1, y1, x2, y2, i, j, clockwise) {
        if (!this.currentAperture) return;
        
        const aperture = this.apertures.get(this.currentAperture);
        if (!aperture) return;
        
        this.elements.push({
            type: 'arc',
            x1, y1, x2, y2,
            centerX: x1 + i,
            centerY: y1 + j,
            clockwise,
            aperture: this.currentAperture,
            width: aperture.diameter || aperture.width || 0,
            polarity: this.polarity
        });
    }

    /**
     * Add flash element (aperture placed at current position)
     */
    flash(x, y) {
        if (!this.currentAperture) return;
        
        const aperture = this.apertures.get(this.currentAperture);
        if (!aperture) return;
        
        this.elements.push({
            type: 'flash',
            x, y,
            aperture: this.currentAperture,
            shape: aperture.shape,
            width: aperture.width || aperture.diameter || 0,
            height: aperture.height || aperture.diameter || 0,
            polarity: this.polarity
        });
    }

    /**
     * Convert parsed data to PCB objects
     */
    toPCBObjects() {
        const objects = [];
        
        this.elements.forEach(element => {
            switch (element.type) {
                case 'line':
                    objects.push(new Trace(
                        new Point(element.x1, element.y1),
                        new Point(element.x2, element.y2),
                        element.width,
                        'gerber'
                    ));
                    break;
                    
                case 'flash':
                    if (element.shape === 'C') {
                        objects.push(new Via(
                            new Point(element.x, element.y),
                            element.width,
                            0, // No drill for gerber
                            'gerber'
                        ));
                    } else {
                        objects.push(new Pad(
                            new Point(element.x, element.y),
                            element.width,
                            element.height,
                            element.shape === 'R' ? 'rect' : 'oval',
                            'gerber'
                        ));
                    }
                    break;
                    
                case 'arc':
                    // For now, approximate arcs as multiple line segments
                    const segments = this.arcToSegments(element);
                    segments.forEach(segment => {
                        objects.push(new Trace(
                            new Point(segment.x1, segment.y1),
                            new Point(segment.x2, segment.y2),
                            element.width,
                            'gerber'
                        ));
                    });
                    break;
            }
        });
        
        return objects;
    }

    /**
     * Convert arc to line segments
     */
    arcToSegments(arc) {
        const segments = [];
        const numSegments = 16; // Number of segments to approximate arc
        
        const centerX = arc.centerX;
        const centerY = arc.centerY;
        const radius = Math.sqrt(Math.pow(arc.x1 - centerX, 2) + Math.pow(arc.y1 - centerY, 2));
        
        const startAngle = Math.atan2(arc.y1 - centerY, arc.x1 - centerX);
        const endAngle = Math.atan2(arc.y2 - centerY, arc.x2 - centerX);
        
        let angleStep = (endAngle - startAngle) / numSegments;
        if (arc.clockwise && angleStep > 0) angleStep -= 2 * Math.PI;
        if (!arc.clockwise && angleStep < 0) angleStep += 2 * Math.PI;
        
        for (let i = 0; i < numSegments; i++) {
            const angle1 = startAngle + i * angleStep;
            const angle2 = startAngle + (i + 1) * angleStep;
            
            const x1 = centerX + radius * Math.cos(angle1);
            const y1 = centerY + radius * Math.sin(angle1);
            const x2 = centerX + radius * Math.cos(angle2);
            const y2 = centerY + radius * Math.sin(angle2);
            
            segments.push({ x1, y1, x2, y2 });
        }
        
        return segments;
    }

    /**
     * Export elements back to Gerber format
     */
    export() {
        let output = [];
        
        // Header
        output.push('G04 Generated by ModernPCB Editor*');
        output.push('%FSLAX24Y24*%');
        output.push(`%MO${this.units.toUpperCase()}*%`);
        
        // Aperture definitions
        this.apertures.forEach((aperture, dCode) => {
            let def = `%ADD${dCode}${aperture.shape}`;
            if (aperture.shape === 'C') {
                def += `,${aperture.diameter}`;
            } else if (aperture.shape === 'R') {
                def += `,${aperture.width}X${aperture.height}`;
            }
            def += '*%';
            output.push(def);
        });
        
        // Drawing commands
        this.elements.forEach(element => {
            switch (element.type) {
                case 'line':
                    output.push(`D${element.aperture}*`);
                    output.push(`X${this.formatCoordinate(element.x1)}Y${this.formatCoordinate(element.y1)}D02*`);
                    output.push(`X${this.formatCoordinate(element.x2)}Y${this.formatCoordinate(element.y2)}D01*`);
                    break;
                    
                case 'flash':
                    output.push(`D${element.aperture}*`);
                    output.push(`X${this.formatCoordinate(element.x)}Y${this.formatCoordinate(element.y)}D03*`);
                    break;
            }
        });
        
        // End of file
        output.push('M02*');
        
        return output.join('\n');
    }

    /**
     * Format coordinate for output
     */
    formatCoordinate(value) {
        const multiplier = Math.pow(10, this.format.decimal);
        return Math.round(value * multiplier).toString();
    }
}

// Export for use in other modules
window.GerberParser = GerberParser;
