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

    // 命令：用于从 VS Code 输入框接收替换命令
    context.subscriptions.push(vscode.commands.registerCommand('newcline.enterReplaceCommands', async () => {
        const commandsInput = await vscode.window.showInputBox({
            prompt: "输入替换命令文本块 (包含多对 search:《》 replace:《》)",
            placeHolder: "search:《旧》 replace:《新》\nsearch:《其他》 replace:《别的》",
            value: globalReplaceCommands,
            valueSelection: [globalReplaceCommands.length, globalReplaceCommands.length], 
            ignoreFocusOut: true, 
        });
        if (commandsInput !== undefined) {
            globalReplaceCommands = commandsInput;
            provider.setWebviewCommandInputArea(globalReplaceCommands); // 通知Webview更新其命令输入区
            vscode.window.showInformationMessage(`替换命令已更新。`);
        }
    }));

    // 命令：用于触发替换（现在会先显示Diff）
    context.subscriptions.push(vscode.commands.registerCommand('newcline.executeReplaceInWebview', () => {
        provider.triggerExecuteReplaceAndShowDiff(); 
    }));
    
    // 命令：用于加载活动编辑器内容到Webview
    context.subscriptions.push(vscode.commands.registerCommand('newcline.loadActiveEditorToWebview', () => {
        provider.loadActiveEditorContent();
    }));

    // 命令：用于打开插件的活动栏视图
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
    private _currentOriginalDocumentUri?: vscode.Uri; 
    private _lastPythonResult?: { modified_code: string; log: string[] };


    constructor(
        private readonly extensionUri: vscode.Uri,
        context: vscode.ExtensionContext
    ) {
        this._extensionUri = extensionUri;
        this._context = context;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView, // webviewView 是传入的参数
        resolveContext: vscode.WebviewViewResolveContext, 
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView; // 将参数赋值给类成员 this._view
        console.log('>>>>>> [newcline] resolveWebviewView called for newcline.sidebarView.');

        // 后续使用参数 webviewView 来配置当前正在解析的视图
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'python_scripts'),
                vscode.Uri.joinPath(this._extensionUri, 'webview_assets') 
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        webviewView.onDidDispose(() => {
            console.log('>>>>>> [newcline] Sidebar webview disposed.');
            this._view = undefined; 
        }, null, this._context.subscriptions);

        webviewView.onDidChangeVisibility(() => {
            if (this._view && this._view.visible) { // 确保使用 this._view 检查可见性
                console.log('>>>>>> [newcline] Sidebar webview became visible.');
                this.loadActiveEditorContent(); 
                this.setWebviewCommandInputArea(globalReplaceCommands); 
            }
        });
        
        this.loadActiveEditorContent(); 
        setTimeout(() => {
            // 在 setTimeout 的回调中，webviewView 参数可能已失效，应使用 this._view
            this._view?.webview.postMessage({ command: 'setCommandInputArea', text: globalReplaceCommands });
        }, 100);


        webviewView.webview.onDidReceiveMessage(async (message: any) => { // 给 message 添加 any 类型
            console.log('>>>>>> [newcline] Provider received message from webview:', message);
            switch (message.command) {
                case 'requestActiveEditorContent':
                    this.loadActiveEditorContent();
                    return;
                case 'updateGlobalCommands': 
                    if (typeof message.text === 'string') {
                        globalReplaceCommands = message.text;
                        console.log('>>>>>> [newcline] globalReplaceCommands updated from webview.');
                        this._view?.webview.postMessage({ command: 'showFeedbackInLog', message: '替换指令已更新。' });
                    }
                    return;
                case 'executeReplaceRequestFromWebview': 
                    this.triggerExecuteReplaceAndShowDiff();
                    return;
            }
        });
    }

    public loadActiveEditorContent() {
        if (!this._view) { 
            console.log(">>>>>> [newcline] loadActiveEditorContent: View not available.");
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this._currentOriginalCode = editor.document.getText();
            this._currentOriginalDocumentUri = editor.document.uri; 
            this._lastPythonResult = undefined; 
            this._view.webview.postMessage({
                command: 'setOriginalCodeAndLog',
                data: this._currentOriginalCode,
                log: `活动编辑器内容 (${path.basename(editor.document.fileName)}) 已加载。\n请在下方命令区输入替换指令，然后点击“执行/预览”按钮。`
            });
        } else {
            this._currentOriginalCode = "// 没有活动的编辑器。\n";
            this._currentOriginalDocumentUri = undefined; 
            this._lastPythonResult = undefined; 
            this._view.webview.postMessage({
                command: 'showErrorInLog',
                message: '没有活动的编辑器可供加载内容。请打开一个文件。'
            });
        }
    }
    
    public setWebviewCommandInputArea(commands: string) { // 新增方法，用于从外部更新Webview的命令输入区
        if (this._view) {
            this._view.webview.postMessage({ command: 'setCommandInputArea', text: commands });
        }
    }
    
    public triggerExecuteReplaceAndShowDiff() {
        if (!this._view) { 
            vscode.window.showErrorMessage("Webview 未准备好执行替换。");
            return; 
        }
        if (!globalReplaceCommands || globalReplaceCommands.trim() === "" || globalReplaceCommands.startsWith("// 在此输入或粘贴替换指令")) {
            this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：替换指令未设置或为空。' });
            return;
        }
        if (!this._currentOriginalDocumentUri || this._currentOriginalCode.trim() === "// 点击“加载/刷新活动编辑器”按钮来加载内容。\n" || this._currentOriginalCode.trim() === "// 没有活动的编辑器。\n" || !this._currentOriginalCode.trim()) {
            this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：原文代码未有效加载。请先加载活动编辑器内容。' });
            return;
        }
        
        this._executePythonAndHandleDiff(globalReplaceCommands, this._currentOriginalCode, this._currentOriginalDocumentUri);
    }

    private async _executePythonAndHandleDiff(commandsToExecute: string, originalCodeContent: string, originalDocUri: vscode.Uri) {
        if (!this._view) return;
        const webview = this._view.webview; 

        console.log('>>>>>> [newcline] _executePythonAndHandleDiff called for doc:', originalDocUri.fsPath);
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
                        // 确保是对当前活动编辑器的原文进行操作，并且原文未在预览生成后被修改
                        // 比较 originalDocUri 是否与当前活动编辑器的 URI 相同
                        if (activeEditor && activeEditor.document.uri.toString() === originalDocUri.toString() && activeEditor.document.getText() === originalCodeContent) {
                            const modifiedContentDocument = await vscode.workspace.openTextDocument({
                                content: result.modified_code,
                                language: activeEditor.document.languageId 
                            });
                            const diffTitle = `替换预览: ${path.basename(originalDocUri.fsPath)}`;
                            await vscode.commands.executeCommand('vscode.diff', originalDocUri, modifiedContentDocument.uri, diffTitle, { preview: true }); 
                            
                            const selection = await vscode.window.showInformationMessage(
                                '已生成替换预览 (新标签页)。是否应用这些更改到原始文件？',
                                { modal: true }, '应用修改', '放弃更改'
                            );

                            if (selection === '应用修改') {
                                await this._applyChangesToDocument(originalDocUri, originalCodeContent, result.modified_code);
                            } else {
                                webview.postMessage({ command: 'showFeedbackInLog', message: '用户已放弃更改。' });
                            }
                        } else {
                            let errorMessage = '错误：无法进行Diff预览。';
                            if (!activeEditor || activeEditor.document.uri.toString() !== originalDocUri.toString()){
                                errorMessage += '目标文件不再是活动编辑器。';
                            } else if (activeEditor.document.getText() !== originalCodeContent) {
                                errorMessage += '活动编辑器内容在预览生成后已被修改。';
                            }
                            errorMessage += '结果仅在Webview中显示。';
                            webview.postMessage({ command: 'showErrorInLog', message: errorMessage });
                        }
                    } catch (e: any) { 
                        console.error('>>>>>> [newcline] Error parsing Python script output:', e);
                        webview.postMessage({ command: 'showErrorInLog', message: `解析Python脚本输出错误: ${e.message}. \n原始输出: ${scriptOutput}`});
                    }
                } else if (code !== 0) { 
                    console.error('>>>>>> [newcline] Python script execution failed.');
                    webview.postMessage({ command: 'showErrorInLog', message: `Python 脚本执行失败 (退出码: ${code}). \n错误: ${scriptError || 'N/A'} \n输出: ${scriptOutput}`});
                } else { 
                     console.warn('>>>>>> [newcline] Python script exited successfully but produced no output.');
                     webview.postMessage({ command: 'showErrorInLog', message: 'Python脚本成功执行但没有返回任何内容。'});
                }
            });
            pythonProcess.on('error', (err) => { 
                console.error('>>>>>> [newcline] Failed to start Python process:', err);
                webview.postMessage({ command: 'showErrorInLog', message: `启动 Python 进程失败: ${err.message}` });
            });
        } catch (error: any) { 
            console.error('>>>>>> [newcline] Error executing Python script:', error);
            webview.postMessage({ command: 'showErrorInLog', message: `执行 Python 脚本时出错: ${error.message}` });
        }
    }

    private async _applyChangesToDocument(documentUri: vscode.Uri, originalContentBeforeDiff: string, newContent: string) {
        if (!this._view) return;
        
        let documentToEdit: vscode.TextDocument | undefined;
        try {
            documentToEdit = await vscode.workspace.openTextDocument(documentUri);
        } catch (e: any) {
            vscode.window.showErrorMessage(`无法打开原始文件以应用修改: ${documentUri.fsPath}`);
            this._view.webview.postMessage({ command: 'showErrorInLog', message: `错误: 无法打开原始文件 ${documentUri.fsPath}. ${e.message}` });
            return;
        }

        if (documentToEdit.getText() !== originalContentBeforeDiff) {
            const decision = await vscode.window.showWarningMessage(
                '原始文件的内容在生成预览后已被修改。是否仍要覆盖并应用替换？',
                { modal: true }, '仍要应用', '取消'
            );
            if (decision !== '仍要应用') {
                this._view.webview.postMessage({ command: 'showFeedbackInLog', message: '由于文件已更改，操作已取消。' });
                return;
            }
        }

        const fullRange = new vscode.Range(
            documentToEdit.positionAt(0),
            documentToEdit.positionAt(documentToEdit.getText().length)
        );
        
        const edit = new vscode.WorkspaceEdit();
        edit.replace(documentUri, fullRange, newContent); 
        
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            vscode.window.showInformationMessage('文件修改已应用！');
            this._view.webview.postMessage({ command: 'showFeedbackInLog', message: '文件修改已成功应用。' });
            
            if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.toString() === documentUri.toString()) {
                this._currentOriginalCode = newContent; 
                this._currentOriginalDocumentUri = documentUri;
                this._view.webview.postMessage({ command: 'setOriginalCodeAndLog', data: this._currentOriginalCode, log: "文件已修改并重新加载到预览。" });
            } else { 
                 this._view.webview.postMessage({ command: 'showFeedbackInLog', message: `文件 ${path.basename(documentUri.fsPath)} 已被修改。` });
            }

        } else { 
            vscode.window.showErrorMessage('应用文件修改失败！');
            this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：应用文件修改失败。' });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const initialCommandText = globalReplaceCommands.replace(/\n/g, '\\n').replace(/'/g, "\\'");
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
                textarea, div.log-area { 
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
                #commandInputPanel { 
                    flex-shrink:0; 
                    min-height: 60px; 
                    height: 120px; 
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
                <textarea id="batchCommandInputArea" rows="4"></textarea>
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
                <div id="logTextDisplay" class="log-area">请加载内容，在上方命令区输入替换指令，然后点击“执行/预览”按钮。</div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                const loadActiveEditorButton = document.getElementById('loadActiveEditorButton');
                const executeButtonWebview = document.getElementById('executeReplaceButtonWebview');
                const batchCommandInputArea = document.getElementById('batchCommandInputArea');
                const originalCodeTextArea = document.getElementById('originalCodeText');
                const modifiedCodeTextArea = document.getElementById('modifiedCodeText');
                const logTextDisplay = document.getElementById('logTextDisplay');

                batchCommandInputArea.addEventListener('input', () => {
                    vscode.postMessage({ command: 'updateGlobalCommands', text: batchCommandInputArea.value });
                });
                
                // 使用模板字符串来正确处理 initialCommandText 中的换行和特殊字符
                batchCommandInputArea.value = \`${initialCommandText}\`;

                loadActiveEditorButton.addEventListener('click', () => {
                    vscode.postMessage({ command: 'requestActiveEditorContent' });
                });

                executeButtonWebview.addEventListener('click', () => {
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
                        case 'setCommandInputArea': 
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
