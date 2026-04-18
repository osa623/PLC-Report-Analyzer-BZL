from typing import Any, Dict, Tuple


def validate_schema(document: Dict[str, Any], required_paths: Dict[str, list]) -> Tuple[bool, list]:
    """Validate presence of required fields. required_paths maps logical section to list of required keys."""
    errors = []
    for section, keys in required_paths.items():
        sec = document.get(section)
        if sec is None:
            errors.append(f"Missing section: {section}")
            continue
        for k in keys:
            if k not in sec:
                errors.append(f"Missing key {k} in {section}")
    return (len(errors) == 0, errors)
