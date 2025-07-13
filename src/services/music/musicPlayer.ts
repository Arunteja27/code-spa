import * as vscode from 'vscode';
import { SpotifyService, SpotifyPlaylist, SpotifyTrack } from '../spotify/spotifyService';
import { WebviewUtils } from '../../webview/WebviewUtils';

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
    private syncInterval: NodeJS.Timeout | null = null;
    private currentSpotifyVolume: number = 50;
    private lastKnownProgress: number = 0;
    private currentView: 'library' | 'category' | 'playlists' | 'playlist-songs' = 'library';
    private currentCategory: 'liked-songs' | 'recently-played' | 'top-tracks' | 'playlists' | null = null;
    private likedSongs: SpotifyTrack[] = [];
    private recentlyPlayed: SpotifyTrack[] = [];
    private topTracks: SpotifyTrack[] = [];
    
    private playbackPlaylist: SpotifyPlaylist | null = null;
    private playbackTrackIndex: number = 0;
    private trackEndTimer: NodeJS.Timeout | null = null;
    private webviewUtils: WebviewUtils;
    private likedCount: number = 0;
    private recentCount: number = 0;
    private topCount: number = 0;
    private playlistCount: number = 0;

    private constructor(context: vscode.ExtensionContext, spotifyService: SpotifyService) {
        this.context = context;
        this.spotifyService = spotifyService;
        this.webviewUtils = new WebviewUtils(context);
        this.initializeFallbackPlaylists();
    }

    public static async create(context: vscode.ExtensionContext): Promise<MusicPlayer> {
        console.log('🎵 MusicPlayer: Creating instance...');
        const spotifyService = new SpotifyService(context);
        const player = new MusicPlayer(context, spotifyService);
        
        spotifyService.initialize().then(async () => {
            console.log('🎵 MusicPlayer: SpotifyService initialized, updating UI');
            if (spotifyService.getIsAuthenticated()) {
                await player.loadSpotifyPlaylists();
            }
            player.updateWebview();
        }).catch(error => {
            console.error('🎵 MusicPlayer: SpotifyService initialization failed:', error);
            player.updateWebview();
        });
        
        await player.initialize();
        console.log('🎵 MusicPlayer: Player initialized');
        return player;
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
        console.log('🎵 music player initialized');

        const savedVolume = this.context.globalState.get('musicVolume', 0.3);
        this.volume = savedVolume as number;

        if (this.spotifyService.getIsAuthenticated()) {
            await this.loadSpotifyPlaylists();
        }
    }

    private async loadSpotifyPlaylists(): Promise<void> {
        try {
            console.log('🎵 Loading Spotify playlists...');
            const allContent = await this.spotifyService.getUserPlaylists();
            console.log('🎵 Received Spotify content:', allContent.length, 'items');
            
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
                
                this.startVolumeSync();
                this.updateWebview();
                vscode.window.showInformationMessage('🎵 Connected to Spotify!');
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
        this.isPlaying = false;

        if (this.trackEndTimer) {
            clearTimeout(this.trackEndTimer);
            this.trackEndTimer = null;
        }
        
        this.playbackPlaylist = null;
        this.playbackTrackIndex = 0;
        
        this.updateWebview();
    }

    private startVolumeSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(async () => {
            const state = await this.spotifyService.getCurrentPlaybackState();
            if (state) {
                const newVolume = state.volume;
                const newPlayingState = state.isPlaying;

                if (!newPlayingState && this.trackEndTimer) {
                    clearTimeout(this.trackEndTimer);
                    this.trackEndTimer = null;
                }

                try {
                    const playback = await (this.spotifyService as any).spotifyApi.getMyCurrentPlaybackState();
                    if (playback.body && playback.body.item) {
                        const duration = playback.body.item.duration_ms;
                        const progress = playback.body.progress_ms;
                        
                        // Check if user skipped forward significantly (more than 5 seconds difference)
                        const progressDiff = Math.abs(progress - this.lastKnownProgress);
                        if (progressDiff > 5000 && this.isPlaying && this.currentTrack) {
                            // User likely skipped, reschedule auto-next with new progress
                            this.scheduleAutoNext(this.currentTrack.duration, progress);
                        }
                        this.lastKnownProgress = progress;
                        
                        // Only auto-advance if the song naturally ended (was playing and reached the end)
                        // Don't auto-advance if user manually paused the song
                        if (!newPlayingState && progress >= duration - 2000 && this.isPlaying) {
                            await this.nextTrack();
                        }
                    }
                } catch {}

                if (newVolume !== this.currentSpotifyVolume || newPlayingState !== this.isPlaying) {
                    this.currentSpotifyVolume = newVolume;
                    this.isPlaying = newPlayingState;
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

    private getMusicPlayerHTML(): string {
        const content = this.getMusicPlayerContent();
        
        return this.webviewUtils.loadHtmlTemplate(
            this.webviewPanel!.webview,
            'music-player',
            content
        );
    }

    private getMusicPlayerContent(): string {
        const connectionStatus = this.spotifyService.getConnectionStatus();
        const isSpotifyConnected = this.spotifyService.getIsAuthenticated();
        const user = this.spotifyService.getUser();
        
        return `
            <div class="spotify-header">
                <div class="spotify-logo">🎵</div>
                <h2>Code Spa Music Player</h2>
            </div>

            <div class="connection-status ${connectionStatus}">
                ${connectionStatus === 'connecting' ? `
                    <div>
                        <strong>🔄 Connecting to Spotify...</strong>
                        <br>
                        <span>Validating your authentication</span>
                        <div class="loading-spinner">⏳</div>
                    </div>
                ` : isSpotifyConnected ? `
                    <div>
                        <strong>✅ Connected to Spotify</strong>
                        <br>
                        <span>Welcome, ${user?.displayName || 'User'}!</span>
                        <button class="disconnect-btn" onclick="disconnectSpotify()">Disconnect Spotify</button>
                    </div>
                ` : connectionStatus === 'error' ? `
                    <div>
                        <strong>❌ Connection Failed</strong>
                        <br>
                        <span>Unable to connect to Spotify. Please try again.</span>
                        <br>
                        <button class="connect-btn" onclick="connectSpotify()">Retry Connection</button>
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

            ${isSpotifyConnected ? this.getContentHTML() : connectionStatus === 'connecting' ? `
                <div style="text-align: center; margin: 40px 0; opacity: 0.7;">
                    <div class="loading-spinner" style="font-size: 2rem; margin-bottom: 10px;">🔄</div>
                    <p>Setting up your music library...</p>
                </div>
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
        `;
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

    async togglePlayback(): Promise<void> {
        if (!this.spotifyService.getIsAuthenticated()) {
            vscode.window.showWarningMessage('🎵 Please connect to Spotify first');
            return;
        }

        if (this.isPlaying) {
            const success = await this.spotifyService.pausePlayback();
            if (success) {
                this.isPlaying = false;
                if (this.trackEndTimer) {
                    clearTimeout(this.trackEndTimer);
                    this.trackEndTimer = null;
                }
            }
        } else {
            const resumeSuccess = await this.spotifyService.resumePlayback();
            if (resumeSuccess) {
                this.isPlaying = true;
                this.scheduleAutoNext(this.currentTrack?.duration, 0);
            } else if (this.currentTrack) {
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

    async nextTrack(): Promise<void> {
        if (!this.spotifyService.getIsAuthenticated()) {
            return;
        }

        if (this.playbackPlaylist && this.playbackTrackIndex < this.playbackPlaylist.tracks.length - 1) {
            this.playbackTrackIndex++;
            this.currentTrack = this.playbackPlaylist.tracks[this.playbackTrackIndex] as SpotifyTrack;
            const success = await this.spotifyService.playTrack(this.currentTrack.uri);
            if (success) {
                this.isPlaying = true;
                this.lastKnownProgress = 0;
                this.scheduleAutoNext(this.currentTrack.duration, 0);
            }
            this.updateWebview();
        } else {
            await this.spotifyService.skipToNext();
        }
    }

    async previousTrack(): Promise<void> {
        if (!this.spotifyService.getIsAuthenticated()) {
            return;
        }

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
    }


    private getCategoryTitle(category: string): string {
        switch (category) {
            case 'liked-songs': return 'Liked Songs';
            case 'recently-played': return 'Recently Played';
            case 'top-tracks': return 'Top Tracks';
            case 'playlists': return 'Your Playlists';
            default: return 'Unknown';
        }
    }

    private getCategoryTracks(category: string): SpotifyTrack[] {
        switch (category) {
            case 'liked-songs': return this.likedSongs;
            case 'recently-played': return this.recentlyPlayed;
            case 'top-tracks': return this.topTracks;
            default: return [];
        }
    }

    private getContentHTML(): string {
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
        const likedCount = this.likedSongs.length || this.likedCount;
        const recentCount = this.recentlyPlayed.length || this.recentCount;
        const topCount = this.topTracks.length || this.topCount;
        const playlistCount = this.spotifyPlaylists.length || this.playlistCount;

        return `
            <div class="library-tiles">
                <div class="library-tile" onclick="selectCategory('liked-songs')">
                    <div class="icon">💚</div>
                    <div class="title">Liked Songs</div>
                    <div class="count">${likedCount} songs</div>
                </div>
                <div class="library-tile" onclick="selectCategory('recently-played')">
                    <div class="icon">🕒</div>
                    <div class="title">Recently Played</div>
                    <div class="count">${recentCount} songs</div>
                </div>
                <div class="library-tile" onclick="selectCategory('top-tracks')">
                    <div class="icon">⭐</div>
                    <div class="title">Top Tracks</div>
                    <div class="count">${topCount} songs</div>
                </div>
                <div class="library-tile" onclick="selectCategory('playlists')">
                    <div class="icon">📋</div>
                    <div class="title">Your Playlists</div>
                    <div class="count">${playlistCount} playlists</div>
                </div>
            </div>
        `;
    }

    private getCategoryContentHTML(): string {
        if (!this.currentCategory) return '';

        const tracks = this.getCategoryTracks(this.currentCategory);
        const title = this.getCategoryTitle(this.currentCategory);

        const tracksHTML = tracks.length > 0 ? tracks.map((track, index) => {
            const duration = this.formatDuration(track.duration);
            const isActive = this.currentTrack && this.currentTrack.id === track.id;
            
            return `
                <div class="track-item ${isActive ? 'active' : ''}" onclick="playTrack(${index})">
                    <div class="track-image">
                        ${track.imageUrl ? `<img src="${track.imageUrl}" alt="Album Art">` : '🎵'}
                    </div>
                    <div class="track-info">
                        <div class="track-name">${track.name}</div>
                        <div class="track-artist">${track.artist} • ${track.album}</div>
                    </div>
                    <div class="track-duration">${duration}</div>
                </div>
            `;
        }).join('') : '<p style="text-align: center; opacity: 0.7; margin: 20px 0;">No tracks available</p>';

        return `
            <button class="back-btn" onclick="goBack()">← Back to Library</button>
            <h3>${title} (${tracks.length} songs)</h3>
            <div class="tracks-container">
                ${tracksHTML}
            </div>
            ${this.getPlaybackControlsHTML()}
        `;
    }

    private getPlaylistsGridHTML(): string {
        const playlistsHTML = this.spotifyPlaylists.length > 0 ? this.spotifyPlaylists.map(playlist => {
            return `
                <div class="playlist-tile" onclick="selectPlaylist('${playlist.id}')">
                    <div class="playlist-image">
                        ${playlist.imageUrl ? `<img src="${playlist.imageUrl}" alt="${playlist.name}">` : '📋'}
                    </div>
                    <div class="playlist-name">${playlist.name}</div>
                    <div class="playlist-count">${playlist.tracks.length} songs</div>
                </div>
            `;
        }).join('') : '<p style="text-align: center; opacity: 0.7; margin: 20px 0;">No playlists found</p>';

        return `
            <button class="back-btn" onclick="goBack()">← Back to Library</button>
            <h3>Your Playlists (${this.spotifyPlaylists.length})</h3>
            <div class="playlists-grid">
                ${playlistsHTML}
            </div>
        `;
    }

    private getPlaylistSongsHTML(): string {
        if (!this.currentPlaylist) return '';

        const tracks = this.currentPlaylist.tracks;
        const tracksHTML = tracks.length > 0 ? tracks.map((track, index) => {
            const duration = this.formatDuration((track as SpotifyTrack).duration);
            const isActive = this.currentTrack && this.currentTrack.id === (track as SpotifyTrack).id;
            
            return `
                <div class="track-item ${isActive ? 'active' : ''}" onclick="playTrack(${index})">
                    <div class="track-image">
                        ${(track as SpotifyTrack).imageUrl ? `<img src="${(track as SpotifyTrack).imageUrl}" alt="Album Art">` : '🎵'}
                    </div>
                    <div class="track-info">
                        <div class="track-name">${(track as SpotifyTrack).name}</div>
                        <div class="track-artist">${(track as SpotifyTrack).artist} • ${(track as SpotifyTrack).album}</div>
                    </div>
                    <div class="track-duration">${duration}</div>
                </div>
            `;
        }).join('') : '<p style="text-align: center; opacity: 0.7; margin: 20px 0;">No tracks in this playlist</p>';

        return `
            <button class="back-btn" onclick="goBack()">← Back to Playlists</button>
            <h3>${this.currentPlaylist.name} (${tracks.length} songs)</h3>
            <div class="tracks-container">
                ${tracksHTML}
            </div>
            ${this.getPlaybackControlsHTML()}
        `;
    }

    private getPlaybackControlsHTML(): string {
        const currentTrack = this.currentTrack;
        const trackName = currentTrack ? currentTrack.name : 'No track selected';
        const artistName = currentTrack ? currentTrack.artist : 'Select a song to start';
        const playPauseIcon = this.isPlaying ? '⏸' : '▶';

        return `
            <div class="playback-controls">
                <div class="now-playing">
                    <div class="track-art">
                        ${currentTrack?.imageUrl ? `<img src="${currentTrack.imageUrl}" alt="Album Art">` : '🎵'}
                    </div>
                    <div class="track-title">${trackName}</div>
                    <div class="track-artist-name">${artistName}</div>
                </div>
                
                <div class="control-buttons">
                    <button class="control-btn" onclick="previousTrack()">⏮</button>
                    <button class="control-btn play-pause" onclick="togglePlayback()">${playPauseIcon}</button>
                    <button class="control-btn" onclick="nextTrack()">⏭</button>
                </div>
            </div>
        `;
    }

    getSpotifyService(): SpotifyService {
        return this.spotifyService;
    }

    async playTrackAtIndex(index: number): Promise<void> {
        if (!this.spotifyService.getIsAuthenticated()) {
            vscode.window.showWarningMessage('🎵 Please connect to Spotify first');
            return;
        }

        // If we're in a category view, get the tracks from the current category
        let tracks: SpotifyTrack[] = [];
        if (this.currentView === 'category' && this.currentCategory) {
            tracks = this.getCategoryTracks(this.currentCategory);
        } else if (this.currentView === 'playlist-songs' && this.currentPlaylist?.tracks) {
            tracks = this.currentPlaylist.tracks as SpotifyTrack[];
        } else if (this.currentPlaylist?.tracks) {
            tracks = this.currentPlaylist.tracks as SpotifyTrack[];
        }

        if (tracks.length > 0 && index >= 0 && index < tracks.length) {
            const track = tracks[index];
            if (track?.uri) {
                try {
                    const success = await this.spotifyService.playTrack(track.uri);
                    if (success) {
                        this.currentTrack = track;
                        this.playbackTrackIndex = index;
                        this.isPlaying = true;
                        this.lastKnownProgress = 0;
                        
                        // Set up playback context for next/previous functionality
                        if (this.currentView === 'category') {
                            this.playbackPlaylist = {
                                id: this.currentCategory || 'unknown',
                                name: this.getCategoryTitle(this.currentCategory || ''),
                                tracks: tracks,
                                imageUrl: undefined,
                                description: '',
                                owner: 'Spotify'
                            } as SpotifyPlaylist;
                        } else {
                            this.playbackPlaylist = this.currentPlaylist;
                        }
                        
                        this.scheduleAutoNext(track.duration, 0);
                        vscode.window.showInformationMessage(`▶ Playing: ${track.name} by ${track.artist}`);
                    } else {
                        vscode.window.showErrorMessage('❌ Failed to play track. Make sure Spotify is open on a device.');
                    }
                } catch (error) {
                    console.error('Error playing track:', error);
                    vscode.window.showErrorMessage('Failed to play track');
                }
            }
        } else {
            vscode.window.showErrorMessage('Track not found or invalid index');
        }
    }

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

    setCurrentCategory(category: string): void {
        this.currentCategory = category as 'liked-songs' | 'recently-played' | 'top-tracks' | 'playlists';
        this.currentView = 'category';
        
        if (category !== 'playlists') {
            const tracks = this.getCategoryTracks(category);
            this.currentPlaylist = {
                id: category,
                name: this.getCategoryTitle(category),
                tracks: tracks,
                imageUrl: undefined,
                description: '',
                owner: 'Spotify'
            } as SpotifyPlaylist;
        } else {
            this.currentView = 'playlists';
            this.currentPlaylist = null;
        }
    }

    resetToLibraryView(): void {
        this.currentView = 'library';
        this.currentCategory = null;
        this.currentPlaylist = null;
    }

    setCurrentPlaylist(playlist: SpotifyPlaylist): void {
        this.currentPlaylist = playlist;
        this.currentView = 'playlist-songs';
        this.currentCategory = null;
    }

    dispose(): void {
        this.stopVolumeSync();
        if (this.webviewPanel) {
            this.webviewPanel.dispose();
        }
        if (this.trackEndTimer) {
            clearTimeout(this.trackEndTimer);
        }
    }

    private scheduleAutoNext(duration: number | undefined, progress: number): void {
        if (this.trackEndTimer) {
            clearTimeout(this.trackEndTimer);
        }
        
        if (duration && duration > 0) {
            const remainingTime = duration - progress - 2000;
            if (remainingTime > 0) {
                this.trackEndTimer = setTimeout(() => {
                    this.nextTrack();
                }, remainingTime);
            }
        }
    }
} 