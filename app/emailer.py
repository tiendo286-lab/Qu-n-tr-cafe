"""Gửi email (chỉ dùng cho mã khôi phục mật khẩu).

Cấu hình trong du_lieu/cau_hinh.json, ví dụ với Gmail (cần "Mật khẩu ứng dụng"):
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "quan.cafe@gmail.com",
  "smtp_password": "mat-khau-ung-dung-16-ky-tu",
  "smtp_from": "Lịch làm Milano <quan.cafe@gmail.com>"
}
"""
from __future__ import annotations

import json
import os
import smtplib
import ssl
from email.message import EmailMessage

from .db import DATA_DIR


def _config() -> dict:
    path = DATA_DIR / "cau_hinh.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def email_configured() -> bool:
    c = _config()
    return bool(c.get("smtp_host") and c.get("smtp_user") and c.get("smtp_password"))


def send_email(to: str, subject: str, body: str) -> None:
    """Gửi email. Khi APP_DEBUG_EMAIL=1 thì chỉ in ra màn hình (dùng lúc chạy thử)."""
    if os.environ.get("APP_DEBUG_EMAIL") == "1":
        print(f"[EMAIL THỬ] Tới: {to}\nTiêu đề: {subject}\n{body}\n")
        return
    c = _config()
    msg = EmailMessage()
    msg["From"] = c.get("smtp_from") or c["smtp_user"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    port = int(c.get("smtp_port", 587))
    if port == 465:
        with smtplib.SMTP_SSL(c["smtp_host"], port, context=ssl.create_default_context(), timeout=20) as s:
            s.login(c["smtp_user"], c["smtp_password"])
            s.send_message(msg)
    else:
        with smtplib.SMTP(c["smtp_host"], port, timeout=20) as s:
            s.starttls(context=ssl.create_default_context())
            s.login(c["smtp_user"], c["smtp_password"])
            s.send_message(msg)
