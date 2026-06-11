NAMESPACE			= flomation.app/automate/ui
DATE				= $(shell date -u +%Y%m%d_%H%M%S)
NAME				?= flomation-editor

BRANCH 				:= $(shell git rev-parse --abbrev-ref HEAD)
GITHASH 			?= $(shell git rev-parse HEAD)
CI_PIPELINE_ID 		?= dev
VERSION 			?= 1.0.${CI_PIPELINE_ID}
REGISTRY 			?= flomationco

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
	npm i react-router@7.7.0
	cd build && npm i
	cd build && npm ci
	cd build && npm ci --omit=dev
	cd build && npm run build
	cd build && zip -r ../build.zip .

docker-compile:
	docker build . -t ${REGISTRY}/${NAME}:latest -t ${REGISTRY}/${NAME}:${GITHASH}

lint:
	goimports -l .

test:
	go test ./... -coverprofile cover.out
	go tool cover -func cover.out

docker-publish:
	docker push ${REGISTRY}/${NAME}:latest
	docker push ${REGISTRY}/${NAME}:${GITHASH}

.phony: compile