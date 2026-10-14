# The self-hosted evaluation image of Thermus. It holds the server and the offline commands of the same program.
# All data is on the volume at DATA_DIR. README.md#container-installation gives the commands.

# The base images are pinned by digest. Change a tag and its digest together.
ARG NODE_IMAGE=node:24.20.0-trixie-slim@sha256:50c3b2f6988dfc307b86e5301d69611af31f4789bdf232863b07d3b02fe55ae0
ARG RUST_IMAGE=rust:1.97-slim-trixie@sha256:8e8cf8f7fd54a2d23d5a743b3a03f56e26b6c774276c33fa0595111704ebb15c

FROM ${NODE_IMAGE} AS node

# The adblock-rs install compiles its native module, so this stage adds the Node runtime of the image to the Rust image.
FROM ${RUST_IMAGE} AS dependencies
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && npm install --global pnpm@12.10.1
# The Rust image sets RUST_VERSION. The adblock-rs toolchain file names the 1.97 channel, and this setting keeps the
# 1.97 toolchain of the Rust image, so rustup downloads nothing. The install stops if the value is empty.
ENV RUSTUP_TOOLCHAIN=${RUST_VERSION}
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY .habit-hooks/package.json .habit-hooks/
COPY patches patches
# The Cargo build output is not necessary after the module is compiled.
RUN test -n "$RUSTUP_TOOLCHAIN" \
 && pnpm install --frozen-lockfile --prod \
 && rm -rf node_modules/.pnpm/adblock-rs@*/node_modules/adblock-rs/target

# The build context has no test/ directory, so the unchanged build command compiles dist/src only.
FROM dependencies AS build
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src src
RUN pnpm build

FROM ${NODE_IMAGE}
LABEL org.opencontainers.image.title="Thermus" \
      org.opencontainers.image.description="Thermus self-hosted evaluation edition with local accounts and one data volume" \
      org.opencontainers.image.source="https://github.com/3-headed-monkey/Thermus"
# The server reads its trusted ad rules from AD_RULES_FILE when it starts. The image has no rules file:
# the operator mounts one there, as compose.yaml does. The commands and the hosted edition do not read it.
ENV NODE_ENV=production \
    DEPLOYMENT=self-hosted \
    DATA_DIR=/var/lib/thermus \
    AD_RULES_FILE=/etc/thermus/ad-rules.txt \
    LISTEN_HOST=0.0.0.0 \
    LISTEN_PORT=8080
WORKDIR /app
COPY --from=dependencies /app/package.json ./
COPY --from=dependencies /app/node_modules node_modules
COPY --from=build /app/dist/src dist/src
COPY migrations migrations
# The data directory holds the database and the secrets, so only the node user can open it.
RUN install -d -m 0700 -o node -g node /var/lib/thermus \
 && install -d -m 0755 /etc/thermus
USER node
EXPOSE 8080
ENTRYPOINT ["node", "/app/dist/src/index.js"]
