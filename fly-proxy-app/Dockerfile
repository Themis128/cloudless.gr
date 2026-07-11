FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proxy.py .

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "proxy:app", "--host", "0.0.0.0", "--port", "8080"]