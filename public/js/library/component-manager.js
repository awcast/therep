/**
 * Component Manager - Handles EDA component library management
 * Manages components, footprints, symbols, and their relationships
 */
class ComponentManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.db = authManager.db;
        this.components = [];
        this.footprints = [];
        this.symbols = [];
        this.categories = {
            resistors: 'Resistors',
            capacitors: 'Capacitors',
            inductors: 'Inductors',
            semiconductors: 'Semiconductors',
            connectors: 'Connectors',
            crystals: 'Crystals & Oscillators',
            mechanical: 'Mechanical',
            custom: 'Custom Components'
        };
        this.init();
    }

    async init() {
        await this.createTables();
        await this.loadComponents();
        await this.loadBuiltinComponents();
        console.log('ComponentManager initialized');
    }

    async createTables() {
        if (!this.db.isInitialized) {
            throw new Error('Database not initialized');
        }

        // Components table
        this.db.db.run(`
            CREATE TABLE IF NOT EXISTS components (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                package TEXT,
                value_rating TEXT,
                description TEXT,
                manufacturer TEXT,
                datasheet_url TEXT,
                tags TEXT,
                specifications TEXT,
                footprint_id TEXT,
                symbol_id TEXT,
                user_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                usage_count INTEGER DEFAULT 0,
                is_favorite INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Footprints table
        this.db.db.run(`
            CREATE TABLE IF NOT EXISTS footprints (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                package_type TEXT,
                dimensions TEXT,
                pad_data TEXT,
                courtyard_data TEXT,
                silkscreen_data TEXT,
                user_id TEXT,
                created_at TEXT NOT NULL,
                is_builtin INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Symbols table
        this.db.db.run(`
            CREATE TABLE IF NOT EXISTS symbols (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                symbol_type TEXT,
                pin_data TEXT,
                graphics_data TEXT,
                properties TEXT,
                user_id TEXT,
                created_at TEXT NOT NULL,
                is_builtin INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Component usage tracking
        this.db.db.run(`
            CREATE TABLE IF NOT EXISTS component_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id TEXT NOT NULL,
                user_id TEXT,
                used_at TEXT NOT NULL,
                project_name TEXT,
                FOREIGN KEY (component_id) REFERENCES components (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        console.log('Component tables created');
    }

    generateId() {
        return 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async addComponent(componentData) {
        const userId = this.authManager.currentUser?.id;
        if (!userId) {
            throw new Error('User must be logged in to add components');
        }

        const component = {
            id: this.generateId(),
            name: componentData.name,
            category: componentData.category,
            package: componentData.package || '',
            value_rating: componentData.value || '',
            description: componentData.description || '',
            manufacturer: componentData.manufacturer || '',
            datasheet_url: componentData.datasheet || '',
            tags: Array.isArray(componentData.tags) ? componentData.tags.join(',') : (componentData.tags || ''),
            specifications: JSON.stringify(componentData.specifications || []),
            footprint_id: componentData.footprint_id || '',
            symbol_id: componentData.symbol_id || '',
            user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            usage_count: 0,
            is_favorite: 0
        };

        try {
            const stmt = this.db.db.prepare(`
                INSERT INTO components (
                    id, name, category, package, value_rating, description,
                    manufacturer, datasheet_url, tags, specifications,
                    footprint_id, symbol_id, user_id, created_at, updated_at,
                    usage_count, is_favorite
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run([
                component.id, component.name, component.category, component.package,
                component.value_rating, component.description, component.manufacturer,
                component.datasheet_url, component.tags, component.specifications,
                component.footprint_id, component.symbol_id, component.user_id,
                component.created_at, component.updated_at, component.usage_count,
                component.is_favorite
            ]);
            stmt.free();

            this.db.saveDatabase();
            await this.loadComponents();

            return component;
        } catch (error) {
            console.error('Error adding component:', error);
            throw new Error('Failed to add component: ' + error.message);
        }
    }

    async updateComponent(id, updates) {
        const userId = this.authManager.currentUser?.id;
        if (!userId) {
            throw new Error('User must be logged in to update components');
        }

        // Check if component exists and belongs to user
        const existing = await this.getComponent(id);
        if (!existing || existing.user_id !== userId) {
            throw new Error('Component not found or access denied');
        }

        const updateFields = [];
        const values = [];

        Object.keys(updates).forEach(key => {
            if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
                updateFields.push(`${key} = ?`);
                if (key === 'tags' && Array.isArray(updates[key])) {
                    values.push(updates[key].join(','));
                } else if (key === 'specifications' && typeof updates[key] === 'object') {
                    values.push(JSON.stringify(updates[key]));
                } else {
                    values.push(updates[key]);
                }
            }
        });

        updateFields.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        try {
            const stmt = this.db.db.prepare(`
                UPDATE components SET ${updateFields.join(', ')} WHERE id = ?
            `);
            stmt.run(values);
            stmt.free();

            this.db.saveDatabase();
            await this.loadComponents();

            return await this.getComponent(id);
        } catch (error) {
            console.error('Error updating component:', error);
            throw new Error('Failed to update component: ' + error.message);
        }
    }

    async deleteComponent(id) {
        const userId = this.authManager.currentUser?.id;
        if (!userId) {
            throw new Error('User must be logged in to delete components');
        }

        // Check if component exists and belongs to user
        const existing = await this.getComponent(id);
        if (!existing || existing.user_id !== userId) {
            throw new Error('Component not found or access denied');
        }

        try {
            // Delete usage records
            const deleteUsageStmt = this.db.db.prepare('DELETE FROM component_usage WHERE component_id = ?');
            deleteUsageStmt.run([id]);
            deleteUsageStmt.free();

            // Delete component
            const deleteStmt = this.db.db.prepare('DELETE FROM components WHERE id = ?');
            deleteStmt.run([id]);
            deleteStmt.free();

            this.db.saveDatabase();
            await this.loadComponents();

            return true;
        } catch (error) {
            console.error('Error deleting component:', error);
            throw new Error('Failed to delete component: ' + error.message);
        }
    }

    async getComponent(id) {
        try {
            const stmt = this.db.db.prepare('SELECT * FROM components WHERE id = ?');
            stmt.bind([id]);
            const result = stmt.step() ? stmt.getAsObject() : null;
            stmt.free();

            if (result) {
                // Parse JSON fields
                result.specifications = JSON.parse(result.specifications || '[]');
                result.tags = result.tags ? result.tags.split(',').map(tag => tag.trim()) : [];
            }

            return result;
        } catch (error) {
            console.error('Error getting component:', error);
            return null;
        }
    }

    async loadComponents() {
        try {
            const stmt = this.db.db.prepare('SELECT * FROM components ORDER BY name ASC');
            const components = [];

            while (stmt.step()) {
                const component = stmt.getAsObject();
                // Parse JSON fields
                component.specifications = JSON.parse(component.specifications || '[]');
                component.tags = component.tags ? component.tags.split(',').map(tag => tag.trim()) : [];
                components.push(component);
            }
            stmt.free();

            this.components = components;
            return components;
        } catch (error) {
            console.error('Error loading components:', error);
            this.components = [];
            return [];
        }
    }

    async getComponents() {
        return await this.loadComponents();
    }

    async searchComponents(query, filters = {}) {
        let components = [...this.components];

        // Text search
        if (query) {
            const searchTerm = query.toLowerCase();
            components = components.filter(comp =>
                comp.name.toLowerCase().includes(searchTerm) ||
                comp.description.toLowerCase().includes(searchTerm) ||
                comp.manufacturer.toLowerCase().includes(searchTerm) ||
                comp.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }

        // Category filter
        if (filters.category && filters.category !== 'all') {
            components = components.filter(comp => comp.category === filters.category);
        }

        // Package type filters
        if (filters.packages && filters.packages.length > 0) {
            components = components.filter(comp => {
                const pkg = comp.package.toLowerCase();
                return filters.packages.some(type => {
                    switch (type) {
                        case 'smd':
                            return pkg.includes('smd') || pkg.includes('sot') || pkg.includes('sop') || 
                                   pkg.includes('qfn') || pkg.includes('bga') || pkg.includes('lga');
                        case 'through-hole':
                            return pkg.includes('dip') || pkg.includes('through') || pkg.includes('radial') ||
                                   pkg.includes('axial') || pkg.includes('to-');
                        case 'bga':
                            return pkg.includes('bga');
                        case 'qfn':
                            return pkg.includes('qfn') || pkg.includes('dfn');
                        default:
                            return pkg.includes(type);
                    }
                });
            });
        }

        // Favorites filter
        if (filters.favorites) {
            components = components.filter(comp => comp.is_favorite === 1);
        }

        // Recent filter (last 30 days)
        if (filters.recent) {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            components = components.filter(comp => comp.created_at > thirtyDaysAgo);
        }

        return components;
    }

    async toggleFavorite(id) {
        const component = await this.getComponent(id);
        if (!component) return false;

        const newFavoriteStatus = component.is_favorite === 1 ? 0 : 1;
        await this.updateComponent(id, { is_favorite: newFavoriteStatus });
        return newFavoriteStatus === 1;
    }

    async recordUsage(componentId, projectName = '') {
        const userId = this.authManager.currentUser?.id;
        if (!userId) return;

        try {
            // Record usage
            const usageStmt = this.db.db.prepare(`
                INSERT INTO component_usage (component_id, user_id, used_at, project_name)
                VALUES (?, ?, ?, ?)
            `);
            usageStmt.run([componentId, userId, new Date().toISOString(), projectName]);
            usageStmt.free();

            // Update usage count
            const updateStmt = this.db.db.prepare(`
                UPDATE components SET usage_count = usage_count + 1 WHERE id = ?
            `);
            updateStmt.run([componentId]);
            updateStmt.free();

            this.db.saveDatabase();
        } catch (error) {
            console.error('Error recording component usage:', error);
        }
    }

    getCategoryCounts() {
        const counts = { all: this.components.length };
        
        Object.keys(this.categories).forEach(category => {
            counts[category] = this.components.filter(comp => comp.category === category).length;
        });

        return counts;
    }

    async loadBuiltinComponents() {
        // Add some built-in components for demonstration
        const builtinComponents = [
            {
                name: 'Generic Resistor',
                category: 'resistors',
                package: '0603',
                description: 'Generic surface mount resistor',
                manufacturer: 'Generic',
                tags: ['passive', 'resistor', 'smd'],
                specifications: [
                    { parameter: 'Tolerance', value: '±1%', unit: '' },
                    { parameter: 'Power Rating', value: '0.1', unit: 'W' },
                    { parameter: 'Temperature Coefficient', value: '±100', unit: 'ppm/°C' }
                ]
            },
            {
                name: 'Generic Capacitor',
                category: 'capacitors',
                package: '0603',
                description: 'Generic ceramic capacitor',
                manufacturer: 'Generic',
                tags: ['passive', 'capacitor', 'ceramic', 'smd'],
                specifications: [
                    { parameter: 'Dielectric', value: 'X7R', unit: '' },
                    { parameter: 'Voltage Rating', value: '50', unit: 'V' },
                    { parameter: 'Tolerance', value: '±10%', unit: '' }
                ]
            },
            {
                name: 'STM32F103C8T6',
                category: 'semiconductors',
                package: 'LQFP-48',
                value_rating: '32-bit MCU',
                description: 'ARM Cortex-M3 microcontroller, 64KB Flash, 20KB RAM',
                manufacturer: 'STMicroelectronics',
                datasheet: 'https://www.st.com/resource/en/datasheet/stm32f103c8.pdf',
                tags: ['microcontroller', 'arm', 'cortex-m3', '32-bit'],
                specifications: [
                    { parameter: 'Core', value: 'ARM Cortex-M3', unit: '' },
                    { parameter: 'Flash Memory', value: '64', unit: 'KB' },
                    { parameter: 'RAM', value: '20', unit: 'KB' },
                    { parameter: 'Max Frequency', value: '72', unit: 'MHz' },
                    { parameter: 'Operating Voltage', value: '2.0-3.6', unit: 'V' },
                    { parameter: 'I/O Pins', value: '37', unit: '' }
                ]
            }
        ];

        // Only add if no components exist yet
        if (this.components.length === 0) {
            for (const comp of builtinComponents) {
                try {
                    await this.addComponent(comp);
                } catch (error) {
                    // Ignore errors for builtin components
                    console.warn('Failed to add builtin component:', comp.name, error.message);
                }
            }
        }
    }

    async exportLibrary(format = 'json') {
        const components = this.components.filter(comp => 
            comp.user_id === this.authManager.currentUser?.id
        );

        if (format === 'json') {
            return {
                format: 'ModernPCB Component Library',
                version: '1.0',
                exported_at: new Date().toISOString(),
                user: this.authManager.currentUser?.username,
                components: components
            };
        }

        throw new Error('Unsupported export format');
    }

    async importLibrary(data) {
        if (!data.components || !Array.isArray(data.components)) {
            throw new Error('Invalid library format');
        }

        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        for (const comp of data.components) {
            try {
                // Remove ID to generate new one
                const { id, user_id, created_at, updated_at, ...componentData } = comp;
                await this.addComponent(componentData);
                results.imported++;
            } catch (error) {
                results.errors.push(`${comp.name}: ${error.message}`);
                results.skipped++;
            }
        }

        return results;
    }
}

// Export for use in other modules
window.ComponentManager = ComponentManager;
