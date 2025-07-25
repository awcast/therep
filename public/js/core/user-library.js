/**
 * User Library Manager
 * Handles user PCB uploads and library management using SQLite
 */

class UserLibrary {
    constructor(authManager) {
        this.authManager = authManager;
        this.db = authManager ? authManager.db : null;
        this.isInitialized = false;
        
        if (this.authManager) {
            this.initialize();
        }
    }

    /**
     * Initialize the user library
     */
    async initialize() {
        try {
            // Wait for auth manager to be initialized
            if (this.authManager && !this.authManager.isInitialized) {
                await new Promise(resolve => {
                    const checkInit = () => {
                        if (this.authManager.isInitialized) {
                            resolve();
                        } else {
                            setTimeout(checkInit, 100);
                        }
                    };
                    checkInit();
                });
            }
            
            this.db = this.authManager.db;
            this.isInitialized = true;
            console.log('UserLibrary initialized successfully');
        } catch (error) {
            console.error('Failed to initialize UserLibrary:', error);
            throw error;
        }
    }

    /**
     * Get current user from auth manager
     */
    getCurrentUser() {
        if (!this.authManager || !this.authManager.isAuthenticated) {
            return null;
        }
        return this.authManager.currentUser;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.authManager && this.authManager.isAuthenticated;
    }

