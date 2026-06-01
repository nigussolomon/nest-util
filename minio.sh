#!/usr/bin/env bash

set -e

COMPOSE_FILE="docker-compose.minio.yml"
SERVICE="minio"
CONTAINER="demo_minio"

function up() {
  echo "▶ Starting MinIO..."
  docker compose -f $COMPOSE_FILE up -d
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
  docker compose -f $COMPOSE_FILE up -d
}

function logs() {
  docker compose -f $COMPOSE_FILE logs -f $SERVICE
}

function shell() {
  echo "📦 Opening MinIO console at http://localhost:9001"
  echo "   User: minioadmin  Pass: minioadmin"
  open "http://localhost:9001" 2>/dev/null || echo "   Open the URL in your browser."
}

function status() {
  docker compose -f $COMPOSE_FILE ps
}

function help() {
  echo ""
  echo "Usage: ./minio.sh {up|down|restart|reset|logs|shell|status}"
  echo ""
}

case "$1" in
  up) up ;;
  down) down ;;
  restart) restart ;;
  reset) reset ;;
  logs) logs ;;
  shell) shell ;;
  status) status ;;
  *) help ;;
esac
