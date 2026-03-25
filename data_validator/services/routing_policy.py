from typing import Any


class ConfidenceRoutingPolicy:
    def __init__(
        self,
        enabled: bool = True,
        fallback_on_medium: bool = False,
        fail_on_low: bool = True,
    ) -> None:
        self.enabled = enabled
        self.fallback_on_medium = fallback_on_medium
        self.fail_on_low = fail_on_low

    @staticmethod
    def default_fallback_metadata(provider: str, reason: str) -> dict[str, Any]:
        return {
            "fallback_provider": provider,
            "fallback_attempted": False,
            "fallback_applied": False,
            "fallback_reason": reason,
        }

    def route_before_fallback(self, status: str, confidence_band: str) -> dict[str, Any]:
        if not self.enabled:
            return {
                "decision": "primary",
                "should_attempt_fallback": False,
                "reason": "routing_disabled",
            }

        if status == "failed":
            return {
                "decision": "primary",
                "should_attempt_fallback": False,
                "reason": "status_failed",
            }

        if confidence_band == "low":
            return {
                "decision": "fallback",
                "should_attempt_fallback": True,
                "reason": "low_confidence",
            }

        if confidence_band == "medium" and self.fallback_on_medium:
            return {
                "decision": "fallback",
                "should_attempt_fallback": True,
                "reason": "medium_confidence_policy",
            }

        return {
            "decision": "primary",
            "should_attempt_fallback": False,
            "reason": "confidence_not_routable",
        }

    def resolve_after_extraction(
        self,
        status: str,
        confidence_band: str,
        fallback_attempted: bool,
    ) -> tuple[str, str | None]:
        if status == "failed":
            return status, None

        if confidence_band == "low" and self.fail_on_low:
            if fallback_attempted:
                return "failed", "low_confidence_after_fallback"
            return "failed", "low_confidence_output"

        if confidence_band == "medium" and status == "completed":
            return "partial", None

        return status, None
