/**
 * Authentication UI Components
 * Handles login, registration, and user management UI
 */

class AuthUI {
    constructor(authManager) {
        this.authManager = authManager;
        this.loginModal = null;
        this.registerModal = null;
        
        this.createAuthModals();
        this.setupEventListeners();
        
        // Listen for auth state changes
        window.onAuthStateChange = (isAuthenticated, user) => {
            this.updateUI(isAuthenticated, user);
        };
    }

    /**
     * Create authentication modals
     */
    createAuthModals() {
        // Create login modal
        this.loginModal = this.createModal('login-modal', 'Login', this.createLoginForm());
        
        // Create register modal
        this.registerModal = this.createModal('register-modal', 'Register', this.createRegisterForm());
        
        // Create change password modal
        this.changePasswordModal = this.createModal('change-password-modal', 'Change Password', this.createChangePasswordForm());
        
        // Add modals to document
        document.body.appendChild(this.loginModal);
        document.body.appendChild(this.registerModal);
        document.body.appendChild(this.changePasswordModal);
    }

    /**
     * Create a modal element
     */
    createModal(id, title, content) {
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'auth-modal hidden';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" onclick="authUI.closeModal('${id}')">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        // Close modal when clicking backdrop
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            this.closeModal(id);
        });
        
        return modal;
    }

    /**
     * Create login form
     */
    createLoginForm() {
        return `
            <form id="login-form" class="auth-form">
                <div class="form-group">
                    <label for="login-email">Email:</label>
                    <input type="email" id="login-email" required>
                </div>
                <div class="form-group">
                    <label for="login-password">Password:</label>
                    <input type="password" id="login-password" required>
                </div>
                <div class="form-group">
                    <label class="checkbox">
                        <input type="checkbox" id="login-remember">
                        Remember me
                    </label>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Login</button>
                    <button type="button" class="btn btn-secondary" onclick="authUI.showRegister()">
                        Don't have an account? Register
                    </button>
                </div>
                <div id="login-error" class="error-message hidden"></div>
                <div id="login-loading" class="loading-message hidden">Logging in...</div>
            </form>
        `;
    }

    /**
     * Create register form
     */
    createRegisterForm() {
        return `
            <form id="register-form" class="auth-form">
                <div class="form-group">
                    <label for="register-email">Email:</label>
                    <input type="email" id="register-email" required>
                </div>
                <div class="form-group">
                    <label for="register-username">Username:</label>
                    <input type="text" id="register-username" required>
                </div>
                <div class="form-group">
                    <label for="register-password">Password:</label>
                    <input type="password" id="register-password" required minlength="6">
                </div>
                <div class="form-group">
                    <label for="register-confirm">Confirm Password:</label>
                    <input type="password" id="register-confirm" required minlength="6">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Register</button>
                    <button type="button" class="btn btn-secondary" onclick="authUI.showLogin()">
                        Already have an account? Login
                    </button>
                </div>
                <div id="register-error" class="error-message hidden"></div>
                <div id="register-loading" class="loading-message hidden">Creating account...</div>
            </form>
        `;
    }

    /**
     * Create change password form
     */
    createChangePasswordForm() {
        return `
            <form id="change-password-form" class="auth-form">
                <div class="form-group">
                    <label for="current-password">Current Password:</label>
                    <input type="password" id="current-password" required>
                </div>
                <div class="form-group">
                    <label for="new-password">New Password:</label>
                    <input type="password" id="new-password" required minlength="6">
                </div>
                <div class="form-group">
                    <label for="confirm-new-password">Confirm New Password:</label>
                    <input type="password" id="confirm-new-password" required minlength="6">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Change Password</button>
                    <button type="button" class="btn btn-secondary" onclick="authUI.closeModal('change-password-modal')">
                        Cancel
                    </button>
                </div>
                <div id="change-password-error" class="error-message hidden"></div>
                <div id="change-password-loading" class="loading-message hidden">Changing password...</div>
            </form>
        `;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Login form
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'login-form') {
                e.preventDefault();
                this.handleLogin();
            } else if (e.target.id === 'register-form') {
                e.preventDefault();
                this.handleRegister();
            } else if (e.target.id === 'change-password-form') {
                e.preventDefault();
                this.handleChangePassword();
            }
        });
    }

    /**
     * Handle login
     */
    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('login-remember').checked;
        
        const errorEl = document.getElementById('login-error');
        const loadingEl = document.getElementById('login-loading');
        
        this.hideError('login-error');
        this.showLoading('login-loading');
        
        try {
            await this.authManager.login(email, password, rememberMe);
            this.closeModal('login-modal');
            this.clearForm('login-form');
            this.showSuccess('Login successful!');
        } catch (error) {
            this.showError('login-error', error.message);
        } finally {
            this.hideLoading('login-loading');
        }
    }

    /**
     * Handle registration
     */
    async handleRegister() {
        const email = document.getElementById('register-email').value;
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;
        
        this.hideError('register-error');
        this.showLoading('register-loading');
        
        try {
            await this.authManager.register(email, username, password, confirmPassword);
            this.closeModal('register-modal');
            this.clearForm('register-form');
            this.showSuccess('Registration successful! Please login with your new account.');
            this.showLogin();
        } catch (error) {
            this.showError('register-error', error.message);
        } finally {
            this.hideLoading('register-loading');
        }
    }

    /**
     * Handle change password
     */
    async handleChangePassword() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;
        
        this.hideError('change-password-error');
        this.showLoading('change-password-loading');
        
        try {
            await this.authManager.changePassword(currentPassword, newPassword, confirmPassword);
            this.closeModal('change-password-modal');
            this.clearForm('change-password-form');
            this.showSuccess('Password changed successfully!');
        } catch (error) {
            this.showError('change-password-error', error.message);
        } finally {
            this.hideLoading('change-password-loading');
        }
    }

    /**
     * Show login modal
     */
    showLogin() {
        this.closeModal('register-modal');
        this.showModal('login-modal');
    }

    /**
     * Show register modal
     */
    showRegister() {
        this.closeModal('login-modal');
        this.showModal('register-modal');
    }

    /**
     * Show change password modal
     */
    showChangePassword() {
        this.showModal('change-password-modal');
    }

    /**
     * Show modal
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            // Focus first input
            const firstInput = modal.querySelector('input');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            this.clearForm(modal.querySelector('form')?.id);
        }
    }

    /**
     * Clear form
     */
    clearForm(formId) {
        if (!formId) return;
        
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
            this.hideError(formId.replace('-form', '-error'));
            this.hideLoading(formId.replace('-form', '-loading'));
        }
    }

    /**
     * Show error message
     */
    showError(elementId, message) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    /**
     * Hide error message
     */
    hideError(elementId) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
    }

    /**
     * Show loading message
     */
    showLoading(elementId) {
        const loadingEl = document.getElementById(elementId);
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
        }
    }

    /**
     * Hide loading message
     */
    hideLoading(elementId) {
        const loadingEl = document.getElementById(elementId);
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        // Create temporary success message
        const successEl = document.createElement('div');
        successEl.className = 'success-notification';
        successEl.textContent = message;
        document.body.appendChild(successEl);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (successEl.parentElement) {
                successEl.remove();
            }
        }, 3000);
    }

    /**
     * Update UI based on authentication state
     */
    updateUI(isAuthenticated, user) {
        const userButton = document.getElementById('menu-user');
        const currentUserSpan = document.getElementById('current-user');
        
        if (isAuthenticated && user) {
            // Update user button
            if (userButton) {
                userButton.innerHTML = `User: <span id="current-user">${user.displayName}</span> ▼`;
                userButton.onclick = () => this.showUserMenu();
            }
            
            // Close any open auth modals
            this.closeModal('login-modal');
            this.closeModal('register-modal');
        } else {
            // Show login button
            if (userButton) {
                userButton.innerHTML = 'Login';
                userButton.onclick = () => this.showLogin();
            }
        }
    }

    /**
     * Show user menu dropdown
     */
    showUserMenu() {
        if (!this.authManager.isAuthenticated) {
            this.showLogin();
            return;
        }

        // Create user menu if it doesn't exist
        let userMenu = document.getElementById('user-menu-dropdown');
        if (!userMenu) {
            userMenu = document.createElement('div');
            userMenu.id = 'user-menu-dropdown';
            userMenu.className = 'user-menu-dropdown';
            userMenu.innerHTML = `
                <div class="user-menu-item" onclick="authUI.showProfile()">
                    Profile
                </div>
                <div class="user-menu-item" onclick="authUI.showChangePassword()">
                    Change Password
                </div>
                <div class="user-menu-separator"></div>
                <div class="user-menu-item" onclick="authUI.logout()">
                    Logout
                </div>
            `;
            document.body.appendChild(userMenu);
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#menu-user') && !e.target.closest('#user-menu-dropdown')) {
                    userMenu.classList.add('hidden');
                }
            });
        }
        
        // Position and show menu
        const userButton = document.getElementById('menu-user');
        const rect = userButton.getBoundingClientRect();
        userMenu.style.top = (rect.bottom + window.scrollY) + 'px';
        userMenu.style.left = rect.left + 'px';
        userMenu.classList.toggle('hidden');
    }

    /**
     * Show profile modal (placeholder)
     */
    showProfile() {
        alert('Profile editing coming soon!');
        document.getElementById('user-menu-dropdown').classList.add('hidden');
    }

    /**
     * Logout user
     */
    logout() {
        if (confirm('Are you sure you want to logout?')) {
            this.authManager.logout();
            document.getElementById('user-menu-dropdown').classList.add('hidden');
        }
    }

    /**
     * Check if user needs to authenticate for protected actions
     */
    requireAuth(action) {
        if (!this.authManager.isAuthenticated) {
            this.showLogin();
            return false;
        }
        return true;
    }
}

// Export for use in other modules
window.AuthUI = AuthUI;
