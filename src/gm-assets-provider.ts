import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Utilities } from './utilities';
import { stringify } from 'querystring';

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

    getTreeItem(element: GmAsset): vscode.TreeItem {
        return element;
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
            result.push(new GmAsset(f.name, vscode.TreeItemCollapsibleState.Collapsed, f, f.resourceType));
        });

        this.resources.filter(r => r.yy.parent.path == element.item.folderPath).forEach(r => {
            if (r.yy.resourceType == "GMScript") {
                var command: any = {
                    command: 'extension.openFile',
                    title: '',
                    arguments: [r.path.replace("yy", "gml")]
                };
                result.push(new GmAsset(`${r.yy.name}.gml`, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType, command));
            }
            else if (r.yy.resourceType == "GMObject") {
                var object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType);
                var children = this.getObjectChildren(object);
                if (children.length <= 0) object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType);
                result.push(object);
            }
            else if (r.yy.resourceType == "GMRoom") {
                var object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType);
                var children = this.getRoomChildren(object);
                if (children.length <= 0) object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType);
                result.push(object);
            }
            else if (r.yy.resourceType == "GMShader") {
                result.push(new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType));
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

            result.push(new GmAsset(event.name, vscode.TreeItemCollapsibleState.None, e, e.resourceType, command));
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

        result.push(new GmAsset(fileName, vscode.TreeItemCollapsibleState.None, element, "GMScript", command));

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
    
            result.push(new GmAsset(fileName, vscode.TreeItemCollapsibleState.None, element, element.resourceType, command));
        }

        addGmAsset("fsh");
        addGmAsset("vsh");

        return this.sorted(result);
    }

    containsGml(element: GmAsset): boolean {
        if (element.resourceType == "GMScript" || element.resourceType == "GMEvent" || element.resourceType == "GMRoom" || element.resourceType == "GMShader") {
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
        return arr.sort((o1, o2) => (o2.label > o1.label) ? -1: 1);
    }
}

export class GmAsset extends vscode.TreeItem {

    constructor(
        public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly item: any,
        public readonly resourceType: string,
        public readonly command?: vscode.Command,
    ) {
        super(label, collapsibleState);

        switch (resourceType) {
            case "GMFolder": {
                this.iconPath = { 
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
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
                if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
                    this.iconPath = { 
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
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