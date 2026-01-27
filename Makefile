NAMESPACE			= flomation.app/automate/ui
DATE				= $(shell date -u +%Y%m%d_%H%M%S)
NAME				?= ui

BRANCH 				:= $(shell git rev-parse --abbrev-ref HEAD)
GITHASH 			?= $(shell git rev-parse HEAD)
CI_PIPELINE_ID 		?= dev
VERSION 			?= 1.0.${CI_PIPELINE_ID}
REGISTRY 			?= local

compile:
	rm -rf build/
	mkdir -p build/
	cp .npmrc build/
	cp package.json build/
	cp package-lock.json build/
	cp *.ts build/
	cp tsconfig.json build/
	cp -r app/ build/app
	cp -r public/ build/public
	rm build/public/run-config.js
	npm i react-router@7.7.0
	cd build && npm i
	cd build && npm ci
	cd build && npm ci --omit=dev
	cd build && npm run build
	cd build && zip -r ../build.zip .

docker-compile:
	rm -rf build/
	npm run build
	docker build . -t ${REGISTRY}/${NAME}:latest -t ${REGISTRY}/${NAME}:${GITHASH}

lint:
	goimports -l .

test:
	go test ./... -coverprofile cover.out
	go tool cover -func cover.out

publish:
	aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin ${REGISTRY}
	docker push ${REGISTRY}/${NAME}:latest
	docker push ${REGISTRY}/${NAME}:${GITHASH}

.phony: compile