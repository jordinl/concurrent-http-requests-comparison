ARG BUN_VERSION=1.1.33

FROM oven/bun:${BUN_VERSION}-alpine

WORKDIR /usr/src/app

COPY package.json .

RUN bun install

USER bun

COPY . .
