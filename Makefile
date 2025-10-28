# Makefile for EMT Valencia Bus Schedule API
.PHONY: help build up down logs restart clean install dev deploy test

# Default target
help:
	@echo "EMT Valencia Bus Schedule API - Available commands:"
	@echo ""
	@echo "Docker commands:"
	@echo "  make build    - Build Docker image"
	@echo "  make up       - Start services in detached mode"
	@echo "  make down     - Stop and remove containers"
	@echo "  make logs     - View container logs"
	@echo "  make restart  - Restart services"
	@echo "  make clean    - Stop containers and remove volumes"
	@echo ""
	@echo "Development commands:"
	@echo "  make install  - Install Node.js dependencies"
	@echo "  make dev      - Run development server locally"
	@echo "  make deploy   - Deploy to Cloudflare Workers"
	@echo ""

# Docker commands
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

restart:
	docker-compose restart

clean:
	docker-compose down -v
	docker system prune -f

# Development commands
install:
	npm install

dev:
	npm run dev

deploy:
	npm run deploy

# Combined commands
rebuild: down build up

# Check status
status:
	docker-compose ps
