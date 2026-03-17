from typing import Any


class TransformationService:
    @staticmethod
    def _as_str(value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _normalize_member_list(value: Any) -> list[str]:
        if isinstance(value, list):
            members = [str(item).strip() for item in value if str(item).strip()]
            return members
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return []

    def transform(self, report_id: str, raw_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
        records: list[dict[str, Any]] = []
        partial = False

        if not isinstance(raw_payload, dict):
            return records, True

        board_members = raw_payload.get("board_members")
        if isinstance(board_members, list):
            for member in board_members:
                if not isinstance(member, dict):
                    partial = True
                    continue
                name = self._as_str(member.get("name"))
                if not name:
                    partial = True
                    continue
                records.append(
                    {
                        "report_id": report_id,
                        "type": "board_member",
                        "name": name,
                        "role": self._as_str(member.get("role")),
                        "classification": self._as_str(member.get("type")),
                    }
                )
        elif board_members is not None:
            partial = True

        committees = raw_payload.get("committees")
        if isinstance(committees, list):
            for committee in committees:
                if not isinstance(committee, dict):
                    partial = True
                    continue
                name = self._as_str(committee.get("name"))
                if not name:
                    partial = True
                    continue
                records.append(
                    {
                        "report_id": report_id,
                        "type": "committee",
                        "name": name,
                        "role": self._as_str(committee.get("role")),
                        "members": self._normalize_member_list(committee.get("members")),
                    }
                )
        elif committees is not None:
            partial = True

        executives = raw_payload.get("executive_leadership")
        if isinstance(executives, list):
            for executive in executives:
                if not isinstance(executive, dict):
                    partial = True
                    continue
                name = self._as_str(executive.get("name"))
                if not name:
                    partial = True
                    continue
                records.append(
                    {
                        "report_id": report_id,
                        "type": "executive_leader",
                        "name": name,
                        "role": self._as_str(executive.get("role")),
                        "classification": self._as_str(executive.get("type")),
                    }
                )
        elif executives is not None:
            partial = True

        policies = raw_payload.get("governance_policies")
        if isinstance(policies, list):
            for policy in policies:
                if not isinstance(policy, dict):
                    partial = True
                    continue
                name = self._as_str(policy.get("name"))
                text = self._as_str(policy.get("text"))
                if not name:
                    partial = True
                    continue
                records.append(
                    {
                        "report_id": report_id,
                        "type": "governance_policy",
                        "name": name,
                        "text": text,
                    }
                )
        elif policies is not None:
            partial = True

        return records, partial
