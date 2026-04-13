from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class InMemoryMetricsSink:
    counters: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    gauges: dict[str, float] = field(default_factory=dict)
    histograms: dict[str, list[float]] = field(default_factory=lambda: defaultdict(list))

    def increment(self, name: str, value: float = 1.0) -> None:
        self.counters[name] += value

    def gauge(self, name: str, value: float) -> None:
        self.gauges[name] = value

    def observe(self, name: str, value: float) -> None:
        self.histograms[name].append(value)

    def snapshot(self) -> dict[str, dict[str, float | list[float]]]:
        return {
            "counters": dict(self.counters),
            "gauges": dict(self.gauges),
            "histograms": dict(self.histograms),
        }
