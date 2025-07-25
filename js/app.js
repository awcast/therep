/**
 * Application initialization and main entry point
 */

// Global PCB editor instance
let pcbEditor = null;
let userLibrary = null;
let renderer3d = null;
let authManager = null;
let authUI = null;
let pcbApi = null;

/**
 * Initialize the PCB editor application
 */
async function initializePCBEditor() {
    try {
        // Show loading message
        const statusLeft = document.querySelector('.status-left span');
        if (statusLeft) {
            statusLeft.textContent = 'Initializing authentication...';
        }

        // Initialize authentication system
        authManager = new AuthManager();
        await new Promise(resolve => {
            const checkInit = () => {
                if (authManager.isInitialized) {
                    resolve();
                } else {
                    setTimeout(checkInit, 100);
                }
            };
            checkInit();
        });

        // Initialize authentication UI
        authUI = new AuthUI(authManager);
        window.authUI = authUI; // Make it globally accessible

        if (statusLeft) {
            statusLeft.textContent = 'Initializing PCB editor...';
        }

        // Create the PCB editor instance
        pcbEditor = new PCBEditor('pcb-canvas');
        
        // Initialize user library with auth manager
        userLibrary = new UserLibrary(authManager);
        await userLibrary.initialize();
        
        // Setup additional UI event handlers
        setupUIHandlers();
        
        // Setup menu handlers
        setupMenuHandlers();
        
    // Setup toolbar handlers
    setupToolbarHandlers();
    
    // Setup tab handlers
    setupTabHandlers();
        
        // Setup Plandex handlers
        setupPlandexHandlers();
        
        // Add some sample objects for demonstration
        addSampleObjects();
        
        // Initialize 3D renderer
        const canvasContainer = document.querySelector('.canvas-container');
        renderer3d = new Renderer3D(canvasContainer, pcbEditor);
        
        // Update UI based on current auth state
        authUI.updateUI(authManager.isAuthenticated, authManager.getCurrentUser());

        // Initialize PCB API
        pcbApi = new PCBApi(authManager);
        window.pcbApi = pcbApi; // Make it globally accessible

        if (statusLeft) {
            statusLeft.textContent = 'Ready';
        }
        
        console.log('PCB Editor initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize PCB Editor:', error);
        showError('Failed to initialize PCB Editor: ' + error.message);
        
        // Reset status
        const statusLeft = document.querySelector('.status-left span');
        if (statusLeft) {
            statusLeft.textContent = 'Initialization failed';
        }
    }
}

/**
 * Setup UI event handlers
 */
function setupUIHandlers() {
    // Zoom controls
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomFitBtn = document.getElementById('zoom-fit');
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            pcbEditor.viewport.zoomIn();
            pcbEditor.updateUI();
            pcbEditor.render();
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            pcbEditor.viewport.zoomOut();
            pcbEditor.updateUI();
            pcbEditor.render();
        });
    }
    
    if (zoomFitBtn) {
        zoomFitBtn.addEventListener('click', () => {
            pcbEditor.viewport.resetView();
            pcbEditor.updateUI();
            pcbEditor.render();
        });
    }
    
    // Grid controls
    const gridToggle = document.getElementById('grid-toggle');
    if (gridToggle) {
        gridToggle.addEventListener('click', () => {
            const visible = pcbEditor.grid.toggleVisible();
            gridToggle.classList.toggle('active', visible);
            pcbEditor.render();
        });
    }
    
    // Snap to grid toggle
    const snapToggle = document.getElementById('snap-toggle');
    if (snapToggle) {
        snapToggle.addEventListener('click', () => {
            pcbEditor.snapToGrid = !pcbEditor.snapToGrid;
            snapToggle.classList.toggle('active', pcbEditor.snapToGrid);
        });
    }
    
    // Debug toggle
    const debugToggle = document.getElementById('debug-toggle');
    if (debugToggle) {
        debugToggle.addEventListener('click', () => {
            pcbEditor.showDebug = !pcbEditor.showDebug;
            debugToggle.classList.toggle('active', pcbEditor.showDebug);
            pcbEditor.render();
        });
    }

    // 3D View button
    const view3DBtn = document.getElementById('view-3d');
    if (view3DBtn) {
        view3DBtn.addEventListener('click', () => {
            const is3D = renderer3d.toggle3D();
            if (is3D) {
                renderer3d.createThreeJSPCBDemo();
            }
            view3DBtn.classList.toggle('active', is3D);
        });
    }

    // Library button (toolbar)
    const openLibraryBtn = document.getElementById('open-library-btn');
    if (openLibraryBtn) {
        openLibraryBtn.addEventListener('click', () => {
            openLibraryModal();
        });
    }
}

