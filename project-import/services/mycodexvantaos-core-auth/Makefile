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
	docker build -t codexvanta-auth-service .

docker-run:
	docker run --rm -p 3001:3001 --env-file .env codexvanta-auth-service