    /**
     * Add PCB to current user's library
     */
    addPCBToLibrary(pcbData, filename, description = '') {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        if (!this.isInitialized) {
            throw new Error('UserLibrary not initialized');
        }

        const currentUser = this.getCurrentUser();
        const pcbId = this.generateId();
        
        // Prepare data for database
        const thumbnail = JSON.stringify(this.generateThumbnail(pcbData));
        const tags = JSON.stringify(this.extractTags(pcbData));
        const stats = JSON.stringify(this.calculateStats(pcbData));
        const data = JSON.stringify(pcbData);

        // Insert PCB into database
        const result = this.db.execute(`
            INSERT INTO pcbs (pcb_id, user_id, filename, original_filename, description, source, data, thumbnail, tags, stats)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            pcbId,
            currentUser.id,
            filename,
            filename,
            description,
            pcbData.source || 'unknown',
            data,
            thumbnail,
            tags,
            stats
        ]);

        // Update user library last accessed
        this.db.execute(`
            UPDATE user_libraries 
            SET last_accessed = datetime("now") 
            WHERE user_id = ?
        `, [currentUser.id]);

        return {
            id: pcbId,
            filename: filename,
            originalFilename: filename,
            description: description,
            source: pcbData.source || 'unknown',
            uploadDate: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            data: pcbData,
            thumbnail: JSON.parse(thumbnail),
            tags: JSON.parse(tags),
            stats: JSON.parse(stats)
        };
    }

    /**
     * Remove PCB from user's library
     */
    removePCBFromLibrary(pcbId) {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        if (!this.isInitialized) {
            throw new Error('UserLibrary not initialized');
        }

        const currentUser = this.getCurrentUser();

        // Check if PCB exists and belongs to current user
        const pcb = this.db.get(`
            SELECT id FROM pcbs 
            WHERE pcb_id = ? AND user_id = ?
        `, [pcbId, currentUser.id]);

        if (!pcb) {
            throw new Error('PCB not found in library');
        }

        // Delete PCB from database
        const result = this.db.execute(`
            DELETE FROM pcbs 
            WHERE pcb_id = ? AND user_id = ?
        `, [pcbId, currentUser.id]);

        return result.changes > 0;
    }

    /**
     * Get current user's PCB library
     */
    getUserLibrary(userId = null) {
        if (!this.isInitialized) {
            return null;
        }

        const targetUserId = userId || (this.isAuthenticated() ? this.getCurrentUser().id : null);
        
        if (!targetUserId) {
            return null;
        }

        // Get user library info
        const library = this.db.get(`
            SELECT * FROM user_libraries 
            WHERE user_id = ?
        `, [targetUserId]);

        if (!library) {
            return null;
        }

        // Get PCBs for this user
        const pcbs = this.db.all(`
            SELECT * FROM pcbs 
            WHERE user_id = ? 
            ORDER BY upload_date DESC
        `, [targetUserId]);

        return {
            username: library.username,
            displayName: library.display_name,
            created: library.created_at,
            lastAccessed: library.last_accessed,
            pcbs: pcbs.map(pcb => ({
                id: pcb.pcb_id,
                filename: pcb.filename,
                originalFilename: pcb.original_filename,
                description: pcb.description,
                source: pcb.source,
                uploadDate: pcb.upload_date,
                lastModified: pcb.last_modified,
                data: JSON.parse(pcb.data),
                thumbnail: JSON.parse(pcb.thumbnail || '{}'),
                tags: JSON.parse(pcb.tags || '[]'),
                stats: JSON.parse(pcb.stats || '{}')
            }))
        };
    }

    /**
     * Get all users
     */
    getAllUsers() {
        if (!this.isInitialized) {
            return [];
        }

        const libraries = this.db.all(`
            SELECT ul.*, COUNT(p.id) as pcb_count
            FROM user_libraries ul
            LEFT JOIN pcbs p ON ul.user_id = p.user_id
            GROUP BY ul.user_id
            ORDER BY ul.created_at DESC
        `);

        return libraries.map(lib => ({
            username: lib.username,
            displayName: lib.display_name,
            pcbCount: lib.pcb_count || 0,
            created: lib.created_at,
            lastAccessed: lib.last_accessed
        }));
    }

    /**
     * Search PCBs in current user's library
     */
    searchPCBs(query) {
        if (!this.isAuthenticated() || !this.isInitialized) {
            return [];
        }

        const currentUser = this.getCurrentUser();
        const searchTerm = `%${query.toLowerCase()}%`;

        const pcbs = this.db.all(`
            SELECT * FROM pcbs 
            WHERE user_id = ? 
            AND (
                LOWER(filename) LIKE ? OR 
                LOWER(description) LIKE ? OR 
                LOWER(source) LIKE ? OR
                LOWER(tags) LIKE ?
            )
            ORDER BY last_modified DESC
        `, [currentUser.id, searchTerm, searchTerm, searchTerm, searchTerm]);

        return pcbs.map(pcb => ({
            id: pcb.pcb_id,
            filename: pcb.filename,
            originalFilename: pcb.original_filename,
            description: pcb.description,
            source: pcb.source,
            uploadDate: pcb.upload_date,
            lastModified: pcb.last_modified,
            data: JSON.parse(pcb.data),
            thumbnail: JSON.parse(pcb.thumbnail || '{}'),
            tags: JSON.parse(pcb.tags || '[]'),
            stats: JSON.parse(pcb.stats || '{}')
        }));
    }

    /**
     * Get PCB by ID
     */
    getPCBById(pcbId) {
        if (!this.isAuthenticated() || !this.isInitialized) {
            return null;
        }

        const currentUser = this.getCurrentUser();

        const pcb = this.db.get(`
            SELECT * FROM pcbs 
            WHERE pcb_id = ? AND user_id = ?
        `, [pcbId, currentUser.id]);

        if (!pcb) {
            return null;
        }

        return {
            id: pcb.pcb_id,
            filename: pcb.filename,
            originalFilename: pcb.original_filename,
            description: pcb.description,
            source: pcb.source,
            uploadDate: pcb.upload_date,
            lastModified: pcb.last_modified,
            data: JSON.parse(pcb.data),
            thumbnail: JSON.parse(pcb.thumbnail || '{}'),
            tags: JSON.parse(pcb.tags || '[]'),
            stats: JSON.parse(pcb.stats || '{}')
        };
    }

    /**
     * Update PCB metadata
     */
    updatePCBMetadata(pcbId, updates) {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        if (!this.isInitialized) {
            throw new Error('UserLibrary not initialized');
        }

        const currentUser = this.getCurrentUser();

        // Check if PCB exists and belongs to current user
        const pcb = this.db.get(`
            SELECT * FROM pcbs 
            WHERE pcb_id = ? AND user_id = ?
        `, [pcbId, currentUser.id]);

        if (!pcb) {
            throw new Error('PCB not found');
        }

        // Update allowed fields
        const updateFields = [];
        const updateValues = [];

        if (updates.hasOwnProperty('filename')) {
            updateFields.push('filename = ?');
            updateValues.push(updates.filename);
        }

        if (updates.hasOwnProperty('description')) {
            updateFields.push('description = ?');
            updateValues.push(updates.description);
        }

        if (updates.hasOwnProperty('tags')) {
            updateFields.push('tags = ?');
            updateValues.push(JSON.stringify(updates.tags));
        }

        if (updateFields.length > 0) {
            updateFields.push('last_modified = datetime("now")');
            updateValues.push(pcbId, currentUser.id);

            this.db.execute(`
                UPDATE pcbs 
                SET ${updateFields.join(', ')} 
                WHERE pcb_id = ? AND user_id = ?
            `, updateValues);
        }

        // Return updated PCB
        return this.getPCBById(pcbId);
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return 'pcb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate thumbnail data for PCB
     */
    generateThumbnail(pcbData) {
        // Simple thumbnail metadata - in a real implementation,
        // this would generate an actual image thumbnail
        return {
            objectCount: pcbData.objects ? pcbData.objects.length : 0,
            layers: pcbData.layers ? pcbData.layers.length : 0,
            boundingBox: this.calculateBoundingBox(pcbData.objects || [])
        };
    }

    /**
     * Extract tags from PCB data
     */
    extractTags(pcbData) {
        const tags = [];
        
        // Add source as tag
        if (pcbData.source) {
            tags.push(pcbData.source);
        }
        
        // Add layer types
        if (pcbData.layers) {
            pcbData.layers.forEach(layer => {
                if (layer.type && !tags.includes(layer.type)) {
                    tags.push(layer.type);
                }
            });
        }
        
        // Add component types
        if (pcbData.objects) {
            const componentTypes = new Set();
            pcbData.objects.forEach(obj => {
                if (obj.type === 'component' && obj.footprint) {
                    const footprintFamily = obj.footprint.split(/[-_]/)[0];
                    componentTypes.add(footprintFamily.toLowerCase());
                }
            });
            tags.push(...Array.from(componentTypes));
        }
        
        return tags;
    }

    /**
     * Calculate PCB statistics
     */
    calculateStats(pcbData) {
        const stats = {
            totalObjects: 0,
            traces: 0,
            vias: 0,
            components: 0,
            layers: 0,
            nets: new Set()
        };

        if (pcbData.objects) {
            stats.totalObjects = pcbData.objects.length;
            
            pcbData.objects.forEach(obj => {
                switch (obj.type) {
                    case 'trace':
                        stats.traces++;
                        break;
                    case 'via':
                        stats.vias++;
                        break;
                    case 'component':
                        stats.components++;
                        break;
                }
                
                if (obj.net) {
                    stats.nets.add(obj.net);
                }
            });
        }

        if (pcbData.layers) {
            stats.layers = pcbData.layers.length;
        }

        stats.nets = stats.nets.size;
        return stats;
    }

    /**
     * Calculate bounding box for objects
     */
    calculateBoundingBox(objects) {
        if (!objects || objects.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        objects.forEach(obj => {
            if (obj.position) {
                minX = Math.min(minX, obj.position.x);
                minY = Math.min(minY, obj.position.y);
                maxX = Math.max(maxX, obj.position.x);
                maxY = Math.max(maxY, obj.position.y);
            }
            if (obj.startPoint) {
                minX = Math.min(minX, obj.startPoint.x);
                minY = Math.min(minY, obj.startPoint.y);
                maxX = Math.max(maxX, obj.startPoint.x);
                maxY = Math.max(maxY, obj.startPoint.y);
            }
            if (obj.endPoint) {
                minX = Math.min(minX, obj.endPoint.x);
                minY = Math.min(minY, obj.endPoint.y);
                maxX = Math.max(maxX, obj.endPoint.x);
                maxY = Math.max(maxY, obj.endPoint.y);
            }
        });

        const width = maxX - minX;
        const height = maxY - minY;

        return { minX, minY, maxX, maxY, width, height };
    }

    /**
     * Export library data
     */
    exportLibrary() {
        const userLibrary = this.getUserLibrary();
        if (!userLibrary) {
            throw new Error('No library to export');
        }

        return {
            exportDate: new Date().toISOString(),
            username: userLibrary.username,
            displayName: userLibrary.displayName,
            pcbs: userLibrary.pcbs.map(pcb => ({
                ...pcb,
                data: pcb.data // Include full PCB data
            }))
        };
    }

    /**
     * Import library data
     */
    importLibrary(importData) {
        if (!importData.username || !importData.pcbs) {
            throw new Error('Invalid library import data');
        }

        const userLibrary = this.userLibraries.get(this.currentUser);
        if (!userLibrary) {
            throw new Error('User library not found');
        }

        // Import PCBs with new IDs to avoid conflicts
        importData.pcbs.forEach(pcb => {
            const newPcb = {
                ...pcb,
                id: this.generateId(),
                uploadDate: new Date().toISOString(),
                imported: true,
                importedFrom: importData.username
            };
            userLibrary.pcbs.push(newPcb);
        });

        this.saveUserLibraries();
        return userLibrary.pcbs.length;
    }
}

// Export for use in other modules
window.UserLibrary = UserLibrary;
