import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Utilities } from './utilities';
import { stringify } from 'querystring';
import { Extension } from './extension';
import { start } from 'repl';

export class GmAssetsProvider implements vscode.TreeDataProvider<GmAsset> {

    private project: any;
    private resources: Array<any>;

    private _onDidChangeTreeData: vscode.EventEmitter<GmAsset | undefined | void> = new vscode.EventEmitter<GmAsset | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<GmAsset | undefined | void> = this._onDidChangeTreeData.event;

    constructor() { 
        this.project = Utilities.projectAsJson(Utilities.projectPath());
        this.resources = Utilities.resourcesAsJson(this.project);
    }

    refresh(): void {
        this.project = Utilities.projectAsJson(Utilities.projectPath());
        this.resources = Utilities.resourcesAsJson(this.project);
		this._onDidChangeTreeData.fire();
    }

    reveal(): void {
        try {
            if (!vscode.window.activeTextEditor) return;
    
            var search = vscode.window.activeTextEditor.document.uri.fsPath.split("\\").join("/");
    
            var getElementToReveal = (element: GmAsset, search: string): GmAsset | null => {
                if (element.path && element.path.includes(search)) {
                    return element;
                }
        
                var children = this.getChildren(element);
        
                if (children.length <= 0) {
                    return null;
                }
        
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    var elementToReveal: GmAsset | null = getElementToReveal(child, search);
                    if (elementToReveal) return elementToReveal;
                }
    
                return null;
            }
    
            var rootFolders = this.getChildren();
    
            var result: any = null;
    
            rootFolders.forEach(root => {
                if (!result) {
                    var rootResult = getElementToReveal(root, search);
                    if (rootResult) { 
                        result = rootResult; 
                    }
                };  
            });
    
            if (result) {
                Extension.view.reveal(result);
            }
        }
        catch(err) {
            throw err;
        }
    }

    getTreeItem(element: GmAsset): vscode.TreeItem {
        return element;
    }

    getParent(element: GmAsset): vscode.ProviderResult<GmAsset> {
        return element.parent;
    }

    getChildren(element?: GmAsset): Array<GmAsset> {
        if (!this.project || !this.resources) return [];
        
        // Root
        if (!element) {
            return this.getRootChildren();
        }
        // Folder
        else if (element.resourceType == "GMFolder") {
            return this.getFolderChildren(element);
        }
        // Object
        else if (element.resourceType == "GMObject") {
            return this.getObjectChildren(element);
        }
        // Room
        else if (element.resourceType == "GMRoom") {
            return this.getRoomChildren(element);
        }
        // Shader
        else if (element.resourceType == "GMShader") {
            return this.getShaderChildren(element);
        }
        // ?
        else {
            return new Array<GmAsset>();
        }
    }

    getRootChildren(): Array<GmAsset> {
        var result: Array<GmAsset> = new Array<GmAsset>();

        this.project.Folders.filter((f: any) => f.folderPath.split('/').length <= 2).forEach((f: any) => {
            var el = new GmAsset(f.name, vscode.TreeItemCollapsibleState.Collapsed, f, f.resourceType);
            if (this.containsGml(el)) {
                result.push(el);
            }
        });

        return this.sorted(result);
    }

    getFolderChildren(element: GmAsset): Array<GmAsset> {
        var result: Array<GmAsset> = new Array<GmAsset>();

        const folderPath = element.item.folderPath.split(".yy")[0];

        this.project.Folders.filter((f: any) => f.folderPath.split("/").slice(0, -1).join("/") == folderPath).forEach((f: any) => {
            f.path = `${Utilities.rootPath()}${f.folderPath}`;
            var folder = new GmAsset(f.name, vscode.TreeItemCollapsibleState.Collapsed, f, f.resourceType, undefined, element);
            var children = this.getChildren(folder);
            if (children.length <= 0) folder = new GmAsset(f.name, vscode.TreeItemCollapsibleState.None, f, f.resourceType, undefined, element);
            result.push(folder);
        });

        this.resources.filter(r => r.yy.parent.path == element.item.folderPath).forEach(r => {
            if (r.yy.resourceType == "GMScript") {
                var command: any = {
                    command: 'extension.openFile',
                    title: '',
                    arguments: [r.path.replace("yy", "gml")]
                };
                result.push(new GmAsset(`${r.yy.name}.gml`, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType, command, element));
            }
            else if (r.yy.resourceType == "GMObject") {
                var object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType, undefined, element);
                var children = this.getChildren(object);
                if (children.length <= 0) object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType), undefined, element;
                result.push(object);
            }
            else if (r.yy.resourceType == "GMRoom") {
                var room = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType, undefined, element);
                var children = this.getChildren(room);
                if (children.length <= 0) room = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType, undefined, element);
                result.push(room);
            }
            else if (r.yy.resourceType == "GMShader") {
                result.push(new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType, undefined, element));
            }
        });

        return this.sorted(result);
    }

    getObjectChildren(element: GmAsset): Array<GmAsset> {
        var result: Array<GmAsset> = new Array<GmAsset>();

        element.item.yy.eventList.forEach((e: any) => {
            var event = Utilities.eventInfo(e);

            var command: any = {
                command: 'extension.openFile',
                title: '',
                arguments: [event.path]
            }

            e.path = event.path;

            result.push(new GmAsset(event.name, vscode.TreeItemCollapsibleState.None, e, e.resourceType, command, element));
        });

        return this.sorted(result);
    }

    getRoomChildren(element: GmAsset): Array<GmAsset> {
        var result: Array<GmAsset> = new Array<GmAsset>();

        const fileName = element.item.yy.creationCodeFile.split("/").slice(-1)[0];

        if (!fileName) return [];

        var command: any = {
            command: 'extension.openFile',
            title: '',
            arguments: [`${Utilities.rootPath()}${element.item.yy.creationCodeFile.split("/").slice(1,-1).join("/")}/${fileName}`]
        }

        result.push(new GmAsset(fileName, vscode.TreeItemCollapsibleState.None, element, "GMScript", command, element));

        return this.sorted(result);
    }

    getShaderChildren(element: GmAsset): Array<GmAsset> {
        var result: Array<GmAsset> = new Array<GmAsset>();

        var addGmAsset = function(extension: string) {
            var filePath = element.item.path.replace("yy", extension);
            var fileName = filePath.split("/").slice(-1)[0];
            var command: any = {
                command: 'extension.openFile',
                title: '',
                arguments: [filePath]
            };
    
            result.push(new GmAsset(fileName, vscode.TreeItemCollapsibleState.None, { path: filePath }, "GMShaderFile", command, element));
        }

        addGmAsset("fsh");
        addGmAsset("vsh");

        return this.sorted(result);
    }

    containsGml(element: GmAsset): boolean {
        if (element.resourceType == "GMScript" || element.resourceType == "GMEvent" || element.resourceType == "GMRoom" || element.resourceType == "GMShader" || element.resourceType == "GMShaderFile") {
            return true;
        }

        var children = this.getChildren(element);

        if (children.length <= 0) {
            return false;
        }

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (this.containsGml(child)) {
                return true;
            }
        }

        return false;
    }

    sorted(arr: Array<GmAsset>): Array<GmAsset> {
        return arr.sort((o1, o2) => {
            // Sort by folder and item.

            if (o1.resourceType == "GMFolder" && o2.resourceType != "GMFolder") {
                return -1;
            }

            if (o1.resourceType != "GMFolder" && o2.resourceType == "GMFolder") {
                return 1;
            }

            // Sort when both same type.

            if (o1.label > o2.label) {
                return 1;
            }

            if (o1.label < o2.label) {
                return -1;
            }

            return 0;
        });
    }
}

