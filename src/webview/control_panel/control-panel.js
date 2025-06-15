const vscode = acquireVsCodeApi();

function sendMessage(type, data = {}) {
    // Immediate feedback for play/pause
    if (type === 'togglePlayback') {
        const playPauseBtns = ['playPauseBtn', 'playPauseBtnCategory', 'playPauseBtnPlaylist'];
        playPauseBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                // Toggle the button immediately for responsiveness
                btn.textContent = btn.textContent === '▶' ? '⏸' : '▶';
            }
        });
    }
    
    vscode.postMessage({ command: type, ...data });
}

// Navigation history stack
let navigationHistory = ['home'];
let spotifyNavigationStack = [];

function navigateTo(page) {
    // Track navigation for back button
    if (navigationHistory[navigationHistory.length - 1] !== page) {
        navigationHistory.push(page);
        // Keep history reasonable size
        if (navigationHistory.length > 10) {
            navigationHistory = navigationHistory.slice(-10);
        }
    }
    sendMessage('navigate', { page: page });
}

function goBack() {
    if (navigationHistory.length > 1) {
        navigationHistory.pop(); // Remove current page
        const previousPage = navigationHistory[navigationHistory.length - 1];
        sendMessage('navigate', { page: previousPage });
    } else {
        navigateTo('home'); // Fallback to home
    }
}

function smartBack() {
    sendMessage('goBackSpotify');
}

// Track Spotify navigation
function trackSpotifyNavigation(view) {
    spotifyNavigationStack.push(view);
    // Keep stack reasonable size
    if (spotifyNavigationStack.length > 10) {
        spotifyNavigationStack = spotifyNavigationStack.slice(-10);
    }
}

// Override sendMessage to track Spotify navigation
const originalSendMessage = sendMessage;
sendMessage = function(type, data = {}) {
    // Track Spotify navigation events
    if (type === 'openLikedSongs' || type === 'openRecentlyPlayed' || type === 'openTopTracks') {
        trackSpotifyNavigation('library');
    } else if (type === 'openPlaylists') {
        trackSpotifyNavigation('library');
    } else if (type === 'selectPlaylist') {
        trackSpotifyNavigation('playlists');
    }
    
    if (type === 'connectSpotify') {
        const btn = document.getElementById('connectSpotifyBtn');
        const spinner = document.getElementById('spotifyConnectingSpinner');
        if (btn) btn.style.display = 'none';
        if (spinner) spinner.style.display = 'block';
    }
    
    originalSendMessage(type, data);
};

function applyTheme(themeName) {
    sendMessage('applyTheme', { theme: themeName });
}

function toggleBackground() {
    sendMessage('toggleBackground');
}

function analyzeProject() {
    sendMessage('analyzeProject');
}

function customizeTheme() {
    sendMessage('customizeTheme');
}

function connectSpotify() {
    sendMessage('connectSpotify');
}

function disconnectSpotify() {
    sendMessage('disconnectSpotify');
}

function togglePlayback() {
    sendMessage('togglePlayback');
}

function nextTrack() {
    sendMessage('nextTrack');
}

function previousTrack() {
    sendMessage('previousTrack');
}

function openMusicPlayer() {
    sendMessage('openMusicPlayer');
}

function selectSpotifyCategory(category) {
    sendMessage('selectSpotifyCategory', { category: category });
}

function selectPlaylist(playlistId) {
    sendMessage('selectPlaylist', { playlistId: playlistId });
}

function playTrack(trackIndex) {
    sendMessage('playTrack', { trackIndex: trackIndex });
}

function goBackToLibrary() {
    sendMessage('goBackToLibrary');
}

function navigateToMusicLibrary() {
    sendMessage('navigateToMusicLibrary');
}

function setVolume(volume) {
    sendMessage('setVolume', { volume: volume });
}

function toggleNotifications(category) {
    sendMessage('toggleNotifications', { category: category });
}

function seekToPosition(event) {
    const progressContainer = event.currentTarget;
    const rect = progressContainer.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    
    // Immediate visual feedback
    updateProgressVisually(percentage);
    
    // Send seek command
    sendMessage('seekToPosition', { percentage: percentage });
}

function updateProgressVisually(percentage) {
    const progressBars = ['progressBar', 'progressBarCategory', 'progressBarPlaylist'];
    const progressHandles = ['progressHandle', 'progressHandleCategory', 'progressHandlePlaylist'];
    
    progressBars.forEach((id, index) => {
        const progressBar = document.getElementById(id);
        const progressHandle = document.getElementById(progressHandles[index]);
        if (progressBar && progressHandle) {
            progressBar.style.width = percentage + '%';
            progressHandle.style.left = percentage + '%';
        }
    });
}

// Drag functionality
let isDragging = false;
let isUserDraggingProgress = false;
let currentContainer = null;

