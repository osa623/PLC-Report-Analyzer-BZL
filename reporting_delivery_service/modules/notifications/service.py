from __future__ import annotations

import json
import urllib.request
from typing import Any


def send_webhook(webhook_url: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(webhook_url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as response:
        return {"status": "sent", "status_code": response.getcode()}
