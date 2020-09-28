"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmAsset = exports.GmAssetsProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const utilities_1 = require("./utilities");
const extension_1 = require("./extension");
class GmAssetsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.project = utilities_1.Utilities.projectAsJson(utilities_1.Utilities.projectPath());
        this.resources = utilities_1.Utilities.resourcesAsJson(this.project);
    }
    refresh() {
        this.project = utilities_1.Utilities.projectAsJson(utilities_1.Utilities.projectPath());
        this.resources = utilities_1.Utilities.resourcesAsJson(this.project);
        this._onDidChangeTreeData.fire();
    }
    reveal() {
        try {
            if (!vscode.window.activeTextEditor)
                return;
            var search = vscode.window.activeTextEditor.document.uri.fsPath.split("\\").join("/");
            var getElementToReveal = (element, search) => {
                if (element.path && element.path.includes(search)) {
                    return element;
                }
                var children = this.getChildren(element);
                if (children.length <= 0) {
                    return null;
                }
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    var elementToReveal = getElementToReveal(child, search);
                    if (elementToReveal)
                        return elementToReveal;
                }
                return null;
            };
            var rootFolders = this.getChildren();
            var result = null;
            rootFolders.forEach(root => {
                if (!result) {
                    var rootResult = getElementToReveal(root, search);
                    if (rootResult) {
                        result = rootResult;
                    }
                }
                ;
            });
            if (result) {
                extension_1.Extension.view.reveal(result);
            }
        }
        catch (err) {
            throw err;
        }
    }
    getTreeItem(element) {
        return element;
    }
    getParent(element) {
        return element.parent;
    }
    getChildren(element) {
        if (!this.project || !this.resources)
            return [];
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
            return new Array();
        }
    }
    getRootChildren() {
        var result = new Array();
        this.project.Folders.filter((f) => f.folderPath.split('/').length <= 2).forEach((f) => {
            var el = new GmAsset(f.name, vscode.TreeItemCollapsibleState.Collapsed, f, f.resourceType);
            if (this.containsGml(el)) {
                result.push(el);
            }
        });
        return this.sorted(result);
    }
    getFolderChildren(element) {
        var result = new Array();
        const folderPath = element.item.folderPath.split(".yy")[0];
        this.project.Folders.filter((f) => f.folderPath.split("/").slice(0, -1).join("/") == folderPath).forEach((f) => {
            f.path = `${utilities_1.Utilities.rootPath()}${f.folderPath}`;
            var folder = new GmAsset(f.name, vscode.TreeItemCollapsibleState.Collapsed, f, f.resourceType, undefined, element);
            var children = this.getChildren(folder);
            if (children.length <= 0)
                folder = new GmAsset(f.name, vscode.TreeItemCollapsibleState.None, f, f.resourceType, undefined, element);
            result.push(folder);
        });
        this.resources.filter(r => r.yy.parent.path == element.item.folderPath).forEach(r => {
            if (r.yy.resourceType == "GMScript") {
                var command = {
                    command: 'extension.openFile',
                    title: '',
                    arguments: [r.path.replace("yy", "gml")]
                };
                result.push(new GmAsset(`${r.yy.name}.gml`, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType, command, element));
            }
            else if (r.yy.resourceType == "GMObject") {
                var object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType, undefined, element);
                var children = this.getChildren(object);
                if (children.length <= 0)
                    object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType), undefined, element;
                result.push(object);
            }
            else if (r.yy.resourceType == "GMRoom") {
                var room = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType, undefined, element);
                var children = this.getChildren(room);
                if (children.length <= 0)
                    room = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType, undefined, element);
                result.push(room);
            }
            else if (r.yy.resourceType == "GMShader") {
                result.push(new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType, undefined, element));
            }
        });
        return this.sorted(result);
    }
    getObjectChildren(element) {
        var result = new Array();
        element.item.yy.eventList.forEach((e) => {
            var event = utilities_1.Utilities.eventInfo(e);
            var command = {
                command: 'extension.openFile',
                title: '',
                arguments: [event.path]
            };
            e.path = event.path;
            result.push(new GmAsset(event.name, vscode.TreeItemCollapsibleState.None, e, e.resourceType, command, element));
        });
        return this.sorted(result);
    }
    getRoomChildren(element) {
        var result = new Array();
        const fileName = element.item.yy.creationCodeFile.split("/").slice(-1)[0];
        if (!fileName)
            return [];
        var command = {
            command: 'extension.openFile',
            title: '',
            arguments: [`${utilities_1.Utilities.rootPath()}${element.item.yy.creationCodeFile.split("/").slice(1, -1).join("/")}/${fileName}`]
        };
        result.push(new GmAsset(fileName, vscode.TreeItemCollapsibleState.None, element, "GMScript", command, element));
        return this.sorted(result);
    }
    getShaderChildren(element) {
        var result = new Array();
        var addGmAsset = function (extension) {
            var filePath = element.item.path.replace("yy", extension);
            var fileName = filePath.split("/").slice(-1)[0];
            var command = {
                command: 'extension.openFile',
                title: '',
                arguments: [filePath]
            };
            result.push(new GmAsset(fileName, vscode.TreeItemCollapsibleState.None, { path: filePath }, "GMShaderFile", command, element));
        };
        addGmAsset("fsh");
        addGmAsset("vsh");
        return this.sorted(result);
    }
    containsGml(element) {
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
    sorted(arr) {
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
exports.GmAssetsProvider = GmAssetsProvider;
class GmAsset extends vscode.TreeItem {
    constructor(label, collapsibleState, item, resourceType, command, parent) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.item = item;
        this.resourceType = resourceType;
        this.command = command;
        this.parent = parent;
        this.path = undefined;
        this.iconPath = vscode.ThemeIcon.File;
        this.contextValue = 'gmAsset';
        this.path = item.path;
        switch (resourceType) {
            case "GMFolder": {
                if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
                    this.iconPath = {
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'folder.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'folder.png'),
                    };
                }
                else {
                    this.iconPath = {
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                    };
                }
                break;
            }
            case "GMObject": {
                if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
                    this.iconPath = {
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'ghost.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'ghost.png'),
                    };
                }
                else {
                    this.iconPath = {
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'ghost-f.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'ghost-f.png'),
                    };
                }
                break;
            }
            case "GMRoom": {
                if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
                    this.iconPath = {
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'grid.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'grid.png'),
                    };
                }
                else {
                    this.iconPath = {
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'grid-f.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'grid-f.png'),
                    };
                }
                break;
            }
            case "GMShader": {
                this.iconPath = {
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                };
                break;
            }
            case "GMShaderFile": {
                this.iconPath = {
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                };
                break;
            }
            case "GMScript": {
                this.iconPath = {
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                };
                break;
            }
            case "GMEvent": {
                this.iconPath = {
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                };
                break;
            }
            default: {
                break;
            }
        }
    }
}
exports.GmAsset = GmAsset;
//# sourceMappingURL=gm-assets-provider.js.map