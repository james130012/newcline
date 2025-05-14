// 导入 vscode 模块，它包含了 VS Code 扩展性 API
import * as vscode from 'vscode';

// 当你的扩展被激活时，这个方法会被调用
// 你的扩展在 package.json 中的 activationEvents 字段中定义的事件发生时被激活
export function activate(context: vscode.ExtensionContext) {

    // 使用控制台输出诊断信息 (console.log) 和错误 (console.error)
    // 这行代码只会在你的扩展被激活时执行一次
    console.log('Congratulations, your extension "newcline" is now active!');

    // 命令已经在 package.json 文件中定义好了 (newcline.startTool)
    // 现在用 registerCommand 提供命令的实现
    // commandId参数必须与 package.json 中的 command 字段匹配
    let disposable = vscode.commands.registerCommand('newcline.startTool', () => {
        // 你希望在执行此命令时运行的代码放在这里

        // 现在，让我们显示一个信息框给用户
        vscode.window.showInformationMessage('NewCLine代码替换工具已启动!');

        // 在这里，我们稍后会添加打开Webview的逻辑，以及调用Python脚本的逻辑
    });

    context.subscriptions.push(disposable);

    // 如果你的项目中还保留了默认的 helloWorld 命令注册，
    // 并且你已经从 package.json 中移除了它的声明，
    // 那么你也应该在这里删除或注释掉它的注册代码，以避免错误。
    // 例如，如果之前有类似下面的代码，现在应该删除或注释掉：
    // let helloWorldDisposable = vscode.commands.registerCommand('newcline.helloWorld', () => {
    //     vscode.window.showInformationMessage('Hello World from newcline!');
    // });
    // context.subscriptions.push(helloWorldDisposable);
}

// 当你的扩展被停用时，这个方法会被调用
export function deactivate() {}
