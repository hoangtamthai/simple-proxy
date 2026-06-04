import http from "http";
import { Readable } from "stream";

// Hop-by-hop headers that MUST NOT be forwarded by a proxy (RFC 2616 §13.5.1)
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

// Headers from the upstream that we strip because they no longer apply
// after Bun/Node fetch auto-decompresses the body.
const STRIP_RESPONSE_HEADERS = new Set(["content-encoding", "content-length"]);

function writeJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  // --- CORS headers on every response ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // Parse the request URL to get query parameters
    const fullUrl = new URL(req.url, `http://${req.headers.host}`);
    const queryParams = fullUrl.search;
    const url = fullUrl.pathname.slice(1);
    const targetUrl = queryParams ? `${url}${queryParams}` : url;
    console.log(targetUrl);

    if (!targetUrl) {
      writeJson(res, 400, { error: "Missing target Url" });
      return;
    }

    // Validate the URL
    let target;
    try {
      target = new URL(targetUrl);
    } catch (e) {
      writeJson(res, 400, { error: "Invalid URL format" });
      return;
    }

    // Ensure we're only proxying http/https
    if (!["http:", "https:"].includes(target.protocol)) {
      writeJson(res, 400, {
        error: "Only http and https protocols are allowed",
      });
      return;
    }

    // Forward relevant client headers to the upstream (stripping hop-by-hop)
    const upstreamHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP.has(lower)) continue;
      // Skip internal/host header — fetch sets it from the URL
      if (lower === "host") continue;
      upstreamHeaders[key] = value;
    }

    // Proxy the request to the target URL
    fetch(target.href, { headers: upstreamHeaders })
      .then((fetchResponse) => {
        // Build clean headers — strip hop-by-hop and encoding headers
        const headers = {};
        for (const [key, value] of fetchResponse.headers.entries()) {
          const lower = key.toLowerCase();
          if (HOP_BY_HOP.has(lower) || STRIP_RESPONSE_HEADERS.has(lower)) {
            continue;
          }
          // Avoid duplicate headers (e.g., duplicate Date headers)
          if (headers[key]) continue;
          headers[key] = value;
        }

        res.writeHead(fetchResponse.status, headers);

        // Pipe the response body as a stream
        if (fetchResponse.body) {
          Readable.fromWeb(fetchResponse.body).pipe(res);
        } else {
          res.end();
        }
      })
      .catch((fetchErr) => {
        writeJson(res, 502, { error: "Fetch failed: " + fetchErr.message });
      });
  } catch (err) {
    writeJson(res, 500, { error: err.message });
  }
});

const PORT = process.env.PORT || 5591;
server.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
  console.log(`Example Usage: http://localhost:${PORT}/https://example.com`);
});
