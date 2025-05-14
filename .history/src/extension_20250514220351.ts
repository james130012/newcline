// 导入 vscode 模块，它包含了 VS Code 扩展性 API
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// 全局变量，用于存储当前 Webview 面板的引用，以便其他命令可以访问
let currentPanel: vscode.WebviewPanel | undefined = undefined;
// 全局变量，用于存储从 Webview 获取的最新命令输入
let webviewCommands: string = "";
// 全局变量，用于存储当前在Webview中显示的代码原文
let webviewOriginalCode: string = "";


export function activate(context: vscode.ExtensionContext) {
    console.log('>>>>>> [newcline] activate() function called.');
    console.log('>>>>>> [newcline] Congratulations, your extension "newcline" is now active!');

    // 注册主命令，用于打开 Webview 面板
    let openWebviewDisposable = vscode.commands.registerCommand('newcline.startTool', () => {
        console.log('>>>>>> [newcline] newcline.startTool command executed.');

        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (currentPanel) {
            // 如果面板已存在，则显示它
            currentPanel.reveal(columnToShowIn);
        } else {
            // 否则，创建新的面板
            currentPanel = vscode.window.createWebviewPanel(
                'newclineWebview',
                'NewCLine 替换预览', // Webview 面板的标题
                vscode.ViewColumn.Beside, // 在活动编辑器的旁边打开
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(context.extensionUri, 'python_scripts'),
                        vscode.Uri.joinPath(context.extensionUri, 'webview_assets') // 如果有外部CSS/JS
                    ],
                    retainContextWhenHidden: true // 即使面板不可见也保留其状态
                }
            );

            currentPanel.webview.html = getWebviewContent(context, currentPanel.webview);

            // 当面板关闭时，清空 currentPanel 引用
            currentPanel.onDidDispose(
                () => {
                    currentPanel = undefined;
                    console.log('>>>>>> [newcline] Webview panel disposed.');
                },
                null,
                context.subscriptions
            );

            // 处理从 Webview 发送过来的消息
            currentPanel.webview.onDidReceiveMessage(
                message => {
                    console.log('>>>>>> [newcline] Received message from webview:', message);
                    switch (message.command) {
                        case 'executeReplace': // 这个命令现在由新的 "newcline.executeReplaceInWebview" 触发
                            webviewCommands = message.commands; // 保存从webview获取的命令
                            // webviewOriginalCode 应该已经被 'requestActiveEditorContent' 或手动粘贴更新了
                            executePythonScript(commands, webviewOriginalCode, context, currentPanel!); // 使用保存的命令和代码
                            return;
                        case 'requestActiveEditorContent': // Webview 请求加载活动编辑器内容
                            loadActiveEditorContentToWebview();
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );

            // Webview 创建后，立即尝试加载活动编辑器的内容
            loadActiveEditorContentToWebview();
        }
    });
    context.subscriptions.push(openWebviewDisposable);

    // 新命令：用于从 VS Code 输入框接收替换命令
    let enterReplaceCommandsDisposable = vscode.commands.registerCommand('newcline.enterReplaceCommands', async () => {
        if (!currentPanel) {
            vscode.window.showInformationMessage('请先通过 "NewCLine: 打开替换预览" 命令打开预览面板。');
            // 或者自动打开它
            // await vscode.commands.executeCommand('newcline.startTool');
            // if (!currentPanel) return; // 如果还是没打开，则返回
            return;
        }
        const commands = await vscode.window.showInputBox({
            prompt: "输入替换命令 (例如: search:《内容》 replace:《内容》)",
            placeHolder: "search:《旧》 replace:《新》",
            value: webviewCommands // 显示上次的命令作为默认值
        });
        if (commands !== undefined) {
            webviewCommands = commands; // 更新全局保存的命令
            // 可以选择将命令也显示在 Webview 的某个区域（如果需要）
            currentPanel.webview.postMessage({ command: 'updateCommandsDisplay', data: commands });
            vscode.window.showInformationMessage(`替换命令已设置为: ${commands}`);
        }
    });
    context.subscriptions.push(enterReplaceCommandsDisposable);

    // 新命令：用于触发在 Webview 中显示的内容上执行替换
    let executeReplaceInWebviewDisposable = vscode.commands.registerCommand('newcline.executeReplaceInWebview', () => {
        if (!currentPanel) {
            vscode.window.showErrorMessage('替换预览面板未打开。');
            return;
        }
        if (!webviewCommands) {
            vscode.window.showWarningMessage('请先通过 "NewCLine: 输入替换命令" 设置替换指令。');
            return;
        }
        if (webviewOriginalCode === undefined || webviewOriginalCode === null) { // 确保 webviewOriginalCode 已被赋值
             vscode.window.showWarningMessage('Webview 中没有原文代码可供替换。请先加载活动编辑器内容或确保内容已显示。');
            return;
        }
        // 调用 Python 脚本，使用全局保存的命令和 Webview 中的原文代码
        executePythonScript(webviewCommands, webviewOriginalCode, context, currentPanel);
    });
    context.subscriptions.push(executeReplaceInWebviewDisposable);


    console.log('>>>>>> [newcline] All commands registered.');
    console.log('>>>>>> [newcline] activate() function finished.');
}

