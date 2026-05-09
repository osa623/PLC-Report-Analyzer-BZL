from __future__ import annotations

import json

from platform_core.contracts.canonical_dataset import CanonicalRawReport


def build_canonical(raw_payload: str) -> CanonicalRawReport:
    return CanonicalRawReport(**json.loads(raw_payload))
