/**
 * Schematic file parser for electronic schematics
 * Supports KiCad schematic format (.sch)
 */

class SchematicParser {
    constructor() {
        this.components = [];
        this.wires = [];
        this.junctions = [];
        this.labels = [];
        this.sheets = [];
        this.libraries = [];
        this.version = '';
        this.title = '';
        this.currentComponent = null;
    }

    /**
     * Parse schematic file content
     */
    parse(content) {
        this.components = [];
        this.wires = [];
        this.junctions = [];
        this.labels = [];
        this.sheets = [];
        
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            try {
                this.parseLine(line, lines, i);
            } catch (error) {
                console.warn(`Error parsing schematic line ${i + 1}: ${line}`, error);
            }
        }
        
        return {
            components: this.components,
            wires: this.wires,
            junctions: this.junctions,
            labels: this.labels,
            sheets: this.sheets,
            libraries: this.libraries,
            version: this.version,
            title: this.title
        };
    }

    /**
     * Parse a single schematic line
     */
    parseLine(line, allLines, index) {
        // Skip empty lines and comments
        if (!line || line.startsWith('#')) return;
        
        // Version information
        if (line.startsWith('EESchema Schematic File Version')) {
            this.version = line.split(' ').pop();
            return;
        }
        
        // Library definitions
        if (line.startsWith('LIBS:')) {
            this.libraries.push(line.substring(5));
            return;
        }
        
        // Sheet information
        if (line.startsWith('Sheet ')) {
            this.parseSheet(line);
            return;
        }
        
        // Component definition
        if (line.startsWith('$Comp')) {
            this.parseComponent(allLines, index);
            return;
        }
        
        // Wire definition
        if (line.startsWith('Wire Wire Line')) {
            this.parseWire(allLines, index);
            return;
        }
        
        // Junction definition
        if (line.startsWith('Connection ~ ')) {
            this.parseJunction(line);
            return;
        }
        
        // Label definition
        if (line.startsWith('Text Label ')) {
            this.parseLabel(line);
            return;
        }
        
        // Title block
        if (line.startsWith('Title ')) {
            this.title = line.substring(6).replace(/"/g, '');
            return;
        }
    }

    /**
     * Parse sheet information
     */
    parseSheet(line) {
        // Sheet 1 1 "Main" "/path/to/sheet"
        const parts = line.split(' ');
        if (parts.length >= 4) {
            this.sheets.push({
                number: parseInt(parts[1]),
                total: parseInt(parts[2]),
                name: parts[3].replace(/"/g, ''),
                path: parts[4] ? parts[4].replace(/"/g, '') : ''
            });
        }
    }

    /**
     * Parse component definition
     */
    parseComponent(lines, startIndex) {
        const component = {
            id: '',
            reference: '',
            value: '',
            footprint: '',
            position: { x: 0, y: 0 },
            rotation: 0,
            fields: [],
            pins: []
        };
        
        let i = startIndex + 1;
        while (i < lines.length && !lines[i].startsWith('$EndComp')) {
            const line = lines[i].trim();
            
            if (line.startsWith('L ')) {
                // Library reference: L Device:R R1
                const parts = line.split(' ');
                if (parts.length >= 3) {
                    component.id = parts[1];
                    component.reference = parts[2];
                }
            }
            else if (line.startsWith('P ')) {
                // Position: P 1000 2000
                const coords = line.split(' ');
                if (coords.length >= 3) {
                    component.position.x = parseInt(coords[1]) / 100; // Convert to mm
                    component.position.y = parseInt(coords[2]) / 100;
                }
            }
            else if (line.startsWith('F ')) {
                // Field: F 0 "R1" H 1000 2000 50 0000 C CNN
                this.parseComponentField(line, component);
            }
            
            i++;
        }
        
        this.components.push(component);
    }

    /**
     * Parse component field
     */
    parseComponentField(line, component) {
        const parts = line.split(' ');
        if (parts.length < 4) return;
        
        const fieldNum = parseInt(parts[1]);
        const value = parts[2].replace(/"/g, '');
        
        const field = {
            number: fieldNum,
            value: value,
            visible: true
        };
        
        // Standard fields
        switch (fieldNum) {
            case 0:
                component.reference = value;
                break;
            case 1:
                component.value = value;
                break;
            case 2:
                component.footprint = value;
                break;
            default:
                component.fields.push(field);
                break;
        }
    }

    /**
     * Parse wire definition
     */
    parseWire(lines, startIndex) {
        let i = startIndex + 1;
        
        while (i < lines.length) {
            const line = lines[i].trim();
            
            if (line.includes(' ')) {
                // Wire coordinates: x1 y1 x2 y2
                const coords = line.split(' ').map(c => parseInt(c));
                if (coords.length >= 4) {
                    this.wires.push({
                        x1: coords[0] / 100, // Convert to mm
                        y1: coords[1] / 100,
                        x2: coords[2] / 100,
                        y2: coords[3] / 100,
                        width: 0.15 // Default wire width
                    });
                }
                break;
            }
            
            i++;
        }
    }

    /**
     * Parse junction definition
     */
    parseJunction(line) {
        // Connection ~ 1000 2000
        const parts = line.split(' ');
        if (parts.length >= 4) {
            this.junctions.push({
                x: parseInt(parts[2]) / 100, // Convert to mm
                y: parseInt(parts[3]) / 100,
                diameter: 0.5 // Default junction size
            });
        }
    }

    /**
     * Parse label definition
     */
    parseLabel(line) {
        // Text Label 1000 2000 0 60 ~ 0 "SIGNAL_NAME"
        const parts = line.split(' ');
        if (parts.length >= 8) {
            this.labels.push({
                x: parseInt(parts[2]) / 100, // Convert to mm
                y: parseInt(parts[3]) / 100,
                rotation: parseInt(parts[4]),
                size: parseInt(parts[5]) / 100,
                text: parts[7].replace(/"/g, '')
            });
        }
    }

    /**
     * Convert parsed data to PCB objects (for integration)
     */
    toPCBObjects() {
        const objects = [];
        
        // Convert components to component objects
        this.components.forEach(comp => {
            // Create a basic component representation
            const component = new Component(
                new Point(comp.position.x, comp.position.y),
                comp.reference,
                comp.footprint || 'unknown',
                'schematic'
            );
            
            component.value = comp.value;
            component.schematicData = comp;
            objects.push(component);
        });
        
        // Convert wires to traces
        this.wires.forEach(wire => {
            objects.push(new Trace(
                new Point(wire.x1, wire.y1),
                new Point(wire.x2, wire.y2),
                wire.width,
                'schematic'
            ));
        });
        
        // Convert junctions to vias
        this.junctions.forEach(junction => {
            objects.push(new Via(
                new Point(junction.x, junction.y),
                junction.diameter,
                0, // No drill for schematic junctions
                'schematic'
            ));
        });
        
        return objects;
    }

    /**
     * Export schematic back to KiCad format
     */
    export() {
        let output = [];
        
        // Header
        output.push('EESchema Schematic File Version 4');
        output.push('EELAYER 30 0');
        output.push('EELAYER END');
        
        // Libraries
        this.libraries.forEach(lib => {
            output.push(`LIBS:${lib}`);
        });
        
        // Sheet information
        this.sheets.forEach(sheet => {
            output.push(`Sheet ${sheet.number} ${sheet.total} "${sheet.name}" "${sheet.path}"`);
        });
        
        // Title
        if (this.title) {
            output.push(`Title "${this.title}"`);
        }
        
        // Components
        this.components.forEach(comp => {
            output.push('$Comp');
            output.push(`L ${comp.id} ${comp.reference}`);
            output.push(`P ${Math.round(comp.position.x * 100)} ${Math.round(comp.position.y * 100)}`);
            
            // Fields
            output.push(`F 0 "${comp.reference}" H ${Math.round(comp.position.x * 100)} ${Math.round(comp.position.y * 100)} 50 0000 C CNN`);
            output.push(`F 1 "${comp.value}" H ${Math.round(comp.position.x * 100)} ${Math.round(comp.position.y * 100)} 50 0000 C CNN`);
            if (comp.footprint) {
                output.push(`F 2 "${comp.footprint}" H ${Math.round(comp.position.x * 100)} ${Math.round(comp.position.y * 100)} 50 0001 C CNN`);
            }
            
            comp.fields.forEach(field => {
                output.push(`F ${field.number} "${field.value}" H ${Math.round(comp.position.x * 100)} ${Math.round(comp.position.y * 100)} 50 0001 C CNN`);
            });
            
            output.push('$EndComp');
        });
        
        // Wires
        this.wires.forEach(wire => {
            output.push('Wire Wire Line');
            output.push(`\t${Math.round(wire.x1 * 100)} ${Math.round(wire.y1 * 100)} ${Math.round(wire.x2 * 100)} ${Math.round(wire.y2 * 100)}`);
        });
        
        // Junctions
        this.junctions.forEach(junction => {
            output.push(`Connection ~ ${Math.round(junction.x * 100)} ${Math.round(junction.y * 100)}`);
        });
        
        // Labels
        this.labels.forEach(label => {
            output.push(`Text Label ${Math.round(label.x * 100)} ${Math.round(label.y * 100)} ${label.rotation} ${Math.round(label.size * 100)} ~ 0 "${label.text}"`);
        });
        
        // Footer
        output.push('$EndSCHEMATC');
        
        return output.join('\n');
    }

    /**
     * Get schematic statistics
     */
    getStatistics() {
        const componentTypes = new Map();
        
        this.components.forEach(comp => {
            const type = comp.id.split(':')[1] || comp.id;
            const count = componentTypes.get(type) || 0;
            componentTypes.set(type, count + 1);
        });
        
        return {
            totalComponents: this.components.length,
            totalWires: this.wires.length,
            totalJunctions: this.junctions.length,
            totalLabels: this.labels.length,
            componentTypes: Array.from(componentTypes.entries()),
            sheets: this.sheets.length
        };
    }

    /**
     * Find components by reference or value
     */
    findComponents(searchTerm) {
        const term = searchTerm.toLowerCase();
        return this.components.filter(comp => 
            comp.reference.toLowerCase().includes(term) ||
            comp.value.toLowerCase().includes(term) ||
            comp.id.toLowerCase().includes(term)
        );
    }

    /**
     * Get netlist from schematic
     */
    generateNetlist() {
        const nets = new Map();
        let netId = 1;
        
        // Process wires to create nets
        this.wires.forEach(wire => {
            const netName = `Net-${netId++}`;
            nets.set(netName, [
                { x: wire.x1, y: wire.y1 },
                { x: wire.x2, y: wire.y2 }
            ]);
        });
        
        // Add junctions to nets
        this.junctions.forEach(junction => {
            // Find which net this junction belongs to
            for (const [netName, points] of nets.entries()) {
                for (const point of points) {
                    const distance = Math.sqrt(
                        Math.pow(point.x - junction.x, 2) + 
                        Math.pow(point.y - junction.y, 2)
                    );
                    if (distance < 0.1) { // Close enough to be on the same net
                        points.push({ x: junction.x, y: junction.y });
                        break;
                    }
                }
            }
        });
        
        return {
            nets: Array.from(nets.entries()),
            components: this.components.map(comp => ({
                reference: comp.reference,
                value: comp.value,
                footprint: comp.footprint,
                position: comp.position
            }))
        };
    }

}

// Export for use in other modules
window.SchematicParser = SchematicParser;
