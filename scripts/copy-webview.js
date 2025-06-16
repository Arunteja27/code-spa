const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
    try {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const files = fs.readdirSync(src);
        
        for (const file of files) {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            
            if (fs.statSync(srcPath).isDirectory()) {
                copyDir(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
                console.log(`Copied: ${srcPath} -> ${destPath}`);
            }
        }
    } catch (error) {
        console.error(`Error copying ${src} to ${dest}:`, error.message);
    }
}

console.log('Copying webview assets...');

// Copy webview directories
copyDir('src/webview/control_panel', 'out/webview/control_panel');
copyDir('src/webview/music_player', 'out/webview/music_player');
copyDir('src/webview/ui_customizer', 'out/webview/ui_customizer');

console.log('Webview assets copied successfully!'); 