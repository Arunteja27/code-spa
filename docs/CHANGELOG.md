# 📝 Changelog

All notable changes to the "Code Spa" extension will be documented in this file.

## [0.3.0] - 2025-06-15 (Latest - MVP 4.0)

### Added
- 🤖 **Gemini AI Integration**: Smart project analysis for dynamic theme selection
- 🎨 **Dynamic Theme Selection**: AI automatically chooses themes based on project context
- 🖼️ **Intelligent Background System**: Context-aware background selection using AI
- 🎵 Enhanced Spotify integration with automatic playlist loading
- 🔄 Auto-advance music player with smart track progression
- 🎛️ Improved playback controls and position tracking

### Fixed
- Fixed Spotify connection showing as connected but displaying no songs
- Resolved auto-advance playing next song when paused near track end
- Fixed auto-advance timer not rescheduling when skipping forward in tracks
- Improved music player state management

### Technical Improvements
- Integrated Google Gemini API for project context analysis
- AI-powered theme recommendation system based on file types and project structure
- Updated `connectSpotify()` to automatically call `loadSpotifyPlaylists()`
- Enhanced auto-advance logic to only trigger on natural song completion
- Added proper timer management for track position changes
- Code cleanup: removed unnecessary comments across TypeScript, CSS, and JavaScript files

## [0.2.0] - 2025-06-10 (MVP 3.0)

### Added
- 🎯 **Unified Extension Interface**: Consolidated all features into single extension view
- 📍 **Activity Bar Integration**: Added Code Spa icon to VS Code activity bar
- 🔄 **Streamlined UX**: Single-panel access to all features

### Changed
- Moved from separate webviews (control panel, music app, settings) to unified extension interface
- Simplified navigation with all features accessible from activity bar
- Improved performance by reducing webview overhead

### Technical Improvements
- Consolidated multiple webview providers into single extension view
- Enhanced VS Code integration with proper activity bar registration
- Optimized resource usage with unified interface architecture

## [0.1.0] - 2025-06-07 (MVP 2.0)

### Added
- 🎨 Initial release with core features
- 🖼️ AI-powered dynamic backgrounds with project context analysis
- 🎵 Spotify Premium integration with full playback controls
- 🎯 5 theme presets (Cyberpunk, Nature, Space, Minimal, Retro)
- 🎛️ Glassmorphism control panel interface

### Technical Features
- OAuth authentication with Spotify Web API
- Real-time sync and playback state management
- VS Code secrets API for secure token storage
- Smart project analysis with language detection

### Bug Fixes
- Fixed volume sync with Spotify desktop app
- Implemented scroll position persistence when navigating tracks
- Fixed playback context separation (browsing vs playing)
- Resolved UI icon consistency with Font Awesome integration
- Removed excessive VS Code notifications for cleaner UX

## [Unreleased]

### Planned Features
- More theme customization options
- Workspace-specific music preferences
- VS Code Marketplace publication