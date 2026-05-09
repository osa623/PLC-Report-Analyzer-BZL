"""
Mapper Module - Row Label Mapping
Cascading mapping strategy: exact → synonyms → fuzzy → semantic
"""

from .mapping_engine import MappingEngine

__all__ = ['MappingEngine']
