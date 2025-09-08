# 🫙 Swear Jar App - Technical Documentation

This file contains detailed technical information for Claude Code about the swear jar application.

## Project Overview

A modern, mobile-optimized swear jar tracker for Ben and Kaiti with real-time synchronization across devices. Built with Node.js/Express backend and vanilla JavaScript frontend.

## Features

- 🎯 **Two-person tracking**: Separate buttons and counters for Ben and Kaiti with profile photos
- 🔄 **Real-time sync**: Both phones see the same counts instantly with Redis/file storage
- 💰 **Payout & reset**: Button shows total amount and resets both jars to zero
- 📱 **Mobile optimized**: Full-screen design that fits any phone perfectly (no scrolling)
- ✨ **Modern animations**: Smooth hover effects, shimmer animations, and counter updates
- 🛠️ **Dev console**: Set jar values directly from browser dev tools
- 🎨 **Custom favicon**: Branded swear jar icon for browser tabs
- 🌐 **Dual storage**: Redis for production, file storage for local development

## API Endpoints

- `GET /api/status` - Check database connection status
- `GET /api/counts` - Get current swear counts
- `POST /api/swear/:person` - Increment count for person (ben/kaiti)
- `PUT /api/counts/:person` - Set specific count for person
- `POST /api/payout` - Reset all counts to zero
- `POST /api/auth/validate` - PIN authentication with rate limiting
- `GET /api/auth/validate-token` - Token validation

## Testing

**Comprehensive test suite with 66 tests across 3 environments:**

- **Backend Tests** (25 tests): Authentication, rate limiting, token management, API endpoints
- **Integration Tests** (11 tests): End-to-end authentication flows, multi-user sessions, error recovery
- **Frontend Tests** (3 tests): DOM structure, PIN input validation

**Key Features Tested:**
- PIN-based authentication with timing attack resistance
- Rate limiting (30 attempts/15min lockout) with IP isolation
- Token storage/validation (Redis + file fallback)
- API endpoint security and validation
- Malformed request handling

```bash
npm test  # All tests (66/66 passing)
```

## Dev Console Commands

Set jar values directly from browser dev tools:

```javascript
// Set Ben's count
setBen(10)

// Set Kaiti's count  
setKaiti(5)
```

Open browser dev console (F12) and use these commands for testing and manual adjustments.

## File Structure

```
swear-jar/
├── server/
│   ├── package.json       # Dependencies and scripts
│   ├── server.js          # Express server with dual storage (Redis/file)
│   ├── auth.js            # Authentication manager with rate limiting
│   ├── data.json          # Local development storage
│   └── tests/             # Backend unit tests
├── tests/
│   ├── frontend/          # Frontend DOM tests (JSDOM)
│   └── integration/       # End-to-end API tests  
├── public/
│   ├── index.html         # Mobile-optimized UI
│   ├── style.css          # Modern responsive styles with animations
│   ├── script.js          # Client-side JavaScript with dev console commands
│   ├── favicon.svg        # Custom swear jar icon
│   └── images/            # Profile photos
│       ├── ben.jpg        # Ben's profile photo
│       └── kaiti.jpg      # Kaiti's profile photo
├── jest.config.js        # Jest configuration for multiple test environments
├── CLAUDE.md             # This technical documentation
└── README.md             # Basic project info and setup
```

## Storage & Sync

- **Production**: Redis database for real-time multi-device synchronization
- **Development**: Local JSON file storage for offline development
- **Persistence**: All counts survive server restarts
- **Validation**: Non-negative integers only, server-side validation
- **Mobile PWA**: Add to home screen for native app-like experience

## Environment Variables

```bash
# Production (required)
NODE_ENV=production
REDIS_PRIVATE_URL=redis://...  # or REDIS_URL
RAILWAY_ENVIRONMENT=production

# Development (optional)
REDIS_URL=redis://...  # Falls back to file storage if not provided
```

## Design Features

- **Full-screen mobile design**: Perfectly fits any phone screen with no scrolling
- **Modern UI**: Glassmorphism effects, vibrant gradients, and smooth animations
- **Profile integration**: Custom profile photos displayed as circular avatars
- **Touch-optimized**: Large, responsive buttons with haptic-like feedback
- **Real-time updates**: Live count syncing with animated transitions
- **Dollar display**: Visual currency indicators on all counts
- **Connection status**: Smart loading screens and error handling

## Deployment Options

### Railway (Recommended)
1. Create account at [Railway](https://railway.app)
2. Connect your GitHub repository
3. Deploy the `server` directory
4. Add Redis database service
5. Set environment variables:
   - `REDIS_PRIVATE_URL` or `REDIS_URL` (provided by Railway Redis)
   - `NODE_ENV=production`
6. Railway will auto-detect Node.js and run `npm start`

### Heroku
1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Create new app:
   ```bash
   heroku create your-swear-jar-app
   ```
3. Deploy from server directory:
   ```bash
   cd server
   git init
   git add .
   git commit -m "Initial commit"
   heroku git:remote -a your-swear-jar-app
   git push heroku main
   ```

### Vercel
1. Install [Vercel CLI](https://vercel.com/cli)
2. Deploy:
   ```bash
   cd server
   vercel
   ```

## Technical Implementation

### Server Architecture
- Express.js server with dual storage backend
- Redis for production multi-device sync
- File-based storage for local development
- Graceful fallback and error handling
- Environment-based configuration

### Frontend Architecture  
- Vanilla JavaScript with ES6+ features
- CSS Grid/Flexbox responsive layout
- CSS animations and transitions
- Fetch API for server communication
- Dev tools integration for testing

### Mobile Optimization
- Dynamic viewport height (100dvh) for full screen
- Touch-friendly button sizing and spacing
- Responsive design for various screen sizes
- PWA capabilities for native app experience
- Optimized for both portrait and landscape

---

Built with ❤️ for reducing swearing around little ones! 🫙✨