FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir requests==2.31.0

COPY main.py .

EXPOSE 5001

CMD ["python", "main.py"]
