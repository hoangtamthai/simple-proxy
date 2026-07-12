FROM oven/bun:1.3 AS build

WORKDIR /app
COPY package.json .
RUN bun install --production

FROM oven/bun:1.3

WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY index.js .

EXPOSE 5591

CMD ["bun", "run", "index.js"]
