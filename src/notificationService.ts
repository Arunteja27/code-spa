import * as vscode from 'vscode';

export interface NotificationConfig {
    extensionActivation: boolean;
    backgroundChanges: boolean;
    themeChanges: boolean;
    spotifyConnection: boolean;
    musicPlayback: boolean;
    projectAnalysis: boolean;
    errors: boolean;
    warnings: boolean;
}

export class NotificationService {
    private static instance: NotificationService;
    private config: NotificationConfig;

    private constructor() {
        this.config = this.loadConfig();
    }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    private loadConfig(): NotificationConfig {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        return {
            extensionActivation: config.get('extensionActivation', true),
            backgroundChanges: config.get('backgroundChanges', true),
            themeChanges: config.get('themeChanges', true),
            spotifyConnection: config.get('spotifyConnection', true),
            musicPlayback: config.get('musicPlayback', true),
            projectAnalysis: config.get('projectAnalysis', true),
            errors: config.get('errors', true),
            warnings: config.get('warnings', true)
        };
    }

    public async updateConfig(updates: Partial<NotificationConfig>): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        
        for (const [key, value] of Object.entries(updates)) {
            await config.update(key, value, vscode.ConfigurationTarget.Global);
        }
        
        this.config = { ...this.config, ...updates };
    }

    public refreshConfig(): void {
        this.config = this.loadConfig();
    }

    public getConfig(): NotificationConfig {
        // Always return fresh config from VS Code settings
        this.refreshConfig();
        return { ...this.config };
    }

    // Notification methods for different categories
    public showExtensionActivation(message: string): Thenable<string | undefined> {
        if (this.getConfig().extensionActivation) {
            return vscode.window.showInformationMessage(message);
        }
        return Promise.resolve(undefined);
    }

    public showBackgroundChange(message: string): Thenable<string | undefined> {
        if (this.getConfig().backgroundChanges) {
            return vscode.window.showInformationMessage(message);
        }
        return Promise.resolve(undefined);
    }

    public showThemeChange(message: string): Thenable<string | undefined> {
        if (this.getConfig().themeChanges) {
            return vscode.window.showInformationMessage(message);
        }
        return Promise.resolve(undefined);
    }

    public showSpotifyConnection(message: string): Thenable<string | undefined> {
        if (this.getConfig().spotifyConnection) {
            return vscode.window.showInformationMessage(message);
        }
        return Promise.resolve(undefined);
    }

    public showMusicPlayback(message: string): Thenable<string | undefined> {
        if (this.getConfig().musicPlayback) {
            return vscode.window.showInformationMessage(message);
        }
        return Promise.resolve(undefined);
    }

    public showProjectAnalysis(message: string): Thenable<string | undefined> {
        if (this.getConfig().projectAnalysis) {
            return vscode.window.showInformationMessage(message);
        }
        return Promise.resolve(undefined);
    }

    public showError(message: string): Thenable<string | undefined> {
        if (this.getConfig().errors) {
            return vscode.window.showErrorMessage(message);
        }
        return Promise.resolve(undefined);
    }

    public showWarning(message: string): Thenable<string | undefined> {
        if (this.getConfig().warnings) {
            return vscode.window.showWarningMessage(message);
        }
        return Promise.resolve(undefined);
    }

    // Toggle methods for individual notification types
    public async toggleExtensionActivation(): Promise<boolean> {
        const currentConfig = this.getConfig();
        const newValue = !currentConfig.extensionActivation;
        await this.updateConfig({ extensionActivation: newValue });
        return newValue;
    }

    public async toggleBackgroundChanges(): Promise<boolean> {
        const currentConfig = this.getConfig();
        const newValue = !currentConfig.backgroundChanges;
        await this.updateConfig({ backgroundChanges: newValue });
        return newValue;
    }

    public async toggleThemeChanges(): Promise<boolean> {
        const currentConfig = this.getConfig();
        const newValue = !currentConfig.themeChanges;
        await this.updateConfig({ themeChanges: newValue });
        return newValue;
    }

    public async toggleSpotifyConnection(): Promise<boolean> {
        const currentConfig = this.getConfig();
        const newValue = !currentConfig.spotifyConnection;
        await this.updateConfig({ spotifyConnection: newValue });
        return newValue;
    }

    public async toggleMusicPlayback(): Promise<boolean> {
        const currentConfig = this.getConfig();
        const newValue = !currentConfig.musicPlayback;
        await this.updateConfig({ musicPlayback: newValue });
        return newValue;
    }

    public async toggleProjectAnalysis(): Promise<boolean> {
        const currentConfig = this.getConfig();
        const newValue = !currentConfig.projectAnalysis;
        await this.updateConfig({ projectAnalysis: newValue });
        return newValue;
    }

    public async toggleErrors(): Promise<boolean> {
        const currentConfig = this.getConfig();
        const newValue = !currentConfig.errors;
        await this.updateConfig({ errors: newValue });
        return newValue;
    }

    public async toggleWarnings(): Promise<boolean> {
        const currentConfig = this.getConfig();
        const newValue = !currentConfig.warnings;
        await this.updateConfig({ warnings: newValue });
        return newValue;
    }

    public async toggleAllNotifications(): Promise<boolean> {
        const currentConfig = this.getConfig();
        const allEnabled = Object.values(currentConfig).every(value => value);
        const newValue = !allEnabled;
        
        await this.updateConfig({
            extensionActivation: newValue,
            backgroundChanges: newValue,
            themeChanges: newValue,
            spotifyConnection: newValue,
            musicPlayback: newValue,
            projectAnalysis: newValue,
            errors: newValue,
            warnings: newValue
        });
        
        return newValue;
    }
} 