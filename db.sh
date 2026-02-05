#!/usr/bin/env bash

set -e

COMPOSE_FILE="docker-compose.db.yml"
SERVICE="db"
CONTAINER="demo_postgres"

function up() {
  echo "▶ Starting database..."
  docker compose -f $COMPOSE_FILE up -d
}

function down() {
  echo "■ Stopping database..."
  docker compose -f $COMPOSE_FILE down
}

function restart() {
  echo "↻ Restarting database..."
  docker compose -f $COMPOSE_FILE restart
}

function reset() {
  echo "⚠ Resetting database (THIS WILL DELETE DATA)"
  docker compose -f $COMPOSE_FILE down -v
  docker compose -f $COMPOSE_FILE up -d
}

function logs() {
  docker compose -f $COMPOSE_FILE logs -f $SERVICE
}

function shell() {
  echo "🐘 Opening psql shell..."
  docker exec -it $CONTAINER psql -U demo_user -d demo_db
}

function status() {
  docker compose -f $COMPOSE_FILE ps
}

function help() {
  echo ""
  echo "Usage: ./db.sh {up|down|restart|reset|logs|shell|status}"
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
