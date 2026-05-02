"""
Schema Module - Output Schema Management
Builds canonical JSON and metadata
"""

from .canonical_builder import CanonicalBuilder
from .review_payload import ReviewPayloadBuilder

__all__ = ['CanonicalBuilder', 'ReviewPayloadBuilder']
