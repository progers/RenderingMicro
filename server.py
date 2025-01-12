# Create a simple no-caching server which sends cross-origin isolated headers,
# which are required for timer precision, see:
# https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated
#
# Run `python3 server.py`, then open http://localhost:8000/benchmark.html

from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
import sys

class RequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        # Prevent caching
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        SimpleHTTPRequestHandler.end_headers(self)

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in a separate thread."""

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadedHTTPServer(('', port), RequestHandler)
    try:
        print(f'Starting server on port {server.server_port}, use <Ctrl-C> to stop')
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server...')
        server.shutdown()
