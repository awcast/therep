/**
 * Design Rule Check (DRC) system for PCB validation
 */

class DesignRules {
    constructor() {
        // Default design rules (in mm)
        this.rules = {
            minTraceWidth: 0.1,
            maxTraceWidth: 10.0,
            minViaSize: 0.2,
            maxViaSize: 5.0,
            minViaDrill: 0.1,
            maxViaDrill: 3.0,
            minClearance: 0.15,
            minViaClearance: 0.15,
            minPadClearance: 0.1,
            minHoleToHole: 0.2,
            minBoardEdgeClearance: 0.2,
            minTextSize: 0.5,
            maxTextSize: 10.0,
            minSilkWidth: 0.1,
            maxSilkWidth: 1.0,
            minAnnularRing: 0.05,
            minDrillSize: 0.1,
            maxDrillSize: 6.0,
            minCopperPourWidth: 0.2,
            maxAspectRatio: 10.0, // Via drill depth to diameter ratio
            minMaskMargin: 0.05,
            maxMaskMargin: 0.5
        };
        
        this.violations = [];
        this.enabled = true;
    }

    /**
     * Set design rule value
     */
    setRule(name, value) {
        if (this.rules.hasOwnProperty(name)) {
            this.rules[name] = value;
        } else {
            console.warn(`Unknown design rule: ${name}`);
        }
    }

    /**
     * Get design rule value
     */
    getRule(name) {
        return this.rules[name];
    }

    /**
     * Get all design rules
     */
    getAllRules() {
        return { ...this.rules };
    }

    /**
     * Load design rules from preset
     */
    loadPreset(preset) {
        const presets = {
            'conservative': {
                minTraceWidth: 0.2,
                minClearance: 0.2,
                minViaSize: 0.6,
                minViaDrill: 0.3,
                minViaClearance: 0.2,
                minPadClearance: 0.15,
                minHoleToHole: 0.3,
                minBoardEdgeClearance: 0.5,
                minAnnularRing: 0.1
            },
            'standard': {
                minTraceWidth: 0.15,
                minClearance: 0.15,
                minViaSize: 0.4,
                minViaDrill: 0.2,
                minViaClearance: 0.15,
                minPadClearance: 0.1,
                minHoleToHole: 0.2,
                minBoardEdgeClearance: 0.3,
                minAnnularRing: 0.05
            },
            'aggressive': {
                minTraceWidth: 0.1,
                minClearance: 0.1,
                minViaSize: 0.3,
                minViaDrill: 0.15,
                minViaClearance: 0.1,
                minPadClearance: 0.08,
                minHoleToHole: 0.15,
                minBoardEdgeClearance: 0.2,
                minAnnularRing: 0.04
            }
        };

        if (presets[preset]) {
            Object.assign(this.rules, presets[preset]);
        } else {
            console.warn(`Unknown preset: ${preset}`);
        }
    }

