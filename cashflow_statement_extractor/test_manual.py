import os
from redis import Redis
import requests
import json
import time

# Create a sample fake chunk containing a Cash Flow Statement snippet
sample_chunk = {
    "chunk_id": "chunk_cf_001",
    "text_content": """
    STATEMENT OF CASH FLOWS
    For the year ended 31 March 2024
    
    Operating Activities            2024 (Group)       2023 (Group)
    Cash generated from operations     8,500.00          7,200.00
    Income tax paid                   (1,200.00)          (800.00)
    Net cash from operating activities 7,300.00          6,400.00
    
    Investing Activities
    Purchase of property and plant    (4,000.00)        (3,500.00)
    Net cash used in investing activities (4,000.00)     (3,500.00)
    
    Financing Activities
    Dividends paid                    (1,500.00)        (1,000.00)
    Net cash used in financing activities (1,500.00)     (1,000.00)
    
    Net increase in cash equivalents   1,800.00          1,900.00
    """,
    "page_number": 1
}

def setup_redis_data(report_id: str):
    # Connect to localhost redis (assuming default port 6379)
    redis_client = Redis(host='localhost', port=6379, db=0, decode_responses=True)
    
    chunks_key = f"report:{report_id}:document_chunks"
    structure_key = f"report:{report_id}:structure"
    
    redis_client.set(chunks_key, json.dumps({"chunks": [sample_chunk]}))
    redis_client.set(structure_key, json.dumps({}))
    print(f"[+] Loaded mock cashflow chunk into Redis for {report_id}")

def test_api(report_id: str):
    # Assume cashflow component is mapping to port 8003 or defaults
    # Verify the correct port of your cashflow worker later
    url = "http://localhost:8005/extract-financials"  
    
    payload = {
        "report_id": report_id,
        "file_path": "mock_path_ignored.pdf"
    }

    print(f"[+] Triggering extraction API at {url}...")
    start_time = time.time()
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        end_time = time.time()
        
        print(f"[+] API Response ({round(end_time - start_time, 2)}s):")
        print(json.dumps(response.json(), indent=2))
        
        # Verify the Redis payload actually wrote perfectly
        redis_client = Redis(host='localhost', port=6379, db=0, decode_responses=True)
        base_key = f"report:{report_id}"
        stored_data = redis_client.get(base_key)
        
        if stored_data:
            data = json.loads(stored_data)
            print("\n[+] Verification Check - Data successfully merged into Redis: ")
            cashflow_data = data.get("cashflow_statement", {})
            print(json.dumps(cashflow_data, indent=2)[:1000] + "\n... (truncated payload)")
        
    except requests.exceptions.ConnectionError:
        print("[-] ERROR: Could not connect to API. Is the cashflow_statement_extractor service running?")
    except requests.exceptions.HTTPError as e:
        print(f"[-] ERROR: API failed: {e}")

if __name__ == "__main__":
    test_report_id = "test_cf_101"
    setup_redis_data(test_report_id)
    test_api(test_report_id)
