import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import SpotifyWebApi from 'spotify-web-api-node';
import * as crypto from 'crypto';

export interface SpotifyTrack {
    id: string;
    name: string;
    artist: string;
    album: string;
    duration: number;
    imageUrl?: string;
    previewUrl?: string;
    uri: string;
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    description: string;
    tracks: SpotifyTrack[];
    imageUrl?: string;
    owner: string;
}

export interface SpotifyUser {
    id: string;
    displayName: string;
    email: string;
    isPremium: boolean;
    imageUrl?: string;
}

export interface PlaybackState {
    isPlaying: boolean;
    volume: number;
    currentTrack?: SpotifyTrack;
    progress?: number;
    device?: string;
}

export class SpotifyService {
    private spotifyApi: SpotifyWebApi;
    private context: vscode.ExtensionContext;
    private isAuthenticated: boolean = false;
    private user: SpotifyUser | null = null;
    private server: http.Server | null = null;
    private codeVerifier: string = '';
    private readonly redirectUri = 'http://127.0.0.1:3000/callback';
    private readonly scopes = [
        'user-read-private',
        'user-read-email',
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'user-library-read',
        'user-read-recently-played',
        'user-top-read',
        'playlist-read-private',
        'playlist-read-collaborative'
    ];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        
        const config = vscode.workspace.getConfiguration('codeSpa');
        const clientId = config.get<string>('spotify.clientId') || '';
        const clientSecret = config.get<string>('spotify.clientSecret') || '';
        