export class GmAsset extends vscode.TreeItem {

    public path: string | undefined = undefined;

    constructor(
        public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly item: any,
        public readonly resourceType: string,
        public readonly command?: vscode.Command,
        public readonly parent?: GmAsset | undefined
    ) {
        super(label, collapsibleState);

        this.path = item.path;

        switch (resourceType) {
            case "GMFolder": {
                if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
                    this.iconPath = { 
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'folder.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'folder.png'),
                    }
                }
                else {
                    this.iconPath = { 
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                    }
                }
                break;
            }
            case "GMObject": {
                if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
                    this.iconPath = { 
                        light: path.join(__filename, '..', '..', 'images','icons', 'ghost.png'),
                        dark: path.join(__filename, '..', '..', 'images','icons', 'ghost.png'),
                    }
                }
                else {
                    this.iconPath = { 
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'ghost-f.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'ghost-f.png'),
                    }
                }
                break;
            }
            case "GMRoom": {
                if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
                    this.iconPath = { 
                        light: path.join(__filename, '..', '..', 'images','icons',  'grid.png'),
                        dark: path.join(__filename, '..', '..', 'images','icons',  'grid.png'),
                    }
                }
                else {
                    this.iconPath = { 
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'grid-f.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'grid-f.png'),
                    }
                }
                break;
            }
            case "GMShader": {
                this.iconPath = { 
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                }
                
                break;
            }
            case "GMShaderFile": {
                this.iconPath = { 
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                }
                
                break;
            }
            case "GMScript": {
                this.iconPath = { 
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                }
                break;
            }
            case "GMEvent": {
                this.iconPath = { 
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                }
                break;
            }
        
            default: {
                break;
            }
        }
    }

    iconPath = vscode.ThemeIcon.File;

    contextValue = 'gmAsset';
}