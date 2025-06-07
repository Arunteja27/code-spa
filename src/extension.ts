import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { BackgroundController } from './backgroundController';
import { MusicPlayer } from './musicPlayer';
import { ProjectAnalyzer } from './projectAnalyzer';
import { UICustomizer } from './uiCustomizer';
import { ControlPanelProvider } from './controlPanelProvider';

let backgroundController: BackgroundController;
let musicPlayer: MusicPlayer;
let projectAnalyzer: ProjectAnalyzer;
let uiCustomizer: UICustomizer;
let controlPanelProvider: ControlPanelProvider;


export function activate(context: vscode.ExtensionContext) {
	console.log('🎨 Code Spa is now active! Welcome to your coding sanctuary.');
	
	// grab env vars for spotify stuff
	dotenv.config({ path: path.join(context.extensionPath, '.env') });
	
	backgroundController = new BackgroundController(context);
	musicPlayer = new MusicPlayer(context);
	projectAnalyzer = new ProjectAnalyzer();
	uiCustomizer = new UICustomizer(context);
	controlPanelProvider = new ControlPanelProvider(context);

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

	vscode.window.showInformationMessage('🎨 Code Spa activated! Open the Control Panel to customize your coding experience.');
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
			vscode.window.showInformationMessage('🖼️ Dynamic backgrounds enabled!');
		} else {
			await backgroundController.disable();
			vscode.window.showInformationMessage('🖼️ Dynamic backgrounds disabled.');
		}
	});

	const openMusicPlayer = vscode.commands.registerCommand('code-spa.openMusicPlayer', () => {
		musicPlayer.showPlayer();
	});

	const analyzeProject = vscode.commands.registerCommand('code-spa.analyzeProject', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showWarningMessage('No workspace folder found to analyze.');
			return;
		}

		vscode.window.showInformationMessage('🔍 Analyzing project context...');
		const analysis = await projectAnalyzer.analyzeWorkspace(workspaceFolders[0].uri.fsPath);
		
		if (analysis) {
			await backgroundController.updateBackgroundFromContext(analysis);
			vscode.window.showInformationMessage(`🎨 Background updated based on ${analysis.projectType} project!`);
		}
	});

	const customizeTheme = vscode.commands.registerCommand('code-spa.customizeTheme', () => {
		uiCustomizer.showCustomizationPanel();
	});

	// spotify connect/disconnect - pretty straightforward
	const connectSpotify = vscode.commands.registerCommand('code-spa.connectSpotify', async () => {
		vscode.window.showInformationMessage('🎵 Connecting to Spotify...');
		const success = await musicPlayer.connectSpotify();
		if (success) {
			vscode.window.showInformationMessage('🎵 Successfully connected to Spotify! Your playlists are now available.');
		}
	});

	const disconnectSpotify = vscode.commands.registerCommand('code-spa.disconnectSpotify', async () => {
		await musicPlayer.disconnectSpotify();
	});

	context.subscriptions.push(
		openControlPanel,
		toggleBackground,
		openMusicPlayer,
		analyzeProject,
		customizeTheme,
		connectSpotify,
		disconnectSpotify
	);
}

function initializeExtension() {
	const config = vscode.workspace.getConfiguration('codeSpa');
	
	if (config.get('background.enabled', true)) {
		backgroundController.enable();
	}

	if (config.get('music.enabled', false)) {
		musicPlayer.initialize();
	}

	const themePreset = config.get('theme.preset', 'cyberpunk');
	uiCustomizer.applyPreset(themePreset as string);
}

function setupWorkspaceMonitoring(context: vscode.ExtensionContext) {
	const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
		const config = vscode.workspace.getConfiguration('codeSpa');
		if (config.get('background.enabled', true)) {
			// wait a bit then auto-analyze the new workspace
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

	if (config.get('music.enabled', false)) {
		musicPlayer.initialize();
		musicPlayer.setVolume(config.get('music.volume', 0.3));
	}

	const themePreset = config.get('theme.preset', 'cyberpunk');
	uiCustomizer.applyPreset(themePreset as string);
}

export function deactivate() {
	console.log('🎨 Code Spa is deactivating. Thanks for using Code Spa!');
	
	// clean up everything
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
