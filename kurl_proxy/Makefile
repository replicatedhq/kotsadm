SHELL := /bin/bash -o pipefail
export GO111MODULE=off

.PHONY: deps
deps:
	GO111MODULE=on go mod verify
	GO111MODULE=on go mod tidy
	GO111MODULE=on go mod vendor

.PHONY: test
test:
	go test ./cmd/...

.PHONY: build
build:
	go build -o bin/kurl_proxy cmd/main.go

.PHONY: up
up:
	skaffold dev -f skaffold.yaml

.PHONY: build-alpha
build-alpha:
	docker build -f deploy/Dockerfile -t kotsadm/kurl-proxy:alpha .
	docker push kotsadm/kurl-proxy:alpha

.PHONY: build-release
build-release:
	docker build -f deploy/Dockerfile -t kotsadm/kurl-proxy:${BUILDKITE_TAG} .
	docker push kotsadm/kurl-proxy:${BUILDKITE_TAG}
