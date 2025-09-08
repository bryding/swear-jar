const crypto = require('crypto');

class AuthManager {
    constructor(storage, isProduction = false) {
        this.storage = storage;
        this.isProduction = isProduction;
        this.PIN = process.env.AUTH_PIN || '09540';
        this.TOKEN_EXPIRY = parseInt(process.env.AUTH_TOKEN_EXPIRY) || 30 * 24 * 60 * 60 * 1000; // 30 days
        this.rateLimitMap = new Map(); // IP -> { attempts, lastAttempt, lockUntil }
        
        console.log('🔐 Auth initialized with PIN:', this.PIN ? 'SET' : 'NOT SET');
    }

    // Generate cryptographically secure token
    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Constant-time string comparison to prevent timing attacks
    secureCompare(a, b) {
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    // Check rate limiting for IP
    checkRateLimit(ip) {
        const now = Date.now();
        const record = this.rateLimitMap.get(ip) || { attempts: 0, lastAttempt: 0, lockUntil: 0 };

        // If still locked, deny
        if (now < record.lockUntil) {
            const remainingSeconds = Math.ceil((record.lockUntil - now) / 1000);
            return { allowed: false, remainingSeconds };
        }

        // Reset if last attempt was over 15 minutes ago
        if (now - record.lastAttempt > 15 * 60 * 1000) {
            record.attempts = 0;
        }

        return { allowed: record.attempts < 30 };
    }

    // Record failed attempt
    recordFailedAttempt(ip) {
        const now = Date.now();
        const record = this.rateLimitMap.get(ip) || { attempts: 0, lastAttempt: 0, lockUntil: 0 };
        
        record.attempts++;
        record.lastAttempt = now;

        // Lock after 30 failed attempts for 15 minutes
        if (record.attempts >= 30) {
            record.lockUntil = now + (15 * 60 * 1000);
        }

        this.rateLimitMap.set(ip, record);
        
        console.log(`🚫 Failed auth attempt from ${ip}. Attempts: ${record.attempts}`);
    }

    // Reset rate limit on successful auth
    resetRateLimit(ip) {
        this.rateLimitMap.delete(ip);
        console.log(`✅ Rate limit reset for ${ip}`);
    }

    // Validate PIN
    async validatePin(pin, ip) {
        // Check rate limiting first
        const rateCheck = this.checkRateLimit(ip);
        if (!rateCheck.allowed) {
            if (rateCheck.remainingSeconds) {
                throw new Error(`Too many failed attempts. Try again in ${rateCheck.remainingSeconds} seconds.`);
            } else {
                throw new Error('Too many failed attempts. Try again later.');
            }
        }

        // Validate PIN using constant-time comparison
        const isValid = this.secureCompare(pin.toString(), this.PIN.toString());
        
        if (!isValid) {
            this.recordFailedAttempt(ip);
            throw new Error('Invalid PIN');
        }

        // Generate and store new token
        const token = this.generateToken();
        const expiresAt = Date.now() + this.TOKEN_EXPIRY;
        
        await this.storeToken(token, expiresAt);
        this.resetRateLimit(ip);
        
        console.log(`🔑 New device authenticated from ${ip}`);
        return { token, expiresAt };
    }

    // Store token with expiration
    async storeToken(token, expiresAt) {
        const tokenData = {
            expiresAt,
            createdAt: Date.now()
        };

        if (this.isProduction && this.storage.redis) {
            // Store in Redis with TTL
            const ttlSeconds = Math.floor((expiresAt - Date.now()) / 1000);
            await this.storage.redis.setEx(`auth:${token}`, ttlSeconds, JSON.stringify(tokenData));
        } else {
            // Store in file
            const authData = await this.getAuthData();
            authData.tokens[token] = tokenData;
            await this.saveAuthData(authData);
        }
    }

    // Validate token
    async validateToken(token) {
        if (!token) return false;

        try {
            let tokenData;

            if (this.isProduction && this.storage.redis) {
                // Check Redis
                const data = await this.storage.redis.get(`auth:${token}`);
                if (!data) return false;
                tokenData = JSON.parse(data);
            } else {
                // Check file
                const authData = await this.getAuthData();
                tokenData = authData.tokens[token];
                if (!tokenData) return false;
            }

            // Check if token expired
            if (Date.now() > tokenData.expiresAt) {
                await this.removeToken(token);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating token:', error);
            return false;
        }
    }

    // Remove expired token
    async removeToken(token) {
        if (this.isProduction && this.storage.redis) {
            await this.storage.redis.del(`auth:${token}`);
        } else {
            const authData = await this.getAuthData();
            delete authData.tokens[token];
            await this.saveAuthData(authData);
        }
    }

    // Get auth data from file (for local development)
    async getAuthData() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const authFile = path.join(__dirname, 'auth.json');
            const data = await fs.readFile(authFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // Return default structure if file doesn't exist
            return { tokens: {} };
        }
    }

    // Save auth data to file (for local development)
    async saveAuthData(data) {
        const fs = require('fs').promises;
        const path = require('path');
        const authFile = path.join(__dirname, 'auth.json');
        await fs.writeFile(authFile, JSON.stringify(data, null, 2));
    }

    // Cleanup expired tokens (run periodically)
    async cleanupExpiredTokens() {
        if (this.isProduction && this.storage.redis) {
            // Redis handles TTL automatically
            return;
        }

        // Manual cleanup for file storage
        const authData = await this.getAuthData();
        const now = Date.now();
        let cleaned = 0;

        for (const [token, data] of Object.entries(authData.tokens)) {
            if (now > data.expiresAt) {
                delete authData.tokens[token];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            await this.saveAuthData(authData);
            console.log(`🧹 Cleaned up ${cleaned} expired tokens`);
        }
    }

    // Middleware to protect routes
    middleware() {
        return async (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

            if (!token) {
                return res.status(401).json({ 
                    error: 'Authentication required',
                    code: 'NO_TOKEN'
                });
            }

            const isValid = await this.validateToken(token);
            if (!isValid) {
                return res.status(401).json({ 
                    error: 'Invalid or expired token',
                    code: 'INVALID_TOKEN'
                });
            }

            next();
        };
    }
}

module.exports = AuthManager;