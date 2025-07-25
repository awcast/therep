/**
 * Design Rule Checker (DRC) tool for PCB design
 */

class DrcTool {
    constructor(pcbEditor) {
        this.pcbEditor = pcbEditor;
        this.errors = [];
        this.isActive = false;
    }

    /**
     * Activate DRC tool
     */
    activate() {
        this.isActive = true;
        // In a real app, you'd highlight a UI button.
        this.runChecks();
    }

    /**
     * Deactivate DRC tool
     */
    deactivate() {
        this.isActive = false;
        this.clearErrors();
        this.pcbEditor.render();
    }

    /**
     * Run DRC checks
     */
    runChecks() {
        this.clearErrors();
        const designRules = this.pcbEditor.designRules;
        const objects = this.pcbEditor.objects;

        if (!designRules) {
            console.error("Design rules not set in pcbEditor.");
            return [];
        }

        // Run all checks
        this.checkPadToPadClearance(objects, designRules.padToPad || 0.2);
        this.checkMinTraceWidth(objects, designRules.minTraceWidth || 0.15);
        this.checkTraceToPadClearance(objects, designRules.traceToPad || 0.2);

        console.log(`DRC complete. Found ${this.errors.length} errors.`);
        this.pcbEditor.render(); // Re-render to show errors
        return this.errors;
    }

    /**
     * Clear all DRC errors
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Render DRC errors on the canvas
     */
    render(ctx, viewport) {
        if (!this.isActive || this.errors.length === 0) return;

        ctx.save();
        ctx.lineWidth = 0.2 / viewport.scale; // Maintain a consistent line width

        this.errors.forEach(error => {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            
            ctx.beginPath();
            ctx.arc(error.position.x, error.position.y, (error.size || 0.5), 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        });

        ctx.restore();
    }

    // --- Specific DRC Checks ---

    checkPadToPadClearance(objects, minClearance) {
        const pads = objects.filter(o => o instanceof Pad);
        for (let i = 0; i < pads.length; i++) {
            for (let j = i + 1; j < pads.length; j++) {
                const pad1 = pads[i];
                const pad2 = pads[j];
                const distance = pad1.position.distance(pad2.position) - (pad1.radius + pad2.radius);
                
                if (distance < minClearance) {
                    this.errors.push({
                        type: 'Pad-Pad Clearance',
                        message: `Pad clearance violation. Required: ${minClearance}mm, Actual: ${distance.toFixed(3)}mm`,
                        position: pad1.position.clone().add(pad2.position).scale(0.5),
                        objects: [pad1, pad2]
                    });
                }
            }
        }
    }

    checkMinTraceWidth(objects, minWidth) {
        const traces = objects.filter(o => o instanceof Trace);
        traces.forEach(trace => {
            if (trace.width < minWidth) {
                this.errors.push({
                    type: 'Min Trace Width',
                    message: `Trace is too thin. Required: ${minWidth}mm, Actual: ${trace.width}mm`,
                    position: trace.start.clone().add(trace.end).scale(0.5),
                    objects: [trace]
                });
            }
        });
    }

    checkTraceToPadClearance(objects, minClearance) {
        const traces = objects.filter(o => o instanceof Trace);
        const pads = objects.filter(o => o instanceof Pad);

        traces.forEach(trace => {
            pads.forEach(pad => {
                const dist = MathUtils.pointToLineDistance(pad.position, trace.start, trace.end) - pad.radius;
                if (dist < minClearance) {
                    this.errors.push({
                        type: 'Trace-Pad Clearance',
                        message: `Trace to pad clearance violation. Required: ${minClearance}mm, Actual: ${dist.toFixed(3)}mm`,
                        position: pad.position,
                        size: pad.radius + minClearance,
                        objects: [trace, pad]
                    });
                }
            });
        });
    }
}

// Export for use in other modules
window.DrcTool = DrcTool;
