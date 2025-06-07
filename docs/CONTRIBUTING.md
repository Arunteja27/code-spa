# 🤝 Contributing to Code Spa

We welcome contributions! This guide will help you get started with development and contributing to Code Spa.

## 🚀 Installation

### From VS Code Marketplace (Coming Soon)
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Code Spa"
4. Click Install

### Manual Installation
1. Clone this repository
2. Open in VS Code
3. Press F5 to run in Extension Development Host
4. The extension will be active in the new VS Code window

## 🎯 Usage

### Getting Started
1. **Activate Extension**: Code Spa activates automatically when VS Code starts
2. **Open Control Panel**: 
   - Command Palette (Ctrl+Shift+P) → "Code Spa: Open Control Panel"
   - Or click the Code Spa icon in the Activity Bar
3. **Connect Spotify**: Click "Open Music Player" and connect your Spotify Premium account
4. **Analyze Project**: Click "Analyze Current Project" to let AI set the perfect background
5. **Customize**: Use the theme customizer to create your perfect coding environment

### Commands
- `Code Spa: Open Control Panel` - Access the main control interface
- `Code Spa: Toggle Dynamic Background` - Enable/disable dynamic backgrounds
- `Code Spa: Open Music Player` - Launch the integrated Spotify music player
- `Code Spa: Connect Spotify` - Connect to your Spotify Premium account
- `Code Spa: Disconnect Spotify` - Disconnect from Spotify
- `Code Spa: Analyze Project Context` - Analyze current workspace for AI background selection
- `Code Spa: Customize Theme` - Open the theme customization panel

### Spotify Integration Requirements
- **Spotify Premium Account**: Required for playback controls
- **Spotify Desktop App**: Must be running for volume sync and playback
- **Internet Connection**: Required for initial authentication and track data

### Configuration
Access settings via File → Preferences → Settings → Extensions → Code Spa

```json
{
  "codeSpa.background.enabled": true,
  "codeSpa.background.opacity": 0.15,
  "codeSpa.background.updateInterval": 300000,
  "codeSpa.music.enabled": true,
  "codeSpa.music.volume": 0.3,
  "codeSpa.theme.preset": "cyberpunk",
  "codeSpa.ai.apiKey": ""
}
```

## 🛠️ Advanced Features

### Spotify Integration
- **OAuth Authentication**: Secure login with Spotify Web API
- **Real-time Sync**: Volume and playback state sync every second
- **Smart Library Management**: Efficient loading with pagination and caching
- **Playback Context Separation**: Maintains what's playing vs what you're browsing
- **Error Handling**: Graceful fallbacks for network issues

### AI Integration (Optional)
- Add your OpenAI API key in settings for enhanced background generation
- AI will create custom background descriptions based on your code context
- Fallback to curated image collections if no API key provided

### Custom Themes
1. Open Theme Customizer
2. Adjust colors, effects, and typography
3. Save as custom theme
4. Export/import theme configurations

### Workspace-Specific Settings
Code Spa can save different configurations per workspace:
- Different themes for different projects
- Project-specific music preferences
- Custom background collections

## 🎨 Screenshots

### Control Panel
Beautiful glassmorphism design with quick access to all features, including background control, music integration, theme customization, and settings.

### Spotify Music Player
Immersive music experience with:
- Tile-based navigation for Liked Songs, Recently Played, Top Tracks, and Playlists
- Real-time "Now Playing" display
- Professional playback controls with Font Awesome icons
- Volume sync with your Spotify desktop app
- Scroll position persistence across navigation

### Theme Customizer
Comprehensive customization options for every aspect of your coding environment

### Dynamic Backgrounds
AI-selected backgrounds that match your project's vibe

## 🤝 Contributing

### Development Setup
1. Clone the repository
2. Run `npm install`
3. Add your Spotify App credentials to `src/spotifyService.ts`
4. Open in VS Code
5. Press F5 to start debugging

### Feature Requests
Have an idea for Code Spa? Open an issue with the "enhancement" label!

### Pull Request Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Add tests for new features
- Update documentation for any API changes
- Ensure all existing tests pass

## 🐛 Known Issues

- Background changes require VS Code restart in some cases
- Spotify integration requires Premium account and desktop app
- Some theme customizations may not persist across VS Code updates
- Volume control is read-only (synced from Spotify desktop app)

---