        if (!clientId) {
            vscode.window.showWarningMessage(
                'Spotify Client ID not configured. Please set codeSpa.spotify.clientId in settings.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'codeSpa.spotify');
                }
            });
        }
        
        this.spotifyApi = new SpotifyWebApi({
            clientId: clientId,
            clientSecret: clientSecret,
            redirectUri: this.redirectUri
        });

        this.loadStoredTokens();
    }

    private loadStoredTokens(): void {
        const accessToken = this.context.globalState.get<string>('spotify_access_token');
        const refreshToken = this.context.globalState.get<string>('spotify_refresh_token');
        const user = this.context.globalState.get<SpotifyUser>('spotify_user');

        if (accessToken && refreshToken) {
            this.spotifyApi.setAccessToken(accessToken);
            this.spotifyApi.setRefreshToken(refreshToken);
            this.isAuthenticated = true;
            this.user = user || null;
            
            this.validateTokens();
        }
    }

    async authenticate(): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration('codeSpa');
            const clientId = config.get<string>('spotify.clientId') || '';
            
            if (!clientId) {
                vscode.window.showErrorMessage(
                    'Spotify Client ID not configured. Please set up your Spotify app credentials.',
                    'Setup Guide'
                ).then(selection => {
                    if (selection === 'Setup Guide') {
                        vscode.env.openExternal(vscode.Uri.parse('https://developer.spotify.com/documentation/web-api/tutorials/getting-started'));
                    }
                });
                return false;
            }

            this.codeVerifier = this.generateCodeVerifier();
            const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);
            
            const authUrl = this.spotifyApi.createAuthorizeURL(this.scopes, 'state');
            
            // Show instructions for redirect URI setup
            vscode.window.showInformationMessage(
                'Opening Spotify authentication. Make sure your Spotify app has redirect URI: http://127.0.0.1:3000/callback',
                'Continue'
            ).then(() => {
                vscode.env.openExternal(vscode.Uri.parse(authUrl));
            });
            
            return new Promise((resolve) => {
                this.startCallbackServer(resolve);
            });
        } catch (error) {
            console.error('Authentication failed:', error);
            vscode.window.showErrorMessage('Spotify authentication failed. Please check your app configuration.');
            return false;
        }
    }

    private startCallbackServer(resolve: (success: boolean) => void): void {
        this.server = http.createServer(async (req, res) => {
            const parsedUrl = url.parse(req.url!, true);
            
            if (parsedUrl.pathname === '/callback') {
                const code = parsedUrl.query.code as string;
                const error = parsedUrl.query.error as string;

                if (error) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end('<h1>Authentication failed</h1><p>You can close this window.</p>');
                    if (this.server) {
                        this.server.close();
                    }
                    resolve(false);
                    return;
                }

                if (code) {
                    try {
                        const data = await this.spotifyApi.authorizationCodeGrant(code);
                        
                        this.spotifyApi.setAccessToken(data.body.access_token);
                        this.spotifyApi.setRefreshToken(data.body.refresh_token);
                        
                        await this.context.globalState.update('spotify_access_token', data.body.access_token);
                        await this.context.globalState.update('spotify_refresh_token', data.body.refresh_token);
                        
                        const userProfile = await this.spotifyApi.getMe();
                        this.user = {
                            id: userProfile.body.id,
                            displayName: userProfile.body.display_name || userProfile.body.id,
                            email: userProfile.body.email || '',
                            isPremium: userProfile.body.product === 'premium',
                            imageUrl: userProfile.body.images?.[0]?.url
                        };
                        
                        await this.context.globalState.update('spotify_user', this.user);
                        this.isAuthenticated = true;

                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<h1>Success!</h1><p>You can close this window and return to VS Code.</p>');
                        
                        if (this.server) {
                            this.server.close();
                        }
                        resolve(true);
                    } catch (error) {
                        console.error('Token exchange failed:', error);
                        res.writeHead(500, { 'Content-Type': 'text/html' });
                        res.end('<h1>Authentication failed</h1><p>Please try again.</p>');
                        if (this.server) {
                            this.server.close();
                        }
                        resolve(false);
                    }
                }
            }
        });

        this.server.listen(3000, '127.0.0.1', () => {
            console.log('Callback server listening on 127.0.0.1:3000');
        });
    }

    async disconnect(): Promise<void> {
        this.isAuthenticated = false;
        this.user = null;
        this.spotifyApi.resetAccessToken();
        this.spotifyApi.resetRefreshToken();
        
        await this.context.globalState.update('spotify_access_token', undefined);
        await this.context.globalState.update('spotify_refresh_token', undefined);
        await this.context.globalState.update('spotify_user', undefined);
        
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }

    async getUserPlaylists(): Promise<SpotifyPlaylist[]> {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            const playlists: SpotifyPlaylist[] = [];
            
            const likedSongs = await this.getLikedSongs();
            playlists.push({
                id: 'liked-songs',
                name: 'Liked Songs',
                description: 'Your liked songs',
                owner: 'Spotify',
                tracks: likedSongs,
                imageUrl: undefined
            });

            const recentTracks = await this.getRecentlyPlayed();
            playlists.push({
                id: 'recently-played',
                name: 'Recently Played',
                description: 'Your recently played tracks',
                owner: 'Spotify',
                tracks: recentTracks,
                imageUrl: undefined
            });

            const topTracks = await this.getTopTracks();
            playlists.push({
                id: 'top-tracks',
                name: 'Top Tracks',
                description: 'Your top tracks',
                owner: 'Spotify',
                tracks: topTracks,
                imageUrl: undefined
            });

            const userPlaylists = await this.getUserCreatedPlaylists();
            playlists.push(...userPlaylists);

            return playlists;
        } catch (error) {
            console.error('Failed to get playlists:', error);
            throw error;
        }
    }

    private async getLikedSongs(): Promise<SpotifyTrack[]> {
        const tracks: SpotifyTrack[] = [];
        let offset = 0;
        const limit = 50;

        try {
            while (true) {
                const response = await this.spotifyApi.getMySavedTracks({ limit, offset });
                
                const newTracks = response.body.items.map(item => ({
                    id: item.track.id,
                    name: item.track.name,
                    artist: item.track.artists.map(a => a.name).join(', '),
                    album: item.track.album.name,
                    duration: item.track.duration_ms,
                    uri: item.track.uri,
                    imageUrl: item.track.album.images[0]?.url
                }));

                tracks.push(...newTracks);

                if (response.body.items.length < limit) {
                    break;
                }

                offset += limit;
                if (offset > 1000) {
                    break;
                }
            }
        } catch (error) {
            console.error('Failed to get liked songs:', error);
        }

        return this.removeDuplicateTracks(tracks);
    }

    private removeDuplicateTracks(tracks: SpotifyTrack[]): SpotifyTrack[] {
        const seen = new Set<string>();
        return tracks.filter(track => {
            if (seen.has(track.id)) {
                return false;
            }
            seen.add(track.id);
            return true;
        });
    }

    private async getRecentlyPlayed(): Promise<SpotifyTrack[]> {
        try {
            const response = await this.spotifyApi.getMyRecentlyPlayedTracks({ limit: 50 });
            
            const tracks = response.body.items.map(item => ({
                id: item.track.id,
                name: item.track.name,
                artist: item.track.artists.map(a => a.name).join(', '),
                album: item.track.album.name,
                duration: item.track.duration_ms,
                uri: item.track.uri,
                imageUrl: item.track.album.images[0]?.url
            }));

            return this.removeDuplicateTracks(tracks);
        } catch (error) {
            console.error('Failed to get recently played:', error);
            return [];
        }
    }

    private async getTopTracks(): Promise<SpotifyTrack[]> {
        try {
            const response = await this.spotifyApi.getMyTopTracks({ limit: 50, time_range: 'medium_term' });
            
            return response.body.items.map(track => ({
                id: track.id,
                name: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                duration: track.duration_ms,
                uri: track.uri,
                imageUrl: track.album.images[0]?.url
            }));
        } catch (error) {
            console.error('Failed to get top tracks:', error);
            return [];
        }
    }

    private async getUserCreatedPlaylists(): Promise<SpotifyPlaylist[]> {
        try {
            const response = await this.spotifyApi.getUserPlaylists({ limit: 50 });
            const playlists: SpotifyPlaylist[] = [];

            for (const playlist of response.body.items) {
                if (playlist.tracks.total > 0) {
                    const tracks = await this.getPlaylistTracks(playlist.id);
                    playlists.push({
                        id: playlist.id,
                        name: playlist.name,
                        description: playlist.description || '',
                        owner: playlist.owner.display_name || playlist.owner.id,
                        tracks: tracks,
                        imageUrl: playlist.images[0]?.url
                    });
                }
            }

            return playlists;
        } catch (error) {
            console.error('Failed to get user playlists:', error);
            return [];
        }
    }

    private async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
        try {
            const response = await this.spotifyApi.getPlaylistTracks(playlistId, { limit: 100 });
            
            return response.body.items
                .filter(item => item.track && item.track.type === 'track')
                .map(item => ({
                    id: item.track!.id,
                    name: item.track!.name,
                    artist: (item.track as any).artists.map((a: any) => a.name).join(', '),
                    album: (item.track as any).album.name,
                    duration: (item.track as any).duration_ms,
                    uri: item.track!.uri,
                    imageUrl: (item.track as any).album.images[0]?.url
                }));
        } catch (error) {
            console.error(`Failed to get tracks for playlist ${playlistId}:`, error);
            return [];
        }
    }

    async getCurrentPlaybackState(): Promise<PlaybackState | null> {
        if (!this.isAuthenticated) {
            return null;
        }

        try {
            const response = await this.spotifyApi.getMyCurrentPlaybackState();
            
            if (!response.body || !response.body.item) {
                return null;
            }

            const track = response.body.item;
            return {
                isPlaying: response.body.is_playing,
                volume: response.body.device?.volume_percent || 50,
                currentTrack: {
                    id: track.id,
                    name: track.name,
                    artist: (track as any).artists.map((a: any) => a.name).join(', '),
                    album: (track as any).album.name,
                    duration: track.duration_ms,
                    uri: track.uri,
                    imageUrl: (track as any).album.images[0]?.url
                },
                progress: response.body.progress_ms || undefined,
                device: response.body.device?.name
            };
        } catch (error: any) {
            if (error.statusCode === 401) {
                await this.refreshAccessToken();
                return this.getCurrentPlaybackState();
            }
            console.error('Failed to get playback state:', error);
            return null;
        }
    }

    async playTrack(uri: string): Promise<boolean> {
        if (!this.isAuthenticated) {
            return false;
        }

        try {
            const devices = await this.spotifyApi.getMyDevices();
            
            if (devices.body.devices.length === 0) {
                vscode.window.showWarningMessage('No active Spotify devices found. Please open Spotify on a device.');
                return false;
            }

            let activeDevice = devices.body.devices.find(device => device.is_active);
            
            if (!activeDevice) {
                activeDevice = devices.body.devices[0];
                await this.spotifyApi.transferMyPlayback([activeDevice.id!]);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.spotifyApi.play({
                uris: [uri],
                device_id: activeDevice.id || undefined
            });

            return true;
        } catch (error: any) {
            console.error('Failed to play track:', error);
            if (error.statusCode === 403) {
                vscode.window.showWarningMessage('Spotify Premium is required for playback control.');
            }
            return false;
        }
    }

    async pausePlayback(): Promise<boolean> {
        if (!this.isAuthenticated) {
            return false;
        }

        try {
            await this.spotifyApi.pause();
            return true;
        } catch (error) {
            console.error('Failed to pause playback:', error);
            return false;
        }
    }

    async resumePlayback(): Promise<boolean> {
        if (!this.isAuthenticated) {
            return false;
        }

        try {
            await this.spotifyApi.play();
            return true;
        } catch (error) {
            console.error('Failed to resume playback:', error);
            return false;
        }
    }

    async skipToNext(): Promise<boolean> {
        if (!this.isAuthenticated) {
            return false;
        }

        try {
            await this.spotifyApi.skipToNext();
            return true;
        } catch (error) {
            console.error('Failed to skip to next:', error);
            return false;
        }
    }

    async skipToPrevious(): Promise<boolean> {
        if (!this.isAuthenticated) {
            return false;
        }

        try {
            await this.spotifyApi.skipToPrevious();
            return true;
        } catch (error) {
            console.error('Failed to skip to previous:', error);
            return false;
        }
    }

    async setVolume(volume: number): Promise<boolean> {
        if (!this.isAuthenticated) {
            return false;
        }

        try {
            await this.spotifyApi.setVolume(Math.floor(volume));
            return true;
        } catch (error) {
            console.error('Failed to set volume:', error);
            return false;
        }
    }

    async seekToPosition(positionMs: number): Promise<boolean> {
        if (!this.isAuthenticated) {
            return false;
        }

        try {
            await this.spotifyApi.seek(positionMs);
            return true;
        } catch (error) {
            console.error('Failed to seek:', error);
            return false;
        }
    }

    private async refreshAccessToken(): Promise<void> {
        try {
            const data = await this.spotifyApi.refreshAccessToken();
            this.spotifyApi.setAccessToken(data.body.access_token);
            await this.context.globalState.update('spotify_access_token', data.body.access_token);
            
            if (data.body.refresh_token) {
                this.spotifyApi.setRefreshToken(data.body.refresh_token);
                await this.context.globalState.update('spotify_refresh_token', data.body.refresh_token);
            }
        } catch (error) {
            console.error('Failed to refresh token:', error);
            this.isAuthenticated = false;
            this.user = null;
        }
    }

    private async validateTokens(): Promise<void> {
        try {
            await this.spotifyApi.getMe();
        } catch (error: any) {
            if (error.statusCode === 401) {
                await this.refreshAccessToken();
            } else {
                this.isAuthenticated = false;
                this.user = null;
            }
        }
    }

    private generateCodeVerifier(): string {
        return crypto.randomBytes(32).toString('base64url');
    }

    private async generateCodeChallenge(verifier: string): Promise<string> {
        const hash = crypto.createHash('sha256').update(verifier).digest();
        return hash.toString('base64url');
    }

    getIsAuthenticated(): boolean {
        return this.isAuthenticated;
    }

    getUser(): SpotifyUser | null {
        return this.user;
    }

    dispose(): void {
        if (this.server) {
            this.server.close();
        }
    }
} 