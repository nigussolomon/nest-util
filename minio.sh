#!/usr/bin/env bash

set -e

COMPOSE_FILE="docker-compose.minio.yml"
CONTAINER="demo_minio"
BUCKET="demo-bucket"

function up() {
  echo "▶ Starting MinIO..."
  docker compose -f $COMPOSE_FILE up -d
  echo "⏳ Waiting for MinIO to be ready..."
  until curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; do
    sleep 1
  done
  echo "✅ MinIO is ready"

  # Create bucket
  docker exec $CONTAINER mc alias set local http://localhost:9000 minioadmin minioadmin > /dev/null 2>&1
  if docker exec $CONTAINER mc ls local/$BUCKET > /dev/null 2>&1; then
    echo "✓ Bucket '$BUCKET' already exists"
  else
    docker exec $CONTAINER mc mb local/$BUCKET
    echo "✓ Created bucket '$BUCKET'"
  fi
}

function down() {
  echo "■ Stopping MinIO..."
  docker compose -f $COMPOSE_FILE down
}

function restart() {
  echo "↻ Restarting MinIO..."
  docker compose -f $COMPOSE_FILE restart
}

function reset() {
  echo "⚠ Resetting MinIO (THIS WILL DELETE DATA)"
  docker compose -f $COMPOSE_FILE down -v
  up
}

function logs() {
  docker compose -f $COMPOSE_FILE logs -f
}

function status() {
  docker compose -f $COMPOSE_FILE ps
}

function help() {
  echo ""
  echo "Usage: ./minio.sh {up|down|restart|reset|logs|status}"
  echo ""
  echo "  up      — Start MinIO and create bucket"
  echo "  down    — Stop MinIO"
  echo "  restart — Restart MinIO"
  echo "  reset   — Delete all data and start fresh"
  echo "  logs    — Tail logs"
  echo "  status  — Show container status"
  echo ""
}

case "$1" in
  up) up ;;
  down) down ;;
  restart) restart ;;
  reset) reset ;;
  logs) logs ;;
  status) status ;;
  *) help ;;
esac
