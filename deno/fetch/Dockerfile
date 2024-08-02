FROM denoland/deno:1.45.5

# The port that your application listens to.
WORKDIR /app

# Prefer not to run as root.
USER deno

# Cache the dependencies as a layer (the following two steps are re-run only when deps.js is modified).
# Ideally cache deps.js will download and compile _all_ external files used in main.ts.
COPY deps.js .
RUN deno cache deps.js

# These steps will be re-run upon each file change in your working directory:
ADD . .
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.js

ENTRYPOINT ["deno", "run", "--allow-env", "--allow-read", "--allow-net", "--unstable-http", "main.js"]