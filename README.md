# 🎨 Code Spa - Your Personal Coding Sanctuary

Transform your VS Code experience into an immersive coding paradise with AI-powered dynamic backgrounds, ambient music, and fully customizable UI themes that adapt to your project's context.

## ✨ Features

### 🖼️ AI-Powered Dynamic Backgrounds
- **Automatic Context Analysis**: Analyzes your project type, languages, and frameworks
- **Smart Background Selection**: AI chooses appropriate backgrounds based on your coding context
- **Real-time Updates**: Backgrounds change as you switch between different file types
- **Opacity Control**: Adjustable transparency for optimal code readability
- **Theme Integration**: Seamlessly works with all theme presets

### 🎵 Integrated Music Player
- **Ambient Playlists**: Curated playlists for different coding moods
  - 🌧️ **Ambient Focus**: Rain, forest sounds, coffee shop ambience
  - 🎧 **Lo-Fi Hip Hop**: Chill beats for deep coding sessions
  - 🚀 **Synthwave Code**: Retro-futuristic vibes for cyberpunk coding
- **Custom Tracks**: Add your own coding soundtrack
- **Volume Control**: Integrated volume slider and controls
- **Beautiful UI**: Glassmorphism design with visualizer

### 🎨 Customizable UI Themes
Choose from 5 stunning theme presets or create your own:

#### 🌃 **Cyberpunk**
- Neon green and magenta color scheme
- Glowing effects and particles
- Orbitron font for futuristic feel
- Perfect for modern web development

#### 🌲 **Nature**
- Earth tones and forest greens
- Subtle particle effects
- Peaceful coding environment
- Great for Python and data science

#### 🚀 **Space**
- Deep blues and cosmic purples
- Starfield particle effects
- Space Mono font
- Ideal for systems programming

#### 🎯 **Minimal**
- Clean, distraction-free design
- Light background with dark accents
- No effects for maximum focus
- Perfect for documentation and writing

#### 📼 **Retro**
- 80s-inspired orange and yellow
- CRT-style glow effects
- Press Start 2P font
- Nostalgic terminal experience

### 🧠 Smart Project Analysis
- **Language Detection**: Automatically identifies primary programming languages
- **Framework Recognition**: Detects popular frameworks and libraries
- **Project Type Classification**: Web Frontend/Backend, Mobile, Desktop, Data Science, etc.
- **Mood Determination**: Assigns appropriate mood based on project characteristics

### 🎛️ Control Panel
- **Centralized Control**: Manage all features from one beautiful interface
- **Quick Stats**: See current status at a glance
- **One-Click Actions**: Toggle features with single clicks
- **Real-time Updates**: Live status indicators

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
3. **Analyze Project**: Click "Analyze Current Project" to let AI set the perfect background
4. **Customize**: Use the theme customizer to create your perfect coding environment

### Commands
- `Code Spa: Open Control Panel` - Access the main control interface
- `Code Spa: Toggle Dynamic Background` - Enable/disable dynamic backgrounds
- `Code Spa: Open Music Player` - Launch the integrated music player
- `Code Spa: Analyze Project Context` - Analyze current workspace for AI background selection
- `Code Spa: Customize Theme` - Open the theme customization panel

### Configuration
Access settings via File → Preferences → Settings → Extensions → Code Spa

```json
{
  "codeSpa.background.enabled": true,
  "codeSpa.background.opacity": 0.15,
  "codeSpa.background.updateInterval": 300000,
  "codeSpa.music.enabled": false,
  "codeSpa.music.volume": 0.3,
  "codeSpa.theme.preset": "cyberpunk",
  "codeSpa.ai.apiKey": ""
}
```

## 🛠️ Advanced Features

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
- Project-specific music playlists
- Custom background collections

## 🎨 Screenshots

### Control Panel
Beautiful glassmorphism design with quick access to all features

### Music Player
Immersive music experience with playlist management

### Theme Customizer
Comprehensive customization options for every aspect of your coding environment

### Dynamic Backgrounds
AI-selected backgrounds that match your project's vibe

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Clone the repository
2. Run `npm install`
3. Open in VS Code
4. Press F5 to start debugging

### Feature Requests
Have an idea for Code Spa? Open an issue with the "enhancement" label!

## 📝 Changelog

### v0.1.0 (Current)
- 🎨 Initial release with all core features
- 🖼️ AI-powered dynamic backgrounds
- 🎵 Integrated music player with curated playlists
- 🎯 5 stunning theme presets
- 🧠 Smart project analysis
- 🎛️ Beautiful control panel interface

## 🐛 Known Issues

- Background changes require VS Code restart in some cases
- Music player is visual-only (no actual audio playback yet)
- Some theme customizations may not persist across VS Code updates

## 📞 Support

- 🐛 [Report Issues](https://github.com/your-username/code-spa/issues)
- 💡 [Feature Requests](https://github.com/your-username/code-spa/issues/new?template=feature_request.md)
- 📧 [Contact Support](mailto:support@code-spa.dev)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Unsplash for beautiful background images
- VS Code team for the amazing extensibility API
- The developer community for inspiration and feedback

---

**Transform your coding experience today with Code Spa! 🚀**

*Made with ❤️ for developers who dream in code*
