import * as vscode from 'vscode';
import { UICustomizer } from '../services/theming/uiCustomizer';
import { MusicPlayer } from '../services/music/musicPlayer';
import { SpotifyTrack, SpotifyPlaylist } from '../services/spotify/spotifyService';
import { NotificationService } from '../services/notifications/notificationService';
import { WebviewUtils } from '../webview/WebviewUtils';

export class ControlPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codeSpaControlPanel';
    private _view?: vscode.WebviewView;
    private currentPage: string = 'home';
    private uiCustomizer?: UICustomizer;
    private musicPlayer?: MusicPlayer;
    private notificationService: NotificationService;
    
    private currentPlaybackContext: { tracks: any[]; currentIndex: number; category?: string; playlistId?: string } | null = null;
    private webviewUtils: WebviewUtils;
    private spotifyView: 'library' | 'category' | 'playlists' | 'playlist-songs' = 'library';
    private currentCategory: string | null = null;
    private currentPlaylist: any | null = null;

    private currentTrackInfo: { name: string; artist: string; imageUrl: string | null; isPlaying: boolean } | null = null;

    private _panel: vscode.WebviewPanel | undefined;
    private _disposables: vscode.Disposable[] = [];
    private _currentView: 'home' | 'themes' | 'music' | 'notifications' = 'home';
    private _isVSCodeClosed = false;

    constructor(private readonly _extensionContext: vscode.ExtensionContext) {
        this.notificationService = NotificationService.getInstance();
        this.webviewUtils = new WebviewUtils(_extensionContext);
    }

    public setUICustomizer(uiCustomizer: UICustomizer) {
        this.uiCustomizer = uiCustomizer;
    }

    public setMusicPlayer(musicPlayer: MusicPlayer) {
        this.musicPlayer = musicPlayer;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionContext.extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            message => {
                this._handleMessage(message);
            },
            undefined,
            this._extensionContext.subscriptions
        );
    }

    public show() {
        if (this._view) {
            this._view.show?.(true);
        } else {
            vscode.commands.executeCommand('workbench.view.extension.codeSpaPanel');
        }
    }

    private async _handleMessage(message: any) {
        switch (message.command) {
            case 'navigate':
                this.currentPage = message.page || 'home';
                this._updateWebview();
                break;

            case 'applyTheme':
                if (this.uiCustomizer) {
                    await this.uiCustomizer.applyPreset(message.theme);
                    this.notificationService.showThemeChange(`🎨 Applied ${message.theme} theme!`);
                } else {
                    vscode.commands.executeCommand('code-spa.customizeTheme');
                }
                break;

            case 'connectSpotify':
                if (this.musicPlayer) {
                    await this.musicPlayer.connectSpotify();
                    setTimeout(() => this._updateWebview(), 1000);
                }
                break;

            case 'disconnectSpotify':
                if (this.musicPlayer) {
                    await this.musicPlayer.disconnectSpotify();
                    setTimeout(() => this._updateWebview(), 500);
                }
                break;

            case 'togglePlayback':
                if (this.musicPlayer) {
                    await this.musicPlayer.togglePlayback();
                    // Send immediate update for play/pause state
                    setTimeout(async () => {
                        await this._sendPlaybackStateUpdate();
                    }, 300);
                }
                break;

            case 'nextTrack':
                if (this.musicPlayer) {
                    await this.musicPlayer.nextTrack();
                    // Send immediate update for now playing section
                    setTimeout(async () => {
                        await this._sendPlaybackStateUpdate();
                        this._sendNowPlayingUpdate();
                    }, 500);
                }
                break;

            case 'previousTrack':
                if (this.musicPlayer) {
                    await this.musicPlayer.previousTrack();
                    // Send immediate update for now playing section
                    setTimeout(async () => {
                        await this._sendPlaybackStateUpdate();
                        this._sendNowPlayingUpdate();
                    }, 500);
                }
                break;

            case 'playTrack':
                if (this.musicPlayer && message.trackIndex !== undefined) {
                    await this.musicPlayer.playTrackAtIndex(message.trackIndex);
                    // Send immediate update for new track
                    setTimeout(async () => {
                        await this._sendPlaybackStateUpdate();
                    }, 500);
                }
                break;

            case 'selectCategory':
                this._updateWebview();
                break;

            case 'toggleBackground':
                const config = vscode.workspace.getConfiguration('codeSpa');
                const enabled = config.get('background.enabled', true);
                await config.update('background.enabled', !enabled, vscode.ConfigurationTarget.Global);
                this.notificationService.showBackgroundChange(
                    enabled ? '🖼️ Dynamic backgrounds disabled.' : '🖼️ Dynamic backgrounds enabled!'
                );
                this._updateWebview();
                break;

            case 'analyzeProject':
                vscode.commands.executeCommand('code-spa.analyzeProject');
                break;

            case 'openMusicPlayer':
                vscode.commands.executeCommand('code-spa.openMusicPlayer');
                break;

            case 'customizeTheme':
                vscode.commands.executeCommand('code-spa.customizeTheme');
                break;

            case 'toggleNotifications':
                await this._toggleNotifications(message.category);
                break;

            case 'refreshPlaylists':
                if (this.musicPlayer) {
                    const spotifyService = this.musicPlayer.getSpotifyService();
                    if (spotifyService.getIsAuthenticated()) {
                        const playlists = await spotifyService.getUserPlaylists();
                        this._updateWebview();
                    }
                }
                break;

            case 'selectSpotifyCategory':
                if (this.musicPlayer && message.category) {
                    this.musicPlayer.setCurrentCategory(message.category);
                    this.currentCategory = message.category;

                    if (message.category === 'playlists') {
                        this.spotifyView = 'playlists';
                    } else {
                        this.spotifyView = 'category';
                    }
                    this._updateWebview();
                }
                break;

            case 'selectPlaylist':
                if (this.musicPlayer && message.playlistId) {
                    // Handle playlist selection
                    const playlists = this.musicPlayer.getSpotifyPlaylists();
                    const selectedPlaylist = playlists.find(p => p.id === message.playlistId);
                    if (selectedPlaylist) {
                        this.currentPlaylist = selectedPlaylist;
                        // Set the playlist in the music player for proper context
                        this.musicPlayer.setCurrentPlaylist(selectedPlaylist);
                        this.spotifyView = 'playlist-songs';
                        this._updateWebview();
                    }
                }
                break;

            case 'goBackToLibrary':
                if (this.musicPlayer) {
                    this.musicPlayer.resetToLibraryView();
                }
                this.spotifyView = 'library';
                this.currentCategory = null;
                this.currentPlaylist = null;
                this._updateWebview();
                break;

            case 'seekToPosition':
                if (this.musicPlayer && message.percentage !== undefined) {
                    const spotifyService = this.musicPlayer.getSpotifyService();
                    const currentTrack = this.musicPlayer.getCurrentTrack();
                    
                    if (spotifyService.getIsAuthenticated() && currentTrack) {
                        const duration = currentTrack.duration;
                        const positionMs = Math.floor((message.percentage / 100) * duration);
                        
                        const success = await spotifyService.seekToPosition(positionMs);
                        if (success) {
                            // Send immediate update to reflect the seek
                            setTimeout(async () => {
                                await this._sendPlaybackStateUpdate();
                            }, 200);
                        } else {
                            vscode.window.showWarningMessage('Seeking not available. Make sure Spotify is active on a device.');
                        }
                    } else {
                        vscode.window.showWarningMessage('🎵 Please connect to Spotify and play a track first');
                    }
                }
                break;

            case 'getCurrentPlaybackState':
                if (this.musicPlayer) {
                    await this._sendPlaybackStateUpdate();
                }
                break;

            case 'setVolume':
                if (this.musicPlayer && message.volume !== undefined) {
                    // Volume is handled by Spotify app, but we can show feedback
                    this._updateWebview();
                }
                break;

            case 'goBackSpotify':
                // Navigate back within music player hierarchy without leaving the music page
                if (this.currentPage === 'music') {
                    if (this.spotifyView === 'playlist-songs') {
                        // Move back to playlists grid
                        this.spotifyView = 'playlists';
                        this.currentPlaylist = null;
                    } else if (this.spotifyView === 'playlists' || this.spotifyView === 'category') {
                        // Move back to main library tiles
                        this.spotifyView = 'library';
                        this.currentCategory = null;
                        this.currentPlaylist = null;
                    } else {
                        // Already at library → go back to home page
                        this.currentPage = 'home';
                    }
                    this._updateWebview();
                } else {
                    // Fallback: just go to home
                    this.currentPage = 'home';
                    this._updateWebview();
                }
                break;

            case 'navigateToMusicLibrary':
                if (this.currentPage === 'music') {
                    this.spotifyView = 'library';
                    this.currentCategory = null;
                    this.currentPlaylist = null;
                    this._updateWebview();
                }
                break;
        }
    }

    private async _getPlaylistsFromCache(): Promise<SpotifyPlaylist[]> {
        if (!this.musicPlayer) return [];
        
        const spotifyService = this.musicPlayer.getSpotifyService();
        if (!spotifyService.getIsAuthenticated()) return [];

        try {
            const allContent = await spotifyService.getUserPlaylists();
            return allContent.filter(p => !['liked-songs', 'recently-played', 'top-tracks'].includes(p.id));
        } catch (error) {
            console.error('Failed to get playlists:', error);
            return [];
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        try {
            const content = this._getControlPanelContent();
            
            return this.webviewUtils.loadHtmlTemplate(
                webview,
                'control-panel',
                content
            );
        } catch (error) {
            console.error('Error loading control panel HTML:', error);
            return `
                <html>
                    <body>
                        <h1>Error Loading Control Panel</h1>
                        <p>There was an error loading the control panel. Please check the console for details.</p>
                        <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
                    </body>
                </html>
            `;
        }
    }

    private _getControlPanelContent(): string {
        const config = vscode.workspace.getConfiguration('codeSpa');
        const backgroundEnabled = config.get('background.enabled', true);
        
        const isSpotifyConnected = this.musicPlayer?.getSpotifyService().getIsAuthenticated() || false;
        const user = this.musicPlayer?.getSpotifyService().getUser();
        const currentTrack = this.musicPlayer?.getCurrentTrack() || null;
        const isPlaying = this.musicPlayer?.getIsPlaying() || false;

        // Dynamic nav title based on current page
        const navTitleText = this.currentPage === 'home' ? '🎨 Code Spa'
            : this.currentPage === 'music' ? '🎵 Music Player'
            : this.currentPage === 'themes' ? '🎨 Themes'
            : this.currentPage === 'notifications' ? '🔔 Notifications'
            : 'ℹ️ About';

        // Make the music player title a button to return to the music library
        const navTitleHTML = this.currentPage === 'music' 
            ? `<button class="nav-title-button" onclick="navigateToMusicLibrary()">${navTitleText}</button>`
            : `<div class="nav-title">${navTitleText}</div>`;

        // Navigation header (no top-right back button)
        const navHeader = `
            <div class="nav-header">
                ${navTitleHTML}
            </div>
        `;

        // Page content based on current page
        let pageContent = '';
        
        switch (this.currentPage) {
            case 'themes':
                pageContent = this._getThemesPageContent();
                break;
            case 'music':
                pageContent = this._getMusicPageContent(isSpotifyConnected, user, currentTrack, isPlaying);
                break;
            case 'notifications':
                pageContent = this._getNotificationsPageContent(config);
                break;
            case 'about':
                pageContent = this._getAboutPageContent(config, backgroundEnabled);
                break;
            default: // 'home'
                pageContent = this._getHomePageContent(backgroundEnabled, isSpotifyConnected);
                break;
        }

        return `
            <div class="control-panel">
                ${navHeader}
                <div class="page-content">
                    ${pageContent}
                </div>
            </div>
        `;
    }

    private _getThemesPageContent(): string {
        return `
            <div class="controls-section">
                <h2 class="section-title">🎨 Theme & Appearance</h2>
                <div class="theme-grid">
                    <div class="theme-card" onclick="applyTheme('cyberpunk')">
                        <div class="theme-name">Cyberpunk</div>
                        <div class="theme-description">Neon lights and dark aesthetics</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background: #00d4ff;"></div>
                            <div class="color-swatch" style="background: #ff0080;"></div>
                            <div class="color-swatch" style="background: #00ff41;"></div>
                        </div>
                    </div>
                    <div class="theme-card" onclick="applyTheme('nature')">
                        <div class="theme-name">Nature</div>
                        <div class="theme-description">Earth tones and organic feel</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background: #22c55e;"></div>
                            <div class="color-swatch" style="background: #84cc16;"></div>
                            <div class="color-swatch" style="background: #16a34a;"></div>
                        </div>
                    </div>
                    <div class="theme-card" onclick="applyTheme('space')">
                        <div class="theme-name">Space</div>
                        <div class="theme-description">Deep space and cosmic vibes</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background: #3b82f6;"></div>
                            <div class="color-swatch" style="background: #8b5cf6;"></div>
                            <div class="color-swatch" style="background: #1e40af;"></div>
                        </div>
                    </div>
                    <div class="theme-card" onclick="applyTheme('minimal')">
                        <div class="theme-name">Minimal</div>
                        <div class="theme-description">Clean and simple design</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background: #6b7280;"></div>
                            <div class="color-swatch" style="background: #9ca3af;"></div>
                            <div class="color-swatch" style="background: #4b5563;"></div>
                        </div>
                    </div>
                    <div class="theme-card" onclick="applyTheme('retro')">
                        <div class="theme-name">Retro</div>
                        <div class="theme-description">80s nostalgia and synthwave</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background: #f59e0b;"></div>
                            <div class="color-swatch" style="background: #ef4444;"></div>
                            <div class="color-swatch" style="background: #8b5cf6;"></div>
                        </div>
                    </div>
                    <div class="theme-card" onclick="applyTheme('ocean')">
                        <div class="theme-name">Ocean</div>
                        <div class="theme-description">Deep blue and aquatic themes</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background: #0ea5e9;"></div>
                            <div class="color-swatch" style="background: #06b6d4;"></div>
                            <div class="color-swatch" style="background: #0284c7;"></div>
                        </div>
                    </div>
                </div>
                
                <div class="controls">
                    <button class="control-button" onclick="customizeTheme()">
                        <span class="control-icon">⚙️</span>
                        Advanced Theme Settings
                    </button>
                </div>
            </div>
        `;
    }

    private _getMusicPageContent(isSpotifyConnected: boolean, user: any, currentTrack: SpotifyTrack | null, isPlaying: boolean): string {
        if (!isSpotifyConnected) {
            return `
                <div class="controls-section">
                    <div class="spotify-section spotify-connect-box">
                        <div class="spotify-logo">🎵</div>
                        <h3 style="color: #1ed760; margin-bottom: 5px;">Connect to Spotify</h3>
                        <p style="opacity: 0.8; font-size: 0.9rem; text-align: center; margin-bottom: 20px;">
                            Access your playlists and control music playback directly from VS Code.
                        </p>
                        <button class="spotify-connect-btn" onclick="connectSpotify()">
                            <span class="spotify-btn-icon">🎵</span>
                            Connect Spotify
                        </button>
                    </div>
                </div>
            `;
        }

        // If connected, show the full music player content
        return this._getFullMusicPlayerContent();
    }

    private _getFullMusicPlayerContent(): string {
        if (!this.musicPlayer) return '<p>Music player not available</p>';
        
        const spotifyService = this.musicPlayer.getSpotifyService();
        const user = spotifyService.getUser();
        const currentTrack = this.musicPlayer.getCurrentTrack();
        const isPlaying = this.musicPlayer.getIsPlaying();

        // Now Playing Section
        const nowPlayingHTML = currentTrack ? `
            <div class="now-playing-section" style="
                background: linear-gradient(135deg, rgba(30, 215, 96, 0.2), rgba(30, 215, 96, 0.1));
                border: 1px solid rgba(30, 215, 96, 0.4);
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 20px;
            ">
                <h4 style="color: #1ed760; margin: 0 0 12px 0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">🎵 NOW PLAYING</h4>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div id="trackArt" class="track-art" style="
                        width: 70px;
                        height: 70px;
                        border-radius: 8px;
                        background: rgba(255, 255, 255, 0.1);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 2rem;
                        overflow: hidden;
                        flex-shrink: 0;
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                    ">
                        ${currentTrack.imageUrl ? `<img src="${currentTrack.imageUrl}" alt="Album Art" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : '🎵'}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div id="trackName" class="track-name" style="font-weight: 600; font-size: 1rem; margin-bottom: 3px; color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${currentTrack.name}</div>
                        <div id="artistName" class="track-artist" style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${currentTrack.artist}</div>
                        
                        <!-- Progress Bar -->
                        <div class="progress-container" style="
                            position: relative;
                            height: 4px;
                            background: rgba(255, 255, 255, 0.3);
                            border-radius: 2px;
                            margin-bottom: 6px;
                            cursor: pointer;
                        " onclick="seekToPosition(event)">
                            <div id="progressBar" class="progress-bar" style="
                                height: 100%;
                                background: #1DB954;
                                border-radius: 2px;
                                width: 0%;
                                transition: width 0.3s ease;
                            "></div>
                            <div id="progressHandle" class="progress-handle" style="
                                position: absolute;
                                top: 50%;
                                transform: translate(-50%, -50%);
                                width: 12px;
                                height: 12px;
                                background: #1DB954;
                                border-radius: 50%;
                                cursor: grab;
                                opacity: 0;
                                transition: opacity 0.3s ease;
                                left: 0%;
                                border: 2px solid white;
                                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                            " onmousedown="startDrag(event)"></div>
                        </div>
                        
                        <!-- Time Display -->
                        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; opacity: 0.7; margin-bottom: 8px;">
                            <span id="currentTime">0:00</span>
                            <span id="totalTime">0:00</span>
                        </div>
                    </div>
                </div>
                
                <!-- Playback Controls -->
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 15px;">
                    <button onclick="previousTrack()" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        color: white;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    ">⏮</button>
                    
                    <button onclick="togglePlayback()" style="
                        background: ${isPlaying ? 'rgba(30, 215, 96, 0.2)' : 'linear-gradient(135deg, #1ed760, #1db954)'};
                        border: 1px solid #1ed760;
                        border-radius: 50%;
                        width: 50px;
                        height: 50px;
                        color: ${isPlaying ? '#1ed760' : '#000'};
                        cursor: pointer;
                        font-size: 1.2rem;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                        font-weight: bold;
                    ">${isPlaying ? '⏸' : '▶'}</button>
                    
                    <button onclick="nextTrack()" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        color: white;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    ">⏭</button>
                </div>
            </div>
        ` : '';

        // Show different content based on current view
        switch (this.spotifyView) {
            case 'category':
                return this._getCategoryViewContent(nowPlayingHTML);
            case 'playlist-songs':
                return this._getPlaylistSongsViewContent(nowPlayingHTML);
            case 'playlists':
                return this._getPlaylistsGridContent(nowPlayingHTML, this.musicPlayer.getSpotifyPlaylists());
            default: // 'library'
                return this._getLibraryViewContent(nowPlayingHTML);
        }
    }

    private _getLibraryViewContent(nowPlayingHTML: string): string {
        if (!this.musicPlayer) return '';
        
        const likedSongs = this.musicPlayer.getLikedSongs();
        const recentlyPlayed = this.musicPlayer.getRecentlyPlayed();
        const topTracks = this.musicPlayer.getTopTracks();
        const playlists = this.musicPlayer.getSpotifyPlaylists();

        const libraryTilesHTML = `
            <div class="library-tiles" style="
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
                margin-bottom: 25px;
            ">
                <div class="library-tile" onclick="selectSpotifyCategory('liked-songs')" style="
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div class="icon" style="font-size: 2.5rem; margin-bottom: 10px; display: block;">💚</div>
                    <div class="title" style="font-weight: 600; font-size: 1.1rem; margin-bottom: 5px;">Liked Songs</div>
                    <div class="count" style="font-size: 0.9rem; opacity: 0.8;">${likedSongs.length} songs</div>
                </div>
                <div class="library-tile" onclick="selectSpotifyCategory('recently-played')" style="
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div class="icon" style="font-size: 2.5rem; margin-bottom: 10px; display: block;">🕒</div>
                    <div class="title" style="font-weight: 600; font-size: 1.1rem; margin-bottom: 5px;">Recently Played</div>
                    <div class="count" style="font-size: 0.9rem; opacity: 0.8;">${recentlyPlayed.length} songs</div>
                </div>
                <div class="library-tile" onclick="selectSpotifyCategory('top-tracks')" style="
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div class="icon" style="font-size: 2.5rem; margin-bottom: 10px; display: block;">⭐</div>
                    <div class="title" style="font-weight: 600; font-size: 1.1rem; margin-bottom: 5px;">Top Tracks</div>
                    <div class="count" style="font-size: 0.9rem; opacity: 0.8;">${topTracks.length} songs</div>
                </div>
                <div class="library-tile" onclick="selectSpotifyCategory('playlists')" style="
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div class="icon" style="font-size: 2.5rem; margin-bottom: 10px; display: block;">📋</div>
                    <div class="title" style="font-weight: 600; font-size: 1.1rem; margin-bottom: 5px;">Your Playlists</div>
                    <div class="count" style="font-size: 0.9rem; opacity: 0.8;">${playlists.length} playlists</div>
                </div>
            </div>
        `;

        // Controls are now integrated into the Now Playing component

        return `
            <div class="spotify-player-content">
                ${nowPlayingHTML}
                ${libraryTilesHTML}
                
                <button onclick="disconnectSpotify()" style="
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    color: #ef4444;
                    width: 100%;
                    padding: 10px;
                    border-radius: 8px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">
                    <span style="margin-right: 8px;">❌</span>
                    Disconnect Spotify
                </button>
            </div>
        `;
    }

    private _getCategoryViewContent(nowPlayingHTML: string): string {
        if (!this.musicPlayer || !this.currentCategory) return '';
        
        let tracks: any[] = [];
        let categoryTitle = '';
        
        switch (this.currentCategory) {
            case 'liked-songs':
                tracks = this.musicPlayer.getLikedSongs();
                categoryTitle = '💚 Liked Songs';
                break;
            case 'recently-played':
                tracks = this.musicPlayer.getRecentlyPlayed();
                categoryTitle = '🕒 Recently Played';
                break;
            case 'top-tracks':
                tracks = this.musicPlayer.getTopTracks();
                categoryTitle = '⭐ Top Tracks';
                break;
            case 'playlists':
                const playlists = this.musicPlayer.getSpotifyPlaylists();
                return this._getPlaylistsGridContent(nowPlayingHTML, playlists);
        }

        const tracksHTML = tracks.length > 0 ? tracks.map((track, index) => `
            <div class="track-item" onclick="playTrack(${index})" style="
                display: flex;
                align-items: center;
                padding: 12px;
                margin-bottom: 8px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 1px solid transparent;
            ">
                <div class="track-image" style="
                    width: 40px;
                    height: 40px;
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    overflow: hidden;
                    flex-shrink: 0;
                ">
                    ${track.imageUrl ? `<img src="${track.imageUrl}" alt="Album Art" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">` : '🎵'}
                </div>
                <div style="flex: 1; margin-left: 15px; min-width: 0;">
                    <div style="font-weight: 500; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${track.name}</div>
                    <div style="font-size: 0.9rem; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${track.artist}</div>
                </div>
                <div style="font-size: 0.9rem; opacity: 0.7;">
                    ${Math.floor(track.duration / 60000)}:${Math.floor((track.duration % 60000) / 1000).toString().padStart(2, '0')}
                </div>
            </div>
        `).join('') : '<p style="text-align: center; opacity: 0.7; margin: 20px 0;">No tracks available</p>';

        return `
            <div class="spotify-player-content">
                ${nowPlayingHTML}
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #1ed760; margin-bottom: 15px;">${categoryTitle} (${tracks.length} songs)</h3>
                </div>
                <div class="track-list-container">
                    ${tracksHTML}
                </div>
            </div>
        `;
    }

    private _getPlaylistsGridContent(nowPlayingHTML: string, playlists: any[]): string {
        const playlistsHTML = playlists.length > 0 ? playlists.map(playlist => `
            <div class="playlist-tile" onclick="selectPlaylist('${playlist.id}')" style="
                background: rgba(0, 0, 0, 0.4);
                border-radius: 12px;
                padding: 15px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 1px solid rgba(255, 255, 255, 0.1);
                margin-bottom: 10px;
            ">
                <div style="
                    width: 60px;
                    height: 60px;
                    border-radius: 8px;
                    margin: 0 auto 10px;
                    background: rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    overflow: hidden;
                ">
                    ${playlist.imageUrl ? `<img src="${playlist.imageUrl}" alt="${playlist.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : '📋'}
                </div>
                <div style="font-weight: 500; font-size: 0.9rem; margin-bottom: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${playlist.name}</div>
                <div style="font-size: 0.8rem; opacity: 0.7;">${playlist.tracks.length} songs</div>
            </div>
        `).join('') : '<p style="text-align: center; opacity: 0.7; margin: 20px 0;">No playlists found</p>';

        return `
            <div class="spotify-player-content">
                ${nowPlayingHTML}
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #1ed760; margin-bottom: 15px;">📋 Your Playlists (${playlists.length})</h3>
                </div>
                <div class="track-list-container">
                    ${playlistsHTML}
                </div>
            </div>
        `;
    }

    private _getPlaylistSongsViewContent(nowPlayingHTML: string): string {
        if (!this.currentPlaylist) {
            return `
                <div class="spotify-player-content">
                    ${nowPlayingHTML}
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #1ed760; margin-bottom: 15px;">🎵 Playlist Songs</h3>
                    </div>
                    <p style="text-align: center; opacity: 0.7;">Select a playlist to view its songs</p>
                </div>
            `;
        }

        const tracks = this.currentPlaylist.tracks || [];
        const tracksHTML = tracks.length > 0 ? tracks.map((track: any, index: number) => `
            <div class="track-item" onclick="playTrack(${index})" style="
                display: flex;
                align-items: center;
                padding: 12px;
                margin-bottom: 8px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 1px solid transparent;
            ">
                <div class="track-image" style="
                    width: 40px;
                    height: 40px;
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    overflow: hidden;
                    flex-shrink: 0;
                ">
                    ${track.imageUrl ? `<img src="${track.imageUrl}" alt="Album Art" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">` : '🎵'}
                </div>
                <div style="flex: 1; margin-left: 15px; min-width: 0;">
                    <div style="font-weight: 500; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${track.name}</div>
                    <div style="font-size: 0.9rem; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${track.artist}</div>
                </div>
                <div style="font-size: 0.9rem; opacity: 0.7;">
                    ${Math.floor(track.duration / 60000)}:${Math.floor((track.duration % 60000) / 1000).toString().padStart(2, '0')}
                </div>
            </div>
        `).join('') : '<p style="text-align: center; opacity: 0.7; margin: 20px 0;">No tracks in this playlist</p>';

        return `
            <div class="spotify-player-content">
                ${nowPlayingHTML}
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #1ed760; margin-bottom: 15px;">🎵 ${this.currentPlaylist.name} (${tracks.length} songs)</h3>
                </div>
                <div class="track-list-container">
                    ${tracksHTML}
                </div>
            </div>
        `;
    }

    private _getNotificationsPageContent(config: any): string {
        const notificationConfig = config.get('notifications', {});
        const notificationSettings = this._getNotificationSettings(notificationConfig);
        
        return `
            <div class="controls-section">
                <h2 class="section-title">🔔 Notification Settings</h2>
                <p style="opacity: 0.8; margin-bottom: 20px;">Control which notifications Code Spa shows you</p>
                <div class="notification-controls">
                    ${notificationSettings}
                </div>
            </div>
        `;
    }

    private _getAboutPageContent(config: any, backgroundEnabled: boolean): string {
        return `
            <div class="controls-section">
                <h2 class="section-title">ℹ️ About Code Spa</h2>
                <div class="quick-stats">
                    <div class="stat-item">
                        <span>Version</span>
                        <span class="stat-value">2.0.0</span>
                    </div>
                    <div class="stat-item">
                        <span>Theme</span>
                        <span class="stat-value">${config.get('theme.preset', 'cyberpunk')}</span>
                    </div>
                    <div class="stat-item">
                        <span>Background</span>
                        <span class="stat-value">${backgroundEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                </div>
                <p>Code Spa transforms your VS Code into a personalized coding sanctuary with dynamic themes, ambient music, and intelligent project analysis.</p>
                
                <div class="controls">
                    <button class="control-button" onclick="vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-username/code-spa'))">
                        <span class="control-icon">🌐</span>
                        View on GitHub
                    </button>
                </div>
            </div>
        `;
    }

    private _getHomePageContent(backgroundEnabled: boolean, isSpotifyConnected: boolean): string {
        return `
            <div class="header">
                <div class="logo">🎨</div>
                <h1>Code Spa Control Panel</h1>
                <p class="tagline">Customize your coding experience</p>
                <div class="status-indicator"></div>
            </div>

            <div class="controls-section">
                <h2 class="section-title">Quick Actions</h2>
                <button class="control-button" onclick="navigateTo('themes')">
                    <span class="control-icon">🎨</span>
                    Themes & Appearance
                </button>
                <button class="control-button" onclick="navigateTo('music')">
                    <span class="control-icon">🎵</span>
                    Music Player ${isSpotifyConnected ? '(Connected)' : ''}
                </button>
                <button class="control-button ${backgroundEnabled ? 'active' : ''}" onclick="toggleBackground()">
                    <span class="control-icon">🖼️</span>
                    Dynamic Backgrounds ${backgroundEnabled ? 'ON' : 'OFF'}
                </button>
                <button class="control-button" onclick="analyzeProject()">
                    <span class="control-icon">🔍</span>
                    Analyze Project Context
                </button>
                <button class="control-button" onclick="navigateTo('notifications')">
                    <span class="control-icon">🔔</span>
                    Notification Settings
                </button>
                <button class="control-button" onclick="navigateTo('about')">
                    <span class="control-icon">ℹ️</span>
                    About Code Spa
                </button>
            </div>
        `;
    }

    private _getNotificationSettings(config: any): string {
        const categories = [
            { key: 'extensionActivation', label: 'Extension Activation', icon: '🎨' },
            { key: 'backgroundChanges', label: 'Background Changes', icon: '🖼️' },
            { key: 'projectAnalysis', label: 'Project Analysis', icon: '🔍' },
            { key: 'spotifyConnection', label: 'Spotify Connection', icon: '🎵' },
            { key: 'warnings', label: 'Warnings', icon: '⚠️' },
            { key: 'errors', label: 'Errors', icon: '❌' }
        ];

        return categories.map(category => {
            const isEnabled = config[category.key] !== false;
            return `
                <div class="stat-item" style="margin-bottom: 10px;">
                    <span>${category.icon} ${category.label}</span>
                    <button class="notification-toggle ${isEnabled ? 'enabled' : 'disabled'}" 
                            onclick="toggleNotifications('${category.key}')">
                        ${isEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>
            `;
        }).join('');
    }

    private async _toggleNotifications(category: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa');
        const currentValue = config.get(`notifications.${category}`, true);
        
        await config.update(
            `notifications.${category}`, 
            !currentValue, 
            vscode.ConfigurationTarget.Global
        );

        this._updateWebview();
        
        if (category !== 'extensionActivation') {
            this.notificationService.showNotificationToggle(
                `${category} notifications ${!currentValue ? 'enabled' : 'disabled'}`
            );
        }
    }

    private _updateWebview(): void {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private async _nextTrack(): Promise<void> {
        if (!this.musicPlayer) return;

        const spotifyService = this.musicPlayer.getSpotifyService();
        if (!spotifyService.getIsAuthenticated()) return;

        await spotifyService.skipToNext();
        setTimeout(() => this._updateWebview(), 500);
    }

    private async _previousTrack(): Promise<void> {
        if (!this.musicPlayer) return;

        const spotifyService = this.musicPlayer.getSpotifyService();
        if (!spotifyService.getIsAuthenticated()) return;

        await spotifyService.skipToPrevious();
        setTimeout(() => this._updateWebview(), 500);
    }

    private async _sendPlaybackStateUpdate(): Promise<void> {
        if (!this.musicPlayer) return;

        const spotifyService = this.musicPlayer.getSpotifyService();
        if (!spotifyService.getIsAuthenticated()) return;

        try {
            const playbackState = await spotifyService.getCurrentPlaybackState();
            if (playbackState && playbackState.currentTrack) {
                const currentTrack = playbackState.currentTrack;
                const isPlaying = playbackState.isPlaying;
                const progress = playbackState.progress || 0;
                const duration = currentTrack.duration;

                const progressPercentage = duration > 0 ? (progress / duration) * 100 : 0;

                // Send playback state update message to webview
                this._view?.webview.postMessage({
                    type: 'playbackStateUpdate',
                    isPlaying: isPlaying,
                    progress: progress,
                    duration: duration,
                    progressPercentage: progressPercentage,
                    track: {
                        name: currentTrack.name,
                        artist: currentTrack.artist,
                        imageUrl: currentTrack.imageUrl
                    }
                });
            }
        } catch (error) {
            console.error('Failed to get playback state:', error);
        }
    }

    private _sendNowPlayingUpdate(): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'nowPlayingUpdate',
                track: this.currentTrackInfo
            });
        }
    }
} 