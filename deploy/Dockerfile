# sha256 as of 2024-03-15
FROM node:21.7.1-alpine3.19@sha256:4999fa1391e09259e71845d3d0e9ddfe5f51ab30253c8b490c633f710c7446a0 AS eleventy-build

WORKDIR /usr/src/page
COPY package.json package-lock.json eleventy.config.js ./
COPY src ./src
RUN npm ci
RUN npm run build

# sha256 as of 2023-07-05
FROM nginx:mainline-alpine@sha256:2d4efe74ef541248b0a70838c557de04509d1115dec6bfc21ad0d66e41574a8a

COPY deploy/nginx.conf /etc/nginx
RUN mkdir -p /opt/nginx/run /opt/nginx/webroot/assets && chown -R nginx:nginx /opt/nginx

USER nginx
COPY --from=eleventy-build --chown=nginx:nginx /usr/src/page/dist /opt/nginx/webroot/
