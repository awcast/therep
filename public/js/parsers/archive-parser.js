/**
 * Archive parser for PCB manufacturing packages
 * Handles ZIP files containing multiple Gerber layers, drill files, and other manufacturing data
 */

class ArchiveParser {
    constructor() {
        this.layers = new Map();
        this.drillFiles = [];
        this.pickAndPlaceFiles = [];
        this.bomFiles = [];
        this.documentationFiles = [];
        this.supportedExtensions = new Set([
            'gbr', 'ger', 'gt', 'gb', 'g1', 'g2', 'g3', 'g4', 'gto', 'gbo', 'gts', 'gbs',
            'drl', 'txt', 'xln', 'tap', 'nc', 'cnc',
            'csv', 'tsv', 'pos', 'cpl', 'pnp',
            'pdf', 'txt', 'md', 'readme'
        ]);
        
        // Common layer naming patterns
        this.layerPatterns = {
            // Copper layers
            'top-copper': /\.(gt[ls]?|copper_top|f_cu|top)$/i,
            'bottom-copper': /\.(gb[ls]?|copper_bottom|b_cu|bottom)$/i,
            'inner1-copper': /\.(g1|inner1|in1_cu)$/i,
            'inner2-copper': /\.(g2|inner2|in2_cu)$/i,
            'inner3-copper': /\.(g3|inner3|in3_cu)$/i,
            'inner4-copper': /\.(g4|inner4|in4_cu)$/i,
            
            // Solder mask
            'top-soldermask': /\.(gts|soldermask_top|f_mask|topsoldermask)$/i,
            'bottom-soldermask': /\.(gbs|soldermask_bottom|b_mask|bottomsoldermask)$/i,
            
            // Silkscreen
            'top-silkscreen': /\.(gto|silkscreen_top|f_silks?|topsilk)$/i,
            'bottom-silkscreen': /\.(gbo|silkscreen_bottom|b_silks?|bottomsilk)$/i,
            
            // Paste mask
            'top-paste': /\.(gtp|paste_top|f_paste|toppaste)$/i,
            'bottom-paste': /\.(gbp|paste_bottom|b_paste|bottompaste)$/i,
            
            // Mechanical/outline
            'outline': /\.(gko|outline|edge_cuts|boardoutline|mechanical)$/i,
            'keepout': /\.(gkl|keepout|courtyard)$/i
        };
        
        this.drillPatterns = /\.(drl|txt|xln|tap|nc|cnc|drill)$/i;
        this.pickPlacePatterns = /\.(csv|tsv|pos|cpl|pnp|pick.*place|placement)$/i;
        this.bomPatterns = /\.(csv|tsv|xlsx?|bom|bill.*material)$/i;
        this.docPatterns = /\.(pdf|txt|md|readme|doc|report)$/i;
    }

