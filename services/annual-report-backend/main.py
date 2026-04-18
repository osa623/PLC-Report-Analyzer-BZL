"""
Main entry point for two-stage financial statement extraction
Stage A: Intelligent page location using ToC detection
Stage B: Structured data extraction with Bank/Group and Year1/Year2 organization
"""

import logging
from pathlib import Path
import sys
import json

sys.path.append(str(Path(__file__).parent))

from src.pipeline.two_stage_pipeline import TwoStagePipeline

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Main execution function."""
    
    print("\n" + "="*80)
    print("🚀 TWO-STAGE FINANCIAL STATEMENT EXTRACTOR")
    print("="*80)
    print("📄 Stage A: Intelligent Page Location (ToC-based)")
    print("📊 Stage B: Structured Data Extraction (Bank/Group + Year1/Year2)")
    print("✅ Works with any bank annual report")
    print("="*80 + "\n")
    
    # Initialize extractor
    pipeline = TwoStagePipeline()
    
    # Define PDF paths
    data_dir = Path(__file__).parent / "data" / "raw"
    
    # Available PDFs
    pdf_files = {
        "1": data_dir / "pabc" / "pabc.pdf",
        "2": data_dir / "hnb" / "hnb.pdf",
        "3": data_dir / "commercial" / "Commerical.pdf",
        "4": data_dir / "dfcc" / "DFCC.pdf",
        "5": data_dir / "janashakthi" / "janashakthi.pdf",
        "6": data_dir / "jhonkeels" / "jhonkeells.pdf",
    }
    
    # Display menu
    print("Select a PDF to extract:")
    print("1. Pan Asia Banking Corporation (PABC)")
    print("2. HNB Bank")
    print("3. Commercial Bank")
    print("4. DFCC Bank")
    print("5. Janashakthi Bank")
    print("6. John Keells")
    print("7. Custom path")
    
    choice = input("\nEnter choice (1-7): ").strip()
    
    if choice in pdf_files:
        pdf_path = pdf_files[choice]
    elif choice == "7":
        custom_path = input("Enter PDF path: ").strip()
        pdf_path = Path(custom_path)
    else:
        print("❌ Invalid choice")
        return
    
    if not pdf_path.exists():
        print(f"❌ PDF not found: {pdf_path}")
        return
    
    # Extract
    try:
        logger.info(f"\n🚀 Starting extraction from: {pdf_path.name}\n")
        
        result = pipeline.extract(str(pdf_path), save_intermediates=True)
        
        # Get canonical output
        canonical_output = result.get('canonical_output', {})
        
        # Save user-friendly output
        output_dir = Path(__file__).parent / "data" / "processed" / "statement_jsons"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{pdf_path.stem}_extracted.json"
        
        with open(output_file, 'w') as f:
            json.dump(canonical_output, f, indent=2)
        
        # Display summary
        print("\n" + "="*80)
        print("✅ EXTRACTION COMPLETED SUCCESSFULLY")
        print("="*80)
        
        for entity in ["Bank", "Group"]:
            for year in ["Year1", "Year2"]:
                year_data = canonical_output.get(entity, {}).get(year, {})
                if not year_data:
                    continue
                    
                income_fields = len(year_data.get('Income_Statement', {}))
                position_fields = len(year_data.get('Financial Position Statement', {}))
                cashflow_fields = len(year_data.get('Cash Flow Statement', {}))
                total_fields = income_fields + position_fields + cashflow_fields
                
                if total_fields > 0:
                    print(f"📊 {entity} {year}: {total_fields} fields extracted")
                    print(f"   - Income Statement: {income_fields}")
                    print(f"   - Financial Position: {position_fields}")
                    print(f"   - Cash Flow: {cashflow_fields}")
        
        print(f"\n💾 Results saved to: {output_file}")
        print("="*80 + "\n")
        
    except Exception as e:
        logger.error(f"❌ Extraction failed: {e}", exc_info=True)


if __name__ == "__main__":
    main()
