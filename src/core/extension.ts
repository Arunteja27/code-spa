import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { BackgroundController } from '../services/theming/backgroundController';
import { MusicPlayer } from '../services/music/musicPlayer';
import { ProjectAnalyzer } from '../services/analysis/projectAnalyzer';
import { UICustomizer } from '../services/theming/uiCustomizer';
import { ControlPanelProvider } from '../providers/controlPanelProvider';
import { NotificationService } from '../services/notifications/notificationService';
import { LLMThemeGenerator } from '../services/llm/llmThemeGenerator';

let backgroundController: BackgroundController;
let musicPlayer: MusicPlayer;
let projectAnalyzer: ProjectAnalyzer;
let uiCustomizer: UICustomizer;
let controlPanelProvider: ControlPanelProvider;
let notificationService: NotificationService;
let llmThemeGenerator: LLMThemeGenerator;

const originalInfo = vscode.window.showInformationMessage;
const originalWarn = vscode.window.showWarningMessage;
const originalError = vscode.window.showErrorMessage;

export async function activate(context: vscode.ExtensionContext) {
	console.log('🎨 Code Spa is now active! Welcome to your coding sanctuary.');
	
	dotenv.config({ path: path.join(context.extensionPath, '.env') });
	
	notificationService = NotificationService.getInstance();

	backgroundController = await BackgroundController.create(context);
	musicPlayer = await MusicPlayer.create(context);
	projectAnalyzer = new ProjectAnalyzer();
	uiCustomizer = new UICustomizer(context);
	controlPanelProvider = new ControlPanelProvider(context);
	llmThemeGenerator = new LLMThemeGenerator();
	
	controlPanelProvider.setUICustomizer(uiCustomizer);
	controlPanelProvider.setMusicPlayer(musicPlayer);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'codeSpaControlPanel',
			controlPanelProvider,
			{ webviewOptions: { retainContextWhenHidden: true } }
		)
	);

	registerCommands(context);
	initializeExtension();
	setupWorkspaceMonitoring(context);

	notificationService.showExtensionActivation('🎨 Code Spa activated! Open the Control Panel to customize your coding experience.');
}

function registerCommands(context: vscode.ExtensionContext) {
	const openControlPanel = vscode.commands.registerCommand('code-spa.openControlPanel', () => {
		controlPanelProvider.show();
	});

	const toggleBackground = vscode.commands.registerCommand('code-spa.toggleBackground', async () => {
		const config = vscode.workspace.getConfiguration('codeSpa');
		const enabled = config.get('background.enabled', true);
		await config.update('background.enabled', !enabled, vscode.ConfigurationTarget.Global);
		
		if (!enabled) {
			await backgroundController.enable();
			notificationService.showBackgroundChange('🖼️ Dynamic backgrounds enabled!');
		} else {
			await backgroundController.disable();
			notificationService.showBackgroundChange('🖼️ Dynamic backgrounds disabled.');
		}
	});

	const openMusicPlayer = vscode.commands.registerCommand('code-spa.openMusicPlayer', () => {
		controlPanelProvider.show();
		vscode.commands.executeCommand('workbench.view.extension.codeSpaPanel');
	});

	const analyzeProject = vscode.commands.registerCommand('code-spa.analyzeProject', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			notificationService.showWarning('No workspace folder found to analyze.');
			return;
		}

		notificationService.showProjectAnalysis('🔍 Analyzing project context...');
		const analysis = await projectAnalyzer.analyzeWorkspace(workspaceFolders[0].uri.fsPath);
		
		if (analysis) {
			await backgroundController.updateBackgroundFromContext(analysis);
			notificationService.showBackgroundChange(`🎨 Background updated based on ${analysis.projectType} project!`);
		}
	});

	const customizeTheme = vscode.commands.registerCommand('code-spa.customizeTheme', () => {
		uiCustomizer.showCustomizationPanel();
	});

	const testTheme = vscode.commands.registerCommand('code-spa.testTheme', async () => {
		const themes = ['cyberpunk', 'nature', 'space', 'minimal', 'retro'];
		const selected = await vscode.window.showQuickPick(themes, {
			placeHolder: 'Select a theme to test'
		});
		if (selected) {
			await uiCustomizer.applyPreset(selected);
		}
	});

	const connectSpotify = vscode.commands.registerCommand('code-spa.connectSpotify', async () => {
		notificationService.showSpotifyConnection('🎵 Connecting to Spotify...');
		const success = await musicPlayer.connectSpotify();
		if (success) {
			notificationService.showSpotifyConnection('🎵 Successfully connected to Spotify! Your playlists are now available.');
		}
	});

	const disconnectSpotify = vscode.commands.registerCommand('code-spa.disconnectSpotify', async () => {
		await musicPlayer.disconnectSpotify();
	});

	const generateLLMTheme = vscode.commands.registerCommand('code-spa.generateLLMTheme', async () => {
		const result = await llmThemeGenerator.generateThemeForCurrentProject();
		
		if (result.success && result.theme) {
			const action = await vscode.window.showInformationMessage(
				`🎨 Generated "${result.theme.name}" theme! ${result.theme.description}`,
				'Apply Theme',
				'View Details'
			);

			if (action === 'Apply Theme') {
				await uiCustomizer.applyPreset('cyberpunk');
				notificationService.showThemeChange(`🎨 Applied AI-generated theme "${result.theme.name}"!`);
			} else if (action === 'View Details') {
				vscode.window.showInformationMessage(
					`Theme: ${result.theme.name}\n\nColors:\n• Primary: ${result.theme.colors.primary}\n• Secondary: ${result.theme.colors.secondary}\n• Accent: ${result.theme.colors.accent}\n\nReasoning: ${result.theme.reasoning}`,
					{ modal: true }
				);
			}
		} else {
			vscode.window.showErrorMessage(`Failed to generate theme: ${result.error || 'Unknown error'}`);
		}
	});

	context.subscriptions.push(
		openControlPanel,
		toggleBackground,
		openMusicPlayer,
		analyzeProject,
		customizeTheme,
		testTheme,
		connectSpotify,
		disconnectSpotify,
		generateLLMTheme
	);
}

