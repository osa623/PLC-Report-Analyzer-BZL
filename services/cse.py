import requests

url = "https://www.cse.lk/api/companyProfile"

payload = {
    "symbol": "LOLC.N0000"
}

res = requests.post(url, data=payload)
data = res.json()

print(data)