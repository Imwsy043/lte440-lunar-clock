🌍🌙 LTE440 地月精密时钟

基于**中国科学院紫金山天文台《月球时间历表LTE440》** 文档实现的高精度地月时间转换系统。

✨ 功能特性

- **实时双显时钟**：同时显示地球时间（UTC/TDB）和月球时间（TCL）
- **高精度转换**：基于LTE440历表，精度达**数皮秒量级**
- **相对论效应**：计算长期漂移（0.68纳秒/秒）和周期项（1.651毫秒）
- **双模式计时器**：分别以地球秒和月球秒计时
- **桌面应用**：使用Electron打包为独立的Windows软件

📁 项目结构


LUNATIME/
├── backend/          # Python后端
│   ├── server.py    # Flask API服务器
│   ├── lte440.py    # LTE440官方接口模块
│   ├── requirements.txt # Python依赖
│   └── data/        # LTE440数据文件
│       ├── lte440.bsp
│       └── lte440.tpc
├── frontend/        # 网页前端
│   ├── index.html   # 主界面
│   ├── styles.css   # 样式
│   └── app.js       # 前端逻辑
├── main.js          # Electron主进程
├── package.json     # 项目配置
└── README.md        # 本文件

📚 文档参考

本软件严格遵循：

1. 《月球时间历表LTE440》 - 卢旭，杨天宁，谢懿，紫金山天文台，2025
2. IAU 2024决议2 - 月球坐标时间（TCL）定义
3. DE440/DE441历表 - JPL行星和月球历表

🛠️ 开发说明

环境要求

· Python 3.8+
· Node.js 16+
· Windows 10/11, macOS 10.15+, Linux

项目配置

1. 获取LTE440数据文件（lte440.bsp, lte440.tpc, lte440.py）
2. 放入 backend/data/ 和 backend/ 目录
3. 安装依赖（见上文）


📄 许可证

本项目基于《月球时间历表LTE440》文档实现，仅供学习和研究使用。

🙏 致谢

· 中国科学院紫金山天文台 - 提供LTE440历表
· 国际天文学联合会（IAU） - 时间系统定义
· NASA/JPL - SPICE工具包和DE440历表


1. 检查所有文件是否在正确位置
2. 确保Python和Node.js版本符合要求
3. 查看终端错误信息
4. 提交Issue或联系开发者


版本: 1.0.0 | 最后更新: 2025-01-14 | 状态: 🟢 稳定运行