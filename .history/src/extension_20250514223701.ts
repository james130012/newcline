import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// 全局变量，用于存储从 VS Code 输入框获取的最新命令输入
let globalReplaceCommands: string = ""; 
// 原文代码现在由 WebviewViewProvider 内部管理

export function activate(context: vscode.ExtensionContext) {
    console.log('>>>>>> [newcline] activate() function called.');

    // 创建并注册 WebviewViewProvider
    const provider = new NewclineViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(NewclineViewProvider.viewType, provider, {
            webviewOptions: { retainContextWhenHidden: true } // 即使视图隐藏也保留 Webview 状态
        })
    );
    console.log('>>>>>> [newcline] NewclineViewProvider registered.');

    // 注册命令：用于从 VS Code 输入框接收替换命令
    context.subscriptions.push(vscode.commands.registerCommand('newcline.enterReplaceCommands', async () => {
        const commandsInput = await vscode.window.showInputBox({
            prompt: "输入替换命令 (例如: search:《内容》 replace:《内容》)",
            placeHolder: "search:《旧》 replace:《新》",
            value: globalReplaceCommands 
        });
        if (commandsInput !== undefined) {
            globalReplaceCommands = commandsInput;
            provider.updateWebviewCommandsDisplay(globalReplaceCommands); // 通知 Webview 更新
            vscode.window.showInformationMessage(`替换命令已设置为: ${globalReplaceCommands}`);
        }
    }));

    // 注册命令：用于触发在 Webview 中显示的内容上执行替换
    context.subscriptions.push(vscode.commands.registerCommand('newcline.executeReplaceInWebview', () => {
        if (!globalReplaceCommands) {
            vscode.window.showWarningMessage('请先通过 "NewCLine: 输入替换命令" 设置替换指令。');
            return;
        }
        provider.executeReplace(); // 调用 provider 的方法来执行
    }));
    
    // 注册命令：用于从 Webview 外部（例如命令面板）触发加载活动编辑器内容
    context.subscriptions.push(vscode.commands.registerCommand('newcline.loadActiveEditorToWebview', () => {
        provider.loadActiveEditorContent();
    }));

    // 移除或调整旧的 newcline.startTool 命令，因为它现在由活动栏视图触发
    // 如果还想通过命令面板打开，可以保留它，但它的功能是确保视图可见
    context.subscriptions.push(vscode.commands.registerCommand('newcline.startTool', () => {
        vscode.commands.executeCommand('workbench.view.extension.newcline-activitybar'); // 确保我们的视图容器可见
        // NewclineViewProvider 的 resolveWebviewView 会被调用，或者如果已存在，视图会显示
    }));


    console.log('>>>>>> [newcline] All commands registered.');
    console.log('>>>>>> [newcline] activate() function finished.');
}

class NewclineViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'newcline.sidebarView'; // 必须与 package.json 中的 view id 匹配

    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _context: vscode.ExtensionContext;
    private _currentOriginalCode: string = "// 点击“加载/刷新活动编辑器”按钮来加载内容。\n";

    constructor(
        private readonly extensionUri: vscode.Uri,
        context: vscode.ExtensionContext
    ) {
        this._extensionUri = extensionUri;
        this._context = context;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        resolveContext: vscode.WebviewViewResolveContext, // 参数名修正
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        console.log('>>>>>> [newcline] resolveWebviewView called for newcline.sidebarView.');

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'python_scripts'),
                vscode.Uri.joinPath(this._extensionUri, 'webview_assets') // 如果有外部CSS/JS
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.onDidDispose(() => {
            console.log('>>>>>> [newcline] Sidebar webview disposed.');
            // 可以选择在这里清理 _view = undefined; 但通常 resolveWebviewView 会在下次需要时重新赋值
        }, null, this._context.subscriptions);

        // 当视图变为可见时，尝试加载活动编辑器内容
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                console.log('>>>>>> [newcline] Sidebar webview became visible.');
                this.loadActiveEditorContent();
            }
        });
        
        // 首次解析时也尝试加载
        this.loadActiveEditorContent();

        webviewView.webview.onDidReceiveMessage(message => {
            console.log('>>>>>> [newcline] Provider received message from webview:', message);
            switch (message.command) {
                case 'requestActiveEditorContent':
                    this.loadActiveEditorContent();
                    return;
                case 'executeReplaceRequestFromWebview': // Webview 内的按钮触发执行
                    if (!globalReplaceCommands) {
                         this._view?.webview.postMessage({ command: 'showErrorInLog', message: '错误：替换命令未设置。请使用 "NewCLine: 输入替换命令" 进行设置。' });
                        return;
                    }
                    this.executeReplace(); 
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
                log: "活动编辑器内容已加载。\n请通过 'NewCLine: 输入替换命令' 设置指令，然后执行替换。"
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
            this._view.webview.postMessage({ command: 'updateCommandsDisplay', data: commands });
        }
    }

    public executeReplace() {
        if (!this._view) {
            vscode.window.showErrorMessage("Webview 未准备好执行替换。");
            return;
        }
        if (!globalReplaceCommands) {
            this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：替换命令未设置。请先使用命令面板设置。' });
            return;
        }
        if (this._currentOriginalCode === undefined || this._currentOriginalCode === null || this._currentOriginalCode.trim() === "// 点击“加载/刷新活动编辑器”按钮来加载内容。\n" || this._currentOriginalCode.trim() === "// 没有活动的编辑器。\n") {
            this._view.webview.postMessage({ command: 'showErrorInLog', message: '错误：原文代码未有效加载。请先加载活动编辑器内容。' });
            return;
        }
        
        this._executePythonScriptInternal(globalReplaceCommands, this._currentOriginalCode, this._context, this._view.webview);
    }

    private _executePythonScriptInternal(commandsToExecute: string, originalCodeContent: string, context: vscode.ExtensionContext, webview: vscode.Webview) {
        console.log('>>>>>> [newcline] _executePythonScriptInternal called.');
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
                        webview.postMessage({ command: 'updateResult', data: result });
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

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // HTML 内容与之前 Canvas "src/extension.ts (CLINE式界面 - 阶段一：显示活动文件)" 中的基本一致
        // 确保 Webview 中的按钮和消息处理与 Provider 的方法相对应
        // 例如，Webview 中的“执行替换”按钮现在可以移除，因为执行将通过命令面板触发
        // “加载活动编辑器内容”按钮可以保留，它会发送 'requestActiveEditorContent' 消息
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
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", 'PingFang SC', 'Microsoft YaHei', 'SimHei', var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 10px; 
                    display: flex;
                    flex-direction: column;
                    height: 100%; /* 确保 body 占满 WebviewView 高度 */
                    box-sizing: border-box;
                    overflow-y: auto; 
                }
                .code-display-area {
                    display: flex;
                    flex-direction: column;
                    margin-bottom: 8px; 
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px; 
                }
                /* 为原文和替换后预览区域设置一个可伸缩的高度 */
                #originalCodePanel, #modifiedCodePanel {
                    flex: 1; /* 占据可用垂直空间 */
                    min-height: 100px; /* 设置一个最小高度 */
                }
                 /* 日志区域也给一个弹性高度，但权重较低 */
                #logPanel {
                    flex: 0.5;
                    min-height: 60px; /* 设置一个最小高度 */
                }

                .code-display-area label {
                    padding: 6px 8px; 
                    font-weight: bold;
                    font-size: var(--vscode-font-size); 
                    background-color: var(--vscode-sideBar-background); 
                    border-bottom: 1px solid var(--vscode-input-border);
                }
                textarea, div.log-area { 
                    flex-grow: 1; 
                    width: 100%; /* 宽度占满父容器 */
                    padding: 6px 8px; 
                    border: none; 
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: Consolas, "Courier New", Courier, "Lucida Console", Monaco, "PingFang SC", "Microsoft YaHei", "SimHei", var(--vscode-editor-font-family), monospace;
                    resize: none; 
                    box-sizing: border-box;
                    line-height: var(--vscode-editor-line-height);
                    font-size: var(--vscode-editor-font-size);
                }
                div.log-area { 
                    white-space: pre-wrap;
                    overflow-y: auto;
                    background-color: var(--vscode-textCodeBlock-background); 
                }
                .button-container {
                    margin-bottom: 8px; 
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
                <button id="executeReplaceButtonWebview">执行替换 (使用已设置命令)</button> 
            </div>

            <div id="originalCodePanel" class="code-display-area">
                <label for="originalCodeText">原文预览 (只读):</label>
                <textarea id="originalCodeText" readonly></textarea>
            </div>

            <div id="modifiedCodePanel" class="code-display-area">
                <label for="modifiedCodeText">替换后预览 (只读):</label>
                <textarea id="modifiedCodeText" readonly></textarea>
            </div>
            
            <div id="logPanel" class="code-display-area"> 
                <label for="logTextDisplay">操作日志:</label>
                <div id="logTextDisplay" class="log-area">请点击上方按钮加载内容，然后通过命令面板输入替换指令并执行替换。</div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                const loadActiveEditorButton = document.getElementById('loadActiveEditorButton');
                const executeButtonWebview = document.getElementById('executeReplaceButtonWebview'); // 新按钮
                const originalCodeTextArea = document.getElementById('originalCodeText');
                const modifiedCodeTextArea = document.getElementById('modifiedCodeText');
                const logTextDisplay = document.getElementById('logTextDisplay');

                loadActiveEditorButton.addEventListener('click', () => {
                    originalCodeTextArea.value = ""; 
                    modifiedCodeTextArea.value = ""; 
                    logTextDisplay.textContent = "正在请求加载活动编辑器内容...\\n";
                    vscode.postMessage({ command: 'requestActiveEditorContent' });
                });

                executeButtonWebview.addEventListener('click', () => {
                    logTextDisplay.textContent = "正在执行替换（使用已设置的命令）...\\n";
                    // 这个消息会通知 Provider 使用它内部存储的原文和全局命令来执行替换
                    vscode.postMessage({ command: 'executeReplaceRequestFromWebview' });
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    console.log("Sidebar Webview received message:", message);
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
                            logTextDisplay.textContent += (logTextDisplay.textContent.endsWith('\\n') || logTextDisplay.textContent === "" ? "" : "\\n") + "错误: " + message.message + "\\n";
                            break;
                        case 'updateCommandsDisplay': 
                            logTextDisplay.textContent += (logTextDisplay.textContent.endsWith('\\n') || logTextDisplay.textContent === "" ? "" : "\\n") + "当前设置的替换命令: " + message.data + "\\n";
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}

export function deactivate() {
    console.log('>>>>>> [newcline] deactivate() function called.');
}
