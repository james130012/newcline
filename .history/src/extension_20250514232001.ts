import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// 全局变量，用于存储从 Webview 或 InputBox 获取的最新命令输入
// 现在它将存储用户输入的整个命令文本块
let globalReplaceCommands: string = `// 在此输入或粘贴替换指令，例如:
// search:《要查找的文本1》
// replace:《替换为的文本1》
// 
// # 这是注释行，会被忽略
// search:《要查找的文本2》
// replace:《替换为的文本2》`; 

export function activate(context: vscode.ExtensionContext) {
    console.log('>>>>>> [newcline] activate() function called.');

    const provider = new NewclineViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(NewclineViewProvider.viewType, provider, {
            webviewOptions: { retainContextWhenHidden: true } 
        })
    );
    console.log('>>>>>> [newcline] NewclineViewProvider registered.');

    // 命令：用于从 VS Code 输入框接收替换命令 (保留作为备用或快速设置方式)
    context.subscriptions.push(vscode.commands.registerCommand('newcline.enterReplaceCommands', async () => {
        const commandsInput = await vscode.window.showInputBox({
            prompt: "输入替换命令文本块 (包含多对 search:《》 replace:《》)",
            placeHolder: "search:《旧》 replace:《新》\nsearch:《其他》 replace:《别的》",
            value: globalReplaceCommands,
            valueSelection: [globalReplaceCommands.length, globalReplaceCommands.length], // 将光标置于末尾
            ignoreFocusOut: true, // 避免输入框意外关闭
        });
        if (commandsInput !== undefined) {
            globalReplaceCommands = commandsInput;
            provider.updateWebviewCommandsDisplay(globalReplaceCommands); 
            vscode.window.showInformationMessage(`替换命令已更新。`);
        }
    }));

    // 命令：用于触发替换（现在会先显示Diff）
    context.subscriptions.push(vscode.commands.registerCommand('newcline.executeReplaceInWebview', () => {
        provider.triggerExecuteReplaceAndShowDiff(); 
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
    // 不再需要 _currentSearchPattern 和 _currentReplacePattern，因为 globalReplaceCommands 存储完整指令块
    private _lastPythonResult?: { modified_code: string; log: string[] };


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
        
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                console.log('>>>>>> [newcline] Sidebar webview became visible.');
                this.loadActiveEditorContent(); 
                // 当视图可见时，也用当前的 globalReplaceCommands 更新 Webview 中的命令输入区
                this._view?.webview.postMessage({ command: 'setCommandInputArea', text: globalReplaceCommands });
            }
        });
        
        this.loadActiveEditorContent(); 
        // 初始加载时也设置命令输入区的内容
        // 需要稍微延迟，确保 Webview 的 JS 已加载并准备好接收消息
        setTimeout(() => {
            this._view?.webview.postMessage({ command: 'setCommandInputArea', text: globalReplaceCommands });
        }, 100);


        webviewView.webview.onDidReceiveMessage(async message => { 
            console.log('>>>>>> [newcline] Provider received message from webview:', message);
            switch (message.command) {
                case 'requestActiveEditorContent':
                    this.loadActiveEditorContent();
                    return;
                case 'updateGlobalCommands': // Webview 中的命令文本区内容改变时发送此消息
                    if (typeof message.text === 'string') {
                        globalReplaceCommands = message.text;
                        console.log('>>>>>> [newcline] globalReplaceCommands updated from webview.');
                        // 可以在这里加一个简短的日志反馈到 Webview，表明已收到
                        this._view?.webview.postMessage({ command: 'showFeedbackInLog', message: '替换指令已更新。' });
                    }
                    return;
                case 'executeReplaceRequestFromWebview': // Webview 内的“执行替换”按钮触发
                    // 确保 globalReplaceCommands 是最新的（从 Webview 的 updateGlobalCommands 获取）
                    this.triggerExecuteReplaceAndShowDiff();
                    return;
            }
        });
    }

    public loadActiveEditorContent() {
        if (!this._view) { return; }
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this._currentOriginalCode = editor.document.getText();
            this._lastPythonResult = undefined; 
            this._view.webview.postMessage({
                command: 'setOriginalCodeAndLog',
                data: this._currentOriginalCode,
                log: "活动编辑器内容已加载。\n请在下方命令区输入替换指令，然后点击“执行/预览”按钮。"
            });
        } else {
            this._currentOriginalCode = "// 没有活动的编辑器。\n";
            this._lastPythonResult = undefined; 
            this._view.webview.postMessage({
                command: 'showErrorInLog',
                message: '没有活动的编辑器可供加载内容。请打开一个文件。'
            });
        }
    }
    
    // 这个方法现在可能不太需要，因为命令直接在Webview中编辑，并通过 updateGlobalCommands 更新
    public updateWebviewCommandsDisplay(commands: string) {
        if (this._view) {
            this._view.webview.postMessage({ command: 'setCommandInputArea', text: commands });
            this._view.webview.postMessage({ command: 'showFeedbackInLog', message: `替换指令已通过API更新。`});
        }
    }
    
    public triggerExecuteReplaceAndShowDiff() {
        if (!this._view) { /* ... */ return; }
        if (!globalReplaceCommands || globalReplaceCommands.trim() === "" || globalReplaceCommands.startsWith("// 在此输入或粘贴替换指令")) {
             this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：替换指令未设置或为空。' });
            return;
        }
        if (this._currentOriginalCode.trim() === "// 点击“加载/刷新活动编辑器”按钮来加载内容。\n" || this._currentOriginalCode.trim() === "// 没有活动的编辑器。\n" || !this._currentOriginalCode.trim()) {
            this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：原文代码未有效加载。' });
            return;
        }
        
        this._executePythonAndHandleDiff(globalReplaceCommands, this._currentOriginalCode);
    }

    private async _executePythonAndHandleDiff(commandsToExecute: string, originalCodeContent: string) {
        // ... (Python 脚本调用、结果处理、Diff 显示、用户确认、应用修改的逻辑与之前版本相同) ...
        // 确保这部分逻辑能正确处理 Python 返回的 JSON
        if (!this._view) return;
        const webview = this._view.webview;

        console.log('>>>>>> [newcline] _executePythonAndHandleDiff called.');
        this._lastPythonResult = undefined; 

        try {
            const pythonScriptPath = vscode.Uri.joinPath(this._context.extensionUri, 'python_scripts', 'new.py').fsPath;
            if (!fs.existsSync(pythonScriptPath)) {
                console.error('>>>>>> [newcline] Python script not found at:', pythonScriptPath);
                webview.postMessage({ command: 'showErrorInLog', message: `Python 脚本未找到: ${pythonScriptPath}` });
                return;
            }

            const pythonPath = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath') || 'python3';
            console.log(`>>>>>> [newcline] Using Python path: ${pythonPath}`);

            const pythonProcess = spawn(pythonPath, [
                pythonScriptPath, '--commands', commandsToExecute, '--original_code', originalCodeContent
            ], { env: { ...process.env, 'PYTHONIOENCODING': 'UTF-8' } });

            let scriptOutput = '';
            let scriptError = '';
            pythonProcess.stdout.setEncoding('utf8');
            pythonProcess.stderr.setEncoding('utf8');
            pythonProcess.stdout.on('data', (data) => { scriptOutput += data; });
            pythonProcess.stderr.on('data', (data) => { scriptError += data; });

            pythonProcess.on('close', async (code) => {
                console.log(`>>>>>> [newcline] Python script exited with code ${code}`);
                console.log('>>>>>> [newcline] Full Python stdout before parsing:', scriptOutput); 

                if (code === 0 && scriptOutput.trim()) {
                    try {
                        const result = JSON.parse(scriptOutput);
                        this._lastPythonResult = result; 
                        console.log('>>>>>> [newcline] Parsed Python result:', result); 
                        
                        webview.postMessage({ command: 'updateResult', data: result }); 

                        const activeEditor = vscode.window.activeTextEditor;
                        if (activeEditor && activeEditor.document.getText() === originalCodeContent) {
                            const modifiedContentDocument = await vscode.workspace.openTextDocument({
                                content: result.modified_code,
                                language: activeEditor.document.languageId 
                            });
                            const diffTitle = `替换预览: ${path.basename(activeEditor.document.fileName)}`;
                            await vscode.commands.executeCommand('vscode.diff', activeEditor.document.uri, modifiedContentDocument.uri, diffTitle, { preview: true }); 
                            
                            const selection = await vscode.window.showInformationMessage(
                                '已生成替换预览 (新标签页)。是否应用这些更改到活动文件？',
                                { modal: true }, '应用修改', '放弃更改'
                            );

                            if (selection === '应用修改') {
                                await this._applyChangesToActiveEditor(result.modified_code);
                            } else {
                                webview.postMessage({ command: 'showFeedbackInLog', message: '用户已放弃更改。' });
                            }
                        } else {
                            webview.postMessage({ command: 'showErrorInLog', message: '错误：活动编辑器内容已更改或不可用，无法进行Diff预览。结果仅在Webview中显示。' });
                        }
                    } catch (e) { 
                        console.error('>>>>>> [newcline] Error parsing Python script output:', e);
                        webview.postMessage({ command: 'showErrorInLog', message: `解析Python脚本输出错误: ${e}. \n原始输出: ${scriptOutput}`});
                    }
                } else if (code !== 0) { /* ... */ } else { /* ... */ }
            });
            pythonProcess.on('error', (err) => { /* ... */ });
        } catch (error: any) { /* ... */ }
    }

    private async _applyChangesToActiveEditor(newContent: string) {
        // ... (与之前版本相同) ...
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            if (editor.document.getText() !== this._currentOriginalCode) {
                const decision = await vscode.window.showWarningMessage(
                    '活动编辑器的内容在生成预览后已被修改。是否仍要覆盖并应用替换？',
                    { modal: true }, '应用', '取消'
                );
                if (decision !== '应用') {
                    this._view?.webview.postMessage({ command: 'showFeedbackInLog', message: '由于文件已更改，操作已取消。' });
                    return;
                }
            }

            const document = editor.document;
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, fullRange, newContent);
            
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                vscode.window.showInformationMessage('文件修改已应用！');
                this._view?.webview.postMessage({ command: 'showFeedbackInLog', message: '文件修改已成功应用。' });
                this._currentOriginalCode = newContent; 
                this._view?.webview.postMessage({ command: 'setOriginalCodeAndLog', data: this._currentOriginalCode, log: "文件已修改并重新加载到预览。" });
            } else { 
                vscode.window.showErrorMessage('应用文件修改失败！');
                this._view?.webview.postMessage({ command: 'showErrorInLog', message: '错误：应用文件修改失败。' });
            }
        } else { 
            vscode.window.showErrorMessage('没有活动的编辑器来应用修改。');
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const initialCommandText = globalReplaceCommands.replace(/\n/g, '\\n').replace(/'/g, "\\'"); // 转义换行和单引号以便在JS字符串中使用
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
                textarea, div.log-area { /* 命令输入区也用textarea */
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
                textarea { /* 通用textarea样式 */
                    flex-grow: 1; 
                    width: 100%; 
                }
                /* 特定区域的高度和最小高度 */
                #originalCodePanel, #modifiedCodePanel { flex: 1; min-height: 80px; }
                #commandInputPanel { flex-shrink:0; min-height: 60px; height: 100px; } /* 命令输入区固定一些高度 */
                #logPanel { flex: 0.5; min-height: 50px; }

                div.log-area { 
                    min-height: 40px; /* 调整日志区最小高度 */
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
            </style>
        </head>
        <body>
            <h4>NewCLine 替换工具</h4>

            <div class="button-container">
                <button id="loadActiveEditorButton">加载/刷新活动编辑器</button>
                <button id="executeReplaceButtonWebview">执行替换/预览</button> 
            </div>

            <div id="commandInputPanel" class="section">
                <label for="batchCommandInputArea">替换指令 (可输入多对 search/replace):</label>
                <textarea id="batchCommandInputArea" rows="4"></textarea> </div>

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
                <div id="logTextDisplay" class="log-area">请加载内容，在上方命令区输入替换指令，然后点击“执行/预览”按钮。</div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                const loadActiveEditorButton = document.getElementById('loadActiveEditorButton');
                const executeButtonWebview = document.getElementById('executeReplaceButtonWebview');
                const batchCommandInputArea = document.getElementById('batchCommandInputArea'); // 新的命令输入区
                const originalCodeTextArea = document.getElementById('originalCodeText');
                const modifiedCodeTextArea = document.getElementById('modifiedCodeText');
                const logTextDisplay = document.getElementById('logTextDisplay');

                // 当命令输入区内容改变时，自动发送给后端更新 globalReplaceCommands
                batchCommandInputArea.addEventListener('input', () => {
                    vscode.postMessage({ command: 'updateGlobalCommands', text: batchCommandInputArea.value });
                });
                
                // 设置初始命令区内容
                batchCommandInputArea.value = '${initialCommandText}'.replace(/\\\\n/g, '\\n').replace(/\\\\'/g, "\\'");


                loadActiveEditorButton.addEventListener('click', () => {
                    originalCodeTextArea.value = ""; 
                    modifiedCodeTextArea.value = ""; 
                    logTextDisplay.textContent = "正在请求加载活动编辑器内容...\\n";
                    vscode.postMessage({ command: 'requestActiveEditorContent' });
                });

                executeButtonWebview.addEventListener('click', () => {
                    // 在点击执行时，也确保将当前命令区的内容发送一次，以防用户修改后未触发input事件
                    vscode.postMessage({ command: 'updateGlobalCommands', text: batchCommandInputArea.value });
                    logTextDisplay.textContent = "请求执行替换/预览...\\n";
                    vscode.postMessage({ command: 'executeReplaceRequestFromWebview' });
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
                        case 'updateResult': 
                            modifiedCodeTextArea.value = message.data.modified_code || '';
                            logTextDisplay.textContent = (message.data.log || ['处理完成（预览）。']).join('\\n');
                            break;
                        case 'showErrorInLog':
                            logTextDisplay.textContent += prefix + "错误: " + message.message + "\\n";
                            break;
                        case 'showFeedbackInLog': 
                            logTextDisplay.textContent += prefix + message.message + "\\n";
                            break;
                        case 'setCommandInputArea': // 用于从后端设置命令输入区的内容
                            batchCommandInputArea.value = message.text;
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
