# 🎵 Spotify Integration Setup

## Quick Setup

1. **Create Spotify App** at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. **Set Redirect URI** to: `http://127.0.0.1:8888/callback`
3. **Copy your Client ID and Secret**
4. **Configure in VS Code**:
   - Open VS Code Settings (`Ctrl+,`)
   - Search for "Code Spa Spotify"
   - Enter your Client ID and Client Secret

## How Authentication Works

✅ **Secure OAuth Flow:**
- Click "Connect to Spotify" in music player
- Opens Spotify's official login page
- You log in with your normal Spotify account
- Spotify redirects back with authorization
- Your login tokens are stored securely in VS Code

## Features

### 🎵 **All Users:**
- Browse your playlists
- View track information
- Album artwork display

### 🎵 **Premium Users:**
- Play/pause control
- Skip tracks
- Select specific songs

## Troubleshooting

**"Credentials not configured"**
→ Add your Client ID/Secret in VS Code settings

**"Authentication failed"**  
→ Check redirect URI is exactly: `http://127.0.0.1:8888/callback`

**"No playback control"**
→ Spotify Premium required for remote control 