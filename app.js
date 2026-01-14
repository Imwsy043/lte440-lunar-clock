/**
 * LTE440地月时钟 - 前端逻辑
 * 基于《月球时间历表LTE440》文档实现
 */

// 配置
const CONFIG = {
    API_BASE_URL: 'http://localhost:5000',
    UPDATE_INTERVAL: 1000, // 时间更新间隔(ms)
    TIMER_INTERVAL: 100,   // 计时器更新间隔(ms)
    MAX_LAPS: 20          // 最大圈速记录数
};

// 全局状态
let state = {
    connected: false,
    serverStatus: null,
    currentTime: null,
    timer: {
        running: false,
        startTime: null,
        earthSeconds: 0,
        lunarSeconds: 0,
        laps: []
    }
};

// DOM元素
const elements = {
    status: document.getElementById('status'),
    earthTime: document.getElementById('earthTime'),
    lunarTime: document.getElementById('lunarTime'),
    timeOffset: document.getElementById('timeOffset'),
    earthTimer: document.getElementById('earthTimer'),
    lunarTimer: document.getElementById('lunarTimer'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    lapBtn: document.getElementById('lapBtn'),
    lapList: document.getElementById('lapList'),
    docInfo: document.getElementById('docInfo')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('LTE440地月时钟初始化...');
    console.log('基于《月球时间历表LTE440》文档实现');
    
    // 绑定按钮事件
    bindEvents();
    
    // 检查服务器连接
    checkConnection();
    
    // 开始更新时间
    startClockUpdate();
    
    // 加载文档信息
    loadDocumentation();
});

// 绑定事件
function bindEvents() {
    elements.startBtn.addEventListener('click', startTimer);
    elements.pauseBtn.addEventListener('click', pauseTimer);
    elements.resetBtn.addEventListener('click', resetTimer);
    elements.lapBtn.addEventListener('click', recordLap);
}

// 检查服务器连接
async function checkConnection() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/status`);
        if (response.ok) {
            state.serverStatus = await response.json();
            updateStatus(true, '已连接到LTE440时间服务器');
            
            // 显示服务器信息
            console.log('服务器信息:', state.serverStatus);
            
            return true;
        }
    } catch (error) {
        console.error('连接服务器失败:', error);
        updateStatus(false, '无法连接到时间服务器');
        return false;
    }
}

// 更新连接状态显示
function updateStatus(connected, message) {
    state.connected = connected;
    
    elements.status.className = `status-indicator ${connected ? 'connected' : 'error'}`;
    elements.status.innerHTML = `
        <span class="dot"></span>
        ${message}
    `;
    
    // 更新按钮状态
    const buttons = [elements.startBtn, elements.pauseBtn, elements.resetBtn, elements.lapBtn];
    buttons.forEach(btn => {
        btn.disabled = !connected;
        btn.style.opacity = connected ? '1' : '0.5';
    });
}

// 获取并更新时间
async function updateTime() {
    if (!state.connected) {
        await checkConnection();
        if (!state.connected) return;
    }
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/now`);
        if (!response.ok) throw new Error('API请求失败');
        
        const data = await response.json();
        
        if (data.success) {
            state.currentTime = data.data;
            updateTimeDisplay();
        } else {
            throw new Error(data.error || '未知错误');
        }
    } catch (error) {
        console.error('更新时间失败:', error);
        updateStatus(false, '时间同步失败');
    }
}

// 更新时间显示
function updateTimeDisplay() {
    if (!state.currentTime) return;
    
    const time = state.currentTime;
    
    // 地球时间
    elements.earthTime.textContent = 
        time.earth_time.utc.split(' ')[1] || '--:--:--';
    
    // 月球时间（简化显示）
    const tclJD = time.lunar_time.tcl_jd;
    // 显示相对于TDB的偏移量更直观
    const offsetMs = time.differences.tcl_minus_tdb.milliseconds;
    
    elements.lunarTime.textContent = 
        `${offsetMs.toFixed(3)} ms`;
    
    // 时差信息
    elements.timeOffset.innerHTML = `
        <strong>TCL - TDB:</strong> ${offsetMs.toFixed(3)} ms<br>
        <small>${(offsetMs / 1000).toFixed(6)} 秒 | 长期漂移率: ${time.document_parameters.long_term_drift.dTCL_dTDB.toExponential(3)}</small>
    `;
}

// 开始计时器
function startTimer() {
    if (state.timer.running) return;
    
    state.timer.running = true;
    state.timer.startTime = Date.now();
    
    // 更新按钮状态
    elements.startBtn.disabled = true;
    elements.pauseBtn.disabled = false;
    
    // 启动计时器循环
    state.timer.interval = setInterval(updateTimer, CONFIG.TIMER_INTERVAL);
    
    console.log('计时器开始');
}

