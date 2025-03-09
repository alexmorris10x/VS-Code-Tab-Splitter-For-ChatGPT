"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
var vscode = require("vscode");
function activate(context) {
    var _this = this;
    // Register the command 'extension.splitSelectedTabs'
    var disposable = vscode.commands.registerCommand("extension.splitSelectedTabs", function () { return __awaiter(_this, void 0, void 0, function () {
        var openTabs, tabItems, selectedTabs, activeEditor, _i, selectedTabs_1, tab, save, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 9, , 10]);
                    openTabs = vscode.workspace.textDocuments.filter(function (doc) { return !doc.isUntitled; });
                    if (openTabs.length === 0) {
                        vscode.window.showInformationMessage("No open tabs to split.");
                        return [2 /*return*/];
                    }
                    tabItems = openTabs.map(function (doc) {
                        return {
                            label: doc.fileName.split("/").pop() || doc.fileName,
                            description: doc.fileName,
                            document: doc,
                        };
                    });
                    return [4 /*yield*/, vscode.window.showQuickPick(tabItems, {
                            canPickMany: true,
                            placeHolder: "Select tabs to split",
                        })];
                case 1:
                    selectedTabs = _a.sent();
                    if (!selectedTabs || selectedTabs.length === 0) {
                        return [2 /*return*/]; // User cancelled the selection
                    }
                    activeEditor = vscode.window.activeTextEditor;
                    if (!activeEditor) {
                        vscode.window.showErrorMessage("No active editor found.");
                        return [2 /*return*/];
                    }
                    _i = 0, selectedTabs_1 = selectedTabs;
                    _a.label = 2;
                case 2:
                    if (!(_i < selectedTabs_1.length)) return [3 /*break*/, 8];
                    tab = selectedTabs_1[_i];
                    if (!tab.document.isDirty) return [3 /*break*/, 5];
                    return [4 /*yield*/, vscode.window.showWarningMessage("The file ".concat(tab.label, " has unsaved changes. Save before splitting?"), "Save", "Cancel")];
                case 3:
                    save = _a.sent();
                    if (save !== "Save") {
                        return [3 /*break*/, 7]; // Skip this tab
                    }
                    return [4 /*yield*/, tab.document.save()];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: 
                // Open the document in a new editor column
                return [4 /*yield*/, vscode.window.showTextDocument(tab.document, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preserveFocus: true,
                        preview: false,
                    })];
                case 6:
                    // Open the document in a new editor column
                    _a.sent();
                    _a.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_1 = _a.sent();
                    vscode.window.showErrorMessage("Error splitting tabs: ".concat(error_1));
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    }); });
    context.subscriptions.push(disposable);
}
function deactivate() { }
