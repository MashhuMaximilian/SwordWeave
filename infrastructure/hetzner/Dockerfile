ARG NODE_IMAGE=node:24.22.2-bookworm-slim@sha256:a43f7fc3e52e87d12a905f46eea0275def84ca8f2981a5b53fed44d7fb398ee0
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY next-env.d.ts next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts ./
COPY src ./src
COPY data ./data
COPY assets/character-pdf ./assets/character-pdf
COPY public ./public
COPY scripts ./scripts
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
RUN pnpm exec next typegen && NODE_OPTIONS=--max-old-space-size=2048 pnpm exec tsc --noEmit --incremental false
RUN SW_CONTAINER_BUILD=1 pnpm build

FROM ${NODE_IMAGE} AS python
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3-venv \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m venv /opt/swordweave-pdf
COPY scripts/character_pdf/requirements.txt /tmp/character-pdf-requirements.txt
RUN /opt/swordweave-pdf/bin/pip install --only-binary=:all: --no-cache-dir -r /tmp/character-pdf-requirements.txt

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=python /opt/swordweave-pdf /opt/swordweave-pdf
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/scripts/render-character-pdf.py ./scripts/
COPY --from=build /app/scripts/build-character-sheet-v*.py ./scripts/
COPY --from=build /app/scripts/character_pdf ./scripts/character_pdf
COPY --from=build /app/assets/character-pdf ./assets/character-pdf
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 \
    SWORDWEAVE_PDF_PYTHON=/opt/swordweave-pdf/bin/python PYTHONDONTWRITEBYTECODE=1
EXPOSE 3000
USER 1000:1000
CMD ["node", "server.js"]
