/**
 * Bill of Materials (BOM) Generator for PCB designs
 */

class BOMGenerator {
    constructor(pcbEditor) {
        this.pcbEditor = pcbEditor;
        this.bomData = [];
        this.settings = {
            includeNonElectrical: false,
            groupByValue: true,
            groupByPackage: true,
            includePosition: true,
            includeDNP: false, // Do Not Populate
            sortBy: 'reference', // 'reference', 'value', 'package'
            format: 'csv' // 'csv', 'json', 'xlsx', 'txt'
        };
    }

    /**
     * Generate BOM from PCB components
     */
    generateBOM() {
        this.bomData = [];
        const components = this.getComponents();
        
        if (this.settings.groupByValue && this.settings.groupByPackage) {
            this.bomData = this.groupComponentsByValueAndPackage(components);
        } else if (this.settings.groupByValue) {
            this.bomData = this.groupComponentsByValue(components);
        } else {
            this.bomData = this.createIndividualEntries(components);
        }
        
        this.sortBOM();
        return this.bomData;
    }

    /**
     * Get all components from PCB
     */
    getComponents() {
        return this.pcbEditor.objects.filter(obj => 
            obj.type === 'component' && 
            (this.settings.includeDNP || !obj.getProperty('dnp', false))
        );
    }

    /**
     * Group components by value and package
     */
    groupComponentsByValueAndPackage(components) {
        const groups = new Map();
        
        components.forEach(component => {
            const value = component.getProperty('value', 'N/A');
            const package_ = component.getProperty('package', 'N/A');
            const partNumber = component.getProperty('partNumber', '');
            const manufacturer = component.getProperty('manufacturer', '');
            const description = component.getProperty('description', '');
            
            const key = `${value}_${package_}_${partNumber}`;
            
            if (!groups.has(key)) {
                groups.set(key, {
                    item: groups.size + 1,
                    quantity: 0,
                    references: [],
                    value: value,
                    package: package_,
                    partNumber: partNumber,
                    manufacturer: manufacturer,
                    description: description,
                    cost: component.getProperty('cost', 0),
                    supplier: component.getProperty('supplier', ''),
                    supplierPN: component.getProperty('supplierPN', ''),
                    datasheet: component.getProperty('datasheet', ''),
                    category: this.getComponentCategory(component),
                    positions: []
                });
            }
            
            const group = groups.get(key);
            group.quantity++;
            group.references.push(component.getProperty('reference', `U${group.quantity}`));
            
            if (this.settings.includePosition) {
                group.positions.push({
                    reference: component.getProperty('reference', `U${group.quantity}`),
                    x: component.position.x,
                    y: component.position.y,
                    rotation: component.rotation,
                    layer: component.layer
                });
            }
        });
        
        return Array.from(groups.values());
    }

    /**
     * Group components by value only
     */
    groupComponentsByValue(components) {
        const groups = new Map();
        
        components.forEach(component => {
            const value = component.getProperty('value', 'N/A');
            
            if (!groups.has(value)) {
                groups.set(value, {
                    item: groups.size + 1,
                    quantity: 0,
                    references: [],
                    value: value,
                    packages: new Set(),
                    partNumbers: new Set(),
                    manufacturers: new Set(),
                    descriptions: new Set(),
                    category: this.getComponentCategory(component)
                });
            }
            
            const group = groups.get(value);
            group.quantity++;
            group.references.push(component.getProperty('reference', `U${group.quantity}`));
            group.packages.add(component.getProperty('package', 'N/A'));
            group.partNumbers.add(component.getProperty('partNumber', ''));
            group.manufacturers.add(component.getProperty('manufacturer', ''));
            group.descriptions.add(component.getProperty('description', ''));
        });
        
        // Convert sets to strings
        return Array.from(groups.values()).map(group => ({
            ...group,
            packages: Array.from(group.packages).join(', '),
            partNumbers: Array.from(group.partNumbers).filter(pn => pn).join(', '),
            manufacturers: Array.from(group.manufacturers).filter(m => m).join(', '),
            descriptions: Array.from(group.descriptions).filter(d => d).join(', ')
        }));
    }