/**
 * Setup menu handlers
 */
function setupMenuHandlers() {
    // File menu
    const newBtn = document.getElementById('menu-new');
    const openBtn = document.getElementById('menu-open');
    const importPcbDocBtn = document.getElementById('menu-import-pcbdoc');
    const importKiCadBtn = document.getElementById('menu-import-kicad');
    const libraryBtn = document.getElementById('menu-library');
    const userBtn = document.getElementById('menu-user');
    const saveBtn = document.getElementById('menu-save');
    const exportBtn = document.getElementById('menu-export');
    const toggleToolsBtn = document.getElementById('menu-toggle-tools');
    
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            if (confirm('Create new PCB? This will clear the current design.')) {
                newPCB();
            }
        });
    }
    
    if (openBtn) {
        openBtn.addEventListener('click', async () => {
            try {
                const results = await pcbEditor.fileManager.loadFile();
                console.log('Loaded files:', results);
                
                // Show results to user
                const successCount = results.filter(r => r.success).length;
                const errorCount = results.filter(r => r.error).length;
                
                if (successCount > 0) {
                    const statusLeft = document.querySelector('.status-left span');
                    if (statusLeft) {
                        statusLeft.textContent = `Loaded ${successCount} file(s)`;
                    }
                }
                
                if (errorCount > 0) {
                    const errors = results.filter(r => r.error).map(r => `${r.file}: ${r.error}`).join('\n');
                    showError(`Failed to load ${errorCount} file(s):\n${errors}`);
                }
                
            } catch (error) {
                console.error('Error loading files:', error);
                showError('Error loading files: ' + error.message);
            }
        });
    }
    
    if (importPcbDocBtn) {
        importPcbDocBtn.addEventListener('click', () => {
            importPCBDocFile();
        });
    }
    
    if (importKiCadBtn) {
        importKiCadBtn.addEventListener('click', () => {
            importKiCadFile();
        });
    }
    
    if (libraryBtn) {
        libraryBtn.addEventListener('click', () => {
            openLibraryModal();
        });
    }
    
    if (userBtn) {
        userBtn.addEventListener('click', () => {
            openUserModal();
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (pcbEditor.fileManager.currentFile) {
                pcbEditor.fileManager.saveCurrentFile();
            } else {
                savePCB();
            }
        });
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportPCB();
        });
    }

    if (toggleToolsBtn) {
        toggleToolsBtn.addEventListener('click', () => {
            const toolbar = document.querySelector('.toolbar-left');
            if (toolbar) {
                toolbar.classList.toggle('hidden');
            }
        });
    }
    
    // Edit menu
    const undoBtn = document.getElementById('menu-undo');
    const redoBtn = document.getElementById('menu-redo');
    const copyBtn = document.getElementById('menu-copy');
    const pasteBtn = document.getElementById('menu-paste');
    const deleteBtn = document.getElementById('menu-delete');
    
    if (undoBtn) {
        undoBtn.addEventListener('click', () => pcbEditor.undo());
    }
    
    if (redoBtn) {
        redoBtn.addEventListener('click', () => pcbEditor.redo());
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', () => pcbEditor.copy());
    }
    
    if (pasteBtn) {
        pasteBtn.addEventListener('click', () => pcbEditor.paste());
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => pcbEditor.deleteSelected());
    }
}

/**
 * Setup toolbar handlers
 */
function setupToolbarHandlers() {
    // Tool buttons are handled in PCBEditor constructor
    
    // Layer visibility toggles
    document.querySelectorAll('.layer-visibility').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const layer = e.target.dataset.layer;
            pcbEditor.renderer.setLayerVisible(layer, e.target.checked);
            pcbEditor.render();
        });
    });
    
    // Grid size selector
    const gridSizeSelect = document.getElementById('grid-size');
    if (gridSizeSelect) {
        // Populate grid size options
        const commonSizes = Grid.getCommonSizes();
        commonSizes.forEach(size => {
            const option = document.createElement('option');
            option.value = size.value;
            option.textContent = size.name;
            if (size.value === 1.27) option.selected = true;
            gridSizeSelect.appendChild(option);
        });
        
        gridSizeSelect.addEventListener('change', (e) => {
            const newSize = parseFloat(e.target.value);
            pcbEditor.grid.setSize(newSize);
            pcbEditor.render();
        });
    }
}

