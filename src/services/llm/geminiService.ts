import { GoogleGenerativeAI } from '@google/generative-ai';
import * as vscode from 'vscode';
import { ProjectAnalysis } from '../analysis/projectAnalyzer';

export interface GeneratedTheme {
    name: string;
    description: string;
    colors: {
        // Base palette
        primary: string;        // Main branding color, for status bar, primary buttons.
        secondary: string;      // Supporting color, for inactive elements, section headers.
        accent: string;         // Call-to-action color, for highlights, active borders, cursor.

        // UI Backgrounds
        background: string;     // Main editor and UI background. Should be dark or light.
        surface: string;        // Background for UI surfaces like sidebars, panels. Slightly different from main background.

        // Text
        text: string;           // Primary text color on background/surface.
        textSecondary: string;  // Muted text color for descriptions, inactive text.
    };
    reasoning: string;
}

export class GeminiService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor() {
        this.initializeAPI();
    }

    private initializeAPI(): void {
        const config = vscode.workspace.getConfiguration('codeSpa');
        const apiKey = config.get<string>('geminiApiKey');
        
        if (apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                // Use Gemini 2.0 Flash (free model)
                this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
                console.log('🤖 Gemini API initialized successfully');
            } catch (error) {
                console.error('Failed to initialize Gemini API:', error);
                vscode.window.showErrorMessage('Failed to initialize Gemini API. Please check your API key.');
            }
        } else {
            console.log('⚠️ No Gemini API key found in settings');
        }
    }

    public isConfigured(): boolean {
        return this.genAI !== null && this.model !== null;
    }

    public async generateTheme(projectAnalysis: ProjectAnalysis): Promise<GeneratedTheme> {
        if (!this.isConfigured()) {
            throw new Error('Gemini API not configured. Please set your API key in settings.');
        }

        const prompt = this.buildPrompt(projectAnalysis);
        
        try {
            console.log('🎨 Generating theme with Gemini...');
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return this.parseThemeResponse(text);
        } catch (error) {
            console.error('Error generating theme:', error);
            throw new Error(`Failed to generate theme: ${error}`);
        }
    }

    private buildPrompt(analysis: ProjectAnalysis): string {
        const languageList = Object.entries(analysis.languages)
            .filter(([_, percentage]) => percentage > 5) // Only include languages > 5%
            .map(([lang, percentage]) => `${lang} (${percentage}%)`)
            .join(', ');

        const frameworkList = analysis.frameworks.length > 0 
            ? analysis.frameworks.join(', ') 
            : 'None detected';

        const readmeSnippet = analysis.readmeContent 
            ? analysis.readmeContent.substring(0, 500) // Limit to 500 chars
            : 'No README found';

        return `You are a creative theme designer for a VS Code extension called "Code Spa". Based on the project analysis below, generate a unique, aesthetically pleasing theme that matches the project's vibe and technology stack.

PROJECT ANALYSIS:
- Project Type: ${analysis.projectType}
- Primary Language: ${analysis.primaryLanguage}
- Languages Used: ${languageList}
- Frameworks/Tools: ${frameworkList}
- Project Complexity: ${analysis.complexity}
- Total Files: ${analysis.totalFiles}

README EXCERPT:
${readmeSnippet}

INSTRUCTIONS:
1.  **Analyze the context**: Based on the project's languages, frameworks, and purpose, determine a fitting aesthetic (e.g., "futuristic & sleek" for a Rust project, "warm & organic" for a Python data science library, "energetic & bold" for a web game).
2.  **Create a Theme Name**: A catchy, memorable name for the theme.
3.  **Generate a Color Palette**: Provide a JSON object with 7 semantic colors. Adhere to color theory and ensure good contrast for readability.
    *   **primary**: The main branding color. Used for the status bar, primary buttons.
    *   **secondary**: A supporting color for less important elements like inactive tabs or section headers.
    *   **accent**: A bright, call-to-action color for highlights, selections, borders, and the cursor.
    *   **background**: The main editor background. Should be a dark or light neutral.
    *   **surface**: The background for UI elements like the sidebar and panels. Should be close to, but distinct from, the main background.
    *   **text**: The main text color. Must have high contrast with 'background' and 'surface'.
    *   **textSecondary**: A muted text color for comments, and less important information.
4.  **Write a Description**: A one-liner (max 6 words) for the UI.
5.  **Provide Reasoning**: Briefly explain your choices.

RESPONSE FORMAT (JSON only, no markdown):
{
    "name": "Theme Name",
    "description": "Short one-liner description",
    "colors": {
        "primary": "#hexcolor",
        "secondary": "#hexcolor", 
        "accent": "#hexcolor",
        "background": "#hexcolor",
        "surface": "#hexcolor",
        "text": "#hexcolor",
        "textSecondary": "#hexcolor"
    },
    "reasoning": "Brief explanation of the theme's inspiration and color choices."
}

Generate a creative, unique theme that would inspire developers working on this type of project.`;
    }

    private parseThemeResponse(response: string): GeneratedTheme {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate the response structure
            if (!parsed.name || !parsed.description || !parsed.colors || !parsed.reasoning) {
                throw new Error('Invalid response structure from LLM');
            }

            const requiredColors = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'textSecondary'];
            for (const color of requiredColors) {
                if (!parsed.colors[color]) {
                    throw new Error(`Missing required color in response: ${color}`);
                }
            }

            // Validate hex colors
            const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
            for (const color of requiredColors) {
                if (!hexColorRegex.test(parsed.colors[color])) {
                    throw new Error(`Invalid hex color format for ${color}: ${parsed.colors[color]}`);
                }
            }

            return parsed;

        } catch (error) {
            console.error('Error parsing theme response:', error);
            console.log('Raw response:', response);
            
            // Fallback theme based on project type
            return this.generateFallbackTheme(response);
        }
    }

    private generateFallbackTheme(originalResponse: string): GeneratedTheme {
        // Simple fallback themes based on common patterns
        const fallbackThemes: GeneratedTheme[] = [
            {
                name: "AI Generated Fusion",
                description: "Modern theme for your project",
                colors: { 
                    primary: "#6366f1", 
                    secondary: "#8b5cf6", 
                    accent: "#06b6d4",
                    background: "#111827",
                    surface: "#1f2937",
                    text: "#e5e7eb",
                    textSecondary: "#9ca3af"
                },
                reasoning: "Generated as a fallback when parsing failed"
            },
            {
                name: "Code Harmony",
                description: "Balanced colors for focus",
                colors: { 
                    primary: "#10b981", 
                    secondary: "#3b82f6", 
                    accent: "#f59e0b",
                    background: "#18181b",
                    surface: "#27272a",
                    text: "#f4f4f5",
                    textSecondary: "#a1a1aa"
                },
                reasoning: "Fallback theme with harmonious colors"
            }
        ];

        let randomTheme = fallbackThemes[Math.floor(Math.random() * fallbackThemes.length)];
        
        // Try to extract any useful info from the original response
        if (originalResponse.toLowerCase().includes('react')) {
            randomTheme = {
                name: "React Inspired",
                description: "Vibrant and modern React theme",
                colors: { 
                    primary: "#61dafb", 
                    secondary: "#20232a", 
                    accent: "#f7df1e", // JS yellow
                    background: "#282c34",
                    surface: "#20232a",
                    text: "#ffffff",
                    textSecondary: "#61dafb"
                },
                reasoning: "Fallback inspired by React's official colors."
            };
        } else if (originalResponse.toLowerCase().includes('python')) {
            randomTheme = {
                name: "Pythonic Dark",
                description: "A theme for the discerning Pythonista",
                colors: { 
                    primary: "#3776ab", // Python blue
                    secondary: "#ffd43b", // Python yellow
                    accent: "#306998",
                    background: "#1e1e1e",
                    surface: "#252526",
                    text: "#d4d4d4",
                    textSecondary: "#8c8c8c"
                },
                reasoning: "Fallback inspired by Python's official colors."
            };
        }

        return randomTheme;
    }

    public async testConnection(): Promise<boolean> {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            const result = await this.model.generateContent("Hello! Please respond with 'OK' if you can hear me.");
            const response = await result.response;
            const text = response.text();
            return text.toLowerCase().includes('ok');
        } catch (error) {
            console.error('Gemini connection test failed:', error);
            return false;
        }
    }

    public refreshAPIKey(): void {
        this.initializeAPI();
    }
} 