/**
 * Library UI Controller - Manages the library interface
 */
class LibraryUI {
    constructor(componentManager) {
        this.componentManager = componentManager;
        this.currentView = 'grid';
        this.currentFilter = 'all';
        this.currentCategory = 'all';
        this.currentSort = 'name';
        this.searchQuery = '';
        this.packageFilters = ['smd', 'through-hole', 'bga', 'qfn'];
        this.selectedComponent = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateCategoryCounts();
        this.renderComponents();
        console.log('LibraryUI initialized');
    }

    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');
        
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderComponents();
            searchClear.style.display = this.searchQuery ? 'block' : 'none';
        });

        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            this.renderComponents();
            searchClear.style.display = 'none';
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderComponents();
            });
        });

        // Category selection
        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', (e) => {
                document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentCategory = e.currentTarget.dataset.category;
                this.renderComponents();
            });
        });

        // Package filters
        document.querySelectorAll('.package-filter input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.packageFilters = Array.from(document.querySelectorAll('.package-filter input:checked'))
                    .map(cb => cb.value);
                this.renderComponents();
            });
        });

        // View controls
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentView = e.target.dataset.view;
                this.switchView();
            });
        });

        // Sort
        document.getElementById('sort-select').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderComponents();
        });

        // Add component button
        document.getElementById('add-component-btn').addEventListener('click', () => {
            this.showAddComponentModal();
        });

        // Sync button
        document.getElementById('sync-btn').addEventListener('click', () => {
            this.syncLibraries();
        });

        // Import/Export buttons
        document.getElementById('import-lib-btn').addEventListener('click', () => {
            this.showImportDialog();
        });

        document.getElementById('export-lib-btn').addEventListener('click', () => {
            this.exportLibrary();
        });
    }

    async renderComponents() {
        const filters = {
            category: this.currentCategory,
            packages: this.packageFilters,
            favorites: this.currentFilter === 'favorites',
            recent: this.currentFilter === 'recent'
        };

        const components = await this.componentManager.searchComponents(this.searchQuery, filters);
        
        // Sort components
        components.sort((a, b) => {
            switch (this.currentSort) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'category':
                    return a.category.localeCompare(b.category);
                case 'package':
                    return a.package.localeCompare(b.package);
                case 'date':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'usage':
                    return b.usage_count - a.usage_count;
                default:
                    return 0;
            }
        });

        // Show/hide states
        const loadingState = document.getElementById('loading-state');
        const emptyState = document.getElementById('empty-state');
        const componentsContainer = document.querySelector('.components-container');

        loadingState.style.display = 'none';
        
        if (components.length === 0) {
            emptyState.style.display = 'flex';
            componentsContainer.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            componentsContainer.style.display = 'block';
            
            // Render based on current view
            switch (this.currentView) {
                case 'grid':
                    this.renderGridView(components);
                    break;
                case 'list':
                    this.renderListView(components);
                    break;
                case 'table':
                    this.renderTableView(components);
                    break;
            }
        }

        this.updateCategoryCounts();
    }

    renderGridView(components) {
        const grid = document.getElementById('components-grid');
        grid.innerHTML = '';

        components.forEach(component => {
            const card = this.createComponentCard(component);
            grid.appendChild(card);
        });
    }

    renderListView(components) {
        const list = document.getElementById('components-list');
        list.innerHTML = '';

        components.forEach(component => {
            const item = this.createComponentListItem(component);
            list.appendChild(item);
        });
    }

    renderTableView(components) {
        const table = document.getElementById('components-table');
        table.innerHTML = `
            <div class="table-header">
                <div>Component</div>
                <div>Category</div>
                <div>Package</div>
                <div>Value</div>
                <div>Manufacturer</div>
                <div>Actions</div>
            </div>
        `;

        components.forEach(component => {
            const row = this.createComponentTableRow(component);
            table.appendChild(row);
        });
    }

    createComponentCard(component) {
        const card = document.createElement('div');
        card.className = 'component-card';
        card.dataset.componentId = component.id;

        const tags = component.tags.slice(0, 3).map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('');

        card.innerHTML = `
            <div class="component-header">
                <div class="component-info">
                    <h3>${component.name}</h3>
                    <div class="component-category">${this.componentManager.categories[component.category] || component.category}</div>
                </div>
                <div class="component-actions">
                    <button class="action-btn favorite ${component.is_favorite ? 'active' : ''}" 
                            onclick="libraryUI.toggleFavorite('${component.id}')" 
                            title="Toggle Favorite">
                        <svg width="16" height="16" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/>
                        </svg>
                    </button>
                    <button class="action-btn" onclick="libraryUI.showComponentDetails('${component.id}')" title="View Details">
                        <svg width="16" height="16" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="component-details">
                ${component.package ? `<div class="component-package">${component.package}</div>` : ''}
                ${component.value_rating ? `<div class="component-value">${component.value_rating}</div>` : ''}
                ${component.description ? `<div class="component-description">${component.description}</div>` : ''}
                ${tags ? `<div class="component-tags">${tags}</div>` : ''}
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                this.showComponentDetails(component.id);
            }
        });

        return card;
    }

    createComponentListItem(component) {
        const item = document.createElement('div');
        item.className = 'component-list-item';
        item.dataset.componentId = component.id;

        item.innerHTML = `
            <div class="component-list-info">
                <h4>${component.name}</h4>
                <div class="component-list-meta">
                    <span>${this.componentManager.categories[component.category] || component.category}</span>
                    ${component.package ? `<span>${component.package}</span>` : ''}
                    ${component.value_rating ? `<span>${component.value_rating}</span>` : ''}
                    ${component.manufacturer ? `<span>${component.manufacturer}</span>` : ''}
                </div>
            </div>
            <div class="component-actions">
                <button class="action-btn favorite ${component.is_favorite ? 'active' : ''}" 
                        onclick="libraryUI.toggleFavorite('${component.id}')" 
                        title="Toggle Favorite">★</button>
            </div>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                this.showComponentDetails(component.id);
            }
        });

        return item;
    }

    createComponentTableRow(component) {
        const row = document.createElement('div');
        row.className = 'table-row';
        row.dataset.componentId = component.id;

        row.innerHTML = `
            <div class="table-cell">${component.name}</div>
            <div class="table-cell">${this.componentManager.categories[component.category] || component.category}</div>
            <div class="table-cell">${component.package || '-'}</div>
            <div class="table-cell">${component.value_rating || '-'}</div>
            <div class="table-cell">${component.manufacturer || '-'}</div>
            <div class="table-cell">
                <button class="action-btn favorite ${component.is_favorite ? 'active' : ''}" 
                        onclick="libraryUI.toggleFavorite('${component.id}')" 
                        title="Toggle Favorite">★</button>
            </div>
        `;

        row.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                this.showComponentDetails(component.id);
            }
        });

        return row;
    }

    switchView() {
        // Hide all views
        document.getElementById('components-grid').style.display = 'none';
        document.getElementById('components-list').style.display = 'none';
        document.getElementById('components-table').style.display = 'none';

        // Show current view
        switch (this.currentView) {
            case 'grid':
                document.getElementById('components-grid').style.display = 'grid';
                break;
            case 'list':
                document.getElementById('components-list').style.display = 'block';
                break;
            case 'table':
                document.getElementById('components-table').style.display = 'block';
                break;
        }

        this.renderComponents();
    }

    updateCategoryCounts() {
        const counts = this.componentManager.getCategoryCounts();
        
        Object.keys(counts).forEach(category => {
            const element = document.getElementById(`count-${category}`);
            if (element) {
                element.textContent = counts[category];
            }
        });
    }

    async toggleFavorite(componentId) {
        const isFavorite = await this.componentManager.toggleFavorite(componentId);
        
        // Update UI
        const buttons = document.querySelectorAll(`[onclick*="${componentId}"]`);
        buttons.forEach(btn => {
            if (btn.classList.contains('favorite')) {
                btn.classList.toggle('active', isFavorite);
            }
        });
    }

    showComponentDetails(componentId) {
        // This will be implemented to show the component details modal
        console.log('Showing details for component:', componentId);
        // TODO: Implement modal display
    }

    showAddComponentModal() {
        const modal = document.getElementById('add-component-modal');
        modal.classList.remove('hidden');
    }

    async syncLibraries() {
        // Placeholder for library synchronization
        console.log('Syncing libraries...');
        const syncBtn = document.getElementById('sync-btn');
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<span>Syncing...</span>';
        
        setTimeout(() => {
            syncBtn.disabled = false;
            syncBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill="currentColor"/>
                </svg>
                Sync Libraries
            `;
        }, 2000);
    }

    showImportDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        this.importLibrary(data);
                    } catch (error) {
                        alert('Invalid file format');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    async importLibrary(data) {
        try {
            const results = await this.componentManager.importLibrary(data);
            alert(`Import complete: ${results.imported} imported, ${results.skipped} skipped`);
            this.renderComponents();
        } catch (error) {
            alert('Import failed: ' + error.message);
        }
    }

    async exportLibrary() {
        try {
            const data = await this.componentManager.exportLibrary();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `component-library-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
        } catch (error) {
            alert('Export failed: ' + error.message);
        }
    }
}

// Export for use in other modules
window.LibraryUI = LibraryUI;
