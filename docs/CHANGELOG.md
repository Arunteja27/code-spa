# 📝 Changelog

All notable changes to the "Code Spa" extension will be documented in this file.


## [0.1.0] - 2025-06-07 (MVP 2.0)

### Added
- 🎨 Initial release with all core features
- 🖼️ AI-powered dynamic backgrounds with project context analysis
- 🎵 **Full Spotify Integration**:
  - Real music playback with Spotify Premium account support
  - Access to Liked Songs, Recently Played, Top Tracks, and Playlists
  - Real-time volume sync with Spotify desktop app
  - Professional tile-based UI with Font Awesome icons
  - Scroll position persistence and clean navigation
  - Playback context separation for proper prev/next behavior
- 🎯 5 stunning theme presets (Cyberpunk, Nature, Space, Minimal, Retro)
- 🧠 Smart project analysis with language and framework detection
- 🎛️ Beautiful glassmorphism control panel interface

### Technical Features
- OAuth authentication with Spotify Web API
- Real-time sync (volume and playback state every 1 second)
- Smart library management with pagination and caching
- Error handling with graceful fallbacks
- Workspace-specific configurations
- VS Code secrets API for secure token storage

### Bug Fixes
- Fixed volume sync with Spotify desktop app
- Implemented scroll position persistence when navigating tracks
- Fixed playback context separation (browsing vs playing)
- Resolved UI icon consistency with Font Awesome integration
- Removed excessive VS Code notifications for cleaner UX

## [Unreleased]

### Planned Features
- Enhanced AI background generation with OpenAI integration
- More theme customization options
- Workspace-specific music preferences
- VS Code Marketplace publication