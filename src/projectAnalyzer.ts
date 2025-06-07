import * as fs from 'fs';
import * as path from 'path';
import { ProjectContext } from './backgroundController';

interface FileStats {
    extension: string;
    count: number;
    totalLines: number;
}

export class ProjectAnalyzer {
    private readonly SUPPORTED_EXTENSIONS = [
        '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c',
        '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.dart',
        '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
        '.json', '.xml', '.yaml', '.yml', '.md', '.sql', '.sh', '.ps1'
    ];

    async analyzeWorkspace(workspacePath: string): Promise<ProjectContext | null> {
        try {
            console.log(`🔍 Analyzing workspace: ${workspacePath}`);

            const packageInfo = await this.analyzePackageFiles(workspacePath);
            const fileStats = await this.analyzeFileStructure(workspacePath);
            const languages = this.detectLanguages(fileStats);
            const frameworks = this.detectFrameworks(packageInfo, fileStats);
            const projectType = this.determineProjectType(languages, frameworks, packageInfo);
            const mood = this.determineMood(projectType, frameworks);
            const keywords = this.generateKeywords(projectType, languages, frameworks);

            const context: ProjectContext = {
                projectType,
                languages,
                frameworks,
                mood,
                keywords
            };

            console.log('🎨 Project analysis complete:', context);
            return context;

        } catch (error) {
            console.error('Error analyzing workspace:', error);
            return null;
        }
    }

