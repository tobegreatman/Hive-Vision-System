"""静默启动 stockframe Web 控制台（无 CMD 窗口）。

由 start.bat 通过 pythonw.exe 调起（pythonw 不带控制台，所以不会弹窗）。
关闭任何窗口都不会影响它；要用 stop.bat 才停得掉。

- 日志：logs/server.log（pythonw 没有控制台，出错只能从这里看）
- 单实例：端口已被占用时直接退出，不会起第二个
- 端口：默认 8770，可用环境变量 STOCKFRAME_PORT 覆盖
"""

from __future__ import annotations

import os
import socket
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOST = "127.0.0.1"
PORT = int(os.environ.get("STOCKFRAME_PORT", "8770"))


def port_busy(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def main() -> int:
    os.chdir(ROOT)
    sys.path.insert(0, str(ROOT / "src"))

    log_dir = ROOT / "logs"
    log_dir.mkdir(exist_ok=True)
    log = open(log_dir / "server.log", "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stderr = log

    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if port_busy(HOST, PORT):
        # 已有实例在跑属于「已满足」，返回 0，避免 pnpm dev:all 把它当成失败而整体退出
        print(f"[{stamp}] port {PORT} already in use, exit（已有实例在跑）")
        return 0

    print(f"[{stamp}] starting http://{HOST}:{PORT}/  root={ROOT}")
    from stockframe.server import serve

    try:
        serve(HOST, PORT)
    except KeyboardInterrupt:
        pass
    except Exception:
        import traceback

        traceback.print_exc()
        return 1
    finally:
        print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
