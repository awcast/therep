/**
 * PCB Editor API
 * Exposes application functionality for external integrations
 */

class PCBApi {
    constructor(authManager) {
        this.auth = authManager;
    }

    /**
     * API wrapper for user registration
     */
    async register(params) {
        try {
            const { email, username, password, confirmPassword } = params;
            const user = await this.auth.register(email, username, password, confirmPassword);
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for user login
     */
    async login(params) {
        try {
            const { email, password, rememberMe } = params;
            const user = await this.auth.login(email, password, rememberMe);
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for user logout
     */
    logout() {
        try {
            this.auth.logout();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for checking session status
     */
    async checkSession() {
        try {
            const isAuthenticated = await this.auth.checkSession();
            return { success: true, isAuthenticated, user: this.auth.getCurrentUser() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for changing password
     */
    async changePassword(params) {
        try {
            const { currentPassword, newPassword, confirmPassword } = params;
            await this.auth.changePassword(currentPassword, newPassword, confirmPassword);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for updating user profile
     */
    updateProfile(params) {
        try {
            const user = this.auth.updateProfile(params);
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for getting user by username
     */
    getUserByUsername(params) {
        try {
            const { username } = params;
            const user = this.auth.getUserByUsername(username);
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for getting all users (admin only)
     */
    getAllUsers() {
        try {
            const users = this.auth.getAllUsers();
            return { success: true, users };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for deleting user account
     */
    async deleteAccount(params) {
        try {
            const { password } = params;
            await this.auth.deleteAccount(password);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for deleting a user by ID (admin only)
     */
    async deleteUser(params) {
        try {
            const { userId } = params;
            await this.auth.deleteUser(userId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for checking if user is authenticated
     */
    isUserAuthenticated() {
        try {
            const isAuthenticated = this.auth.isUserAuthenticated();
            return { success: true, isAuthenticated };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * API wrapper for getting current user info
     */
    getCurrentUser() {
        try {
            const user = this.auth.getCurrentUser();
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

window.PCBApi = PCBApi;
