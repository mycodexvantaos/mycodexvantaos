.PHONY: install build dev test lint typecheck clean docker-build docker-run

install:
	pnpm install

build:
	pnpm build

dev:
	pnpm dev

test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

clean:
	pnpm clean

docker-build:
	docker build -t codexvanta-app-ui .

docker-run:
	docker run --rm -p 8080:80 codexvanta-app-ui
