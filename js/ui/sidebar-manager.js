/**
 * Sidebar Manager - Handles sidebar toggle functionality
 * Makes workspace grid fit window when sidebar is hidden
 */
class SidebarManager {
    constructor() {
        this.isVisible = true;
        this.sidebar = null;
        this.mainContent = null;
        this.toggleButton = null;
        this.init();
    }

    init() {
        this.sidebar = document.querySelector('.toolbar-left');
        this.mainContent = document.querySelector('.main-content');
        
        // Create toggle button
        this.createToggleButton();
        
        // Add event listeners
        this.setupEventListeners();
        
        console.log('SidebarManager initialized');
    }

    createToggleButton() {
        // Check if toggle button already exists
        let existingButton = document.getElementById('sidebar-toggle');
        if (existingButton) {
            this.toggleButton = existingButton;
            return;
        }

        // Create new toggle button
        this.toggleButton = document.createElement('button');
        this.toggleButton.id = 'sidebar-toggle';
        this.toggleButton.className = 'sidebar-toggle-btn menu-btn';
        this.toggleButton.innerHTML = '◀'; // Left arrow when sidebar is visible
        this.toggleButton.title = 'Toggle Sidebar (F9)';

        // Add to menu bar
        const menuGroup = document.querySelector('.menu-group');
        if (menuGroup) {
            menuGroup.appendChild(this.toggleButton);
        }
    }

    setupEventListeners() {
        // Toggle button click
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggle();
            });
        }

        // Menu toggle tools option
        const toggleToolsMenuItem = document.getElementById('menu-toggle-tools');
        if (toggleToolsMenuItem) {
            toggleToolsMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggle();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // F9 key
            if (e.key === 'F9') {
                e.preventDefault();
                this.toggle();
            }
            // Ctrl+Shift+T (alternative shortcut)
            else if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
    }

    toggle() {
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            this.show();
        } else {
            this.hide();
        }
        
        console.log(`Sidebar ${this.isVisible ? 'shown' : 'hidden'}`);
    }

    hide() {
        if (this.mainContent) {
            this.mainContent.classList.add('sidebar-hidden');
        }
        
        if (this.toggleButton) {
            this.toggleButton.innerHTML = '▶'; // Right arrow when sidebar is hidden
            this.toggleButton.title = 'Show Sidebar (F9)';
        }

        // Trigger workspace resize after animation
        setTimeout(() => {
            this.triggerWorkspaceResize();
        }, 320); // Wait for CSS transition
    }

    show() {
        if (this.mainContent) {
            this.mainContent.classList.remove('sidebar-hidden');
        }
        
        if (this.toggleButton) {
            this.toggleButton.innerHTML = '◀'; // Left arrow when sidebar is visible
            this.toggleButton.title = 'Hide Sidebar (F9)';
        }

        // Trigger workspace resize after animation
        setTimeout(() => {
            this.triggerWorkspaceResize();
        }, 320); // Wait for CSS transition
    }

    triggerWorkspaceResize() {
        // Notify other components that the layout has changed
        window.dispatchEvent(new Event('resize'));
        
        // If there's a PCB editor canvas, trigger its resize method
        if (window.pcbEditor && typeof window.pcbEditor.handleResize === 'function') {
            window.pcbEditor.handleResize();
        }

        // If there's a renderer, update its size
        if (window.pcbEditor && window.pcbEditor.renderer && typeof window.pcbEditor.renderer.handleResize === 'function') {
            window.pcbEditor.renderer.handleResize();
        }

        // Update canvas size if available
        const canvas = document.getElementById('pcb-canvas');
        if (canvas && window.pcbEditor) {
            const container = canvas.parentElement;
            if (container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                
                // Update viewport if available
                if (window.pcbEditor.viewport) {
                    window.pcbEditor.viewport.updateSize(canvas.width, canvas.height);
                }
                
                // Trigger redraw
                if (typeof window.pcbEditor.render === 'function') {
                    window.pcbEditor.render();
                }
            }
        }
    }

    handleWindowResize() {
        // Handle window resize events
        if (!this.isVisible) {
            // If sidebar is hidden, ensure workspace uses full width
            this.triggerWorkspaceResize();
        }
    }

    isHidden() {
        return !this.isVisible;
    }

    getSidebarWidth() {
        if (!this.sidebar || !this.isVisible) {
            return 0;
        }
        return this.sidebar.offsetWidth || 220; // Default fallback
    }

    getWorkspaceWidth() {
        const container = document.querySelector('.canvas-container');
        if (container) {
            return container.clientWidth;
        }
        
        // Fallback calculation
        const windowWidth = window.innerWidth;
        if (this.isVisible) {
            return windowWidth - this.getSidebarWidth();
        }
        return windowWidth;
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sidebarManager = new SidebarManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SidebarManager;
}
