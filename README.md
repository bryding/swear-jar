# 🫙 Swear Jar App

A clean, mobile-friendly swear jar tracker for Ben and Kaiti to help reduce swearing in front of their 18-month-old son. Both users can access the same jar counts from their phones in real-time.

## Features

- 🎯 **Two-person tracking**: Separate buttons and counters for Ben and Kaiti
- 🔄 **Real-time sync**: Both phones see the same counts instantly
- 💰 **Payout & reset**: Button to reset both jars to zero
- 📱 **Mobile optimized**: Designed for phone screens, no scrolling needed
- ✨ **Smooth animations**: Button press effects and counter updates
- 🛠️ **CLI management**: Set jar values manually via command line

## Quick Start

1. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open in browser**: 
   - Visit `http://localhost:3000`
   - Bookmark on your phones for app-like experience

## CLI Usage

The command line tool allows manual jar management:

```bash
# View current counts
node cli.js status

# Set specific values
node cli.js set ben 5
node cli.js set kaiti 3

# Reset everything
node cli.js payout

# Show help
node cli.js help
```

## API Endpoints

- `GET /api/counts` - Get current swear counts
- `POST /api/swear/:person` - Increment count for person (ben/kaiti)
- `PUT /api/counts/:person` - Set specific count for person
- `POST /api/payout` - Reset all counts to zero

## Deployment

### Option 1: Railway (Recommended)
1. Create account at [Railway](https://railway.app)
2. Connect your GitHub repository
3. Deploy the `server` directory
4. Railway will auto-detect Node.js and run `npm start`

### Option 2: Heroku
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

### Option 3: Vercel
1. Install [Vercel CLI](https://vercel.com/cli)
2. Deploy:
   ```bash
   cd server
   vercel
   ```

## File Structure

```
swear-jar/
├── server/
│   ├── package.json       # Dependencies and scripts
│   ├── server.js          # Express server with API
│   ├── cli.js             # Command line tool
│   └── data.json          # Persistent storage
├── public/
│   ├── index.html         # Mobile-optimized UI
│   ├── style.css          # Responsive styles with animations
│   └── script.js          # Client-side JavaScript
├── plan.md               # Technical implementation plan
└── README.md             # This file
```

## Design Features

- **No-scroll mobile design**: Fits entirely on phone screens (375x667px+)
- **Clean gradients**: Modern color schemes for each person
- **Touch-friendly**: Large buttons perfect for mobile use
- **Visual feedback**: Button animations and counter updates
- **Error handling**: Graceful failures with user notifications

## Development

```bash
# Start development server
cd server
npm run dev

# Test CLI commands
node cli.js status
```

The app will be available at `http://localhost:3000`. The client auto-refreshes counts every 5 seconds to stay synchronized.

## Notes

- Counts persist between server restarts via JSON file
- Non-negative integers only (validation on server)
- Works offline (CLI falls back to local file)
- Mobile safari bookmark → "Add to Home Screen" for app-like experience

---

Built with ❤️ for reducing swearing around little ones! 🫙✨