// 函数：加载活动编辑器的内容到 Webview
function loadActiveEditorContentToWebview() {
    if (!currentPanel) return;

    const editor = vscode.window.activeTextEditor;
    if (editor) {
        webviewOriginalCode = editor.document.getText(); // 更新全局保存的原文代码
        currentPanel.webview.postMessage({ command: 'setOriginalCodeAndLog', data: webviewOriginalCode, log: "活动编辑器内容已加载到预览。\n请通过 'NewCLine: 输入替换命令' 设置指令，然后通过 'NewCLine: 执行替换' 进行操作。" });
    } else {
        webviewOriginalCode = ""; // 清空
        currentPanel.webview.postMessage({ command: 'showErrorInLog', message: '没有活动的编辑器可供加载内容。请打开一个文件。' });
    }
}


// 函数：执行 Python 脚本的逻辑 (从之前的代码中提取出来)
function executePythonScript(commands: string, originalCode: string, context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
    console.log('>>>>>> [newcline] executePythonScript called.');
    try {
        const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python_scripts', 'new.py').fsPath;
        
        if (!fs.existsSync(pythonScriptPath)) {
            console.error('>>>>>> [newcline] Python script not found at:', pythonScriptPath);
            vscode.window.showErrorMessage(`Python 脚本未找到: ${pythonScriptPath}`);
            panel.webview.postMessage({
                command: 'showErrorInLog', // 修改为 showErrorInLog
                message: `执行错误: Python 脚本未找到于 ${pythonScriptPath}。`
            });
            return;
        }

        const pythonPath = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath') || 'python3';
        console.log(`>>>>>> [newcline] Using Python path: ${pythonPath}`);
        console.log(`>>>>>> [newcline] Executing script: ${pythonScriptPath}`);

        const pythonProcess = spawn(pythonPath, [
            pythonScriptPath,
            '--commands',
            commands,
            '--original_code',
            originalCode
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
                    panel.webview.postMessage({ command: 'updateResult', data: result });
                } catch (e) {
                    console.error('>>>>>> [newcline] Error parsing Python script output:', e);
                    panel.webview.postMessage({
                        command: 'showErrorInLog', // 修改为 showErrorInLog
                        message: `解析Python脚本输出错误: ${e}. \n原始输出: ${scriptOutput}`
                    });
                }
            } else {
                console.error('>>>>>> [newcline] Python script execution failed.');
                panel.webview.postMessage({
                    command: 'showErrorInLog', // 修改为 showErrorInLog
                    message: `Python 脚本执行失败 (退出码: ${code}). \n错误信息: ${scriptError || '无特定错误信息。'} \n标准输出: ${scriptOutput}`
                });
            }
        });
        pythonProcess.on('error', (err) => {
            console.error('>>>>>> [newcline] Failed to start Python process:', err);
            vscode.window.showErrorMessage(`启动 Python 进程失败: ${err.message}`);
            panel.webview.postMessage({
                command: 'showErrorInLog', // 修改为 showErrorInLog
                message: `启动 Python 进程失败: ${err.message}`
            });
        });

    } catch (error: any) {
        console.error('>>>>>> [newcline] Error executing Python script:', error);
        vscode.window.showErrorMessage(`执行 Python 脚本时出错: ${error.message}`);
        panel.webview.postMessage({ command: 'showErrorInLog', message: `执行 Python 脚本时出错: ${error.message}` });
    }
}


