# Swear Jar App - Technical Plan

## Overview
A shared swear jar tracking app for Ben and Kaiti to monitor swearing in front of their 18-month-old son. Both users can access the same counts from their phones in real-time.

## Architecture

### Client-Server Model
- **Frontend**: Clean, mobile-friendly web app (HTML/CSS/JS)
- **Backend**: Node.js server with Express.js
- **Data Storage**: Simple JSON file for persistence
- **Deployment**: Server hosted (Heroku, Railway, or similar), client served from server

## Features

### Core Functionality
1. **Two person counters**: Ben and Kaiti buttons
2. **Real-time sync**: Both phones see same counts instantly
3. **Payout button**: Reset both counters to zero
4. **Mobile-optimized**: Large touch-friendly buttons
5. **Clean animations**: Button press feedback, counter updates

### Technical Requirements
- Responsive design for mobile screens
- Fast loading and minimal data usage
- Simple, reliable server with basic error handling
- No user authentication needed (private app)

## File Structure
```
swear-jar/
├── server/
│   ├── package.json
│   ├── server.js
│   ├── cli.js
│   └── data.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## API Design

### Endpoints
- `GET /api/counts` - Get current swear counts
- `POST /api/swear/:person` - Increment count for person (ben/kaiti)
- `PUT /api/counts/:person` - Set specific count for person (ben/kaiti)
- `POST /api/payout` - Reset all counts to zero

### Input Validation
- All count values must be non-negative integers (>= 0)
- Invalid values return 400 Bad Request with error message
- Person parameter must be either "ben" or "kaiti"

### Data Format
```json
{
  "ben": 0,
  "kaiti": 0,
  "lastUpdated": "2025-09-07T10:30:00Z"
}
```

## UI Design

### Layout (No-Scroll Portrait Design)
- **Header**: "Swear Jar" title (compact, ~10% height)
- **Main Area**: Two large buttons side-by-side (~70% height)
  - Ben's button (left): Shows name + count
  - Kaiti's button (right): Shows name + count
- **Footer**: Payout button (full width, ~20% height)
- **Critical**: Must fit entirely on standard phone screens (375x667px minimum)
- **No vertical scrolling required** - all elements visible at once

### Styling
- Clean, modern design with rounded corners
- Bright, distinct colors for each person
- Smooth animations on button press
- Large, readable fonts
- Mobile-first responsive design

### Animations
- Button press: Scale down effect
- Counter update: Number fade/slide animation
- Payout: Celebration effect (confetti or pulse)

## Technology Stack

### Backend
- **Node.js** with **Express.js**
- **fs/promises** for JSON file operations
- **cors** middleware for cross-origin requests

### Frontend
- **Vanilla HTML/CSS/JavaScript**
- **CSS Grid/Flexbox** for layout
- **CSS animations** for interactions
- **Fetch API** for server communication

## Deployment Strategy

### Development
- Local server on port 3000
- Hot reload during development

### Production
- Deploy server to cloud platform (Heroku/Railway)
- Serve static files from Express
- Environment variables for configuration

## Security Considerations
- No sensitive data stored
- Simple rate limiting on API endpoints
- CORS configured for security
- Input validation on server

## Success Criteria
- ✅ Both users can increment their counters
- ✅ Counts sync in real-time across devices
- ✅ Payout resets both counters
- ✅ App loads quickly on mobile
- ✅ Clean, intuitive interface
- ✅ Smooth animations enhance UX

## CLI Tool

### Command Line Interface
A simple Node.js script for manual jar management:

```bash
# Set specific values
node cli.js set ben 5
node cli.js set kaiti 3

# View current counts  
node cli.js status

# Reset all counts
node cli.js payout
```

### CLI Features
- Validates non-negative integers
- Connects to local or deployed server
- Clear error messages for invalid input
- Confirmation prompts for destructive operations

## Next Steps
1. Set up Node.js server with Express
2. Implement API endpoints with JSON file storage and validation
3. Create CLI tool for manual jar management
4. Create responsive HTML/CSS interface (no-scroll design)
5. Add JavaScript for API communication
6. Test on multiple devices and screen sizes
7. Deploy to production

---
*Ready for implementation pending approval* ✨