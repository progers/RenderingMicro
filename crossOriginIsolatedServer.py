# Create a simple server which sends cross-origin isolated headers, which are
# required for timer precision, see:
# https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated
#
# Run with: python3 crossOriginIsolatedServer.py

from http.server import HTTPServer, SimpleHTTPRequestHandler

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        SimpleHTTPRequestHandler.end_headers(self)

if __name__ == '__main__':
    httpd = HTTPServer(('localhost', 8000), CORSRequestHandler)
    httpd.serve_forever()
