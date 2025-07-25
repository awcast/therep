/**
 * Database Manager for user authentication and PCB library
 * Uses SQL.js for client-side SQLite database
 */
const isBrowser = typeof window !== 'undefined';

class DatabaseManager {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        if (isBrowser || (typeof global !== 'undefined' && global.SQL)) {
            this.init();
        }
    }

    /**
     * Initialize the database
     */
    async init() {
        try {
            let SQL;
            if (isBrowser) {
                if (!window.SQL) {
                    const loaded = await initSqlJs({
                        locateFile: file => `https://sql.js.org/dist/${file}`
                    });
                    window.SQL = loaded;
                }
                SQL = window.SQL;
            } else if (typeof global !== 'undefined' && global.SQL) {
                SQL = global.SQL;
            } else {
                throw new Error('SQL.js is not loaded in this environment');
            }

            // Try to load existing database from localStorage if available
            const savedData = typeof localStorage !== 'undefined'
                ? localStorage.getItem('pcb-editor-database')
                : null;
            if (savedData) {
                try {
                    const buffer = JSON.parse(savedData);
                    const data = new Uint8Array(buffer);
                    this.db = new SQL.Database(data);
                    console.log('Loaded existing database from localStorage');
                    
                    // Check if schema is compatible - if not, recreate
                    try {
                        // Test the schema by trying to query with expected column types
                        const testStmt = this.db.prepare("SELECT id, email, username, created_at FROM users LIMIT 1");
                        testStmt.step();
                        testStmt.free();
                        
                        // Also check if columns have proper types by doing a test insert/rollback
                        this.db.run("BEGIN TRANSACTION");
                        try {
                            const insertStmt = this.db.prepare("INSERT INTO users (id, email, username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)");
                            insertStmt.run(["test_id", "test@test.com", "testuser", "Test User", "testhash", new Date().toISOString()]);
                            insertStmt.free();
                            this.db.run("ROLLBACK");
                        } catch (insertError) {
                            this.db.run("ROLLBACK");
                            throw insertError;
                        }
                    } catch (schemaError) {
                        console.warn('Database schema incompatible, recreating:', schemaError);
                        this.db.close();
                        this.db = new SQL.Database();
                        if (typeof localStorage !== 'undefined') {
                            localStorage.removeItem('pcb-editor-database');
                        }
                    }
                } catch (error) {
                    console.warn('Failed to load saved database, creating new:', error);
                    this.db = new SQL.Database();
                }
            } else {
                this.db = new SQL.Database();
                console.log('Created new database');
            }

            // Create tables
            await this.createTables();
            
            this.isInitialized = true;
            console.log('Database initialized successfully');
            
            // Add debug method to global scope for testing
            if (isBrowser && typeof window !== 'undefined') {
                window.clearDatabase = () => this.clearDatabase();
                window.resetPCBDatabase = async () => {
                    try {
                        await this.clearDatabase();
                        console.log('Database reset complete');
                        return true;
                    } catch (error) {
                        console.error('Failed to reset database:', error);
                        return false;
                    }
                };
                console.log('Debug: Use clearDatabase() or resetPCBDatabase() to reset the database if needed');
            }
            
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw new Error('Database initialization failed: ' + error.message);
        }
    }

    /**
     * Create database tables
     */
    async createTables() {
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_login TEXT,
                is_active INTEGER DEFAULT 1,
                role TEXT DEFAULT 'user',
                last_modified TEXT DEFAULT (datetime('now'))
            );
        `;

        const createSessionsTable = `
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL,
                email TEXT NOT NULL,
                username TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                expires_at TEXT NOT NULL,
                remember_me INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `;

        const createUserLibrariesTable = `
            CREATE TABLE IF NOT EXISTS user_libraries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                last_accessed TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `;

        const createPcbsTable = `
            CREATE TABLE IF NOT EXISTS pcbs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pcb_id TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                description TEXT DEFAULT '',
                source TEXT DEFAULT 'unknown',
                upload_date TEXT DEFAULT (datetime('now')),
                last_modified TEXT DEFAULT (datetime('now')),
                data TEXT NOT NULL,
                thumbnail TEXT,
                tags TEXT,
                stats TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `;

        // Execute table creation
        this.db.run(createUsersTable);
        this.db.run(createSessionsTable);
        this.db.run(createUserLibrariesTable);
        this.db.run(createPcbsTable);

        // Create indexes for better performance
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_pcbs_user_id ON pcbs (user_id);');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_pcbs_pcb_id ON pcbs (pcb_id);');

        console.log('Database tables created successfully');
    }

    /**
     * Save database to localStorage
     */
    saveDatabase() {
        if (!this.db) return;

        try {
            const data = this.db.export();
            const buffer = Array.from(data);
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('pcb-editor-database', JSON.stringify(buffer));
            }
        } catch (error) {
            console.error('Failed to save database:', error);
        }
    }

    /**
     * Clear database and recreate tables (for debugging/reset)
     */
    async clearDatabase() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('pcb-editor-database');
            }
            
            // Drop all tables
            this.db.run('DROP TABLE IF EXISTS users');
            this.db.run('DROP TABLE IF EXISTS sessions');
            this.db.run('DROP TABLE IF EXISTS user_libraries');
            this.db.run('DROP TABLE IF EXISTS pcbs');
            
            // Recreate tables
            await this.createTables();
            this.saveDatabase();
            
            console.log('Database cleared and recreated');
        } catch (error) {
            console.error('Failed to clear database:', error);
            throw error;
        }
    }

    /**
     * Generate a unique user ID
     */
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Hash password using Web API
     */
    async hashPassword(password) {
        // Use the same salt as AuthManager to ensure consistency
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'pcb-editor-salt');
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Create a new user
     */
    async createUser(email, username, password) {
        // Wait for database initialization
        if (!this.isInitialized) {
            throw new Error('Database not initialized yet');
        }
        
        // Validate inputs
        if (!email || !username || !password) {
            throw new Error('Email, username, and password are required');
        }
        
        // Ensure all inputs are strings
        const cleanEmail = String(email).trim();
        const cleanUsername = String(username).trim();
        const cleanPassword = String(password);
        
        if (!cleanEmail || !cleanUsername || !cleanPassword) {
            throw new Error('All fields must be non-empty');
        }
        
        try {
            const hashedPassword = await this.hashPassword(cleanPassword);
            const userId = this.generateUserId();
            const createdAt = new Date().toISOString();
            
            // Check if database is still valid
            if (!this.db) {
                throw new Error('Database connection lost');
            }
            
            const stmt = this.db.prepare(`
                INSERT INTO users (id, email, username, display_name, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            try {
                // Ensure all parameters are the correct type
                const params = [
                    String(userId),         // TEXT
                    String(cleanEmail),     // TEXT
                    String(cleanUsername),  // TEXT
                    String(cleanUsername),  // TEXT (display_name)
                    String(hashedPassword), // TEXT
                    String(createdAt)       // TEXT
                ];
                
                console.log('Creating user with params:', params);
                stmt.run(params);

                // Create corresponding user library entry
                const libStmt = this.db.prepare(`
                    INSERT INTO user_libraries (user_id, username, display_name)
                    VALUES (?, ?, ?)
                `);
                const libParams = [
                    String(userId),         // TEXT
                    String(cleanUsername),  // TEXT
                    String(cleanUsername)   // TEXT
                ];
                libStmt.run(libParams);
                libStmt.free();

                this.saveDatabase();
                return {
                    id: userId,
                    email: cleanEmail,
                    username: cleanUsername,
                    displayName: cleanUsername,
                    createdAt: createdAt
                };
            } catch (error) {
                console.error('Database execute error:', error);
                if (error.message.includes('UNIQUE constraint failed')) {
                    if (error.message.includes('email')) {
                        throw new Error('Email already exists');
                    } else if (error.message.includes('username')) {
                        throw new Error('Username already exists');
                    }
                }
                throw new Error('Failed to create user: ' + error.message);
            } finally {
                stmt.free();
            }
        } catch (error) {
            console.error('Error in createUser:', error);
            throw error;
        }
    }

    /**
     * Verify user credentials
     */
    async verifyUser(email, password) {
        const hashedPassword = await this.hashPassword(password);
        
        const stmt = this.db.prepare(`
            SELECT id, email, username, display_name, created_at
            FROM users
            WHERE email = ? AND password_hash = ? AND is_active = 1
        `);
        stmt.bind([email, hashedPassword]);
        
        try {
            const result = stmt.step() ? stmt.getAsObject() : null;
            
            if (result) {
                // Update last login
                this.updateLastLogin(result.id);
                
                return {
                    id: result.id,
                    email: result.email,
                    username: result.username,
                    displayName: result.display_name,
                    createdAt: result.created_at
                };
            }
            
            return null;
        } finally {
            stmt.free();
        }
    }

    /**
     * Update user's last login time
     */
    updateLastLogin(userId) {
        const stmt = this.db.prepare(`
            UPDATE users 
            SET last_login = datetime('now'), last_modified = datetime('now') 
            WHERE id = ?
        `);
        
        try {
            stmt.run([userId]);
            this.saveDatabase();
        } finally {
            stmt.free();
        }
    }

    /**
     * Create a session token
     */
    createSession(user, rememberMe = false) {
        const token = this.generateSessionToken();
        const expiresAt = new Date();
        
        if (rememberMe) {
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
        } else {
            expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
        }
        
        const stmt = this.db.prepare(`
            INSERT INTO sessions (token, user_id, email, username, expires_at, remember_me) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        try {
            stmt.run([token, user.id, user.email, user.username, expiresAt.toISOString(), rememberMe ? 1 : 0]);
            this.saveDatabase();
            return token;
        } finally {
            stmt.free();
        }
    }

    /**
     * Generate session token
     */
    generateSessionToken() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
    }

    /**
     * Validate session token
     */
    validateSession(token) {
        const stmt = this.db.prepare(`
            SELECT s.*, u.display_name
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1
        `);
        stmt.bind([token]);
        
        try {
            const result = stmt.step() ? stmt.getAsObject() : null;
            
            if (result) {
                return {
                    id: result.user_id,
                    email: result.email,
                    username: result.username,
                    displayName: result.display_name,
                    token: result.token,
                    rememberMe: result.remember_me === 1
                };
            }
            
            return null;
        } finally {
            stmt.free();
        }
    }

    /**
     * Delete session
     */
    deleteSession(token) {
        const stmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
        
        try {
            stmt.run([token]);
            this.saveDatabase();
        } finally {
            stmt.free();
        }
    }

    /**
     * Clean expired sessions
     */
    cleanExpiredSessions() {
        const stmt = this.db.prepare('DELETE FROM sessions WHERE expires_at < datetime("now")');
        
        try {
            const result = stmt.run();
            this.saveDatabase();
            
            if (result.changes > 0) {
                console.log(`Cleaned ${result.changes} expired sessions`);
            }
            
            return result.changes;
        } finally {
            stmt.free();
        }
    }

    /**
     * Get user by ID
     */
    getUserById(userId) {
        const stmt = this.db.prepare(`
            SELECT id, email, username, display_name, created_at, last_login
            FROM users
            WHERE id = ? AND is_active = 1
        `);
        stmt.bind([userId]);
        
        try {
            const result = stmt.step() ? stmt.getAsObject() : null;
            
            if (result) {
                return {
                    id: result.id,
                    email: result.email,
                    username: result.username,
                    displayName: result.display_name,
                    createdAt: result.created_at,
                    lastLogin: result.last_login
                };
            }
            
            return null;
        } finally {
            stmt.free();
        }
    }

    /**
     * Get all users (for admin purposes)
     */
    getAllUsers() {
        const stmt = this.db.prepare(`
            SELECT id, email, username, display_name, created_at, last_login, is_active 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        const users = [];
        try {
            while (stmt.step()) {
                const row = stmt.getAsObject();
                users.push({
                    id: row.id,
                    email: row.email,
                    username: row.username,
                    displayName: row.display_name,
                    createdAt: row.created_at,
                    lastLogin: row.last_login,
                    isActive: row.is_active === 1
                });
            }
            return users;
        } finally {
            stmt.free();
        }
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.saveDatabase();
            this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
    }
}

// Export for browser or Node.js environments
if (typeof window !== 'undefined') {
    window.DatabaseManager = DatabaseManager;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
}
