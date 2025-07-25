/**
 * Main PCB Editor class
 */

class PCBEditor {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id '${canvasId}' not found`);
        }

        // Initialize core systems
        this.viewport = new Viewport(this.canvas);
        this.renderer = new Renderer(this.canvas, this.viewport);
        this.grid = new Grid(1.27, true); // 1.27mm grid (50 mil)
        
        // Initialize new feature systems
        this.designRules = new DesignRules();
        this.measurementTool = new MeasurementTool(this);
        this.bomGenerator = new BOMGenerator(this);
        this.gerberExporter = new GerberExporter(this);
        this.drcTool = new DrcTool(this);
        this.fileManager = new FileManager(this);
        this.polygonTool = new PolygonTool(this);
        this.plandex = new PlandexIntegration(this);
        
        // Scene data
        this.objects = [];
        this.selectedObjects = [];
        this.hoveredObject = null;
        this.measurements = [];
        this.drcViolations = [];
        
        // Editor state
        this.currentTool = 'select';
        this.currentLayer = 'top-copper';
        this.snapToGrid = true;
        this.showDebug = false;
        this.showMeasurements = true;
        this.showDRCViolations = true;
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Mouse state
        this.mousePosition = new Point(0, 0);
        this.mouseWorldPosition = new Point(0, 0);
        this.isMouseDown = false;
        this.dragStartPosition = null;
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Initial render
        this.render();
        
        // Update UI
        this.updateUI();
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                if (tool) this.setTool(tool);
            });
        });
        
        // Layer selection
        document.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const layer = e.currentTarget.dataset.layer;
                if (layer) this.setCurrentLayer(layer);
            });
            
            // Layer visibility toggle
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    const layer = item.dataset.layer;
                    this.renderer.setLayerVisible(layer, e.target.checked);
                    this.render();
                });
            }
        });
        
        // Component library
        document.querySelectorAll('.component-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const component = e.currentTarget.dataset.component;
                if (component) {
                    this.setTool('component');
                    // Set selected component type
                }
            });
        });
        
        // Viewport events
        this.viewport.canvas.addEventListener('wheel', () => {
            this.updateUI();
            this.render();
        });
    }

    /**
     * Mouse down handler
     */
    onMouseDown(e) {
        this.updateMousePosition(e);
        this.isMouseDown = true;
        this.dragStartPosition = this.mouseWorldPosition.clone();
        
        // Handle tool-specific mouse down
        switch (this.currentTool) {
            case 'select':
                this.handleSelectMouseDown(e);
                break;
            case 'trace':
                this.handleTraceMouseDown(e);
                break;
            case 'via':
                this.handleViaMouseDown(e);
                break;
            case 'component':
                this.handleComponentMouseDown(e);
                break;
            case 'polygon':
                this.polygonTool.onMouseDown(e);
                break;
        }
    }

    /**
     * Mouse move handler
     */
    onMouseMove(e) {
        this.updateMousePosition(e);
        
        // Update hover
        this.updateHover();
        
        // Handle tool-specific mouse move
        switch (this.currentTool) {
            case 'select':
                this.handleSelectMouseMove(e);
                break;
            case 'trace':
                this.handleTraceMouseMove(e);
                break;
            case 'polygon':
                this.polygonTool.onMouseMove(e);
                break;
        }
        
        this.render();
    }

    /**
     * Mouse up handler
     */
    onMouseUp(e) {
        this.updateMousePosition(e);
        this.isMouseDown = false;
        this.dragStartPosition = null;
        
        // Handle tool-specific mouse up
        switch (this.currentTool) {
            case 'select':
                this.handleSelectMouseUp(e);
                break;
            case 'trace':
                this.handleTraceMouseUp(e);
                break;
        }
    }

    /**
     * Click handler
     */
    onClick(e) {
        this.updateMousePosition(e);
        // Click handling is done in tool-specific mouse handlers
    }

    /**
     * Double click handler
     */
    onDoubleClick(e) {
        this.updateMousePosition(e);
        
        // Edit properties of clicked object
        const clickedObject = this.getObjectAtPoint(this.mouseWorldPosition);
        if (clickedObject) {
            this.editObjectProperties(clickedObject);
        }
    }

    /**
     * Key down handler
     */
    onKeyDown(e) {
        // Handle keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'a':
                    e.preventDefault();
                    this.selectAll();
                    break;
                case 'c':
                    e.preventDefault();
                    this.copy();
                    break;
                case 'v':
                    e.preventDefault();
                    this.paste();
                    break;
            }
        } else {
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    this.deleteSelected();
                    break;
                case 'Escape':
                    this.clearSelection();
                    this.setTool('select');
                    break;
                case 'g':
                    this.grid.toggleVisible();
                    this.render();
                    break;
            }
        }
    }

    /**
     * Key up handler
     */
    onKeyUp(e) {
        // Handle key releases if needed
    }

    /**
     * Update mouse position
     */
    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePosition = new Point(e.clientX - rect.left, e.clientY - rect.top);
        this.mouseWorldPosition = this.viewport.screenToWorld(this.mousePosition);
        
        if (this.snapToGrid) {
            this.mouseWorldPosition = this.grid.snapPoint(this.mouseWorldPosition);
        }
        
        // Update coordinate display
        this.updateCoordinateDisplay();
    }

    /**
     * Update coordinate display
     */
    updateCoordinateDisplay() {
        const coordX = document.getElementById('coord-x');
        const coordY = document.getElementById('coord-y');
        
        if (coordX) coordX.textContent = this.mouseWorldPosition.x.toFixed(2);
        if (coordY) coordY.textContent = this.mouseWorldPosition.y.toFixed(2);
    }

    /**
     * Update hover state
     */
    updateHover() {
        const newHovered = this.getObjectAtPoint(this.mouseWorldPosition);
        if (newHovered !== this.hoveredObject) {
            this.hoveredObject = newHovered;
        }
    }

    /**
     * Get object at point
     */
    getObjectAtPoint(point) {
        // Check objects in reverse order (top to bottom)
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (obj.isVisible() && obj.containsPoint(point)) {
                return obj;
            }
        }
        return null;
    }

    /**
     * Set current tool
     */
    setTool(tool) {
        // Deactivate previous tool
        if (this.currentTool === 'measure') {
            this.measurementTool.deactivate();
        } else if (this.currentTool === 'drc') {
            this.drcTool.deactivate();
        } else if (this.currentTool === 'polygon') {
            this.polygonTool.deactivate();
        }

        this.currentTool = tool;
        
        // Activate new tool
        if (tool === 'measure') {
            this.measurementTool.activate();
        } else if (tool === 'drc') {
            this.drcTool.activate();
        } else if (tool === 'polygon') {
            this.polygonTool.activate();
        }

        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        // Clear selection when switching tools
        if (tool !== 'select') {
            this.clearSelection();
        }
    }

    /**
     * Set current layer
     */
    setCurrentLayer(layer) {
        this.currentLayer = layer;
        
        // Update UI
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.toggle('active', item.dataset.layer === layer);
        });
        
        // Update status bar
        const statusLayer = document.querySelector('.status-right span:last-child');
        if (statusLayer) {
            statusLayer.textContent = `Layer: ${layer}`;
        }
    }

    /**
     * Add object to scene
     */
    addObject(obj) {
        this.objects.push(obj);
        this.saveState();
        this.render();
    }

    /**
     * Remove object from scene
     */
    removeObject(obj) {
        const index = this.objects.indexOf(obj);
        if (index !== -1) {
            this.objects.splice(index, 1);
            this.selectedObjects = this.selectedObjects.filter(selected => selected !== obj);
            this.saveState();
            this.render();
        }
    }

    /**
     * Select object
     */
    selectObject(obj, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }
        
        if (obj && !this.selectedObjects.includes(obj)) {
            obj.setSelected(true);
            this.selectedObjects.push(obj);
        }
        
        this.updatePropertiesPanel();
        this.render();
    }

    /**
     * Deselect object
     */
    deselectObject(obj) {
        const index = this.selectedObjects.indexOf(obj);
        if (index !== -1) {
            obj.setSelected(false);
            this.selectedObjects.splice(index, 1);
        }
        
        this.updatePropertiesPanel();
        this.render();
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedObjects.forEach(obj => obj.setSelected(false));
        this.selectedObjects = [];
        this.updatePropertiesPanel();
        this.render();
    }

    /**
     * Select all objects
     */
    selectAll() {
        this.clearSelection();
        this.objects.forEach(obj => {
            if (obj.isVisible()) {
                this.selectObject(obj, true);
            }
        });
    }

    /**
     * Delete selected objects
     */
    deleteSelected() {
        if (this.selectedObjects.length === 0) return;
        
        this.selectedObjects.forEach(obj => {
            if (obj.canDelete()) {
                this.removeObject(obj);
            }
        });
        
        this.clearSelection();
    }

    /**
     * Copy selected objects
     */
    copy() {
        if (this.selectedObjects.length === 0) return;
        
        this.clipboard = this.selectedObjects.map(obj => obj.clone());
    }

    /**
     * Paste objects
     */
    paste() {
        if (!this.clipboard || this.clipboard.length === 0) return;
        
        this.clearSelection();
        
        const offset = new Point(2.54, 2.54); // 2.54mm offset
        this.clipboard.forEach(obj => {
            const cloned = obj.clone();
            cloned.move(offset);
            this.addObject(cloned);
            this.selectObject(cloned, true);
        });
    }

    /**
     * Save state for undo/redo
     */
    saveState() {
        // Remove any states after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add new state
        const state = {
            objects: this.objects.map(obj => obj.toJSON()),
            timestamp: Date.now()
        };
        
        this.history.push(state);
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    /**
     * Restore state from history
     */
    restoreState(state) {
        this.clearSelection();
        this.objects = [];
        
        state.objects.forEach(objData => {
            let obj;
            switch (objData.type) {
                case 'trace':
                    obj = Trace.fromJSON(objData);
                    break;
                case 'via':
                    obj = Via.fromJSON(objData);
                    break;
                case 'component':
                    obj = Component.fromJSON(objData);
                    break;
                case 'polygon':
                    obj = Polygon.fromJSON(objData);
                    break;
                // Add other object types as needed
                default:
                    console.warn(`Unknown object type: ${objData.type}`);
                    return;
            }
            
            if (obj) {
                this.objects.push(obj);
            }
        });
        
        this.render();
    }

    /**
     * Update properties panel
     */
    updatePropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        if (!panel) return;
        
        if (this.selectedObjects.length === 0) {
            panel.innerHTML = '<p>Select an object to view properties</p>';
        } else if (this.selectedObjects.length === 1) {
            const obj = this.selectedObjects[0];
            const info = obj.getInfo();
            
            let html = `<div class="property-group">
                <h4>${info.type}</h4>
                <div class="property-item">
                    <label>ID:</label>
                    <span>${info.id.substring(0, 8)}...</span>
                </div>
                <div class="property-item">
                    <label>Layer:</label>
                    <span>${info.layer}</span>
                </div>
                <div class="property-item">
                    <label>X:</label>
                    <span>${info.position.x.toFixed(2)}mm</span>
                </div>
                <div class="property-item">
                    <label>Y:</label>
                    <span>${info.position.y.toFixed(2)}mm</span>
                </div>`;
            
            // Add type-specific properties
            if (info.type === 'trace') {
                html += `
                    <div class="property-item">
                        <label>Width:</label>
                        <span>${info.width.toFixed(2)}mm</span>
                    </div>
                    <div class="property-item">
                        <label>Length:</label>
                        <span>${info.length.toFixed(2)}mm</span>
                    </div>`;
            } else if (info.type === 'via') {
                html += `
                    <div class="property-item">
                        <label>Outer Ø:</label>
                        <span>${info.outerDiameter.toFixed(2)}mm</span>
                    </div>
                    <div class="property-item">
                        <label>Drill Ø:</label>
                        <span>${info.drillDiameter.toFixed(2)}mm</span>
                    </div>`;
            }
            
            html += '</div>';
            panel.innerHTML = html;
        } else {
            panel.innerHTML = `<p>${this.selectedObjects.length} objects selected</p>`;
        }
    }

    /**
     * Update UI elements
     */
    updateUI() {
        // Update zoom level
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = `${this.viewport.getZoomPercentage()}%`;
        }
        
        // Update coordinate display
        this.updateCoordinateDisplay();
        
        // Update properties panel
        this.updatePropertiesPanel();
    }

    /**
     * Main render function
     */
    render() {
        const scene = {
            objects: this.objects,
            selectedObjects: this.selectedObjects,
            hoveredObject: this.hoveredObject,
            measurements: this.measurementTool.getMeasurements(),
            drcViolations: this.drcTool.errors,
            grid: this.grid,
            showDebug: this.showDebug
        };
        
        this.renderer.render(scene);
    }

    /**
     * Handle resize events - called when sidebar is toggled or window resizes
     */
    handleResize() {
        // Update viewport canvas size
        if (this.viewport && typeof this.viewport.updateCanvasSize === 'function') {
            this.viewport.updateCanvasSize();
        }
        
        // Update canvas dimensions
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            
            // Update viewport dimensions
            if (this.viewport) {
                this.viewport.width = this.canvas.width;
                this.viewport.height = this.canvas.height;
                this.viewport.centerX = this.viewport.width / 2;
                this.viewport.centerY = this.viewport.height / 2;
            }
            
            // Trigger re-render with new dimensions
            this.render();
        }
    }

    /**
     * Tool-specific mouse handlers (to be implemented)
     */
    handleSelectMouseDown(e) {
        const clickedObject = this.getObjectAtPoint(this.mouseWorldPosition);
        
        if (clickedObject) {
            if (e.shiftKey) {
                // Add to selection
                if (this.selectedObjects.includes(clickedObject)) {
                    this.deselectObject(clickedObject);
                } else {
                    this.selectObject(clickedObject, true);
                }
            } else {
                // Select single object
                this.selectObject(clickedObject);
            }
        } else {
            // Clear selection if clicking empty space
            if (!e.shiftKey) {
                this.clearSelection();
            }
        }
    }

    handleSelectMouseMove(e) {
        // Handle dragging selected objects
        if (this.isMouseDown && this.selectedObjects.length > 0 && this.dragStartPosition) {
            const delta = this.mouseWorldPosition.subtract(this.dragStartPosition);
            this.selectedObjects.forEach(obj => {
                if (obj.canMove()) {
                    obj.move(delta);
                }
            });
            this.dragStartPosition = this.mouseWorldPosition.clone();
        }
    }

    handleSelectMouseUp(e) {
        // Finalize any drag operation
        if (this.selectedObjects.length > 0) {
            this.saveState();
        }
    }

    handleTraceMouseDown(e) {
        // Start drawing a trace
        const startPoint = this.mouseWorldPosition.clone();
        this.currentTrace = new Trace(startPoint, startPoint, 0.2, this.currentLayer);
        this.addObject(this.currentTrace);
    }

    handleTraceMouseMove(e) {
        // Update trace end point while drawing
        if (this.currentTrace) {
            this.currentTrace.setEndPoint(this.mouseWorldPosition);
        }
    }

    handleTraceMouseUp(e) {
        // Finish drawing trace
        if (this.currentTrace) {
            if (this.currentTrace.getLength() < 0.1) {
                // Remove very short traces
                this.removeObject(this.currentTrace);
            }
            this.currentTrace = null;
        }
    }

    handleViaMouseDown(e) {
        // Place a via
        const via = new Via(this.mouseWorldPosition.clone(), 0.6, 0.3, 'drill');
        this.addObject(via);
    }

    handleComponentMouseDown(e) {
        // Place a component (placeholder)
        console.log('Component placement not yet implemented');
    }

    handlePadMouseDown(e) {
        // Place a pad
        const pad = new Pad(this.mouseWorldPosition.clone(), 1.5, 1.0, 'rect', this.currentLayer);
        this.addObject(pad);
    }

    handleMeasureMouseDown(e) {
        // Start or finish a measurement
        if (!this.currentMeasurement) {
            // Start new measurement
            this.currentMeasurement = {
                startPoint: this.mouseWorldPosition.clone(),
                endPoint: this.mouseWorldPosition.clone(),
                id: 'temp-measurement'
            };
        } else {
            // Finish measurement
            this.currentMeasurement.endPoint = this.mouseWorldPosition.clone();
            const measurement = this.measurementTool.createMeasurement(
                this.currentMeasurement.startPoint,
                this.currentMeasurement.endPoint
            );
            this.measurements.push(measurement);
            this.currentMeasurement = null;
            this.saveState();
        }
    }

    handleMeasureMouseMove(e) {
        // Update measurement end point while measuring
        if (this.currentMeasurement) {
            this.currentMeasurement.endPoint = this.mouseWorldPosition;
        }
    }

    /**
     * Edit object properties
     */
    editObjectProperties(obj) {
        // This would open a properties dialog
        console.log('Edit properties for:', obj.getDescription());
    }

    getObjects() {
        return this.objects;
    }

    setObjects(objects) {
        this.objects = objects;
    }

    getActiveLayer() {
        return this.currentLayer;
    }
}

// Export for use in other modules
window.PCBEditor = PCBEditor;
