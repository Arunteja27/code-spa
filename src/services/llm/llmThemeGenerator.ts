import * as vscode from 'vscode';
import { ProjectAnalyzer, ProjectAnalysis } from '../analysis/projectAnalyzer';
import { GeminiService, GeneratedTheme } from './geminiService';

export interface LLMThemeResult {
    success: boolean;
    theme?: GeneratedTheme;
    projectAnalysis?: ProjectAnalysis;
    error?: string;
}

export class LLMThemeGenerator {
    private projectAnalyzer: ProjectAnalyzer;
    private geminiService: GeminiService;

    constructor() {
        this.projectAnalyzer = new ProjectAnalyzer();
        this.geminiService = new GeminiService();
    }

    public async generateThemeForCurrentProject(): Promise<LLMThemeResult> {
        try {
            // Check if Gemini is configured
            if (!this.geminiService.isConfigured()) {
                return {
                    success: false,
                    error: 'Gemini API not configured. Please set your API key in Code Spa settings.'
                };
            }

            // Show progress to user
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🎨 Generating AI Theme",
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 20, message: "Analyzing project structure..." });
                
                // Analyze the current project
                const projectAnalysis = await this.projectAnalyzer.analyzeCurrentProject();
                
                progress.report({ increment: 40, message: "Sending data to Gemini AI..." });
                
                // Generate theme using Gemini
                const generatedTheme = await this.geminiService.generateTheme(projectAnalysis);
                
                progress.report({ increment: 40, message: "Theme generated successfully!" });
                
                return {
                    success: true,
                    theme: generatedTheme,
                    projectAnalysis: projectAnalysis
                };
            });

        } catch (error) {
            console.error('LLM Theme Generation failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    public async testGeminiConnection(): Promise<boolean> {
        return await this.geminiService.testConnection();
    }

    public refreshGeminiAPI(): void {
        this.geminiService.refreshAPIKey();
    }

    public isGeminiConfigured(): boolean {
        return this.geminiService.isConfigured();
    }

    public async analyzeCurrentProject(): Promise<ProjectAnalysis | null> {
        try {
            return await this.projectAnalyzer.analyzeCurrentProject();
        } catch (error) {
            console.error('Project analysis failed:', error);
            return null;
        }
    }
} 