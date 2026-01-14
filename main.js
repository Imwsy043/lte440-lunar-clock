/**
 * Electron主进程文件 - 用于打包成桌面软件
 * 启动Python后端并显示前端界面
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 全局变量
let mainWindow;
let pythonProcess = null;
const isDev = process.env.NODE_ENV === 'development';

// Python后端配置
const PYTHON_CONFIG = {
    path: 'python',  // Python命令，可以是 'python' 或 'python3'
    script: path.join(__dirname, 'backend', 'server.py'),
    args: [],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
};

// 创建浏览器窗口
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 700,
        title: 'LTE440 地月精密时钟',
        icon: path.join(__dirname, 'icon.ico'), // 可选图标文件
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false, // 先不显示，等后端启动
        backgroundColor: '#0c2461'
    });

    // 加载前端页面
    const frontendPath = path.join(__dirname, 'frontend', 'index.html');
    if (fs.existsSync(frontendPath)) {
        mainWindow.loadFile(frontendPath);
    } else {
        mainWindow.loadURL('http://localhost:5000');
    }

    // 开发工具
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // 窗口事件
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 启动Python后端服务器
function startPythonBackend() {
    console.log('🚀 启动Python后端服务器...');
    console.log(`Python脚本: ${PYTHON_CONFIG.script}`);
    
    // 检查Python脚本是否存在
    if (!fs.existsSync(PYTHON_CONFIG.script)) {
        console.error(`❌ 找不到Python脚本: ${PYTHON_CONFIG.script}`);
        return false;
    }
    
    try {
        pythonProcess = spawn(PYTHON_CONFIG.path, [PYTHON_CONFIG.script], {
            cwd: path.join(__dirname, 'backend'),
            env: PYTHON_CONFIG.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // 处理Python输出
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.log(`[Python后端]: ${output}`);
                // 转发到渲染进程（前端）
                if (mainWindow) {
                    mainWindow.webContents.send('python-log', output);
                }
            }
        });
        
        pythonProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            if (error) {
                console.error(`[Python错误]: ${error}`);
                if (mainWindow) {
                    mainWindow.webContents.send('python-error', error);
                }
            }
        });
        
        pythonProcess.on('close', (code) => {
            console.log(`Python进程退出，代码: ${code}`);
            pythonProcess = null;
            if (code !== 0 && mainWindow) {
                mainWindow.webContents.send('python-crashed', `后端异常退出 (代码: ${code})`);
            }
        });
        
        console.log('✅ Python后端启动成功');
        return true;
        
    } catch (error) {
        console.error(`❌ 启动Python后端失败: ${error.message}`);
        return false;
    }
}

// 停止Python后端
function stopPythonBackend() {
    if (pythonProcess && !pythonProcess.killed) {
        console.log('正在停止Python后端...');
        pythonProcess.kill('SIGTERM');
        pythonProcess = null;
    }
}

// 检查后端状态
function checkBackendStatus() {
    return new Promise((resolve) => {
        if (!pythonProcess) {
            resolve({ running: false, error: '进程不存在' });
            return;
        }
        
        // 简单检查进程是否存活
        resolve({ 
            running: !pythonProcess.killed,
            pid: pythonProcess.pid 
        });
    });
}

// Electron准备就绪
app.whenReady().then(() => {
    console.log('='.repeat(50));
    console.log('LTE440 地月时钟桌面版');
    console.log('基于《月球时间历表LTE440》文档实现');
    console.log('='.repeat(50));
    
    // 先启动Python后端
    const backendStarted = startPythonBackend();
    
    if (backendStarted) {
        // 等待2秒让后端启动，再创建窗口
        setTimeout(() => {
            createWindow();
        }, 2000);
    } else {
        console.error('❌ 后端启动失败，无法启动应用');
        app.quit();
    }
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 窗口全部关闭
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        stopPythonBackend();
        app.quit();
    }
});

// 应用退出前
app.on('before-quit', () => {
    stopPythonBackend();
});

// IPC通信处理
ipcMain.handle('get-backend-status', async () => {
    return await checkBackendStatus();
});

ipcMain.handle('restart-backend', async () => {
    stopPythonBackend();
    setTimeout(() => {
        startPythonBackend();
    }, 1000);
    return { success: true };
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

console.log('📁 应用数据目录:', app.getPath('userData'));