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
    
    // Get from VS Code settings - users configure their own app
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
        'streaming'
    ];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        
        // Get credentials from VS Code settings
        const config = vscode.workspace.getConfiguration('codeSpa');
        this.CLIENT_ID = config.get('spotify.clientId', '');
        this.CLIENT_SECRET = config.get('spotify.clientSecret', '');
        
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

        // Try to restore previous session
        this.restoreSession();
    }

    async authenticate(): Promise<boolean> {
        try {
            // Check if we already have valid tokens
            if (this.isAuthenticated) {
                return true;
            }

            const authUrl = this.spotifyApi.createAuthorizeURL(this.SCOPES, 'code-spa-state');
            
            // Start local server to catch the callback
            await this.startAuthServer();
            
            // Open browser for user authentication
            await vscode.env.openExternal(vscode.Uri.parse(authUrl));
            
            return new Promise((resolve) => {
                // Wait for authentication completion
                const checkAuth = setInterval(() => {
                    if (this.isAuthenticated) {
                        clearInterval(checkAuth);
                        resolve(true);
                    }
                }, 1000);

                // Timeout after 2 minutes
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
                            // Exchange code for tokens
                            const data = await this.spotifyApi.authorizationCodeGrant(code);
                            
                            this.spotifyApi.setAccessToken(data.body.access_token);
                            this.spotifyApi.setRefreshToken(data.body.refresh_token);
                            
                            // Store tokens securely
                            await this.storeTokens(data.body.access_token, data.body.refresh_token);
                            
                            // Get user info
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

                            // Close server after successful auth
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

            this.authServer.listen(8888, '127.0.0.1', () => {
                console.log('🎵 Spotify auth server started on http://127.0.0.1:8888');
                resolve();
            });

            this.authServer.on('error', (error) => {
                console.error('Auth server error:', error);
                reject(error);
            });
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
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }

        try {
            const playlists = await this.spotifyApi.getUserPlaylists();
            const result: SpotifyPlaylist[] = [];

            for (const playlist of playlists.body.items) {
                if (playlist.tracks.total > 0) {
                    const tracks = await this.getPlaylistTracks(playlist.id);
                    result.push({
                        id: playlist.id,
                        name: playlist.name,
                        description: playlist.description || '',
                        tracks: tracks,
                        imageUrl: playlist.images?.[0]?.url,
                        owner: playlist.owner.display_name || playlist.owner.id
                    });
                }
            }

            return result;
        } catch (error) {
            console.error('Failed to fetch playlists:', error);
            await this.handleApiError(error);
            return [];
        }
    }

    private async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
        try {
            const tracks = await this.spotifyApi.getPlaylistTracks(playlistId);
            return tracks.body.items
                .filter(item => item.track && item.track.type === 'track')
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
            console.error(`Failed to fetch tracks for playlist ${playlistId}:`, error);
            return [];
        }
    }

    async playTrack(trackUri: string): Promise<boolean> {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }

        if (!this.currentUser?.isPremium) {
            vscode.window.showWarningMessage('🎵 Spotify Premium required for playback control. You can still browse playlists and tracks!');
            return false;
        }

        try {
            await this.spotifyApi.play({ uris: [trackUri] });
            return true;
        } catch (error) {
            console.error('Failed to play track:', error);
            await this.handleApiError(error);
            return false;
        }
    }

    async pausePlayback(): Promise<boolean> {
        if (!this.isAuthenticated || !this.currentUser?.isPremium) {
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
        if (!this.isAuthenticated || !this.currentUser?.isPremium) {
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
        if (!this.isAuthenticated || !this.currentUser?.isPremium) {
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
        if (!this.isAuthenticated || !this.currentUser?.isPremium) {
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

    async getCurrentlyPlaying(): Promise<SpotifyTrack | null> {
        if (!this.isAuthenticated) {
            return null;
        }

        try {
            const current = await this.spotifyApi.getMyCurrentPlayingTrack();
            if (current.body.item && current.body.item.type === 'track') {
                const track = current.body.item;
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
        } catch (error) {
            console.error('Failed to get currently playing:', error);
        }

        return null;
    }

    private async handleApiError(error: any): Promise<void> {
        if (error.statusCode === 401) {
            // Token expired, try to refresh
            try {
                const data = await this.spotifyApi.refreshAccessToken();
                this.spotifyApi.setAccessToken(data.body.access_token);
                await this.storeTokens(data.body.access_token, this.spotifyApi.getRefreshToken()!);
            } catch (refreshError) {
                console.error('Failed to refresh token:', refreshError);
                this.isAuthenticated = false;
                await this.clearTokens();
                vscode.window.showErrorMessage('Spotify session expired. Please reconnect to Spotify.');
            }
        }
    }

    private async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
        await this.context.secrets.store('spotify_access_token', accessToken);
        await this.context.secrets.store('spotify_refresh_token', refreshToken);
    }

    private async restoreSession(): Promise<void> {
        try {
            const accessToken = await this.context.secrets.get('spotify_access_token');
            const refreshToken = await this.context.secrets.get('spotify_refresh_token');

            if (accessToken && refreshToken) {
                this.spotifyApi.setAccessToken(accessToken);
                this.spotifyApi.setRefreshToken(refreshToken);

                // Test if token is still valid
                await this.fetchUserInfo();
                this.isAuthenticated = true;
                console.log('🎵 Restored Spotify session');
            }
        } catch (error) {
            console.log('🎵 No valid Spotify session to restore');
            await this.clearTokens();
        }
    }

    private async clearTokens(): Promise<void> {
        await this.context.secrets.delete('spotify_access_token');
        await this.context.secrets.delete('spotify_refresh_token');
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
        vscode.window.showInformationMessage('🎵 Disconnected from Spotify');
    }

    dispose(): void {
        if (this.authServer) {
            this.authServer.close();
        }
    }
} 