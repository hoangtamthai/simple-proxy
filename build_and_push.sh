docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t tamthai/simple-proxy:latest \
  --push .