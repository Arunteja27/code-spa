import * as vscode from 'vscode';
import { WebviewUtils } from '../../webview/WebviewUtils';

interface ThemePreset {
    name: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
    };
    vsCodeTheme: string;
}

export class UICustomizer {
    private context: vscode.ExtensionContext;
    private webviewPanel: vscode.WebviewPanel | null = null;
    private webviewUtils: WebviewUtils;

    private themePresets: Map<string, ThemePreset> = new Map([
        ['cyberpunk', {
            name: 'Cyberpunk',
            colors: {
                primary: '#ff0080',
                secondary: '#00ffff',
                accent: '#ffff00',
                background: '#0a0a0a',
                text: '#ffffff'
            },
            vsCodeTheme: 'Monokai'
        }],
        ['nature', {
            name: 'Nature',
            colors: {
                primary: '#4a7c59',
                secondary: '#8fbc8f',
                accent: '#98fb98',
                background: '#2d4a2d',
                text: '#f0fff0'
            },
            vsCodeTheme: 'Default Dark+'
        }],
        ['space', {
            name: 'Space',
            colors: {
                primary: '#4169e1',
                secondary: '#9370db',
                accent: '#00bfff',
                background: '#0c0c1e',
                text: '#e6e6fa'
            },
            vsCodeTheme: 'Default Dark+'
        }],
        ['minimal', {
            name: 'Minimal',
            colors: {
                primary: '#333333',
                secondary: '#666666',
                accent: '#999999',
                background: '#ffffff',
                text: '#000000'
            },
            vsCodeTheme: 'Default Light+'
        }],
        ['retro', {
            name: 'Retro',
            colors: {
                primary: '#ff6b35',
                secondary: '#f7931e',
                accent: '#ffcc02',
                background: '#2c1810',
                text: '#fff8dc'
            },
            vsCodeTheme: 'Monokai'
        }],
        ['ocean', {
            name: 'Ocean',
            colors: {
                primary: '#006994',
                secondary: '#47b5ff',
                accent: '#06ffa5',
                background: '#0f3460',
                text: '#e1f5fe'
            },
            vsCodeTheme: 'Default Dark+'
        }]
    ]);

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.webviewUtils = new WebviewUtils(context);
    }

    async applyPreset(presetName: string): Promise<void> {
        const preset = this.themePresets.get(presetName);
        if (!preset) {
            vscode.window.showErrorMessage(`Theme preset "${presetName}" not found.`);
            return;
        }

        try {
            const config = vscode.workspace.getConfiguration();
            
            await config.update('codeSpa.theme.preset', presetName, vscode.ConfigurationTarget.Global);
            
            await this.applyVSCodeTheme(preset.vsCodeTheme);
            
            await this.applyColorCustomizations(preset);
            
            vscode.window.showInformationMessage(`🎨 Applied ${preset.name} theme!`);
        } catch (error) {
            console.error('Failed to apply theme preset:', error);
            vscode.window.showErrorMessage('Failed to apply theme. Please try again.');
        }
    }

    showCustomizationPanel(): void {
        if (this.webviewPanel) {
            this.webviewPanel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.webviewPanel = vscode.window.createWebviewPanel(
            'uiCustomizer',
            '🎨 Code Spa Theme Customizer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this.context.extensionUri],
                retainContextWhenHidden: true
            }
        );

        this.webviewPanel.webview.html = this.getCustomizerHTML();

        this.webviewPanel.webview.onDidReceiveMessage(
            message => {
                this.handleWebviewMessage(message);
            },
            undefined,
            this.context.subscriptions
        );

        this.webviewPanel.onDidDispose(
            () => {
                this.webviewPanel = null;
            },
            null,
            this.context.subscriptions
        );
    }

    private getCustomizerHTML(): string {
        const content = this.getCustomizerContent();
        
        return this.webviewUtils.loadHtmlTemplate(
            this.webviewPanel!.webview,
            'ui-customizer',
            content
        );
    }

    private getCustomizerContent(): string {
        const config = vscode.workspace.getConfiguration('codeSpa');
        const currentPreset = config.get('theme.preset', 'cyberpunk');

        const presetOptions = Array.from(this.themePresets.entries()).map(([key, preset]) => {
            const isSelected = key === currentPreset;
            return `
                <div class="preset-option ${isSelected ? 'selected' : ''}" onclick="selectPreset('${key}')">
                    <div class="preset-preview">
                        <div class="color-bar" style="background: ${preset.colors.primary}"></div>
                        <div class="color-bar" style="background: ${preset.colors.secondary}"></div>
                        <div class="color-bar" style="background: ${preset.colors.accent}"></div>
                    </div>
                    <div class="preset-name">${preset.name}</div>
                    ${isSelected ? '<div class="selected-indicator">✓</div>' : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="customizer-container">
                <div class="header">
                    <h1>🎨 Theme Customizer</h1>
                    <p>Personalize your Code Spa experience</p>
                </div>

                <div class="section">
                    <h2>Theme Presets</h2>
                    <div class="presets-grid">
                        ${presetOptions}
                    </div>
                </div>

                <div class="section">
                    <h2>Quick Actions</h2>
                    <div class="actions">
                        <button class="action-btn" onclick="resetToDefault()">
                            🔄 Reset to Default
                        </button>
                        <button class="action-btn" onclick="exportSettings()">
                            📤 Export Settings
                        </button>
                        <button class="action-btn" onclick="importSettings()">
                            📥 Import Settings
                        </button>
                    </div>
                </div>

                <div class="section">
                    <h2>Advanced Settings</h2>
                    <div class="advanced-controls">
                        <div class="control-group">
                            <label>Background Opacity</label>
                            <input type="range" id="opacitySlider" min="0" max="100" value="15" 
                                   onchange="updateOpacity(this.value)">
                            <span id="opacityValue">15%</span>
                        </div>
                        
                        <div class="control-group">
                            <label>Animation Speed</label>
                            <select id="animationSpeed" onchange="updateAnimationSpeed(this.value)">
                                <option value="slow">Slow</option>
                                <option value="normal" selected>Normal</option>
                                <option value="fast">Fast</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2>Preview</h2>
                    <div class="theme-preview">
                        <div class="preview-editor">
                            <div class="preview-line">
                                <span class="preview-keyword">function</span>
                                <span class="preview-function">helloWorld</span>
                                <span class="preview-punctuation">()</span>
                                <span class="preview-punctuation">{</span>
                            </div>
                            <div class="preview-line">
                                <span class="preview-indent">  </span>
                                <span class="preview-keyword">console</span>
                                <span class="preview-punctuation">.</span>
                                <span class="preview-function">log</span>
                                <span class="preview-punctuation">(</span>
                                <span class="preview-string">"Hello, Code Spa!"</span>
                                <span class="preview-punctuation">);</span>
                            </div>
                            <div class="preview-line">
                                <span class="preview-punctuation">}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'selectPreset':
                await this.applyPreset(message.preset);
                this.updateWebview();
                break;
            case 'resetToDefault':
                await this.resetToDefault();
                break;
            case 'exportSettings':
                await this.exportSettings();
                break;
            case 'importSettings':
                await this.importSettings();
                break;
            case 'updateOpacity':
                await this.updateOpacity(message.value);
                break;
            case 'updateAnimationSpeed':
                await this.updateAnimationSpeed(message.value);
                break;
        }
    }

    private async applyVSCodeTheme(themeName: string): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        
        const availableThemes = [
            'Default Dark+',
            'Default Light+',
            'Dark+ (default dark)',
            'Light+ (default light)',
            'Monokai',
            'Quiet Light',
            'Red',
            'Solarized Dark',
            'Solarized Light',
            'Tomorrow Night Blue'
        ];

        let targetTheme = themeName;
        if (!availableThemes.includes(themeName)) {
            targetTheme = 'Default Dark+';
        }

        try {
            await config.update('workbench.colorTheme', targetTheme, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to apply VS Code theme:', error);
        }
    }

    private async applyColorCustomizations(preset: ThemePreset): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        
        await config.update('workbench.colorCustomizations', {}, vscode.ConfigurationTarget.Global);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const colorCustomizations = {
            'activityBar.background': preset.colors.background,
            'activityBar.foreground': preset.colors.text,
            'activityBar.inactiveForeground': preset.colors.secondary,
            'activityBarBadge.background': preset.colors.primary,
            'activityBarBadge.foreground': preset.colors.background,
            
            'sideBar.background': preset.colors.background,
            'sideBar.foreground': preset.colors.text,
            'sideBarTitle.foreground': preset.colors.primary,
            'sideBarSectionHeader.background': preset.colors.secondary,
            'sideBarSectionHeader.foreground': preset.colors.text,
            
            'statusBar.background': preset.colors.primary,
            'statusBar.foreground': preset.colors.background,
            'statusBar.noFolderBackground': preset.colors.secondary,
            'statusBarItem.hoverBackground': preset.colors.accent,
            
            'editor.background': preset.colors.background,
            'editor.foreground': preset.colors.text,
            'editorCursor.foreground': preset.colors.accent,
            'editor.selectionBackground': preset.colors.secondary + '40',
            'editor.lineHighlightBackground': preset.colors.primary + '20',
            
            'terminal.background': preset.colors.background,
            'terminal.foreground': preset.colors.text,
            'terminal.ansiBlack': preset.colors.background,
            'terminal.ansiRed': preset.colors.primary,
            'terminal.ansiGreen': preset.colors.accent,
            'terminal.ansiYellow': preset.colors.secondary,
            'terminal.ansiBlue': preset.colors.primary,
            'terminal.ansiMagenta': preset.colors.accent,
            'terminal.ansiCyan': preset.colors.secondary,
            'terminal.ansiWhite': preset.colors.text
        };

        const themeSpecificColors = this.getThemeSpecificColors(preset);
        Object.assign(colorCustomizations, themeSpecificColors);

        await config.update('workbench.colorCustomizations', colorCustomizations, vscode.ConfigurationTarget.Global);
    }

    private getThemeSpecificColors(preset: ThemePreset): any {
        const baseColors: any = {};

        switch (preset.name.toLowerCase()) {
            case 'cyberpunk':
                return {
                    ...baseColors,
                    'titleBar.activeBackground': '#ff0080',
                    'titleBar.activeForeground': '#ffffff',
                    'tab.activeBackground': '#00ffff20',
                    'tab.activeForeground': '#00ffff',
                    'button.background': '#ff0080',
                    'button.hoverBackground': '#ff0080cc'
                };
            case 'nature':
                return {
                    ...baseColors,
                    'titleBar.activeBackground': '#4a7c59',
                    'titleBar.activeForeground': '#f0fff0',
                    'tab.activeBackground': '#8fbc8f20',
                    'tab.activeForeground': '#8fbc8f',
                    'button.background': '#4a7c59',
                    'button.hoverBackground': '#4a7c59cc'
                };
            case 'space':
                return {
                    ...baseColors,
                    'titleBar.activeBackground': '#4169e1',
                    'titleBar.activeForeground': '#e6e6fa',
                    'tab.activeBackground': '#9370db20',
                    'tab.activeForeground': '#9370db',
                    'button.background': '#4169e1',
                    'button.hoverBackground': '#4169e1cc'
                };
            case 'minimal':
                return {
                    ...baseColors,
                    'titleBar.activeBackground': '#333333',
                    'titleBar.activeForeground': '#ffffff',
                    'tab.activeBackground': '#66666620',
                    'tab.activeForeground': '#333333',
                    'button.background': '#333333',
                    'button.hoverBackground': '#333333cc'
                };
            case 'retro':
                return {
                    ...baseColors,
                    'titleBar.activeBackground': '#ff6b35',
                    'titleBar.activeForeground': '#fff8dc',
                    'tab.activeBackground': '#f7931e20',
                    'tab.activeForeground': '#f7931e',
                    'button.background': '#ff6b35',
                    'button.hoverBackground': '#ff6b35cc'
                };
            case 'ocean':
                return {
                    ...baseColors,
                    'titleBar.activeBackground': '#006994',
                    'titleBar.activeForeground': '#e1f5fe',
                    'tab.activeBackground': '#47b5ff20',
                    'tab.activeForeground': '#47b5ff',
                    'button.background': '#006994',
                    'button.hoverBackground': '#006994cc'
                };
            default:
                return baseColors;
        }
    }

    private getPreferredTheme(presetName: string): string {
        const themeMap: { [key: string]: string[] } = {
            'cyberpunk': ['Monokai', 'Default Dark+'],
            'nature': ['Default Dark+', 'Quiet Light'],
            'space': ['Default Dark+', 'Tomorrow Night Blue'],
            'minimal': ['Default Light+', 'Quiet Light'],
            'retro': ['Monokai', 'Default Dark+'],
            'ocean': ['Default Dark+', 'Solarized Dark']
        };

        const themes = themeMap[presetName] || ['Default Dark+'];
        
        return themes[0];
    }

    private async resetToDefault(): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        
        await config.update('workbench.colorTheme', undefined, vscode.ConfigurationTarget.Global);
        await config.update('workbench.colorCustomizations', {}, vscode.ConfigurationTarget.Global);
        await config.update('codeSpa.theme.preset', 'cyberpunk', vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('🔄 Theme settings reset to default!');
        this.updateWebview();
    }

    private async exportSettings(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa');
        const settings = {
            theme: {
                preset: config.get('theme.preset'),
                background: config.get('background'),
                animations: config.get('animations')
            }
        };

        const settingsJson = JSON.stringify(settings, null, 2);
        
        const document = await vscode.workspace.openTextDocument({
            content: settingsJson,
            language: 'json'
        });
        
        await vscode.window.showTextDocument(document);
        vscode.window.showInformationMessage('📤 Settings exported! Save this file to backup your configuration.');
    }

    private async importSettings(): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Import Settings',
            filters: {
                'JSON files': ['json'],
                'All files': ['*']
            }
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri[0]);
                const content = document.getText();
                const settings = JSON.parse(content);
                
                const config = vscode.workspace.getConfiguration('codeSpa');
                
                if (settings.theme) {
                    if (settings.theme.preset) {
                        await config.update('theme.preset', settings.theme.preset, vscode.ConfigurationTarget.Global);
                        await this.applyPreset(settings.theme.preset);
                    }
                    if (settings.theme.background) {
                        await config.update('background', settings.theme.background, vscode.ConfigurationTarget.Global);
                    }
                    if (settings.theme.animations) {
                        await config.update('animations', settings.theme.animations, vscode.ConfigurationTarget.Global);
                    }
                }
                
                vscode.window.showInformationMessage('📥 Settings imported successfully!');
                this.updateWebview();
            } catch (error) {
                vscode.window.showErrorMessage('❌ Failed to import settings. Please check the file format.');
            }
        }
    }

    private async updateOpacity(value: number): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa');
        await config.update('background.opacity', value / 100, vscode.ConfigurationTarget.Global);
        
        vscode.commands.executeCommand('code-spa.updateBackgroundOpacity', value / 100);
    }

    private async updateAnimationSpeed(speed: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa');
        await config.update('animations.speed', speed, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage(`🎬 Animation speed set to ${speed}`);
    }

    private updateWebview(): void {
        if (this.webviewPanel) {
            this.webviewPanel.webview.html = this.getCustomizerHTML();
        }
    }

    dispose(): void {
        if (this.webviewPanel) {
            this.webviewPanel.dispose();
        }
    }
} 