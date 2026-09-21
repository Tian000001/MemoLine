#!/usr/bin/env python3
"""提交前校验（由 .githooks/pre-commit 调用）。

从 stdin 读取本次暂存的文件列表（git diff --cached --name-only），然后：

  * `*.py`                —— 用 ast.parse 做语法检查（不执行代码）
  * `*.bat` / `*.cmd`     —— 必须是「纯 ASCII + CRLF + 无 BOM」
                             否则 cmd.exe 在 GBK 控制台会解析崩溃，见项目约定

任一检查失败即返回 1，阻断提交。显式跳过：`SKIP_GIT_HOOKS=1 git commit ...`

用法：
    git diff --cached --name-only | python scripts/check_commit.py
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

BOM_UTF8 = b"\xef\xbb\xbf"


def check_python(path: Path) -> list[str]:
    try:
        source = path.read_bytes()
    except OSError as exc:
        return [f"{path}: 无法读取（{exc}）"]

    try:
        ast.parse(source, filename=str(path))
    except SyntaxError as exc:
        return [f"{path}:{exc.lineno or 0}: 语法错误 —— {exc.msg}"]

    return []


def check_batch(path: Path) -> list[str]:
    """Windows 批处理必须是纯 ASCII + CRLF，且不能带 BOM。"""
    try:
        data = path.read_bytes()
    except OSError as exc:
        return [f"{path}: 无法读取（{exc}）"]

    problems: list[str] = []

    non_ascii = sum(1 for byte in data if byte > 127)
    if non_ascii:
        problems.append(f"{non_ascii} 个非 ASCII 字节（中文注释/提示会破坏 cmd 解析）")

    lone_lf = data.count(b"\n") - data.count(b"\r\n")
    if lone_lf > 0:
        problems.append(f"{lone_lf} 处孤立 LF（需全部为 CRLF）")

    if data.startswith(BOM_UTF8):
        problems.append("带 UTF-8 BOM")

    if not problems:
        return []

    return [
        f"{path}: " + "；".join(problems),
        "          修复：只保留 ASCII 字符，并把行尾统一为 CRLF。",
    ]


def main() -> int:
    paths = [line.strip() for line in sys.stdin if line.strip()]
    if not paths:
        return 0

    failures: list[str] = []

    python_files = [Path(p) for p in paths if p.endswith(".py")]
    batch_files = [Path(p) for p in paths if p.endswith((".bat", ".cmd"))]

    if python_files:
        print(f"[pre-commit] 检查 {len(python_files)} 个 Python 文件的语法...")
        for path in python_files:
            if path.is_file():
                failures.extend(check_python(path))

    if batch_files:
        print(f"[pre-commit] 检查 {len(batch_files)} 个批处理文件的编码...")
        for path in batch_files:
            if path.is_file():
                failures.extend(check_batch(path))

    if failures:
        print()
        for line in failures:
            print("  " + line)
        print()
        print("[pre-commit] 校验未通过，请修复后重新提交（或 SKIP_GIT_HOOKS=1 跳过）。")
        return 1

    print("[pre-commit] 校验通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
