import * as vscode from 'vscode';
import { SpotifyService, SpotifyPlaylist, SpotifyTrack, SpotifyUser } from './spotifyService';

interface Track {
    title: string;
    url: string;
    duration?: number;
    genre: string;
}

interface Playlist {
    name: string;
    tracks: Track[];
    description: string;
}

export class MusicPlayer {
    private context: vscode.ExtensionContext;
    private spotifyService: SpotifyService;
    private isInitialized: boolean = false;
    private isPlaying: boolean = false;
    private currentTrack: SpotifyTrack | null = null;
    private currentPlaylist: SpotifyPlaylist | null = null;
    private volume: number = 0.3;
    private spotifyPlaylists: SpotifyPlaylist[] = [];
    private fallbackPlaylists: Map<string, Playlist> = new Map();
    private webviewPanel: vscode.WebviewPanel | null = null;
    private currentTrackIndex: number = 0;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.spotifyService = new SpotifyService(context);
        this.initializeFallbackPlaylists();
    }

    private initializeFallbackPlaylists() {
        // Keep fallback playlists for when Spotify isn't connected
        const ambientPlaylist: Playlist = {
            name: 'Ambient Focus (Demo)',
            description: 'Demo playlist - Connect Spotify for real music!',
            tracks: [
                {
                    title: 'Rain on Window',
                    url: 'https://www.soundjay.com/misc/sounds/rain01.mp3',
                    duration: 300,
                    genre: 'ambient'
                },
                {
                    title: 'Forest Ambience',
                    url: 'https://www.soundjay.com/nature/sounds/forest.mp3',
                    duration: 600,
                    genre: 'nature'
                },
                {
                    title: 'Coffee Shop Buzz',
                    url: 'https://www.soundjay.com/misc/sounds/coffee-shop.mp3',
                    duration: 480,
                    genre: 'ambient'
                }
            ]
        };

        this.fallbackPlaylists.set('demo', ambientPlaylist);
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        this.isInitialized = true;
        console.log('🎵 Music player initialized');

        // Load user preferences
        const savedVolume = this.context.globalState.get('musicVolume', 0.3);
        this.volume = savedVolume as number;

        // Try to load Spotify playlists if authenticated
        if (this.spotifyService.getIsAuthenticated()) {
            await this.loadSpotifyPlaylists();
        }
    }

    private async loadSpotifyPlaylists(): Promise<void> {
        try {
            this.spotifyPlaylists = await this.spotifyService.getUserPlaylists();
            console.log(`🎵 Loaded ${this.spotifyPlaylists.length} Spotify playlists`);
            
            if (this.spotifyPlaylists.length > 0 && !this.currentPlaylist) {
                this.currentPlaylist = this.spotifyPlaylists[0];
            }
        } catch (error) {
            console.error('Failed to load Spotify playlists:', error);
        }
    }

    async connectSpotify(): Promise<boolean> {
        try {
            const success = await this.spotifyService.authenticate();
            if (success) {
                await this.loadSpotifyPlaylists();
                this.updateWebview();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Spotify connection failed:', error);
            vscode.window.showErrorMessage('Failed to connect to Spotify. Please try again.');
            return false;
        }
    }

    async disconnectSpotify(): Promise<void> {
        await this.spotifyService.disconnect();
        this.spotifyPlaylists = [];
        this.currentPlaylist = null;
        this.currentTrack = null;
        this.updateWebview();
    }

    showPlayer(): void {
        if (this.webviewPanel) {
            this.webviewPanel.reveal();
            return;
        }

        this.webviewPanel = vscode.window.createWebviewPanel(
            'codeSpaMusic',
            '🎵 Code Spa Music Player',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.webviewPanel.webview.html = this.getMusicPlayerHTML();
        
        // Handle messages from the webview
        this.webviewPanel.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(message),
            undefined,
            this.context.subscriptions
        );

        this.webviewPanel.onDidDispose(() => {
            this.webviewPanel = null;
        });
    }

    private getMusicPlayerHTML(): string {
        const isSpotifyConnected = this.spotifyService.getIsAuthenticated();
        const user = this.spotifyService.getUser();
        const playlists = isSpotifyConnected ? this.spotifyPlaylists : Array.from(this.fallbackPlaylists.values());

        const playlistOptions = playlists
            .map(playlist => {
                const id = 'id' in playlist ? playlist.id : playlist.name;
                return `<option value="${id}">${playlist.name}</option>`;
            })
            .join('');

        const tracksList = this.currentPlaylist ? 
            this.getTracksListHTML() : '<p style="text-align: center; opacity: 0.7;">Select a playlist to see tracks</p>';

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Spa Music Player</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1DB954 0%, #1ed760 50%, #191414 100%);
                    color: white;
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                }
                
                .player-container {
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(15px);
                    border-radius: 20px;
                    padding: 30px;
                    max-width: 500px;
                    margin: 0 auto;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .spotify-header {
                    text-align: center;
                    margin-bottom: 25px;
                    padding: 20px;
                    background: rgba(29, 185, 84, 0.2);
                    border-radius: 15px;
                    border: 1px solid rgba(29, 185, 84, 0.3);
                }

                .spotify-user {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    margin-bottom: 15px;
                }

                .user-avatar {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                }

                .user-info h3 {
                    margin: 0;
                    font-size: 18px;
                }

                .user-info p {
                    margin: 5px 0 0 0;
                    opacity: 0.8;
                    font-size: 14px;
                }

                .premium-badge {
                    background: linear-gradient(45deg, #FFD700, #FFA500);
                    color: #000;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-left: 10px;
                }
                
                .track-info {
                    text-align: center;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 15px;
                }

                .album-art {
                    width: 120px;
                    height: 120px;
                    border-radius: 15px;
                    margin: 0 auto 15px;
                    background: rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 40px;
                    overflow: hidden;
                }

                .album-art img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 15px;
                }
                
                .track-title {
                    font-size: 20px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .track-artist {
                    font-size: 16px;
                    opacity: 0.8;
                    margin-bottom: 5px;
                }

                .track-album {
                    font-size: 14px;
                    opacity: 0.6;
                }
                
                .controls {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .control-btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 50%;
                    width: 50px;
                    height: 50px;
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .control-btn.play-pause {
                    width: 60px;
                    height: 60px;
                    font-size: 24px;
                    background: rgba(29, 185, 84, 0.8);
                }
                
                .control-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.1);
                }

                .control-btn.play-pause:hover {
                    background: rgba(29, 185, 84, 1);
                }
                
                .volume-control {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 25px;
                    padding: 15px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 15px;
                }
                
                .volume-slider {
                    flex: 1;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 3px;
                    outline: none;
                    cursor: pointer;
                }
                
                .playlist-selector {
                    margin-bottom: 25px;
                }
                
                .playlist-selector select {
                    width: 100%;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                }

                .tracks-list {
                    max-height: 300px;
                    overflow-y: auto;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 15px;
                    padding: 15px;
                }

                .track-item {
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                    margin-bottom: 5px;
                }

                .track-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .track-item.current {
                    background: rgba(29, 185, 84, 0.3);
                    border: 1px solid rgba(29, 185, 84, 0.5);
                }

                .track-number {
                    width: 30px;
                    text-align: center;
                    opacity: 0.7;
                    font-size: 14px;
                }

                .track-details {
                    flex: 1;
                    margin-left: 10px;
                }

                .track-details .name {
                    font-weight: 500;
                    margin-bottom: 2px;
                }

                .track-details .artist {
                    font-size: 13px;
                    opacity: 0.7;
                }

                .track-duration {
                    opacity: 0.6;
                    font-size: 13px;
                }

                .auth-section {
                    text-align: center;
                    padding: 30px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 15px;
                    margin-bottom: 20px;
                }

                .spotify-btn {
                    background: #1DB954;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 25px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                }

                .spotify-btn:hover {
                    background: #1ed760;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(29, 185, 84, 0.4);
                }

                .disconnect-btn {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .disconnect-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                /* Scrollbar styling */
                .tracks-list::-webkit-scrollbar {
                    width: 8px;
                }

                .tracks-list::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                }

                .tracks-list::-webkit-scrollbar-thumb {
                    background: rgba(29, 185, 84, 0.6);
                    border-radius: 4px;
                }

                .tracks-list::-webkit-scrollbar-thumb:hover {
                    background: rgba(29, 185, 84, 0.8);
                }
            </style>
        </head>
        <body>
            <div class="player-container">
                ${isSpotifyConnected ? `
                    <div class="spotify-header">
                        <div class="spotify-user">
                            <div class="user-avatar">
                                ${user?.imageUrl ? `<img src="${user.imageUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%;">` : '🎵'}
                            </div>
                            <div class="user-info">
                                <h3>Connected to Spotify</h3>
                                <p>
                                    ${user?.displayName || 'Spotify User'}
                                    ${user?.isPremium ? '<span class="premium-badge">PREMIUM</span>' : ''}
                                </p>
                            </div>
                        </div>
                        <button class="disconnect-btn" onclick="disconnectSpotify()">Disconnect</button>
                    </div>
                ` : `
                    <div class="auth-section">
                        <h2>🎵 Connect to Spotify</h2>
                        <p>Connect your Spotify account to access your real playlists and control playback!</p>
                        <button class="spotify-btn" onclick="connectSpotify()">
                            <span>🎵</span>
                            Connect Spotify Account
                        </button>
                        <p style="font-size: 12px; opacity: 0.7; margin-top: 15px;">
                            Premium account required for playback control
                        </p>
                    </div>
                `}
                
                <div class="track-info">
                    <div class="album-art">
                        ${this.currentTrack?.imageUrl ? 
                            `<img src="${this.currentTrack.imageUrl}" alt="Album Art">` : 
                            '🎵'
                        }
                    </div>
                    <div class="track-title">${this.currentTrack?.name || 'No track selected'}</div>
                    <div class="track-artist">${this.currentTrack?.artist || 'Select a track to start'}</div>
                    ${this.currentTrack?.album ? `<div class="track-album">${this.currentTrack.album}</div>` : ''}
                </div>
                
                <div class="controls">
                    <button class="control-btn" onclick="previousTrack()" ${!isSpotifyConnected ? 'disabled' : ''}>⏮</button>
                    <button class="control-btn play-pause" onclick="togglePlayback()" ${!isSpotifyConnected ? 'disabled' : ''}>
                        ${this.isPlaying ? '⏸' : '▶'}
                    </button>
                    <button class="control-btn" onclick="nextTrack()" ${!isSpotifyConnected ? 'disabled' : ''}>⏭</button>
                </div>
                
                <div class="volume-control">
                    <span>🔊</span>
                    <input type="range" class="volume-slider" min="0" max="100" value="${this.volume * 100}" 
                           onchange="setVolume(this.value)" ${!isSpotifyConnected ? 'disabled' : ''}>
                    <span>${Math.round(this.volume * 100)}%</span>
                </div>
                
                ${playlists.length > 0 ? `
                    <div class="playlist-selector">
                        <select onchange="selectPlaylist(this.value)">
                            <option value="">Select a playlist...</option>
                            ${playlistOptions}
                        </select>
                    </div>
                    
                    <div class="tracks-list">
                        ${tracksList}
                    </div>
                ` : ''}
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function connectSpotify() {
                    vscode.postMessage({ type: 'connectSpotify' });
                }

                function disconnectSpotify() {
                    vscode.postMessage({ type: 'disconnectSpotify' });
                }

                function togglePlayback() {
                    vscode.postMessage({ type: 'togglePlayback' });
                }

                function nextTrack() {
                    vscode.postMessage({ type: 'nextTrack' });
                }

                function previousTrack() {
                    vscode.postMessage({ type: 'previousTrack' });
                }

                function setVolume(value) {
                    vscode.postMessage({ type: 'setVolume', volume: value / 100 });
                }

                function selectPlaylist(playlistId) {
                    if (playlistId) {
                        vscode.postMessage({ type: 'selectPlaylist', playlistId });
                    }
                }

                function playTrack(trackIndex) {
                    vscode.postMessage({ type: 'playTrack', trackIndex });
                }
            </script>
        </body>
        </html>
        `;
    }

    private getTracksListHTML(): string {
        if (!this.currentPlaylist) return '';

        const tracks = 'tracks' in this.currentPlaylist ? this.currentPlaylist.tracks : [];
        
        return tracks.map((track, index) => {
            const isSpotifyTrack = 'uri' in track;
            const duration = isSpotifyTrack ? 
                this.formatDuration((track as SpotifyTrack).duration) : 
                this.formatDuration((track as Track).duration ? (track as Track).duration! * 1000 : 0);
            
            return `
                <div class="track-item ${index === this.currentTrackIndex ? 'current' : ''}" 
                     onclick="playTrack(${index})">
                    <div class="track-number">${index + 1}</div>
                    <div class="track-details">
                        <div class="name">${isSpotifyTrack ? (track as SpotifyTrack).name : (track as Track).title}</div>
                        <div class="artist">${isSpotifyTrack ? (track as SpotifyTrack).artist : 'Demo Track'}</div>
                    </div>
                    <div class="track-duration">${duration}</div>
                </div>
            `;
        }).join('');
    }

    private formatDuration(ms: number): string {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    private updateWebview(): void {
        if (this.webviewPanel) {
            this.webviewPanel.webview.html = this.getMusicPlayerHTML();
        }
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'connectSpotify':
                await this.connectSpotify();
                break;
            case 'disconnectSpotify':
                await this.disconnectSpotify();
                break;
            case 'togglePlayback':
                await this.togglePlayback();
                break;
            case 'nextTrack':
                await this.nextTrack();
                break;
            case 'previousTrack':
                await this.previousTrack();
                break;
            case 'setVolume':
                this.setVolume(message.volume);
                break;
            case 'selectPlaylist':
                await this.selectPlaylist(message.playlistId);
                break;
            case 'playTrack':
                await this.playTrack(message.trackIndex);
                break;
        }
    }

    private async togglePlayback(): Promise<void> {
        if (!this.spotifyService.getIsAuthenticated()) {
            vscode.window.showWarningMessage('🎵 Please connect to Spotify first');
            return;
        }

        if (this.isPlaying) {
            await this.spotifyService.pausePlayback();
            this.isPlaying = false;
        } else {
            if (this.currentTrack) {
                await this.spotifyService.playTrack(this.currentTrack.uri);
                this.isPlaying = true;
            } else {
                vscode.window.showInformationMessage('🎵 Please select a track first');
            }
        }
        this.updateWebview();
    }

    private async nextTrack(): Promise<void> {
        if (!this.spotifyService.getIsAuthenticated()) {
            return;
        }

        if (this.currentPlaylist && this.currentTrackIndex < this.currentPlaylist.tracks.length - 1) {
            this.currentTrackIndex++;
            this.currentTrack = this.currentPlaylist.tracks[this.currentTrackIndex] as SpotifyTrack;
            await this.spotifyService.playTrack(this.currentTrack.uri);
            this.isPlaying = true;
            this.updateWebview();
        } else {
            await this.spotifyService.skipToNext();
        }
    }

    private async previousTrack(): Promise<void> {
        if (!this.spotifyService.getIsAuthenticated()) {
            return;
        }

        if (this.currentPlaylist && this.currentTrackIndex > 0) {
            this.currentTrackIndex--;
            this.currentTrack = this.currentPlaylist.tracks[this.currentTrackIndex] as SpotifyTrack;
            await this.spotifyService.playTrack(this.currentTrack.uri);
            this.isPlaying = true;
            this.updateWebview();
        } else {
            await this.spotifyService.skipToPrevious();
        }
    }

    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        this.context.globalState.update('musicVolume', this.volume);
        // Note: Spotify Web API doesn't support volume control
        // This would need to be handled by the Spotify Web Playback SDK
    }

    private async selectPlaylist(playlistId: string): Promise<void> {
        const playlist = this.spotifyPlaylists.find(p => p.id === playlistId);
        if (playlist) {
            this.currentPlaylist = playlist;
            this.currentTrackIndex = 0;
            if (playlist.tracks.length > 0) {
                this.currentTrack = playlist.tracks[0];
            }
            this.updateWebview();
        }
    }

    private async playTrack(trackIndex: number): Promise<void> {
        if (!this.currentPlaylist || !this.spotifyService.getIsAuthenticated()) {
            return;
        }

        if (trackIndex >= 0 && trackIndex < this.currentPlaylist.tracks.length) {
            this.currentTrackIndex = trackIndex;
            this.currentTrack = this.currentPlaylist.tracks[trackIndex] as SpotifyTrack;
            
            const success = await this.spotifyService.playTrack(this.currentTrack.uri);
            if (success) {
                this.isPlaying = true;
            }
            this.updateWebview();
        }
    }

    dispose(): void {
        if (this.webviewPanel) {
            this.webviewPanel.dispose();
        }
        this.spotifyService.dispose();
    }
} 