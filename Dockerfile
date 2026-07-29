FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY templates/ templates/
COPY static/ static/

ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 5008

CMD ["gunicorn", "--bind", "0.0.0.0:5008", "--workers", "2", "app:app"]
