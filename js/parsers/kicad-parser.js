/**
 * KiCad PCB Parser for .kicad_pcb files
 * 
 * This parser handles KiCad PCB files which use S-expression format
 */

class KiCadParser {
    constructor() {
        this.pcbData = null;
        this.tokens = [];
        this.position = 0;
    }

    /**
     * Parse a .kicad_pcb file from text content
     */
    async parseFile(textContent) {
        try {
            // Tokenize the S-expression
            this.tokens = this.tokenize(textContent);
            this.position = 0;
            
            // Parse the main PCB structure
            const pcbExpr = this.parseExpression();
            
            if (!pcbExpr || pcbExpr[0] !== 'kicad_pcb') {
                throw new Error('Invalid KiCad PCB file format');
            }
            
            // Convert to PCB editor format
            return this.convertToPCBData(pcbExpr);
            
        } catch (error) {
            console.error('Error parsing KiCad PCB file:', error);
            throw new Error(`Failed to parse KiCad PCB file: ${error.message}`);
        }
    }

    /**
     * Tokenize S-expression text
     */
    tokenize(text) {
        const tokens = [];
        let current = '';
        let inString = false;
        let i = 0;
        
        while (i < text.length) {
            const char = text[i];
            
            if (char === '"' && text[i-1] !== '\\') {
                inString = !inString;
                current += char;
            } else if (inString) {
                current += char;
            } else if (char === '(' || char === ')') {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }
                tokens.push(char);
            } else if (/\s/.test(char)) {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }
            } else {
                current += char;
            }
            i++;
        }
        
        if (current.trim()) {
            tokens.push(current.trim());
        }
        
        return tokens;
    }

    /**
     * Parse S-expression from tokens
     */
    parseExpression() {
        if (this.position >= this.tokens.length) {
            return null;
        }
        
        const token = this.tokens[this.position++];
        
        if (token === '(') {
            const expr = [];
            while (this.position < this.tokens.length && this.tokens[this.position] !== ')') {
                const subExpr = this.parseExpression();
                if (subExpr !== null) {
                    expr.push(subExpr);
                }
            }
            
            if (this.position < this.tokens.length && this.tokens[this.position] === ')') {
                this.position++;
            }
            
            return expr;
        } else if (token === ')') {
            return null;
        } else {
            // Parse number if possible
            const num = parseFloat(token);
            if (!isNaN(num) && isFinite(num)) {
                return num;
            }
            
            // Remove quotes from strings
            if (token.startsWith('"') && token.endsWith('"')) {
                return token.slice(1, -1);
            }
            
            return token;
        }
    }

    /**
     * Convert parsed KiCad data to PCB editor format
     */
    convertToPCBData(pcbExpr) {
        const pcbData = {
            version: '1.0',
            source: 'kicad-pcb',
            created: new Date().toISOString(),
            units: 'mm',
            origin: { x: 0, y: 0 },
            layers: [],
            objects: [],
            grid: {
                size: 1.27,
                visible: true
            },
            viewport: {
                zoom: 1.0,
                center: { x: 0, y: 0 }
            }
        };

        // Parse each top-level element
        for (let i = 1; i < pcbExpr.length; i++) {
            const element = pcbExpr[i];
            if (!Array.isArray(element)) continue;
            
            const elementType = element[0];
            
            switch (elementType) {
                case 'version':
                    pcbData.kicadVersion = element[1];
                    break;
                    
                case 'general':
                    this.parseGeneral(element, pcbData);
                    break;
                    
                case 'layers':
                    this.parseLayers(element, pcbData);
                    break;
                    
                case 'setup':
                    this.parseSetup(element, pcbData);
                    break;
                    
                case 'net':
                    // Handle nets if needed
                    break;
                    
                case 'footprint':
                case 'module':
                    const component = this.parseFootprint(element);
                    if (component) {
                        pcbData.objects.push(component);
                    }
                    break;
                    
                case 'segment':
                case 'track':
                    const trace = this.parseSegment(element);
                    if (trace) {
                        pcbData.objects.push(trace);
                    }
                    break;
                    
                case 'via':
                    const via = this.parseVia(element);
                    if (via) {
                        pcbData.objects.push(via);
                    }
                    break;
                    
                case 'gr_line':
                case 'gr_rect':
                case 'gr_circle':
                case 'gr_arc':
                    const graphic = this.parseGraphic(element);
                    if (graphic) {
                        pcbData.objects.push(graphic);
                    }
                    break;
            }
        }

        return pcbData;
    }

    /**
     * Parse general section
     */
    parseGeneral(generalExpr, pcbData) {
        for (let i = 1; i < generalExpr.length; i++) {
            const element = generalExpr[i];
            if (!Array.isArray(element)) continue;
            
            switch (element[0]) {
                case 'thickness':
                    pcbData.boardThickness = element[1];
                    break;
            }
        }
    }

    /**
     * Parse layers section
     */
    parseLayers(layersExpr, pcbData) {
        const layerMap = {
            'F.Cu': { name: 'top-copper', displayName: 'Top Copper', type: 'signal', color: '#CC0000' },
            'B.Cu': { name: 'bottom-copper', displayName: 'Bottom Copper', type: 'signal', color: '#0066CC' },
            'F.SilkS': { name: 'top-silk', displayName: 'Top Silkscreen', type: 'silkscreen', color: '#FFFFFF' },
            'B.SilkS': { name: 'bottom-silk', displayName: 'Bottom Silkscreen', type: 'silkscreen', color: '#FFFF00' },
            'F.Mask': { name: 'top-mask', displayName: 'Top Solder Mask', type: 'mask', color: '#008000' },
            'B.Mask': { name: 'bottom-mask', displayName: 'Bottom Solder Mask', type: 'mask', color: '#008000' },
            'Edge.Cuts': { name: 'edge-cuts', displayName: 'Board Outline', type: 'outline', color: '#FFFF00' }
        };

        for (let i = 1; i < layersExpr.length; i++) {
            const element = layersExpr[i];
            if (!Array.isArray(element)) continue;
            
            const layerNum = element[0];
            const layerName = element[1];
            const layerType = element[2];
            
            const mappedLayer = layerMap[layerName];
            if (mappedLayer) {
                pcbData.layers.push({
                    ...mappedLayer,
                    number: layerNum,
                    kicadName: layerName,
                    kicadType: layerType,
                    visible: true
                });
            }
        }
    }

    /**
     * Parse setup section
     */
    parseSetup(setupExpr, pcbData) {
        for (let i = 1; i < setupExpr.length; i++) {
            const element = setupExpr[i];
            if (!Array.isArray(element)) continue;
            
            switch (element[0]) {
                case 'grid':
                    if (element[1] && typeof element[1] === 'number') {
                        pcbData.grid.size = element[1];
                    }
                    break;
            }
        }
    }

    /**
     * Parse footprint/module
     */
    parseFootprint(footprintExpr) {
        const component = {
            type: 'component',
            id: this.generateId(),
            position: { x: 0, y: 0 },
            rotation: 0,
            layer: 'top-copper',
            designator: '',
            footprint: '',
            pads: []
        };

        // Get footprint name
        if (footprintExpr.length > 1 && typeof footprintExpr[1] === 'string') {
            component.footprint = footprintExpr[1];
        }

        for (let i = 2; i < footprintExpr.length; i++) {
            const element = footprintExpr[i];
            if (!Array.isArray(element)) continue;
            
            switch (element[0]) {
                case 'at':
                    component.position.x = element[1] || 0;
                    component.position.y = element[2] || 0;
                    if (element[3]) {
                        component.rotation = element[3];
                    }
                    break;
                    
                case 'layer':
                    component.layer = this.mapKiCadLayer(element[1]);
                    break;
                    
                case 'fp_text':
                    if (element[1] === 'reference' && element[2]) {
                        component.designator = element[2];
                    }
                    break;
            }
        }

        return component;
    }

    /**
     * Parse track/segment
     */
    parseSegment(segmentExpr) {
        const trace = {
            type: 'trace',
            id: this.generateId(),
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 0, y: 0 },
            width: 0.2,
            layer: 'top-copper',
            net: null
        };

        for (let i = 1; i < segmentExpr.length; i++) {
            const element = segmentExpr[i];
            if (!Array.isArray(element)) continue;
            
            switch (element[0]) {
                case 'start':
                    trace.startPoint.x = element[1] || 0;
                    trace.startPoint.y = element[2] || 0;
                    break;
                    
                case 'end':
                    trace.endPoint.x = element[1] || 0;
                    trace.endPoint.y = element[2] || 0;
                    break;
                    
                case 'width':
                    trace.width = element[1] || 0.2;
                    break;
                    
                case 'layer':
                    trace.layer = this.mapKiCadLayer(element[1]);
                    break;
                    
                case 'net':
                    trace.net = element[1];
                    break;
            }
        }

        return trace;
    }

    /**
     * Parse via
     */
    parseVia(viaExpr) {
        const via = {
            type: 'via',
            id: this.generateId(),
            position: { x: 0, y: 0 },
            outerDiameter: 0.6,
            drillDiameter: 0.3,
            layer: 'drill',
            net: null
        };

        for (let i = 1; i < viaExpr.length; i++) {
            const element = viaExpr[i];
            if (!Array.isArray(element)) continue;
            
            switch (element[0]) {
                case 'at':
                    via.position.x = element[1] || 0;
                    via.position.y = element[2] || 0;
                    break;
                    
                case 'size':
                    via.outerDiameter = element[1] || 0.6;
                    break;
                    
                case 'drill':
                    via.drillDiameter = element[1] || 0.3;
                    break;
                    
                case 'net':
                    via.net = element[1];
                    break;
            }
        }

        return via;
    }

    /**
     * Parse graphic elements (lines, rectangles, etc.)
     */
    parseGraphic(graphicExpr) {
        const graphic = {
            type: 'graphic',
            id: this.generateId(),
            layer: 'edge-cuts',
            graphicType: graphicExpr[0]
        };

        for (let i = 1; i < graphicExpr.length; i++) {
            const element = graphicExpr[i];
            if (!Array.isArray(element)) continue;
            
            switch (element[0]) {
                case 'start':
                    graphic.startPoint = { x: element[1] || 0, y: element[2] || 0 };
                    break;
                    
                case 'end':
                    graphic.endPoint = { x: element[1] || 0, y: element[2] || 0 };
                    break;
                    
                case 'center':
                    graphic.center = { x: element[1] || 0, y: element[2] || 0 };
                    break;
                    
                case 'width':
                    graphic.width = element[1] || 0.1;
                    break;
                    
                case 'layer':
                    graphic.layer = this.mapKiCadLayer(element[1]);
                    break;
            }
        }

        return graphic;
    }

    /**
     * Map KiCad layer names to editor layer names
     */
    mapKiCadLayer(kicadLayer) {
        const layerMap = {
            'F.Cu': 'top-copper',
            'B.Cu': 'bottom-copper',
            'F.SilkS': 'top-silk',
            'B.SilkS': 'bottom-silk',
            'F.Mask': 'top-mask',
            'B.Mask': 'bottom-mask',
            'Edge.Cuts': 'edge-cuts'
        };

        return layerMap[kicadLayer] || 'top-copper';
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return 'kicad_' + Math.random().toString(36).substr(2, 9);
    }
}