    private async analyzePackageFiles(workspacePath: string): Promise<any> {
        const packageFiles = ['package.json', 'requirements.txt', 'Pipfile', 'pom.xml', 'build.gradle', 'Cargo.toml', 'go.mod'];
        const packageInfo: any = {};

        for (const file of packageFiles) {
            const filePath = path.join(workspacePath, file);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    if (file === 'package.json') {
                        packageInfo.packageJson = JSON.parse(content);
                    } else if (file === 'requirements.txt') {
                        packageInfo.pythonRequirements = content.split('\n').filter(line => line.trim());
                    } else if (file === 'Pipfile') {
                        packageInfo.pipfile = content;
                    } else if (file === 'pom.xml') {
                        packageInfo.maven = content;
                    } else if (file === 'build.gradle') {
                        packageInfo.gradle = content;
                    } else if (file === 'Cargo.toml') {
                        packageInfo.cargo = content;
                    } else if (file === 'go.mod') {
                        packageInfo.goMod = content;
                    }
                } catch (error) {
                    console.warn(`Could not parse ${file}:`, error);
                }
            }
        }

        return packageInfo;
    }

    private async analyzeFileStructure(workspacePath: string): Promise<FileStats[]> {
        const fileStats = new Map<string, FileStats>();
        
        await this.walkDirectory(workspacePath, (filePath: string) => {
            const ext = path.extname(filePath).toLowerCase();
            if (this.SUPPORTED_EXTENSIONS.includes(ext)) {
                const stats = fileStats.get(ext) || { extension: ext, count: 0, totalLines: 0 };
                stats.count++;
                
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    stats.totalLines += content.split('\n').length;
                } catch (error) {
                    // Ignore files that can't be read
                }
                
                fileStats.set(ext, stats);
            }
        });

        return Array.from(fileStats.values()).sort((a, b) => b.totalLines - a.totalLines);
    }

    private async walkDirectory(dir: string, callback: (filePath: string) => void): Promise<void> {
        const skipDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', '.nuxt', 'venv', 'env'];
        
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    if (!skipDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                        await this.walkDirectory(fullPath, callback);
                    }
                } else if (entry.isFile()) {
                    callback(fullPath);
                }
            }
        } catch (error) {
            // Ignore directories that can't be read
        }
    }

    private detectLanguages(fileStats: FileStats[]): string[] {
        const languageMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.dart': 'dart',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass'
        };

        const languages: string[] = [];
        const threshold = 100; // Minimum lines to consider a language significant

        for (const stat of fileStats) {
            if (stat.totalLines >= threshold && languageMap[stat.extension]) {
                languages.push(languageMap[stat.extension]);
            }
        }

        return languages.slice(0, 5); 
    }

    private detectFrameworks(packageInfo: any, fileStats: FileStats[]): string[] {
        const frameworks: string[] = [];

        // JavaScript/TypeScript frameworks
        if (packageInfo.packageJson) {
            const deps = {
                ...packageInfo.packageJson.dependencies,
                ...packageInfo.packageJson.devDependencies
            };

            if (deps.react) frameworks.push('React');
            if (deps.vue) frameworks.push('Vue.js');
            if (deps.angular || deps['@angular/core']) frameworks.push('Angular');
            if (deps.svelte) frameworks.push('Svelte');
            if (deps.next) frameworks.push('Next.js');
            if (deps.nuxt) frameworks.push('Nuxt.js');
            if (deps.express) frameworks.push('Express');
            if (deps.nestjs || deps['@nestjs/core']) frameworks.push('NestJS');
            if (deps.gatsby) frameworks.push('Gatsby');
            if (deps.electron) frameworks.push('Electron');
            if (deps.webpack) frameworks.push('Webpack');
            if (deps.vite) frameworks.push('Vite');
        }

        // Python frameworks
        if (packageInfo.pythonRequirements) {
            const requirements = packageInfo.pythonRequirements.join(' ').toLowerCase();
            if (requirements.includes('django')) frameworks.push('Django');
            if (requirements.includes('flask')) frameworks.push('Flask');
            if (requirements.includes('fastapi')) frameworks.push('FastAPI');
            if (requirements.includes('streamlit')) frameworks.push('Streamlit');
            if (requirements.includes('tensorflow')) frameworks.push('TensorFlow');
            if (requirements.includes('pytorch')) frameworks.push('PyTorch');
            if (requirements.includes('pandas')) frameworks.push('Pandas');
            if (requirements.includes('numpy')) frameworks.push('NumPy');
        }

        // File-based detection
        const hasDockerfile = fileStats.some(stat => stat.extension === '.dockerfile');
        if (hasDockerfile) frameworks.push('Docker');

        return frameworks.slice(0, 8); // Return top 8 frameworks
    }

    private determineProjectType(languages: string[], frameworks: string[], packageInfo: any): string {
        // Web dev
        if (frameworks.some(f => ['React', 'Vue.js', 'Angular', 'Svelte'].includes(f))) {
            return 'Web Frontend';
        }
        
        if (frameworks.some(f => ['Express', 'NestJS', 'Django', 'Flask', 'FastAPI'].includes(f))) {
            return 'Web Backend';
        }

        // Mobile dev
        if (frameworks.includes('React Native') || languages.includes('swift') || languages.includes('kotlin')) {
            return 'Mobile';
        }

        // Desktop apps
        if (frameworks.includes('Electron') || languages.includes('csharp') || languages.includes('cpp')) {
            return 'Desktop';
        }

        // Data science/ML
        if (frameworks.some(f => ['TensorFlow', 'PyTorch', 'Pandas', 'NumPy'].includes(f))) {
            return 'Data Science';
        }

        // Game dev
        if (languages.includes('csharp') && frameworks.length === 0) {
            return 'Game Development';
        }

        // DevOps/Infra
        if (frameworks.includes('Docker') || languages.includes('yaml')) {
            return 'DevOps';
        }

        // Default based on primary language
        if (languages.length > 0) {
            const primaryLanguage = languages[0];
            switch (primaryLanguage) {
                case 'javascript':
                case 'typescript':
                    return 'JavaScript';
                case 'python':
                    return 'Python';
                case 'java':
                    return 'Java';
                case 'cpp':
                case 'c':
                    return 'Systems';
                default:
                    return 'General';
            }
        }

        return 'General';
    }

    private determineMood(projectType: string, frameworks: string[]): string {
        const moodMap: { [key: string]: string } = {
            'Web Frontend': 'creative',
            'Web Backend': 'focused',
            'Mobile': 'innovative',
            'Desktop': 'productive',
            'Data Science': 'analytical',
            'Game Development': 'energetic',
            'DevOps': 'systematic',
            'JavaScript': 'dynamic',
            'Python': 'versatile',
            'Java': 'structured',
            'Systems': 'intense',
            'General': 'balanced'
        };

        // Special cases based on frameworks
        if (frameworks.some(f => ['React', 'Vue.js', 'Angular'].includes(f))) {
            return 'creative';
        }
        if (frameworks.some(f => ['TensorFlow', 'PyTorch'].includes(f))) {
            return 'analytical';
        }
        if (frameworks.includes('Docker')) {
            return 'systematic';
        }

        return moodMap[projectType] || 'balanced';
    }

    private generateKeywords(projectType: string, languages: string[], frameworks: string[]): string[] {
        const keywords: string[] = [];

        keywords.push(projectType.toLowerCase().replace(' ', '-'));

        keywords.push(...languages.map(lang => lang.toLowerCase()));

        keywords.push(...frameworks.map(fw => fw.toLowerCase().replace(/[^a-z0-9]/g, '-')));

        const contextualKeywords: { [key: string]: string[] } = {
            'Web Frontend': ['ui', 'interface', 'design', 'responsive'],
            'Web Backend': ['api', 'server', 'database', 'microservices'],
            'Mobile': ['app', 'mobile', 'touch', 'responsive'],
            'Desktop': ['application', 'gui', 'software'],
            'Data Science': ['analytics', 'machine-learning', 'data', 'visualization'],
            'Game Development': ['game', 'graphics', 'animation', 'interactive'],
            'DevOps': ['automation', 'deployment', 'infrastructure', 'cloud'],
            'Systems': ['performance', 'memory', 'optimization', 'algorithms']
        };

        if (contextualKeywords[projectType]) {
            keywords.push(...contextualKeywords[projectType]);
        }

        return Array.from(new Set(keywords)).slice(0, 10); // Remove duplicates and limit to 10
    }
} 