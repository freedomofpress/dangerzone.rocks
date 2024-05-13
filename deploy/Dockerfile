# sha256 as of 2023-07-05
FROM nginx:mainline-alpine@sha256:2d4efe74ef541248b0a70838c557de04509d1115dec6bfc21ad0d66e41574a8a

COPY deploy/nginx.conf /etc/nginx
RUN mkdir -p /opt/nginx/run /opt/nginx/webroot/assets && chown -R nginx:nginx /opt/nginx

USER nginx
COPY --chown=nginx:nginx index.html about.html favicon.ico /opt/nginx/webroot/
COPY --chown=nginx:nginx assets/ /opt/nginx/webroot/assets/
