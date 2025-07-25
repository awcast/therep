/**
 * Authentication Manager
 * Handles user registration, login, logout, and session management using SQLite
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
        this.db = new DatabaseManager();
        this.isInitialized = false;
        
        this.initialize();
    }

    /**
     * Initialize the authentication manager
     */
    async initialize() {
        try {
            // Wait for database to be initialized
            const checkDBInit = () => {
                return new Promise((resolve) => {
                    const check = () => {
                        if (this.db.isInitialized) {
                            resolve();
                        } else {
                            setTimeout(check, 100);
                        }
                    };
                    check();
                });
            };
            
            await checkDBInit();
            this.isInitialized = true;
            await this.checkSession();
            await this.initializeDemoUser();
            console.log('AuthManager initialized successfully');
            
            // Add debug method to global scope for testing
            if (typeof window !== 'undefined') {
                window.debugAuth = () => {
                    console.log('=== Auth Debug Info ===');
                    console.log('Current user:', this.currentUser);
                    console.log('Is authenticated:', this.isAuthenticated);
                    console.log('Is initialized:', this.isInitialized);
                    
                    // Show all users in database
                    try {
                        const stmt = this.db.db.prepare('SELECT id, email, username, display_name, is_active FROM users');
                        const users = [];
                        while (stmt.step()) {
                            users.push(stmt.getAsObject());
                        }
                        stmt.free();
                        console.log('Users in database:', users);
                        return users;
                    } catch (error) {
                        console.log('Error reading users:', error);
                        return [];
                    }
                };
                console.log('Debug: Use debugAuth() to see authentication status and user list');
            }
        } catch (error) {
            console.error('Failed to initialize AuthManager:', error);
            throw error;
        }
    }

    /**
     * Hash password using a simple method (in production, use proper bcrypt on server)
     */
    async hashPassword(password) {
        // Simple hash for demo - in production, use proper server-side hashing
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'pcb-editor-salt');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate session token
     */
    generateSessionToken() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
    }

    /**
     * Register new user
     */
    async register(email, username, password, confirmPassword) {
        if (!this.isInitialized) {
            throw new Error('Authentication system not initialized');
        }

        // Validation
        if (!email || !username || !password) {
            throw new Error('All fields are required');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }

        // Check email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Please enter a valid email address');
        }

        // Clean username
        const cleanUsername = username.toLowerCase().replace(/[^a-z0-9-_]/g, '');
        if (!cleanUsername) {
            throw new Error('Username must contain alphanumeric characters');
        }

        try {
            // Ensure database is ready
            if (!this.db.isInitialized) {
                throw new Error('Database not ready');
            }
            
            // Use the DatabaseManager's createUser method
            const user = await this.db.createUser(email, cleanUsername, password);
            console.log('User registered successfully:', cleanUsername);
            return user;
        } catch (error) {
            console.error('Registration error:', error);
            // Re-throw with more user-friendly messages
            throw error;
        }
    }

    /**
     * Login user
     */
    async login(email, password, rememberMe = false) {
        if (!this.isInitialized) {
            throw new Error('Authentication system not initialized');
        }

        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        try {
            // Get user from database with proper type handling
            const stmt = this.db.db.prepare('SELECT * FROM users WHERE email = ?');
            stmt.bind([String(email)]);
            const userData = stmt.step() ? stmt.getAsObject() : null;
            stmt.free();

            console.log('Login attempt for:', email);
            console.log('User found:', userData ? 'Yes' : 'No');

            if (!userData) {
                throw new Error('Invalid email or password');
            }

            // Check if account is active (stored as INTEGER: 1 = active, 0 = inactive)
            console.log('User active status:', userData.is_active);
            if (userData.is_active !== 1) {
                throw new Error('Account is deactivated');
            }

            // Verify password
            const hashedPassword = await this.hashPassword(password);
            console.log('Password hash match:', hashedPassword === userData.password_hash);
            if (hashedPassword !== userData.password_hash) {
                throw new Error('Invalid email or password');
            }

        // Create session token
        const sessionToken = this.generateSessionToken();
        const expiresAt = new Date(Date.now() + this.sessionTimeout).toISOString();

        // Save session to database with proper type casting
        const sessionStmt = this.db.db.prepare(`
            INSERT INTO sessions (token, user_id, email, username, expires_at, remember_me)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        sessionStmt.run([
            String(sessionToken),
            String(userData.id),
            String(userData.email),
            String(userData.username),
            String(expiresAt),
            rememberMe ? 1 : 0
        ]);
        sessionStmt.free();

        // Update user last login with consistent TEXT format
        const updateStmt = this.db.db.prepare('UPDATE users SET last_login = ? WHERE id = ?');
        updateStmt.run([String(new Date().toISOString()), String(userData.id)]);
        updateStmt.free();

        // Set current session
        this.currentUser = {
            id: userData.id,
            email: userData.email,
            username: userData.username,
            displayName: userData.display_name,
            role: userData.role
        };
        this.isAuthenticated = true;

        // Store session token
        if (rememberMe) {
            localStorage.setItem('pcb-editor-session-token', sessionToken);
        } else {
            sessionStorage.setItem('pcb-editor-session-token', sessionToken);
        }

        // Save database state
        this.db.saveDatabase();

        console.log('User logged in successfully:', userData.username);
        this.onAuthStateChange();
        
        return this.currentUser;
        
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Logout user
     */
    logout() {
        if (this.isAuthenticated) {
            // Remove session from database
            const sessionToken = localStorage.getItem('pcb-editor-session-token') || 
                                sessionStorage.getItem('pcb-editor-session-token');
            
            if (sessionToken && this.isInitialized) {
                const deleteStmt = this.db.db.prepare('DELETE FROM sessions WHERE token = ?');
                deleteStmt.run([String(sessionToken)]);
                deleteStmt.free();
                this.db.saveDatabase();
            }

            localStorage.removeItem('pcb-editor-session-token');
            sessionStorage.removeItem('pcb-editor-session-token');

            // Clear current user
            this.currentUser = null;
            this.isAuthenticated = false;

            console.log('User logged out successfully');
            this.onAuthStateChange();
        }
    }

    /**
     * Check existing session
     */
    async checkSession() {
        if (!this.isInitialized) {
            return false;
        }

        const sessionToken = localStorage.getItem('pcb-editor-session-token') || 
                            sessionStorage.getItem('pcb-editor-session-token');

        if (!sessionToken) {
            return false;
        }

        // Get session from database
        const sessionStmt = this.db.db.prepare('SELECT * FROM sessions WHERE token = ?');
        sessionStmt.bind([String(sessionToken)]);
        const sessionData = sessionStmt.step() ? sessionStmt.getAsObject() : null;
        sessionStmt.free();

        if (!sessionData) {
            // Invalid session token
            localStorage.removeItem('pcb-editor-session-token');
            sessionStorage.removeItem('pcb-editor-session-token');
            return false;
        }

        // Check if session has expired
        const now = new Date();
        const expires = new Date(sessionData.expires_at);
        
        if (now > expires) {
            // Session expired - remove from database
            const deleteStmt = this.db.db.prepare('DELETE FROM sessions WHERE token = ?');
            deleteStmt.run([String(sessionToken)]);
            deleteStmt.free();
            localStorage.removeItem('pcb-editor-session-token');
            sessionStorage.removeItem('pcb-editor-session-token');
            this.db.saveDatabase();
            return false;
        }

        // Get user data from database
        const userStmt = this.db.db.prepare('SELECT * FROM users WHERE id = ?');
        userStmt.bind([String(sessionData.user_id)]);
        const userData = userStmt.step() ? userStmt.getAsObject() : null;
        userStmt.free();

        if (!userData || userData.is_active !== 1) {
            // User no longer exists or is inactive
            const deleteStmt = this.db.db.prepare('DELETE FROM sessions WHERE token = ?');
            deleteStmt.run([String(sessionToken)]);
            deleteStmt.free();
            localStorage.removeItem('pcb-editor-session-token');
            sessionStorage.removeItem('pcb-editor-session-token');
            this.db.saveDatabase();
            return false;
        }

        // Valid session - restore user
        this.currentUser = {
            id: userData.id,
            email: userData.email,
            username: userData.username,
            displayName: userData.display_name,
            role: userData.role
        };
        this.isAuthenticated = true;

        console.log('Session restored for user:', userData.username);
        return true;
    }

    /**
     * Change password
     */
    async changePassword(currentPassword, newPassword, confirmPassword) {
        if (!this.isAuthenticated) {
            throw new Error('User not authenticated');
        }

        if (!currentPassword || !newPassword) {
            throw new Error('Current password and new password are required');
        }

        if (newPassword !== confirmPassword) {
            throw new Error('New passwords do not match');
        }

        if (newPassword.length < 6) {
            throw new Error('New password must be at least 6 characters long');
        }

        // Get current user data from database
        const stmt = this.db.db.prepare('SELECT * FROM users WHERE id = ?');
        stmt.bind([this.currentUser.id]);
        const userData = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();

        if (!userData) {
            throw new Error('User not found');
        }

        // Verify current password
        const currentHashedPassword = await this.hashPassword(currentPassword);
        if (currentHashedPassword !== userData.password_hash) {
            throw new Error('Current password is incorrect');
        }

        // Hash new password
        const newHashedPassword = await this.hashPassword(newPassword);

        // Update password in database
        this.db.db.run(`
            UPDATE users 
            SET password_hash = ?, last_modified = datetime("now") 
            WHERE id = ?
        `, [newHashedPassword, this.currentUser.id]);

        console.log('Password changed successfully for user:', userData.username);
    }

    /**
     * Update user profile
     */
    updateProfile(updates) {
        if (!this.isAuthenticated) {
            throw new Error('User not authenticated');
        }

        // Get current user data
        const stmt = this.db.db.prepare('SELECT * FROM users WHERE id = ?');
        stmt.bind([this.currentUser.id]);
        const userData = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();

        if (!userData) {
            throw new Error('User not found');
        }

        // Update allowed fields
        const allowedFields = ['display_name'];
        let hasChanges = false;
        const updateValues = [];
        const updateFields = [];

        if (updates.displayName && updates.displayName !== userData.display_name) {
            updateFields.push('display_name = ?');
            updateValues.push(updates.displayName);
            hasChanges = true;
        }

        if (hasChanges) {
            updateFields.push('last_modified = datetime("now")');
            updateValues.push(this.currentUser.id);

            this.db.db.run(
                `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );

            // Update current user object
            this.currentUser.displayName = updates.displayName;
            
            // Update user library display name
            this.db.db.run(`
                UPDATE user_libraries 
                SET display_name = ? 
                WHERE user_id = ?
            `, [updates.displayName, this.currentUser.id]);
            
            console.log('Profile updated for user:', userData.username);
            this.onAuthStateChange();
        }

        return this.currentUser;
    }

    /**
     * Get user by username
     */
    getUserByUsername(username) {
        if (!this.isInitialized) {
            return null;
        }

        const stmt = this.db.db.prepare('SELECT * FROM users WHERE username = ?');
        stmt.bind([username]);
        const userData = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();

        if (!userData) {
            return null;
        }

        return {
            id: userData.id,
            email: userData.email,
            username: userData.username,
            displayName: userData.display_name,
            created: userData.created_at,
            lastLogin: userData.last_login
        };
    }

    /**
     * Get all users (admin function)
     */
    getAllUsers() {
        if (!this.isAuthenticated || this.currentUser.role !== 'admin') {
            throw new Error('Insufficient permissions');
        }

        if (!this.isInitialized) {
            return [];
        }

        const results = this.db.db.exec('SELECT * FROM users ORDER BY created_at DESC');

        if (!results || results.length === 0) {
            return [];
        }

        const users = results[0].values.map(row => {
            const user = {};
            results[0].columns.forEach((col, i) => {
                user[col] = row[i];
            });
            return {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.display_name,
                created: user.created_at,
                lastLogin: user.last_login,
                isActive: user.is_active,
                role: user.role
            };
        });

        return users;
    }

    /**
     * Delete a user by ID (admin function)
     */
    async deleteUser(userId) {
        if (!this.isAuthenticated || this.currentUser.role !== 'admin') {
            throw new Error('Insufficient permissions');
        }

        if (!userId) {
            throw new Error('User ID is required');
        }

        // Use transaction to ensure data consistency
        this.db.db.exec('BEGIN TRANSACTION');
        try {
            // Delete user's PCBs
            this.db.db.run('DELETE FROM pcbs WHERE user_id = ?', [userId]);
            
            // Delete user's library
            this.db.db.run('DELETE FROM user_libraries WHERE user_id = ?', [userId]);
            
            // Delete user's sessions
            this.db.db.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
            
            // Delete user account
            this.db.db.run('DELETE FROM users WHERE id = ?', [userId]);
            this.db.db.exec('COMMIT');
        } catch (error) {
            this.db.db.exec('ROLLBACK');
            throw error;
        }

        console.log(`User account with ID ${userId} deleted successfully`);
    }

    /**
     * Delete user account
     */
    async deleteAccount(password) {
        if (!this.isAuthenticated) {
            throw new Error('User not authenticated');
        }

        // Get current user data from database
        const stmt = this.db.db.prepare('SELECT * FROM users WHERE id = ?');
        stmt.bind([this.currentUser.id]);
        const userData = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();

        if (!userData) {
            throw new Error('User not found');
        }

        // Verify password
        const hashedPassword = await this.hashPassword(password);
        if (hashedPassword !== userData.password_hash) {
            throw new Error('Password is incorrect');
        }

        // Use transaction to ensure data consistency
        this.db.db.exec('BEGIN TRANSACTION');
        try {
            // Delete user's PCBs
            this.db.db.run('DELETE FROM pcbs WHERE user_id = ?', [this.currentUser.id]);
            
            // Delete user's library
            this.db.db.run('DELETE FROM user_libraries WHERE user_id = ?', [this.currentUser.id]);
            
            // Delete user's sessions
            this.db.db.run('DELETE FROM sessions WHERE user_id = ?', [this.currentUser.id]);
            
            // Delete user account
            this.db.db.run('DELETE FROM users WHERE id = ?', [this.currentUser.id]);
            this.db.db.exec('COMMIT');
        } catch (error) {
            this.db.db.exec('ROLLBACK');
            throw error;
        }

        // Logout
        this.logout();

        console.log('User account deleted successfully');
    }

    /**
     * Clean expired sessions
     */
    cleanExpiredSessions() {
        if (!this.isInitialized) {
            return 0;
        }

        const result = this.db.db.run(
            'DELETE FROM sessions WHERE expires_at < datetime("now")'
        );

        if (result.changes > 0) {
            console.log(`Cleaned ${result.changes} expired sessions`);
        }

        return result.changes;
    }

    /**
     * Check if user is authenticated
     */
    isUserAuthenticated() {
        return this.isAuthenticated && this.currentUser !== null;
    }

    /**
     * Get current user info
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Auth state change callback
     */
    onAuthStateChange() {
        // Override this method to handle auth state changes
        // This will be called when user logs in/out
        if (window.onAuthStateChange && typeof window.onAuthStateChange === 'function') {
            window.onAuthStateChange(this.isAuthenticated, this.currentUser);
        }
    }

    /**
     * Initialize with demo admin user for testing
     */
    async initializeDemoUser() {
        if (!this.isInitialized || !this.db.isInitialized) {
            return;
        }

        try {
            // Check if any users exist
            const userCountStmt = this.db.db.prepare('SELECT COUNT(*) as count FROM users');
            const userCount = userCountStmt.step() ? userCountStmt.getAsObject() : { count: 0 };
            userCountStmt.free();
            
            if (userCount && userCount.count === 0) {
                try {
                    // Use the proper createUser method instead of direct SQL
                    const demoUser = await this.db.createUser('admin@pcbeditor.com', 'admin', 'admin123');
                    
                    // Update role to admin using proper type handling
                    const updateStmt = this.db.db.prepare('UPDATE users SET role = ? WHERE id = ?');
                    updateStmt.run([String('admin'), String(demoUser.id)]);
                    updateStmt.free();

                    console.log('Demo admin user created: admin@pcbeditor.com / admin123');
                } catch (error) {
                    console.error('Failed to create demo admin user:', error);
                }
            }
        } catch (error) {
            console.error('Error checking user count:', error);
        }
    }
}

// Export for use in other modules
window.AuthManager = AuthManager;
