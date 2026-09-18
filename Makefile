.PHONY: help install db build up down logs logs-server logs-vite dev server typecheck clean

LOG_DIR := logs
PID_DIR := .pids
SERVER_PID := $(PID_DIR)/server.pid
VITE_PID := $(PID_DIR)/vite.pid

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies (bun)
	bun install

db: ## Run Prisma migrations + generate client
	bun run db:migrate

build: ## Build frontend + server bundle
	bun run build
	bun run build:server

typecheck: ## Typecheck frontend (vue-tsc)
	bunx vue-tsc --noEmit

up: install ## Start API server + Vite dev server in background, then tail logs
	@mkdir -p $(LOG_DIR) $(PID_DIR)
	@if [ -f $(SERVER_PID) ] && kill -0 $$(cat $(SERVER_PID)) 2>/dev/null; then \
		echo "server already running (pid $$(cat $(SERVER_PID)))"; \
	else \
		setsid bun run server > $(LOG_DIR)/server.log 2>&1 & echo $$! > $(SERVER_PID); \
		echo "server started (pid $$(cat $(SERVER_PID))) -> $(LOG_DIR)/server.log"; \
	fi
	@if [ -f $(VITE_PID) ] && kill -0 $$(cat $(VITE_PID)) 2>/dev/null; then \
		echo "vite already running (pid $$(cat $(VITE_PID)))"; \
	else \
		setsid bun run dev > $(LOG_DIR)/vite.log 2>&1 & echo $$! > $(VITE_PID); \
		echo "vite started (pid $$(cat $(VITE_PID))) -> $(LOG_DIR)/vite.log"; \
	fi
	@$(MAKE) logs

down: ## Stop background server + vite
	@for pidfile in $(SERVER_PID) $(VITE_PID); do \
		if [ -f $$pidfile ] && kill -0 $$(cat $$pidfile) 2>/dev/null; then \
			kill -- -$$(cat $$pidfile) 2>/dev/null || kill $$(cat $$pidfile); \
			echo "stopped $$(basename $$pidfile .pid) (pid $$(cat $$pidfile))"; \
		fi; \
		rm -f $$pidfile; \
	done

logs: ## Tail server + vite logs together (Ctrl-C to stop)
	tail -f $(LOG_DIR)/server.log $(LOG_DIR)/vite.log

logs-server: ## Tail API server log only
	tail -f $(LOG_DIR)/server.log

logs-vite: ## Tail Vite log only
	tail -f $(LOG_DIR)/vite.log

dev: ## Run Vite dev server in foreground
	bun run dev

server: ## Run API server in foreground (hot reload)
	bun run server

clean: ## Remove build output + logs
	rm -rf dist dist-server $(LOG_DIR) $(PID_DIR)
