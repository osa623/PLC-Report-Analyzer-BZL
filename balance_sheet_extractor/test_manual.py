import os
from redis import Redis
import requests
import json
import time

# Create a sample fake chunk containing a Balance Sheet snippet
sample_chunk = {
    "chunk_id": "chunk_001",
    "text_content": """
    STATEMENT OF FINANCIAL POSITION
    As at 31 March 2024
    
    Assets                          2024 (Group)       2023 (Group)
    Property, plant and equipment      15,400.00          14,200.00
    Cash and cash equivalents           2,100.00             800.00
    Total Assets                       17,500.00          15,000.00
    
    Equity and Liabilities
    Share capital                      10,000.00          10,000.00
    Retained earnings                   2,500.00             500.00
    Total Equity                       12,500.00          10,500.00
    
    Long-term borrowings                3,000.00           3,000.00
    Short-term payables                 2,000.00           1,500.00
    Total Liabilities                   5,000.00           4,500.00
    """,
    "page_number": 1
}

def setup_redis_data(report_id: str):
    # Connect to localhost redis (assuming default port 6379 natively or in docker)
    redis_client = Redis(host='localhost', port=6379, db=0, decode_responses=True)
    
    # Push the mock chunk into Redis
    chunks_key = f"report:{report_id}:document_chunks"
    structure_key = f"report:{report_id}:structure"
    
    redis_client.set(chunks_key, json.dumps({"chunks": [sample_chunk]}))
    redis_client.set(structure_key, json.dumps({}))
    print(f"[+] Loaded mock chunks into Redis for {report_id}")

def test_api(report_id: str):
    url = "http://localhost:8004/extract-financials"
    
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
            print(json.dumps(data.get("balance_sheet", {}), indent=2)[:1000] + "\n... (truncated payload)")
        
    except requests.exceptions.ConnectionError:
        print("[-] ERROR: Could not connect to API. Is the balance_sheet_extractor service running on port 8000?")
    except requests.exceptions.HTTPError as e:
        print(f"[-] ERROR: API failed: {e}")

if __name__ == "__main__":
    test_report_id = "test_run_101"
    setup_redis_data(test_report_id)
    test_api(test_report_id)
