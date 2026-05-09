import requests

# Unofficial CSE API endpoint for HNB
url = "https://www.cse.lk/api/stockPrices?symbol=HNB"
resp = requests.get(url)
data = resp.json()

print("Last Price:", data['lastPrice'])
print("Volume:", data['volume'])