import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// 全局变量，用于存储从 Webview 或 InputBox 获取的最新命令输入
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

    // 命令：用于从 VS Code 输入框接收替换命令 (保留作为备用或快速设置方式)
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

    // 命令：用于触发在 Webview 中显示的内容上执行替换 (由 Webview 内部按钮或此命令触发)
    context.subscriptions.push(vscode.commands.registerCommand('newcline.executeReplaceInWebview', () => {
        provider.triggerExecuteReplace(); // 修改为调用 provider 的新方法
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

        webviewView.onDidDispose(() => {
            console.log('>>>>>> [newcline] Sidebar webview disposed.');
        }, null, this._context.subscriptions);

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                console.log('>>>>>> [newcline] Sidebar webview became visible.');
                this.loadActiveEditorContent(); // 视图可见时加载
                this.updateWebviewCommandsDisplay(globalReplaceCommands); // 并更新命令显示
            }
        });
        
        this.loadActiveEditorContent(); // 首次解析时也尝试加载

        webviewView.webview.onDidReceiveMessage(async message => { // 标记为 async
            console.log('>>>>>> [newcline] Provider received message from webview:', message);
            switch (message.command) {
                case 'requestActiveEditorContent':
                    this.loadActiveEditorContent();
                    return;
                case 'webviewCommandInput': // 处理从 Webview 输入框发送的命令
                    const commandText = message.text.trim();
                    if (commandText.toLowerCase().startsWith("search:")) {
                        this._currentSearchPattern = commandText; // 简单处理，后续可以更精细解析
                        globalReplaceCommands = `${this._currentSearchPattern}\n${this._currentReplacePattern}`.trim();
                        this.updateWebviewCommandsDisplay(globalReplaceCommands);
                        this._view?.webview.postMessage({ command: 'showFeedbackInLog', message: `搜索模式已更新: ${commandText}` });

                    } else if (commandText.toLowerCase().startsWith("replace:")) {
                        this._currentReplacePattern = commandText;
                        globalReplaceCommands = `${this._currentSearchPattern}\n${this._currentReplacePattern}`.trim();
                        this.updateWebviewCommandsDisplay(globalReplaceCommands);
                        this._view?.webview.postMessage({ command: 'showFeedbackInLog', message: `替换模式已更新: ${commandText}` });

                    } else if (commandText.toLowerCase() === "execute" || commandText.toLowerCase() === "run") {
                        this.triggerExecuteReplace();
                    } else {
                        this._view?.webview.postMessage({ command: 'showErrorInLog', message: `未知指令: ${commandText}` });
                    }
                    return;
                case 'executeReplaceRequestFromWebview': // Webview 内的“执行替换”按钮触发
                    this.triggerExecuteReplace();
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
            this._view.webview.postMessage({
                command: 'setOriginalCodeAndLog',
                data: this._currentOriginalCode,
                log: "活动编辑器内容已加载。\n输入 search:《内容》 和 replace:《内容》指令，然后输入 execute 或点击执行按钮。"
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
            // 这个消息现在由 webviewCommandInput 内部处理，或通过日志显示
            // this._view.webview.postMessage({ command: 'updateCommandsDisplay', data: commands });
            this._view.webview.postMessage({ command: 'showFeedbackInLog', message: `当前替换指令已更新 (通过命令面板或API)。`});
        }
    }
    
    // 新方法，用于触发替换，增加前置检查
    public triggerExecuteReplace() {
        if (!this._view) {
            vscode.window.showErrorMessage("Webview 未准备好执行替换。");
            return;
        }
        // globalReplaceCommands 现在由 search: 和 replace: 指令组合而成
        if (!globalReplaceCommands && (!this._currentSearchPattern || !this._currentReplacePattern)) {
             this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：搜索或替换指令未完整设置。请使用 search:《内容》 和 replace:《内容》 指令。' });
            return;
        }
        // 确保 globalReplaceCommands 是最新的
        if (this._currentSearchPattern || this._currentReplacePattern) {
            globalReplaceCommands = `${this._currentSearchPattern}\n${this._currentReplacePattern}`.trim();
        }


        if (this._currentOriginalCode === undefined || this._currentOriginalCode === null || this._currentOriginalCode.trim() === "// 点击“加载/刷新活动编辑器”按钮来加载内容。\n" || this._currentOriginalCode.trim() === "// 没有活动的编辑器。\n") {
            this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：原文代码未有效加载。请先加载活动编辑器内容。' });
            return;
        }
        
        this._executePythonScriptInternal(globalReplaceCommands, this._currentOriginalCode, this._context, this._view.webview);
    }


    private _executePythonScriptInternal(commandsToExecute: string, originalCodeContent: string, context: vscode.ExtensionContext, webview: vscode.Webview) {
        // ... (这部分与之前版本相同，用于调用 Python 脚本并处理结果) ...
        console.log('>>>>>> [newcline] _executePythonScriptInternal called.');
        console.log('>>>>>> [newcline] Commands for Python:', commandsToExecute);
        console.log('>>>>>> [newcline] Original code for Python (first 100 chars):', originalCodeContent.substring(0,100));
        try {
            const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python_scripts', 'new.py').fsPath;
            
            if (!fs.existsSync(pythonScriptPath)) {
                console.error('>>>>>> [newcline] Python script not found at:', pythonScriptPath);
                webview.postMessage({ command: 'showErrorInLog', message: `Python 脚本未找到: ${pythonScriptPath}` });
                return;
            }

            const pythonPath = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath') || 'python3';
            console.log(`>>>>>> [newcline] Using Python path: ${pythonPath}`);

            const pythonProcess = spawn(pythonPath, [
                pythonScriptPath,
                '--commands',
                commandsToExecute,
                '--original_code',
                originalCodeContent
            ], {
                env: { ...process.env, 'PYTHONIOENCODING': 'UTF-8' } 
            });

            let scriptOutput = '';
            let scriptError = '';

            pythonProcess.stdout.setEncoding('utf8');
            pythonProcess.stderr.setEncoding('utf8');

            pythonProcess.stdout.on('data', (data) => {
                scriptOutput += data;
                console.log('>>>>>> [newcline] Python stdout chunk:', data); 
            });

            pythonProcess.stderr.on('data', (data) => {
                scriptError += data;
                console.error(`>>>>>> [newcline] Python stderr chunk: ${data}`);
            });

            pythonProcess.on('close', (code) => {
                console.log(`>>>>>> [newcline] Python script exited with code ${code}`);
                console.log('>>>>>> [newcline] Full Python stdout before parsing:', scriptOutput); 

                if (code === 0) {
                    try {
                        const result = JSON.parse(scriptOutput);
                        console.log('>>>>>> [newcline] Parsed Python result:', result); 
                        // 在这里，我们先不直接写入文件，而是准备进入 Diff 预览阶段
                        // 暂时还是先更新 Webview 的替换后预览区
                        webview.postMessage({ command: 'updateResult', data: result }); 
                        
                        // TODO: 下一步在这里触发 Diff 预览和用户确认
                        // this.showDiffAndConfirm(originalCodeContent, result.modified_code, context);

                    } catch (e) {
                        console.error('>>>>>> [newcline] Error parsing Python script output:', e);
                        webview.postMessage({
                            command: 'showErrorInLog', 
                            message: `解析Python脚本输出错误: ${e}. \n原始输出: ${scriptOutput}`
                        });
                    }
                } else {
                    console.error('>>>>>> [newcline] Python script execution failed.');
                    webview.postMessage({
                        command: 'showErrorInLog', 
                        message: `Python 脚本执行失败 (退出码: ${code}). \n错误信息: ${scriptError || '无特定错误信息。'} \n标准输出: ${scriptOutput}`
                    });
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

    // TODO: 实现 Diff 预览和确认逻辑
    // private async showDiffAndConfirm(originalContent: string, modifiedContent: string, context: vscode.ExtensionContext) {
    //     // ... 实现创建临时文件，调用 vscode.diff，显示确认框的逻辑 ...
    // }

    // TODO: 实现将修改应用到活动编辑器的逻辑
    // private async applyChangesToActiveEditor(newContent: string) {
    //     // ... 实现使用 WorkspaceEdit API 修改文件的逻辑 ...
    // }


    private _getHtmlForWebview(webview: vscode.Webview): string {
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
                    font-family: var(--vscode-font-family); /* 使用VSCode默认字体 */
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 10px; 
                    display: flex;
                    flex-direction: column;
                    height: 100%; 
                    box-sizing: border-box;
                    overflow-y: hidden; /* 防止 body 自身滚动，让子元素滚动 */
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
                    flex-shrink: 0; /* 防止标签被压缩 */
                }
                textarea, div.log-area, #commandInputContainer {
                    padding: 6px 8px; 
                    border: none; 
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family); /* 使用编辑器等宽字体 */
                    resize: none; 
                    box-sizing: border-box;
                    line-height: var(--vscode-editor-line-height);
                    font-size: var(--vscode-editor-font-size);
                }
                textarea {
                    flex-grow: 1; /* 占据父容器的剩余空间 */
                    width: 100%; 
                    min-height: 80px; /* 给文本区一个合理的最小高度 */
                }
                #originalCodePanel, #modifiedCodePanel {
                    flex: 1; /* 让这两个面板均分剩余空间 */
                    min-height: 100px;
                }
                #logPanel {
                    flex: 0.5; /* 日志区相对小一点 */
                    min-height: 60px;
                }
                div.log-area { 
                    min-height: 50px; 
                    white-space: pre-wrap;
                    overflow-y: auto; /* 允许日志区内部滚动 */
                    flex-grow: 1;
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

                /* 新增：命令输入区域样式 */
                #commandInputContainer {
                    display: flex;
                    padding: 0; /* 移除父容器的padding，让输入框和按钮紧凑 */
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
                    border-radius: 3px 0 0 3px; /* 左侧圆角 */
                }
                #sendCommandButton {
                    padding: 6px 10px;
                    border: 1px solid var(--vscode-button-border, var(--vscode-input-border)); /* 边框与输入框一致 */
                    border-left: none; /* 移除与输入框重叠的左边框 */
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    cursor: pointer;
                    border-radius: 0 3px 3px 0; /* 右侧圆角 */
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
                <button id="executeReplaceButtonWebview">执行替换 (使用已设置命令)</button> 
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
                <div id="logTextDisplay" class="log-area">请点击上方按钮加载内容，然后通过下方输入框或命令面板输入替换指令并执行替换。</div>
            </div>

            <div id="commandInputContainer">
                <input type="text" id="commandInputField" placeholder="输入 search: 或 replace: 指令后按回车或点发送">
                <button id="sendCommandButton">发送</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                const loadActiveEditorButton = document.getElementById('loadActiveEditorButton');
                const executeButtonWebview = document.getElementById('executeReplaceButtonWebview');
                const originalCodeTextArea = document.getElementById('originalCodeText');
                const modifiedCodeTextArea = document.getElementById('modifiedCodeText');
                const logTextDisplay = document.getElementById('logTextDisplay');
                const commandInputField = document.getElementById('commandInputField'); // 新增
                const sendCommandButton = document.getElementById('sendCommandButton'); // 新增

                loadActiveEditorButton.addEventListener('click', () => {
                    originalCodeTextArea.value = ""; 
                    modifiedCodeTextArea.value = ""; 
                    logTextDisplay.textContent = "正在请求加载活动编辑器内容...\\n";
                    vscode.postMessage({ command: 'requestActiveEditorContent' });
                });

                executeButtonWebview.addEventListener('click', () => {
                    logTextDisplay.textContent = "正在执行替换（使用已设置的命令）...\\n";
                    vscode.postMessage({ command: 'executeReplaceRequestFromWebview' });
                });

                // 新增：处理命令输入框
                function sendWebviewCommand() {
                    const commandText = commandInputField.value;
                    if (commandText.trim() === "") return;
                    logTextDisplay.textContent += \`> \${commandText}\\n\`; // 在日志区回显用户输入的命令
                    vscode.postMessage({ command: 'webviewCommandInput', text: commandText });
                    commandInputField.value = ""; // 清空输入框
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
                    const endsWithNewline = currentLog.endsWith('\\n') || currentLog === "" || currentLog.endsWith(logTextDisplay.innerHTML.includes('<br>') ? '<br>' : '\\n'); // 处理初始空内容和换行
                    const prefix = endsWithNewline ? "" : "\\n";

                    switch (message.command) {
                        case 'setOriginalCodeAndLog':
                            originalCodeTextArea.value = message.data || "未能加载内容或活动编辑器为空。";
                            modifiedCodeTextArea.value = ""; 
                            logTextDisplay.textContent = message.log || "内容已加载或更新。";
                            break;
                        case 'updateResult':
                            modifiedCodeTextArea.value = message.data.modified_code || '';
                            logTextDisplay.textContent = (message.data.log || ['处理完成。']).join('\\n');
                            break;
                        case 'showErrorInLog':
                            logTextDisplay.textContent += prefix + "错误: " + message.message + "\\n";
                            break;
                        case 'showFeedbackInLog': // 新增，用于显示通用反馈
                            logTextDisplay.textContent += prefix + message.message + "\\n";
                            break;
                        case 'updateCommandsDisplay': // 这个现在由 showFeedbackInLog 或直接的日志更新处理
                            // logTextDisplay.textContent += prefix + "当前设置的替换命令: " + message.data + "\\n";
                            break;
                    }
                    // 自动滚动日志到底部
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
