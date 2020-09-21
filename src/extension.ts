import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GmAssetsProvider } from './gm-assets-provider';
import { Utilities } from './utilities';

export function activate(context: vscode.ExtensionContext) {

	console.log('Activate GM Extension.');

	const gmAssetsProvider = new GmAssetsProvider();
	vscode.window.registerTreeDataProvider('gmAssetBrowser', gmAssetsProvider);
	vscode.commands.registerCommand('gmAssetBrowser.refresh', () => gmAssetsProvider.refresh());
	vscode.commands.registerCommand(
		'extension.openFile', 
		async (path) => {
			let document = await vscode.workspace.openTextDocument(path);
        	vscode.window.showTextDocument(document);
		}
	);
}

// this method is called when your extension is deactivated
export function deactivate() {}