    /**
     * Create individual entries for each component
     */
    createIndividualEntries(components) {
        return components.map((component, index) => ({
            item: index + 1,
            quantity: 1,
            reference: component.getProperty('reference', `U${index + 1}`),
            value: component.getProperty('value', 'N/A'),
            package: component.getProperty('package', 'N/A'),
            partNumber: component.getProperty('partNumber', ''),
            manufacturer: component.getProperty('manufacturer', ''),
            description: component.getProperty('description', ''),
            cost: component.getProperty('cost', 0),
            supplier: component.getProperty('supplier', ''),
            supplierPN: component.getProperty('supplierPN', ''),
            datasheet: component.getProperty('datasheet', ''),
            category: this.getComponentCategory(component),
            position: this.settings.includePosition ? {
                x: component.position.x,
                y: component.position.y,
                rotation: component.rotation,
                layer: component.layer
            } : null
        }));
    }

    /**
     * Sort BOM entries
     */
    sortBOM() {
        this.bomData.sort((a, b) => {
            switch (this.settings.sortBy) {
                case 'reference':
                    return this.naturalSort(a.references ? a.references[0] : a.reference, 
                                          b.references ? b.references[0] : b.reference);
                case 'value':
                    return a.value.localeCompare(b.value);
                case 'package':
                    return a.package.localeCompare(b.package);
                default:
                    return a.item - b.item;
            }
        });
    }

