"""
Hierarchical Chart Extractor
Extracts subsidiary flowcharts from PDF pages using coordinate-based logic.
"""

from typing import Dict, List, Any, Optional
import pdfplumber
import logging
import uuid
import re

logger = logging.getLogger(__name__)

class ChartExtractor:
    """
    Extracts hierarchical chart data from a PDF page.
    Assumes a columnar layout where:
    - Leftmost column contains Row Headers (e.g. "Name", "Holding %", "Activity")
    - Subsequent columns represent Entities (Subsidiaries)
    - Entities are aligned vertically
    """
    
    def __init__(self):
        pass
        
    def extract_from_page(self, page) -> Dict[str, Any]:
        """
        Extract chart data from a pdfplumber page object.
        Returns: { "nodes": [], "edges": [] }
        """
        try:
            # 1. Extract words with coordinates
            words = page.extract_words(
                x_tolerance=3, 
                y_tolerance=3, 
                keep_blank_chars=False, 
                use_text_flow=True
            )
            
            if not words:
                return {"nodes": [], "edges": []}
            
            # 2. Cluster words into Columns by X-coordinate
            columns = self._cluster_columns(words)
            
            if len(columns) < 2:
                logger.warning("Chart Extraction: Found less than 2 columns, skipping.")
                return {"nodes": [], "edges": []}
            
            # 3. Identify Row Headers (Leftmost Column)
            # Sort columns by X coordinate (left to right)
            sorted_cols = sorted(columns, key=lambda c: c['x_center'])
            header_col = sorted_cols[0]
            entity_cols = sorted_cols[1:]
            
            headers = self._cluster_rows(header_col['words'])
            logger.info(f"Chart Extraction: Found headers: {[h['text'] for h in headers]}")
            
            # 4. Extract Entity Data
            entities = []
            for col in entity_cols:
                entity_data = {}
                col_rows = self._cluster_rows(col['words'])
                
                # Match column rows to headers based on Y-overlap
                for row in col_rows:
                    matched_header = self._find_matching_header(row, headers)
                    key = matched_header['text'] if matched_header else "unknown"
                    entity_data[key] = row['text']
                
                # Try to identify a "Name" or "Entity" label
                # If not explicit, assume the first row/header is the Name
                name_key = next((k for k in entity_data.keys() if 'name' in k.lower() or 'company' in k.lower() or 'subsidiary' in k.lower()), None)
                if not name_key and headers:
                     name_key = headers[0]['text'] # Default to first header
                
                label = entity_data.get(name_key, "Unknown Entity")
                
                # If label is still empty/unknown and we have data, use the first value found
                if (label == "Unknown Entity" or not label) and entity_data:
                     first_val = list(entity_data.values())[0]
                     label = first_val
                
                entity_data['label'] = label
                entities.append(entity_data)
            
            # 5. Construct Graph (Nodes and Edges)
            nodes = []
            edges = []
            
            # Create Root Node (The Parent Company)
            # In a real scenario, we might detect this from the page title, but "Group" or "Parent" is a safe placeholder.
            root_id = "root_group"
            nodes.append({
                "id": root_id,
                "label": "Group / Parent",
                "type": "root",
                "parentNode": None
            })
            
            for i, entity in enumerate(entities):
                node_id = f"sub_{i}_{uuid.uuid4().hex[:4]}"
                label = entity.get('label', f"Subsidiary {i+1}")
                
                # Clean label
                label = re.sub(r'\s+', ' ', label).strip()
                
                nodes.append({
                    "id": node_id,
                    "label": label,
                    "type": "subsidiary",
                    "parentNode": root_id,
                    "data": entity # Store all extracted fields in data
                })
                
                edges.append({
                    "id": f"edge_{i}",
                    "source": root_id,
                    "target": node_id,
                    "label": entity.get("Holding %", "") or entity.get("Effective Holding", "")
                })
                
            return {
                "nodes": nodes,
                "edges": edges
            }
            
        except Exception as e:
            logger.error(f"Chart extraction failed: {e}", exc_info=True)
            return {"nodes": [], "edges": []}

    def _cluster_columns(self, words: List[Dict], x_tolerance: int = 20) -> List[Dict]:
        """
        Group words into vertical columns based on X-coordinates.
        """
        # Sort by x0
        sorted_words = sorted(words, key=lambda w: w['x0'])
        columns = []
        
        current_col = []
        if not sorted_words:
            return []
            
        # Initial bucket
        current_col.append(sorted_words[0])
        col_x_sum = sorted_words[0]['x0'] + sorted_words[0]['x1']
        col_count = 1
        
        for i in range(1, len(sorted_words)):
            word = sorted_words[i]
            word_center = (word['x0'] + word['x1']) / 2
            
            # Calculate current column average center
            # Simple approach: Check if word overlaps or is close to previous word in the column
            # BUT words in a column are vertical, so they might not be consecutive in sorted x list if columns overlap in X ranges.
            # Better approach: Iterate existing columns and try to fit.
            
            # Resetting simple approach:
            pass 
        
        # Simpler approach: 
        # 1. Identify distinct X-ranges that have high density.
        # 2. Assign words to these ranges.
        
        # Histogram approach
        # Bin width = 10?
        # Actually, let's just group by proximity to center.
        
        clusters = [] # List of {'center': float, 'words': []}
        
        for word in words:
            center = (word['x0'] + word['x1']) / 2
            assigned = False
            for cluster in clusters:
                if abs(center - cluster['center']) < x_tolerance:
                    cluster['words'].append(word)
                    # Update center average
                    # Moving average is risky if drift. Just keep initial center or re-avg?
                    # Re-averaging is better for wide columns
                    cluster['sum_x'] += center
                    cluster['count'] += 1
                    cluster['center'] = cluster['sum_x'] / cluster['count']
                    assigned = True
                    break
            
            if not assigned:
                clusters.append({
                    'center': center,
                    'sum_x': center,
                    'count': 1,
                    'words': [word]
                })
        
        # Sort clusters by center X
        sorted_clusters = sorted(clusters, key=lambda c: c['center'])
        
        # Perform a merge pass: if neighbors are too close (e.g. word variations), merge them
        merged = []
        if sorted_clusters:
            curr = sorted_clusters[0]
            for next_clust in sorted_clusters[1:]:
                # If gaps are small (could be same column alignment noise)
                if (next_clust['center'] - curr['center']) < x_tolerance:
                    # Merge
                    curr['words'].extend(next_clust['words'])
                    # Recompute center? Optional.
                else:
                    merged.append(curr)
                    curr = next_clust
            merged.append(curr)
        
        # Format for return
        result = []
        for c in merged:
            result.append({
                'x_center': c['center'],
                'words': c['words']
            })
            
        return result

    def _cluster_rows(self, words: List[Dict], y_tolerance: int = 15) -> List[Dict]:
        """
        Group words into horizontal rows (text blocks) based on Y-coordinates.
        Returns: [ {'top': float, 'bottom': float, 'text': str, 'y_center': float} ]
        """
        # Sort by top Y
        sorted_words = sorted(words, key=lambda w: w['top'])
        rows = []
        
        for word in sorted_words:
            assigned = False
            word_center = (word['top'] + word['bottom']) / 2
            
            for row in rows:
                # Check vertical overlap or proximity
                # Overlap: max(top1, top2) < min(bottom1, bottom2)
                # Proximity: center distance
                
                row_center = row['y_center']
                if abs(word_center - row_center) < y_tolerance:
                    row['words'].append(word)
                    # Update bounds
                    row['top'] = min(row['top'], word['top'])
                    row['bottom'] = max(row['bottom'], word['bottom'])
                    # Update center
                    row['y_center'] = (row['top'] + row['bottom']) / 2
                    assigned = True
                    break
            
            if not assigned:
                rows.append({
                    'top': word['top'],
                    'bottom': word['bottom'],
                    'y_center': word_center,
                    'words': [word]
                })
        
        # Sort rows by Y
        sorted_rows = sorted(rows, key=lambda r: r['top'])
        
        # Construct text for each row
        results = []
        for r in sorted_rows:
            # Sort words left to right
            r_words = sorted(r['words'], key=lambda w: w['x0'])
            text = ' '.join(w['text'] for w in r_words)
            results.append({
                'text': text,
                'top': r['top'],
                'bottom': r['bottom'],
                'y_center': r['y_center']
            })
            
        return results

    def _find_matching_header(self, row: Dict, headers: List[Dict]) -> Optional[Dict]:
        """
        Find the header row that aligns vertically with this data row.
        """
        best_match = None
        min_dist = float('inf')
        
        for header in headers:
            dist = abs(row['y_center'] - header['y_center'])
            if dist < 20: # Tolerance
                if dist < min_dist:
                    min_dist = dist
                    best_match = header
        
        return best_match
