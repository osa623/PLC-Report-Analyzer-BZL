import json
import os
from pymongo import MongoClient

uri = "mongodb+srv://dbadmin:osa623@cluster0.4nquj0a.mongodb.net/?appName=Cluster0"

def insert_raw_results():
    try:
        client = MongoClient(uri)
        col = client["plc"]["temporary_financial_statements"]
        
        # Load the raw extraction JSON
        file_path = "services/extraction_service/batch_extraction_results.json"
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return
            
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Delete existing testing records if you want, or just insert new ones.
        # col.delete_many({}) # Uncomment to clear collection
        
        for item in data:
            # We can optionally tag it with a report_id or use the raw structure directly
            if "report_id" not in item:
                item["report_id"] = "raw_batch_extraction" # Add a dummy ID for identification
            result = col.insert_one(item)
            print(f"Inserted document with ID: {result.inserted_id}")
            
        print("Data insertion complete.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    insert_raw_results()