function initializeExtension() {
	const config = vscode.workspace.getConfiguration('codeSpa');
	
	const themePreset = config.get('theme.preset', 'cyberpunk');
	uiCustomizer.applyPreset(themePreset as string);

	patchNotifications(config);
}

function setupWorkspaceMonitoring(context: vscode.ExtensionContext) {
	const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
		const config = vscode.workspace.getConfiguration('codeSpa');
		if (config.get('background.enabled', true)) {
			setTimeout(async () => {
				const command = vscode.commands.getCommands().then(commands => {
					if (commands.includes('code-spa.analyzeProject')) {
						vscode.commands.executeCommand('code-spa.analyzeProject');
					}
				});
			}, 2000);
		}
	});

	const editorWatcher = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
		if (editor) {
			const config = vscode.workspace.getConfiguration('codeSpa');
			if (config.get('background.enabled', true)) {
				await backgroundController.onFileChanged(editor.document);
			}
		}
	});

	const configWatcher = vscode.workspace.onDidChangeConfiguration(async (event) => {
		if (event.affectsConfiguration('codeSpa')) {
			await handleConfigurationChange();
		}
	});

	context.subscriptions.push(workspaceWatcher, editorWatcher, configWatcher);
}

async function handleConfigurationChange() {
	const config = vscode.workspace.getConfiguration('codeSpa');
	
	if (config.get('background.enabled', true)) {
		await backgroundController.enable();
		await backgroundController.updateOpacity(config.get('background.opacity', 0.15));
	} else {
		await backgroundController.disable();
	}

	const themePreset = config.get('theme.preset', 'cyberpunk');
	uiCustomizer.applyPreset(themePreset as string);

	patchNotifications(config);
}

function patchNotifications(config: vscode.WorkspaceConfiguration) {
	const enabled = config.get('notifications.enabled', true);
	if(enabled){
		vscode.window.showInformationMessage = originalInfo;
		vscode.window.showWarningMessage = originalWarn;
		vscode.window.showErrorMessage = originalError;
	}else{
		const noopInfo = ((..._args:any[])=>Promise.resolve(undefined)) as any;
		vscode.window.showInformationMessage = noopInfo;
		vscode.window.showWarningMessage = noopInfo;
		vscode.window.showErrorMessage   = noopInfo;
	}
}

export function deactivate() {
	console.log('🎨 Code Spa is deactivating. Thanks for using Code Spa!');
	
	if (backgroundController) {
		backgroundController.dispose();
	}
	if (musicPlayer) {
		musicPlayer.dispose();
	}
	if (uiCustomizer) {
		uiCustomizer.dispose();
	}
}
