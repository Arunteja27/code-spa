import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectAnalysis } from '../analysis/projectAnalyzer';

export class BackgroundController {
    private context: vscode.ExtensionContext;
    private updateInterval: NodeJS.Timeout | null = null;
    private currentBackgroundIndex: number = 0;
    private isEnabled: boolean = false;

    private backgroundCollections: { [key: string]: string[] } = {
        cyberpunk: [
            'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop'
        ],
        nature: [
            'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=1920&h=1080&fit=crop'
        ],
        space: [
            'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&h=1080&fit=crop'
        ],
        minimal: [
            'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=1920&h=1080&fit=crop'
        ],
        retro: [
            'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop'
        ],
        ocean: [
            'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop'
        ]
    };

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async enable(): Promise<void> {
        if (this.isEnabled) return;
        
        this.isEnabled = true;
        
        await this.setRandomBackground();
        
        this.updateInterval = setInterval(() => {
            this.setRandomBackground();
        }, 300000);
    }

    async disable(): Promise<void> {
        this.isEnabled = false;
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        await this.removeBackground();
    }

    private async removeBackground(): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        await config.update('workbench.colorCustomizations', {
            ...config.get('workbench.colorCustomizations', {}),
            'editor.background': undefined
        }, vscode.ConfigurationTarget.Global);
    }

    async updateBackgroundFromContext(analysis: ProjectAnalysis): Promise<void> {
        if (!this.isEnabled) return;

        const themeMap: { [key: string]: string } = {
            'frontend': 'cyberpunk',
            'backend': 'minimal',
            'mobile': 'space',
            'desktop': 'retro',
            'game': 'cyberpunk',
            'data-science': 'nature',
            'devops': 'minimal',
            'web': 'cyberpunk',
            'enterprise': 'minimal',
            'systems': 'retro'
        };

        const backgroundCategory = themeMap[analysis.projectType] || 'cyberpunk';
        await this.setBackgroundFromCategory(backgroundCategory);
    }

    async onFileChanged(document: vscode.TextDocument): Promise<void> {
        if (!this.isEnabled) return;
        
        if (Math.random() < 0.1) {
            await this.setRandomBackground();
        }
    }

    private async setRandomBackground(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa');
        const themePreset = config.get('theme.preset', 'cyberpunk') as string;
        
        await this.setBackgroundFromCategory(themePreset);
    }

    private async setBackgroundFromCategory(category: string): Promise<void> {
        const backgrounds = this.backgroundCollections[category] || this.backgroundCollections.cyberpunk;
        const backgroundUrl = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        
        await this.applyBackground(backgroundUrl);
    }

    private async applyBackground(imageUrl: string): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        const opacity = vscode.workspace.getConfiguration('codeSpa').get('background.opacity', 0.15);
        
        const customizations = {
            ...config.get('workbench.colorCustomizations', {}),
            'editor.background': `url(${imageUrl})`,
            'editor.backgroundOpacity': opacity
        };

        await config.update('workbench.colorCustomizations', customizations, vscode.ConfigurationTarget.Global);
    }

    async updateOpacity(opacity: number): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa');
        await config.update('background.opacity', opacity, vscode.ConfigurationTarget.Global);
        
        if (this.isEnabled) {
            await this.setRandomBackground();
        }
    }

    dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
} 