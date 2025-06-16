# 🤝 Contributing to Code Spa

Welcome to Code Spa! This guide will help you get the extension running locally for development.

## 🚀 Quick Setup

### Prerequisites
- **Node.js** (v16 or higher)
- **VS Code** (latest version)
- **Git**

### Installation
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/code-spa.git
   cd code-spa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Open in VS Code**
   ```bash
   code .
   ```

4. **Run the extension**
   - Press `F5` to launch Extension Development Host
   - Code Spa will be active in the new VS Code window

## 🔑 API Keys & Configuration

To use all features, you'll need to configure these API keys:

### Spotify Integration (Required for Music Player)
1. **Create Spotify App**:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Set **Redirect URI** to: `http://127.0.0.1:3000/callback`

2. **Configure in VS Code**:
   - Open Settings (`Ctrl+,`)
   - Search for "Code Spa Spotify"
   - Enter your **Client ID** and **Client Secret**

### Gemini AI (Required for Smart Themes)
1. **Get API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a free API key

2. **Configure in VS Code**:
   - Open Settings (`Ctrl+,`)
   - Search for "Code Spa Gemini"
   - Enter your **Gemini API Key**

## 🎯 How to Use

### Basic Features (No API Keys Needed)
- **Activity Bar**: Click the Code Spa icon on the left sidebar
- **Theme Presets**: Choose from 5 built-in themes (Cyberpunk, Nature, Space, Minimal, Retro)
- **Background Control**: Toggle dynamic backgrounds on/off

### With Spotify (Premium Account Required)
- **Connect**: Click "Connect Spotify" in the music player
- **Control Playback**: Play/pause, skip tracks, control volume
- **Browse Library**: Access playlists, liked songs, recently played

### With Gemini AI
- **Smart Themes**: Click "Analyze Project" to generate AI themes based on your code
- **Context Awareness**: AI analyzes your project type and suggests appropriate themes

## 🛠️ Development

### Project Structure
```
code-spa/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── providers/            # Webview providers
│   ├── services/             # Core services (Spotify, Gemini, etc.)
│   └── utils/               # Utility functions
├── media/                   # Static assets
├── docs/                    # Documentation
└── package.json            # Extension manifest
```

### Key Commands
- `F5` - Run extension in debug mode
- `Ctrl+Shift+P` → "Developer: Reload Window" - Reload after code changes
- `Ctrl+Shift+I` - Open developer tools for webview debugging

### Making Changes
1. **Edit code** in `src/` directory
2. **Reload extension** with `Ctrl+Shift+P` → "Developer: Reload Window"
3. **Test changes** in the Extension Development Host window

## 🐛 Troubleshooting

### Common Issues

**"Spotify credentials not configured"**
- Add Client ID and Secret in VS Code settings under Code Spa → Spotify

**"Gemini API not configured"**
- Add your Gemini API key in VS Code settings under Code Spa → Gemini API Key

**Extension not loading**
- Check the Debug Console (`Ctrl+Shift+Y`) for error messages
- Ensure all dependencies are installed with `npm install`

**Spotify authentication fails**
- Verify redirect URI is exactly: `http://127.0.0.1:3000/callback`
- Check that your Spotify app is not in development mode restrictions

## 🤝 Contributing

### Pull Request Process
1. **Fork** the repository
2. **Create branch**: `git checkout -b feature/your-feature`
3. **Make changes** and test thoroughly
4. **Commit**: `git commit -m 'Add your feature'`
5. **Push**: `git push origin feature/your-feature`
6. **Open Pull Request** with clear description

### Development Guidelines
- Follow TypeScript best practices
- Test all features before submitting
- Update documentation for new features
- Keep commits focused and descriptive

---

**Ready to enhance your coding experience? Let's build something amazing! 🚀**
