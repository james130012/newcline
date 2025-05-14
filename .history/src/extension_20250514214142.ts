// 导入 vscode 模块，它包含了 VS Code 扩展性 API
import * as vscode from 'vscode';
import * as path from 'path'; // 用于处理文件路径
import * as fs from 'fs';   // 用于读取文件 (虽然在此版本中不直接用它加载HTML，但保留以备后用)
import { spawn } from 'child_process'; // 用于执行外部Python脚本

// 当你的扩展被激活时，这个方法会被调用
export function activate(context: vscode.ExtensionContext) {
    // 诊断日志
    console.log('>>>>>> [newcline] activate() function called.');
    console.log('>>>>>> [newcline] Congratulations, your extension "newcline" is now active! (This is the target message)');

    console.log('>>>>>> [newcline] Attempting to register command: newcline.startTool');
    let disposable = vscode.commands.registerCommand('newcline.startTool', () => {
        console.log('>>>>>> [newcline] newcline.startTool command executed.');

        const panel = vscode.window.createWebviewPanel(
            'newclineWebview',
            'NewCLine 代码替换工具',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'python_scripts')]
            }
        );

        panel.webview.html = getWebviewContent(context, panel.webview);

        panel.onDidDispose(
            () => {
                console.log('>>>>>> [newcline] Webview panel disposed.');
            },
            null,
            context.subscriptions
        );

        panel.webview.onDidReceiveMessage(
            async message => {
                console.log('>>>>>> [newcline] Received message from webview:', message);
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'getInitialContent':
                        const editor = vscode.window.activeTextEditor;
                        if (editor) {
                            panel.webview.postMessage({ command: 'setOriginalCode', data: editor.document.getText() });
                        } else {
                            panel.webview.postMessage({ command: 'showError', message: '没有活动的编辑器可供加载内容。' });
                        }
                        return;
                    case 'executeReplace':
                        const commands = message.commands;
                        const originalCode = message.originalCode;

                        try {
                            const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python_scripts', 'new.py').fsPath;
                            
                            if (!fs.existsSync(pythonScriptPath)) {
                                console.error('>>>>>> [newcline] Python script not found at:', pythonScriptPath);
                                vscode.window.showErrorMessage(`Python 脚本未找到: ${pythonScriptPath}`);
                                panel.webview.postMessage({
                                    command: 'showError',
                                    message: `执行错误: Python 脚本未找到于 ${pythonScriptPath}。请确保脚本存在于插件的 python_scripts 文件夹中。`
                                });
                                return;
                            }

                            const pythonPath = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath') || 'python3';
                            console.log(`>>>>>> [newcline] Using Python path: ${pythonPath}`);
                            console.log(`>>>>>> [newcline] Executing script: ${pythonScriptPath}`);
                            // console.log(`>>>>>> [newcline] With commands: ${commands}`); // 避免日志过长
                            // console.log(`>>>>>> [newcline] With original code: ${originalCode.substring(0,100)}...`);

                            const pythonProcess = spawn(pythonPath, [
                                pythonScriptPath,
                                '--commands',
                                commands,
                                '--original_code',
                                originalCode
                            ]);

                            let scriptOutput = '';
                            let scriptError = '';

                            // 明确指定 stdout 和 stderr 的编码为 utf8
                            pythonProcess.stdout.setEncoding('utf8');
                            pythonProcess.stderr.setEncoding('utf8');

                            pythonProcess.stdout.on('data', (data) => {
                                scriptOutput += data; // data 已经是字符串了
                                console.log('>>>>>> [newcline] Python stdout chunk:', data); // 打印每个数据块，看是否已经是乱码
                            });

                            pythonProcess.stderr.on('data', (data) => {
                                scriptError += data; // data 已经是字符串了
                                console.error(`>>>>>> [newcline] Python stderr chunk: ${data}`);
                            });

                            pythonProcess.on('close', (code) => {
                                console.log(`>>>>>> [newcline] Python script exited with code ${code}`);
                                console.log('>>>>>> [newcline] Full Python stdout before parsing:', scriptOutput); // 打印完整的原始输出

                                if (code === 0) {
                                    try {
                                        const result = JSON.parse(scriptOutput);
                                        console.log('>>>>>> [newcline] Parsed Python result:', result); // 打印解析后的JSON对象
                                        panel.webview.postMessage({ command: 'updateResult', data: result });
                                    } catch (e) {
                                        console.error('>>>>>> [newcline] Error parsing Python script output:', e);
                                        panel.webview.postMessage({
                                            command: 'showError',
                                            message: `解析Python脚本输出错误: ${e}. \n原始输出: ${scriptOutput}`
                                        });
                                    }
                                } else {
                                    console.error('>>>>>> [newcline] Python script execution failed.');
                                    panel.webview.postMessage({
                                        command: 'showError',
                                        message: `Python 脚本执行失败 (退出码: ${code}). \n错误信息: ${scriptError || '无特定错误信息输出到stderr。请检查Python脚本逻辑。'} \n标准输出: ${scriptOutput}`
                                    });
                                }
                            });
                            pythonProcess.on('error', (err) => {
                                console.error('>>>>>> [newcline] Failed to start Python process:', err);
                                vscode.window.showErrorMessage(`启动 Python 进程失败: ${err.message}`);
                                panel.webview.postMessage({
                                    command: 'showError',
                                    message: `启动 Python 进程失败: ${err.message}`
                                });
                            });

                        } catch (error: any) {
                            console.error('>>>>>> [newcline] Error executing Python script:', error);
                            vscode.window.showErrorMessage(`执行 Python 脚本时出错: ${error.message}`);
                            panel.webview.postMessage({ command: 'showError', message: `执行 Python 脚本时出错: ${error.message}` });
                        }
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
    console.log('>>>>>> [newcline] Command newcline.startTool has been pushed to subscriptions.');
    console.log('>>>>>> [newcline] activate() function finished.');
}

// 这个函数用来获取 Webview 的 HTML 内容 (与之前版本相同，包含字体和CSP更新)
function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    // const nonce = getNonce(); // 注释掉或删除这一行，因为我们目前不使用 nonce

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
        <title>NewCLine 代码替换工具</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", 'PingFang SC', 'Microsoft YaHei', 'SimHei', var(--vscode-font-family);
                color: var(--vscode-editor-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
            }
            textarea, div#logTextDisplay {
                width: 95%;
                min-height: 100px;
                margin-bottom: 10px;
                padding: 8px;
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                font-family: Consolas, "Courier New", Courier, "Lucida Console", Monaco, "PingFang SC", "Microsoft YaHei", "SimHei", var(--vscode-editor-font-family), monospace;
                resize: vertical;
            }
            button {
                padding: 8px 15px;
                border: none;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                cursor: pointer;
                margin-right: 10px;
                margin-bottom: 10px;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            .container {
                display: flex;
                flex-direction: column;
            }
            .panel {
                margin-bottom: 15px;
            }
            .panel label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }
            #logTextDisplay {
                background-color: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-input-border);
                padding: 8px;
                min-height: 80px;
                white-space: pre-wrap;
                overflow-y: auto;
                font-size: var(--vscode-editor-font-size);
                line-height: var(--vscode-editor-line-height);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>NewCLine 代码替换工具</h1>

            <div class="panel">
                <label for="commandText">1. 输入修改命令 (例如: search:《内容》 replace:《内容》):</label>
                <textarea id="commandText" rows="5">// 示例命令 (可以有多对，内容用书名号《》包裹):\n// search:《原始文本》\n// replace:《替换文本》</textarea>
            </div>

            <div class="panel">
                <label for="originalCodeText">2. 粘贴原文代码:</label>
                <textarea id="originalCodeText" rows="10">// 在此粘贴原文代码...</textarea>
            </div>

            <button id="executeButton">执行替换</button>
            <button id="loadActiveEditorButton">加载活动编辑器内容</button>

            <div class="panel">
                <label for="modifiedCodeText">3. 修改后代码:</label>
                <textarea id="modifiedCodeText" rows="10" readonly></textarea>
            </div>

            <div class="panel">
                <label for="logTextDisplay">操作日志:</label>
                <div id="logTextDisplay">等待操作...</div>
            </div>
        </div>

        <script>
            // 获取 vscode API 以便与扩展后端通信
            const vscode = acquireVsCodeApi();

            const executeButton = document.getElementById('executeButton');
            const loadActiveEditorButton = document.getElementById('loadActiveEditorButton');
            const commandTextArea = document.getElementById('commandText');
            const originalCodeTextArea = document.getElementById('originalCodeText');
            const modifiedCodeTextArea = document.getElementById('modifiedCodeText');
            const logTextDisplay = document.getElementById('logTextDisplay');

            executeButton.addEventListener('click', () => {
                const commands = commandTextArea.value;
                const originalCode = originalCodeTextArea.value;
                logTextDisplay.textContent = "正在处理中，请稍候...\\n"; // 即时反馈
                // 向扩展后端发送消息
                vscode.postMessage({
                    command: 'executeReplace',
                    commands: commands,
                    originalCode: originalCode
                });
            });

            loadActiveEditorButton.addEventListener('click', () => {
                modifiedCodeTextArea.value = ""; // 清空结果区
                logTextDisplay.textContent = "请求加载活动编辑器内容...\\n";
                vscode.postMessage({
                    command: 'getInitialContent'
                });
            });

            // 监听从扩展后端发送过来的消息
            window.addEventListener('message', event => {
                const message = event.data; // 扩展发送的数据
                console.log("Message from extension:", message); // 在Webview的开发者工具控制台打印
                switch (message.command) {
                    case 'updateResult':
                        modifiedCodeTextArea.value = message.data.modified_code || '';
                        // 将日志数组转换为多行字符串显示
                        logTextDisplay.textContent = (message.data.log || ['处理完成。']).join('\\n');
                        break;
                    case 'setOriginalCode':
                        originalCodeTextArea.value = message.data;
                        logTextDisplay.textContent += "活动编辑器内容已加载。\\n";
                        break;
                    case 'showError':
                        logTextDisplay.textContent += "错误: " + message.message + "\\n";
                        break;
                }
            });
        </script>
    </body>
    </html>`;
}

/*
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
*/

export function deactivate() {
    console.log('>>>>>> [newcline] deactivate() function called.');
}
