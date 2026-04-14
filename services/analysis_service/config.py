from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from platform_core.shared_infra.config_loader import ServiceConfig, load_config


def get_config() -> ServiceConfig:
    return load_config("analysis_service", default_port=8002)
