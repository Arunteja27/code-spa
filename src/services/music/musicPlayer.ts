import * as vscode from 'vscode';
import { SpotifyService, SpotifyPlaylist, SpotifyTrack, SpotifyUser } from '../spotify/spotifyService';
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
    private webviewUtils: WebviewUtils;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.spotifyService = new SpotifyService(context);
        this.webviewUtils = new WebviewUtils(context);
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
        
        this.syncInterval = setInterval(async () => {
            const state = await this.spotifyService.getCurrentPlaybackState();
            if (state) {
                const newVolume = state.volume;
                const newPlayingState = state.isPlaying;

                try {
                    const playback = await (this.spotifyService as any).spotifyApi.getMyCurrentPlaybackState();
                    if (playback.body && playback.body.item) {
                        const duration = playback.body.item.duration_ms;
                        const progress = playback.body.progress_ms;
                        if (!newPlayingState && progress >= duration - 2000) {
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

    private getMusicPlayerHTML(): string {
        const content = this.getMusicPlayerContent();
        
        return this.webviewUtils.loadHtmlTemplate(
            this.webviewPanel!.webview,
            'music-player',
            content
        );
    }

    private getMusicPlayerContent(): string {
        const isSpotifyConnected = this.spotifyService.getIsAuthenticated();
        const user = this.spotifyService.getUser();
        
        return `
            <div class="spotify-header">
                <div class="spotify-logo">🎵</div>
                <h2>Code Spa Music Player</h2>
            </div>

            <div class="connection-status ${isSpotifyConnected ? 'connected' : 'disconnected'}">
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
            case 'selectCategory':
                this.selectCategory(message.category);
                break;
            case 'goBack':
                this.goBack();
                break;
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
            await this.spotifyService.playTrack(this.currentTrack.uri);
            this.isPlaying = true;
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
            
            this.playbackPlaylist = this.currentPlaylist;
            this.playbackTrackIndex = trackIndex;
            
            const success = await this.spotifyService.playTrack(this.currentTrack.uri);
            if (success) {
                this.isPlaying = true;
                this.scheduleAutoNext(this.currentTrack.duration, 0);
                
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
            const tracks = this.getCategoryTracks(category);
            this.currentPlaylist = {
                id: category,
                name: this.getCategoryTitle(category),
                tracks: tracks,
                imageUrl: undefined,
                description: '',
                owner: 'Spotify'
            } as SpotifyPlaylist;
        }
        
        this.updateWebview();
    }

    private goBack(): void {
        if (this.currentView === 'playlist-songs') {
            this.currentView = 'playlists';
            this.currentPlaylist = null;
        } else if (this.currentView === 'category' || this.currentView === 'playlists') {
            this.currentView = 'library';
            this.currentCategory = null;
            this.currentPlaylist = null;
        }
        this.updateWebview();
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
        const likedCount = this.likedSongs.length;
        const recentCount = this.recentlyPlayed.length;
        const topCount = this.topTracks.length;
        const playlistCount = this.spotifyPlaylists.length;

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
            ${this.getPlaybackControlsHTML(this.spotifyService.getUser())}
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
            ${this.getPlaybackControlsHTML(this.spotifyService.getUser())}
        `;
    }

    private getPlaybackControlsHTML(user: SpotifyUser | null): string {
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
                        this.currentTrackIndex = index;
                        this.playbackTrackIndex = index;
                        this.isPlaying = true;
                        
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