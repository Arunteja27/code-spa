import * as vscode from 'vscode';
import { UICustomizer } from './uiCustomizer';
import { MusicPlayer } from './musicPlayer';
import { NotificationService } from './notificationService';

export class ControlPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codeSpaControlPanel';
    private _view?: vscode.WebviewView;
    private currentPage: string = 'home';
    private uiCustomizer?: UICustomizer;
    private musicPlayer?: MusicPlayer;
    private notificationService: NotificationService;
    
    private spotifyView: 'library' | 'category' | 'playlists' | 'playlist-songs' = 'library';
    private currentCategory: 'liked-songs' | 'recently-played' | 'top-tracks' | 'playlists' | null = null;
    private currentPlaylist: any = null;

    private currentTrackInfo: { name: string; artist: string; imageUrl: string | null; isPlaying: boolean } | null = null;
    private currentPlaybackContext: { tracks: any[]; currentIndex: number; category?: string; playlistId?: string } | null = null;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.notificationService = NotificationService.getInstance();
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
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            this.handleMessage(data);
        });
    }

    public show() {
        if (this._view) {
            this._view.show?.(true);
        } else {
            vscode.commands.executeCommand('workbench.view.extension.codeSpaPanel');
        }
    }

    private async handleMessage(data: any) {
        switch (data.type) {
            case 'navigate':
                this.currentPage = data.page;
                this.updateView();
                break;
            case 'toggleBackground':
                vscode.commands.executeCommand('code-spa.toggleBackground');
                break;
            case 'analyzeProject':
                vscode.commands.executeCommand('code-spa.analyzeProject');
                break;
            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'codeSpa');
                break;
            case 'applyTheme':
                // Handle theme application directly
                await this.applyTheme(data.theme);
                break;
            case 'connectSpotify':
                await this.handleSpotifyConnect();
                break;
            case 'disconnectSpotify':
                await this.handleSpotifyDisconnect();
                break;
            case 'togglePlayback':
                await this.handleTogglePlayback();
                break;
            case 'nextTrack':
                await this.handleNextTrack();
                break;
            case 'previousTrack':
                await this.handlePreviousTrack();
                break;
            case 'openLikedSongs':
                this.spotifyView = 'category';
                this.currentCategory = 'liked-songs';
                this.updateView();
                break;
            case 'openRecentlyPlayed':
                this.spotifyView = 'category';
                this.currentCategory = 'recently-played';
                this.updateView();
                break;
            case 'openTopTracks':
                this.spotifyView = 'category';
                this.currentCategory = 'top-tracks';
                this.updateView();
                break;
            case 'openPlaylists':
                this.spotifyView = 'playlists';
                this.currentCategory = 'playlists';
                this.updateView();
                break;
            case 'selectPlaylist':
                await this.handleSelectPlaylist(data.playlistId);
                break;
            case 'playTrack':
                await this.handlePlayTrack(data.trackIndex);
                break;
            case 'getCurrentPlaybackState':
                await this.handleGetCurrentPlaybackState();
                break;
            case 'seekToPosition':
                await this.handleSeekToPosition(data.percentage);
                break;
            case 'goBackSpotify':
                this.handleSpotifyGoBack();
                break;
            case 'openSpotifyWebsite':
                vscode.env.openExternal(vscode.Uri.parse('https://open.spotify.com'));
                break;
            case 'spotifyHome':
                this.spotifyView = 'library';
                this.currentCategory = null;
                this.currentPlaylist = null;
                this.updateView();
                break;
            case 'toggleNotifications':
                await this.handleToggleNotifications();
                break;
            case 'toggleNotificationCategory':
                await this.handleToggleNotificationCategory(data.category);
                break;
        }
    }

    private async applyTheme(themeName: string) {
        if (this.uiCustomizer) {
            await this.uiCustomizer.applyPreset(themeName);
            this.notificationService.showThemeChange(`🎨 ${themeName} theme applied!`);
        } else {
            // Fallback to command if UICustomizer not available
            vscode.commands.executeCommand('code-spa.testTheme');
        }
    }

    private async handleSpotifyConnect() {
        if (this.musicPlayer) {
            this.notificationService.showSpotifyConnection('🎵 Connecting to Spotify...');
            const success = await this.musicPlayer.connectSpotify();
            if (success) {
                // Switch to Spotify interface after successful connection
                this.currentPage = 'spotify';
                this.updateView();
                this.notificationService.showSpotifyConnection('🎵 Successfully connected to Spotify!');
            }
        }
    }

    private async handleSpotifyDisconnect() {
        if (this.musicPlayer) {
            await this.musicPlayer.disconnectSpotify();
            // Return to music page after disconnect
            this.currentPage = 'music';
            this.updateView();
            this.notificationService.showSpotifyConnection('🎵 Disconnected from Spotify');
        }
    }

    private async handleTogglePlayback() {
        if (this.musicPlayer) {
            const spotifyService = this.musicPlayer.getSpotifyService();
            if (spotifyService.getIsAuthenticated()) {
                const wasPlaying = this.currentTrackInfo?.isPlaying ?? false;
                
                if (this.currentTrackInfo) {
                    this.currentTrackInfo.isPlaying = !wasPlaying;
                }
                
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'playbackStateUpdate',
                        isPlaying: !wasPlaying
                    });
                }
                
                try {
                    if (wasPlaying) {
                        await spotifyService.pausePlayback();
                        this.notificationService.showMusicPlayback('⏸️ Playback paused');
                    } else {
                        await spotifyService.resumePlayback();
                        this.notificationService.showMusicPlayback('▶️ Playback resumed');
                    }
                } catch (error) {
                    if (this.currentTrackInfo) {
                        this.currentTrackInfo.isPlaying = wasPlaying;
                    }
                    if (this._view) {
                        this._view.webview.postMessage({
                            type: 'playbackStateUpdate',
                            isPlaying: wasPlaying
                        });
                    }
                    console.error('Toggle playback failed:', error);
                }
            }
        }
    }

    private async handleNextTrack() {
        if (this.musicPlayer) {
            const spotifyService = this.musicPlayer.getSpotifyService();
            if (spotifyService.getIsAuthenticated()) {
                if (this.currentPlaybackContext && this.currentPlaybackContext.tracks.length > 0) {
                    await this.playNextInStoredContext();
                } else {
                    await spotifyService.skipToNext();
                }
                this.notificationService.showMusicPlayback('⏭️ Skipped to next track');
                this.updateView();
            }
        }
    }

    private async handlePreviousTrack() {
        if (this.musicPlayer) {
            const spotifyService = this.musicPlayer.getSpotifyService();
            if (spotifyService.getIsAuthenticated()) {
                if (this.currentPlaybackContext && this.currentPlaybackContext.tracks.length > 0) {
                    await this.playPreviousInStoredContext();
                } else {
                    await spotifyService.skipToPrevious();
                }
                this.notificationService.showMusicPlayback('⏮️ Skipped to previous track');
                this.updateView();
            }
        }
    }

    private async handleSelectPlaylist(playlistId: string) {
        if (this.musicPlayer) {
            // try cached playlists first for speed
            this.currentPlaylist = this.musicPlayer.getSpotifyPlaylists().find(p => p.id === playlistId) || null;
            if (!this.currentPlaylist) {
                const spotifyService = this.musicPlayer.getSpotifyService();
                const playlists = await spotifyService.getUserPlaylists();
                this.currentPlaylist = playlists.find(p => p.id === playlistId) || null;
            }
            if (this.currentPlaylist) {
                this.spotifyView = 'playlist-songs';
                this.updateView();
            }
        }
    }

    private async handlePlayTrack(trackIndex: number) {
        if (this.currentPage === 'spotify' && this.musicPlayer) {
            const spotifyService = this.musicPlayer.getSpotifyService();
            if (spotifyService && spotifyService.getIsAuthenticated()) {
                let tracks: any[] = [];
                
                if (this.spotifyView === 'category' && this.currentCategory) {
                    switch (this.currentCategory) {
                        case 'liked-songs':
                            tracks = await this.musicPlayer.getLikedSongs();
                            break;
                        case 'recently-played':
                            tracks = await this.musicPlayer.getRecentlyPlayed();
                            break;
                        case 'top-tracks':
                            tracks = await this.musicPlayer.getTopTracks();
                            break;
                    }
                } else if (this.spotifyView === 'playlist-songs' && this.currentPlaylist) {
                    tracks = this.currentPlaylist.tracks || [];
                }
                
                if (tracks[trackIndex] && tracks[trackIndex].uri) {
                    const track = tracks[trackIndex];
                    
                    this.currentPlaybackContext = {
                        tracks: tracks,
                        currentIndex: trackIndex,
                        category: this.currentCategory || undefined,
                        playlistId: this.currentPlaylist?.id || undefined
                    };
                    
                    this.currentTrackInfo = {
                        name: track.name,
                        artist: track.artist,
                        imageUrl: track.imageUrl || null,
                        isPlaying: true
                    };
                    
                    if (this._view) {
                        this._view.webview.postMessage({
                            type: 'trackChanged',
                            track: {
                                name: track.name,
                                artist: track.artist,
                                imageUrl: track.imageUrl || null
                            }
                        });
                    }
                    
                    const success = await spotifyService.playTrack(track.uri);
                    if (success) {
                        this.notificationService.showMusicPlayback(`🎵 Now playing: ${track.name} by ${track.artist}`);
                        this.updateView();
                    }
                }
            }
        } else if (this.musicPlayer) {
            await this.musicPlayer.playTrackAtIndex(trackIndex);
        }
    }

    private async handleGetCurrentPlaybackState() {
        if (this.musicPlayer && this._view) {
            const spotifyService = this.musicPlayer.getSpotifyService();
            if (spotifyService.getIsAuthenticated()) {
                const playbackState = await spotifyService.getCurrentPlaybackState();
                const currentTrack = await spotifyService.getCurrentlyPlaying();
                
                if (currentTrack) {
                    this.currentTrackInfo = {
                        name: currentTrack.name,
                        artist: currentTrack.artist,
                        imageUrl: currentTrack.imageUrl || null,
                        isPlaying: playbackState?.isPlaying || false
                    };
                }
                
                let progress = 0;
                let currentTime = '0:00';
                let totalTime = '0:00';
                
                if (currentTrack && currentTrack.duration) {
                    try {
                        const spotifyApi = (spotifyService as any).spotifyApi;
                        const playbackInfo = await spotifyApi.getMyCurrentPlaybackState();
                        if (playbackInfo.body && playbackInfo.body.progress_ms !== undefined) {
                            const progressMs = playbackInfo.body.progress_ms;
                            const durationMs = currentTrack.duration;
                            
                            progress = (progressMs / durationMs) * 100;
                            currentTime = this.formatDuration(progressMs);
                            totalTime = this.formatDuration(durationMs);
                        }
                    } catch (error) {
                        console.error('Error getting playback position:', error);
                    }
                }
                
                this._view.webview.postMessage({
                    type: 'playbackState',
                    isPlaying: this.currentTrackInfo?.isPlaying || false,
                    currentTrack: this.currentTrackInfo ? {
                        name: this.currentTrackInfo.name,
                        artist: this.currentTrackInfo.artist,
                        imageUrl: this.currentTrackInfo.imageUrl || null
                    } : currentTrack,
                    progress: progress,
                    currentTime: currentTime,
                    totalTime: totalTime
                });
            }
        }
    }

    private async handleSeekToPosition(percentage: number) {
        if (this.musicPlayer) {
            const spotifyService = this.musicPlayer.getSpotifyService();
            if (spotifyService.getIsAuthenticated()) {
                const currentTrack = await spotifyService.getCurrentlyPlaying();
                if (currentTrack && currentTrack.duration) {
                    const seekPositionMs = Math.floor((percentage / 100) * currentTrack.duration);
                                            try {
                            const spotifyApi = (spotifyService as any).spotifyApi;
                            await spotifyApi.seek(seekPositionMs);
                            console.log(`Seeked to ${this.formatDuration(seekPositionMs)}`);
                        } catch (error) {
                        console.error('Error seeking:', error);
                        this.notificationService.showError('Failed to seek in track');
                    }
                }
            }
        }
    }

    private async playNextInContext() {
        if (!this.musicPlayer) return;
        
        const spotifyService = this.musicPlayer.getSpotifyService();
        const currentTrack = await spotifyService.getCurrentlyPlaying();
        
        if (!currentTrack) return;
        
        let tracks: any[] = [];
        
        // Get the current track list based on the view
        if (this.spotifyView === 'category' && this.currentCategory) {
            switch (this.currentCategory) {
                case 'liked-songs':
                    tracks = await this.musicPlayer.getLikedSongs();
                    break;
                case 'recently-played':
                    tracks = await this.musicPlayer.getRecentlyPlayed();
                    break;
                case 'top-tracks':
                    tracks = await this.musicPlayer.getTopTracks();
                    break;
            }
        } else if (this.spotifyView === 'playlist-songs' && this.currentPlaylist) {
            tracks = this.currentPlaylist.tracks || [];
        }
        
        // Find current track index and play next
        const currentIndex = tracks.findIndex(track => track.id === currentTrack.id);
        if (currentIndex >= 0 && currentIndex < tracks.length - 1) {
            const nextTrack = tracks[currentIndex + 1];
            await spotifyService.playTrack(nextTrack.uri);
        } else {
            // If at end or not found, use Spotify's native next
            await spotifyService.skipToNext();
        }
    }

    private async playPreviousInContext() {
        if (!this.musicPlayer) return;
        
        const spotifyService = this.musicPlayer.getSpotifyService();
        const currentTrack = await spotifyService.getCurrentlyPlaying();
        
        if (!currentTrack) return;
        
        let tracks: any[] = [];
        
        // Get the current track list based on the view
        if (this.spotifyView === 'category' && this.currentCategory) {
            switch (this.currentCategory) {
                case 'liked-songs':
                    tracks = await this.musicPlayer.getLikedSongs();
                    break;
                case 'recently-played':
                    tracks = await this.musicPlayer.getRecentlyPlayed();
                    break;
                case 'top-tracks':
                    tracks = await this.musicPlayer.getTopTracks();
                    break;
            }
        } else if (this.spotifyView === 'playlist-songs' && this.currentPlaylist) {
            tracks = this.currentPlaylist.tracks || [];
        }
        
        // Find current track index and play previous
        const currentIndex = tracks.findIndex(track => track.id === currentTrack.id);
        if (currentIndex > 0) {
            const previousTrack = tracks[currentIndex - 1];
            await spotifyService.playTrack(previousTrack.uri);
        } else {
            // If at beginning or not found, use Spotify's native previous
            await spotifyService.skipToPrevious();
        }
    }

    private async playNextInStoredContext() {
        if (!this.musicPlayer || !this.currentPlaybackContext) return;
        
        const spotifyService = this.musicPlayer.getSpotifyService();
        const { tracks, currentIndex } = this.currentPlaybackContext;
        
        if (currentIndex < tracks.length - 1) {
            const nextTrack = tracks[currentIndex + 1];
            this.currentPlaybackContext.currentIndex = currentIndex + 1;
            
            // Update local track info immediately
            this.currentTrackInfo = {
                name: nextTrack.name,
                artist: nextTrack.artist,
                imageUrl: nextTrack.imageUrl || null,
                isPlaying: true
            };
            
            // Send immediate update to UI
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'trackChanged',
                    track: { name: nextTrack.name, artist: nextTrack.artist, imageUrl: nextTrack.imageUrl || null }
                });
            }
            
            await spotifyService.playTrack(nextTrack.uri);
        } else {
            // At end of list, use Spotify's native next
            await spotifyService.skipToNext();
        }
    }

    private async playPreviousInStoredContext() {
        if (!this.musicPlayer || !this.currentPlaybackContext) return;
        
        const spotifyService = this.musicPlayer.getSpotifyService();
        const { tracks, currentIndex } = this.currentPlaybackContext;
        
        if (currentIndex > 0) {
            const previousTrack = tracks[currentIndex - 1];
            this.currentPlaybackContext.currentIndex = currentIndex - 1;
            
            // Update local track info immediately
            this.currentTrackInfo = {
                name: previousTrack.name,
                artist: previousTrack.artist,
                imageUrl: previousTrack.imageUrl || null,
                isPlaying: true
            };
            
            // Send immediate update to UI
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'trackChanged',
                    track: { name: previousTrack.name, artist: previousTrack.artist, imageUrl: previousTrack.imageUrl || null }
                });
            }
            
            await spotifyService.playTrack(previousTrack.uri);
        } else {
            // At beginning of list, use Spotify's native previous
            await spotifyService.skipToPrevious();
        }
    }

    private handleSpotifyGoBack() {
        if (this.spotifyView === 'category' || this.spotifyView === 'playlists') {
            this.spotifyView = 'library';
            this.currentCategory = null;
            this.currentPlaylist = null;
        } else if (this.spotifyView === 'playlist-songs') {
            this.spotifyView = 'playlists';
            this.currentCategory = 'playlists';
        }
        this.updateView();
    }

    private updateView() {
        if (this._view) {
            this._view.webview.html = this.getHtmlForWebview(this._view.webview);
        }
    }

    private formatDuration(ms: number): string {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    private getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Spa Control Panel</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    background: ${(this.currentPage === 'spotify' || this.currentPage === 'music') ? 'linear-gradient(135deg, #1DB954 0%, #1ed760 50%, #191414 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
                    color: white;
                    margin: 0;
                    padding: 8px;
                    max-height: 400px; /* Reduce maximum height */
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
                }

                body::-webkit-scrollbar {
                    width: 6px;
                }

                body::-webkit-scrollbar-track {
                    background: transparent;
                }

                body::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 3px;
                }

                .app-container {
                    background: rgba(0, 0, 0, 0.3);
                    backdrop-filter: blur(10px);
                    border-radius: 8px;
                    padding: 12px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                    min-width: 280px; /* Reduced width */
                }

                /* Navigation */
                .nav-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .nav-title {
                    font-size: 18px;
                    font-weight: bold;
                    color: #00d4ff;
                }

                .nav-back {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 6px;
                    padding: 6px 12px;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.3s ease;
                }

                .nav-back:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: #00d4ff;
                }

                /* Page content */
                .page-content {
                    animation: fadeIn 0.3s ease-in-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Home page styles */
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }

                .logo {
                    font-size: 32px;
                    margin-bottom: 10px;
                }

                .tagline {
                    opacity: 0.8;
                    font-style: italic;
                    margin-bottom: 20px;
                }

                .status-indicator {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #00ff41;
                    margin-right: 8px;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .controls-section {
                    margin-bottom: 16px; /* Reduced margin */
                }

                .section-title {
                    font-size: 16px; /* Slightly smaller */
                    font-weight: bold;
                    margin-bottom: 10px; /* Reduced margin */
                    color: #00d4ff;
                    display: flex;
                    align-items: center;
                    gap: 6px; /* Reduced gap */
                }

                .control-button {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    padding: 12px 16px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 14px;
                }

                .control-button:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: #00d4ff;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
                }

                .control-icon {
                    font-size: 16px;
                    width: 20px;
                    text-align: center;
                }

                /* Notification toggle buttons */
                .notification-toggle {
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 6px;
                    padding: 8px 12px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-size: 12px;
                    text-align: center;
                    font-family: inherit;
                }

                .notification-toggle.enabled {
                    background: rgba(34, 197, 94, 0.4);
                    border-color: rgba(34, 197, 94, 0.6);
                    color: #22c55e;
                    font-weight: 600;
                }

                .notification-toggle.disabled {
                    background: rgba(239, 68, 68, 0.4);
                    border-color: rgba(239, 68, 68, 0.6);
                    color: #ef4444;
                    font-weight: 600;
                }

                .notification-toggle:hover {
                    transform: scale(1.05);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }

                .quick-stats {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                }

                .stat-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    font-size: 13px;
                }

                .stat-value {
                    color: #00ff41;
                    font-weight: bold;
                }

                /* Theme customizer styles */
                .theme-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .theme-card {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .theme-card:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: #00d4ff;
                    transform: translateY(-2px);
                }

                .theme-name {
                    font-weight: bold;
                    margin-bottom: 5px;
                    font-size: 16px;
                }

                .theme-description {
                    font-size: 12px;
                    opacity: 0.8;
                    margin-bottom: 10px;
                }

                .color-palette {
                    display: flex;
                    gap: 6px;
                    margin-bottom: 10px;
                }

                .color-swatch {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }

                .theme-info {
                    font-size: 10px;
                    opacity: 0.6;
                }

                /* Music player styles */
                .music-section {
                    margin-bottom: 20px;
                }

                .music-controls {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 15px;
                }

                .music-button {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 6px;
                    padding: 10px;
                    color: white;
                    cursor: pointer;
                    text-align: center;
                    font-size: 12px;
                    transition: all 0.3s ease;
                }

                .music-button:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: #00d4ff;
                }
                
                .playback-btn:hover {
                    transform: scale(1.1);
                    background: rgba(255, 255, 255, 0.3) !important;
                }
                
                .playback-btn:hover:nth-child(2) {
                    background: #1ed760 !important;
                }

                /* Spotify card hover effects */
                .spotify-card:hover {
                    background: rgba(255, 255, 255, 0.2) !important;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(29, 185, 84, 0.3);
                }

                .footer {
                    text-align: center;
                    opacity: 0.6;
                    font-size: 12px;
                    margin-top: 30px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding-top: 15px;
                }
            </style>
        </head>
        <body>
            <div class="app-container">
                ${this.getPageContent()}
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function sendMessage(type, data = {}) {
                    // Immediate feedback for play/pause
                    if (type === 'togglePlayback') {
                        const playPauseBtns = ['playPauseBtn', 'playPauseBtnCategory', 'playPauseBtnPlaylist'];
                        playPauseBtns.forEach(id => {
                            const btn = document.getElementById(id);
                            if (btn) {
                                // Toggle the button immediately for responsiveness
                                btn.textContent = btn.textContent === '▶' ? '⏸' : '▶';
                            }
                        });
                    }
                    
                    vscode.postMessage({ type: type, ...data });
                }

                // Navigation history stack
                let navigationHistory = ['home'];
                let spotifyNavigationStack = [];
                
                function navigateTo(page) {
                    // Track navigation for back button
                    if (navigationHistory[navigationHistory.length - 1] !== page) {
                        navigationHistory.push(page);
                        // Keep history reasonable size
                        if (navigationHistory.length > 10) {
                            navigationHistory = navigationHistory.slice(-10);
                        }
                    }
                    sendMessage('navigate', { page: page });
                }

                function goBack() {
                    if (navigationHistory.length > 1) {
                        navigationHistory.pop(); // Remove current page
                        const previousPage = navigationHistory[navigationHistory.length - 1];
                        sendMessage('navigate', { page: previousPage });
                    } else {
                        navigateTo('home'); // Fallback to home
                    }
                }

                function smartBack() {
                    // Check if we're in Spotify context and have Spotify navigation stack
                    const currentPage = window.location.hash || 'home';
                    
                    // If we're in Spotify and have Spotify navigation history
                    if (spotifyNavigationStack.length > 0) {
                        const previousSpotifyView = spotifyNavigationStack.pop();
                        sendMessage('goBackSpotify');
                    } else {
                        // Fall back to regular navigation
                        goBack();
                    }
                }

                // Track Spotify navigation
                function trackSpotifyNavigation(view) {
                    spotifyNavigationStack.push(view);
                    // Keep stack reasonable size
                    if (spotifyNavigationStack.length > 10) {
                        spotifyNavigationStack = spotifyNavigationStack.slice(-10);
                    }
                }

                // Override sendMessage to track Spotify navigation
                const originalSendMessage = sendMessage;
                sendMessage = function(type, data = {}) {
                    // Track Spotify navigation events
                    if (type === 'openLikedSongs' || type === 'openRecentlyPlayed' || type === 'openTopTracks') {
                        trackSpotifyNavigation('library');
                    } else if (type === 'openPlaylists') {
                        trackSpotifyNavigation('library');
                    } else if (type === 'selectPlaylist') {
                        trackSpotifyNavigation('playlists');
                    }
                    
                    if (type === 'connectSpotify') {
                        const btn = document.getElementById('connectSpotifyBtn');
                        const spinner = document.getElementById('spotifyConnectingSpinner');
                        if (btn) btn.style.display = 'none';
                        if (spinner) spinner.style.display = 'block';
                    }
                    
                    originalSendMessage(type, data);
                };

                function applyTheme(themeName) {
                    sendMessage('applyTheme', { theme: themeName });
                }

                function seekToPosition(event) {
                    const progressContainer = event.currentTarget;
                    const rect = progressContainer.getBoundingClientRect();
                    const clickX = event.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                    
                    // Immediate visual feedback
                    updateProgressVisually(percentage);
                    
                    // Send seek command
                    sendMessage('seekToPosition', { percentage: percentage });
                }

                function updateProgressVisually(percentage) {
                    const progressBars = ['progressBar', 'progressBarCategory', 'progressBarPlaylist'];
                    const progressHandles = ['progressHandle', 'progressHandleCategory', 'progressHandlePlaylist'];
                    
                    progressBars.forEach((id, index) => {
                        const progressBar = document.getElementById(id);
                        const progressHandle = document.getElementById(progressHandles[index]);
                        if (progressBar && progressHandle) {
                            progressBar.style.width = percentage + '%';
                            progressHandle.style.left = percentage + '%';
                        }
                    });
                }

                // Drag functionality
                let isDragging = false;
                let isUserDraggingProgress = false;
                let currentContainer = null;

                function startDrag(event) {
                    event.preventDefault();
                    isDragging = true;
                    currentContainer = event.target.closest('.progress-container');
                    isUserDraggingProgress = true;
                    document.addEventListener('mousemove', onDrag);
                    document.addEventListener('mouseup', stopDrag);
                    event.target.style.cursor = 'grabbing';
                }

                function onDrag(event) {
                    if (!isDragging || !currentContainer) return;
                    
                    const rect = currentContainer.getBoundingClientRect();
                    const clickX = event.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                    
                    // Immediate visual feedback during drag
                    updateProgressVisually(percentage);
                }

                function stopDrag(event) {
                    if (!isDragging || !currentContainer) return;
                    
                    const rect = currentContainer.getBoundingClientRect();
                    const clickX = event.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                    
                    // Send final seek command
                    sendMessage('seekToPosition', { percentage: percentage });
                    
                    isDragging = false;
                    currentContainer = null;
                    document.removeEventListener('mousemove', onDrag);
                    document.removeEventListener('mouseup', stopDrag);
                    
                    // Reset cursor
                    const handles = document.querySelectorAll('.progress-handle');
                    handles.forEach(handle => handle.style.cursor = 'grab');
                    setTimeout(()=>{ isUserDraggingProgress = false; }, 500);
                }

                // Add interactive effects
                document.addEventListener('DOMContentLoaded', function() {
                    const buttons = document.querySelectorAll('.control-button, .theme-card, .music-button, .spotify-card, .playlist-item, .track-item');
                    buttons.forEach(button => {
                        button.addEventListener('click', function() {
                            this.style.transform = 'scale(0.95)';
                            setTimeout(() => {
                                this.style.transform = '';
                            }, 150);
                        });
                    });

                    // Update play/pause button more frequently for responsiveness
                    setInterval(() => {
                        sendMessage('getCurrentPlaybackState');
                    }, 1000);
                });

                // Track info state to prevent rubber banding
                let lastTrackInfo = { name: '', artist: '' };
                let trackUpdateTimeout = null;

                // Handle playback state updates
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'playbackStateUpdate') {
                        // Immediate play/pause button update
                        const playPauseBtns = ['playPauseBtn', 'playPauseBtnCategory', 'playPauseBtnPlaylist'];
                        playPauseBtns.forEach(id => {
                            const btn = document.getElementById(id);
                            if (btn) {
                                btn.textContent = message.isPlaying ? '⏸' : '▶';
                            }
                        });
                    } else if (message.type === 'trackChanged') {
                        // Prevent rapid track info updates (rubber banding)
                        const newTrackInfo = {
                            name: message.track.name || 'Unknown Track',
                            artist: message.track.artist || 'Unknown Artist'
                        };
                        
                        // Only update if track actually changed
                        if (newTrackInfo.name !== lastTrackInfo.name || newTrackInfo.artist !== lastTrackInfo.artist) {
                            lastTrackInfo = newTrackInfo;
                            
                            // Clear any pending update
                            if (trackUpdateTimeout) {
                                clearTimeout(trackUpdateTimeout);
                            }
                            
                            // Immediate update for track changes
                            const trackNameEls = ['trackName', 'trackNameCategory', 'trackNamePlaylist'];
                            const artistNameEls = ['artistName', 'artistNameCategory', 'artistNamePlaylist'];
                            
                            trackNameEls.forEach(id => {
                                const el = document.getElementById(id);
                                if (el) el.textContent = newTrackInfo.name;
                            });
                            
                            artistNameEls.forEach(id => {
                                const el = document.getElementById(id);
                                if (el) el.textContent = newTrackInfo.artist;
                            });
                            
                            // Update artwork if available
                            const trackArtEls = ['trackArt', 'trackArtCategory', 'trackArtPlaylist'];
                            trackArtEls.forEach(id => {
                                const el = document.getElementById(id);
                                if (el && message.track.imageUrl) {
                                    el.innerHTML = '<img src="' + message.track.imageUrl + '" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;">';
                                } else if (el) {
                                    el.innerHTML = '🎵';
                                }
                            });
                        }
                    } else if (message.type === 'playbackState') {
                        // Update progress bar (handle multiple views)
                        if (message.progress !== undefined) {
                            const progressBars = ['progressBar', 'progressBarCategory', 'progressBarPlaylist'];
                            const progressHandles = ['progressHandle', 'progressHandleCategory', 'progressHandlePlaylist'];
                            const currentTimeEls = ['currentTime', 'currentTimeCategory', 'currentTimePlaylist'];
                            const totalTimeEls = ['totalTime', 'totalTimeCategory', 'totalTimePlaylist'];
                            
                            // Update all visible progress bars
                            progressBars.forEach((id, index) => {
                                const progressBar = document.getElementById(id);
                                const progressHandle = document.getElementById(progressHandles[index]);
                                if (progressBar && progressHandle) {
                                    progressBar.style.width = message.progress + '%';
                                    progressHandle.style.left = message.progress + '%';
                                }
                            });
                            
                            // Update all visible time displays
                            if (message.currentTime) {
                                currentTimeEls.forEach(id => {
                                    const el = document.getElementById(id);
                                    if (el) el.textContent = message.currentTime;
                                });
                            }
                            
                            if (message.totalTime) {
                                totalTimeEls.forEach(id => {
                                    const el = document.getElementById(id);
                                    if (el) el.textContent = message.totalTime;
                                });
                            }
                        }

                        // Update all play/pause buttons
                        const playPauseBtns = ['playPauseBtn', 'playPauseBtnCategory', 'playPauseBtnPlaylist'];
                        playPauseBtns.forEach(id => {
                            const btn = document.getElementById(id);
                            if (btn) {
                                btn.textContent = message.isPlaying ? '⏸' : '▶';
                            }
                        });

                        // Update now playing information (only if not recently updated by trackChanged)
                        if (message.currentTrack) {
                            const newTrackInfo = {
                                name: message.currentTrack.name || 'Unknown Track',
                                artist: message.currentTrack.artist || 'Unknown Artist'
                            };
                            
                            // Only update if different from last known track (prevent rubber banding)
                            if (newTrackInfo.name !== lastTrackInfo.name || newTrackInfo.artist !== lastTrackInfo.artist) {
                                // Use timeout to prevent rapid updates
                                if (trackUpdateTimeout) {
                                    clearTimeout(trackUpdateTimeout);
                                }
                                
                                trackUpdateTimeout = setTimeout(() => {
                                    lastTrackInfo = newTrackInfo;
                                    
                                    const trackNameEls = ['trackName', 'trackNameCategory', 'trackNamePlaylist'];
                                    const artistNameEls = ['artistName', 'artistNameCategory', 'artistNamePlaylist'];
                                    
                                    trackNameEls.forEach(id => {
                                        const el = document.getElementById(id);
                                        if (el) el.textContent = newTrackInfo.name;
                                    });
                                    
                                    artistNameEls.forEach(id => {
                                        const el = document.getElementById(id);
                                        if (el) el.textContent = newTrackInfo.artist;
                                    });
                                    
                                    // Update artwork
                                    const trackArtEls = ['trackArt', 'trackArtCategory', 'trackArtPlaylist'];
                                    trackArtEls.forEach(id => {
                                        const el = document.getElementById(id);
                                        if (el && message.currentTrack.imageUrl) {
                                            el.innerHTML = '<img src="' + message.currentTrack.imageUrl + '" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;">';
                                        } else if (el) {
                                            el.innerHTML = '🎵';
                                        }
                                    });
                                }, 100); // Small delay to prevent conflicts
                            }
                        } else {
                            // Clear track info if no track is playing
                            lastTrackInfo = { name: '', artist: '' };
                            const trackNameEls = ['trackName', 'trackNameCategory', 'trackNamePlaylist'];
                            const artistNameEls = ['artistName', 'artistNameCategory', 'artistNamePlaylist'];
                            
                            trackNameEls.forEach(id => {
                                const el = document.getElementById(id);
                                if (el) el.textContent = 'No track playing';
                            });
                            
                            artistNameEls.forEach(id => {
                                const el = document.getElementById(id);
                                if (el) el.textContent = 'Select a song to start';
                            });
                            
                            // Reset artwork
                            const trackArtEls = ['trackArt', 'trackArtCategory', 'trackArtPlaylist'];
                            trackArtEls.forEach(id => {
                                const el = document.getElementById(id);
                                if (el) el.innerHTML = '🎵';
                            });
                        }
                    }
                });

                // Show progress handle on hover for all progress containers
                document.addEventListener('DOMContentLoaded', function() {
                    const progressContainers = document.querySelectorAll('.progress-container');
                    const progressHandles = ['progressHandle', 'progressHandleCategory', 'progressHandlePlaylist'];
                    
                    progressContainers.forEach((container, index) => {
                        const handle = document.getElementById(progressHandles[index] || 'progressHandle');
                        if (container && handle) {
                            container.addEventListener('mouseenter', () => {
                                handle.style.opacity = '1';
                            });
                            
                            container.addEventListener('mouseleave', () => {
                                handle.style.opacity = '0';
                            });
                        }
                    });
                });
            </script>
            
            <!-- Global Navigation Bar -->
            <div id="globalNav" style="
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(10px);
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                padding: 12px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                z-index: 1000;
            ">
                <button onclick="smartBack()" style="
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 20px;
                    padding: 8px 16px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'" title="Go Back">
                    ← Back
                </button>
                
                <button onclick="navigateTo('home')" style="
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 20px;
                    padding: 8px 16px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'" title="Go to Code Spa Home">
                    🎨 Home
                </button>
                <div style="width: 80px;"></div>
            </div>
            
            <style>
                body {
                    padding-bottom: 70px; /* Make room for global nav */
                }
            </style>
        </body>
        </html>`;
    }

    private getPageContent(): string {
        switch (this.currentPage) {
            case 'themes':
                return this.getThemeCustomizerPage();
            case 'music':
                return this.getMusicPlayerPage();
            case 'spotify':
                return this.getSpotifyPage();
            case 'settings':
                return this.getSettingsPage();
            default:
                return this.getHomePage();
        }
    }

    private getHomePage(): string {
        return `
            <div class="page-content">
                <div class="header">
                    <div class="logo">🎨 CODE SPA</div>
                    <div class="tagline">Your Personal Coding Sanctuary</div>
                    <div>
                        <span class="status-indicator"></span>
                        <span>Active & Ready</span>
                    </div>
                </div>

                <div class="controls-section">
                    <div class="section-title">
                        <span>⚡</span>
                        <span>Quick Actions</span>
                    </div>
                    <button class="control-button" onclick="sendMessage('analyzeProject')">
                        <span class="control-icon">🖼️</span>
                        <span>Refresh Background</span>
                    </button>
                    <button class="control-button" onclick="navigateTo('music')">
                        <span class="control-icon">🎶</span>
                        <span>Music Player</span>
                    </button>
                    <button class="control-button" onclick="navigateTo('themes')">
                        <span class="control-icon">🌈</span>
                        <span>Theme Customizer</span>
                    </button>
                    <button class="control-button" onclick="navigateTo('settings')">
                        <span class="control-icon">🔧</span>
                        <span>Settings</span>
                    </button>
                </div>

                <div class="footer">
                    <p>🌟 Transform your coding experience</p>
                    <p>Made with ❤️ for developers who dream in code</p>
                </div>
            </div>
        `;
    }

    private getThemeCustomizerPage(): string {
        return `
            <div class="page-content">
                <div class="nav-header">
                    <div class="nav-title">🎨 Theme Customizer</div>
                </div>

                <div class="theme-grid">
                    <div class="theme-card" onclick="applyTheme('cyberpunk')">
                        <div class="theme-name">🌃 Cyberpunk</div>
                        <div class="theme-description">Neon-lit futuristic coding environment</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background-color: #00ff41;"></div>
                            <div class="color-swatch" style="background-color: #ff0080;"></div>
                            <div class="color-swatch" style="background-color: #00d4ff;"></div>
                            <div class="color-swatch" style="background-color: #0a0a0a;"></div>
                        </div>
                        <div class="theme-info">VS Code Theme: Dark+ (default dark)</div>
                    </div>

                    <div class="theme-card" onclick="applyTheme('nature')">
                        <div class="theme-name">🌲 Nature</div>
                        <div class="theme-description">Peaceful forest coding sanctuary</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background-color: #4a7c59;"></div>
                            <div class="color-swatch" style="background-color: #8fbc8f;"></div>
                            <div class="color-swatch" style="background-color: #228b22;"></div>
                            <div class="color-swatch" style="background-color: #f5f5dc;"></div>
                        </div>
                        <div class="theme-info">VS Code Theme: Light+ (default light)</div>
                    </div>

                    <div class="theme-card" onclick="applyTheme('space')">
                        <div class="theme-name">🚀 Space</div>
                        <div class="theme-description">Cosmic coding adventure</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background-color: #4169e1;"></div>
                            <div class="color-swatch" style="background-color: #9370db;"></div>
                            <div class="color-swatch" style="background-color: #ffd700;"></div>
                            <div class="color-swatch" style="background-color: #0c0c1f;"></div>
                        </div>
                        <div class="theme-info">VS Code Theme: Dark+ (default dark)</div>
                    </div>

                    <div class="theme-card" onclick="applyTheme('minimal')">
                        <div class="theme-name">✨ Minimal</div>
                        <div class="theme-description">Clean and distraction-free</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background-color: #333333;"></div>
                            <div class="color-swatch" style="background-color: #666666;"></div>
                            <div class="color-swatch" style="background-color: #007acc;"></div>
                            <div class="color-swatch" style="background-color: #f8f8f8;"></div>
                        </div>
                        <div class="theme-info">VS Code Theme: Light+ (default light)</div>
                    </div>

                    <div class="theme-card" onclick="applyTheme('retro')">
                        <div class="theme-name">📼 Retro</div>
                        <div class="theme-description">Nostalgic 80s terminal vibes</div>
                        <div class="color-palette">
                            <div class="color-swatch" style="background-color: #ff6b35;"></div>
                            <div class="color-swatch" style="background-color: #f7931e;"></div>
                            <div class="color-swatch" style="background-color: #ffd23f;"></div>
                            <div class="color-swatch" style="background-color: #1a1a1a;"></div>
                        </div>
                        <div class="theme-info">VS Code Theme: Dark+ (default dark)</div>
                    </div>
                </div>

                <div class="footer">
                    <p>Click any theme to apply it instantly!</p>
                </div>
            </div>
        `;
    }

    private getMusicPlayerPage(): string {
        const isSpotifyConnected = this.musicPlayer?.getSpotifyService()?.getIsAuthenticated() || false;
        
        return `
            <div class="page-content">
                <div class="nav-header">
                    <div class="nav-title">🎵 Music Player</div>
                </div>

                <div class="music-section">
                    <div class="section-title">
                        <span>🎧</span>
                        <span>Spotify Integration</span>
                    </div>
                    <div class="connection-status" style="background: ${isSpotifyConnected ? 'rgba(29, 185, 84, 0.3)' : 'rgba(255, 255, 255, 0.1)'}; border: 1px solid ${isSpotifyConnected ? 'rgba(29, 185, 84, 0.5)' : 'rgba(255, 255, 255, 0.2)'}; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                        <p style="margin: 5px 0; font-weight: bold;">
                            ${isSpotifyConnected ? '✅ Connected to Spotify' : '❌ Not Connected'}
                        </p>
                        ${isSpotifyConnected ? 
                            `<p style="margin: 5px 0; opacity: 0.8; font-size: 14px;">Welcome back! Your music is ready.</p>` : 
                            `<p style="margin: 5px 0; opacity: 0.8; font-size: 14px;">Connect to access your playlists and control playback</p>`
                        }
                        ${!isSpotifyConnected ? 
                            `<button class="music-button" id="connectSpotifyBtn" onclick="sendMessage('connectSpotify')" style="background: #1DB954; color: white; margin-top:10px; width: 100%;">
                                🔗 Connect Spotify
                            </button>
                            <div id="spotifyConnectingSpinner" style="display:none; margin-top: 10px; font-size: 14px; opacity:0.8;">⏳ Connecting...</div>` : ''}
                        ${isSpotifyConnected ?
                            `<div style="display:flex; gap:10px; justify-content:center; margin-top:10px;">
                                <button class="music-button" onclick="navigateTo('spotify')" style="background: #1DB954; color: white; flex:1;">
                                    🎵 Open Spotify Player
                                </button>
                                <button class="music-button" onclick="sendMessage('disconnectSpotify')" style="background: rgba(255, 255, 255, 0.2); flex:1;">
                                    ❌ Disconnect
                                </button>
                            </div>` : ''}
                    </div>

                    <div class="music-controls" style="display:none;">
                        ${isSpotifyConnected ?
                            `<button class="music-button" onclick="navigateTo('spotify')" style="background: #1DB954; color: white;">
                                🎵 Open Spotify Player
                            </button>
                            <button class="music-button" onclick="sendMessage('disconnectSpotify')" style="background: rgba(255, 255, 255, 0.2);">
                                ❌ Disconnect
                            </button>` : ''}
                    </div>
                </div>

                <div class="footer">
                    <p>🎵 ${isSpotifyConnected ? 'Spotify is ready! Click above to start listening.' : 'Connect Spotify to access your playlists and control playback'}</p>
                </div>
            </div>
        `;
    }

    private getSpotifyPage(): string {
        const user = this.musicPlayer?.getSpotifyService()?.getUser();
        const userName = user?.displayName || 'Spotify User';
        
        return `
            <div class="page-content">
                <div class="nav-header">
                    <div class="nav-title" onclick="sendMessage('spotifyHome')" style="cursor: pointer; transition: opacity 0.3s ease;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'" title="Back to Spotify Home">🎵 Spotify Player</div>
                </div>

                ${this.getSpotifyContent()}
            </div>
        `;
    }

    private getSpotifyContent(): string {
        switch (this.spotifyView) {
            case 'library':
                return this.getSpotifyLibraryHTML();
            case 'category':
                return this.getSpotifyCategoryHTML();
            case 'playlists':
                return this.getSpotifyPlaylistsHTML();
            case 'playlist-songs':
                return this.getSpotifyPlaylistSongsHTML();
            default:
                return this.getSpotifyLibraryHTML();
        }
    }

    private getSpotifyLibraryHTML(): string {
        const user = this.musicPlayer?.getSpotifyService()?.getUser();
        const userName = user?.displayName || 'Spotify User';
        
        // Get real counts
        const likedCount = this.musicPlayer?.getLikedSongs().length || 0;
        const recentCount = this.musicPlayer?.getRecentlyPlayed().length || 0;
        const topCount = this.musicPlayer?.getTopTracks().length || 0;
        const playlistCount = this.musicPlayer?.getSpotifyPlaylists().length || 0;
        
        return `
            <div class="spotify-welcome" style="background: linear-gradient(135deg, #1DB954, #1ed760); padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                <h2 style="margin: 0 0 10px 0; color: white;">🎵 Welcome, ${userName}!</h2>
                <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">Your Spotify is connected and ready</p>
            </div>

            <div class="spotify-sections">
                <div class="section-title">
                    <span>🎧</span>
                    <span>Your Music Library</span>
                </div>
                
                <div class="spotify-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div class="spotify-card" onclick="sendMessage('openLikedSongs')" style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.3s ease;">
                        <div style="font-size: 24px; margin-bottom: 8px;">💚</div>
                        <div style="font-weight: bold; margin-bottom: 4px;">Liked Songs</div>
                        <div style="font-size: 12px; opacity: 0.7;">${likedCount} songs</div>
                    </div>
                    
                    <div class="spotify-card" onclick="sendMessage('openRecentlyPlayed')" style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.3s ease;">
                        <div style="font-size: 24px; margin-bottom: 8px;">🕒</div>
                        <div style="font-weight: bold; margin-bottom: 4px;">Recently Played</div>
                        <div style="font-size: 12px; opacity: 0.7;">${recentCount} tracks</div>
                    </div>
                    
                    <div class="spotify-card" onclick="sendMessage('openTopTracks')" style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.3s ease;">
                        <div style="font-size: 24px; margin-bottom: 8px;">🔥</div>
                        <div style="font-weight: bold; margin-bottom: 4px;">Top Tracks</div>
                        <div style="font-size: 12px; opacity: 0.7;">${topCount} tracks</div>
                    </div>
                    
                    <div class="spotify-card" onclick="sendMessage('openPlaylists')" style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.3s ease;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📋</div>
                        <div style="font-weight: bold; margin-bottom: 4px;">Playlists</div>
                        <div style="font-size: 12px; opacity: 0.7;">${playlistCount} playlists</div>
                    </div>
                </div>
            </div>

            <div class="playback-controls" style="background: rgba(0, 0, 0, 0.3); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <div class="section-title" style="text-align: center; margin-bottom: 15px;">
                    <span>🎮</span>
                    <span>Playback Controls</span>
                </div>
                
                <!-- Now Playing Display -->
                <div class="now-playing" id="nowPlaying" style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center; display: flex; align-items: center; gap: 12px;">
                    <div id="trackArt" style="width: 50px; height: 50px; border-radius: 6px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px;">🎵</div>
                    <div style="flex: 1; min-width: 0; text-align: left;">
                        <div id="trackName" style="font-weight: bold; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">No track playing</div>
                        <div id="artistName" style="font-size: 12px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Select a song to start</div>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="progress-container" style="background: rgba(255, 255, 255, 0.2); height: 6px; border-radius: 3px; margin: 15px 0; cursor: pointer; position: relative;" onclick="seekToPosition(event)">
                    <div class="progress-bar" id="progressBar" style="background: #1DB954; height: 100%; border-radius: 3px; width: 0%; transition: width 0.1s ease;"></div>
                    <div class="progress-handle" id="progressHandle" style="position: absolute; top: -4px; width: 14px; height: 14px; background: #1DB954; border-radius: 50%; transform: translateX(-50%); left: 0%; cursor: grab; opacity: 0; transition: opacity 0.2s ease;" onmousedown="startDrag(event)"></div>
                </div>
                <div class="time-display" style="display: flex; justify-content: space-between; font-size: 11px; opacity: 0.7; margin-bottom: 15px;">
                    <span id="currentTime">0:00</span>
                    <span id="totalTime">0:00</span>
                </div>

                <div class="control-buttons" style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                    <button class="playback-btn" onclick="sendMessage('previousTrack')" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; line-height: 1;">⏮</button>
                    <button class="playback-btn" onclick="sendMessage('togglePlayback')" style="width: 60px; height: 60px; border-radius: 50%; background: #1DB954; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.3s ease; line-height: 1;" id="playPauseBtn">▶</button>
                    <button class="playback-btn" onclick="sendMessage('nextTrack')" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; line-height: 1;">⏭</button>
                </div>
            </div>

            <div class="spotify-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <button class="control-button" onclick="navigateTo('music')" style="background: rgba(255, 255, 255, 0.1);">
                    <span class="control-icon">🎵</span>
                    <span>Music Settings</span>
                </button>
                <button class="control-button" onclick="sendMessage('disconnectSpotify')" style="background: rgba(255, 0, 0, 0.2);">
                    <span class="control-icon">❌</span>
                    <span>Disconnect</span>
                </button>
            </div>
        `;
    }

    private getSpotifyCategoryHTML(): string {
        let title = '';
        let icon = '';
        let tracks: any[] = [];
        
        if (this.musicPlayer) {
            switch (this.currentCategory) {
                case 'liked-songs':
                    title = 'Liked Songs';
                    icon = '💚';
                    tracks = this.musicPlayer.getLikedSongs();
                    break;
                case 'recently-played':
                    title = 'Recently Played';
                    icon = '🕒';
                    tracks = this.musicPlayer.getRecentlyPlayed();
                    break;
                case 'top-tracks':
                    title = 'Your Top Tracks';
                    icon = '🔥';
                    tracks = this.musicPlayer.getTopTracks();
                    break;
                default:
                    title = 'Music';
                    icon = '🎵';
            }
        }

        const currentTrack = this.musicPlayer?.getCurrentTrack();
        const tracksHTML = tracks.length > 0 ? tracks.map((track, index) => {
            const duration = this.formatDuration(track.duration);
            const isActive = currentTrack && currentTrack.id === track.id;
            return `
                <div class="track-item ${isActive ? 'active' : ''}" onclick="sendMessage('playTrack', {trackIndex: ${index}})" style="background: ${isActive ? 'rgba(29, 185, 84, 0.3)' : 'rgba(255, 255, 255, 0.1)'}; padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; transition: all 0.3s ease;">
                    <div style="font-size: 16px; width: 20px; text-align: center;">
                        ${track.imageUrl ? `<img src="${track.imageUrl}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">` : '🎵'}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: bold; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.name}</div>
                        <div style="font-size: 12px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.artist}</div>
                    </div>
                    <div style="font-size: 12px; opacity: 0.6;">${duration}</div>
                    ${isActive ? '<div style="color: #1DB954; font-size: 12px;">♪</div>' : ''}
                </div>
            `;
        }).join('') : `<p style="text-align: center; opacity: 0.7; margin: 20px 0;">No ${title.toLowerCase()} found</p>`;

        return `
            <div class="section-title" style="margin-bottom: 20px;">
                <span>${icon}</span>
                <span>${title} (${tracks.length})</span>
            </div>

            <div class="tracks-container" style="
                background: rgba(0, 0, 0, 0.2); 
                border-radius: 8px; 
                padding: 15px; 
                max-height: 300px; 
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
                padding-right: 4px;
            ">
                ${tracksHTML}
            </div>

            <div class="playback-controls" style="background: rgba(0, 0, 0, 0.3); padding: 20px; border-radius: 12px; margin-top: 15px;">
                <div class="section-title" style="text-align: center; margin-bottom: 15px;">
                    <span>🎮</span>
                    <span>Playback Controls</span>
                </div>
                
                <!-- Now Playing Display -->
                <div class="now-playing" id="nowPlayingCategory" style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center; display: flex; align-items: center; gap: 12px;">
                    <div id="trackArtCategory" style="width: 50px; height: 50px; border-radius: 6px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px;">🎵</div>
                    <div style="flex: 1; min-width: 0; text-align: left;">
                        <div id="trackNameCategory" style="font-weight: bold; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">No track playing</div>
                        <div id="artistNameCategory" style="font-size: 12px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Select a song to start</div>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="progress-container" style="background: rgba(255, 255, 255, 0.2); height: 6px; border-radius: 3px; margin: 15px 0; cursor: pointer; position: relative;" onclick="seekToPosition(event)">
                    <div class="progress-bar" id="progressBarCategory" style="background: #1DB954; height: 100%; border-radius: 3px; width: 0%; transition: width 0.1s ease;"></div>
                    <div class="progress-handle" id="progressHandleCategory" style="position: absolute; top: -4px; width: 14px; height: 14px; background: #1DB954; border-radius: 50%; transform: translateX(-50%); left: 0%; cursor: grab; opacity: 0; transition: opacity 0.2s ease;" onmousedown="startDrag(event)"></div>
                </div>
                <div class="time-display" style="display: flex; justify-content: space-between; font-size: 11px; opacity: 0.7; margin-bottom: 15px;">
                    <span id="currentTimeCategory">0:00</span>
                    <span id="totalTimeCategory">0:00</span>
                </div>

                <div class="control-buttons" style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                    <button class="playback-btn" onclick="sendMessage('previousTrack')" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; line-height: 1;">⏮</button>
                    <button class="playback-btn" onclick="sendMessage('togglePlayback')" style="width: 60px; height: 60px; border-radius: 50%; background: #1DB954; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.3s ease; line-height: 1;" id="playPauseBtnCategory">▶</button>
                    <button class="playback-btn" onclick="sendMessage('nextTrack')" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; line-height: 1;">⏭</button>
                </div>
            </div>
        `;
    }

    private getSpotifyPlaylistsHTML(): string {
        const playlists = this.musicPlayer?.getSpotifyPlaylists() || [];
        
        const playlistsHTML = playlists.length > 0 ? playlists.map(playlist => `
            <div class="playlist-tile" onclick="sendMessage('selectPlaylist', {playlistId: '${playlist.id}'})" style="
                background: rgba(255, 255, 255, 0.08); 
                border-radius: 8px; 
                cursor: pointer; 
                transition: all 0.3s ease; 
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                position: relative;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.1);
            " onmouseover="this.style.background='rgba(255, 255, 255, 0.15)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.08)'; this.style.transform='translateY(0)'">
                <div style="
                    width: 100%; 
                    aspect-ratio: 1; 
                    border-radius: 8px; 
                    overflow: hidden; 
                    background: linear-gradient(135deg, #1DB954, #1ed760);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                ">
                    ${playlist.imageUrl ? 
                        `<img src="${playlist.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                        `<div style="font-size: 32px; color: white;">🎵</div>`
                    }
                    <div style="
                        position: absolute;
                        bottom: 8px;
                        right: 8px;
                        width: 32px;
                        height: 32px;
                        background: #1DB954;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: black;
                        font-size: 14px;
                        opacity: 0;
                        transition: all 0.3s ease;
                        transform: translateY(8px);
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                    " class="play-button">▶</div>
                </div>
                <div style="flex: 1; min-height: 0;">
                    <div style="
                        font-weight: 600; 
                        font-size: 14px;
                        margin-bottom: 4px; 
                        white-space: nowrap; 
                        overflow: hidden; 
                        text-overflow: ellipsis;
                        color: white;
                    ">${playlist.name}</div>
                    <div style="
                        font-size: 12px; 
                        opacity: 0.7; 
                        line-height: 1.3;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    ">${playlist.tracks.length} songs • by ${playlist.owner}</div>
                </div>
            </div>
        `).join('') : '<p style="text-align: center; opacity: 0.7; margin: 40px 0; font-size: 14px;">No playlists found</p>';

        return `
            <div style="margin-bottom: 24px;">
                <h2 style="
                    font-size: 24px; 
                    font-weight: 700; 
                    margin: 0; 
                    color: white;
                    margin-bottom: 8px;
                ">Your Playlists</h2>
                <p style="
                    font-size: 14px; 
                    opacity: 0.7; 
                    margin: 0;
                ">${playlists.length} playlists</p>
            </div>

            <div class="playlists-grid" style="
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); 
                gap: 16px; 
                max-height: 500px; 
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
                padding-right: 4px;
            ">
                ${playlistsHTML}
            </div>
            
            <style>
                .playlists-grid::-webkit-scrollbar {
                    width: 8px;
                }
                .playlists-grid::-webkit-scrollbar-track {
                    background: transparent;
                }
                .playlists-grid::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                }
                .playlists-grid::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                }
                .playlist-tile:hover .play-button {
                    opacity: 1 !important;
                    transform: translateY(0) !important;
                }
                .tracks-container::-webkit-scrollbar {
                    width: 8px;
                }
                .tracks-container::-webkit-scrollbar-track {
                    background: transparent;
                }
                .tracks-container::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                }
                .tracks-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                }
            </style>
        `;
    }

    private getSpotifyPlaylistSongsHTML(): string {
        const playlistName = this.currentPlaylist?.name || 'Playlist';
        const tracks = this.currentPlaylist?.tracks || [];
        const currentTrack = this.musicPlayer?.getCurrentTrack();
        
        const tracksHTML = tracks.length > 0 ? tracks.map((track: any, index: number) => {
            const duration = this.formatDuration(track.duration);
            const isActive = currentTrack && currentTrack.id === track.id;
            return `
                <div class="track-item ${isActive ? 'active' : ''}" onclick="sendMessage('playTrack', {trackIndex: ${index}})" style="background: ${isActive ? 'rgba(29, 185, 84, 0.3)' : 'rgba(255, 255, 255, 0.1)'}; padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; transition: all 0.3s ease;">
                    <div style="font-size: 16px; width: 20px; text-align: center;">
                        ${track.imageUrl ? `<img src="${track.imageUrl}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">` : '🎵'}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: bold; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.name}</div>
                        <div style="font-size: 12px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.artist} • ${track.album}</div>
                    </div>
                    <div style="font-size: 12px; opacity: 0.6;">${duration}</div>
                    ${isActive ? '<div style="color: #1DB954; font-size: 12px;">♪</div>' : ''}
                </div>
            `;
        }).join('') : '<p style="text-align: center; opacity: 0.7; margin: 20px 0;">No tracks in this playlist</p>';
        
        return `
            <div class="section-title" style="margin-bottom: 20px;">
                <span>🎵</span>
                <span>${playlistName} (${tracks.length} songs)</span>
            </div>

            <div class="tracks-container" style="
                background: rgba(0, 0, 0, 0.2); 
                border-radius: 8px; 
                padding: 15px; 
                max-height: 300px; 
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
                padding-right: 4px;
            ">
                ${tracksHTML}
            </div>

            <div class="playback-controls" style="background: rgba(0, 0, 0, 0.3); padding: 20px; border-radius: 12px; margin-top: 15px;">
                <div class="section-title" style="text-align: center; margin-bottom: 15px;">
                    <span>🎮</span>
                    <span>Playback Controls</span>
                </div>
                
                <!-- Now Playing Display -->
                <div class="now-playing" id="nowPlayingPlaylist" style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center; display: flex; align-items: center; gap: 12px;">
                    <div id="trackArtPlaylist" style="width: 50px; height: 50px; border-radius: 6px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px;">🎵</div>
                    <div style="flex: 1; min-width: 0; text-align: left;">
                        <div id="trackNamePlaylist" style="font-weight: bold; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">No track playing</div>
                        <div id="artistNamePlaylist" style="font-size: 12px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Select a song to start</div>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="progress-container" style="background: rgba(255, 255, 255, 0.2); height: 6px; border-radius: 3px; margin: 15px 0; cursor: pointer; position: relative;" onclick="seekToPosition(event)">
                    <div class="progress-bar" id="progressBarPlaylist" style="background: #1DB954; height: 100%; border-radius: 3px; width: 0%; transition: width 0.1s ease;"></div>
                    <div class="progress-handle" id="progressHandlePlaylist" style="position: absolute; top: -4px; width: 14px; height: 14px; background: #1DB954; border-radius: 50%; transform: translateX(-50%); left: 0%; cursor: grab; opacity: 0; transition: opacity 0.2s ease;" onmousedown="startDrag(event)"></div>
                </div>
                <div class="time-display" style="display: flex; justify-content: space-between; font-size: 11px; opacity: 0.7; margin-bottom: 15px;">
                    <span id="currentTimePlaylist">0:00</span>
                    <span id="totalTimePlaylist">0:00</span>
                </div>

                <div class="control-buttons" style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                    <button class="playback-btn" onclick="sendMessage('previousTrack')" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; line-height: 1;">⏮</button>
                    <button class="playback-btn" onclick="sendMessage('togglePlayback')" style="width: 60px; height: 60px; border-radius: 50%; background: #1DB954; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.3s ease; line-height: 1;" id="playPauseBtnPlaylist">▶</button>
                    <button class="playback-btn" onclick="sendMessage('nextTrack')" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; line-height: 1;">⏭</button>
                </div>
            </div>
        `;
    }

    private getSettingsPage(): string {
        const notificationConfig = this.notificationService.getConfig();
        const allEnabled = Object.values(notificationConfig).every(Boolean);
        const allDisabled = Object.values(notificationConfig).every(val => !val);
        
        let globalButtonColor, globalButtonText, globalButtonIcon;
        if (allEnabled) {
            globalButtonColor = 'background: rgba(34, 197, 94, 0.3); border-color: rgba(34, 197, 94, 0.5); color: #22c55e;';
            globalButtonText = 'All Notifications ON';
            globalButtonIcon = '🟢';
        } else if (allDisabled) {
            globalButtonColor = 'background: rgba(239, 68, 68, 0.3); border-color: rgba(239, 68, 68, 0.5); color: #ef4444;';
            globalButtonText = 'All Notifications OFF';
            globalButtonIcon = '🔴';
        } else {
            globalButtonColor = 'background: rgba(255, 165, 0, 0.3); border-color: #FFA500; color: #FFA500;';
            globalButtonText = 'Mixed Settings - Click to Turn All OFF';
            globalButtonIcon = '🟡';
        }
        
        return `
            <div class="page-content">
                <div class="nav-header">
                    <div class="nav-title">⚙️ Settings</div>
                </div>

                <div class="controls-section">
                    <div class="section-title">
                        <span>🔔</span>
                        <span>Notification Settings</span>
                    </div>
                    <button class="control-button" onclick="sendMessage('toggleNotifications')" style="${globalButtonColor} font-weight: 600;">
                        <span class="control-icon">${globalButtonIcon}</span>
                        <span>${globalButtonText}</span>
                    </button>
                    
                    <div class="notification-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
                        <button class="notification-toggle ${notificationConfig.extensionActivation ? 'enabled' : 'disabled'}" onclick="sendMessage('toggleNotificationCategory', {category: 'extensionActivation'})">
                            <span>🚀 Activation</span>
                        </button>
                        <button class="notification-toggle ${notificationConfig.backgroundChanges ? 'enabled' : 'disabled'}" onclick="sendMessage('toggleNotificationCategory', {category: 'backgroundChanges'})">
                            <span>🖼️ Background</span>
                        </button>
                        <button class="notification-toggle ${notificationConfig.themeChanges ? 'enabled' : 'disabled'}" onclick="sendMessage('toggleNotificationCategory', {category: 'themeChanges'})">
                            <span>🎨 Themes</span>
                        </button>
                        <button class="notification-toggle ${notificationConfig.spotifyConnection ? 'enabled' : 'disabled'}" onclick="sendMessage('toggleNotificationCategory', {category: 'spotifyConnection'})">
                            <span>🎵 Spotify</span>
                        </button>
                        <button class="notification-toggle ${notificationConfig.musicPlayback ? 'enabled' : 'disabled'}" onclick="sendMessage('toggleNotificationCategory', {category: 'musicPlayback'})">
                            <span>🎶 Playback</span>
                        </button>
                        <button class="notification-toggle ${notificationConfig.projectAnalysis ? 'enabled' : 'disabled'}" onclick="sendMessage('toggleNotificationCategory', {category: 'projectAnalysis'})">
                            <span>🔍 Analysis</span>
                        </button>
                        <button class="notification-toggle ${notificationConfig.errors ? 'enabled' : 'disabled'}" onclick="sendMessage('toggleNotificationCategory', {category: 'errors'})">
                            <span>❌ Errors</span>
                        </button>
                        <button class="notification-toggle ${notificationConfig.warnings ? 'enabled' : 'disabled'}" onclick="sendMessage('toggleNotificationCategory', {category: 'warnings'})">
                            <span>⚠️ Warnings</span>
                        </button>
                    </div>
                </div>

                <div class="controls-section">
                    <div class="section-title">
                        <span>🔧</span>
                        <span>Configuration</span>
                    </div>
                    <button class="control-button" onclick="sendMessage('openSettings')">
                        <span class="control-icon">⚙️</span>
                        <span>Open VS Code Settings</span>
                    </button>
                </div>
            </div>
        `;
    }

    private async handleToggleNotifications(){
        const enabled = await this.notificationService.toggleAllNotifications();
        // Don't show notification about toggling notifications - that would be confusing!
        console.log(`🔔 All notifications ${enabled ? 'enabled' : 'disabled'}`);
        this.updateView();
    }

    private async handleToggleNotificationCategory(category: string) {
        let enabled = false;
        switch (category) {
            case 'extensionActivation':
                enabled = await this.notificationService.toggleExtensionActivation();
                break;
            case 'backgroundChanges':
                enabled = await this.notificationService.toggleBackgroundChanges();
                break;
            case 'themeChanges':
                enabled = await this.notificationService.toggleThemeChanges();
                break;
            case 'spotifyConnection':
                enabled = await this.notificationService.toggleSpotifyConnection();
                break;
            case 'musicPlayback':
                enabled = await this.notificationService.toggleMusicPlayback();
                break;
            case 'projectAnalysis':
                enabled = await this.notificationService.toggleProjectAnalysis();
                break;
            case 'errors':
                enabled = await this.notificationService.toggleErrors();
                break;
            case 'warnings':
                enabled = await this.notificationService.toggleWarnings();
                break;
        }
        // Don't show notification about toggling notifications - just log it
        console.log(`🔔 ${category} notifications ${enabled ? 'enabled' : 'disabled'}`);
        this.updateView();
    }
} 