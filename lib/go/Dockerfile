ARG GO_VERSION=1.23
FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-alpine AS build

WORKDIR /src
ARG TARGETARCH

ENV GOCACHE=/go/cache
ENV GODEBUG="http2client=0"

RUN --mount=type=cache,target=/go/cache \
    --mount=type=bind,target=. \
    CGO_ENABLED=0 GOARCH=$TARGETARCH go build -o /bin/run -v main.go
