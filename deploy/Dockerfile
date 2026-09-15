# sha256 as of 2026-09-09
FROM docker.io/node:25-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS eleventy-build

WORKDIR /usr/src/page
COPY package.json package-lock.json eleventy.config.js ./
COPY src ./src
RUN npm ci
RUN npm run build

# sha256 as of 2026-09-09
FROM docker.io/nginx:mainline-alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3

COPY deploy/nginx.conf /etc/nginx
RUN mkdir -p /opt/nginx/run /opt/nginx/webroot/assets && chown -R nginx:nginx /opt/nginx

USER nginx
COPY --from=eleventy-build --chown=nginx:nginx /usr/src/page/dist /opt/nginx/webroot/
EXPOSE 5080
