import * as vscode from 'vscode';

interface ThemePreset {
    name: string;
    displayName: string;
    description: string;
    vscodeTheme: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
    };
    fonts: {
        editor: string;
        ui: string;
    };
    effects: {
        glow: boolean;
        particles: boolean;
        animations: boolean;
    };
}

export class UICustomizer {
    private context: vscode.ExtensionContext;
    private presets: Map<string, ThemePreset> = new Map();
    private customizationPanel: vscode.WebviewPanel | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializePresets();
    }

    private initializePresets() {
        const cyberpunkPreset: ThemePreset = {
            name: 'cyberpunk',
            displayName: 'Cyberpunk',
            description: 'Neon-lit futuristic coding environment',
            vscodeTheme: 'Dark+ (default dark)',
            colors: {
                primary: '#00ff41',
                secondary: '#ff0080',
                accent: '#00d4ff',
                background: '#0a0a0a',
                text: '#ffffff'
            },
            fonts: {
                editor: 'Fira Code, Monaco, monospace',
                ui: 'Orbitron, Arial, sans-serif'
            },
            effects: {
                glow: true,
                particles: true,
                animations: true
            }
        };

        const naturePreset: ThemePreset = {
            name: 'nature',
            displayName: 'Nature',
            description: 'Peaceful forest coding sanctuary',
            vscodeTheme: 'Light+ (default light)',
            colors: {
                primary: '#4a7c59',
                secondary: '#8fbc8f',
                accent: '#228b22',
                background: '#f5f5dc',
                text: '#2d4a2d'
            },
            fonts: {
                editor: 'Source Code Pro, monospace',
                ui: 'Segoe UI, Arial, sans-serif'
            },
            effects: {
                glow: false,
                particles: true,
                animations: false
            }
        };

        const spacePreset: ThemePreset = {
            name: 'space',
            displayName: 'Space',
            description: 'Cosmic coding adventure',
            vscodeTheme: 'Dark+ (default dark)', // VS Code's default dark theme
            colors: {
                primary: '#4169e1',
                secondary: '#9370db',
                accent: '#ffd700',
                background: '#0c0c1f',
                text: '#ffffff'
            },
            fonts: {
                editor: 'JetBrains Mono, monospace',
                ui: 'Space Mono, monospace'
            },
            effects: {
                glow: true,
                particles: true,
                animations: true
            }
        };

        const minimalPreset: ThemePreset = {
            name: 'minimal',
            displayName: 'Minimal',
            description: 'Clean and distraction-free',
            vscodeTheme: 'Light+ (default light)', // VS Code's default light theme
            colors: {
                primary: '#333333',
                secondary: '#666666',
                accent: '#007acc',
                background: '#f8f8f8',
                text: '#222222'
            },
            fonts: {
                editor: 'Consolas, Monaco, monospace',
                ui: 'Segoe UI, Arial, sans-serif'
            },
            effects: {
                glow: false,
                particles: false,
                animations: false
            }
        };

        const retroPreset: ThemePreset = {
            name: 'retro',
            displayName: 'Retro',
            description: 'Nostalgic 80s terminal vibes',
            vscodeTheme: 'Dark+ (default dark)', // Use dark as base
            colors: {
                primary: '#ff6b35',
                secondary: '#f7931e',
                accent: '#ffd23f',
                background: '#1a1a1a',
                text: '#00ff00'
            },
            fonts: {
                editor: 'IBM Plex Mono, monospace',
                ui: 'Press Start 2P, monospace'
            },
            effects: {
                glow: true,
                particles: false,
                animations: true
            }
        };

        this.presets.set('cyberpunk', cyberpunkPreset);
        this.presets.set('nature', naturePreset);
        this.presets.set('space', spacePreset);
        this.presets.set('minimal', minimalPreset);
        this.presets.set('retro', retroPreset);
    }

    showCustomizationPanel(): void {
        vscode.window.showInformationMessage(
            '🎨 Theme customization is now available in the Code Spa control panel!',
            'Open Control Panel'
        ).then(selection => {
            if (selection === 'Open Control Panel') {
                vscode.commands.executeCommand('code-spa.openControlPanel');
            }
        });
    }

    private getCustomizerHTML(): string {
        const presetIcons: { [key: string]: string } = {
            'cyberpunk': '🌃',
            'nature': '🌲',
            'space': '🚀',
            'minimal': '✨',
            'retro': '📼'
        };

        const presetOptions = Array.from(this.presets.values())
            .map(preset => `
                <div class="preset-card" data-preset="${preset.name}" onclick="applyPreset('${preset.name}')">
                    <h3>${presetIcons[preset.name] || '🎨'} ${preset.displayName}</h3>
                    <p>${preset.description}</p>
                    <div class="color-palette">
                        <div class="color-swatch" style="background: ${preset.colors.primary}"></div>
                        <div class="color-swatch" style="background: ${preset.colors.secondary}"></div>
                        <div class="color-swatch" style="background: ${preset.colors.accent}"></div>
                        <div class="color-swatch" style="background: ${preset.colors.background}"></div>
                    </div>
                    <small style="opacity: 0.7; font-size: 12px;">VS Code Theme: ${preset.vscodeTheme}</small>
                    <button onclick="event.stopPropagation(); applyPreset('${preset.name}')">Apply Theme</button>
                </div>
            `).join('');

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Spa Theme Customizer</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                    color: white;
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                }

                .customizer-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .section {
                    background: rgba(0, 0, 0, 0.3);
                    backdrop-filter: blur(10px);
                    border-radius: 15px;
                    padding: 30px;
                    margin-bottom: 30px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }

                .section h2 {
                    margin-top: 0;
                    color: #00d4ff;
                    font-size: 28px;
                    text-align: center;
                    margin-bottom: 30px;
                }

                .presets-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }

                .preset-card {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    border: 2px solid transparent;
                }

                .preset-card:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: #00d4ff;
                    transform: translateY(-5px);
                }

                .preset-card h3 {
                    margin: 0 0 10px 0;
                    font-size: 22px;
                }

                .preset-card p {
                    margin: 0 0 15px 0;
                    opacity: 0.8;
                    font-size: 14px;
                }

                .color-palette {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    margin-bottom: 15px;
                }

                .color-swatch {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                }

                button {
                    background: linear-gradient(45deg, #00d4ff, #0080ff);
                    border: none;
                    border-radius: 25px;
                    padding: 12px 24px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                button:hover {
                    background: linear-gradient(45deg, #0080ff, #00d4ff);
                    transform: scale(1.05);
                }

                .controls-section {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                }

                .control-group {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 20px;
                }

                .control-group h4 {
                    margin-top: 0;
                    color: #00ff41;
                    font-size: 18px;
                    margin-bottom: 15px;
                }

                .slider-container {
                    margin-bottom: 15px;
                }

                .slider-container label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 14px;
                }

                input[type="range"] {
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: rgba(255, 255, 255, 0.3);
                    outline: none;
                    -webkit-appearance: none;
                }

                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #00d4ff;
                    cursor: pointer;
                }

                .checkbox-container {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }

                .checkbox-container input[type="checkbox"] {
                    margin-right: 10px;
                    transform: scale(1.2);
                }

                .save-custom {
                    text-align: center;
                    margin-top: 30px;
                }

                .save-custom button {
                    background: linear-gradient(45deg, #ff0080, #ff6b35);
                    padding: 15px 30px;
                    font-size: 16px;
                }
            </style>
        </head>
        <body>
            <div class="customizer-container">
                <div class="section">
                    <h2>🎨 Theme Presets</h2>
                    <div class="presets-grid">
                        ${presetOptions}
                    </div>
                </div>

                <div class="section">
                    <h2>🛠️ Custom Settings</h2>
                    <div class="controls-section">
                        <div class="control-group">
                            <h4>🎨 Colors</h4>
                            <div class="slider-container">
                                <label for="backgroundOpacity">Background Opacity: <span id="opacityValue">15%</span></label>
                                <input type="range" id="backgroundOpacity" min="5" max="95" value="15" 
                                       oninput="updateOpacity(this.value)">
                            </div>
                        </div>

                        <div class="control-group">
                            <h4>✨ Effects</h4>
                            <div class="checkbox-container">
                                <input type="checkbox" id="enableGlow" checked>
                                <label for="enableGlow">Neon Glow Effects</label>
                            </div>
                            <div class="checkbox-container">
                                <input type="checkbox" id="enableParticles" checked>
                                <label for="enableParticles">Particle Effects</label>
                            </div>
                            <div class="checkbox-container">
                                <input type="checkbox" id="enableAnimations" checked>
                                <label for="enableAnimations">Smooth Animations</label>
                            </div>
                        </div>

                        <div class="control-group">
                            <h4>🔤 Typography</h4>
                            <div class="slider-container">
                                <label for="fontSize">Editor Font Size: <span id="fontSizeValue">14px</span></label>
                                <input type="range" id="fontSize" min="10" max="24" value="14" 
                                       oninput="updateFontSize(this.value)">
                            </div>
                        </div>
                    </div>

                    <div class="save-custom">
                        <button onclick="saveCustomSettings()">💾 Save Custom Theme</button>
                    </div>
                </div>

                <div class="section">
                    <h2>🌟 Preview</h2>
                    <div id="themePreview" style="
                        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
                        border-radius: 10px;
                        padding: 20px;
                        border: 2px solid #00ff41;
                        text-align: center;
                        box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
                    ">
                        <p style="margin: 0; font-size: 18px; color: #00ff41;">
                            🚀 Your coding experience will look amazing!
                        </p>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function applyPreset(presetName) {
                    vscode.postMessage({
                        command: 'applyPreset',
                        preset: presetName
                    });
                }

                function updateOpacity(value) {
                    document.getElementById('opacityValue').textContent = value + '%';
                    vscode.postMessage({
                        command: 'updateOpacity',
                        value: value / 100
                    });
                }

                function updateFontSize(value) {
                    document.getElementById('fontSizeValue').textContent = value + 'px';
                    vscode.postMessage({
                        command: 'updateFontSize',
                        value: parseInt(value)
                    });
                }

                function saveCustomSettings() {
                    const settings = {
                        opacity: document.getElementById('backgroundOpacity').value / 100,
                        fontSize: parseInt(document.getElementById('fontSize').value),
                        effects: {
                            glow: document.getElementById('enableGlow').checked,
                            particles: document.getElementById('enableParticles').checked,
                            animations: document.getElementById('enableAnimations').checked
                        }
                    };

                    vscode.postMessage({
                        command: 'saveCustom',
                        settings: settings
                    });
                }
            </script>
        </body>
        </html>
        `;
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'applyPreset':
                await this.applyPreset(message.preset);
                break;
            case 'updateOpacity':
                await this.updateBackgroundOpacity(message.value);
                break;
            case 'updateFontSize':
                await this.updateFontSize(message.value);
                break;
            case 'saveCustom':
                await this.saveCustomSettings(message.settings);
                break;
        }
    }

    async applyPreset(presetName: string): Promise<void> {
        const preset = this.presets.get(presetName);
        if (!preset) {
            vscode.window.showErrorMessage(`Unknown preset: ${presetName}`);
            return;
        }

        console.log(`🎨 Applying ${preset.displayName} theme preset`);

        const config = vscode.workspace.getConfiguration('codeSpa');
        await config.update('theme.preset', presetName, vscode.ConfigurationTarget.Global);

        await this.applyThemeSettings(preset);

        vscode.window.showInformationMessage(`🎨 ${preset.displayName} theme applied!`);
    }

    private async applyThemeSettings(preset: ThemePreset): Promise<void> {
        await this.context.globalState.update('currentTheme', preset);

        try {
            const workbenchConfig = vscode.workspace.getConfiguration('workbench');
            
            const themeToApply = await this.getAvailableTheme(preset.vscodeTheme, preset.name);
            await workbenchConfig.update('colorTheme', themeToApply, vscode.ConfigurationTarget.Global);
            
            await this.applyCustomColors(preset);
            const editorConfig = vscode.workspace.getConfiguration('editor');
            await editorConfig.update('fontFamily', preset.fonts.editor, vscode.ConfigurationTarget.Global);
            
            if (preset.name === 'minimal') {
                await editorConfig.update('minimap.enabled', false, vscode.ConfigurationTarget.Global);
                await editorConfig.update('renderWhitespace', 'none', vscode.ConfigurationTarget.Global);
            } else {
                await editorConfig.update('minimap.enabled', true, vscode.ConfigurationTarget.Global);
                await editorConfig.update('renderWhitespace', 'selection', vscode.ConfigurationTarget.Global);
            }

            if (preset.effects.animations) {
                await editorConfig.update('cursorBlinking', 'smooth', vscode.ConfigurationTarget.Global);
            } else {
                await editorConfig.update('cursorBlinking', 'solid', vscode.ConfigurationTarget.Global);
            }

            console.log(`✅ Applied VS Code theme: ${themeToApply} with custom colors`);

        } catch (error) {
            console.warn('Could not apply all theme settings:', error);
            // Fallback to default dark theme if the specified theme doesn't exist
            try {
                const workbenchConfig = vscode.workspace.getConfiguration('workbench');
                await workbenchConfig.update('colorTheme', 'Dark+ (default dark)', vscode.ConfigurationTarget.Global);
                console.log('🔄 Fallback to default dark theme applied');
            } catch (fallbackError) {
                console.error('Failed to apply fallback theme:', fallbackError);
            }
        }
    }

    private async applyCustomColors(preset: ThemePreset): Promise<void> {
        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        
        // Clear any existing color customizations first
        await workbenchConfig.update('colorCustomizations', {}, vscode.ConfigurationTarget.Global);
        
        // Wait a moment for the clear to take effect
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create custom color overrides based on our preset
        const colorCustomizations = this.generateColorCustomizations(preset);
        
        await workbenchConfig.update('colorCustomizations', colorCustomizations, vscode.ConfigurationTarget.Global);
        
        console.log(`🎨 Applied custom colors for ${preset.name} theme`);
    }

    private generateColorCustomizations(preset: ThemePreset): any {
        const colors = preset.colors;
        
        // Base customizations that work for all themes
        const baseCustomizations = {
            // Activity bar
            "activityBar.background": colors.background,
            "activityBar.foreground": colors.primary,
            "activityBarBadge.background": colors.accent,
            
            // Side bar
            "sideBar.background": colors.background,
            "sideBar.foreground": colors.text,
            "sideBarTitle.foreground": colors.primary,
            
            // Status bar
            "statusBar.background": colors.primary,
            "statusBar.foreground": colors.background,
            "statusBarItem.hoverBackground": colors.secondary,
            
            // Editor
            "editor.background": colors.background,
            "editor.foreground": colors.text,
            "editor.selectionBackground": colors.secondary + "40", // Add transparency
            "editor.lineHighlightBackground": colors.primary + "20",
            
            // Terminal
            "terminal.background": colors.background,
            "terminal.foreground": colors.text,
            "terminal.ansiGreen": colors.primary,
            "terminal.ansiYellow": colors.accent,
            "terminal.ansiMagenta": colors.secondary,
        };

        // Theme-specific customizations
        switch (preset.name) {
            case 'cyberpunk':
                return {
                    ...baseCustomizations,
                    "editor.background": "#0a0a0a",
                    "terminal.ansiGreen": "#00ff41",
                    "terminal.ansiCyan": "#00d4ff",
                    "terminal.ansiMagenta": "#ff0080",
                    "editorCursor.foreground": "#00ff41",
                    "editor.selectionBackground": "#00ff4140",
                };
                
            case 'nature':
                return {
                    ...baseCustomizations,
                    "editor.background": "#f5f5dc",
                    "editor.foreground": "#2d4a2d",
                    "sideBar.background": "#e8f5e8",
                    "activityBar.background": "#d4e6d4",
                    "statusBar.background": "#4a7c59",
                    "terminal.ansiGreen": "#228b22",
                };
                
            case 'retro':
                return {
                    ...baseCustomizations,
                    "editor.background": "#1a1a1a",
                    "terminal.ansiYellow": "#ffd23f",
                    "terminal.ansiRed": "#ff6b35",
                    "terminal.ansiMagenta": "#f7931e",
                    "editorCursor.foreground": "#ffd23f",
                };
                
            case 'space':
                return {
                    ...baseCustomizations,
                    "editor.background": "#0c0c1f",
                    "terminal.ansiBlue": "#4169e1",
                    "terminal.ansiMagenta": "#9370db",
                    "terminal.ansiYellow": "#ffd700",
                };
                
            default:
                return baseCustomizations;
        }
    }

    private async getAvailableTheme(preferredTheme: string, presetName: string): Promise<string> {
        // Define fallback themes for each preset
        const fallbackThemes: { [key: string]: string[] } = {
            'cyberpunk': ['Monokai', 'Dark+ (default dark)', 'Visual Studio Dark'],
            'nature': ['Quiet Light', 'Light+ (default light)', 'Solarized Light'],
            'space': ['Dark+ (default dark)', 'Visual Studio Dark', 'Monokai'],
            'minimal': ['Light+ (default light)', 'Quiet Light', 'Default Light+'],
            'retro': ['Monokai', 'Dark+ (default dark)', 'Visual Studio Dark']
        };

        // Try preferred theme first, then fallbacks
        const themesToTry = [preferredTheme, ...(fallbackThemes[presetName] || ['Dark+ (default dark)'])];
        
        // For now, just return the first theme (VS Code will handle if it doesn't exist)
        // In a future version, we could use vscode.extensions.all to check available themes
        return themesToTry[0];
    }

    private async updateBackgroundOpacity(opacity: number): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa');
        await config.update('background.opacity', opacity, vscode.ConfigurationTarget.Global);
    }

    private async updateFontSize(fontSize: number): Promise<void> {
        const editorConfig = vscode.workspace.getConfiguration('editor');
        await editorConfig.update('fontSize', fontSize, vscode.ConfigurationTarget.Global);
    }

    private async saveCustomSettings(settings: any): Promise<void> {
        await this.context.globalState.update('customThemeSettings', settings);
        
        const config = vscode.workspace.getConfiguration('codeSpa');
        await config.update('background.opacity', settings.opacity, vscode.ConfigurationTarget.Global);
        await config.update('theme.preset', 'custom', vscode.ConfigurationTarget.Global);

        const editorConfig = vscode.workspace.getConfiguration('editor');
        await editorConfig.update('fontSize', settings.fontSize, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage('💾 Custom theme settings saved!');
    }

    getCurrentPreset(): ThemePreset | null {
        const config = vscode.workspace.getConfiguration('codeSpa');
        const presetName = config.get('theme.preset', 'cyberpunk') as string;
        return this.presets.get(presetName) || null;
    }

    dispose(): void {
        if (this.customizationPanel) {
            this.customizationPanel.dispose();
        }
    }
} 