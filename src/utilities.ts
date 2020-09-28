import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class Utilities {
    
    constructor() { }

    static _projectPath: string | null = null;
    static projectPath(): string {
        if (this._projectPath) {
            return this._projectPath;
        }

        var path: any = vscode.workspace.workspaceFolders 
            ? vscode.workspace.workspaceFolders[0].uri.path.slice(1) 
            : null;  

        var findPath = function(path: string) {
            if (!path) return null;

            if (path.includes(".yyp")) {
                return path;
            }

            if (fs.lstatSync(path).isDirectory()) {
                var list: Array<string> = fs.readdirSync(path).filter(i => i[0] != ".", );

                for (let i = 0; i < list.length; i++) {
                    const item = list[i];
                    var result: any = findPath(`${path}/${item}`);
                    if (result) {
                        return result;
                    }
                }
            }

            return null;
        }

        var foundPath = findPath(path);

        if (foundPath) {
            this._projectPath = foundPath;
            return foundPath;
        }
        else {
            vscode.window.showErrorMessage("Couldn't find a .yyp file in the current directory or in any of it's children.");
            return "";
        }
    }
    
    static rootPath(): string {
        return this.projectPath().split("/").slice(0,-1).join("/") + "/";
    }

    static eventInfo(event: any): any {
        var basePath = `${`${this.rootPath()}${event.parent.path}`.split("/").slice(0, -1).join("/")}/`;

        var eventType = function(eventType: number): string {
            var result = "";

            switch (eventType) {
                case 0: result = "Create"; break;
                case 1: result = "Destroy"; break;
                case 2: result = "Alarm"; break;
                case 3: result = "Step"; break;
                case 7: result = "Other"; break;
                case 8: result = "Draw"; break;
                case 12: result = "Clean Up"; break;
            
                default: result = ""; break;
            }

            return result;
        }

        var name = `${eventType(event.eventType)}_${event.eventNum}.gml`;

        var path = `${basePath}${name}`;

        return {
            name: name,
            path: path
        };
    }

    static readPathAsJson(path: string) {
        let regex = /\,(?!\s*?[\{\[\"\'\w])/g;
    
        const file = fs.readFileSync(path, 'utf-8');
        const correct = file.replace(regex, '')
        const json: any = JSON.parse(correct);
    
        return json;
    }
    
    static projectAsJson(path: string): any {
        return this.readPathAsJson(path);
    }
    
    static resourcesAsJson(project: any) {
        var result: Array<any> = new Array<any>();

        project.resources.forEach((r: any) => {
            var path: string = `${this.rootPath()}${r.id.path}`;
            var json = this.readPathAsJson(path);
            result.push({yy: json, path: path});
        });

        return result;
    }
}
