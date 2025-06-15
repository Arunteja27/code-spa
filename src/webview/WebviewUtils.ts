import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class WebviewUtils {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Load HTML template and replace placeholders with actual URIs
     */
    public loadHtmlTemplate(
        webview: vscode.Webview,
        templateName: string,
        content: string,
        backgroundGradient?: string
    ): string {
        const templateMap: { [key: string]: string } = {
            'control-panel': 'control_panel',
            'music-player': 'music_player',
            'ui-customizer': 'ui_customizer'
        };

        const templateFolder = templateMap[templateName] || templateName;

        // Try out directory first (production), then src directory (development)
        let basePath = path.join(this.context.extensionPath, 'out', 'webview', templateFolder);
        if (!fs.existsSync(basePath)) {
            basePath = path.join(this.context.extensionPath, 'src', 'webview', templateFolder);
        }

        const cssUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(basePath, `${templateName}.css`))
        );
        const jsUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(basePath, `${templateName}.js`))
        );

        const htmlPath = path.join(basePath, `${templateName}.html`);
        let htmlTemplate = fs.readFileSync(htmlPath, 'utf8');

        htmlTemplate = htmlTemplate
            .replace(/{{CSS_URI}}/g, cssUri.toString())
            .replace(/{{JS_URI}}/g, jsUri.toString())
            .replace(/{{PAGE_CONTENT}}/g, content);

        if (backgroundGradient) {
            htmlTemplate = htmlTemplate.replace(/{{BACKGROUND_GRADIENT}}/g, backgroundGradient);
        }

        return htmlTemplate;
    }

    /**
     * Load CSS file content
     */
    public loadCssFile(fileName: string): string {
        const cssPath = path.join(this.context.extensionPath, 'out', 'webview', `${fileName}.css`);
        return fs.readFileSync(cssPath, 'utf8');
    }

    /**
     * Load JavaScript file content
     */
    public loadJsFile(fileName: string): string {
        const jsPath = path.join(this.context.extensionPath, 'out', 'webview', `${fileName}.js`);
        return fs.readFileSync(jsPath, 'utf8');
    }

    /**
     * Get webview URI for a file
     */
    public getWebviewUri(webview: vscode.Webview, fileName: string): vscode.Uri {
        const filePath = path.join(this.context.extensionPath, 'out', 'webview', fileName);
        return webview.asWebviewUri(vscode.Uri.file(filePath));
    }
} 