/**
 * Simplified KiCad Parser for demonstration
 * This creates sample PCB data that represents what would be extracted
 * from a real KiCad .kicad_pcb file
 */
class SimplifiedKiCadParser {
    constructor() {
        this.sampleData = null;
    }

    /**
     * Parse file and return sample KiCad PCB data
     */
    async parseFile(textContent) {
        // Create sample PCB data that represents a typical KiCad PCB layout
        return {
            version: '1.0',
            source: 'kicad-pcb',
            created: new Date().toISOString(),
            filename: 'sample.kicad_pcb',
            units: 'mm',
            origin: { x: 0, y: 0 },
            boardOutline: {
                width: 80,
                height: 60,
                thickness: 1.6
            },
            layers: [
                { name: 'top-copper', displayName: 'F.Cu', type: 'signal', color: '#CC0000', visible: true },
                { name: 'bottom-copper', displayName: 'B.Cu', type: 'signal', color: '#0066CC', visible: true },
                { name: 'top-silk', displayName: 'F.SilkS', type: 'silkscreen', color: '#FFFFFF', visible: true },
                { name: 'bottom-silk', displayName: 'B.SilkS', type: 'silkscreen', color: '#FFFF00', visible: true },
                { name: 'edge-cuts', displayName: 'Edge.Cuts', type: 'outline', color: '#FFFF00', visible: true }
            ],
            objects: this.generateSampleKiCadObjects(),
            grid: {
                size: 1.27,
                visible: true
            },
            viewport: {
                zoom: 1.0,
                center: { x: 0, y: 0 }
            }
        };
    }

