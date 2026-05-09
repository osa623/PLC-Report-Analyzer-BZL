import sys
import os
import json
from bson import json_util

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from pymongo import MongoClient

uri = "mongodb+srv://dbadmin:osa623@cluster0.4nquj0a.mongodb.net/?appName=Cluster0"

def fetch_one():
    try:
        client = MongoClient(uri)
        # the db is likely named "plc" based on default
        col = client["plc"]["temporary_financial_statements"]
        doc = col.find_one()
        if doc:
            print(json.dumps(json.loads(json_util.dumps(doc)), indent=2))
        else:
            print("No documents found in 'temporary_financial_statements' collection.")
    except Exception as e:
        print(f"Error fetching from MongoDB: {e}")

if __name__ == "__main__":
    fetch_one()