import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectAnalysis {
    projectType: string;
    primaryLanguage: string;
    frameworks: string[];
    fileCount: number;
    directoryCount: number;
    complexity: 'simple' | 'moderate' | 'complex';
    suggestedTheme: string;
}

export class ProjectAnalyzer {
    private readonly languageExtensions: { [key: string]: string[] } = {
        'JavaScript': ['.js', '.jsx', '.mjs'],
        'TypeScript': ['.ts', '.tsx'],
        'Python': ['.py', '.pyw'],
        'Java': ['.java'],
        'C#': ['.cs'],
        'C++': ['.cpp', '.cc', '.cxx', '.c++'],
        'C': ['.c', '.h'],
        'Go': ['.go'],
        'Rust': ['.rs'],
        'PHP': ['.php'],
        'Ruby': ['.rb'],
        'Swift': ['.swift'],
        'Kotlin': ['.kt'],
        'Dart': ['.dart'],
        'HTML': ['.html', '.htm'],
        'CSS': ['.css', '.scss', '.sass', '.less'],
        'JSON': ['.json'],
        'XML': ['.xml'],
        'YAML': ['.yml', '.yaml'],
        'Markdown': ['.md', '.markdown'],
        'Shell': ['.sh', '.bash', '.zsh'],
        'PowerShell': ['.ps1'],
        'SQL': ['.sql']
    };

    private readonly frameworkIndicators: { [key: string]: string[] } = {
        'React': ['package.json:react', 'src/App.jsx', 'src/App.tsx', 'public/index.html'],
        'Vue': ['package.json:vue', 'src/App.vue', 'vue.config.js'],
        'Angular': ['package.json:@angular', 'angular.json', 'src/app/app.module.ts'],
        'Svelte': ['package.json:svelte', 'src/App.svelte'],
        'Next.js': ['package.json:next', 'next.config.js', 'pages/'],
        'Nuxt.js': ['package.json:nuxt', 'nuxt.config.js'],
        'Express': ['package.json:express'],
        'Fastify': ['package.json:fastify'],
        'Koa': ['package.json:koa'],
        'NestJS': ['package.json:@nestjs'],
        'Django': ['manage.py', 'requirements.txt:Django'],
        'Flask': ['app.py', 'requirements.txt:Flask'],
        'FastAPI': ['main.py', 'requirements.txt:fastapi'],
        'Spring Boot': ['pom.xml:spring-boot', 'build.gradle:spring-boot'],
        'Laravel': ['composer.json:laravel', 'artisan'],
        'Rails': ['Gemfile:rails', 'config/application.rb'],
        'ASP.NET': ['*.csproj:Microsoft.AspNetCore'],
        'Electron': ['package.json:electron'],
        'React Native': ['package.json:react-native'],
        'Flutter': ['pubspec.yaml:flutter'],
        'Unity': ['Assets/', '*.unity'],
        'Unreal': ['*.uproject', 'Source/'],
        'Docker': ['Dockerfile', 'docker-compose.yml'],
        'Kubernetes': ['*.yaml:kind:', '*.yml:kind:']
    };

    async analyzeWorkspace(workspacePath: string): Promise<ProjectAnalysis | null> {
        try {
            const analysis: ProjectAnalysis = {
                projectType: 'unknown',
                primaryLanguage: 'unknown',
                frameworks: [],
                fileCount: 0,
                directoryCount: 0,
                complexity: 'simple',
                suggestedTheme: 'cyberpunk'
            };

            const stats = await this.gatherProjectStats(workspacePath);
            analysis.fileCount = stats.fileCount;
            analysis.directoryCount = stats.directoryCount;
            analysis.complexity = this.determineComplexity(stats);

            const languageStats = await this.analyzeLanguages(workspacePath);
            analysis.primaryLanguage = this.determinePrimaryLanguage(languageStats);

            analysis.frameworks = await this.detectFrameworks(workspacePath);
            analysis.projectType = this.determineProjectType(analysis.primaryLanguage, analysis.frameworks);
            analysis.suggestedTheme = this.suggestTheme(analysis);

            return analysis;
        } catch (error) {
            console.error('Project analysis failed:', error);
            return null;
        }
    }