    /**
     * Run design rule check on PCB objects
     */
    runDRC(objects) {
        if (!this.enabled) return [];

        this.violations = [];
        
        // Check individual objects
        objects.forEach(obj => {
            this.checkObject(obj);
        });
        
        // Check interactions between objects
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                this.checkObjectInteraction(objects[i], objects[j]);
            }
        }
        
        return this.violations;
    }

    /**
     * Check individual object rules
     */
    checkObject(obj) {
        switch (obj.type) {
            case 'trace':
                this.checkTrace(obj);
                break;
            case 'via':
                this.checkVia(obj);
                break;
            case 'pad':
                this.checkPad(obj);
                break;
            case 'component':
                this.checkComponent(obj);
                break;
        }
    }

    /**
     * Check trace design rules
     */
    checkTrace(trace) {
        // Check trace width
        if (trace.width < this.rules.minTraceWidth) {
            this.addViolation({
                type: 'MIN_TRACE_WIDTH',
                severity: 'error',
                object: trace,
                message: `Trace width ${trace.width.toFixed(3)}mm is below minimum ${this.rules.minTraceWidth}mm`,
                position: trace.position
            });
        }
        
        if (trace.width > this.rules.maxTraceWidth) {
            this.addViolation({
                type: 'MAX_TRACE_WIDTH',
                severity: 'warning',
                object: trace,
                message: `Trace width ${trace.width.toFixed(3)}mm exceeds maximum ${this.rules.maxTraceWidth}mm`,
                position: trace.position
            });
        }
        
        // Check minimum trace length
        const length = trace.getLength();
        if (length < 0.01) {
            this.addViolation({
                type: 'MIN_TRACE_LENGTH',
                severity: 'warning',
                object: trace,
                message: `Trace length ${length.toFixed(3)}mm is very short`,
                position: trace.position
            });
        }
    }

    /**
     * Check via design rules
     */
    checkVia(via) {
        // Check via size
        if (via.outerDiameter < this.rules.minViaSize) {
            this.addViolation({
                type: 'MIN_VIA_SIZE',
                severity: 'error',
                object: via,
                message: `Via size ${via.outerDiameter.toFixed(3)}mm is below minimum ${this.rules.minViaSize}mm`,
                position: via.position
            });
        }
        
        if (via.outerDiameter > this.rules.maxViaSize) {
            this.addViolation({
                type: 'MAX_VIA_SIZE',
                severity: 'warning',
                object: via,
                message: `Via size ${via.outerDiameter.toFixed(3)}mm exceeds maximum ${this.rules.maxViaSize}mm`,
                position: via.position
            });
        }
        
        // Check drill size
        if (via.drillDiameter < this.rules.minViaDrill) {
            this.addViolation({
                type: 'MIN_VIA_DRILL',
                severity: 'error',
                object: via,
                message: `Via drill ${via.drillDiameter.toFixed(3)}mm is below minimum ${this.rules.minViaDrill}mm`,
                position: via.position
            });
        }
        
        // Check annular ring
        const annularRing = (via.outerDiameter - via.drillDiameter) / 2;
        if (annularRing < this.rules.minAnnularRing) {
            this.addViolation({
                type: 'MIN_ANNULAR_RING',
                severity: 'error',
                object: via,
                message: `Via annular ring ${annularRing.toFixed(3)}mm is below minimum ${this.rules.minAnnularRing}mm`,
                position: via.position
            });
        }
    }

    /**
     * Check pad design rules
     */
    checkPad(pad) {
        // Check drill size for through-hole pads
        const drill = pad.getProperty('drill');
        if (drill && drill > 0) {
            if (drill < this.rules.minDrillSize) {
                this.addViolation({
                    type: 'MIN_DRILL_SIZE',
                    severity: 'error',
                    object: pad,
                    message: `Pad drill ${drill.toFixed(3)}mm is below minimum ${this.rules.minDrillSize}mm`,
                    position: pad.position
                });
            }
            
            // Check annular ring for through-hole pads
            let padSize;
            if (typeof pad.size === 'object') {
                padSize = Math.min(pad.size.width, pad.size.height);
            } else {
                padSize = pad.size;
            }
            
            const annularRing = (padSize - drill) / 2;
            if (annularRing < this.rules.minAnnularRing) {
                this.addViolation({
                    type: 'MIN_ANNULAR_RING',
                    severity: 'error',
                    object: pad,
                    message: `Pad annular ring ${annularRing.toFixed(3)}mm is below minimum ${this.rules.minAnnularRing}mm`,
                    position: pad.position
                });
            }
        }
    }

    /**
     * Check component design rules
     */
    checkComponent(component) {
        // Check component placement near board edge
        // This would require board outline information
        
        // Check component orientation (could add rules for specific orientations)
        
        // Check component clearance from other components
        // This is handled in checkObjectInteraction
    }

    /**
     * Check interactions between objects
     */
    checkObjectInteraction(obj1, obj2) {
        // Skip if objects are on different layers and not interacting
        if (!this.objectsInteract(obj1, obj2)) {
            return;
        }
        
        // Check clearance violations
        this.checkClearance(obj1, obj2);
        
        // Check electrical connectivity
        this.checkElectricalRules(obj1, obj2);
    }

    /**
     * Check if two objects interact (same layer or through layers)
     */
    objectsInteract(obj1, obj2) {
        // Objects on same layer always interact
        if (obj1.layer === obj2.layer) return true;
        
        // Through-hole objects interact across layers
        if (obj1.type === 'via' || obj2.type === 'via') return true;
        if ((obj1.type === 'pad' && obj1.getProperty('drill') > 0) ||
            (obj2.type === 'pad' && obj2.getProperty('drill') > 0)) return true;
        
        return false;
    }

    /**
     * Check clearance between objects
     */
    checkClearance(obj1, obj2) {
        const distance = this.getObjectDistance(obj1, obj2);
        let requiredClearance = this.rules.minClearance;
        
        // Use specific clearance rules
        if (obj1.type === 'via' || obj2.type === 'via') {
            requiredClearance = this.rules.minViaClearance;
        } else if (obj1.type === 'pad' || obj2.type === 'pad') {
            requiredClearance = this.rules.minPadClearance;
        }
        
        // Check if objects are connected (same net)
        const net1 = obj1.getNet ? obj1.getNet() : null;
        const net2 = obj2.getNet ? obj2.getNet() : null;
        
        if (net1 && net2 && net1 === net2) {
            // Objects on same net don't need clearance (they can touch)
            return;
        }
        
        if (distance < requiredClearance) {
            this.addViolation({
                type: 'CLEARANCE_VIOLATION',
                severity: 'error',
                object: obj1,
                object2: obj2,
                message: `Clearance ${distance.toFixed(3)}mm is below minimum ${requiredClearance.toFixed(3)}mm`,
                position: obj1.position,
                distance: distance,
                requiredDistance: requiredClearance
            });
        }
    }

    /**
     * Check electrical rules
     */
    checkElectricalRules(obj1, obj2) {
        // Check for unconnected nets that should be connected
        // Check for shorted nets
        // This would require netlist information
    }

    /**
     * Get distance between two objects
     */
    getObjectDistance(obj1, obj2) {
        // Simple distance between centers for now
        // Real implementation would calculate edge-to-edge distance
        return obj1.position.distance(obj2.position);
    }

    /**
     * Add violation to list
     */
    addViolation(violation) {
        violation.id = MathUtils.generateUUID();
        violation.timestamp = Date.now();
        this.violations.push(violation);
    }

    /**
     * Get violations by severity
     */
    getViolationsBySeverity(severity) {
        return this.violations.filter(v => v.severity === severity);
    }

    /**
     * Get violations by type
     */
    getViolationsByType(type) {
        return this.violations.filter(v => v.type === type);
    }

    /**
     * Clear all violations
     */
    clearViolations() {
        this.violations = [];
    }

    /**
     * Enable/disable DRC
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Export design rules to JSON
     */
    exportRules() {
        return {
            rules: this.rules,
            timestamp: Date.now()
        };
    }

    /**
     * Import design rules from JSON
     */
    importRules(data) {
        if (data.rules) {
            Object.assign(this.rules, data.rules);
        }
    }
}

// Export for use in other modules
window.DesignRules = DesignRules;
