#!/usr/bin/env node

/**
 * FiLine Wall Interactive Setup Wizard
 * Node.js-based guided configuration and database initialization
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

class SetupWizard {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.config = {};
        this.installDir = process.cwd();
    }

    // Utility methods
    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    info(message) {
        this.log(`ℹ️  ${message}`, 'blue');
    }

    success(message) {
        this.log(`✅ ${message}`, 'green');
    }

    warning(message) {
        this.log(`⚠️  ${message}`, 'yellow');
    }

    error(message) {
        this.log(`❌ ${message}`, 'red');
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(`${colors.cyan}${prompt}${colors.reset}`, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async confirm(prompt, defaultValue = false) {
        const defaultText = defaultValue ? 'Y/n' : 'y/N';
        const answer = await this.question(`${prompt} (${defaultText}): `);
        
        if (answer === '') return defaultValue;
        return answer.toLowerCase().startsWith('y');
    }

    generateSecureKey() {
        return crypto.randomBytes(32).toString('base64');
    }

    // Header display
    showHeader() {
        console.clear();
        this.log('╔══════════════════════════════════════════════╗', 'blue');
        this.log('║                FiLine Wall                   ║', 'blue');
        this.log('║           Interactive Setup Wizard          ║', 'blue');
        this.log('║                                              ║', 'blue');
        this.log('║   🚀 Guided Configuration & Installation    ║', 'blue');
        this.log('╚══════════════════════════════════════════════╝', 'blue');
        console.log();
    }

    // Welcome and introduction
    async showWelcome() {
        this.info('Welcome to the FiLine Wall setup wizard!');
        console.log();
        console.log('This wizard will help you:');
        console.log('• Configure your environment settings');
        console.log('• Set up database connections');
        console.log('• Initialize the database schema');
        console.log('• Configure external services');
        console.log('• Create an admin user');
        console.log();
        
        const proceed = await this.confirm('Would you like to continue?', true);
        if (!proceed) {
            this.info('Setup cancelled. Run this script again when ready.');
            process.exit(0);
        }
    }

    // Check prerequisites
    async checkPrerequisites() {
        this.info('Checking prerequisites...');
        
        const checks = [
            { command: 'node', args: ['--version'], name: 'Node.js', required: true },
            { command: 'npm', args: ['--version'], name: 'npm', required: true },
            { command: 'psql', args: ['--version'], name: 'PostgreSQL', required: false },
            { command: 'redis-cli', args: ['--version'], name: 'Redis', required: false }
        ];

        for (const check of checks) {
            try {
                const result = await this.runCommand(check.command, check.args);
                if (result.code === 0) {
                    this.success(`${check.name} is installed`);
                } else {
                    throw new Error('Command failed');
                }
            } catch (error) {
                if (check.required) {
                    this.error(`${check.name} is required but not installed`);
                    process.exit(1);
                } else {
                    this.warning(`${check.name} is not installed (optional)`);
                }
            }
        }
        console.log();
    }

    // Database configuration
    async configureDatabases() {
        this.info('Database Configuration');
        console.log();

        // PostgreSQL configuration
        this.log('PostgreSQL Database:', 'bright');
        this.config.dbHost = await this.question('Database host [localhost]: ') || 'localhost';
        this.config.dbPort = await this.question('Database port [5432]: ') || '5432';
        this.config.dbName = await this.question('Database name [filinewall]: ') || 'filinewall';
        this.config.dbUser = await this.question('Database username [filinewall]: ') || 'filinewall';
        this.config.dbPassword = await this.question('Database password: ');
        
        if (!this.config.dbPassword) {
            this.config.dbPassword = crypto.randomBytes(16).toString('hex');
            this.info(`Generated secure password: ${this.config.dbPassword}`);
        }

        // Test database connection
        const testDb = await this.confirm('Test database connection now?', true);
        if (testDb) {
            await this.testDatabaseConnection();
        }

        console.log();

        // Redis configuration
        this.log('Redis Configuration:', 'bright');
        const useRedis = await this.confirm('Use Redis for caching?', true);
        
        if (useRedis) {
            this.config.redisHost = await this.question('Redis host [localhost]: ') || 'localhost';
            this.config.redisPort = await this.question('Redis port [6379]: ') || '6379';
            this.config.redisPassword = await this.question('Redis password (leave empty if none): ');
        }

        console.log();
    }

    // Application configuration
    async configureApplication() {
        this.info('Application Configuration');
        console.log();

        this.config.port = await this.question('API server port [5000]: ') || '5000';
        this.config.nodeEnv = await this.question('Environment [production]: ') || 'production';
        
        // Generate JWT secret
        this.config.jwtSecret = this.generateSecureKey();
        this.success('Generated secure JWT secret');

        // Device encryption key
        this.config.deviceKey = this.generateSecureKey();
        this.success('Generated device encryption key');

        console.log();
    }

    // External services configuration
    async configureExternalServices() {
        this.info('External Services Configuration (Optional)');
        console.log();

        // Twilio
        const useTwilio = await this.confirm('Configure Twilio for SMS notifications?', false);
        if (useTwilio) {
            this.config.twilioSid = await this.question('Twilio Account SID: ');
            this.config.twilioToken = await this.question('Twilio Auth Token: ');
            this.config.twilioPhone = await this.question('Twilio Phone Number: ');
        }

        // Spam detection API
        const useSpamApi = await this.confirm('Configure external spam detection API?', false);
        if (useSpamApi) {
            this.config.spamApiKey = await this.question('Spam Detection API Key: ');
            this.config.spamApiUrl = await this.question('Spam Detection API URL: ');
        }

        // Email notifications
        const useEmail = await this.confirm('Configure email notifications?', false);
        if (useEmail) {
            this.config.smtpHost = await this.question('SMTP Host: ');
            this.config.smtpPort = await this.question('SMTP Port [587]: ') || '587';
            this.config.smtpUser = await this.question('SMTP Username: ');
            this.config.smtpPassword = await this.question('SMTP Password: ');
            this.config.emailFrom = await this.question('From Email Address: ');
        }

        console.log();
    }

    // Admin user configuration
    async configureAdminUser() {
        this.info('Admin User Configuration');
        console.log();

        this.config.adminUsername = await this.question('Admin username [admin]: ') || 'admin';
        this.config.adminEmail = await this.question('Admin email: ');
        
        while (!this.config.adminPassword) {
            this.config.adminPassword = await this.question('Admin password (min 8 characters): ');
            if (this.config.adminPassword.length < 8) {
                this.error('Password must be at least 8 characters long');
                this.config.adminPassword = '';
            }
        }

        this.config.adminPhone = await this.question('Admin phone number (optional): ');

        console.log();
    }

    // Generate environment file
    async generateEnvironmentFile() {
        this.info('Generating environment configuration...');

        const dbUrl = `postgresql://${this.config.dbUser}:${this.config.dbPassword}@${this.config.dbHost}:${this.config.dbPort}/${this.config.dbName}`;
        
        let redisUrl = '';
        if (this.config.redisHost) {
            redisUrl = this.config.redisPassword 
                ? `redis://:${this.config.redisPassword}@${this.config.redisHost}:${this.config.redisPort}`
                : `redis://${this.config.redisHost}:${this.config.redisPort}`;
        }

        const envContent = `# FiLine Wall Environment Configuration
# Generated by setup wizard on ${new Date().toISOString()}

# Database Configuration
DATABASE_URL=${dbUrl}

# Redis Configuration
${redisUrl ? `REDIS_URL=${redisUrl}` : '# REDIS_URL=redis://localhost:6379'}

# Application Configuration
NODE_ENV=${this.config.nodeEnv}
PORT=${this.config.port}
JWT_SECRET=${this.config.jwtSecret}

# Device Configuration
DEVICE_ENCRYPTION_KEY=${this.config.deviceKey}
DEVICE_API_ENDPOINT=http://localhost:${this.config.port}

# Admin User Configuration
ADMIN_USERNAME=${this.config.adminUsername}
ADMIN_EMAIL=${this.config.adminEmail}
ADMIN_PASSWORD=${this.config.adminPassword}
${this.config.adminPhone ? `ADMIN_PHONE=${this.config.adminPhone}` : '# ADMIN_PHONE='}

# External Services (Optional)
${this.config.twilioSid ? `TWILIO_ACCOUNT_SID=${this.config.twilioSid}` : '# TWILIO_ACCOUNT_SID='}
${this.config.twilioToken ? `TWILIO_AUTH_TOKEN=${this.config.twilioToken}` : '# TWILIO_AUTH_TOKEN='}
${this.config.twilioPhone ? `TWILIO_PHONE_NUMBER=${this.config.twilioPhone}` : '# TWILIO_PHONE_NUMBER='}

${this.config.spamApiKey ? `SPAM_API_KEY=${this.config.spamApiKey}` : '# SPAM_API_KEY='}
${this.config.spamApiUrl ? `SPAM_API_URL=${this.config.spamApiUrl}` : '# SPAM_API_URL='}

${this.config.smtpHost ? `SMTP_HOST=${this.config.smtpHost}` : '# SMTP_HOST='}
${this.config.smtpPort ? `SMTP_PORT=${this.config.smtpPort}` : '# SMTP_PORT=587'}
${this.config.smtpUser ? `SMTP_USER=${this.config.smtpUser}` : '# SMTP_USER='}
${this.config.smtpPassword ? `SMTP_PASSWORD=${this.config.smtpPassword}` : '# SMTP_PASSWORD='}
${this.config.emailFrom ? `EMAIL_FROM=${this.config.emailFrom}` : '# EMAIL_FROM='}

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Security Configuration
BCRYPT_ROUNDS=12
SESSION_TIMEOUT=3600
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Development Configuration (if NODE_ENV=development)
# DEBUG=filinewall:*
# MOCK_MODEM=true
`;

        try {
            fs.writeFileSync('.env', envContent);
            this.success('Environment file (.env) created successfully');
        } catch (error) {
            this.error(`Failed to create .env file: ${error.message}`);
            process.exit(1);
        }
    }

    // Install dependencies
    async installDependencies() {
        this.info('Installing Node.js dependencies...');

        try {
            await this.runCommand('npm', ['install'], true);
            this.success('Dependencies installed successfully');
        } catch (error) {
            this.error('Failed to install dependencies');
            throw error;
        }
    }

    // Initialize database
    async initializeDatabase() {
        this.info('Initializing database...');

        try {
            // Run database migrations
            if (fs.existsSync('drizzle.config.ts')) {
                await this.runCommand('npx', ['drizzle-kit', 'migrate'], true);
                this.success('Database schema initialized');
            } else {
                this.warning('No database migration configuration found');
            }

            // Seed initial data
            if (fs.existsSync('scripts/seed.js')) {
                await this.runCommand('node', ['scripts/seed.js'], true);
                this.success('Initial data seeded');
            }

        } catch (error) {
            this.error('Failed to initialize database');
            throw error;
        }
    }

    // Test database connection
    async testDatabaseConnection() {
        this.info('Testing database connection...');

        const dbUrl = `postgresql://${this.config.dbUser}:${this.config.dbPassword}@${this.config.dbHost}:${this.config.dbPort}/${this.config.dbName}`;
        
        try {
            // Simple connection test using psql
            const result = await this.runCommand('psql', [dbUrl, '-c', 'SELECT 1;']);
            if (result.code === 0) {
                this.success('Database connection successful');
            } else {
                throw new Error('Connection failed');
            }
        } catch (error) {
            this.error('Database connection failed');
            const retry = await this.confirm('Would you like to reconfigure database settings?', true);
            if (retry) {
                await this.configureDatabases();
            } else {
                throw error;
            }
        }
    }

    // Run system command
    async runCommand(command, args = [], showOutput = false) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, { 
                stdio: showOutput ? 'inherit' : 'pipe',
                shell: process.platform === 'win32'
            });

            let stdout = '';
            let stderr = '';

            if (!showOutput) {
                child.stdout?.on('data', (data) => stdout += data);
                child.stderr?.on('data', (data) => stderr += data);
            }

            child.on('close', (code) => {
                resolve({ code, stdout, stderr });
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    // Build application
    async buildApplication() {
        this.info('Building application...');

        try {
            await this.runCommand('npm', ['run', 'build'], true);
            this.success('Application built successfully');
        } catch (error) {
            this.error('Failed to build application');
            throw error;
        }
    }

    // Start services
    async startServices() {
        const startNow = await this.confirm('Start the application now?', true);
        
        if (startNow) {
            this.info('Starting FiLine Wall...');
            
            try {
                // Start in background
                const child = spawn('npm', ['start'], { 
                    detached: true,
                    stdio: 'ignore'
                });
                
                child.unref();
                
                // Wait a moment and test
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const healthCheck = await this.runCommand('curl', ['-s', `http://localhost:${this.config.port}/health`]);
                if (healthCheck.code === 0) {
                    this.success('Application started successfully');
                } else {
                    this.warning('Application may still be starting up');
                }
                
            } catch (error) {
                this.warning('Could not start application automatically');
                this.info('You can start it manually with: npm start');
            }
        }
    }

    // Show completion summary
    showCompletion() {
        console.log();
        this.log('╔══════════════════════════════════════════════╗', 'green');
        this.log('║            🎉 Setup Complete! 🎉            ║', 'green');
        this.log('╚══════════════════════════════════════════════╝', 'green');
        console.log();
        
        this.success('FiLine Wall has been configured successfully!');
        console.log();
        
        console.log('📋 Configuration Summary:');
        console.log(`   • Database: ${this.config.dbHost}:${this.config.dbPort}/${this.config.dbName}`);
        console.log(`   • API Port: ${this.config.port}`);
        console.log(`   • Environment: ${this.config.nodeEnv}`);
        console.log(`   • Admin User: ${this.config.adminUsername}`);
        console.log();
        
        console.log('🚀 Access your installation:');
        console.log(`   • Web Interface: http://localhost:${this.config.port}`);
        console.log(`   • API Health: http://localhost:${this.config.port}/health`);
        console.log();
        
        console.log('🔐 Admin Credentials:');
        console.log(`   • Username: ${this.config.adminUsername}`);
        console.log(`   • Email: ${this.config.adminEmail}`);
        console.log('   • Password: [as configured]');
        console.log();
        
        console.log('⚙️  Next Steps:');
        console.log('1. Start the application: npm start');
        console.log('2. Access the web interface and login');
        console.log('3. Configure your phone number lists');
        console.log('4. Connect and set up your modem device');
        console.log('5. Test call blocking functionality');
        console.log();
        
        console.log('📁 Important Files:');
        console.log('   • .env - Environment configuration');
        console.log('   • README.md - Documentation');
        console.log('   • DEPLOYMENT.md - Deployment guide');
        console.log();
        
        console.log('🆘 Support:');
        console.log('   • GitHub Repository for issues and documentation');
        console.log('   • Check logs for troubleshooting');
    }

    // Main setup flow
    async run() {
        try {
            this.showHeader();
            await this.showWelcome();
            await this.checkPrerequisites();
            await this.configureDatabases();
            await this.configureApplication();
            await this.configureExternalServices();
            await this.configureAdminUser();
            await this.generateEnvironmentFile();
            await this.installDependencies();
            await this.buildApplication();
            await this.initializeDatabase();
            await this.startServices();
            this.showCompletion();
            
        } catch (error) {
            this.error(`Setup failed: ${error.message}`);
            this.info('Please check the error above and try again.');
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nSetup interrupted. Exiting...');
    process.exit(0);
});

// Run the wizard
if (require.main === module) {
    const wizard = new SetupWizard();
    wizard.run().catch(console.error);
}

module.exports = SetupWizard;