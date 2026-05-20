BINARY_DAEMON  := kura-daemon
BINARY_HELPER  := kura-helper
BUILD_DIR      := dist
GO             := go
GOFLAGS        := -trimpath

.PHONY: all build daemon helper clean dev frontend axis-dev

all: build

build: daemon helper

daemon:
	CGO_ENABLED=1 $(GO) build $(GOFLAGS) \
		-ldflags "-s -w" \
		-o $(BUILD_DIR)/$(BINARY_DAEMON) \
		./backend/cmd/kura-daemon

helper:
	CGO_ENABLED=1 $(GO) build $(GOFLAGS) \
		-ldflags "-s -w" \
		-o $(BUILD_DIR)/$(BINARY_HELPER) \
		./backend/cmd/kura-helper

frontend:
	cd frontend && npm run build

axis-dev:
	cd axis && uv run uvicorn core.main:app --reload --port 8765

dev:
	$(GO) run ./backend/cmd/kura-daemon

clean:
	rm -rf $(BUILD_DIR)

install: build
	install -Dm755 $(BUILD_DIR)/$(BINARY_DAEMON) /usr/local/bin/$(BINARY_DAEMON)
	install -Dm755 $(BUILD_DIR)/$(BINARY_HELPER)  /usr/local/bin/$(BINARY_HELPER)
	install -Dm644 installer/systemd/kura-daemon.service  /etc/systemd/system/
	install -Dm644 installer/systemd/kura-helper.service  /etc/systemd/system/
	install -Dm644 installer/systemd/axis-engine.service  /etc/systemd/system/
	systemctl daemon-reload

lint:
	golangci-lint run ./...

.PHONY: tidy
tidy:
	$(GO) mod tidy

.PHONY: dev-all
dev-all:
	bash scripts/dev.sh

.PHONY: install-deps
install-deps:
	bash scripts/dev.sh --deps-only 2>/dev/null || true
	@echo "Run 'make dev-all' to start all services"
