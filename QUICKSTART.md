# 🚀 Code Spa - Quick Start Guide

Welcome to Code Spa! This guide will help you get your amazing VS Code extension up and running in minutes.

## 🏃‍♂️ Getting Started

### 1. Test the Extension
The project is already set up and compiled! Here's how to test it:

1. **Open VS Code** in the `code-spa` directory (should already be open)
2. **Press F5** to launch the Extension Development Host
3. A new VS Code window will open with Code Spa active
4. You'll see a welcome message: "🎨 Code Spa activated! Open the Control Panel to customize your coding experience."

### 2. Access the Control Panel
- **Method 1**: Press `Ctrl+Shift+P` and type "Code Spa: Open Control Panel"
- **Method 2**: Look for the Code Spa panel in the Explorer sidebar
- **Method 3**: Use the Command Palette → "Code Spa: Open Control Panel"

### 3. Try the Features

#### 🖼️ Dynamic Backgrounds
1. Open a project in the new VS Code window
2. Click "Analyze Current Project" in the Control Panel
3. Watch as Code Spa analyzes your project and sets an appropriate background!

#### 🎵 Music Player
1. Click "Open Music Player" in the Control Panel
2. Select a playlist (Ambient Focus, Lo-Fi Hip Hop, or Synthwave Code)
3. Enjoy the beautiful music player interface!

#### 🎨 Theme Customization
1. Click "Customize Theme" in the Control Panel
2. Try different presets: Cyberpunk, Nature, Space, Minimal, or Retro
3. Adjust opacity, effects, and colors to your liking

## 🛠️ Development Workflow

### Making Changes
1. Edit any `.ts` file in the `src/` directory
2. Run `npm run compile` or use `Ctrl+Shift+P` → "Tasks: Run Task" → "npm: compile"
3. Press `Ctrl+R` in the Extension Development Host to reload the extension

### Testing Different Projects
1. Create test folders with different project types:
   - React project with `package.json` containing React dependencies
   - Python project with `requirements.txt`
   - Simple HTML/CSS project
2. Open these in the Extension Development Host
3. Test how Code Spa analyzes each project type

## 🎯 Key Features to Test

### ✅ Background Controller
- [ ] Toggle backgrounds on/off
- [ ] Test different project types (React, Python, etc.)
- [ ] Adjust opacity slider
- [ ] Watch backgrounds change based on file types

### ✅ Music Player
- [ ] Open the music player webview
- [ ] Switch between playlists
- [ ] Test volume controls
- [ ] Try play/pause functionality

### ✅ Project Analyzer
- [ ] Test with JavaScript/TypeScript projects
- [ ] Test with Python projects
- [ ] Test with mixed-language projects
- [ ] Check console for analysis results

### ✅ Theme Customizer
- [ ] Apply each theme preset
- [ ] Modify custom settings
- [ ] Save custom configurations
- [ ] Test effect toggles

### ✅ Control Panel
- [ ] Navigate through all sections
- [ ] Test all buttons
- [ ] Check status indicators
- [ ] Verify responsive design

## 🐛 Debugging Tips

### Console Output
- Open Developer Tools in the Extension Development Host: `Help` → `Toggle Developer Tools`
- Check the Console tab for Code Spa messages (they start with emojis like 🎨, 🎵, 🔍)

### Common Issues
1. **Extension not loading**: Check the Output panel → "Code Spa" for error messages
2. **Commands not working**: Verify compilation was successful with `npm run compile`
3. **Webviews not showing**: Check for JavaScript errors in Developer Tools

### Reloading
- **Reload Extension**: `Ctrl+R` in Extension Development Host
- **Restart Extension Host**: Close and press F5 again
- **Recompile**: `npm run compile` then reload

## 🎨 Customization Ideas

### Add Your Own Backgrounds
Edit `src/backgroundController.ts` and add URLs to the `backgroundImages` Map:

```typescript
this.backgroundImages.set('myTheme', [
    'https://your-image-url.com/background1.jpg',
    'https://your-image-url.com/background2.jpg'
]);
```

### Create New Music Playlists
Edit `src/musicPlayer.ts` and add new playlists:

```typescript
const newPlaylist: Playlist = {
    name: 'My Coding Mix',
    description: 'Your custom coding soundtrack',
    tracks: [
        {
            title: 'Your Song',
            url: 'https://your-music-url.com/song.mp3',
            duration: 180,
            genre: 'custom'
        }
    ]
};
```

### Add New Project Types
Edit `src/projectAnalyzer.ts` to detect new frameworks or languages in the `detectFrameworks()` and `detectLanguages()` methods.

## 📦 Building for Distribution

When you're ready to share your extension:

1. **Install vsce** (VS Code Extension manager):
   ```bash
   npm install -g vsce
   ```

2. **Package the extension**:
   ```bash
   vsce package
   ```

3. **Install locally**:
   ```bash
   code --install-extension code-spa-0.1.0.vsix
   ```

## 🎉 Next Steps

### Enhance the Extension
- Add more theme presets
- Integrate with Spotify or other music services
- Add AI-generated background descriptions
- Create workspace-specific configurations
- Add particle effects and animations

### Share Your Creation
- Publish to VS Code Marketplace
- Share on GitHub
- Get feedback from the developer community
- Create documentation and screenshots

## 🆘 Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Look at the source code - it's well-commented!
- Create an issue if you find bugs
- Join the VS Code extension development community

---

**Happy coding! Your Code Spa extension is ready to transform your development experience! 🚀**

*Press F5 and start exploring your creation!* 