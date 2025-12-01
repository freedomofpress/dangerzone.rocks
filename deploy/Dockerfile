# sha256 as of 2025-12-01
FROM node:25-alpine3.21@sha256:32509199057d74a987fdd88cde00fdfd48ef52469adbd6bd11969fc701477761 AS eleventy-build

WORKDIR /usr/src/page
COPY package.json package-lock.json eleventy.config.js ./
COPY src ./src
RUN npm ci
RUN npm run build

# sha256 as of 2025-12-01
FROM nginx:mainline-alpine@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14

COPY deploy/nginx.conf /etc/nginx
RUN mkdir -p /opt/nginx/run /opt/nginx/webroot/assets && chown -R nginx:nginx /opt/nginx

USER nginx
COPY --from=eleventy-build --chown=nginx:nginx /usr/src/page/dist /opt/nginx/webroot/
EXPOSE 5080
