SHELL := /bin/bash
PROJECT_NAME ?= minio

.PHONY: publish
publish: IMAGE = kotsadm/${PROJECT_NAME}:${IMAGE_TAG}
publish:
	docker build -f Dockerfile -t ${IMAGE} .
	docker push ${IMAGE}

.PHONY: build-ttl-github.sh
build-ttl-github.sh:
	docker build -f Dockerfile -t ttl.sh/${UUID}/${PROJECT_NAME}:12h .
	docker push ttl.sh/${UUID}/${PROJECT_NAME}:12h

.PHONY: publish-latest
publish-latest: IMAGE_TAG = alpha
publish-latest: publish

.PHONY: publish-release
publish-release: IMAGE_TAG = ${BUILDKITE_TAG}
publish-release: publish
