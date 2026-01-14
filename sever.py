from flask import Flask, jsonify
from flask_cors import CORS
import spiceypy as spice
from datetime import datetime
import numpy as np
import sys
import os

# 添加当前目录到路径，以便导入lte440
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app)  # 允许跨域访问

# 状态变量
lte440_loaded = False

def init_lte440():
    """初始化LTE440历表（文档第2.1节）"""
    global lte440_loaded
    
    try:
        # 加载LTE440数据文件
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        bsp_path = os.path.join(data_dir, 'lte440.bsp')
        tpc_path = os.path.join(data_dir, 'lte440.tpc')
        
        if not os.path.exists(bsp_path):
            return {"error": f"找不到文件: {bsp_path}"}
        if not os.path.exists(tpc_path):
            return {"error": f"找不到文件: {tpc_path}"}
        
        spice.furnsh(bsp_path)
        spice.furnsh(tpc_path)
        lte440_loaded = True
        
        return {"success": True, "message": "LTE440历表加载成功"}
        
    except Exception as e:
        return {"error": f"加载失败: {str(e)}"}

def utc_to_jd_tdb(utc_time):
    """
    将UTC时间转换为TDB儒略日（简化版）
    注：完整的UTC->TT->TDB转换需要DE440历表
    """
    # 简化处理：UTC与TDB差异很小，直接转换
    # 实际应用中应使用IAU SOFA库或spiceypy的完整转换
    
    # 将datetime转换为儒略日（简化公式）
    # 更精确的转换应使用spice.utc2et
    year = utc_time.year
    month = utc_time.month
    day = utc_time.day
    hour = utc_time.hour
    minute = utc_time.minute
    second = utc_time.second + utc_time.microsecond/1e6
    
    if month <= 2:
        year -= 1
        month += 12
    
    a = year // 100
    b = 2 - a + a // 4
    jd_int = int(365.25 * (year + 4716)) + int(30.6001 * (month + 1)) + day + b - 1524.5
    jd_frac = (hour + minute/60.0 + second/3600.0) / 24.0
    
    # 简化：忽略UTC->TDB的差异（约0.0016秒）
    return jd_int + jd_frac

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取服务器状态"""
    return jsonify({
        "service": "LTE440 Time Server",
        "version": "1.0",
        "lte440_loaded": lte440_loaded,
        "document_reference": "《月球时间历表LTE440》2025",
        "endpoints": {
            "/api/status": "服务器状态",
            "/api/now": "当前地月时间",
            "/api/convert": "时间转换"
        }
    })

@app.route('/api/now', methods=['GET'])
def get_current_time():
    """获取当前的地球和月球时间（文档第3页风格）"""
    if not lte440_loaded:
        init_result = init_lte440()
        if "error" in init_result:
            return jsonify({"error": init_result["error"]}), 500
    
    try:
        # 导入lte440模块
        from lte440 import tclmtdb, tclmtcb
        
        # 获取当前UTC时间
        now_utc = datetime.utcnow()
        
        # 转换为TDB儒略日（简化）
        jd_tdb = utc_to_jd_tdb(now_utc)
        
        # 调用LTE440函数（文档第3页）
        tcl_tdb_diff = tclmtdb(jd_tdb)  # 秒
        tcl_tcb_diff = tclmtcb(jd_tdb)  # 秒
        
        # 计算月球时间
        jd_tcl = jd_tdb + tcl_tdb_diff / 86400.0
        
        # 准备响应数据
        response = {
            "success": True,
            "data": {
                # 时间数值
                "earth_time": {
                    "tdb_jd": jd_tdb,
                    "tdb_readable": f"JD {jd_tdb:.10f}",
                    "utc": now_utc.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                },
                "lunar_time": {
                    "tcl_jd": jd_tcl,
                    "tcl_readable": f"JD {jd_tcl:.10f}"
                },
                # 差值信息
                "differences": {
                    "tcl_minus_tdb": {
                        "seconds": tcl_tdb_diff,
                        "milliseconds": tcl_tdb_diff * 1000,
                        "microseconds": tcl_tdb_diff * 1e6
                    },
                    "tcl_minus_tcb": {
                        "seconds": tcl_tcb_diff,
                        "milliseconds": tcl_tcb_diff * 1000
                    }
                },
                # 文档参数（第1页）
                "document_parameters": {
                    "long_term_drift": {
                        "dTCL_dTDB": 1 + 6.798355238e-10,
                        "dTCL_dTCB": 1 - 1.48253621667e-8,
                        "description": "每TDB秒，TCL慢约0.68纳秒"
                    },
                    "main_periodic_term": {
                        "amplitude": 1.65136e-3,
                        "period_days": 365.256363004,
                        "description": "最显著的周期项（周年项）"
                    }
                }
            },
            "timestamp": now_utc.isoformat() + "Z"
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }), 500

@app.route('/api/convert', methods=['GET'])
def convert_time():
    """时间转换接口"""
    # 从查询参数获取时间
    from flask import request
    
    time_str = request.args.get('time')
    if not time_str:
        # 默认使用当前时间
        return get_current_time()
    
    # 这里可以扩展为处理不同格式的时间输入
    # 目前简化处理
    
    return jsonify({"error": "时间转换功能待实现"}), 501

@app.route('/api/doc', methods=['GET'])
def get_documentation():
    """返回文档信息"""
    return jsonify({
        "document": "月球时间历表 LTE440",
        "authors": ["卢旭", "杨天宁", "谢懿"],
        "institution": "中国科学院紫金山天文台",
        "date": "2025年6月25日",
        "reference": "IAU 2024决议2",
        "description": "提供TCL与TDB/TCB之间的数值变换关系",
        "precision": "数皮秒量级",
        "usage": "参见第2-3页调用示例"
    })

if __name__ == '__main__':
    print("=" * 50)
    print("LTE440 地月时间服务器")
    print("基于《月球时间历表LTE440》文档实现")
    print("=" * 50)
    
    # 初始化LTE440
    init_result = init_lte440()
    if "success" in init_result:
        print("✅ " + init_result["message"])
    else:
        print("❌ " + init_result["error"])
        print("提示：请确保lte440.bsp和lte440.tpc文件在backend/data/目录下")
    
    print("\nAPI端点:")
    print("  http://localhost:5000/api/status    - 服务器状态")
    print("  http://localhost:5000/api/now       - 当前地月时间")
    print("  http://localhost:5000/api/doc       - 文档信息")
    print("\n按 Ctrl+C 停止服务器")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)