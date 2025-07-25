/**
 * Drill file parser for PCB manufacturing
 * Supports Excellon drill format
 */

class DrillParser {
    constructor() {
        this.tools = new Map();
        this.currentTool = null;
        this.currentX = 0;
        this.currentY = 0;
        this.format = { integer: 2, decimal: 4 }; // Default format
        this.units = 'inch'; // Default units for drill files
        this.holes = [];
        this.header = true;
    }

    /**
     * Parse drill file content
     */
    parse(content) {
        this.holes = [];
        this.tools.clear();
        this.header = true;
        
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            try {
                this.parseLine(line);
            } catch (error) {
                console.warn(`Error parsing drill line ${i + 1}: ${line}`, error);
            }
        }
        
        return {
            holes: this.holes,
            tools: Array.from(this.tools.entries()),
            format: this.format,
            units: this.units
        };
    }

    /**
     * Parse a single drill file line
     */
    parseLine(line) {
        // Skip empty lines and comments
        if (!line || line.startsWith(';')) return;
        
        // Header commands
        if (this.header) {
            if (this.parseHeaderCommand(line)) return;
        }
        
        // Tool selection
        if (line.match(/^T\d+$/)) {
            this.selectTool(line);
            return;
        }
        
        // Tool definition
        if (line.match(/^T\d+C/)) {
            this.defineTools(line);
            return;
        }
        
        // Coordinate data with drilling
        if (line.includes('X') || line.includes('Y')) {
            this.parseCoordinates(line);
            return;
        }
        
        // G-codes
        if (line.startsWith('G')) {
            this.parseGCode(line);
            return;
        }
        
        // M-codes
        if (line.startsWith('M')) {
            this.parseMCode(line);
            return;
        }
    }

    /**
     * Parse header commands
     */
    parseHeaderCommand(line) {
        // Format specification (INCH or METRIC)
        if (line === 'INCH' || line === 'METRIC') {
            this.units = line.toLowerCase() === 'inch' ? 'inch' : 'mm';
            return true;
        }
        
        // Format specification with decimals
        if (line.match(/^FMAT/)) {
            // FMAT,2 means 2 decimal places
            const match = line.match(/FMAT,(\d+)/);
            if (match) {
                this.format.decimal = parseInt(match[1]);
            }
            return true;
        }
        
        // Leading/trailing zeros
        if (line.match(/^(LZ|TZ)/)) {
            // LZ = leading zeros, TZ = trailing zeros
            return true;
        }
        
        // Header end
        if (line === '%') {
            this.header = false;
            return true;
        }
        
        return false;
    }

    /**
     * Parse tool definition
     */
    defineTools(line) {
        // T01C0.0236 (Tool 1, diameter 0.0236")
        const match = line.match(/^T(\d+)C([0-9.]+)/);
        if (!match) return;
        
        const toolNumber = parseInt(match[1]);
        const diameter = parseFloat(match[2]);
        
        this.tools.set(toolNumber, {
            number: toolNumber,
            diameter: diameter,
            units: this.units
        });
    }

    /**
     * Select current tool
     */
    selectTool(line) {
        const match = line.match(/^T(\d+)$/);
        if (!match) return;
        
        this.currentTool = parseInt(match[1]);
    }

    /**
     * Parse G-codes
     */
    parseGCode(line) {
        if (line === 'G05') {
            // Drill mode
            return;
        } else if (line === 'G00') {
            // Route mode (move without drilling)
            return;
        } else if (line === 'G01') {
            // Linear interpolation
            return;
        } else if (line === 'G90') {
            // Absolute coordinates
            return;
        } else if (line === 'G91') {
            // Incremental coordinates
            return;
        }
    }

    /**
     * Parse M-codes
     */
    parseMCode(line) {
        if (line === 'M30') {
            // End of program
            return;
        } else if (line === 'M48') {
            // Beginning of header
            this.header = true;
            return;
        } else if (line === 'M95') {
            // End of header
            this.header = false;
            return;
        }
    }

    /**
     * Parse coordinate data and drill hole
     */
    parseCoordinates(line) {
        const xMatch = line.match(/X([+-]?[\d.]+)/);
        const yMatch = line.match(/Y([+-]?[\d.]+)/);
        
        let newX = this.currentX;
        let newY = this.currentY;
        
        if (xMatch) {
            newX = this.parseCoordinate(xMatch[1]);
        }
        if (yMatch) {
            newY = this.parseCoordinate(yMatch[1]);
        }
        
        // Drill hole at new position
        this.drillHole(newX, newY);
        
        this.currentX = newX;
        this.currentY = newY;
    }

    /**
     * Parse coordinate value according to format
     */
    parseCoordinate(coordStr) {
        let value = parseFloat(coordStr);
        
        // If no decimal point and format specifies decimal places
        if (!coordStr.includes('.') && this.format.decimal > 0) {
            const divisor = Math.pow(10, this.format.decimal);
            value = value / divisor;
        }
        
        // Convert to mm if units are inches
        if (this.units === 'inch') {
            value = value * 25.4;
        }
        
        return value;
    }

    /**
     * Drill hole at current position
     */
    drillHole(x, y) {
        if (!this.currentTool) return;
        
        const tool = this.tools.get(this.currentTool);
        if (!tool) return;
        
        let diameter = tool.diameter;
        // Convert diameter to mm if tool was defined in inches
        if (tool.units === 'inch') {
            diameter = diameter * 25.4;
        }
        
        this.holes.push({
            x: x,
            y: y,
            diameter: diameter,
            tool: this.currentTool
        });
    }

    /**
     * Convert parsed data to PCB objects
     */
    toPCBObjects() {
        const objects = [];
        
        this.holes.forEach(hole => {
            // Create via object for drill holes
            objects.push(new Via(
                new Point(hole.x, hole.y),
                hole.diameter + 0.2, // Add 0.2mm for annular ring
                hole.diameter,
                'drill'
            ));
        });
        
        return objects;
    }

    /**
     * Export holes back to drill format
     */
    export() {
        let output = [];
        
        // Header
        output.push('M48');
        output.push(this.units.toUpperCase());
        
        // Tool definitions
        this.tools.forEach((tool, number) => {
            const diameter = this.units === 'inch' ? 
                (tool.diameter / 25.4).toFixed(4) : 
                tool.diameter.toFixed(3);
            output.push(`T${number.toString().padStart(2, '0')}C${diameter}`);
        });
        
        output.push('%');
        output.push('G90'); // Absolute coordinates
        output.push('G05'); // Drill mode
        
        // Group holes by tool
        const holesByTool = new Map();
        this.holes.forEach(hole => {
            if (!holesByTool.has(hole.tool)) {
                holesByTool.set(hole.tool, []);
            }
            holesByTool.get(hole.tool).push(hole);
        });
        
        // Output holes grouped by tool
        holesByTool.forEach((holes, toolNumber) => {
            output.push(`T${toolNumber.toString().padStart(2, '0')}`);
            
            holes.forEach(hole => {
                const x = this.units === 'inch' ? 
                    (hole.x / 25.4).toFixed(4) : 
                    hole.x.toFixed(3);
                const y = this.units === 'inch' ? 
                    (hole.y / 25.4).toFixed(4) : 
                    hole.y.toFixed(3);
                output.push(`X${x}Y${y}`);
            });
        });
        
        // End of program
        output.push('M30');
        
        return output.join('\n');
    }

    /**
     * Get drill statistics
     */
    getStatistics() {
        const stats = {
            totalHoles: this.holes.length,
            toolCount: this.tools.size,
            toolUsage: new Map()
        };
        
        // Count holes per tool
        this.holes.forEach(hole => {
            const count = stats.toolUsage.get(hole.tool) || 0;
            stats.toolUsage.set(hole.tool, count + 1);
        });
        
        return stats;
    }

    /**
     * Optimize drill order for minimal tool changes
     */
    optimizeDrillOrder() {
        // Group holes by tool
        const holesByTool = new Map();
        this.holes.forEach((hole, index) => {
            if (!holesByTool.has(hole.tool)) {
                holesByTool.set(hole.tool, []);
            }
            holesByTool.get(hole.tool).push({ ...hole, originalIndex: index });
        });
        
        // Sort tools by number of holes (descending)
        const sortedTools = Array.from(holesByTool.entries())
            .sort(([,a], [,b]) => b.length - a.length);
        
        // Rebuild holes array with optimized order
        const optimizedHoles = [];
        sortedTools.forEach(([tool, holes]) => {
            // Sort holes within each tool by proximity (simple nearest neighbor)
            const sortedHoles = this.sortHolesByProximity(holes);
            optimizedHoles.push(...sortedHoles);
        });
        
        this.holes = optimizedHoles.map(hole => ({
            x: hole.x,
            y: hole.y,
            diameter: hole.diameter,
            tool: hole.tool
        }));
        
        return optimizedHoles.length;
    }

    /**
     * Sort holes by proximity using nearest neighbor algorithm
     */
    sortHolesByProximity(holes) {
        if (holes.length === 0) return holes;
        
        const sorted = [holes[0]];
        const remaining = holes.slice(1);
        
        while (remaining.length > 0) {
            const current = sorted[sorted.length - 1];
            let nearestIndex = 0;
            let nearestDistance = this.calculateDistance(current, remaining[0]);
            
            for (let i = 1; i < remaining.length; i++) {
                const distance = this.calculateDistance(current, remaining[i]);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = i;
                }
            }
            
            sorted.push(remaining[nearestIndex]);
            remaining.splice(nearestIndex, 1);
        }
        
        return sorted;
    }

    /**
     * Calculate distance between two holes
     */
    calculateDistance(hole1, hole2) {
        const dx = hole1.x - hole2.x;
        const dy = hole1.y - hole2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

// Export for use in other modules
window.DrillParser = DrillParser;
