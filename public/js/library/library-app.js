/**
 * Library App - Main application for the component library
 */

// Global variables
let authManager = null;
let componentManager = null;
let libraryUI = null;

/**
 * Initialize the library application
 */
async function initializeLibraryApp() {
    try {
        // Show loading state
        showLoadingState();

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

        // Update user info
        updateUserInfo();

        // Initialize component manager
        componentManager = new ComponentManager(authManager);
        console.log('ComponentManager created:', componentManager);
        await componentManager.init();
        console.log('ComponentManager initialized');

        // Initialize UI
        libraryUI = new LibraryUI(componentManager);
        console.log('LibraryUI created');
        
        // Check if we need to initialize sample data
        console.log('Checking for existing components...');
        const components = await componentManager.getComponents();
        console.log('Found components:', components.length);
        
        if (components.length === 0) {
            console.log('No components found, initializing with sample data...');
            await initializeSampleData(componentManager);
            libraryUI.renderComponents(); // Refresh to show sample data
        }
        
        hideLoadingState();
        console.log('Library app initialized successfully');

    } catch (error) {
        console.error('Failed to initialize library app:', error);
        showError('Failed to initialize library: ' + error.message);
    }
}

function showLoadingState() {
    const loadingState = document.getElementById('loading-state');
    if (loadingState) {
        loadingState.style.display = 'flex';
    }
}

function hideLoadingState() {
    const loadingState = document.getElementById('loading-state');
    if (loadingState) {
        loadingState.style.display = 'none';
    }
}

function updateUserInfo() {
    const userInfo = document.getElementById('library-user-info');
    if (userInfo) {
        const currentUser = authManager.getCurrentUser();
        userInfo.textContent = currentUser ? currentUser.username : 'Guest';
    }
}

function showError(message) {
    alert(message); // Simple error display for now
}

// Modal Functions
function showAddComponentModal() {
    const modal = document.getElementById('add-component-modal');
    modal.classList.remove('hidden');
    
    // Reset form
    document.getElementById('comp-name').value = '';
    document.getElementById('comp-category').value = '';
    document.getElementById('comp-package').value = '';
    document.getElementById('comp-value').value = '';
    document.getElementById('comp-description').value = '';
    document.getElementById('comp-manufacturer').value = '';
    document.getElementById('comp-datasheet').value = '';
    document.getElementById('comp-tags').value = '';
    
    // Clear specifications
    const specsContainer = document.querySelector('.specifications-container');
    specsContainer.innerHTML = `
        <div class="spec-item">
            <input type="text" placeholder="Parameter" class="spec-param">
            <input type="text" placeholder="Value" class="spec-value">
            <input type="text" placeholder="Unit" class="spec-unit">
            <button type="button" class="btn-remove" onclick="removeSpec(this)">×</button>
        </div>
    `;
}

function closeAddComponentModal() {
    const modal = document.getElementById('add-component-modal');
    modal.classList.add('hidden');
}

function addSpecification() {
    const container = document.querySelector('.specifications-container');
    const specItem = document.createElement('div');
    specItem.className = 'spec-item';
    specItem.innerHTML = `
        <input type="text" placeholder="Parameter" class="spec-param">
        <input type="text" placeholder="Value" class="spec-value">
        <input type="text" placeholder="Unit" class="spec-unit">
        <button type="button" class="btn-remove" onclick="removeSpec(this)">×</button>
    `;
    container.appendChild(specItem);
}

function removeSpec(button) {
    const container = document.querySelector('.specifications-container');
    if (container.children.length > 1) {
        button.parentElement.remove();
    }
}

async function saveComponent() {
    try {
        // Collect form data
        const componentData = {
            name: document.getElementById('comp-name').value.trim(),
            category: document.getElementById('comp-category').value,
            package: document.getElementById('comp-package').value.trim(),
            value: document.getElementById('comp-value').value.trim(),
            description: document.getElementById('comp-description').value.trim(),
            manufacturer: document.getElementById('comp-manufacturer').value.trim(),
            datasheet: document.getElementById('comp-datasheet').value.trim(),
            tags: document.getElementById('comp-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag)
        };

        // Collect specifications
        const specItems = document.querySelectorAll('.spec-item');
        const specifications = [];
        specItems.forEach(item => {
            const param = item.querySelector('.spec-param').value.trim();
            const value = item.querySelector('.spec-value').value.trim();
            const unit = item.querySelector('.spec-unit').value.trim();
            
            if (param && value) {
                specifications.push({ parameter: param, value, unit });
            }
        });
        componentData.specifications = specifications;

        // Validation
        if (!componentData.name) {
            alert('Component name is required');
            return;
        }
        if (!componentData.category) {
            alert('Category is required');
            return;
        }

        // Save component
        await componentManager.addComponent(componentData);
        
        // Close modal and refresh
        closeAddComponentModal();
        libraryUI.renderComponents();
        
        alert('Component added successfully!');

    } catch (error) {
        console.error('Error saving component:', error);
        alert('Failed to save component: ' + error.message);
    }
}

function showComponentDetails(componentId) {
    // TODO: Implement component details modal
    console.log('Showing details for component:', componentId);
}

function closeComponentDetails() {
    const modal = document.getElementById('component-details-modal');
    modal.classList.add('hidden');
}

function editComponent() {
    // TODO: Implement edit functionality
    console.log('Edit component');
}

function addToProject() {
    // TODO: Implement add to project functionality
    console.log('Add to project');
}

function createFootprint() {
    // TODO: Implement footprint creation
    alert('Footprint editor not yet implemented');
}

function createSymbol() {
    // TODO: Implement symbol creation
    alert('Symbol editor not yet implemented');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeLibraryApp();
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showError('An unexpected error occurred. Please check the console for details.');
});

// Export global functions
window.showAddComponentModal = showAddComponentModal;
window.closeAddComponentModal = closeAddComponentModal;
window.addSpecification = addSpecification;
window.removeSpec = removeSpec;
window.saveComponent = saveComponent;
window.showComponentDetails = showComponentDetails;
window.closeComponentDetails = closeComponentDetails;
window.editComponent = editComponent;
window.addToProject = addToProject;
window.createFootprint = createFootprint;
window.createSymbol = createSymbol;
