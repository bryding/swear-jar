# 🫙 Swear Jar App

Mobile-optimized swear jar tracker with real-time sync across devices.

## Quick Start

```bash
cd server
npm install
npm start
```

Open `http://localhost:3000` in your browser.

## Development

- **Local mode**: Uses file storage (`data.json`) when no Redis URL provided
- **Production**: Requires Redis for multi-device sync
- **Dev console**: Use `setBen(10)` and `setKaiti(5)` in browser dev tools for testing

## Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test server/tests/        # Backend tests
npm test tests/integration/   # Integration tests  
npm test tests/frontend/      # Frontend tests
```

Comprehensive test coverage for authentication, API security, rate limiting, and frontend components.

## Environment Setup

### Local Development
```bash
# Default PIN (change in production!)
AUTH_PIN=09540

# Optional - enables Redis storage
REDIS_URL=redis://localhost:6379

# Optional - custom port (default: 3000)
PORT=3000

# Optional - token expiry in milliseconds (default: 30 days)
AUTH_TOKEN_EXPIRY=2592000000
```

### Production Deployment
```bash
# Required
NODE_ENV=production
AUTH_PIN=your-secure-pin

# Redis connection (required for multi-device sync)
REDIS_PRIVATE_URL=redis://user:pass@host:port
# OR
REDIS_URL=redis://user:pass@host:port

# Optional
PORT=3000
AUTH_TOKEN_EXPIRY=2592000000
```

**Notes:**
- Without Redis, uses local file storage (single-device only)
- PIN authentication protects against unauthorized access  
- Tokens expire after 30 days by default
- Rate limiting: 30 failed attempts = 15 minute lockout

---

See `CLAUDE.md` for detailed technical documentation.