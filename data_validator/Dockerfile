FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if any (e.g. for OCR or PDF parsing if needed locally)
# RUN apt-get update && apt-get install -y ...

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8018

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8018"]