    /**
     * Parse archive file (ZIP)
     */
    async parseArchive(arrayBuffer) {
        try {
            // Check if JSZip is available
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip library not loaded. Please include JSZip to handle ZIP files.');
            }
            
            // Use JSZip library to extract archive
            const zip = await JSZip.loadAsync(arrayBuffer);
            const files = [];
            
            // Extract all files
            for (const [filename, file] of Object.entries(zip.files)) {
                if (!file.dir) {
                    const content = await file.async('arraybuffer');
                    files.push({
                        name: filename,
                        content: content,
                        textContent: null
                    });
                }
            }
            
            // Categorize files
            const categorizedFiles = this.categorizeFiles(files);
            
            // Parse each category
            const parsedArchive = {
                layers: await this.parseLayers(categorizedFiles.layers),
                drillFiles: await this.parseDrillFiles(categorizedFiles.drillFiles),
                pickAndPlaceFiles: await this.parsePickAndPlaceFiles(categorizedFiles.pickAndPlaceFiles),
                bomFiles: await this.parseBOMFiles(categorizedFiles.bomFiles),
                documentationFiles: categorizedFiles.documentationFiles,
                metadata: this.extractMetadata(files),
                layerStack: this.generateLayerStack(categorizedFiles.layers)
            };
            
            return parsedArchive;
            
        } catch (error) {
            throw new Error(`Failed to parse archive: ${error.message}`);
        }
    }

    /**
     * Categorize files by type
     */
    categorizeFiles(files) {
        const categories = {
            layers: [],
            drillFiles: [],
            pickAndPlaceFiles: [],
            bomFiles: [],
            documentationFiles: []
        };
        
        files.forEach(file => {
            const filename = file.name.toLowerCase();
            const basename = filename.split('/').pop(); // Remove path
            
            // Check for layer files
            let isLayer = false;
            for (const [layerType, pattern] of Object.entries(this.layerPatterns)) {
                if (pattern.test(basename)) {
                    categories.layers.push({
                        ...file,
                        layerType: layerType,
                        detectedType: 'gerber'
                    });
                    isLayer = true;
                    break;
                }
            }
            
            if (!isLayer) {
                // Check other file types
                if (this.drillPatterns.test(basename)) {
                    categories.drillFiles.push({
                        ...file,
                        detectedType: 'drill'
                    });
                } else if (this.pickPlacePatterns.test(basename)) {
                    categories.pickAndPlaceFiles.push({
                        ...file,
                        detectedType: 'pick-place'
                    });
                } else if (this.bomPatterns.test(basename)) {
                    categories.bomFiles.push({
                        ...file,
                        detectedType: 'bom'
                    });
                } else if (this.docPatterns.test(basename)) {
                    categories.documentationFiles.push({
                        ...file,
                        detectedType: 'documentation'
                    });
                }
            }
        });
        
        return categories;
    }

    /**
     * Parse layer files (Gerber)
     */
    async parseLayers(layerFiles) {
        const layers = new Map();
        const gerberParser = new GerberParser();
        
        for (const file of layerFiles) {
            try {
                // Convert ArrayBuffer to text for Gerber parsing
                const textContent = new TextDecoder().decode(file.content);
                const parsedData = gerberParser.parse(textContent);
                
                layers.set(file.layerType, {
                    filename: file.name,
                    layerType: file.layerType,
                    parsedData: parsedData,
                    objects: gerberParser.toPCBObjects(),
                    visible: true,
                    color: this.getLayerColor(file.layerType),
                    originalContent: textContent
                });
                
            } catch (error) {
                console.warn(`Failed to parse layer ${file.name}:`, error);
                // Add as failed layer but keep it in the list
                layers.set(file.layerType, {
                    filename: file.name,
                    layerType: file.layerType,
                    error: error.message,
                    visible: false
                });
            }
        }
        
        return layers;
    }

    /**
     * Parse drill files
     */
    async parseDrillFiles(drillFiles) {
        const parsedDrillFiles = [];
        const drillParser = new DrillParser();
        
        for (const file of drillFiles) {
            try {
                const textContent = new TextDecoder().decode(file.content);
                const parsedData = drillParser.parse(textContent);
                
                parsedDrillFiles.push({
                    filename: file.name,
                    parsedData: parsedData,
                    objects: drillParser.toPCBObjects(),
                    statistics: drillParser.getStatistics(),
                    originalContent: textContent
                });
                
            } catch (error) {
                console.warn(`Failed to parse drill file ${file.name}:`, error);
                parsedDrillFiles.push({
                    filename: file.name,
                    error: error.message
                });
            }
        }
        
        return parsedDrillFiles;
    }

    /**
     * Parse pick and place files
     */
    async parsePickAndPlaceFiles(pickPlaceFiles) {
        const parsedFiles = [];
        
        for (const file of pickPlaceFiles) {
            try {
                const textContent = new TextDecoder().decode(file.content);
                const parsedData = this.parseCSVLikeFile(textContent, file.name);
                
                parsedFiles.push({
                    filename: file.name,
                    data: parsedData,
                    componentCount: parsedData.length,
                    originalContent: textContent
                });
                
            } catch (error) {
                console.warn(`Failed to parse pick and place file ${file.name}:`, error);
                parsedFiles.push({
                    filename: file.name,
                    error: error.message
                });
            }
        }
        
        return parsedFiles;
    }

    /**
     * Parse BOM files
     */
    async parseBOMFiles(bomFiles) {
        const parsedFiles = [];
        
        for (const file of bomFiles) {
            try {
                const textContent = new TextDecoder().decode(file.content);
                const parsedData = this.parseCSVLikeFile(textContent, file.name);
                
                parsedFiles.push({
                    filename: file.name,
                    data: parsedData,
                    componentCount: parsedData.length,
                    originalContent: textContent
                });
                
            } catch (error) {
                console.warn(`Failed to parse BOM file ${file.name}:`, error);
                parsedFiles.push({
                    filename: file.name,
                    error: error.message
                });
            }
        }
        
        return parsedFiles;
    }

    /**
     * Parse CSV-like files (BOM, Pick & Place)
     */
    parseCSVLikeFile(content, filename) {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length === 0) return [];
        
        // Detect delimiter
        const delimiter = this.detectDelimiter(lines[0]);
        
        // Parse header
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
        
        // Parse data rows
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const row = {};
            const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            data.push(row);
        }
        
        return data;
    }

    /**
     * Detect CSV delimiter
     */
    detectDelimiter(line) {
        const delimiters = [',', '\t', ';', '|'];
        let maxCount = 0;
        let bestDelimiter = ',';
        
        delimiters.forEach(delimiter => {
            const count = (line.match(new RegExp(delimiter, 'g')) || []).length;
            if (count > maxCount) {
                maxCount = count;
                bestDelimiter = delimiter;
            }
        });
        
        return bestDelimiter;
    }

    /**
     * Extract metadata from archive
     */
    extractMetadata(files) {
        const metadata = {
            totalFiles: files.length,
            archiveSize: files.reduce((sum, file) => sum + file.content.byteLength, 0),
            fileTypes: new Map(),
            createdDate: new Date(),
            detectedCADTool: 'Unknown'
        };
        
        // Count file types
        files.forEach(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            metadata.fileTypes.set(ext, (metadata.fileTypes.get(ext) || 0) + 1);
        });
        
        // Try to detect CAD tool from file patterns
        const filenames = files.map(f => f.name.toLowerCase()).join(' ');
        if (filenames.includes('kicad') || filenames.includes('_cu')) {
            metadata.detectedCADTool = 'KiCad';
        } else if (filenames.includes('altium') || filenames.includes('.gbr')) {
            metadata.detectedCADTool = 'Altium Designer';
        } else if (filenames.includes('eagle')) {
            metadata.detectedCADTool = 'Eagle';
        }
        
        return metadata;
    }

    /**
     * Generate layer stack information
     */
    generateLayerStack(layerFiles) {
        const layerOrder = [
            'top-paste',
            'top-silkscreen', 
            'top-soldermask',
            'top-copper',
            'inner1-copper',
            'inner2-copper',
            'inner3-copper',
            'inner4-copper',
            'bottom-copper',
            'bottom-soldermask',
            'bottom-silkscreen',
            'bottom-paste',
            'outline',
            'keepout'
        ];
        
        const detectedLayers = layerFiles.map(f => f.layerType);
        const stackup = [];
        
        layerOrder.forEach(layerType => {
            if (detectedLayers.includes(layerType)) {
                stackup.push({
                    layerType: layerType,
                    name: this.getLayerDisplayName(layerType),
                    color: this.getLayerColor(layerType),
                    visible: true
                });
            }
        });
        
        return stackup;
    }

    /**
     * Get display name for layer type
     */
    getLayerDisplayName(layerType) {
        const names = {
            'top-copper': 'Top Copper',
            'bottom-copper': 'Bottom Copper',
            'inner1-copper': 'Inner 1',
            'inner2-copper': 'Inner 2',
            'inner3-copper': 'Inner 3',
            'inner4-copper': 'Inner 4',
            'top-soldermask': 'Top Solder Mask',
            'bottom-soldermask': 'Bottom Solder Mask',
            'top-silkscreen': 'Top Silkscreen',
            'bottom-silkscreen': 'Bottom Silkscreen',
            'top-paste': 'Top Paste Mask',
            'bottom-paste': 'Bottom Paste Mask',
            'outline': 'Board Outline',
            'keepout': 'Keepout Area'
        };
        
        return names[layerType] || layerType;
    }

    /**
     * Get color for layer type
     */
    getLayerColor(layerType) {
        const colors = {
            'top-copper': '#cc0000',
            'bottom-copper': '#0066cc',
            'inner1-copper': '#660066',
            'inner2-copper': '#006600',
            'inner3-copper': '#666600',
            'inner4-copper': '#006666',
            'top-soldermask': '#008800',
            'bottom-soldermask': '#004400',
            'top-silkscreen': '#ffffff',
            'bottom-silkscreen': '#ffff00',
            'top-paste': '#808080',
            'bottom-paste': '#404040',
            'outline': '#ff00ff',
            'keepout': '#ff8000'
        };
        
        return colors[layerType] || '#888888';
    }

    /**
     * Convert archive to PCB objects
     */
    toPCBObjects() {
        const objects = [];
        
        // Add objects from all layers
        this.layers.forEach(layer => {
            if (layer.objects && !layer.error) {
                objects.push(...layer.objects);
            }
        });
        
        // Add drill objects
        this.drillFiles.forEach(drillFile => {
            if (drillFile.objects && !drillFile.error) {
                objects.push(...drillFile.objects);
            }
        });
        
        return objects;
    }

    /**
     * Get archive statistics
     */
    getStatistics() {
        const stats = {
            totalLayers: this.layers.size,
            copperLayers: 0,
            drillFiles: this.drillFiles.length,
            totalObjects: 0,
            componentCount: 0,
            bomEntries: 0
        };
        
        this.layers.forEach(layer => {
            if (layer.layerType.includes('copper')) {
                stats.copperLayers++;
            }
            if (layer.objects) {
                stats.totalObjects += layer.objects.length;
            }
        });
        
        this.drillFiles.forEach(drillFile => {
            if (drillFile.objects) {
                stats.totalObjects += drillFile.objects.length;
            }
        });
        
        this.pickAndPlaceFiles.forEach(file => {
            if (file.data) {
                stats.componentCount += file.data.length;
            }
        });
        
        this.bomFiles.forEach(file => {
            if (file.data) {
                stats.bomEntries += file.data.length;
            }
        });
        
        return stats;
    }

    /**
     * Export archive data back to ZIP format
     */
    async exportArchive() {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded. Cannot export archive.');
        }
        
        const zip = new JSZip();
        
        // Add layer files
        this.layers.forEach(layer => {
            if (layer.originalContent && !layer.error) {
                zip.file(layer.filename, layer.originalContent);
            }
        });
        
        // Add drill files
        this.drillFiles.forEach(drillFile => {
            if (drillFile.originalContent && !drillFile.error) {
                zip.file(drillFile.filename, drillFile.originalContent);
            }
        });
        
        // Add other files
        this.pickAndPlaceFiles.forEach(file => {
            if (file.originalContent && !file.error) {
                zip.file(file.filename, file.originalContent);
            }
        });
        
        this.bomFiles.forEach(file => {
            if (file.originalContent && !file.error) {
                zip.file(file.filename, file.originalContent);
            }
        });
        
        this.documentationFiles.forEach(file => {
            if (file.content) {
                zip.file(file.name, file.content);
            }
        });
        
        return await zip.generateAsync({ type: 'arraybuffer' });
    }
}

// Export for use in other modules
window.ArchiveParser = ArchiveParser;