// 这个函数用来获取 Webview 的 HTML 内容
function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    // 我们将简化 HTML，主要用于显示原文、修改后代码和日志
    // 命令输入将通过 VS Code 的 InputBox API 进行
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
        <title>NewCLine 替换预览</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", 'PingFang SC', 'Microsoft YaHei', 'SimHei', var(--vscode-font-family);
                color: var(--vscode-editor-foreground);
                background-color: var(--vscode-editor-background);
                padding: 15px;
                display: flex;
                flex-direction: column;
                height: 100vh;
                box-sizing: border-box;
            }
            .code-display-area {
                flex: 1; /* 占据可用空间 */
                display: flex;
                flex-direction: column;
                margin-bottom: 10px;
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px; /* 圆角 */
            }
            .code-display-area label {
                padding: 8px;
                font-weight: bold;
                background-color: var(--vscode-sideBar-background); /* 类似标签页的背景 */
                border-bottom: 1px solid var(--vscode-input-border);
            }
            textarea, div.log-area { /* 应用于文本区和日志区 */
                flex-grow: 1; /* 占据父容器的剩余空间 */
                width: calc(100% - 16px); /* 考虑padding */
                padding: 8px;
                border: none; /* 移除textarea的边框，由父容器控制 */
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                font-family: Consolas, "Courier New", Courier, "Lucida Console", Monaco, "PingFang SC", "Microsoft YaHei", "SimHei", var(--vscode-editor-font-family), monospace;
                resize: none; /* 禁止用户调整大小，由flex布局控制 */
                box-sizing: border-box;
                line-height: var(--vscode-editor-line-height);
                font-size: var(--vscode-editor-font-size);
            }
            div.log-area { /* 日志区的特定样式 */
                min-height: 80px; /* 保持最小高度 */
                white-space: pre-wrap;
                overflow-y: auto;
                background-color: var(--vscode-textCodeBlock-background); /* 日志区用不同的背景 */
            }
            .button-container {
                margin-bottom: 15px;
            }
            button {
                padding: 6px 12px; /* 调整按钮大小 */
                border: 1px solid var(--vscode-button-border, transparent); /* 添加边框 */
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                cursor: pointer;
                margin-right: 10px;
                border-radius: 4px; /* 圆角 */
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            h3 { margin-top: 0;}
        </style>
    </head>
    <body>
        <h3>NewCLine 替换预览</h3>

        <div class="button-container">
            <button id="loadActiveEditorButton">从活动编辑器加载/刷新</button>
            </div>

        <div class="code-display-area">
            <label for="originalCodeText">原文预览 (只读):</label>
            <textarea id="originalCodeText" readonly></textarea>
        </div>

        <div class="code-display-area">
            <label for="modifiedCodeText">替换后预览 (只读):</label>
            <textarea id="modifiedCodeText" readonly></textarea>
        </div>
        
        <div class="code-display-area" style="min-height: 100px; flex-basis: 100px; flex-grow: 0.5;"> <label for="logTextDisplay">操作日志:</label>
            <div id="logTextDisplay" class="log-area">请先加载内容，然后通过命令面板输入替换指令并执行替换。</div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            const loadActiveEditorButton = document.getElementById('loadActiveEditorButton');
            const originalCodeTextArea = document.getElementById('originalCodeText');
            const modifiedCodeTextArea = document.getElementById('modifiedCodeText');
            const logTextDisplay = document.getElementById('logTextDisplay');

            loadActiveEditorButton.addEventListener('click', () => {
                originalCodeTextArea.value = ""; // 清空
                modifiedCodeTextArea.value = ""; // 清空
                logTextDisplay.textContent = "正在请求加载活动编辑器内容...\\n";
                vscode.postMessage({ command: 'requestActiveEditorContent' });
            });

            window.addEventListener('message', event => {
                const message = event.data;
                console.log("Webview received message:", message); // 在Webview的开发者工具控制台打印
                switch (message.command) {
                    case 'setOriginalCodeAndLog': // 同时设置原文和初始日志
                        webviewOriginalCode = message.data; // 更新JS中的原文变量 (如果JS需要直接访问)
                        originalCodeTextArea.value = message.data || "未能加载内容或活动编辑器为空。";
                        modifiedCodeTextArea.value = ""; // 清空上次结果
                        logTextDisplay.textContent = message.log || "内容已加载或更新。";
                        break;
                    case 'updateResult':
                        modifiedCodeTextArea.value = message.data.modified_code || '';
                        logTextDisplay.textContent = (message.data.log || ['处理完成。']).join('\\n');
                        break;
                    case 'showErrorInLog': // 在日志区显示错误
                        logTextDisplay.textContent += "错误: " + message.message + "\\n";
                        break;
                }
            });

            // 声明一个全局变量以便在JS中引用原文，尽管主要操作由扩展后端处理
            let webviewOriginalCode = '';

            // 页面加载时自动请求一次活动编辑器内容 (可选)
            // vscode.postMessage({ command: 'requestActiveEditorContent' });
        </script>
    </body>
    </html>`;
}

export function deactivate() {
    console.log('>>>>>> [newcline] deactivate() function called.');
}
