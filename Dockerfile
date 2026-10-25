# Tile Trigger online: one container serves the site, the hub (broker + game
# browser) and relay credentials. Matches run in players' browsers.
# Build: docker build -t tiletrigger .   Run: docker run -p 8080:8080 tiletrigger
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
# "self": the site uses the hub it is served from.
RUN VITE_HUB=self pnpm build
ENV PORT=8080 HOST=0.0.0.0 TRUST_PROXY=1
EXPOSE 8080
CMD ["pnpm", "--filter", "@tiletrigger/server", "hub"]
