import * as vscode from 'vscode';

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
    private isInitialized: boolean = false;
    private isPlaying: boolean = false;
    private currentTrack: Track | null = null;
    private currentPlaylist: Playlist | null = null;
    private volume: number = 0.3;
    private playlists: Map<string, Playlist> = new Map();
    private webviewPanel: vscode.WebviewPanel | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializePlaylists();
    }

    private initializePlaylists() {
        // Ambient coding playlists
        const ambientPlaylist: Playlist = {
            name: 'Ambient Focus',
            description: 'Atmospheric sounds for deep focus',
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

        const lofiPlaylist: Playlist = {
            name: 'Lo-Fi Hip Hop',
            description: 'Chill beats for coding sessions',
            tracks: [
                {
                    title: 'Midnight Code',
                    url: 'https://example.com/lofi-1.mp3',
                    duration: 180,
                    genre: 'lofi'
                },
                {
                    title: 'Algorithm Dreams',
                    url: 'https://example.com/lofi-2.mp3',
                    duration: 200,
                    genre: 'lofi'
                }
            ]
        };

        const synthwavePlaylist: Playlist = {
            name: 'Synthwave Code',
            description: 'Retro-futuristic vibes for cyberpunk coding',
            tracks: [
                {
                    title: 'Neon Algorithms',
                    url: 'https://example.com/synth-1.mp3',
                    duration: 240,
                    genre: 'synthwave'
                },
                {
                    title: 'Digital Horizon',
                    url: 'https://example.com/synth-2.mp3',
                    duration: 280,
                    genre: 'synthwave'
                }
            ]
        };

        this.playlists.set('ambient', ambientPlaylist);
        this.playlists.set('lofi', lofiPlaylist);
        this.playlists.set('synthwave', synthwavePlaylist);
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        this.isInitialized = true;
        console.log('🎵 Music player initialized');

        // Load user preferences
        const savedVolume = this.context.globalState.get('musicVolume', 0.3);
        this.volume = savedVolume as number;

        const savedPlaylist = this.context.globalState.get('currentPlaylist', 'ambient');
        this.currentPlaylist = this.playlists.get(savedPlaylist as string) || this.playlists.get('ambient')!;
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
        const playlistOptions = Array.from(this.playlists.values())
            .map(playlist => `<option value="${playlist.name}">${playlist.name}</option>`)
            .join('');

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
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                }
                
                .player-container {
                    background: rgba(0, 0, 0, 0.3);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 30px;
                    max-width: 400px;
                    margin: 0 auto;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                
                .track-info {
                    text-align: center;
                    margin-bottom: 30px;
                }
                
                .track-title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                
                .track-artist {
                    font-size: 16px;
                    opacity: 0.8;
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
                    width: 60px;
                    height: 60px;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .control-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.1);
                }
                
                .play-pause {
                    width: 80px;
                    height: 80px;
                    font-size: 30px;
                }
                
                .volume-container {
                    margin-bottom: 20px;
                }
                
                .volume-slider {
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: rgba(255, 255, 255, 0.3);
                    outline: none;
                    -webkit-appearance: none;
                }
                
                .volume-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: white;
                    cursor: pointer;
                }
                
                .playlist-selector {
                    width: 100%;
                    padding: 12px;
                    border: none;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    font-size: 16px;
                    margin-bottom: 20px;
                }
                
                .playlist-selector option {
                    background: #333;
                    color: white;
                }
                
                .visualizer {
                    height: 100px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    margin-top: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-style: italic;
                    opacity: 0.7;
                }
            </style>
        </head>
        <body>
            <div class="player-container">
                <div class="track-info">
                    <div class="track-title" id="trackTitle">Select a playlist to start</div>
                    <div class="track-artist" id="trackArtist">Code Spa Music</div>
                </div>
                
                <div class="controls">
                    <button class="control-btn" onclick="previousTrack()">⏮</button>
                    <button class="control-btn play-pause" id="playPauseBtn" onclick="togglePlayPause()">▶</button>
                    <button class="control-btn" onclick="nextTrack()">⏭</button>
                </div>
                
                <div class="volume-container">
                    <label for="volumeSlider">Volume: <span id="volumeValue">${Math.round(this.volume * 100)}%</span></label>
                    <input type="range" id="volumeSlider" class="volume-slider" min="0" max="100" value="${this.volume * 100}" 
                           oninput="updateVolume(this.value)">
                </div>
                
                <select class="playlist-selector" id="playlistSelect" onchange="changePlaylist(this.value)">
                    <option value="">Choose a playlist...</option>
                    ${playlistOptions}
                </select>
                
                <div class="visualizer">
                    🎵 Audio Visualizer 🎵
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                let isPlaying = false;
                
                function togglePlayPause() {
                    const btn = document.getElementById('playPauseBtn');
                    isPlaying = !isPlaying;
                    btn.textContent = isPlaying ? '⏸' : '▶';
                    
                    vscode.postMessage({
                        command: isPlaying ? 'play' : 'pause'
                    });
                }
                
                function previousTrack() {
                    vscode.postMessage({ command: 'previous' });
                }
                
                function nextTrack() {
                    vscode.postMessage({ command: 'next' });
                }
                
                function updateVolume(value) {
                    document.getElementById('volumeValue').textContent = value + '%';
                    vscode.postMessage({ 
                        command: 'volume', 
                        value: value / 100 
                    });
                }
                
                function changePlaylist(playlist) {
                    if (playlist) {
                        vscode.postMessage({ 
                            command: 'changePlaylist', 
                            playlist: playlist 
                        });
                    }
                }
            </script>
        </body>
        </html>
        `;
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'play':
                await this.play();
                break;
            case 'pause':
                this.pause();
                break;
            case 'next':
                this.nextTrack();
                break;
            case 'previous':
                this.previousTrack();
                break;
            case 'volume':
                this.setVolume(message.value);
                break;
            case 'changePlaylist':
                this.changePlaylist(message.playlist);
                break;
        }
    }

    async play(): Promise<void> {
        if (!this.currentPlaylist || this.currentPlaylist.tracks.length === 0) {
            vscode.window.showWarningMessage('No playlist selected or playlist is empty.');
            return;
        }

        if (!this.currentTrack) {
            this.currentTrack = this.currentPlaylist.tracks[0];
        }

        this.isPlaying = true;
        console.log(`🎵 Playing: ${this.currentTrack.title}`);
        
        vscode.window.showInformationMessage(`🎵 Now playing: ${this.currentTrack.title}`, { modal: false });
    }

    pause(): void {
        this.isPlaying = false;
        console.log('🎵 Music paused');
    }

    stop(): void {
        this.isPlaying = false;
        this.currentTrack = null;
        console.log('🎵 Music stopped');
    }

    nextTrack(): void {
        if (!this.currentPlaylist || this.currentPlaylist.tracks.length === 0) return;

        const currentIndex = this.currentPlaylist.tracks.findIndex(track => track === this.currentTrack);
        const nextIndex = (currentIndex + 1) % this.currentPlaylist.tracks.length;
        this.currentTrack = this.currentPlaylist.tracks[nextIndex];
        
        if (this.isPlaying) {
            this.play();
        }
    }

    previousTrack(): void {
        if (!this.currentPlaylist || this.currentPlaylist.tracks.length === 0) return;

        const currentIndex = this.currentPlaylist.tracks.findIndex(track => track === this.currentTrack);
        const prevIndex = currentIndex <= 0 ? this.currentPlaylist.tracks.length - 1 : currentIndex - 1;
        this.currentTrack = this.currentPlaylist.tracks[prevIndex];
        
        if (this.isPlaying) {
            this.play();
        }
    }

    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        this.context.globalState.update('musicVolume', this.volume);
        console.log(`🎵 Volume set to ${Math.round(this.volume * 100)}%`);
    }

    changePlaylist(playlistName: string): void {
        const playlist = this.playlists.get(playlistName.toLowerCase());
        if (playlist) {
            this.currentPlaylist = playlist;
            this.currentTrack = playlist.tracks[0];
            this.context.globalState.update('currentPlaylist', playlistName.toLowerCase());
            
            vscode.window.showInformationMessage(`🎵 Switched to ${playlist.name} playlist`);
            console.log(`🎵 Changed to playlist: ${playlist.name}`);
        }
    }

    addCustomTrack(track: Track): void {
        // Allow users to add custom tracks
        let customPlaylist = this.playlists.get('custom');
        if (!customPlaylist) {
            customPlaylist = {
                name: 'Custom Tracks',
                description: 'Your personal coding soundtrack',
                tracks: []
            };
            this.playlists.set('custom', customPlaylist);
        }
        
        customPlaylist.tracks.push(track);
        vscode.window.showInformationMessage(`🎵 Added "${track.title}" to custom playlist`);
    }

    dispose(): void {
        this.stop();
        if (this.webviewPanel) {
            this.webviewPanel.dispose();
        }
    }
} 