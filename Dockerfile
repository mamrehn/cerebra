# Angular CLI 22 requires Node ^22.22.3 or ^24.15.0. Pin a minor version that
# satisfies it: a bare major tag can resolve to an older locally cached image,
# because docker compose build does not pull a newer base on its own.
FROM node:24.21 AS builder

WORKDIR /app

COPY package*.json .

RUN npm install

COPY . .

ARG APP_VERSION
RUN printf 'export const APP_VERSION = "%s";' "$APP_VERSION" > /app/src/app/shared/util/version.ts

ARG NODE_ENV=production
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm run build --prod; \
    else \
      npm run build; \
    fi

FROM nginx:1.25.4

COPY --from=builder /app/dist/ /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]