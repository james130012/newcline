import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

let globalReplaceCommands: string = ""; 

export function activate(context: vscode.ExtensionContext) {
    console.log('>>>>>> [newcline] activate() function called.');

    const provider = new NewclineViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(NewclineViewProvider.viewType, provider, {
            webviewOptions: { retainContextWhenHidden: true } 
        })
    );
    console.log('>>>>>> [newcline] NewclineViewProvider registered.');

    context.subscriptions.push(vscode.commands.registerCommand('newcline.enterReplaceCommands', async () => {
        const commandsInput = await vscode.window.showInputBox({
            prompt: "输入替换命令 (例如: search:《内容》 replace:《内容》)",
            placeHolder: "search:《旧》 replace:《新》",
            value: globalReplaceCommands 
        });
        if (commandsInput !== undefined) {
            globalReplaceCommands = commandsInput;
            provider.updateWebviewCommandsDisplay(globalReplaceCommands);
            vscode.window.showInformationMessage(`替换命令已设置为: ${globalReplaceCommands}`);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('newcline.executeReplaceInWebview', () => {
        provider.triggerExecuteReplace(true); // true 表示需要 Diff 和确认
    }));
    
    context.subscriptions.push(vscode.commands.registerCommand('newcline.loadActiveEditorToWebview', () => {
        provider.loadActiveEditorContent();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('newcline.startTool', () => {
        vscode.commands.executeCommand('workbench.view.extension.newcline-activitybar'); 
    }));

    console.log('>>>>>> [newcline] All commands registered.');
    console.log('>>>>>> [newcline] activate() function finished.');
}

class NewclineViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'newcline.sidebarView'; 

    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _context: vscode.ExtensionContext;
    private _currentOriginalCode: string = "// 点击“加载/刷新活动编辑器”按钮来加载内容。\n";
    private _currentSearchPattern: string = "";
    private _currentReplacePattern: string = "";
    private _lastPythonResult?: { modified_code: string; log: string[] }; // 存储上次Python执行结果


    constructor(
        private readonly extensionUri: vscode.Uri,
        context: vscode.ExtensionContext
    ) {
        this._extensionUri = extensionUri;
        this._context = context;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        resolveContext: vscode.WebviewViewResolveContext, 
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        console.log('>>>>>> [newcline] resolveWebviewView called for newcline.sidebarView.');

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'python_scripts'),
                vscode.Uri.joinPath(this._extensionUri, 'webview_assets') 
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        webviewView.onDidDispose(() => { /* ... */ }, null, this._context.subscriptions);
        webviewView.onDidChangeVisibility(() => { /* ... */ });
        this.loadActiveEditorContent();

        webviewView.webview.onDidReceiveMessage(async message => {
            console.log('>>>>>> [newcline] Provider received message from webview:', message);
            switch (message.command) {
                case 'requestActiveEditorContent':
                    this.loadActiveEditorContent();
                    return;
                case 'webviewCommandInput':
                    const commandText = message.text.trim();
                    if (commandText.toLowerCase().startsWith("search:")) {
                        this._currentSearchPattern = commandText;
                        globalReplaceCommands = `${this._currentSearchPattern}\n${this._currentReplacePattern}`.trim();
                        this.updateWebviewCommandsDisplay(globalReplaceCommands);
                        this._view?.webview.postMessage({ command: 'showFeedbackInLog', message: `搜索模式已更新: ${commandText}` });
                    } else if (commandText.toLowerCase().startsWith("replace:")) {
                        this._currentReplacePattern = commandText;
                        globalReplaceCommands = `${this._currentSearchPattern}\n${this._currentReplacePattern}`.trim();
                        this.updateWebviewCommandsDisplay(globalReplaceCommands);
                        this._view?.webview.postMessage({ command: 'showFeedbackInLog', message: `替换模式已更新: ${commandText}` });
                    } else if (commandText.toLowerCase() === "execute" || commandText.toLowerCase() === "run" || commandText.toLowerCase() === "diff") {
                        this.triggerExecuteReplace(true); // Webview 内的 execute 也触发 diff
                    } else {
                        this._view?.webview.postMessage({ command: 'showErrorInLog', message: `未知指令: ${commandText}` });
                    }
                    return;
                case 'executeReplaceRequestFromWebview': // 来自Webview按钮的执行请求
                    this.triggerExecuteReplace(true); // 也触发 diff
                    return;
            }
        });
    }

    public loadActiveEditorContent() {
        // ... (与之前版本基本相同) ...
        if (!this._view) { 
            console.log(">>>>>> [newcline] loadActiveEditorContent: View not available.");
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this._currentOriginalCode = editor.document.getText();
            this._view.webview.postMessage({
                command: 'setOriginalCodeAndLog',
                data: this._currentOriginalCode,
                log: "活动编辑器内容已加载。\n输入 search:《内容》 和 replace:《内容》指令，然后输入 diff 或点击执行按钮进行预览。"
            });
        } else {
            this._currentOriginalCode = "// 没有活动的编辑器。\n";
            this._view.webview.postMessage({
                command: 'showErrorInLog',
                message: '没有活动的编辑器可供加载内容。请打开一个文件。'
            });
        }
    }
    
    public updateWebviewCommandsDisplay(commands: string) {
        if (this._view) {
            this._view.webview.postMessage({ command: 'showFeedbackInLog', message: `当前替换指令已更新 (通过命令面板或API)。`});
        }
    }
    
    public triggerExecuteReplace(showDiff: boolean) { // 添加 showDiff 参数
        if (!this._view) {
            vscode.window.showErrorMessage("Webview 未准备好执行替换。");
            return;
        }
        if (this._currentSearchPattern || this._currentReplacePattern) {
            globalReplaceCommands = `${this._currentSearchPattern}\n${this._currentReplacePattern}`.trim();
        }
        if (!globalReplaceCommands) {
             this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：替换指令未设置。' });
            return;
        }
        if (this._currentOriginalCode.trim() === "// 点击“加载/刷新活动编辑器”按钮来加载内容。\n" || this._currentOriginalCode.trim() === "// 没有活动的编辑器。\n" || !this._currentOriginalCode.trim()) {
            this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：原文代码未有效加载。' });
            return;
        }
        
        this._executePythonScriptInternal(globalReplaceCommands, this._currentOriginalCode, this._context, this._view.webview, showDiff);
    }

    private async _executePythonScriptInternal(commandsToExecute: string, originalCodeContent: string, context: vscode.ExtensionContext, webview: vscode.Webview, showDiff: boolean) {
        console.log('>>>>>> [newcline] _executePythonScriptInternal called. showDiff:', showDiff);
        // ... (Python脚本路径和解释器获取逻辑与之前相同) ...
        const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python_scripts', 'new.py').fsPath;
        if (!fs.existsSync(pythonScriptPath)) { /* ... */ return; }
        const pythonPath = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath') || 'python3';

        const pythonProcess = spawn(pythonPath, [
            pythonScriptPath, '--commands', commandsToExecute, '--original_code', originalCodeContent
        ], { env: { ...process.env, 'PYTHONIOENCODING': 'UTF-8' } });

        let scriptOutput = '';
        let scriptError = '';
        pythonProcess.stdout.setEncoding('utf8');
        pythonProcess.stderr.setEncoding('utf8');
        pythonProcess.stdout.on('data', (data) => { scriptOutput += data; });
        pythonProcess.stderr.on('data', (data) => { scriptError += data; });

        pythonProcess.on('close', async (code) => { // 标记为 async
            console.log(`>>>>>> [newcline] Python script exited with code ${code}`);
            console.log('>>>>>> [newcline] Full Python stdout before parsing:', scriptOutput); 

            if (code === 0) {
                try {
                    const result = JSON.parse(scriptOutput);
                    this._lastPythonResult = result; // 保存结果以便应用
                    console.log('>>>>>> [newcline] Parsed Python result:', result); 
                    
                    // 更新 Webview 中的日志和替换后预览（即使要显示Diff，也先在Webview中预览）
                    webview.postMessage({ command: 'updateResult', data: result }); 

                    if (showDiff) {
                        const activeEditor = vscode.window.activeTextEditor;
                        if (activeEditor && activeEditor.document.getText() === originalCodeContent) { // 确保是对当前活动编辑器的原文操作
                            // 创建一个临时的untitled文档来显示修改后的内容
                            const modifiedContentDocument = await vscode.workspace.openTextDocument({
                                content: result.modified_code,
                                language: activeEditor.document.languageId // 使用与原文相同的语言模式
                            });
                            const diffTitle = `替换预览: ${path.basename(activeEditor.document.fileName)}`;
                            await vscode.commands.executeCommand('vscode.diff', activeEditor.document.uri, modifiedContentDocument.uri, diffTitle);
                            
                            // 显示确认对话框
                            const selection = await vscode.window.showInformationMessage(
                                '已生成替换预览。是否应用这些更改到活动文件？',
                                { modal: true },
                                '应用修改',
                                '放弃更改'
                            );

                            if (selection === '应用修改') {
                                await this._applyChangesToActiveEditor(result.modified_code);
                                // 可以考虑关闭 diff 视图，但这比较复杂，通常用户会自己关闭
                            } else {
                                webview.postMessage({ command: 'showErrorInLog', message: '用户已放弃更改。' });
                            }

                        } else {
                            webview.postMessage({ command: 'showErrorInLog', message: '错误：无法对非活动编辑器或已更改的编辑器内容进行Diff预览。结果仅在Webview中显示。' });
                        }
                    }
                    // 如果 !showDiff (例如，如果将来我们有直接应用的命令)，则不执行 diff 和确认

                } catch (e) { /* ... (错误处理与之前相同) ... */ }
            } else { /* ... (错误处理与之前相同) ... */ }
        });
        pythonProcess.on('error', (err) => { /* ... (错误处理与之前相同) ... */ });
    }

    private async _applyChangesToActiveEditor(newContent: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            if (editor.document.getText() !== this._currentOriginalCode) {
                // 内容在预览后被修改了，需要用户注意
                const decision = await vscode.window.showWarningMessage(
                    '活动编辑器的内容在生成预览后已被修改。是否仍要覆盖并应用替换？',
                    { modal: true },
                    '仍要应用',
                    '取消'
                );
                if (decision !== '仍要应用') {
                    this._view?.webview.postMessage({ command: 'showErrorInLog', message: '由于文件已更改，操作已取消。' });
                    return;
                }
            }

            const document = editor.document;
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, fullRange, newContent);
            
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                vscode.window.showInformationMessage('文件修改已应用！');
                this._view?.webview.postMessage({ command: 'showErrorInLog', message: '文件修改已成功应用。' });
                this.loadActiveEditorContent(); // 重新加载更新后的内容
            } else {
                vscode.window.showErrorMessage('应用文件修改失败！');
                this._view?.webview.postMessage({ command: 'showErrorInLog', message: '错误：应用文件修改失败。' });
            }
        } else {
            vscode.window.showErrorMessage('没有活动的编辑器来应用修改。');
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // HTML 内容与 Canvas "src/extension.ts (侧边栏对话式输入 - 阶段2.1)" 中的基本一致
        // 确保 Webview 中的按钮和消息处理与 Provider 的方法相对应
        // 主要变化是 Webview 中的“执行替换”按钮现在会发送 'executeReplaceRequestFromWebview'
        // 并且日志区提示用户使用 diff 或 execute 指令
        return `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" 
                  content="default-src 'none';
                           style-src ${webview.cspSource} 'unsafe-inline';
                           script-src ${webview.cspSource} 'unsafe-inline';
                           font-src ${webview.cspSource} data:;
                           img-src ${webview.cspSource} https: data:;">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>NewCLine 替换工具</title>
            <style>
                body {
                    font-family: var(--vscode-font-family); 
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 10px; 
                    display: flex;
                    flex-direction: column;
                    height: 100%; 
                    box-sizing: border-box;
                    overflow-y: hidden;
                }
                .section {
                    margin-bottom: 8px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px;
                    display: flex;
                    flex-direction: column;
                }
                .section label {
                    padding: 6px 8px; 
                    font-weight: bold;
                    font-size: var(--vscode-font-size); 
                    background-color: var(--vscode-sideBar-background); 
                    border-bottom: 1px solid var(--vscode-input-border);
                    flex-shrink: 0;
                }
                textarea, div.log-area, #commandInputContainer {
                    padding: 6px 8px; 
                    border: none; 
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family); 
                    resize: none; 
                    box-sizing: border-box;
                    line-height: var(--vscode-editor-line-height);
                    font-size: var(--vscode-editor-font-size);
                }
                textarea {
                    flex-grow: 1; 
                    width: 100%; 
                    min-height: 80px; 
                }
                #originalCodePanel, #modifiedCodePanel {
                    flex: 1; 
                    min-height: 100px;
                }
                #logPanel {
                    flex: 0.5; 
                    min-height: 60px;
                }
                div.log-area { 
                    min-height: 50px; 
                    white-space: pre-wrap;
                    overflow-y: auto; 
                    flex-grow: 1;
                    background-color: var(--vscode-textCodeBlock-background); 
                }
                .button-container {
                    margin-bottom: 8px; 
                    flex-shrink: 0;
                }
                button {
                    padding: 4px 10px; 
                    border: 1px solid var(--vscode-button-border, transparent); 
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    cursor: pointer;
                    margin-right: 8px; 
                    border-radius: 3px; 
                    font-size: var(--vscode-font-size);
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                h4 { margin-top: 0; margin-bottom: 8px; font-size: calc(var(--vscode-font-size) + 1px);}

                #commandInputContainer {
                    display: flex;
                    padding: 0; 
                    margin-top: 8px;
                    margin-bottom: 10px;
                    flex-shrink: 0;
                }
                #commandInputField {
                    flex-grow: 1;
                    padding: 6px 8px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-font-size);
                    border-radius: 3px 0 0 3px; 
                }
                #sendCommandButton {
                    padding: 6px 10px;
                    border: 1px solid var(--vscode-button-border, var(--vscode-input-border)); 
                    border-left: none; 
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    cursor: pointer;
                    border-radius: 0 3px 3px 0; 
                    font-size: var(--vscode-font-size);
                }
                #sendCommandButton:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <h4>NewCLine 替换工具</h4>

            <div class="button-container">
                <button id="loadActiveEditorButton">加载/刷新活动编辑器</button>
                <button id="executeReplaceButtonWebview">执行替换/预览 (使用已设置指令)</button> 
            </div>

            <div id="originalCodePanel" class="section">
                <label for="originalCodeText">原文预览 (只读):</label>
                <textarea id="originalCodeText" readonly></textarea>
            </div>

            <div id="modifiedCodePanel" class="section">
                <label for="modifiedCodeText">替换后预览 (只读):</label>
                <textarea id="modifiedCodeText" readonly></textarea>
            </div>
            
            <div id="logPanel" class="section"> 
                <label for="logTextDisplay">操作日志:</label>
                <div id="logTextDisplay" class="log-area">请加载内容，通过下方输入框或命令面板输入search/replace指令，然后输入diff/execute或点击执行按钮。</div>
            </div>

            <div id="commandInputContainer">
                <input type="text" id="commandInputField" placeholder="输入 search:《》, replace:《》, diff, 或 execute">
                <button id="sendCommandButton">发送</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                const loadActiveEditorButton = document.getElementById('loadActiveEditorButton');
                const executeButtonWebview = document.getElementById('executeReplaceButtonWebview');
                const originalCodeTextArea = document.getElementById('originalCodeText');
                const modifiedCodeTextArea = document.getElementById('modifiedCodeText');
                const logTextDisplay = document.getElementById('logTextDisplay');
                const commandInputField = document.getElementById('commandInputField'); 
                const sendCommandButton = document.getElementById('sendCommandButton'); 

                loadActiveEditorButton.addEventListener('click', () => {
                    originalCodeTextArea.value = ""; 
                    modifiedCodeTextArea.value = ""; 
                    logTextDisplay.textContent = "正在请求加载活动编辑器内容...\\n";
                    vscode.postMessage({ command: 'requestActiveEditorContent' });
                });

                executeButtonWebview.addEventListener('click', () => {
                    logTextDisplay.textContent = "请求执行替换/预览...\\n";
                    vscode.postMessage({ command: 'executeReplaceRequestFromWebview' });
                });

                function sendWebviewCommand() {
                    const commandText = commandInputField.value;
                    if (commandText.trim() === "") return;
                    logTextDisplay.textContent += \`> \${commandText}\\n\`; 
                    vscode.postMessage({ command: 'webviewCommandInput', text: commandText });
                    commandInputField.value = ""; 
                }
                sendCommandButton.addEventListener('click', sendWebviewCommand);
                commandInputField.addEventListener('keypress', function (e) {
                    if (e.key === 'Enter') {
                        sendWebviewCommand();
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    console.log("Sidebar Webview received message:", message);
                    const currentLog = logTextDisplay.textContent;
                    const endsWithNewline = currentLog.endsWith('\\n') || currentLog === "" || currentLog.endsWith(logTextDisplay.innerHTML.includes('<br>') ? '<br>' : '\\n');
                    const prefix = endsWithNewline ? "" : "\\n";

                    switch (message.command) {
                        case 'setOriginalCodeAndLog':
                            originalCodeTextArea.value = message.data || "未能加载内容或活动编辑器为空。";
                            modifiedCodeTextArea.value = ""; 
                            logTextDisplay.textContent = message.log || "内容已加载或更新。";
                            break;
                        case 'updateResult': // Python脚本执行后的结果（可能是在Diff之前或之后）
                            modifiedCodeTextArea.value = message.data.modified_code || '';
                            logTextDisplay.textContent = (message.data.log || ['处理完成（预览）。']).join('\\n');
                            break;
                        case 'showErrorInLog':
                            logTextDisplay.textContent += prefix + "错误: " + message.message + "\\n";
                            break;
                        case 'showFeedbackInLog': 
                            logTextDisplay.textContent += prefix + message.message + "\\n";
                            break;
                    }
                    logTextDisplay.scrollTop = logTextDisplay.scrollHeight;
                });
            </script>
        </body>
        </html>`;
    }
}

export function deactivate() {
    console.log('>>>>>> [newcline] deactivate() function called.');
}
