const vscode = acquireVsCodeApi();

function sendMessage(type, data = {}) {
    vscode.postMessage({ type: type, ...data });
}

function connectSpotify() {
    sendMessage('connectSpotify');
}

function disconnectSpotify() {
    sendMessage('disconnectSpotify');
}

function selectPlaylist(playlistId) {
    sendMessage('selectPlaylist', { playlistId: playlistId });
}

function playTrack(trackIndex) {
    sendMessage('playTrack', { trackIndex: trackIndex });
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

function setVolume(volume) {
    sendMessage('setVolume', { volume: volume });
}

function selectCategory(category) {
    sendMessage('selectCategory', { category: category });
}

function goBack() {
    sendMessage('goBack');
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
    const progressBar = document.getElementById('progressBar');
    const progressHandle = document.getElementById('progressHandle');
    if (progressBar && progressHandle) {
        progressBar.style.width = percentage + '%';
        progressHandle.style.left = percentage + '%';
    }
}

// Drag functionality for progress bar
let isDragging = false;
let currentContainer = null;

function startDrag(event) {
    event.preventDefault();
    isDragging = true;
    currentContainer = event.target.closest('.progress-container');
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
    const handle = document.getElementById('progressHandle');
    if (handle) handle.style.cursor = 'grab';
}

// Volume control
function updateVolume(event) {
    const slider = event.target;
    const volume = parseInt(slider.value);
    setVolume(volume);
}

// Add interactive effects
document.addEventListener('DOMContentLoaded', function() {
    // Add hover effects to buttons
    const buttons = document.querySelectorAll('.library-tile, .playlist-tile, .track-item, .control-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });

    // Show progress handle on hover
    const progressContainer = document.querySelector('.progress-container');
    const progressHandle = document.getElementById('progressHandle');
    
    if (progressContainer && progressHandle) {
        progressContainer.addEventListener('mouseenter', () => {
            progressHandle.style.opacity = '1';
        });
        
        progressContainer.addEventListener('mouseleave', () => {
            progressHandle.style.opacity = '0';
        });
    }

    // Volume slider styling
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', updateVolume);
    }
});

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'updatePlaybackState':
            updatePlaybackState(message.data);
            break;
        case 'updateTrackInfo':
            updateTrackInfo(message.data);
            break;
        case 'updateProgress':
            updateProgress(message.data);
            break;
        case 'updateVolume':
            updateVolumeDisplay(message.data);
            break;
        case 'refreshView':
            // Refresh the entire view
            location.reload();
            break;
    }
});

function updatePlaybackState(data) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    if (playPauseBtn) {
        playPauseBtn.textContent = data.isPlaying ? '⏸' : '▶';
    }
}

function updateTrackInfo(data) {
    const trackTitle = document.getElementById('trackTitle');
    const trackArtist = document.getElementById('trackArtist');
    const trackArt = document.getElementById('trackArt');
    
    if (trackTitle) trackTitle.textContent = data.name || 'No track playing';
    if (trackArtist) trackArtist.textContent = data.artist || 'Select a song to start';
    
    if (trackArt) {
        if (data.imageUrl) {
            trackArt.innerHTML = `<img src="${data.imageUrl}" alt="Track artwork">`;
        } else {
            trackArt.innerHTML = '🎵';
        }
    }
}

function updateProgress(data) {
    if (!isDragging) { // Don't update if user is dragging
        const progressBar = document.getElementById('progressBar');
        const progressHandle = document.getElementById('progressHandle');
        const currentTimeEl = document.getElementById('currentTime');
        const totalTimeEl = document.getElementById('totalTime');
        
        if (progressBar && data.percentage !== undefined) {
            progressBar.style.width = data.percentage + '%';
            if (progressHandle) {
                progressHandle.style.left = data.percentage + '%';
            }
        }
        
        if (currentTimeEl && data.currentTime) currentTimeEl.textContent = data.currentTime;
        if (totalTimeEl && data.totalTime) totalTimeEl.textContent = data.totalTime;
    }
}

function updateVolumeDisplay(data) {
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeIcon = document.querySelector('.volume-icon');
    
    if (volumeSlider && data.volume !== undefined) {
        volumeSlider.value = data.volume;
    }
    
    if (volumeIcon && data.volume !== undefined) {
        if (data.volume === 0) {
            volumeIcon.textContent = '🔇';
        } else if (data.volume < 30) {
            volumeIcon.textContent = '🔈';
        } else if (data.volume < 70) {
            volumeIcon.textContent = '🔉';
        } else {
            volumeIcon.textContent = '🔊';
        }
    }
} 