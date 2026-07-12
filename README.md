# Simple Proxy

A simple web proxy server that forwards requests to a target URL.

## Usage

### Direct

```sh
curl http://localhost:5591/https://example.com
```

### Docker

```sh
# Build
docker build -t simple-proxy .

# Run
docker run -p 5591:5591 simple-proxy
```
