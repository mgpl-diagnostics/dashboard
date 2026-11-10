# syntax=docker/dockerfile:1
# The dashboard image: Next.js standalone output (`node server.js`, port 3000, no npm at run time).
# @mgpl-diagnostics/client comes from GitHub Packages, so the build needs a token with read:packages, passed
# as a secret (never a build arg, which would stay in the image history):
#   docker build --secret id=npm_token,env=NODE_AUTH_TOKEN -t mgpl-dashboard .
# Run:  docker run -p 3000:3000 -e MGPL_API_URL=http://your-api:4000 ghcr.io/mgpl-diagnostics/dashboard
# MGPL_API_URL is read when the server starts (proxy.ts); so is MGPL_PUBLIC_API_URL (optional: the browser then
# calls the api directly, see lib/api-url.ts). NEXT_PUBLIC_* values are fixed at build time.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json .npmrc ./
COPY package-lock.json* ./
RUN --mount=type=secret,id=npm_token \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/npm_token 2>/dev/null)" > /root/.npmrc \
    && if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi \
    && rm /root/.npmrc
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 MGPL_API_URL=http://api:4000
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
