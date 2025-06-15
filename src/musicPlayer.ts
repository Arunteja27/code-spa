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
    private currentView: 'library' | 'category' | 'playlists' | 'playlist-songs' = 'library';
    private currentCategory: 'liked-songs' | 'recently-played' | 'top-tracks' | 'playlists' | null = null;
    private likedSongs: SpotifyTrack[] = [];
    private recentlyPlayed: SpotifyTrack[] = [];
    private topTracks: SpotifyTrack[] = [];
    
    private playbackPlaylist: SpotifyPlaylist | null = null;
    private playbackTrackIndex: number = 0;
    private trackEndTimer: NodeJS.Timeout | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.spotifyService = new SpotifyService(context);
        this.initializeFallbackPlaylists();
    }

    private initializeFallbackPlaylists() {
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

        if (this.spotifyService.getIsAuthenticated()) {
            await this.loadSpotifyPlaylists();
        }
    }

    private async loadSpotifyPlaylists(): Promise<void> {
        try {
            const allContent = await this.spotifyService.getUserPlaylists();
            
            this.likedSongs = allContent.find(p => p.id === 'liked-songs')?.tracks || [];
            this.recentlyPlayed = allContent.find(p => p.id === 'recently-played')?.tracks || [];
            this.topTracks = allContent.find(p => p.id === 'top-tracks')?.tracks || [];
            
            this.spotifyPlaylists = allContent.filter(p => 
                !['liked-songs', 'recently-played', 'top-tracks'].includes(p.id)
            );
            
            console.log(`🎵 Loaded ${this.likedSongs.length} liked songs, ${this.recentlyPlayed.length} recent tracks, ${this.topTracks.length} top tracks, ${this.spotifyPlaylists.length} playlists`);
        } catch (error) {
            console.error('Failed to load Spotify content:', error);
        }
    }

    async connectSpotify(): Promise<boolean> {
        try {
            const success = await this.spotifyService.authenticate();
            if (success) {
                await this.loadSpotifyPlaylists();
                
                this.currentView = 'library';
                this.currentCategory = null;
                this.currentPlaylist = null;
                this.currentTrackIndex = 0;
                
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
        this.likedSongs = [];
        this.recentlyPlayed = [];
        this.topTracks = [];
        this.currentPlaylist = null;
        this.currentTrack = null;
        this.currentView = 'library';
        this.currentCategory = null;
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        
        this.playbackPlaylist = null;
        this.playbackTrackIndex = 0;
        
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

                // detect track end using Spotify API progress
                try {
                    const playback = await (this.spotifyService as any).spotifyApi.getMyCurrentPlaybackState();
                    if (playback.body && playback.body.item) {
                        const duration = playback.body.item.duration_ms;
                        const progress = playback.body.progress_ms;
                        if (!newPlayingState && progress >= duration - 2000) {
                            // track finished
                            await this.nextTrack();
                        }
                    }
                } catch {}

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
        // Redirect to control panel instead of opening separate window
        vscode.window.showInformationMessage(
            '🎵 Music player is now available in the Code Spa control panel!',
            'Open Control Panel'
        ).then(selection => {
            if (selection === 'Open Control Panel') {
                vscode.commands.executeCommand('code-spa.openControlPanel');
            }
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
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
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

                .connection-status p {
                    font-size: 1.1rem;
                    font-weight: 500;
                    margin: 5px 0;
                }

                .connect-btn {
                    background: #1DB954;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 0.9rem;
                    transition: all 0.3s ease;
                    margin: 8px 5px;
                    outline: none;
                }

                .connect-btn:hover {
                    background: #1ed760;
                    transform: translateY(-2px);
                }

                .disconnect-btn {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 15px;
                    cursor: pointer;
                    font-weight: 400;
                    font-size: 0.8rem;
                    transition: all 0.3s ease;
                    margin-top: 10px;
                    outline: none;
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

                .library-tiles {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-bottom: 25px;
                }

                .library-tile {
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
                }

                .library-tile:hover {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-3px);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
                }

                .library-tile .icon {
                    font-size: 2.5rem;
                    margin-bottom: 10px;
                    display: block;
                }

                .tile-image {
                    width: 80px;
                    height: 80px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    object-fit: cover;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                    transition: transform 0.3s ease;
                }

                .library-tile:hover .tile-image {
                    transform: scale(1.05);
                }

                .library-tile .title {
                    font-weight: 600;
                    font-size: 1.1rem;
                    margin-bottom: 5px;
                }

                .library-tile .count {
                    font-size: 0.9rem;
                    opacity: 0.8;
                }

                .back-btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 8px;
                    padding: 8px 15px;
                    color: white;
                    cursor: pointer;
                    margin-bottom: 15px;
                    transition: all 0.3s ease;
                }

                .back-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
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
                    outline: none;
                    color: white;
                }

                .control-btn:focus {
                    outline: none;
                    box-shadow: none;
                }

                .control-btn:active {
                    outline: none;
                    box-shadow: none;
                }

                .control-btn::-moz-focus-inner {
                    border: 0;
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

                ${isSpotifyConnected ? this.getContentHTML() : ''}

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

                function selectCategory(category) {
                    saveScrollPosition();
                    vscode.postMessage({ command: 'selectCategory', category });
                }

                function goBack() {
                    saveScrollPosition();
                    vscode.postMessage({ command: 'goBack' });
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
            case 'selectCategory':
                this.selectCategory(message.category);
                break;
            case 'goBack':
                this.goBack();
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
            }
        } else {
            // Try to resume playback first
            const resumeSuccess = await this.spotifyService.resumePlayback();
            if (resumeSuccess) {
                this.isPlaying = true;
                this.scheduleAutoNext(this.currentTrack?.duration, 0);
            } else if (this.currentTrack) {
                // If resume fails, play the selected track
                const success = await this.spotifyService.playTrack(this.currentTrack.uri);
                if (success) {
                    this.isPlaying = true;
                    this.scheduleAutoNext(this.currentTrack.duration, 0);
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

        // Use playback context instead of current view context
        if (this.playbackPlaylist && this.playbackTrackIndex < this.playbackPlaylist.tracks.length - 1) {
            this.playbackTrackIndex++;
            this.currentTrack = this.playbackPlaylist.tracks[this.playbackTrackIndex] as SpotifyTrack;
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

        // Use playback context instead of current view context
        if (this.playbackPlaylist && this.playbackTrackIndex > 0) {
            this.playbackTrackIndex--;
            this.currentTrack = this.playbackPlaylist.tracks[this.playbackTrackIndex] as SpotifyTrack;
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
            this.currentView = 'playlist-songs';
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
            
            // Set playback context - remember which playlist and track index is actually playing
            this.playbackPlaylist = this.currentPlaylist;
            this.playbackTrackIndex = trackIndex;
            
            const success = await this.spotifyService.playTrack(this.currentTrack.uri);
            if (success) {
                this.isPlaying = true;
                this.scheduleAutoNext(this.currentTrack.duration, 0);
                
                // small delay before updating to avoid scroll jump
                setTimeout(() => {
                    this.updateWebview();
                }, 100);
            } else {
                this.updateWebview();
            }
        }
    }

    private selectCategory(category: string): void {
        this.currentCategory = category as 'liked-songs' | 'recently-played' | 'top-tracks' | 'playlists';
        
        if (category === 'playlists') {
            this.currentView = 'playlists';
        } else {
            this.currentView = 'category';
            // Set the current playlist to the selected category for playing tracks
            this.currentPlaylist = {
                id: category,
                name: this.getCategoryTitle(category),
                tracks: this.getCategoryTracks(category),
                description: this.getCategoryTitle(category),
                owner: 'Spotify'
            };
        }
        
        this.currentTrackIndex = 0;
        this.updateWebview();
    }

    private goBack(): void {
        if (this.currentView === 'category' || this.currentView === 'playlists') {
            this.currentView = 'library';
            this.currentCategory = null;
            this.currentPlaylist = null;
        } else if (this.currentView === 'playlist-songs') {
            this.currentView = 'playlists';
        }
        
        this.currentTrackIndex = 0;
        this.updateWebview();
    }

    private getCategoryTitle(category: string): string {
        switch (category) {
            case 'liked-songs':
                return '💚 Liked Songs';
            case 'recently-played':
                return '🕒 Recently Played';
            case 'top-tracks':
                return '🔥 Your Top Tracks';
            default:
                return 'Unknown';
        }
    }

    private getCategoryTracks(category: string): SpotifyTrack[] {
        switch (category) {
            case 'liked-songs':
                return this.likedSongs;
            case 'recently-played':
                return this.recentlyPlayed;
            case 'top-tracks':
                return this.topTracks;
            default:
                return [];
        }
    }

    private getContentHTML(): string {
        const user = this.spotifyService.getUser();

        switch (this.currentView) {
            case 'library':
                return this.getLibraryTilesHTML();
            case 'category':
                return this.getCategoryContentHTML();
            case 'playlists':
                return this.getPlaylistsGridHTML();
            case 'playlist-songs':
                return this.getPlaylistSongsHTML();
            default:
                return this.getLibraryTilesHTML();
        }
    }

    private getLibraryTilesHTML(): string {
        const user = this.spotifyService.getUser();
        
        return `
            <div class="library-tiles">
                <div class="library-tile" onclick="selectCategory('liked-songs')">
                    <span class="icon">💚</span>
                    <div class="title">Liked Songs</div>
                    <div class="count">${this.likedSongs.length} songs</div>
                </div>
                <div class="library-tile" onclick="selectCategory('recently-played')">
                    <span class="icon">🕒</span>
                    <div class="title">Recently Played</div>
                    <div class="count">${this.recentlyPlayed.length} songs</div>
                </div>
                <div class="library-tile" onclick="selectCategory('top-tracks')">
                    <span class="icon">🔥</span>
                    <div class="title">Your Top Tracks</div>
                    <div class="count">${this.topTracks.length} songs</div>
                </div>
                <div class="library-tile" onclick="selectCategory('playlists')">
                    <span class="icon">🎵</span>
                    <div class="title">Playlists</div>
                    <div class="count">${this.spotifyPlaylists.length} playlists</div>
                </div>
            </div>
            
            ${this.currentTrack ? this.getPlaybackControlsHTML(user) : ''}
        `;
    }

    private getCategoryContentHTML(): string {
        const user = this.spotifyService.getUser();
        let tracks: SpotifyTrack[] = [];
        let title = '';
        
        switch (this.currentCategory) {
            case 'liked-songs':
                tracks = this.likedSongs;
                title = '💚 Liked Songs';
                break;
            case 'recently-played':
                tracks = this.recentlyPlayed;
                title = '🕒 Recently Played';
                break;
            case 'top-tracks':
                tracks = this.topTracks;
                title = '🔥 Your Top Tracks';
                break;
            default:
                return this.getLibraryTilesHTML();
        }

        const tracksList = tracks.map((track, index) => {
            const duration = this.formatDuration(track.duration);
            // Highlight track if it's currently playing (match by track ID)
            const isActive = this.currentTrack && this.currentTrack.id === track.id;
            return `
                <div class="track-item ${isActive ? 'active' : ''}" 
                     onclick="playTrack(${index})">
                    <div class="track-image">
                        ${track.imageUrl ? `<img src="${track.imageUrl}" alt="Album Art">` : '🎵'}
                    </div>
                    <div class="track-info">
                        <div class="track-name">${track.name}</div>
                        <div class="track-artist">${track.artist}</div>
                    </div>
                    <div class="track-duration">${duration}</div>
                </div>
            `;
        }).join('');

        return `
            <button class="back-btn" onclick="goBack()">← Back to Library</button>
            <h3 style="margin-bottom: 15px;">${title}</h3>
            <div class="tracks-container">
                ${tracksList || '<p style="text-align: center; opacity: 0.7;">No tracks available</p>'}
            </div>
            ${this.getPlaybackControlsHTML(user)}
        `;
    }

    private getPlaylistsGridHTML(): string {
        const playlistTiles = this.spotifyPlaylists.map(playlist => `
            <div class="library-tile" onclick="selectPlaylist('${playlist.id}')">
                ${playlist.imageUrl ? 
                    `<img src="${playlist.imageUrl}" alt="${playlist.name}" class="tile-image">` : 
                    '<span class="icon">🎵</span>'
                }
                <div class="title">${playlist.name}</div>
                <div class="count">${playlist.tracks.length} songs</div>
            </div>
        `).join('');

        return `
            <button class="back-btn" onclick="goBack()">← Back to Library</button>
            <h3 style="margin-bottom: 15px;">🎵 Your Playlists</h3>
            <div class="library-tiles">
                ${playlistTiles}
            </div>
        `;
    }

    private getPlaylistSongsHTML(): string {
        const user = this.spotifyService.getUser();
        if (!this.currentPlaylist) {
            return this.getLibraryTilesHTML();
        }

        const tracksList = this.currentPlaylist.tracks.map((track, index) => {
            const duration = this.formatDuration(track.duration);
            // Highlight track if it's currently playing (match by track ID)
            const isActive = this.currentTrack && this.currentTrack.id === track.id;
            return `
                <div class="track-item ${isActive ? 'active' : ''}" 
                     onclick="playTrack(${index})">
                    <div class="track-image">
                        ${track.imageUrl ? `<img src="${track.imageUrl}" alt="Album Art">` : '🎵'}
                    </div>
                    <div class="track-info">
                        <div class="track-name">${track.name}</div>
                        <div class="track-artist">${track.artist}</div>
                    </div>
                    <div class="track-duration">${duration}</div>
                </div>
            `;
        }).join('');

        return `
            <button class="back-btn" onclick="goBack()">← Back to Playlists</button>
            <h3 style="margin-bottom: 15px;">🎵 ${this.currentPlaylist.name}</h3>
            <div class="tracks-container">
                ${tracksList}
            </div>
            ${this.getPlaybackControlsHTML(user)}
        `;
    }

    private getPlaybackControlsHTML(user: SpotifyUser | null): string {
        return `
            ${this.currentTrack ? `
                <div class="current-track">
                    <div class="now-playing">Now Playing</div>
                    <div class="current-track-name">${this.currentTrack.name}</div>
                    <div class="current-track-artist">${this.currentTrack.artist}</div>
                </div>
            ` : ''}

            <div class="controls">
                <button class="control-btn" onclick="previousTrack()">
                    <i class="fas fa-step-backward" style="color: white; font-size: 1.2rem;"></i>
                </button>
                <button class="control-btn play-btn" onclick="togglePlayback()">
                    <i class="fas ${this.isPlaying ? 'fa-pause' : 'fa-play'}" style="color: white; font-size: 1.5rem;"></i>
                </button>
                <button class="control-btn" onclick="nextTrack()">
                    <i class="fas fa-step-forward" style="color: white; font-size: 1.2rem;"></i>
                </button>
            </div>

            ${user && !user.isPremium ? `
                <div class="premium-notice">
                    ⚠️ Playback controls require Spotify Premium
                </div>
            ` : ''}
        `;
    }

    getSpotifyService(): SpotifyService {
        return this.spotifyService;
    }

    async playTrackAtIndex(trackIndex: number): Promise<void> {
        await this.playTrack(trackIndex);
    }

    // Expose data for control panel
    getLikedSongs(): SpotifyTrack[] {
        return this.likedSongs;
    }

    getRecentlyPlayed(): SpotifyTrack[] {
        return this.recentlyPlayed;
    }

    getTopTracks(): SpotifyTrack[] {
        return this.topTracks;
    }

    getSpotifyPlaylists(): SpotifyPlaylist[] {
        return this.spotifyPlaylists;
    }

    getCurrentTrack(): SpotifyTrack | null {
        return this.currentTrack;
    }

    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    dispose(): void {
        this.stopVolumeSync();
        if (this.webviewPanel) {
            this.webviewPanel.dispose();
        }
        this.spotifyService.dispose();
    }

    private scheduleAutoNext(duration: number | undefined, progress: number): void {
        if (this.trackEndTimer) {
            clearTimeout(this.trackEndTimer);
        }

        if (duration && progress >= duration - 2000) {
            this.trackEndTimer = setTimeout(async () => {
                await this.nextTrack();
            }, 1000);
        }
    }
} 