/**
 * Add sample objects for demonstration
 */
function addSampleObjects() {
    // Add some sample traces
    const trace1 = new Trace(
        new Point(-10, -5),
        new Point(10, -5),
        0.2,
        'top-copper'
    );
    trace1.setNet('VCC');
    pcbEditor.objects.push(trace1);
    
    const trace2 = new Trace(
        new Point(-10, 0),
        new Point(10, 0),
        0.2,
        'top-copper'
    );
    trace2.setNet('GND');
    pcbEditor.objects.push(trace2);
    
    const trace3 = new Trace(
        new Point(-10, 5),
        new Point(10, 5),
        0.15,
        'top-copper'
    );
    trace3.setNet('DATA');
    pcbEditor.objects.push(trace3);
    
    // Add some vias
    const via1 = new Via(new Point(-5, -5), 0.6, 0.3, 'drill');
    via1.setNet('VCC');
    pcbEditor.objects.push(via1);
    
    const via2 = new Via(new Point(0, 0), 0.6, 0.3, 'drill');
    via2.setNet('GND');
    pcbEditor.objects.push(via2);
    
    const via3 = new Via(new Point(5, 5), 0.5, 0.25, 'drill');
    via3.setNet('DATA');
    pcbEditor.objects.push(via3);
    
    // Save initial state
    pcbEditor.saveState();
    
    // Render the scene
    pcbEditor.render();
}

/**
 * Create new PCB
 */
function newPCB() {
    pcbEditor.objects = [];
    pcbEditor.selectedObjects = [];
    pcbEditor.hoveredObject = null;
    pcbEditor.measurements = [];
    pcbEditor.history = [];
    pcbEditor.historyIndex = -1;
    
    pcbEditor.viewport.resetView();
    pcbEditor.saveState();
    pcbEditor.render();
    pcbEditor.updateUI();
}

/**
 * Open PCB from file
 */
function openPCB() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.pcbdoc,.kicad_pcb';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileName = file.name.toLowerCase();
        
        if (fileName.endsWith('.pcbdoc')) {
            // Handle .pcbdoc files
            loadPCBDocFile(file);
        } else if (fileName.endsWith('.kicad_pcb')) {
            // Handle KiCad files
            loadKiCadFile(file);
        } else if (fileName.endsWith('.json')) {
            // Handle JSON files
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    loadPCBData(data);
                } catch (error) {
                    showError('Failed to load PCB file: ' + error.message);
                }
            };
            reader.readAsText(file);
        } else {
            showError('Unsupported file format. Please select a .json, .pcbdoc, or .kicad_pcb file.');
        }
    };
    
    input.click();
}

/**
 * Save PCB to file
 */
function savePCB() {
    const data = {
        version: '1.0',
        created: new Date().toISOString(),
        objects: pcbEditor.objects.map(obj => obj.toJSON()),
        grid: {
            size: pcbEditor.grid.size,
            visible: pcbEditor.grid.visible
        },
        viewport: pcbEditor.viewport.saveState()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pcb-design.json';
    a.click();
    
    URL.revokeObjectURL(url);
}

/**
 * Export PCB as image
 */
function exportPCB() {
    const dataURL = pcbEditor.renderer.exportImage('png', 1.0);
    
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'pcb-design.png';
    a.click();
}

/**
 * Import .pcbdoc file
 */
function importPCBDocFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pcbdoc';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        loadPCBDocFile(file);
    };
    
    input.click();
}

/**
 * Import KiCad .kicad_pcb file
 */
function importKiCadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kicad_pcb';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        loadKiCadFile(file);
    };
    
    input.click();
}

/**
 * Load PCB document file (.pcbdoc)
 */
async function loadPCBDocFile(file) {
    try {
        // Show loading message
        const statusLeft = document.querySelector('.status-left span');
        if (statusLeft) {
            statusLeft.textContent = 'Loading PCB document...';
        }
        
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Use simplified parser for demonstration
        const parser = new SimplifiedPCBDocParser();
        const pcbData = await parser.parseFile(arrayBuffer);
        
        // Set filename
        pcbData.filename = file.name;
        
        // Add to user library
        userLibrary.addPCBToLibrary(pcbData, file.name, 'Imported .pcbdoc file');
        
        // Load the parsed data
        loadPCBData(pcbData);
        
        // Update status
        if (statusLeft) {
            statusLeft.textContent = `Loaded: ${file.name}`;
        }
        
        console.log('PCB document loaded successfully:', pcbData);
        
    } catch (error) {
        console.error('Failed to load PCB document:', error);
        showError('Failed to load PCB document: ' + error.message);
        
        // Reset status
        const statusLeft = document.querySelector('.status-left span');
        if (statusLeft) {
            statusLeft.textContent = 'Ready';
        }
    }
}

