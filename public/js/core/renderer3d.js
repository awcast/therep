/**
 * Three.js-based 3D rendering system for PCB editor
 */

class Renderer3D {
    constructor(container, pcbEditor) {
        this.container = container;
        this.pcbEditor = pcbEditor;
        this.is3DMode = false;
        
        // Three.js core objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // PCB-specific objects
        this.pcbBoard = null;
        this.pcbObjects = new Map();
        this.componentModels = new Map();
        
        // Materials
        this.materials = {};
        this.loadedModels = new Map();
        
        // Settings
        this.boardThickness = 1.6; // Standard PCB thickness in mm
        this.layerSpacing = 0.035; // Copper layer thickness
        this.solderMaskThickness = 0.025;
        
        // Loaders
        this.objLoader = new THREE.OBJLoader();
        this.textureLoader = new THREE.TextureLoader();
        
        // Initialize materials
        this.initMaterials();
        
        // Setup raycaster for mouse interactions
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.intersectedObject = null;

        // Dragging state
        this.draggedObject = null;
        this.dragPlane = null;
        this.dragOffset = new THREE.Vector3();
        
        // Animation frame
        this.animationId = null;
    }

    /**
     * Initialize materials for different PCB elements
     */
    initMaterials() {
        // PCB substrate material
        this.materials.substrate = new THREE.MeshStandardMaterial({
            color: 0x2d5a2d,
            transparent: true,
            opacity: 0.9,
            roughness: 0.8,
            metalness: 0.1
        });

        // Copper materials
        this.materials.copperTop = new THREE.MeshStandardMaterial({
            color: 0xcc6600,
            metalness: 0.8,
            roughness: 0.2
        });

        this.materials.copperBottom = new THREE.MeshStandardMaterial({
            color: 0xcc6600,
            metalness: 0.8,
            roughness: 0.2
        });

        // Solder mask materials
        this.materials.solderMaskTop = new THREE.MeshStandardMaterial({
            color: 0x0f4f0f,
            transparent: true,
            opacity: 0.8,
            roughness: 0.3
        });

        this.materials.solderMaskBottom = new THREE.MeshStandardMaterial({
            color: 0x0f4f0f,
            transparent: true,
            opacity: 0.8,
            roughness: 0.3
        });

        // Silkscreen materials
        this.materials.silkTop = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9
        });

        this.materials.silkBottom = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9
        });

        // Via/drill materials
        this.materials.via = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.9,
            roughness: 0.1
        });

        // Component materials
        this.materials.componentBody = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.7
        });

        this.materials.componentPin = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.9,
            roughness: 0.1
        });

        // Selection material
        this.materials.selection = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.5,
            emissive: 0xffff00,
            emissiveIntensity: 0.5
        });
    }

    /**
     * Initialize 3D scene
     */
    init3D() {
        if (this.renderer) {
            return; // Already initialized
        }

        // Get container dimensions
        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(50, 50, 50);
        this.camera.lookAt(0, 0, 0);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Create controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 500;
        this.controls.maxPolarAngle = Math.PI;

        // Add lights
        this.setupLighting();

        // Add event listeners
        this.setupEventListeners();

        // Hide the canvas initially
        this.renderer.domElement.style.display = 'none';
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '10';

        // Add to container
        this.container.appendChild(this.renderer.domElement);
    }

    /**
     * Setup lighting for the 3D scene
     */
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);

        // Directional light (main light)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        this.scene.add(directionalLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0x404040, 0.3);
        fillLight.position.set(-50, -50, 50);
        this.scene.add(fillLight);

        // Rim light
        const rimLight = new THREE.DirectionalLight(0x808080, 0.2);
        rimLight.position.set(0, 0, -50);
        this.scene.add(rimLight);
    }

    /**
     * Setup event listeners for 3D interactions
     */
    setupEventListeners() {
        // Mouse events for object selection
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.onMouseMove(event);
        });

        this.renderer.domElement.addEventListener('click', (event) => {
            this.onMouseClick(event);
        });

        this.renderer.domElement.addEventListener('mousedown', (event) => {
            this.onMouseDown(event);
        });

        this.renderer.domElement.addEventListener('mouseup', (event) => {
            this.onMouseUp(event);
        });

        // Resize handler
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
    }

    /**
     * Handle mouse movement for object highlighting
     */
    onMouseMove(event) {
        if (!this.is3DMode) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Reset previous intersection
        if (this.intersectedObject) {
            this.intersectedObject.material.emissive.setHex(0x000000);
            this.intersectedObject = null;
        }

        // Highlight new intersection
        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData.pcbObject) {
                this.intersectedObject = object;
                object.material.emissive.setHex(0x444444);
            }
        }
    }

    /**
     * Handle mouse click for object selection
     */
    onMouseClick(event) {
        if (!this.is3DMode || this.draggedObject) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData.pcbObject) {
                // Select the PCB object in the editor
                this.pcbEditor.selectObject(object.userData.pcbObject);
            }
        } else {
            // Clear selection if clicking empty space
            this.pcbEditor.clearSelection();
        }
    }

    /**
     * Handle mouse down for dragging
     */
    onMouseDown(event) {
        if (!this.is3DMode) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData.pcbObject && object.userData.pcbObject.canMove()) {
                this.draggedObject = object;
                this.pcbEditor.selectObject(object.userData.pcbObject);

                // Create a plane to drag on
                this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -object.position.z);
                
                const intersection = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
                this.dragOffset.copy(intersection).sub(this.draggedObject.position);
                
                this.controls.enabled = false; // Disable camera controls while dragging
            }
        }
    }

    /**
     * Handle mouse move for dragging
     */
    onMouseMove(event) {
        if (!this.is3DMode) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        if (this.draggedObject) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersection = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
                const newPosition = intersection.sub(this.dragOffset);
                this.draggedObject.position.copy(newPosition);
                
                // Update the underlying PCB object
                const pcbObject = this.draggedObject.userData.pcbObject;
                pcbObject.position.x = newPosition.x;
                pcbObject.position.y = newPosition.y;
            }
        } else {
            // Handle hover highlighting
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);

            if (this.intersectedObject) {
                this.intersectedObject.material.emissive.setHex(0x000000);
                this.intersectedObject = null;
            }

            if (intersects.length > 0) {
                const object = intersects[0].object;
                if (object.userData.pcbObject) {
                    this.intersectedObject = object;
                    object.material.emissive.setHex(0x444444);
                }
            }
        }
    }

    /**
     * Handle mouse up for dragging
     */
    onMouseUp(event) {
        if (this.draggedObject) {
            // Finalize position and save state
            const pcbObject = this.draggedObject.userData.pcbObject;
            this.pcbEditor.updatePropertiesPanel();
            this.pcbEditor.saveState();
            
            this.draggedObject = null;
            this.dragPlane = null;
            this.controls.enabled = true; // Re-enable camera controls
        }
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (!this.renderer || !this.is3DMode) return;

        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Toggle between 2D and 3D mode
     */
    toggle3D() {
        this.is3DMode = !this.is3DMode;

        if (!this.renderer) {
            this.init3D();
        }

        if (this.is3DMode) {
            // Show 3D canvas
            this.renderer.domElement.style.display = 'block';
            
            // Hide 2D canvas
            const canvas2D = document.getElementById('pcb-canvas');
            if (canvas2D) {
                canvas2D.style.display = 'none';
            }

            // Update scene with current PCB objects
            this.updateScene();
            
            // Start animation loop
            this.startAnimation();
        } else {
            // Hide 3D canvas
            this.renderer.domElement.style.display = 'none';
            
            // Show 2D canvas
            const canvas2D = document.getElementById('pcb-canvas');
            if (canvas2D) {
                canvas2D.style.display = 'block';
            }

            // Stop animation loop
            this.stopAnimation();
        }

        return this.is3DMode;
    }

    /**
     * Update 3D scene with current PCB objects
     */
    updateScene() {
        // Clear existing PCB objects
        this.clearPCBObjects();

        // Create board
        this.createBoard();

        // Add PCB objects
        this.pcbEditor.objects.forEach(obj => {
            this.addPCBObject(obj);
        });
    }

    /**
     * Clear existing PCB objects from scene
     */
    clearPCBObjects() {
        this.pcbObjects.forEach((mesh, objId) => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.pcbObjects.clear();

        // Remove board if exists
        if (this.pcbBoard) {
            this.scene.remove(this.pcbBoard);
            if (this.pcbBoard.geometry) this.pcbBoard.geometry.dispose();
            this.pcbBoard = null;
        }
    }

    /**
     * Create the basic PCB board
     */
    createBoard() {
        // Calculate board bounds from objects
        let minX = -50, maxX = 50, minY = -30, maxY = 30;
        
        if (this.pcbEditor.objects.length > 0) {
            minX = Math.min(...this.pcbEditor.objects.map(obj => obj.position ? obj.position.x - 5 : 0));
            maxX = Math.max(...this.pcbEditor.objects.map(obj => obj.position ? obj.position.x + 5 : 0));
            minY = Math.min(...this.pcbEditor.objects.map(obj => obj.position ? obj.position.y - 5 : 0));
            maxY = Math.max(...this.pcbEditor.objects.map(obj => obj.position ? obj.position.y + 5 : 0));
        }

        const boardWidth = maxX - minX;
        const boardHeight = maxY - minY;

        // Create board geometry
        const boardGeometry = new THREE.BoxGeometry(boardWidth, boardHeight, this.boardThickness);
        const boardMesh = new THREE.Mesh(boardGeometry, this.materials.substrate);
        
        boardMesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, 0);
        boardMesh.receiveShadow = true;
        
        this.scene.add(boardMesh);
        this.pcbBoard = boardMesh;

        // Add copper layers
        this.addCopperLayers(minX, maxX, minY, maxY);
    }

    /**
     * Add copper layers to the board
     */
    addCopperLayers(minX, maxX, minY, maxY) {
        const boardWidth = maxX - minX;
        const boardHeight = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Top copper layer
        const topCopperGeometry = new THREE.PlaneGeometry(boardWidth, boardHeight);
        const topCopperMesh = new THREE.Mesh(topCopperGeometry, this.materials.copperTop);
        topCopperMesh.position.set(centerX, centerY, this.boardThickness / 2 + this.layerSpacing);
        topCopperMesh.rotation.x = Math.PI; // Face down
        this.scene.add(topCopperMesh);

        // Bottom copper layer
        const bottomCopperGeometry = new THREE.PlaneGeometry(boardWidth, boardHeight);
        const bottomCopperMesh = new THREE.Mesh(bottomCopperGeometry, this.materials.copperBottom);
        bottomCopperMesh.position.set(centerX, centerY, -this.boardThickness / 2 - this.layerSpacing);
        this.scene.add(bottomCopperMesh);
    }

    /**
     * Add a PCB object to the 3D scene
     */
    addPCBObject(pcbObject) {
        let mesh = null;

        switch (pcbObject.constructor.name) {
            case 'Trace':
                mesh = this.createTraceMesh(pcbObject);
                break;
            case 'Via':
                mesh = this.createViaMesh(pcbObject);
                break;
            case 'Component':
                mesh = this.createComponentMesh(pcbObject);
                break;
            case 'Pad':
                mesh = this.createPadMesh(pcbObject);
                break;
            default:
                console.warn('Unknown PCB object type:', pcbObject.constructor.name);
                return;
        }

        if (mesh) {
            mesh.userData.pcbObject = pcbObject;
            mesh.castShadow = true;
            this.scene.add(mesh);
            this.pcbObjects.set(pcbObject.id, mesh);
        }
    }

    /**
     * Create 3D mesh for a trace
     */
    createTraceMesh(trace) {
        if (!trace.startPoint || !trace.endPoint) return null;

        const startPos = new THREE.Vector3(trace.startPoint.x, trace.startPoint.y, this.getLayerZ(trace.layer));
        const endPos = new THREE.Vector3(trace.endPoint.x, trace.endPoint.y, this.getLayerZ(trace.layer));
        
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const length = direction.length();
        
        if (length < 0.01) return null; // Skip very short traces

        const geometry = new THREE.CylinderGeometry(trace.width / 2, trace.width / 2, length);
        const material = this.getCopperMaterial(trace.layer);
        const mesh = new THREE.Mesh(geometry, material);

        // Position and orient the cylinder
        mesh.position.copy(startPos).add(endPos).multiplyScalar(0.5);
        mesh.lookAt(endPos);
        mesh.rotateX(Math.PI / 2);

        return mesh;
    }

    /**
     * Create 3D mesh for a via
     */
    createViaMesh(via) {
        if (!via.position) return null;

        const geometry = new THREE.CylinderGeometry(
            via.outerDiameter / 2, 
            via.outerDiameter / 2, 
            this.boardThickness + this.layerSpacing * 2
        );
        
        const mesh = new THREE.Mesh(geometry, this.materials.via);
        mesh.position.set(via.position.x, via.position.y, 0);

        // Add drill hole
        const drillGeometry = new THREE.CylinderGeometry(
            via.drillDiameter / 2,
            via.drillDiameter / 2,
            this.boardThickness + this.layerSpacing * 4
        );
        const drillMesh = new THREE.Mesh(drillGeometry, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.5 }));
        drillMesh.position.set(0, 0, 0);
        mesh.add(drillMesh);

        return mesh;
    }

    /**
     * Create 3D mesh for a component
     */
    createComponentMesh(component) {
        if (!component.position) return null;

        // Create a simple box for now - will be replaced with actual 3D models later
        const geometry = new THREE.BoxGeometry(
            component.size.width,
            component.size.height,
            2 // Component height
        );
        
        const mesh = new THREE.Mesh(geometry, this.materials.componentBody);
        mesh.position.set(
            component.position.x, 
            component.position.y, 
            this.getLayerZ(component.layer) + 1
        );
        
        // Apply rotation
        if (component.rotation) {
            mesh.rotation.z = (component.rotation * Math.PI) / 180;
        }

        return mesh;
    }

    /**
     * Create 3D mesh for a pad
     */
    createPadMesh(pad) {
        if (!pad.position) return null;

        const geometry = new THREE.BoxGeometry(pad.width, pad.height, this.layerSpacing);
        const material = this.getCopperMaterial(pad.layer);
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(
            pad.position.x,
            pad.position.y,
            this.getLayerZ(pad.layer)
        );

        return mesh;
    }

    /**
     * Get the Z position for a layer
     */
    getLayerZ(layer) {
        switch (layer) {
            case 'top-copper':
                return this.boardThickness / 2 + this.layerSpacing / 2;
            case 'bottom-copper':
                return -this.boardThickness / 2 - this.layerSpacing / 2;
            case 'top-silk':
                return this.boardThickness / 2 + this.layerSpacing + 0.01;
            case 'bottom-silk':
                return -this.boardThickness / 2 - this.layerSpacing - 0.01;
            default:
                return 0;
        }
    }

    /**
     * Get copper material for layer
     */
    getCopperMaterial(layer) {
        if (layer === 'top-copper' || layer === 'top-silk') {
            return this.materials.copperTop;
        } else {
            return this.materials.copperBottom;
        }
    }

    /**
     * Start animation loop
     */
    startAnimation() {
        if (this.animationId) return;

        const animate = () => {
            if (!this.is3DMode) return;

            this.animationId = requestAnimationFrame(animate);
            
            if (this.controls) {
                this.controls.update();
            }
            
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };

        animate();
    }

    /**
     * Stop animation loop
     */
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Load 3D model for component
     */
    loadComponentModel(componentType, modelPath) {
        return new Promise((resolve, reject) => {
            if (this.loadedModels.has(componentType)) {
                resolve(this.loadedModels.get(componentType));
                return;
            }

            this.objLoader.load(
                modelPath,
                (object) => {
                    this.loadedModels.set(componentType, object);
                    resolve(object);
                },
                (progress) => {
                    console.log('Loading progress:', progress);
                },
                (error) => {
                    console.error('Error loading model:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Update object in 3D scene
     */
    updatePCBObject(pcbObject) {
        const existingMesh = this.pcbObjects.get(pcbObject.id);
        if (existingMesh) {
            this.scene.remove(existingMesh);
            if (existingMesh.geometry) existingMesh.geometry.dispose();
            this.pcbObjects.delete(pcbObject.id);
        }

        this.addPCBObject(pcbObject);
    }

    /**
     * Remove object from 3D scene
     */
    removePCBObject(pcbObject) {
        const mesh = this.pcbObjects.get(pcbObject.id);
        if (mesh) {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            this.pcbObjects.delete(pcbObject.id);
        }
    }

    /**
     * Get 3D mode status
     */
    is3DModeActive() {
        return this.is3DMode;
    }

    /**
     * Create a Three.js PCB demonstration scene
     */
    createThreeJSPCBDemo() {
        console.log('Creating Three.js PCB Demo Scene...');
        
        // Clear existing objects
        this.pcbEditor.objects = [];
        
        // Create a simple demonstration PCB with various components
        
        // Add some traces in different patterns
        const trace1 = new Trace(
            new Point(-20, -10), 
            new Point(20, -10), 
            0.3, 
            'top-copper'
        );
        this.pcbEditor.addObject(trace1);
        
        const trace2 = new Trace(
            new Point(-20, 0), 
            new Point(20, 0), 
            0.25, 
            'top-copper'
        );
        this.pcbEditor.addObject(trace2);
        
        const trace3 = new Trace(
            new Point(-20, 10), 
            new Point(20, 10), 
            0.2, 
            'top-copper'
        );
        this.pcbEditor.addObject(trace3);
        
        // Add some curved/angled traces
        const trace4 = new Trace(
            new Point(-15, -15), 
            new Point(0, 5), 
            0.2, 
            'top-copper'
        );
        this.pcbEditor.addObject(trace4);
        
        const trace5 = new Trace(
            new Point(0, 5), 
            new Point(15, -15), 
            0.2, 
            'top-copper'
        );
        this.pcbEditor.addObject(trace5);
        
        // Add various components with different sizes and orientations
        const ic1 = new Component(
            new Point(-10, -5), 
            { width: 12, height: 8 }, 
            0, 
            'top-copper'
        );
        ic1.setDesignator('U1');
        ic1.setFootprint('QFP-32');
        this.pcbEditor.addObject(ic1);
        
        const resistor1 = new Component(
            new Point(8, -8), 
            { width: 3, height: 1.5 }, 
            0, 
            'top-copper'
        );
        resistor1.setDesignator('R1');
        resistor1.setFootprint('0805');
        this.pcbEditor.addObject(resistor1);
        
        const resistor2 = new Component(
            new Point(12, -2), 
            { width: 3, height: 1.5 }, 
            90, 
            'top-copper'
        );
        resistor2.setDesignator('R2');
        resistor2.setFootprint('0805');
        this.pcbEditor.addObject(resistor2);
        
        const capacitor1 = new Component(
            new Point(-5, 8), 
            { width: 5, height: 3 }, 
            45, 
            'top-copper'
        );
        capacitor1.setDesignator('C1');
        capacitor1.setFootprint('1206');
        this.pcbEditor.addObject(capacitor1);
        
        const connector = new Component(
            new Point(15, 8), 
            { width: 8, height: 4 }, 
            0, 
            'top-copper'
        );
        connector.setDesignator('J1');
        connector.setFootprint('Header-8');
        this.pcbEditor.addObject(connector);
        
        // Add vias at strategic locations
        const via1 = new Via(new Point(-15, -10), 0.6, 0.3, 'drill');
        this.pcbEditor.addObject(via1);
        
        const via2 = new Via(new Point(0, 0), 0.5, 0.25, 'drill');
        this.pcbEditor.addObject(via2);
        
        const via3 = new Via(new Point(15, 10), 0.7, 0.35, 'drill');
        this.pcbEditor.addObject(via3);
        
        const via4 = new Via(new Point(-8, 5), 0.5, 0.25, 'drill');
        this.pcbEditor.addObject(via4);
        
        // Add some pads
        const pad1 = new Pad(new Point(-18, -5), 2, 1.5, 'rect', 'top-copper');
        this.pcbEditor.addObject(pad1);
        
        const pad2 = new Pad(new Point(-18, 5), 2, 1.5, 'rect', 'top-copper');
        this.pcbEditor.addObject(pad2);
        
        const pad3 = new Pad(new Point(18, -5), 2, 1.5, 'rect', 'top-copper');
        this.pcbEditor.addObject(pad3);
        
        const pad4 = new Pad(new Point(18, 5), 2, 1.5, 'rect', 'top-copper');
        this.pcbEditor.addObject(pad4);
        
        // Add some bottom layer traces
        const bottomTrace1 = new Trace(
            new Point(-15, -5), 
            new Point(15, -5), 
            0.2, 
            'bottom-copper'
        );
        this.pcbEditor.addObject(bottomTrace1);
        
        const bottomTrace2 = new Trace(
            new Point(-15, 5), 
            new Point(15, 5), 
            0.2, 
            'bottom-copper'
        );
        this.pcbEditor.addObject(bottomTrace2);
        
        // Save state and render
        this.pcbEditor.saveState();
        this.pcbEditor.render();
        
        console.log(`Created ${this.pcbEditor.objects.length} PCB objects for 3D demo`);
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.stopAnimation();
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        this.clearPCBObjects();
        
        // Dispose materials
        Object.values(this.materials).forEach(material => {
            material.dispose();
        });
    }
}

// Export for use in other modules
window.Renderer3D = Renderer3D;
