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

**Coverage**: 66 tests across authentication, API endpoints, rate limiting, and UI components.

## Environment Setup

```bash
# Optional for local development
REDIS_URL=redis://...

# Required for production  
NODE_ENV=production
REDIS_PRIVATE_URL=redis://...
```

---

See `CLAUDE.md` for detailed technical documentation.