/**
 * Load KiCad PCB file (.kicad_pcb)
 */
async function loadKiCadFile(file) {
    try {
        // Show loading message
        const statusLeft = document.querySelector('.status-left span');
        if (statusLeft) {
            statusLeft.textContent = 'Loading KiCad PCB file...';
        }
        
        // Read file as text
        const textContent = await file.text();
        
        // Use simplified parser for demonstration
        const parser = new SimplifiedKiCadParser();
        const pcbData = await parser.parseFile(textContent);
        
        // Set filename
        pcbData.filename = file.name;
        
        // Add to user library
        userLibrary.addPCBToLibrary(pcbData, file.name, 'Imported KiCad PCB file');
        
        // Load the parsed data
        loadPCBData(pcbData);
        
        // Update status
        if (statusLeft) {
            statusLeft.textContent = `Loaded: ${file.name}`;
        }
        
        console.log('KiCad PCB file loaded successfully:', pcbData);
        
    } catch (error) {
        console.error('Failed to load KiCad PCB file:', error);
        showError('Failed to load KiCad PCB file: ' + error.message);
        
        // Reset status
        const statusLeft = document.querySelector('.status-left span');
        if (statusLeft) {
            statusLeft.textContent = 'Ready';
        }
    }
}

/**
 * Load PCB data
 */
function loadPCBData(data) {
    // Clear current design
    newPCB();
    
    // Load objects
    if (data.objects) {
        data.objects.forEach(objData => {
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
                default:
                    console.warn(`Unknown object type: ${objData.type}`);
                    return;
            }
            
            if (obj) {
                pcbEditor.objects.push(obj);
            }
        });
    }
    
    // Load grid settings
    if (data.grid) {
        pcbEditor.grid.setSize(data.grid.size);
        pcbEditor.grid.setVisible(data.grid.visible);
    }
    
    // Load viewport settings
    if (data.viewport) {
        pcbEditor.viewport.restoreState(data.viewport);
    }
    
    // Update layers if provided
    if (data.layers) {
        updateLayerPanel(data.layers);
    }
    
    pcbEditor.saveState();
    pcbEditor.render();
    pcbEditor.updateUI();
    
    // Show file info
    if (data.filename) {
        console.log(`Loaded PCB file: ${data.filename}`);
        if (data.source) {
            console.log(`Source format: ${data.source}`);
        }
    }
}

/**
 * Update layer panel with loaded layer information
 */
function updateLayerPanel(layers) {
    // This could be expanded to dynamically update the layer panel
    // For now, we'll just log the layer information
    console.log('PCB Layers:', layers);
}

/**
 * Library Modal Functions
 */
function openLibraryModal() {
    // Navigate to the dedicated library page
    window.open('library.html', '_blank');
}

function closeLibraryModal() {
    const modal = document.getElementById('library-modal');
    modal.classList.add('hidden');
}

function refreshLibrary() {
    const user = userLibrary.getUserLibrary();
    const libraryList = document.getElementById('library-list');
    const libraryUser = document.getElementById('library-user');
    const libraryCount = document.getElementById('library-count');

    libraryUser.textContent = user.displayName;
    libraryCount.textContent = user.pcbs.length;
    libraryList.innerHTML = '';

    user.pcbs.forEach(pcb => {
        const item = document.createElement('div');
        item.className = 'library-item';
        item.dataset.pcbId = pcb.id;
        item.innerHTML = `
            <h4>${pcb.filename}</h4>
            <p>Source: ${pcb.source}</p>
            <p>Objects: ${pcb.stats.totalObjects}</p>
            <p>Uploaded: ${new Date(pcb.uploadDate).toLocaleDateString()}</p>
        `;
        item.onclick = () => {
            const pcbData = userLibrary.getPCBById(pcb.id);
            if (pcbData) {
                loadPCBData(pcbData.data);
                closeLibraryModal();
            }
        };
        libraryList.appendChild(item);
    });
}

