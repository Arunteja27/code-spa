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
        this.refreshConfig();
        return { ...this.config };
    }
    public showExtensionActivation(message: string): void {
        if (this.getConfig().extensionActivation) {
            vscode.window.showInformationMessage(message);
        }
    }

    public showBackgroundChange(message: string): void {
        if (this.getConfig().backgroundChanges) {
            vscode.window.showInformationMessage(message);
        }
    }

    public showThemeChange(message: string): void {
        if (this.getConfig().themeChanges) {
            vscode.window.showInformationMessage(message);
        }
    }

    public showSpotifyConnection(message: string): void {
        if (this.getConfig().spotifyConnection) {
            vscode.window.showInformationMessage(message);
        }
    }

    public showMusicPlayback(message: string): void {
        if (this.getConfig().musicPlayback) {
            vscode.window.showInformationMessage(message);
        }
    }

    public showProjectAnalysis(message: string): void {
        if (this.getConfig().projectAnalysis) {
            vscode.window.showInformationMessage(message);
        }
    }

    public showError(message: string): void {
        if (this.getConfig().errors) {
            vscode.window.showErrorMessage(message);
        }
    }

    public showWarning(message: string): void {
        if (this.getConfig().warnings) {
            vscode.window.showWarningMessage(message);
        }
    }

    public async toggleExtensionActivation(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        const current = config.get('extensionActivation', true);
        await config.update('extensionActivation', !current, vscode.ConfigurationTarget.Global);
    }

    public async toggleBackgroundChanges(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        const current = config.get('backgroundChanges', true);
        await config.update('backgroundChanges', !current, vscode.ConfigurationTarget.Global);
    }

    public async toggleThemeChanges(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        const current = config.get('themeChanges', true);
        await config.update('themeChanges', !current, vscode.ConfigurationTarget.Global);
    }

    public async toggleSpotifyConnection(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        const current = config.get('spotifyConnection', true);
        await config.update('spotifyConnection', !current, vscode.ConfigurationTarget.Global);
    }

    public async toggleMusicPlayback(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        const current = config.get('musicPlayback', true);
        await config.update('musicPlayback', !current, vscode.ConfigurationTarget.Global);
    }

    public async toggleProjectAnalysis(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        const current = config.get('projectAnalysis', true);
        await config.update('projectAnalysis', !current, vscode.ConfigurationTarget.Global);
    }

    public async toggleErrors(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        const current = config.get('errors', true);
        await config.update('errors', !current, vscode.ConfigurationTarget.Global);
    }

    public async toggleWarnings(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa.notifications');
        const current = config.get('warnings', true);
        await config.update('warnings', !current, vscode.ConfigurationTarget.Global);
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

    public showNotificationToggle(message: string): void {
        if (this.getConfig().extensionActivation) {
            vscode.window.showInformationMessage(message);
        }
    }
} 