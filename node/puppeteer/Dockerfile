# pull official base image
FROM node:22-bookworm-slim

ENV CHROME_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

## install chromium for puppeteer
RUN apt-get update && apt-get install -y chromium


USER node
# set working directory
WORKDIR /app

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

COPY . .

CMD ["node", "main.js"]
