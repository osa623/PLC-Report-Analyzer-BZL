import warnings

# ==============================================================================
# DEPRECATED: STRICT PIPELINE
# ==============================================================================
# This module is obsolete. The Financial Structure Engine and Reconciliation Engine
# now handle all data mapping and hard validation gates.
# This file is kept only as a thin compatibility wrapper if needed.
# ==============================================================================

def build_strict_extraction_dataset(*args, **kwargs):
    warnings.warn(
        "build_strict_extraction_dataset is deprecated. Use FinancialStructureEngine instead.",
        DeprecationWarning
    )
    return {}