function searchLibrary() {
    const query = document.getElementById('library-search').value;
    const results = userLibrary.searchPCBs(query);
    // Update UI with search results (simplified for now)
    console.log('Search results:', results);
}

function exportLibrary() {
    const data = userLibrary.exportLibrary();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${userLibrary.currentUser}-library.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function importLibrary() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                userLibrary.importLibrary(data);
                refreshLibrary();
            } catch (error) {
                showError('Failed to import library: ' + error.message);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

/**
 * User Modal Functions
 */
function openUserModal() {
    const modal = document.getElementById('user-modal');
    modal.classList.remove('hidden');
    updateUserUI();
}

function closeUserModal() {
    const modal = document.getElementById('user-modal');
    modal.classList.add('hidden');
}

function changeUser() {
    const input = document.getElementById('username-input');
    const newUsername = input.value.trim();
    if (newUsername) {
        try {
            userLibrary.setCurrentUser(newUsername);
            updateUserUI();
            input.value = '';
        } catch (error) {
            showError(error.message);
        }
    }
}

function updateUserUI() {
    const currentUserSpan = document.getElementById('current-user');
    const usersList = document.getElementById('users-list');
    
    currentUserSpan.textContent = userLibrary.currentUser;
    usersList.innerHTML = '';
    
    const users = userLibrary.getAllUsers();
    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'user-item';
        item.textContent = `${user.displayName} (${user.pcbCount} PCBs)`;
        item.dataset.userId = user.id;
        item.addEventListener('click', () => {
            const selected = document.querySelector('.user-item.selected');
            if (selected) {
                selected.classList.remove('selected');
            }
            item.classList.add('selected');
        });
        usersList.appendChild(item);
    });
}

async function deleteSelectedUser() {
    const selectedUserItem = document.querySelector('.user-item.selected');
    if (!selectedUserItem) {
        showError('Please select a user to delete.');
        return;
    }

    const userId = selectedUserItem.dataset.userId;
    if (confirm(`Are you sure you want to delete user ${userId}? This action cannot be undone.`)) {
        const result = await pcbApi.deleteUser({ userId });
        if (result.success) {
            updateUserUI();
        } else {
            showError(result.error);
        }
    }
}

/**
 * Show error message
 */
function showError(message) {
    // Create a simple error dialog
    const dialog = document.createElement('div');
    dialog.className = 'error-dialog';
    dialog.innerHTML = `
        <div class="error-content">
            <h3>Error</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.parentElement.remove()">OK</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (dialog.parentElement) {
            dialog.remove();
        }
    }, 5000);
}

/**
 * Handle window resize
 */
function handleResize() {
    if (pcbEditor) {
        pcbEditor.viewport.updateCanvasSize();
        pcbEditor.render();
    }
}

/**
 * Initialize when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    initializePCBEditor();
});

/**
 * Handle window resize
 */
window.addEventListener('resize', handleResize);

/**
 * Handle before unload to warn about unsaved changes
 */
window.addEventListener('beforeunload', (e) => {
    if (pcbEditor && pcbEditor.objects.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
    }
});

/**
 * Setup Plandex UI event handlers
 */
function setupPlandexHandlers() {
    const sendBtn = document.getElementById('plandex-send');
    const promptInput = document.getElementById('plandex-prompt');
    const applyBtn = document.getElementById('plandex-apply');
    const discardBtn = document.getElementById('plandex-discard');

    if (sendBtn && promptInput) {
        sendBtn.addEventListener('click', async () => {
            const prompt = promptInput.value;
            if (prompt.trim() === '') return;

            const response = await pcbEditor.plandex.sendPrompt(prompt);
            if (response) {
                // Store the response temporarily for applying later
                window.plandexResponse = response;
                applyBtn.style.display = 'inline-block';
                discardBtn.style.display = 'inline-block';
            }
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (window.plandexResponse) {
                pcbEditor.plandex.applyChanges(window.plandexResponse);
                window.plandexResponse = null;
                applyBtn.style.display = 'none';
                discardBtn.style.display = 'none';
            }
        });
    }

    if (discardBtn) {
        discardBtn.addEventListener('click', () => {
            window.plandexResponse = null;
            applyBtn.style.display = 'none';
            discardBtn.style.display = 'none';
            document.querySelector('.plandex-response').innerHTML = '';
        });
    }
}

/**
 * Setup tab handlers for the right panel
 */
function setupTabHandlers() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activate the selected tab
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Export for debugging
window.pcbEditor = pcbEditor;
window.userLibrary = userLibrary;
