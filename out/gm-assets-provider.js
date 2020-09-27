"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmAsset = exports.GmAssetsProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const utilities_1 = require("./utilities");
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
    getTreeItem(element) {
        return element;
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
            result.push(new GmAsset(f.name, vscode.TreeItemCollapsibleState.Collapsed, f, f.resourceType));
        });
        this.resources.filter(r => r.yy.parent.path == element.item.folderPath).forEach(r => {
            if (r.yy.resourceType == "GMScript") {
                var command = {
                    command: 'extension.openFile',
                    title: '',
                    arguments: [r.path.replace("yy", "gml")]
                };
                result.push(new GmAsset(`${r.yy.name}.gml`, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType, command));
            }
            else if (r.yy.resourceType == "GMObject") {
                var object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType);
                var children = this.getObjectChildren(object);
                if (children.length <= 0)
                    object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType);
                result.push(object);
            }
            else if (r.yy.resourceType == "GMRoom") {
                var object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType);
                var children = this.getRoomChildren(object);
                if (children.length <= 0)
                    object = new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.None, r, r.yy.resourceType);
                result.push(object);
            }
            else if (r.yy.resourceType == "GMShader") {
                result.push(new GmAsset(r.yy.name, vscode.TreeItemCollapsibleState.Collapsed, r, r.yy.resourceType));
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
            result.push(new GmAsset(event.name, vscode.TreeItemCollapsibleState.None, e, e.resourceType, command));
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
        result.push(new GmAsset(fileName, vscode.TreeItemCollapsibleState.None, element, "GMScript", command));
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
            result.push(new GmAsset(fileName, vscode.TreeItemCollapsibleState.None, element, element.resourceType, command));
        };
        addGmAsset("fsh");
        addGmAsset("vsh");
        return this.sorted(result);
    }
    containsGml(element) {
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
    sorted(arr) {
        return arr.sort((o1, o2) => (o2.label > o1.label) ? -1 : 1);
    }
}
exports.GmAssetsProvider = GmAssetsProvider;
class GmAsset extends vscode.TreeItem {
    constructor(label, collapsibleState, item, resourceType, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.item = item;
        this.resourceType = resourceType;
        this.command = command;
        this.iconPath = vscode.ThemeIcon.File;
        this.contextValue = 'gmAsset';
        switch (resourceType) {
            case "GMFolder": {
                this.iconPath = {
                    light: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                    dark: path.join(__filename, '..', '..', 'images', 'icons', 'folder-f.png'),
                };
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
                if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
                    this.iconPath = {
                        light: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
                        dark: path.join(__filename, '..', '..', 'images', 'icons', 'document-f.png'),
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