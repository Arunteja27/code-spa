import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import SpotifyWebApi from 'spotify-web-api-node';

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
    email?: string;
    imageUrl?: string;
    isPremium: boolean;
}

export class SpotifyService {
    private spotifyApi: SpotifyWebApi;
    private context: vscode.ExtensionContext;
    private isAuthenticated: boolean = false;
    private currentUser: SpotifyUser | null = null;
    private authServer: http.Server | null = null;
    
    // grab creds from env vars or vscode settings - user configures their own app
    private readonly CLIENT_ID: string;
    private readonly CLIENT_SECRET: string;
    private readonly REDIRECT_URI = 'http://127.0.0.1:8888/callback';
    private readonly SCOPES = [
        'user-read-private',
        'user-read-email',
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'user-library-read',
        'user-read-recently-played',
        'user-top-read',
        'streaming'
    ];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        
        const config = vscode.workspace.getConfiguration('codeSpa');
        this.CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || config.get('spotify.clientId', '');
        this.CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || config.get('spotify.clientSecret', '');
        
        if (!this.CLIENT_ID || !this.CLIENT_SECRET) {
            vscode.window.showWarningMessage(
                '🎵 Spotify credentials not configured. Please set your Client ID and Secret in settings.',
                'Open Settings'
            ).then((selection) => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'codeSpa.spotify');
                }
            });
        }
        
        this.spotifyApi = new SpotifyWebApi({
            clientId: this.CLIENT_ID,
            clientSecret: this.CLIENT_SECRET,
            redirectUri: this.REDIRECT_URI
        });

        this.restoreSession();
    }

    async authenticate(): Promise<boolean> {
        try {
            if (this.isAuthenticated) {
                return true;
            }

            const authUrl = this.spotifyApi.createAuthorizeURL(this.SCOPES, 'code-spa-state');
            
            await this.startAuthServer();
            await vscode.env.openExternal(vscode.Uri.parse(authUrl));
            
            // wait for auth to complete
            return new Promise((resolve) => {
                const checkAuth = setInterval(() => {
                    if (this.isAuthenticated) {
                        clearInterval(checkAuth);
                        resolve(true);
                    }
                }, 1000);

                // timeout after 2 minutes
                setTimeout(() => {
                    clearInterval(checkAuth);
                    if (!this.isAuthenticated) {
                        vscode.window.showErrorMessage('Spotify authentication timed out. Please try again.');
                        resolve(false);
                    }
                }, 120000);
            });

        } catch (error) {
            console.error('Spotify authentication error:', error);
            vscode.window.showErrorMessage('Failed to authenticate with Spotify. Please try again.');
            return false;
        }
    }

    private async startAuthServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.authServer = http.createServer(async (req, res) => {
                const parsedUrl = url.parse(req.url || '', true);
                
                if (parsedUrl.pathname === '/callback') {
                    const code = parsedUrl.query.code as string;
                    const error = parsedUrl.query.error as string;

                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: Arial; padding: 50px; text-align: center;">
                                    <h2>❌ Authentication Failed</h2>
                                    <p>Error: ${error}</p>
                                    <p>You can close this window and try again.</p>
                                </body>
                            </html>
                        `);
                        return;
                    }

                    if (code) {
                        try {
                            // swap auth code for tokens
                            const data = await this.spotifyApi.authorizationCodeGrant(code);
                            
                            this.spotifyApi.setAccessToken(data.body.access_token);
                            this.spotifyApi.setRefreshToken(data.body.refresh_token);
                            
                            await this.storeTokens(data.body.access_token, data.body.refresh_token);
                            await this.fetchUserInfo();
                            
                            this.isAuthenticated = true;
                            
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                    <body style="font-family: Arial; padding: 50px; text-align: center; background: linear-gradient(135deg, #1DB954, #1ed760);">
                                        <div style="background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                                            <h2 style="color: #1DB954;">🎵 Success!</h2>
                                            <p style="color: #333;">Code Spa is now connected to your Spotify account!</p>
                                            <p style="color: #666;">You can close this window and return to VS Code.</p>
                                            <div style="margin-top: 20px;">
                                                <span style="background: #1DB954; color: white; padding: 10px 20px; border-radius: 25px;">
                                                    Welcome, ${this.currentUser?.displayName || 'Spotify User'}!
                                                </span>
                                            </div>
                                        </div>
                                    </body>
                                </html>
                            `);

                            setTimeout(() => {
                                this.authServer?.close();
                            }, 1000);

                            vscode.window.showInformationMessage(`🎵 Successfully connected to Spotify! Welcome, ${this.currentUser?.displayName}!`);

                        } catch (error) {
                            console.error('Token exchange error:', error);
                            res.writeHead(500, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                    <body style="font-family: Arial; padding: 50px; text-align: center;">
                                        <h2>❌ Token Exchange Failed</h2>
                                        <p>Please try again in VS Code.</p>
                                    </body>
                                </html>
                            `);
                        }
                    }
                }
            });

            this.authServer.listen(8888, '127.0.0.1', resolve);
        });
    }

    private async fetchUserInfo(): Promise<void> {
        try {
            const userInfo = await this.spotifyApi.getMe();
            this.currentUser = {
                id: userInfo.body.id,
                displayName: userInfo.body.display_name || userInfo.body.id,
                email: userInfo.body.email,
                imageUrl: userInfo.body.images?.[0]?.url,
                isPremium: userInfo.body.product === 'premium'
            };
        } catch (error) {
            console.error('Failed to fetch user info:', error);
        }
    }

    async getUserPlaylists(): Promise<SpotifyPlaylist[]> {
        if (!this.isAuthenticated) return [];

        try {
            const playlists: SpotifyPlaylist[] = [];

            // add liked songs as a special "playlist"
            const likedSongs = await this.getLikedSongs();
            if (likedSongs.length > 0) {
                playlists.push({
                    id: 'liked-songs',
                    name: '💚 Liked Songs',
                    description: `${likedSongs.length} liked songs`,
                    tracks: likedSongs,
                    imageUrl: undefined,
                    owner: 'You'
                });
            }

            // add recently played tracks
            const recentTracks = await this.getRecentlyPlayed();
            if (recentTracks.length > 0) {
                playlists.push({
                    id: 'recently-played',
                    name: '🕒 Recently Played',
                    description: `${recentTracks.length} recently played songs`,
                    tracks: recentTracks,
                    imageUrl: undefined,
                    owner: 'You'
                });
            }

            // add top tracks
            const topTracks = await this.getTopTracks();
            if (topTracks.length > 0) {
                playlists.push({
                    id: 'top-tracks',
                    name: '🔥 Your Top Tracks',
                    description: `${topTracks.length} of your most played songs`,
                    tracks: topTracks,
                    imageUrl: undefined,
                    owner: 'You'
                });
            }

            // add user's regular playlists
            const response = await this.spotifyApi.getUserPlaylists();
            for (const playlist of response.body.items) {
                const tracks = await this.getPlaylistTracks(playlist.id);
                playlists.push({
                    id: playlist.id,
                    name: playlist.name,
                    description: playlist.description || '',
                    tracks,
                    imageUrl: playlist.images?.[0]?.url,
                    owner: playlist.owner.display_name || playlist.owner.id
                });
            }

            return playlists;
        } catch (error) {
            await this.handleApiError(error);
            return [];
        }
    }

    private async getLikedSongs(): Promise<SpotifyTrack[]> {
        try {
            const tracks: SpotifyTrack[] = [];
            let offset = 0;
            const limit = 50;

            // spotify returns liked songs in batches, so we need to paginate
            while (true) {
                const response = await this.spotifyApi.getMySavedTracks({ 
                    limit, 
                    offset 
                });

                const batch = response.body.items
                    .filter(item => item.track && !item.track.is_local && item.track.id)
                    .map(item => ({
                        id: item.track.id,
                        name: item.track.name,
                        artist: item.track.artists.map(a => a.name).join(', '),
                        album: item.track.album.name,
                        duration: item.track.duration_ms,
                        imageUrl: item.track.album.images?.[0]?.url,
                        previewUrl: item.track.preview_url || undefined,
                        uri: item.track.uri
                    }));

                tracks.push(...batch);

                // if we got fewer tracks than the limit, we're done
                if (response.body.items.length < limit) {
                    break;
                }

                offset += limit;
                // safety check to avoid infinite loops
                if (offset > 2000) break;
            }

            return tracks;
        } catch (error) {
            console.error('Failed to get liked songs:', error);
            return [];
        }
    }

    private async getRecentlyPlayed(): Promise<SpotifyTrack[]> {
        try {
            const response = await this.spotifyApi.getMyRecentlyPlayedTracks({ limit: 50 });
            // remove duplicates by track id
            const uniqueTracks = new Map<string, SpotifyTrack>();
            
            response.body.items.forEach(item => {
                if (item.track && !item.track.is_local && item.track.id && !uniqueTracks.has(item.track.id)) {
                    uniqueTracks.set(item.track.id, {
                        id: item.track.id,
                        name: item.track.name,
                        artist: item.track.artists.map(a => a.name).join(', '),
                        album: item.track.album.name,
                        duration: item.track.duration_ms,
                        imageUrl: item.track.album.images?.[0]?.url,
                        previewUrl: item.track.preview_url || undefined,
                        uri: item.track.uri
                    });
                }
            });

            return Array.from(uniqueTracks.values());
        } catch (error) {
            console.error('Failed to get recently played:', error);
            return [];
        }
    }

    private async getTopTracks(): Promise<SpotifyTrack[]> {
        try {
            const response = await this.spotifyApi.getMyTopTracks({ 
                limit: 50, 
                time_range: 'medium_term' // last 6 months
            });

            return response.body.items
                .filter(track => !track.is_local && track.id)
                .map(track => ({
                    id: track.id,
                    name: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    album: track.album.name,
                    duration: track.duration_ms,
                    imageUrl: track.album.images?.[0]?.url,
                    previewUrl: track.preview_url || undefined,
                    uri: track.uri
                }));
        } catch (error) {
            console.error('Failed to get top tracks:', error);
            return [];
        }
    }

    private async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
        try {
            const response = await this.spotifyApi.getPlaylistTracks(playlistId);
            return response.body.items
                .filter(item => item.track && item.track.type === 'track' && !item.track.is_local && item.track.id)
                .map(item => ({
                    id: item.track!.id,
                    name: item.track!.name,
                    artist: item.track!.artists.map(a => a.name).join(', '),
                    album: item.track!.album.name,
                    duration: item.track!.duration_ms,
                    imageUrl: item.track!.album.images?.[0]?.url,
                    previewUrl: item.track!.preview_url || undefined,
                    uri: item.track!.uri
                }));
        } catch (error) {
            console.error(`Failed to get tracks for playlist ${playlistId}:`, error);
            return [];
        }
    }

    async playTrack(trackUri: string): Promise<boolean> {
        if (!this.isAuthenticated) return false;

        try {
            // check for active devices first - this is the key part
            const devicesResponse = await this.spotifyApi.getMyDevices();
            const devices = devicesResponse.body.devices;

            if (devices.length === 0) {
                vscode.window.showErrorMessage(
                    '🎵 No Spotify devices found. Please open Spotify on any device first.',
                    'Open Spotify'
                ).then((selection) => {
                    if (selection === 'Open Spotify') {
                        vscode.env.openExternal(vscode.Uri.parse('spotify:'));
                    }
                });
                return false;
            }

            let activeDevice = devices.find(device => device.is_active);

            if (!activeDevice) {
                // try to activate the first available device
                const availableDevice = devices.find(device => !device.is_restricted);
                if (availableDevice) {
                    await this.spotifyApi.transferMyPlayback([availableDevice.id!]);
                    // give it a moment to transfer
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    activeDevice = availableDevice;
                } else {
                    vscode.window.showErrorMessage(
                        '🎵 No active Spotify device found. Please start playing music on Spotify first.',
                        'Open Spotify'
                    ).then((selection) => {
                        if (selection === 'Open Spotify') {
                            vscode.env.openExternal(vscode.Uri.parse('spotify:'));
                        }
                    });
                    return false;
                }
            }

            await this.spotifyApi.play({
                uris: [trackUri],
                device_id: activeDevice.id || undefined
            });
            return true;
        } catch (error) {
            await this.handleApiError(error);
            return false;
        }
    }

    async pausePlayback(): Promise<boolean> {
        if (!this.isAuthenticated) return false;

        try {
            await this.spotifyApi.pause();
            return true;
        } catch (error) {
            await this.handleApiError(error);
            return false;
        }
    }

    async resumePlayback(): Promise<boolean> {
        if (!this.isAuthenticated) return false;

        try {
            await this.spotifyApi.play();
            return true;
        } catch (error) {
            await this.handleApiError(error);
            return false;
        }
    }

    async skipToNext(): Promise<boolean> {
        if (!this.isAuthenticated) return false;

        try {
            await this.spotifyApi.skipToNext();
            return true;
        } catch (error) {
            await this.handleApiError(error);
            return false;
        }
    }

    async skipToPrevious(): Promise<boolean> {
        if (!this.isAuthenticated) return false;

        try {
            await this.spotifyApi.skipToPrevious();
            return true;
        } catch (error) {
            await this.handleApiError(error);
            return false;
        }
    }

    async getCurrentlyPlaying(): Promise<SpotifyTrack | null> {
        if (!this.isAuthenticated) return null;

        try {
            const response = await this.spotifyApi.getMyCurrentPlayingTrack();
            if (response.body.item && response.body.item.type === 'track') {
                const track = response.body.item;
                return {
                    id: track.id,
                    name: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    album: track.album.name,
                    duration: track.duration_ms,
                    imageUrl: track.album.images?.[0]?.url,
                    previewUrl: track.preview_url || undefined,
                    uri: track.uri
                };
            }
            return null;
        } catch (error) {
            await this.handleApiError(error);
            return null;
        }
    }

    async getCurrentPlaybackState(): Promise<{volume: number, isPlaying: boolean} | null> {
        if (!this.isAuthenticated) return null;

        try {
            const response = await this.spotifyApi.getMyCurrentPlaybackState();
            if (response.body && response.body.device) {
                return {
                    volume: response.body.device.volume_percent || 0,
                    isPlaying: response.body.is_playing || false
                };
            }
            return null;
        } catch (error) {
            await this.handleApiError(error);
            return null;
        }
    }

    private async handleApiError(error: any): Promise<void> {
        if (error.statusCode === 401) {
            // token expired, try to refresh
            try {
                const data = await this.spotifyApi.refreshAccessToken();
                this.spotifyApi.setAccessToken(data.body.access_token);
                await this.storeTokens(data.body.access_token, this.spotifyApi.getRefreshToken()!);
            } catch (refreshError) {
                this.isAuthenticated = false;
                this.currentUser = null;
                vscode.window.showErrorMessage('🎵 Spotify session expired. Please reconnect.');
            }
        } else {
            console.error('Spotify API error:', error);
        }
    }

    private async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
        await this.context.secrets.store('spotifyAccessToken', accessToken);
        await this.context.secrets.store('spotifyRefreshToken', refreshToken);
    }

    private async restoreSession(): Promise<void> {
        try {
            const accessToken = await this.context.secrets.get('spotifyAccessToken');
            const refreshToken = await this.context.secrets.get('spotifyRefreshToken');

            if (accessToken && refreshToken) {
                this.spotifyApi.setAccessToken(accessToken);
                this.spotifyApi.setRefreshToken(refreshToken);

                // test if tokens are still valid
                try {
                    await this.fetchUserInfo();
                    this.isAuthenticated = true;
                    console.log('🎵 Restored Spotify session');
                } catch (error) {
                    // tokens expired, clear them
                    await this.clearTokens();
                }
            }
        } catch (error) {
            console.error('Failed to restore Spotify session:', error);
        }
    }

    private async clearTokens(): Promise<void> {
        await this.context.secrets.delete('spotifyAccessToken');
        await this.context.secrets.delete('spotifyRefreshToken');
        this.isAuthenticated = false;
        this.currentUser = null;
    }

    public getUser(): SpotifyUser | null {
        return this.currentUser;
    }

    public getIsAuthenticated(): boolean {
        return this.isAuthenticated;
    }

    public async disconnect(): Promise<void> {
        await this.clearTokens();
        this.spotifyApi.resetAccessToken();
        this.spotifyApi.resetRefreshToken();
    }

    dispose(): void {
        if (this.authServer) {
            this.authServer.close();
        }
    }
} 