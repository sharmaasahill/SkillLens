# SkillLens in one container: Flask serves the API and the built React app from the same address,
# so the login cookies work without any cross-site setup.

# 1) Build the React frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# No source maps on the live site, so visitors cannot read the original frontend code
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# 2) Python backend that also serves frontend/build
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/frontend/build /app/frontend/build

# Render passes the port in $PORT (gunicorn.conf.py reads it)
EXPOSE 10000
# Update the database tables, then start the server
CMD ["sh", "-c", "flask --app app db upgrade && exec gunicorn app:app -c gunicorn.conf.py"]
