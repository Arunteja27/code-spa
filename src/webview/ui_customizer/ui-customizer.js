const vscode = acquireVsCodeApi();

function sendMessage(type, data = {}) {
    vscode.postMessage({ type: type, ...data });
}

function applyPreset(presetName) {
    sendMessage('applyPreset', { presetName: presetName });
}

function updateOpacity(value) {
    document.getElementById('opacityValue').textContent = value + '%';
    sendMessage('updateBackgroundOpacity', { opacity: parseInt(value) });
}

function updateFontSize(value) {
    document.getElementById('fontSizeValue').textContent = value + 'px';
    sendMessage('updateFontSize', { fontSize: parseInt(value) });
}

function toggleEffect(effectName, enabled) {
    sendMessage('toggleEffect', { effect: effectName, enabled: enabled });
}

function saveCustomSettings() {
    const settings = {
        backgroundOpacity: parseInt(document.getElementById('backgroundOpacity').value),
        fontSize: parseInt(document.getElementById('fontSize').value),
        effects: {
            glow: document.getElementById('glowEffect').checked,
            particles: document.getElementById('particleEffect').checked,
            animations: document.getElementById('animationEffect').checked
        }
    };
    
    sendMessage('saveCustomSettings', { settings: settings });
}

// Add interactive effects
document.addEventListener('DOMContentLoaded', function() {
    // Add hover effects to preset cards
    const presetCards = document.querySelectorAll('.preset-card');
    presetCards.forEach(card => {
        card.addEventListener('click', function() {
            this.style.transform = 'scale(0.95) translateY(-5px)';
            setTimeout(() => {
                this.style.transform = 'translateY(-5px)';
            }, 150);
        });
    });

    // Initialize slider values
    const backgroundOpacity = document.getElementById('backgroundOpacity');
    const fontSize = document.getElementById('fontSize');
    
    if (backgroundOpacity) {
        updateOpacity(backgroundOpacity.value);
        backgroundOpacity.addEventListener('input', function() {
            updateOpacity(this.value);
        });
    }
    
    if (fontSize) {
        updateFontSize(fontSize.value);
        fontSize.addEventListener('input', function() {
            updateFontSize(this.value);
        });
    }

    // Add effect toggle listeners
    const effectCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    effectCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const effectName = this.id.replace('Effect', '');
            toggleEffect(effectName, this.checked);
        });
    });
});

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'presetApplied':
            // Show success feedback
            showNotification('Theme preset applied successfully!', 'success');
            break;
        case 'settingsSaved':
            // Show success feedback
            showNotification('Custom settings saved!', 'success');
            break;
        case 'error':
            // Show error feedback
            showNotification(message.message || 'An error occurred', 'error');
            break;
    }
});

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        ${type === 'success' ? 'background: linear-gradient(45deg, #00ff41, #00d4ff);' : ''}
        ${type === 'error' ? 'background: linear-gradient(45deg, #ff0080, #ff6b35);' : ''}
        ${type === 'info' ? 'background: linear-gradient(45deg, #00d4ff, #0080ff);' : ''}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
} 