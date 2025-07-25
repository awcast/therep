/**
 * File Manager tool for handling various PCB file formats
 * Supports .gbr (Gerber), .drl (Drill), .sch (Schematic) files
 */

class FileManager {
    constructor(pcbEditor) {
        this.pcbEditor = pcbEditor;
        this.parsers = {
            gerber: new GerberParser(),
            drill: new DrillParser(),
            schematic: new SchematicParser(),
            kicad: new KiCadParser(),
            pcbdoc: new PCBDocParser(),
            archive: new ArchiveParser()
        };
        this.loadedFiles = new Map();
        this.currentFile = null;
        this.fileHistory = [];
    }

    /**
     * Load file from user selection
     */
    async loadFile() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.gbr,.drl,.sch,.kicad_pcb,.pcbdoc,.zip';
            input.multiple = true;
            
            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                const results = [];
                
                for (const file of files) {
                    try {
                        const result = await this.processFile(file);
                        results.push(result);
                    } catch (error) {
                        console.error(`Error processing file ${file.name}:`, error);
                        results.push({ file: file.name, error: error.message });
                    }
                }
                
                resolve(results);
            };
            
            input.onerror = () => reject(new Error('File selection cancelled'));
            input.click();
        });
    }

    /**
     * Process a single file
     */
    async processFile(file) {
        const extension = this.getFileExtension(file.name);
        
        let content, fileType, parsedData, objects = [];
        
        try {
            // Handle ZIP archives differently
            if (extension === 'zip') {
                content = await this.readFileAsArrayBuffer(file);
                fileType = 'archive';
                
                parsedData = await this.parsers.archive.parseArchive(content);
                objects = this.parsers.archive.toPCBObjects();
                
                // Create archive result with layer information
                const archiveResult = {
                    name: file.name,
                    type: fileType,
                    content: content,
                    parsedData: parsedData,
                    objects: objects,
                    lastModified: file.lastModified,
                    size: file.size,
                    isArchive: true,
                    layers: parsedData.layers,
                    layerStack: parsedData.layerStack
                };
                
                this.loadedFiles.set(file.name, archiveResult);
                this.currentFile = archiveResult;
                this.addToHistory(archiveResult);
                
                // Add objects to PCB editor with layer information
                this.addArchiveObjectsToEditor(parsedData);
                
                // Update layer panel with archive layers
                this.updateLayerPanel(parsedData.layerStack);
                
                // Update UI
                this.updateFileList();
                this.pcbEditor.render();
                
                return {
                    file: file.name,
                    type: fileType,
                    objectCount: objects.length,
                    layerCount: parsedData.layers.size,
                    drillFiles: parsedData.drillFiles.length,
                    bomFiles: parsedData.bomFiles.length,
                    pickAndPlaceFiles: parsedData.pickAndPlaceFiles.length,
                    success: true
                };
                
            } else {
                // Handle regular files
                content = await this.readFileContent(file);
                fileType = this.determineFileType(extension, content);
                
                switch (fileType) {
                    case 'gerber':
                        parsedData = this.parsers.gerber.parse(content);
                        objects = this.parsers.gerber.toPCBObjects();
                        break;
                        
                    case 'drill':
                        parsedData = this.parsers.drill.parse(content);
                        objects = this.parsers.drill.toPCBObjects();
                        break;
                        
                    case 'schematic':
                        parsedData = this.parsers.schematic.parse(content);
                        objects = this.parsers.schematic.toPCBObjects();
                        break;
                        
                    case 'kicad':
                        parsedData = this.parsers.kicad.parse(content);
                        objects = this.parsers.kicad.toPCBObjects();
                        break;
                        
                    case 'pcbdoc':
                        parsedData = this.parsers.pcbdoc.parse(content);
                        objects = this.parsers.pcbdoc.toPCBObjects();
                        break;
                        
                    default:
                        throw new Error(`Unsupported file type: ${fileType}`);
                }
                
                // Store file data
                const fileData = {
                    name: file.name,
                    type: fileType,
                    content: content,
                    parsedData: parsedData,
                    objects: objects,
                    lastModified: file.lastModified,
                    size: file.size
                };
                
                this.loadedFiles.set(file.name, fileData);
                this.currentFile = fileData;
                this.addToHistory(fileData);
                
                // Add objects to PCB editor
                objects.forEach(obj => {
                    this.pcbEditor.addObject(obj);
                });
                
                // Update UI
                this.updateFileList();
                this.pcbEditor.render();
                
                return {
                    file: file.name,
                    type: fileType,
                    objectCount: objects.length,
                    success: true
                };
            }
            
        } catch (error) {
            throw new Error(`Failed to parse ${fileType} file: ${error.message}`);
        }
    }

    /**
     * Read file content as text
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Read file content as array buffer (for ZIP files)
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Add archive objects to PCB editor with proper layer assignment
     */
    addArchiveObjectsToEditor(parsedData) {
        // Add objects from each layer
        parsedData.layers.forEach((layer, layerType) => {
            if (layer.objects && !layer.error) {
                layer.objects.forEach(obj => {
                    obj.layer = layerType;
                    obj.layerColor = layer.color;
                    obj.visible = layer.visible;
                    this.pcbEditor.addObject(obj);
                });
            }
        });

        // Add drill objects
        parsedData.drillFiles.forEach(drillFile => {
            if (drillFile.objects && !drillFile.error) {
                drillFile.objects.forEach(obj => {
                    obj.layer = 'drill';
                    obj.layerColor = '#666666';
                    obj.visible = true;
                    this.pcbEditor.addObject(obj);
                });
            }
        });
    }

    /**
     * Update layer panel with archive layers
     */
    updateLayerPanel(layerStack) {
        const layerList = document.querySelector('.layer-list');
        if (!layerList) return;

        // Clear existing layers
        layerList.innerHTML = '';

        // Add layers from archive
        layerStack.forEach(layer => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            if (layer.visible) {
                layerItem.classList.add('active');
            }

            layerItem.innerHTML = `
                <input type="checkbox" ${layer.visible ? 'checked' : ''} 
                       onchange="fileManager.toggleLayer('${layer.layerType}', this.checked)">
                <span class="layer-color" style="background: ${layer.color}"></span>
                <span>${layer.name}</span>
            `;

            layerItem.setAttribute('data-layer', layer.layerType);
            layerList.appendChild(layerItem);
        });
    }

    /**
     * Toggle layer visibility
     */
    toggleLayer(layerType, visible) {
        if (!this.currentFile || !this.currentFile.isArchive) return;

        const layer = this.currentFile.layers.get(layerType);
        if (layer) {
            layer.visible = visible;
            
            // Update objects visibility in PCB editor
            if (layer.objects) {
                layer.objects.forEach(obj => {
                    obj.visible = visible;
                });
            }
            
            this.pcbEditor.render();
        }
    }

    /**
     * Get file extension
     */
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    /**
     * Determine file type from extension and content
     */
    determineFileType(extension, content) {
        // Check by extension first
        switch (extension) {
            case 'gbr':
            case 'ger':
                return 'gerber';
            case 'drl':
            case 'txt': // Sometimes drill files use .txt
                if (content.includes('M48') || content.includes('INCH') || content.includes('METRIC')) {
                    return 'drill';
                }
                return 'gerber'; // Default to gerber for .txt files
            case 'sch':
                return 'schematic';
            case 'kicad_pcb':
                return 'kicad';
            case 'pcbdoc':
                return 'pcbdoc';
        }
        
        // Check by content patterns
        if (content.includes('G04') && content.includes('%')) {
            return 'gerber';
        }
        if (content.includes('M48') || content.includes('T01C')) {
            return 'drill';
        }
        if (content.includes('EESchema') || content.includes('$Comp')) {
            return 'schematic';
        }
        if (content.includes('kicad_pcb')) {
            return 'kicad';
        }
        
        return 'unknown';
    }

    /**
     * Save current file
     */
    saveCurrentFile() {
        if (!this.currentFile) {
            console.warn('No file is currently loaded');
            return;
        }
        
        try {
            let exportedContent;
            
            switch (this.currentFile.type) {
                case 'gerber':
                    exportedContent = this.parsers.gerber.export();
                    break;
                case 'drill':
                    exportedContent = this.parsers.drill.export();
                    break;
                case 'schematic':
                    exportedContent = this.parsers.schematic.export();
                    break;
                case 'kicad':
                    exportedContent = this.parsers.kicad.export();
                    break;
                default:
                    throw new Error(`Cannot export ${this.currentFile.type} files`);
            }
            
            this.downloadFile(this.currentFile.name, exportedContent);
            
        } catch (error) {
            console.error('Error saving file:', error);
            alert(`Error saving file: ${error.message}`);
        }
    }

    /**
     * Save file with new name
     */
    saveAsFile(filename) {
        if (!this.currentFile) {
            console.warn('No file is currently loaded');
            return;
        }
        
        const originalName = this.currentFile.name;
        this.currentFile.name = filename;
        this.saveCurrentFile();
        
        // Update file map
        this.loadedFiles.delete(originalName);
        this.loadedFiles.set(filename, this.currentFile);
        this.updateFileList();
    }

    /**
     * Download file to user's computer
     */
    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Close file
     */
    closeFile(filename) {
        const fileData = this.loadedFiles.get(filename);
        if (!fileData) return;
        
        // Remove objects from PCB editor
        fileData.objects.forEach(obj => {
            this.pcbEditor.removeObject(obj);
        });
        
        this.loadedFiles.delete(filename);
        
        if (this.currentFile && this.currentFile.name === filename) {
            this.currentFile = null;
        }
        
        this.updateFileList();
        this.pcbEditor.render();
    }

    /**
     * Switch to different file
     */
    switchToFile(filename) {
        const fileData = this.loadedFiles.get(filename);
        if (!fileData) return;
        
        this.currentFile = fileData;
        this.updateFilePropertiesPanel();
    }

    /**
     * Get file statistics
     */
    getFileStatistics(filename) {
        const fileData = this.loadedFiles.get(filename);
        if (!fileData) return null;
        
        let stats = {
            name: fileData.name,
            type: fileData.type,
            size: fileData.size,
            objectCount: fileData.objects.length,
            lastModified: new Date(fileData.lastModified).toLocaleString()
        };
        
        // Add type-specific statistics
        switch (fileData.type) {
            case 'gerber':
                stats.apertures = fileData.parsedData.apertures.length;
                stats.layers = fileData.parsedData.layers.length;
                stats.units = fileData.parsedData.units;
                break;
                
            case 'drill':
                stats.holes = fileData.parsedData.holes.length;
                stats.tools = fileData.parsedData.tools.length;
                stats.units = fileData.parsedData.units;
                break;
                
            case 'schematic':
                stats.components = fileData.parsedData.components.length;
                stats.wires = fileData.parsedData.wires.length;
                stats.sheets = fileData.parsedData.sheets.length;
                break;
        }
        
        return stats;
    }

    /**
     * Add file to history
     */
    addToHistory(fileData) {
        const historyEntry = {
            name: fileData.name,
            type: fileData.type,
            timestamp: Date.now()
        };
        
        this.fileHistory.unshift(historyEntry);
        
        // Limit history size
        if (this.fileHistory.length > 20) {
            this.fileHistory = this.fileHistory.slice(0, 20);
        }
        
        this.updateHistoryList();
    }

    /**
     * Update file list in UI
     */
    updateFileList() {
        const fileList = document.getElementById('loaded-files-list');
        if (!fileList) return;
        
        fileList.innerHTML = '';
        
        this.loadedFiles.forEach((fileData, filename) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            if (this.currentFile && this.currentFile.name === filename) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <div class="file-info">
                    <span class="file-name">${filename}</span>
                    <span class="file-type">${fileData.type}</span>
                    <span class="object-count">${fileData.objects.length} objects</span>
                </div>
                <div class="file-actions">
                    <button onclick="fileManager.switchToFile('${filename}')">Select</button>
                    <button onclick="fileManager.showFileStats('${filename}')">Info</button>
                    <button onclick="fileManager.closeFile('${filename}')">Close</button>
                </div>
            `;
            
            fileList.appendChild(item);
        });
    }

    /**
     * Update history list in UI
     */
    updateHistoryList() {
        const historyList = document.getElementById('file-history-list');
        if (!historyList) return;
        
        historyList.innerHTML = '';
        
        this.fileHistory.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <span class="history-name">${entry.name}</span>
                <span class="history-type">${entry.type}</span>
                <span class="history-time">${new Date(entry.timestamp).toLocaleString()}</span>
            `;
            historyList.appendChild(item);
        });
    }

    /**
     * Show file statistics
     */
    showFileStats(filename) {
        const stats = this.getFileStatistics(filename);
        if (!stats) return;
        
        let message = `File: ${stats.name}\n`;
        message += `Type: ${stats.type}\n`;
        message += `Size: ${(stats.size / 1024).toFixed(1)} KB\n`;
        message += `Objects: ${stats.objectCount}\n`;
        message += `Modified: ${stats.lastModified}\n`;
        
        if (stats.apertures !== undefined) {
            message += `Apertures: ${stats.apertures}\n`;
            message += `Layers: ${stats.layers}\n`;
        }
        if (stats.holes !== undefined) {
            message += `Holes: ${stats.holes}\n`;
            message += `Tools: ${stats.tools}\n`;
        }
        if (stats.components !== undefined) {
            message += `Components: ${stats.components}\n`;
            message += `Wires: ${stats.wires}\n`;
            message += `Sheets: ${stats.sheets}\n`;
        }
        if (stats.units) {
            message += `Units: ${stats.units}\n`;
        }
        
        alert(message);
    }

    /**
     * Update file properties panel
     */
    updateFilePropertiesPanel() {
        const panel = document.getElementById('file-properties-panel');
        if (!panel || !this.currentFile) return;
        
        const stats = this.getFileStatistics(this.currentFile.name);
        if (!stats) return;
        
        let html = `
            <div class="property-group">
                <h4>Current File</h4>
                <div class="property-item">
                    <label>Name:</label>
                    <span>${stats.name}</span>
                </div>
                <div class="property-item">
                    <label>Type:</label>
                    <span>${stats.type}</span>
                </div>
                <div class="property-item">
                    <label>Objects:</label>
                    <span>${stats.objectCount}</span>
                </div>
        `;
        
        if (stats.units) {
            html += `
                <div class="property-item">
                    <label>Units:</label>
                    <span>${stats.units}</span>
                </div>
            `;
        }
        
        html += '</div>';
        panel.innerHTML = html;
    }

    /**
     * Export all loaded files as ZIP
     */
    async exportAllFiles() {
        if (this.loadedFiles.size === 0) {
            alert('No files loaded to export');
            return;
        }
        
        // This would require a ZIP library like JSZip
        console.log('Export all files functionality would require JSZip library');
        alert('Export all files feature coming soon!');
    }

    /**
     * Clear all loaded files
     */
    clearAllFiles() {
        if (this.loadedFiles.size === 0) return;
        
        if (confirm('This will close all loaded files. Continue?')) {
            // Remove all objects from PCB editor
            this.loadedFiles.forEach(fileData => {
                fileData.objects.forEach(obj => {
                    this.pcbEditor.removeObject(obj);
                });
            });
            
            this.loadedFiles.clear();
            this.currentFile = null;
            this.updateFileList();
            this.pcbEditor.render();
        }
    }

    /**
     * Get list of loaded files
     */
    getLoadedFiles() {
        return Array.from(this.loadedFiles.keys());
    }

    /**
     * Check if file is loaded
     */
    isFileLoaded(filename) {
        return this.loadedFiles.has(filename);
    }
}

// Export for use in other modules
window.FileManager = FileManager;