function startDrag(event) {
    event.preventDefault();
    isDragging = true;
    currentContainer = event.target.closest('.progress-container');
    isUserDraggingProgress = true;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    event.target.style.cursor = 'grabbing';
}

function onDrag(event) {
    if (!isDragging || !currentContainer) return;
    
    const rect = currentContainer.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    
    // Immediate visual feedback during drag
    updateProgressVisually(percentage);
}

function stopDrag(event) {
    if (!isDragging || !currentContainer) return;
    
    const rect = currentContainer.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    
    // Send final seek command
    sendMessage('seekToPosition', { percentage: percentage });
    
    isDragging = false;
    currentContainer = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    
    // Reset cursor
    const handles = document.querySelectorAll('.progress-handle');
    handles.forEach(handle => handle.style.cursor = 'grab');
    setTimeout(()=>{ isUserDraggingProgress = false; }, 500);
}

// Add interactive effects
document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('.control-button, .theme-card, .music-button, .spotify-card, .playlist-item, .track-item');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });

    // Update play/pause button more frequently for responsiveness
    setInterval(() => {
        sendMessage('getCurrentPlaybackState');
    }, 1000);

    // Update progress bar every second when playing
    setInterval(updateProgressBar, 1000);
});

// Function to periodically update progress bar
function updateProgressBar() {
    sendMessage('getCurrentPlaybackState');
}

function formatTime(milliseconds) {
    if (!milliseconds || isNaN(milliseconds)) return '0:00';
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Track info state to prevent rubber banding
let lastTrackInfo = { name: '', artist: '' };
let trackUpdateTimeout = null;

// Handle playback state updates
window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'playbackStateUpdate') {
        // Update play/pause buttons across all views
        const playPauseBtns = document.querySelectorAll('[onclick*="togglePlayback"]');
        playPauseBtns.forEach(btn => {
            btn.textContent = message.isPlaying ? '⏸' : '▶';
            btn.style.background = message.isPlaying 
                ? 'rgba(30, 215, 96, 0.2)' 
                : 'linear-gradient(135deg, #1ed760, #1db954)';
            btn.style.color = message.isPlaying ? '#1ed760' : '#000';
        });

        // Update progress bar if not being dragged by user
        if (!isUserDraggingProgress && message.progressPercentage !== undefined) {
            updateProgressVisually(message.progressPercentage);
            
            // Update time displays
            const currentTimeEls = document.querySelectorAll('#currentTime');
            const totalTimeEls = document.querySelectorAll('#totalTime');
            
            currentTimeEls.forEach(el => {
                if (el) el.textContent = formatTime(message.progress);
            });
            
            totalTimeEls.forEach(el => {
                if (el) el.textContent = formatTime(message.duration);
            });
        }

        // Update track info if track changed
        if (message.track) {
            updateTrackInfo(message.track);
        }
    } else if (message.type === 'trackChanged') {
        // Handle track changes
        const newTrackInfo = {
            name: message.track.name || 'Unknown Track',
            artist: message.track.artist || 'Unknown Artist',
            imageUrl: message.track.imageUrl || null
        };
        
        updateTrackInfo(newTrackInfo);
    } else if (message.type === 'nowPlayingUpdate') {
        // Handle now playing updates without full page refresh
        if (message.track) {
            updateTrackInfo(message.track);
        }
    }
});

function updateTrackInfo(trackInfo) {
    // Only update if track actually changed
    if (trackInfo.name !== lastTrackInfo.name || trackInfo.artist !== lastTrackInfo.artist) {
        lastTrackInfo = trackInfo;
        
        // Update track info displays
        const trackNameEls = document.querySelectorAll('.track-name, [class*="trackName"]');
        const artistNameEls = document.querySelectorAll('.track-artist, [class*="artistName"]');
        
        trackNameEls.forEach(el => {
            if (el) el.textContent = trackInfo.name;
        });
        
        artistNameEls.forEach(el => {
            if (el) el.textContent = trackInfo.artist;
        });
        
        // Update album artwork
        const trackArtEls = document.querySelectorAll('.track-art, [class*="trackArt"]');
        trackArtEls.forEach(el => {
            if (el && trackInfo.imageUrl) {
                el.innerHTML = `<img src="${trackInfo.imageUrl}" alt="Album Art" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
            } else if (el) {
                el.innerHTML = '🎵';
            }
        });
    }
}

// Show progress handle on hover for all progress containers
document.addEventListener('DOMContentLoaded', function() {
    const progressContainers = document.querySelectorAll('.progress-container');
    const progressHandles = ['progressHandle', 'progressHandleCategory', 'progressHandlePlaylist'];
    
    progressContainers.forEach((container, index) => {
        const handle = document.getElementById(progressHandles[index] || 'progressHandle');
        if (container && handle) {
            container.addEventListener('mouseenter', () => {
                handle.style.opacity = '1';
            });
            
            container.addEventListener('mouseleave', () => {
                handle.style.opacity = '0';
            });
        }
    });
}); 