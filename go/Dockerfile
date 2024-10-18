ARG GO_VERSION=1.22
FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-alpine AS build

WORKDIR /src
ARG TARGETARCH

ENV GOCACHE=/go/cache

RUN --mount=type=cache,target=/go/cache \
    --mount=type=bind,target=. \
    CGO_ENABLED=0 GOARCH=$TARGETARCH go build -o /bin/run -v main.go
