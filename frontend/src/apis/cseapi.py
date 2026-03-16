import requests

# CSE API endpoint (POST required)
url = "https://www.cse.lk/api/tradeSummary"
headers = {"Content-Type": "application/json"}
resp = requests.post(url, json={"symbol": "HNB"}, headers=headers)
resp.raise_for_status()

data = resp.json()
summary = data.get("reqTradeSummery", [])

# Find HNB in the results
hnb = next((s for s in summary if "HNB" in s.get("symbol", "")), None)

if hnb:
    print("Name:", hnb["name"])
    print("Last Price:", hnb["price"])
    print("Change:", hnb["change"], f"({hnb['percentageChange']:.2f}%)")
    print("High:", hnb["high"])
    print("Low:", hnb["low"])
    print("Volume:", hnb["sharevolume"])
    print("Turnover:", hnb["turnover"])
else:
    print("HNB not found in trade summary.")