    private async gatherProjectStats(workspacePath: string): Promise<{fileCount: number, directoryCount: number}> {
        let fileCount = 0;
        let directoryCount = 0;

        const traverse = async (dirPath: string): Promise<void> => {
            try {
                const items = await fs.promises.readdir(dirPath);
                
                for (const item of items) {
                    if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__') {
                        continue;
                    }

                    const itemPath = path.join(dirPath, item);
                    try {
                        const stat = await fs.promises.stat(itemPath);
                        
                        if (stat.isDirectory()) {
                            directoryCount++;
                            await traverse(itemPath);
                        } else {
                            fileCount++;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            } catch (error) {
                return;
            }
        };

        await traverse(workspacePath);
        return { fileCount, directoryCount };
    }

    private async analyzeLanguages(workspacePath: string): Promise<{ [language: string]: number }> {
        const languageStats: { [language: string]: number } = {};

        const analyzeFile = (filePath: string): void => {
            const ext = path.extname(filePath).toLowerCase();
            
            for (const [language, extensions] of Object.entries(this.languageExtensions)) {
                if (extensions.includes(ext)) {
                    languageStats[language] = (languageStats[language] || 0) + 1;
                    break;
                }
            }
        };

        const traverse = async (dirPath: string): Promise<void> => {
            try {
                const items = await fs.promises.readdir(dirPath);
                
                for (const item of items) {
                    if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__') {
                        continue;
                    }

                    const itemPath = path.join(dirPath, item);
                    try {
                        const stat = await fs.promises.stat(itemPath);
                        
                        if (stat.isDirectory()) {
                            await traverse(itemPath);
                        } else {
                            analyzeFile(itemPath);
                        }
                    } catch (error) {
                        continue;
                    }
                }
            } catch (error) {
                return;
            }
        };

        await traverse(workspacePath);
        return languageStats;
    }

    private determinePrimaryLanguage(languageStats: { [language: string]: number }): string {
        let maxCount = 0;
        let primaryLanguage = 'unknown';

        for (const [language, count] of Object.entries(languageStats)) {
            if (count > maxCount) {
                maxCount = count;
                primaryLanguage = language;
            }
        }

        return primaryLanguage;
    }

    private async detectFrameworks(workspacePath: string): Promise<string[]> {
        const detectedFrameworks: string[] = [];

        for (const [framework, indicators] of Object.entries(this.frameworkIndicators)) {
            for (const indicator of indicators) {
                if (indicator.includes(':')) {
                    const [fileName, content] = indicator.split(':');
                    const filePath = path.join(workspacePath, fileName);
                    
                    if (await this.fileExists(filePath)) {
                        try {
                            const fileContent = await fs.promises.readFile(filePath, 'utf8');
                            if (fileContent.includes(content)) {
                                detectedFrameworks.push(framework);
                                break;
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                } else {
                    const filePath = path.join(workspacePath, indicator);
                    if (await this.fileExists(filePath)) {
                        detectedFrameworks.push(framework);
                        break;
                    }
                }
            }
        }

        return detectedFrameworks;
    }

    private determineProjectType(primaryLanguage: string, frameworks: string[]): string {
        if (frameworks.length > 0) {
            if (frameworks.some(f => ['React', 'Vue', 'Angular', 'Svelte'].includes(f))) {
                return 'frontend';
            }
            if (frameworks.some(f => ['Express', 'Django', 'Flask', 'Spring Boot', 'Laravel', 'Rails'].includes(f))) {
                return 'backend';
            }
            if (frameworks.some(f => ['React Native', 'Flutter'].includes(f))) {
                return 'mobile';
            }
            if (frameworks.some(f => ['Electron'].includes(f))) {
                return 'desktop';
            }
            if (frameworks.some(f => ['Unity', 'Unreal'].includes(f))) {
                return 'game';
            }
            if (frameworks.some(f => ['Docker', 'Kubernetes'].includes(f))) {
                return 'devops';
            }
        }

        switch (primaryLanguage) {
            case 'JavaScript':
            case 'TypeScript':
                return 'web';
            case 'Python':
                return 'data-science';
            case 'Java':
            case 'C#':
                return 'enterprise';
            case 'C++':
            case 'C':
            case 'Rust':
                return 'systems';
            case 'Swift':
            case 'Kotlin':
                return 'mobile';
            case 'Go':
                return 'backend';
            default:
                return 'general';
        }
    }

    private determineComplexity(stats: {fileCount: number, directoryCount: number}): 'simple' | 'moderate' | 'complex' {
        const totalItems = stats.fileCount + stats.directoryCount;
        
        if (totalItems < 50) {
            return 'simple';
        } else if (totalItems < 200) {
            return 'moderate';
        } else {
            return 'complex';
        }
    }

    private suggestTheme(analysis: ProjectAnalysis): string {
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

        return themeMap[analysis.projectType] || 'cyberpunk';
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
} 