# Angular 22 requires Node ^22.22.3 (package-lock.json engines). Pin the
# version the CI pipeline tests with: a bare major tag can resolve to an older
# locally cached image, because docker compose build does not pull a newer base
# on its own, and the update runner builds without --pull.
FROM node:22.22.3 AS builder
# Node needs more heap than the default on a 4 GB Raspberry Pi; without this
# the Angular build is killed. Declared as an ARG so a machine with more RAM
# can override it via build.args in its compose file, with the Pi's value as
# the safe default for builds that pass nothing.
ARG NODE_OPTIONS=--max-old-space-size=1536
ENV NODE_OPTIONS=$NODE_OPTIONS

WORKDIR /app

COPY package*.json .

RUN npm install

COPY . .

ARG APP_VERSION
RUN APP_VERSION_VAL="${APP_VERSION:-dev}" && printf 'export const APP_VERSION = "%s";' "$APP_VERSION_VAL" > /app/src/app/shared/util/version.ts

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