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
    private syncInterval: NodeJS.Timeout | null = null;
    private currentSpotifyVolume: number = 50;
    private lastVolumeUpdate: number = 0;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.spotifyService = new SpotifyService(context);
        this.initializeFallbackPlaylists();
    }

    private initializeFallbackPlaylists() {
        // demo playlists for when spotify isn't connected
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

        const savedVolume = this.context.globalState.get('musicVolume', 0.3);
        this.volume = savedVolume as number;

        // load spotify playlists if we're already authenticated
        if (this.spotifyService.getIsAuthenticated()) {
            await this.loadSpotifyPlaylists();
        }
    }

    private async loadSpotifyPlaylists(): Promise<void> {
        try {
            this.spotifyPlaylists = await this.spotifyService.getUserPlaylists();
            console.log(`🎵 Loaded ${this.spotifyPlaylists.length} Spotify playlists`);
            
            // auto-select first playlist if we don't have one
            if (this.spotifyPlaylists.length > 0 && !this.currentPlaylist) {
                this.currentPlaylist = this.spotifyPlaylists[0];
                this.currentTrackIndex = 0;
                if (this.currentPlaylist.tracks.length > 0) {
                    this.currentTrack = this.currentPlaylist.tracks[0];
                }
                console.log(`🎵 Auto-selected playlist: ${this.currentPlaylist.name} with ${this.currentPlaylist.tracks.length} tracks`);
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
                this.startVolumeSync();
                this.updateWebview();
                vscode.window.showInformationMessage(`🎵 Connected! Found ${this.spotifyPlaylists.length} playlists`);
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
        this.stopVolumeSync();
        this.spotifyPlaylists = [];
        this.currentPlaylist = null;
        this.currentTrack = null;
        this.updateWebview();
    }

    private startVolumeSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // sync volume every 1 second
        this.syncInterval = setInterval(async () => {
            const state = await this.spotifyService.getCurrentPlaybackState();
            if (state) {
                const newVolume = state.volume;
                const newPlayingState = state.isPlaying;
                
                // only update webview if something actually changed
                if (newVolume !== this.currentSpotifyVolume || newPlayingState !== this.isPlaying) {
                    this.currentSpotifyVolume = newVolume;
                    this.isPlaying = newPlayingState;
                    this.lastVolumeUpdate = Date.now();
                    this.updateWebview();
                }
            }
        }, 1000);
    }

    private stopVolumeSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
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
                }

                .spotify-logo {
                    font-size: 2.5rem;
                    margin-bottom: 10px;
                }

                .connection-status {
                    background: ${isSpotifyConnected ? 'rgba(29, 185, 84, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
                    padding: 15px;
                    border-radius: 12px;
                    margin-bottom: 25px;
                    text-align: center;
                    border: 1px solid ${isSpotifyConnected ? 'rgba(29, 185, 84, 0.5)' : 'rgba(255, 255, 255, 0.2)'};
                }

                .connect-btn {
                    background: #1DB954;
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 25px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    margin: 10px 5px;
                }

                .connect-btn:hover {
                    background: #1ed760;
                    transform: translateY(-2px);
                }

                .disconnect-btn {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    padding: 8px 15px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.3s ease;
                    margin-left: 10px;
                }

                .disconnect-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .playlist-section {
                    margin-bottom: 25px;
                }

                .playlist-dropdown {
                    width: 100%;
                    padding: 12px 15px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    font-size: 1rem;
                    margin-bottom: 15px;
                }

                .playlist-dropdown option {
                    background: #191414;
                    color: white;
                }

                .tracks-container {
                    max-height: 300px;
                    overflow-y: auto;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 12px;
                    padding: 15px;
                    margin-bottom: 25px;
                }

                .track-item {
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    margin-bottom: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 1px solid transparent;
                }

                .track-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateX(5px);
                }

                .track-item.active {
                    background: rgba(29, 185, 84, 0.3);
                    border-color: rgba(29, 185, 84, 0.5);
                }

                .track-image {
                    width: 50px;
                    height: 50px;
                    border-radius: 6px;
                    margin-right: 15px;
                    background: rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                }

                .track-info {
                    flex: 1;
                }

                .track-name {
                    font-weight: 600;
                    margin-bottom: 5px;
                    color: white;
                }

                .track-artist {
                    font-size: 0.9rem;
                    opacity: 0.8;
                    color: #b3b3b3;
                }

                .track-duration {
                    font-size: 0.85rem;
                    opacity: 0.7;
                    margin-left: 10px;
                }

                .controls {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 15px;
                    margin: 25px 0;
                }

                .control-btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 50%;
                    width: 50px;
                    height: 50px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-size: 1.2rem;
                }

                .control-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.1);
                }

                .play-btn {
                    background: #1DB954;
                    width: 60px;
                    height: 60px;
                    font-size: 1.5rem;
                }

                .play-btn:hover {
                    background: #1ed760;
                }

                .current-track {
                    text-align: center;
                    padding: 20px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 12px;
                    margin-bottom: 20px;
                }

                .now-playing {
                    font-size: 0.9rem;
                    opacity: 0.8;
                    margin-bottom: 10px;
                }

                .current-track-name {
                    font-size: 1.2rem;
                    font-weight: 600;
                    margin-bottom: 5px;
                }

                .current-track-artist {
                    opacity: 0.8;
                    font-size: 1rem;
                }

                .premium-notice {
                    background: rgba(255, 193, 7, 0.2);
                    border: 1px solid rgba(255, 193, 7, 0.4);
                    padding: 12px;
                    border-radius: 8px;
                    text-align: center;
                    font-size: 0.9rem;
                    margin-top: 15px;
                }

                .volume-container {
                    margin-top: 20px;
                    text-align: center;
                }

                .volume-slider {
                    width: 80%;
                    margin-top: 10px;
                }

                .playlist-info {
                    font-size: 0.9rem;
                    opacity: 0.8;
                    text-align: center;
                    margin-bottom: 15px;
                }

                ::-webkit-scrollbar {
                    width: 8px;
                }

                ::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                }

                ::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                }

                ::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                }
            </style>
        </head>
        <body>
            <div class="player-container">
                <div class="spotify-header">
                    <div class="spotify-logo">🎵</div>
                    <h2>Code Spa Music Player</h2>
                </div>

                <div class="connection-status">
                    ${isSpotifyConnected ? `
                        <div>
                            <strong>✅ Connected to Spotify</strong>
                            <br>
                            <span>Welcome, ${user?.displayName || 'User'}!</span>
                            <button class="disconnect-btn" onclick="disconnectSpotify()">Disconnect</button>
                        </div>
                    ` : `
                        <div>
                            <strong>🔗 Connect to Spotify</strong>
                            <br>
                            <span>Access your playlists and control playback</span>
                            <br>
                            <button class="connect-btn" onclick="connectSpotify()">Connect Spotify</button>
                        </div>
                    `}
                </div>

                ${isSpotifyConnected && playlists.length > 0 ? `
                    <div class="playlist-section">
                        <select class="playlist-dropdown" onchange="selectPlaylist(this.value)">
                            <option value="">Select a playlist...</option>
                            ${playlistOptions}
                        </select>
                        <div class="playlist-info">
                            ${playlists.length} playlist${playlists.length !== 1 ? 's' : ''} available
                        </div>
                    </div>

                    <div class="tracks-container">
                        ${tracksList}
                    </div>

                    ${this.currentTrack ? `
                        <div class="current-track">
                            <div class="now-playing">Now Playing</div>
                            <div class="current-track-name">${this.currentTrack.name}</div>
                            <div class="current-track-artist">${this.currentTrack.artist}</div>
                        </div>
                    ` : ''}

                    <div class="controls">
                        <button class="control-btn" onclick="previousTrack()">⏮️</button>
                        <button class="control-btn play-btn" onclick="togglePlayback()">
                            ${this.isPlaying ? '⏸️' : '▶️'}
                        </button>
                        <button class="control-btn" onclick="nextTrack()">⏭️</button>
                    </div>

                    ${user && !user.isPremium ? `
                        <div class="premium-notice">
                            ⚠️ Playback controls require Spotify Premium
                        </div>
                    ` : ''}
                ` : ''}

                <div class="volume-container">
                    <label>Volume: ${this.currentSpotifyVolume}% (Spotify App)</label>
                    <input 
                        type="range" 
                        class="volume-slider" 
                        min="0" 
                        max="100" 
                        step="1" 
                        value="${this.currentSpotifyVolume}"
                        disabled
                        title="Volume synced from your Spotify app - adjust volume in Spotify"
                    />
                    <p style="font-size: 0.8rem; opacity: 0.6; text-align: center; margin-top: 5px;">
                        Volume syncs from Spotify app every 1 second
                    </p>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let tracksContainer;

                // save scroll position before any updates
                function saveScrollPosition() {
                    tracksContainer = document.querySelector('.tracks-container');
                    if (tracksContainer) {
                        const scrollTop = tracksContainer.scrollTop;
                        vscode.setState({ scrollTop: scrollTop });
                    }
                }

                // restore scroll position after updates
                function restoreScrollPosition() {
                    const state = vscode.getState();
                    if (state && state.scrollTop && tracksContainer) {
                        tracksContainer.scrollTop = state.scrollTop;
                    }
                }

                // run after DOM loads
                window.addEventListener('load', () => {
                    tracksContainer = document.querySelector('.tracks-container');
                    restoreScrollPosition();
                    
                    // save scroll position whenever user scrolls
                    if (tracksContainer) {
                        tracksContainer.addEventListener('scroll', saveScrollPosition);
                    }
                });

                function connectSpotify() {
                    vscode.postMessage({ command: 'connectSpotify' });
                }

                function disconnectSpotify() {
                    vscode.postMessage({ command: 'disconnectSpotify' });
                }

                function selectPlaylist(playlistId) {
                    if (playlistId) {
                        saveScrollPosition();
                        vscode.postMessage({ command: 'selectPlaylist', playlistId });
                    }
                }

                function playTrack(trackIndex) {
                    saveScrollPosition();
                    vscode.postMessage({ command: 'playTrack', trackIndex });
                }

                function togglePlayback() {
                    vscode.postMessage({ command: 'togglePlayback' });
                }

                function nextTrack() {
                    vscode.postMessage({ command: 'nextTrack' });
                }

                function previousTrack() {
                    vscode.postMessage({ command: 'previousTrack' });
                }

                function setVolume(volume) {
                    vscode.postMessage({ command: 'setVolume', volume: parseFloat(volume) });
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
                <div class="track-item ${index === this.currentTrackIndex ? 'active' : ''}" 
                     onclick="playTrack(${index})">
                    <div class="track-image">
                        ${isSpotifyTrack ? `<img src="${(track as SpotifyTrack).imageUrl}" alt="Album Art">` : '🎵'}
                    </div>
                    <div class="track-info">
                        <div class="track-name">${isSpotifyTrack ? (track as SpotifyTrack).name : (track as Track).title}</div>
                        <div class="track-artist">${isSpotifyTrack ? (track as SpotifyTrack).artist : 'Demo Track'}</div>
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
        // handle all the webview button clicks
        switch (message.command) {
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
            const success = await this.spotifyService.pausePlayback();
            if (success) {
                this.isPlaying = false;
                vscode.window.showInformationMessage('⏸️ Paused');
            }
        } else {
            if (this.currentTrack) {
                const success = await this.spotifyService.playTrack(this.currentTrack.uri);
                if (success) {
                    this.isPlaying = true;
                    vscode.window.showInformationMessage(`🎵 Playing: ${this.currentTrack.name}`);
                } else {
                    vscode.window.showErrorMessage('❌ Failed to play track. Make sure Spotify is open on a device.');
                }
            } else {
                vscode.window.showInformationMessage('🎵 Please select a track first. Choose a playlist and click on a song.');
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
        // spotify api doesn't do volume - would need the web playback sdk for that
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
                // small delay before updating to avoid scroll jump
                setTimeout(() => {
                    this.updateWebview();
                }, 100);
            } else {
                this.updateWebview();
            }
        }
    }

    dispose(): void {
        this.stopVolumeSync();
        if (this.webviewPanel) {
            this.webviewPanel.dispose();
        }
        this.spotifyService.dispose();
    }
} 