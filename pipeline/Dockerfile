FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Code is bind-mounted by docker-compose, so edits apply without a rebuild.
CMD ["python", "load_seed.py"]
