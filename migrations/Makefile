SHELL:=/bin/bash
PROJECT_NAME ?= kotsadm-migrations

.PHONY: schema-alpha
schema-alpha: IMAGE = kotsadm/${PROJECT_NAME}:alpha
schema-alpha: build_schema

.PHONY: schema-release
schema-release: IMAGE = kotsadm/${PROJECT_NAME}:${BUILDKITE_TAG}
schema-release: build_schema

.PHONY: build-ttl-github.sh
build-ttl-github.sh: IMAGE = ttl.sh/${UUID}/${PROJECT_NAME}:12h
build-ttl-github.sh: build_schema

build_schema:
	docker pull schemahero/schemahero:0.7.2
	docker build -f deploy/Dockerfile -t ${IMAGE} .
	docker push ${IMAGE}