    /**
     * Natural sort for reference designators (R1, R2, R10, R20, etc.)
     */
    naturalSort(a, b) {
        const ax = [], bx = [];
        
        a.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { ax.push([$1 || '', $2 || '']) });
        b.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { bx.push([$1 || '', $2 || '']) });
        
        while (ax.length && bx.length) {
            const an = ax.shift();
            const bn = bx.shift();
            const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
            if (nn) return nn;
        }
        
        return ax.length - bx.length;
    }

    /**
     * Get component category based on reference or properties
     */
    getComponentCategory(component) {
        const reference = component.getProperty('reference', '');
        const value = component.getProperty('value', '').toLowerCase();
        const package_ = component.getProperty('package', '').toLowerCase();
        
        // Categorize by reference prefix
        if (reference.match(/^R\d+/i)) return 'Resistors';
        if (reference.match(/^C\d+/i)) return 'Capacitors';
        if (reference.match(/^L\d+/i)) return 'Inductors';
        if (reference.match(/^D\d+/i)) return 'Diodes';
        if (reference.match(/^Q\d+/i)) return 'Transistors';
        if (reference.match(/^U\d+/i)) return 'Integrated Circuits';
        if (reference.match(/^J\d+/i)) return 'Connectors';
        if (reference.match(/^SW\d+/i)) return 'Switches';
        if (reference.match(/^LED\d+/i)) return 'LEDs';
        if (reference.match(/^X\d+/i)) return 'Crystals/Oscillators';
        if (reference.match(/^F\d+/i)) return 'Fuses';
        if (reference.match(/^T\d+/i)) return 'Transformers';
        
        // Categorize by value or package
        if (value.includes('ohm') || value.includes('Ω')) return 'Resistors';
        if (value.includes('f') || value.includes('farad')) return 'Capacitors';
        if (value.includes('h') || value.includes('henry')) return 'Inductors';
        
        return 'Other';
    }

    /**
     * Export BOM to CSV format
     */
    exportToCSV() {
        if (this.bomData.length === 0) {
            this.generateBOM();
        }
        
        const headers = this.getCSVHeaders();
        let csv = headers.join(',') + '\n';
        
        this.bomData.forEach(item => {
            const row = headers.map(header => {
                let value = this.getItemValue(item, header);
                // Escape commas and quotes in CSV
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csv += row.join(',') + '\n';
        });
        
        return csv;
    }

    /**
     * Export BOM to JSON format
     */
    exportToJSON() {
        if (this.bomData.length === 0) {
            this.generateBOM();
        }
        
        return JSON.stringify({
            metadata: {
                generated: new Date().toISOString(),
                tool: 'ModernPCB Editor',
                settings: this.settings,
                totalItems: this.bomData.length,
                totalComponents: this.bomData.reduce((sum, item) => sum + item.quantity, 0)
            },
            components: this.bomData
        }, null, 2);
    }

    /**
     * Export BOM to plain text format
     */
    exportToTXT() {
        if (this.bomData.length === 0) {
            this.generateBOM();
        }
        
        let txt = 'Bill of Materials\n';
        txt += '=================\n\n';
        txt += `Generated: ${new Date().toLocaleString()}\n`;
        txt += `Total Items: ${this.bomData.length}\n`;
        txt += `Total Components: ${this.bomData.reduce((sum, item) => sum + item.quantity, 0)}\n\n`;
        
        this.bomData.forEach((item, index) => {
            txt += `Item ${index + 1}:\n`;
            txt += `  Quantity: ${item.quantity}\n`;
            txt += `  References: ${item.references ? item.references.join(', ') : item.reference}\n`;
            txt += `  Value: ${item.value}\n`;
            txt += `  Package: ${item.package}\n`;
            if (item.partNumber) txt += `  Part Number: ${item.partNumber}\n`;
            if (item.manufacturer) txt += `  Manufacturer: ${item.manufacturer}\n`;
            if (item.description) txt += `  Description: ${item.description}\n`;
            if (item.category) txt += `  Category: ${item.category}\n`;
            txt += '\n';
        });
        
        return txt;
    }

    /**
     * Get CSV headers based on current data
     */
    getCSVHeaders() {
        const baseHeaders = ['Item', 'Qty', 'References', 'Value', 'Package'];
        const optionalHeaders = [];
        
        if (this.bomData.some(item => item.partNumber)) optionalHeaders.push('Part Number');
        if (this.bomData.some(item => item.manufacturer)) optionalHeaders.push('Manufacturer');
        if (this.bomData.some(item => item.description)) optionalHeaders.push('Description');
        if (this.bomData.some(item => item.category)) optionalHeaders.push('Category');
        if (this.bomData.some(item => item.cost > 0)) optionalHeaders.push('Cost');
        if (this.bomData.some(item => item.supplier)) optionalHeaders.push('Supplier');
        if (this.bomData.some(item => item.supplierPN)) optionalHeaders.push('Supplier PN');
        if (this.bomData.some(item => item.datasheet)) optionalHeaders.push('Datasheet');
        
        return [...baseHeaders, ...optionalHeaders];
    }

    /**
     * Get item value for CSV export
     */
    getItemValue(item, header) {
        switch (header) {
            case 'Item': return item.item;
            case 'Qty': return item.quantity;
            case 'References': return item.references ? item.references.join(', ') : item.reference;
            case 'Value': return item.value;
            case 'Package': return item.package;
            case 'Part Number': return item.partNumber || '';
            case 'Manufacturer': return item.manufacturer || '';
            case 'Description': return item.description || '';
            case 'Category': return item.category || '';
            case 'Cost': return item.cost || '';
            case 'Supplier': return item.supplier || '';
            case 'Supplier PN': return item.supplierPN || '';
            case 'Datasheet': return item.datasheet || '';
            default: return '';
        }
    }

    /**
     * Calculate total BOM cost
     */
    calculateTotalCost() {
        return this.bomData.reduce((total, item) => {
            const cost = parseFloat(item.cost) || 0;
            return total + (cost * item.quantity);
        }, 0);
    }

    /**
     * Get BOM statistics
     */
    getBOMStatistics() {
        const stats = {
            totalItems: this.bomData.length,
            totalComponents: this.bomData.reduce((sum, item) => sum + item.quantity, 0),
            totalCost: this.calculateTotalCost(),
            categories: {}
        };
        
        this.bomData.forEach(item => {
            const category = item.category || 'Other';
            if (!stats.categories[category]) {
                stats.categories[category] = { count: 0, components: 0, cost: 0 };
            }
            stats.categories[category].count++;
            stats.categories[category].components += item.quantity;
            stats.categories[category].cost += (parseFloat(item.cost) || 0) * item.quantity;
        });
        
        return stats;
    }

    /**
     * Update BOM settings
     */
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
    }

    /**
     * Download BOM file
     */
    downloadBOM(format = null) {
        const useFormat = format || this.settings.format;
        let content, filename, mimeType;
        
        switch (useFormat) {
            case 'csv':
                content = this.exportToCSV();
                filename = 'bom.csv';
                mimeType = 'text/csv';
                break;
            case 'json':
                content = this.exportToJSON();
                filename = 'bom.json';
                mimeType = 'application/json';
                break;
            case 'txt':
                content = this.exportToTXT();
                filename = 'bom.txt';
                mimeType = 'text/plain';
                break;
            default:
                throw new Error(`Unsupported format: ${useFormat}`);
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Export for use in other modules
window.BOMGenerator = BOMGenerator;
