import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectContext {
    projectType: string;
    languages: string[];
    frameworks: string[];
    mood: string;
    keywords: string[];
}

export class BackgroundController {
    private context: vscode.ExtensionContext;
    private isEnabled: boolean = false;
    private currentBackground: string | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private backgroundImages: Map<string, string[]> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeBackgroundDatabase();
    }

    private initializeBackgroundDatabase() {
        // Pre-defined background collections for different project types
        this.backgroundImages.set('react', [
            'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=1920&h=1080&fit=crop'
        ]);

        this.backgroundImages.set('python', [
            'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop'
        ]);

        this.backgroundImages.set('javascript', [
            'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1592609931095-54a2168ae893?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1920&h=1080&fit=crop'
        ]);

        this.backgroundImages.set('cyberpunk', [
            'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1614851099175-e5b30eb908c2?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1544256718-3bcf237f3974?w=1920&h=1080&fit=crop'
        ]);

        this.backgroundImages.set('nature', [
            'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop'
        ]);

        this.backgroundImages.set('space', [
            'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1517260739858-c0e1473b0016?w=1920&h=1080&fit=crop'
        ]);

        this.backgroundImages.set('minimal', [
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1553356084-58ef4a67b2a7?w=1920&h=1080&fit=crop',
            'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&h=1080&fit=crop'
        ]);

        this.backgroundImages.set('default', [
            'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=1920&h=1080&fit=crop'
        ]);
    }

    async enable(): Promise<void> {
        if (this.isEnabled) return;

        this.isEnabled = true;
        console.log('🎨 Background controller enabled');

        // Set initial background
        await this.updateBackground();

        // Set up periodic updates
        const config = vscode.workspace.getConfiguration('codeSpa');
        const interval = config.get('background.updateInterval', 300000); // 5 minutes default
        
        this.updateInterval = setInterval(async () => {
            await this.updateBackground();
        }, interval);
    }

    async disable(): Promise<void> {
        if (!this.isEnabled) return;

        this.isEnabled = false;
        console.log('🎨 Background controller disabled');

        // Clear update interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // Remove current background
        await this.removeBackground();
    }

    async updateBackgroundFromContext(context: ProjectContext): Promise<void> {
        if (!this.isEnabled) return;

        console.log(`🎨 Updating background for ${context.projectType} project`);
        
        let backgroundCategory = context.projectType.toLowerCase();
        
        // Map project types to background categories
        if (context.languages.includes('javascript') || context.languages.includes('typescript')) {
            backgroundCategory = 'javascript';
        } else if (context.languages.includes('python')) {
            backgroundCategory = 'python';
        } else if (context.frameworks.some(f => f.toLowerCase().includes('react'))) {
            backgroundCategory = 'react';
        }

        // Apply theme-based background if specified
        const config = vscode.workspace.getConfiguration('codeSpa');
        const themePreset = config.get('theme.preset', 'cyberpunk') as string;
        if (themePreset !== 'custom') {
            backgroundCategory = themePreset;
        }

        await this.setBackgroundFromCategory(backgroundCategory);
    }

    async onFileChanged(document: vscode.TextDocument): Promise<void> {
        if (!this.isEnabled) return;

        // Update background based on file type occasionally
        const fileExtension = path.extname(document.fileName).toLowerCase();
        const shouldUpdate = Math.random() < 0.1; // 10% chance to update on file change

        if (shouldUpdate) {
            let category = 'default';
            
            switch (fileExtension) {
                case '.js':
                case '.ts':
                case '.jsx':
                case '.tsx':
                    category = 'javascript';
                    break;
                case '.py':
                    category = 'python';
                    break;
                case '.css':
                case '.scss':
                case '.sass':
                    category = 'minimal';
                    break;
                default:
                    category = 'default';
            }

            await this.setBackgroundFromCategory(category);
        }
    }

    async updateOpacity(opacity: number): Promise<void> {
        if (!this.isEnabled) return;

        const cssContent = this.generateBackgroundCSS(this.currentBackground, opacity);
        await this.applyCSSToWorkbench(cssContent);
    }

    private async updateBackground(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeSpa');
        const themePreset = config.get('theme.preset', 'cyberpunk');
        
        await this.setBackgroundFromCategory(themePreset as string);
    }

    private async setBackgroundFromCategory(category: string): Promise<void> {
        const images = this.backgroundImages.get(category) || this.backgroundImages.get('default')!;
        const randomImage = images[Math.floor(Math.random() * images.length)];
        
        this.currentBackground = randomImage;
        
        const config = vscode.workspace.getConfiguration('codeSpa');
        const opacity = config.get('background.opacity', 0.15);
        
        const cssContent = this.generateBackgroundCSS(randomImage, opacity);
        await this.applyCSSToWorkbench(cssContent);
        
        console.log(`🎨 Applied ${category} background: ${randomImage}`);
    }

    private generateBackgroundCSS(imageUrl: string | null, opacity: number): string {
        if (!imageUrl) return '';

        return `
            .monaco-workbench {
                background-image: url('${imageUrl}') !important;
                background-size: cover !important;
                background-position: center !important;
                background-repeat: no-repeat !important;
                background-attachment: fixed !important;
            }
            
            .monaco-workbench::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, ${1 - opacity}) !important;
                z-index: -1;
                pointer-events: none;
            }
            
            .editor-container {
                background: rgba(0, 0, 0, 0.1) !important;
                backdrop-filter: blur(1px) !important;
            }
        `;
    }

    private async applyCSSToWorkbench(cssContent: string): Promise<void> {
        try {
            const workbenchConfigPath = this.getWorkbenchConfigPath();
            if (!workbenchConfigPath) {
                console.warn('Could not find workbench configuration path');
                return;
            }

            await this.context.globalState.update('backgroundCSS', cssContent);
            
            vscode.window.showInformationMessage('🎨 Background updated!', { modal: false });
            
        } catch (error) {
            console.error('Error applying background CSS:', error);
        }
    }

    private async removeBackground(): Promise<void> {
        await this.context.globalState.update('backgroundCSS', '');
        this.currentBackground = null;
    }

    private getWorkbenchConfigPath(): string | null {
        return null;
    }

    dispose(): void {
        this.disable();
    }
} 