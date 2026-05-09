FROM python:3.11-slim

WORKDIR /app

# System deps (common for PDF/data extraction libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    poppler-utils \
    tesseract-ocr \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# If you have requirements.txt (recommended)
COPY requirements*.txt ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# Copy app
COPY . .

# If your backend uses a known port, expose it (change if needed)
EXPOSE 5000

# ---- CHANGE THIS CMD to match your real entrypoint ----
# FastAPI example:
CMD ["python", "api_server.py", "--host", "0.0.0.0", "--port", "5000"]