    /**
     * Generate sample KiCad PCB objects
     */
    generateSampleKiCadObjects() {
        const objects = [];

        // Add sample traces representing typical KiCad routing
        const traces = [
            // Power distribution
            { start: { x: -30, y: -20 }, end: { x: 30, y: -20 }, width: 0.4, layer: 'top-copper', net: 'VCC' },
            { start: { x: -30, y: -15 }, end: { x: 30, y: -15 }, width: 0.4, layer: 'top-copper', net: 'GND' },
            
            // Signal traces
            { start: { x: -25, y: -10 }, end: { x: 25, y: -10 }, width: 0.15, layer: 'top-copper', net: 'SDA' },
            { start: { x: -25, y: -5 }, end: { x: 25, y: -5 }, width: 0.15, layer: 'top-copper', net: 'SCL' },
            { start: { x: -25, y: 0 }, end: { x: 25, y: 0 }, width: 0.15, layer: 'top-copper', net: 'MOSI' },
            { start: { x: -25, y: 5 }, end: { x: 25, y: 5 }, width: 0.15, layer: 'top-copper', net: 'MISO' },
            { start: { x: -25, y: 10 }, end: { x: 25, y: 10 }, width: 0.15, layer: 'top-copper', net: 'SCK' },
            
            // Layer transitions
            { start: { x: -15, y: -20 }, end: { x: -15, y: 15 }, width: 0.2, layer: 'top-copper', net: 'VCC' },
            { start: { x: 0, y: -15 }, end: { x: 0, y: 20 }, width: 0.2, layer: 'bottom-copper', net: 'GND' },
            { start: { x: 15, y: -10 }, end: { x: 15, y: 10 }, width: 0.15, layer: 'bottom-copper', net: 'SDA' }
        ];

        traces.forEach((trace, index) => {
            objects.push({
                type: 'trace',
                id: `kicad_trace_${index}`,
                startPoint: trace.start,
                endPoint: trace.end,
                width: trace.width,
                layer: trace.layer,
                net: trace.net
            });
        });

        // Add sample vias
        const vias = [
            { pos: { x: -15, y: -20 }, outer: 0.6, drill: 0.3, net: 'VCC' },
            { pos: { x: 0, y: -15 }, outer: 0.6, drill: 0.3, net: 'GND' },
            { pos: { x: 15, y: -10 }, outer: 0.5, drill: 0.25, net: 'SDA' },
            { pos: { x: -10, y: 5 }, outer: 0.5, drill: 0.25, net: 'MOSI' },
            { pos: { x: 10, y: 10 }, outer: 0.5, drill: 0.25, net: 'SCK' }
        ];

        vias.forEach((via, index) => {
            objects.push({
                type: 'via',
                id: `kicad_via_${index}`,
                position: via.pos,
                outerDiameter: via.outer,
                drillDiameter: via.drill,
                layer: 'drill',
                net: via.net
            });
        });

        // Add sample components (KiCad style)
        const components = [
            { 
                pos: { x: -20, y: -25 }, 
                size: { width: 8, height: 6 }, 
                designator: 'U1', 
                footprint: 'QFN-32',
                description: 'Microcontroller'
            },
            { 
                pos: { x: 20, y: -25 }, 
                size: { width: 4, height: 3 }, 
                designator: 'U2', 
                footprint: 'SOT-23',
                description: 'Voltage Regulator'
            },
            { 
                pos: { x: -25, y: 15 }, 
                size: { width: 3, height: 2 }, 
                designator: 'C1', 
                footprint: '0805',
                description: 'Capacitor'
            },
            { 
                pos: { x: 25, y: 15 }, 
                size: { width: 3, height: 2 }, 
                designator: 'R1', 
                footprint: '0805',
                description: 'Resistor'
            }
        ];

        components.forEach((comp, index) => {
            objects.push({
                type: 'component',
                id: `kicad_comp_${index}`,
                position: comp.pos,
                size: comp.size,
                rotation: 0,
                layer: 'top-copper',
                designator: comp.designator,
                footprint: comp.footprint,
                description: comp.description
            });
        });

        return objects;
    }
}

// Export parsers
window.KiCadParser = KiCadParser;
window.SimplifiedKiCadParser = SimplifiedKiCadParser;