// 暂停计时器
function pauseTimer() {
    if (!state.timer.running) return;
    
    state.timer.running = false;
    clearInterval(state.timer.interval);
    
    // 更新按钮状态
    elements.startBtn.disabled = false;
    elements.pauseBtn.disabled = true;
    
    console.log('计时器暂停');
}

// 重置计时器
function resetTimer() {
    pauseTimer();
    
    state.timer = {
        running: false,
        startTime: null,
        earthSeconds: 0,
        lunarSeconds: 0,
        laps: []
    };
    
    // 更新显示
    elements.earthTimer.textContent = '0.000';
    elements.lunarTimer.textContent = '0.000';
    elements.lapList.innerHTML = '<div class="lap-item"><span>圈速记录</span><span>地球时间 | 月球时间</span></div>';
    
    console.log('计时器重置');
}

// 更新计时器显示
function updateTimer() {
    if (!state.timer.running || !state.timer.startTime) return;
    
    // 计算经过的时间（地球秒）
    const now = Date.now();
    const elapsedMs = now - state.timer.startTime;
    const elapsedEarthSeconds = elapsedMs / 1000;
    
    // 应用LTE440长期漂移率计算月球时间
    // 文档第1页：dTCL/dTDB = 1 + 6.798355238e-10
    const driftRate = 1 + 6.798355238e-10;
    const elapsedLunarSeconds = elapsedEarthSeconds * driftRate;
    
    // 累计时间
    state.timer.earthSeconds += elapsedEarthSeconds;
    state.timer.lunarSeconds += elapsedLunarSeconds;
    
    // 重置起始时间
    state.timer.startTime = now;
    
    // 更新显示
    elements.earthTimer.textContent = state.timer.earthSeconds.toFixed(3);
    elements.lunarTimer.textContent = state.timer.lunarSeconds.toFixed(3);
}

// 记录圈速
function recordLap() {
    if (!state.timer.running) return;
    
    const lap = {
        number: state.timer.laps.length + 1,
        earthTime: state.timer.earthSeconds,
        lunarTime: state.timer.lunarSeconds,
        timestamp: new Date().toLocaleTimeString()
    };
    
    state.timer.laps.push(lap);
    
    // 保持最多MAX_LAPS个记录
    if (state.timer.laps.length > CONFIG.MAX_LAPS) {
        state.timer.laps.shift();
    }
    
    // 更新显示
    updateLapDisplay();
    
    console.log(`圈速记录 #${lap.number}: 地球${lap.earthTime.toFixed(3)}s / 月球${lap.lunarTime.toFixed(3)}s`);
}

// 更新圈速显示
function updateLapDisplay() {
    if (state.timer.laps.length === 0) {
        elements.lapList.innerHTML = '<div class="lap-item"><span>圈速记录</span><span>地球时间 | 月球时间</span></div>';
        return;
    }
    
    let html = '<div class="lap-item" style="opacity:0.7;"><span>圈速记录</span><span>地球时间 | 月球时间</span></div>';
    
    // 显示最新的圈速在最上面
    [...state.timer.laps].reverse().forEach(lap => {
        html += `
            <div class="lap-item">
                <span class="lap-number">#${lap.number}</span>
                <span class="lap-times">
                    <span class="lap-earth">${lap.earthTime.toFixed(3)}s</span>
                    <span style="margin:0 10px;">|</span>
                    <span class="lap-lunar">${lap.lunarTime.toFixed(3)}s</span>
                </span>
            </div>
        `;
    });
    
    elements.lapList.innerHTML = html;
}

// 加载文档信息
async function loadDocumentation() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/doc`);
        if (response.ok) {
            const doc = await response.json();
            updateDocDisplay(doc);
        }
    } catch (error) {
        console.error('加载文档信息失败:', error);
    }
}

// 更新文档信息显示
function updateDocDisplay(doc) {
    if (!elements.docInfo) return;
    
    elements.docInfo.innerHTML = `
        <div class="doc-item">
            <div class="doc-label">文档</div>
            <div class="doc-value">${doc.document}</div>
        </div>
        <div class="doc-item">
            <div class="doc-label">作者</div>
            <div class="doc-value">${doc.authors.join('、')}</div>
        </div>
        <div class="doc-item">
            <div class="doc-label">机构</div>
            <div class="doc-value">${doc.institution}</div>
        </div>
        <div class="doc-item">
            <div class="doc-label">精度</div>
            <div class="doc-value">${doc.precision}</div>
        </div>
    `;
}

// 开始时钟更新循环
function startClockUpdate() {
    // 立即更新一次
    updateTime();
    
    // 设置定时器
    setInterval(updateTime, CONFIG.UPDATE_INTERVAL);
}

// 工具函数：格式化时间
function formatTime(date) {
    return date.toISOString().split('T')[1].split('.')[0];
}

// 导出到全局（用于调试）
window.LTE440Clock = {
    state,
    config: CONFIG,
    updateTime,
    startTimer,
    pauseTimer,
    resetTimer,
    recordLap
};