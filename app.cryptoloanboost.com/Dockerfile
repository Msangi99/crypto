# Static dApp (app.cryptoloanboost.com) — rebuild image after editing HTML/JS/CSS here.
FROM nginx:alpine

COPY . /usr/share/nginx/html/

# SPA-ish: ensure index is default; nginx default already serves index.html
RUN rm -f /etc/nginx/conf.d/default.conf \
  && printf '%s\n' \
    'server {' \
    '  listen 80;' \
    '  listen [::]:80;' \
    '  root /usr/share/nginx/html;' \
    '  index index.html;' \
    '  location / {' \
    '    try_files $uri $uri/ /index.html;' \
    '  }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80
