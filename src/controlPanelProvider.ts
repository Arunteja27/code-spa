import * as vscode from 'vscode';

export class ControlPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codeSpaControlPanel';
    private _view?: vscode.WebviewView;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            this.handleMessage(data);
        });
    }

    public show() {
        if (this._view) {
            this._view.show?.(true);
        } else {
            vscode.commands.executeCommand('workbench.view.extension.codeSpaPanel');
        }
    }

    private handleMessage(data: any) {
        switch (data.type) {
            case 'toggleBackground':
                vscode.commands.executeCommand('code-spa.toggleBackground');
                break;
            case 'openMusicPlayer':
                vscode.commands.executeCommand('code-spa.openMusicPlayer');
                break;
            case 'analyzeProject':
                vscode.commands.executeCommand('code-spa.analyzeProject');
                break;
            case 'customizeTheme':
                vscode.commands.executeCommand('code-spa.customizeTheme');
                break;
            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'codeSpa');
                break;
        }
    }

    private getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Spa Control Panel</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    margin: 0;
                    padding: 16px;
                    min-height: 100vh;
                }

                .control-panel {
                    background: rgba(0, 0, 0, 0.3);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }

                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }

                .logo {
                    font-size: 32px;
                    margin-bottom: 10px;
                }

                .tagline {
                    opacity: 0.8;
                    font-style: italic;
                    margin-bottom: 20px;
                }

                .status-indicator {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #00ff41;
                    margin-right: 8px;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .controls-section {
                    margin-bottom: 30px;
                }

                .section-title {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 15px;
                    color: #00d4ff;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .control-button {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    padding: 12px 16px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 14px;
                }

                .control-button:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: #00d4ff;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
                }

                .control-button:active {
                    transform: translateY(0);
                }

                .control-icon {
                    font-size: 16px;
                    width: 20px;
                    text-align: center;
                }

                .quick-stats {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                }

                .stat-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    font-size: 13px;
                }

                .stat-item:last-child {
                    margin-bottom: 0;
                }

                .stat-value {
                    color: #00ff41;
                    font-weight: bold;
                }

                .footer {
                    text-align: center;
                    opacity: 0.6;
                    font-size: 12px;
                    margin-top: 30px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding-top: 15px;
                }

                .theme-preview {
                    height: 40px;
                    border-radius: 6px;
                    background: linear-gradient(90deg, #00ff41, #00d4ff, #ff0080);
                    margin: 10px 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
                }
            </style>
        </head>
        <body>
            <div class="control-panel">
                <div class="header">
                    <div class="logo">🎨 CODE SPA</div>
                    <div class="tagline">Your Personal Coding Sanctuary</div>
                    <div>
                        <span class="status-indicator"></span>
                        <span>Active & Ready</span>
                    </div>
                </div>

                <div class="quick-stats">
                    <div class="stat-item">
                        <span>🖼️ Background:</span>
                        <span class="stat-value">Dynamic</span>
                    </div>
                    <div class="stat-item">
                        <span>🎵 Music:</span>
                        <span class="stat-value">Available</span>
                    </div>
                    <div class="stat-item">
                        <span>🎨 Theme:</span>
                        <span class="stat-value">Cyberpunk</span>
                    </div>
                    <div class="stat-item">
                        <span>🚀 Sessions:</span>
                        <span class="stat-value">∞</span>
                    </div>
                </div>

                <div class="controls-section">
                    <div class="section-title">
                        <span>🖼️</span>
                        <span>Background Control</span>
                    </div>
                    <button class="control-button" onclick="sendMessage('toggleBackground')">
                        <span class="control-icon">🔄</span>
                        <span>Toggle Dynamic Backgrounds</span>
                    </button>
                    <button class="control-button" onclick="sendMessage('analyzeProject')">
                        <span class="control-icon">🔍</span>
                        <span>Analyze Current Project</span>
                    </button>
                </div>

                <div class="controls-section">
                    <div class="section-title">
                        <span>🎵</span>
                        <span>Music & Audio</span>
                    </div>
                    <button class="control-button" onclick="sendMessage('openMusicPlayer')">
                        <span class="control-icon">🎶</span>
                        <span>Open Music Player</span>
                    </button>
                </div>

                <div class="controls-section">
                    <div class="section-title">
                        <span>🎨</span>
                        <span>Customization</span>
                    </div>
                    <button class="control-button" onclick="sendMessage('customizeTheme')">
                        <span class="control-icon">🌈</span>
                        <span>Customize Theme</span>
                    </button>
                    <div class="theme-preview">
                        Current Theme Preview
                    </div>
                </div>

                <div class="controls-section">
                    <div class="section-title">
                        <span>⚙️</span>
                        <span>Settings</span>
                    </div>
                    <button class="control-button" onclick="sendMessage('openSettings')">
                        <span class="control-icon">🔧</span>
                        <span>Open Settings</span>
                    </button>
                </div>

                <div class="footer">
                    <p>🌟 Transform your coding experience</p>
                    <p>Made with ❤️ for developers who dream in code</p>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function sendMessage(type) {
                    vscode.postMessage({ type: type });
                }

                // Add some interactive effects
                document.addEventListener('DOMContentLoaded', function() {
                    const buttons = document.querySelectorAll('.control-button');
                    buttons.forEach(button => {
                        button.addEventListener('click', function() {
                            this.style.transform = 'scale(0.95)';
                            setTimeout(() => {
                                this.style.transform = '';
                            }, 150);
                        });
                    });
                });
            </script>
        </body>
        </html>`;
    }
} 