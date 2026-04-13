from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable


def run_parallel(tasks: list[tuple[str, Callable[[], Any]]], max_workers: int) -> dict[str, Any]:
    results: dict[str, Any] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {executor.submit(func): name for name, func in tasks}
        for future in as_completed(future_map):
            name = future_map[future]
            try:
                results[name] = future.result()
            except Exception as exc:  # pragma: no cover
                results[name] = {"error": str(exc)}
    return results
