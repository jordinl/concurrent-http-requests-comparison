FROM denoland/deno:alpine-2.0.2 AS build

WORKDIR /app

COPY . .

RUN deno compile -E=FORMAT --output build/process-output process-output.js
RUN deno compile -R=settings.json --allow-run=./bin/run --output build/benchmark benchmark.js

FROM scratch
COPY --from=build /app/build /build
