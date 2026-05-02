"""AURA dev server - 캐시 완전 비활성화 (python -m http.server 대용)

사용법:
    python serve.py         # 8000번 포트
    python serve.py 8080    # 다른 포트
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 모든 응답에 캐시 비활성화 헤더 추가
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # CORS도 함께 (RSS 일부 도움)
        self.send_header('Access-Control-Allow-Origin', '*')
        # YouTube Error 153 결정타: Referrer-Policy 헤더 명시
        # (Simon Willison: "이게 진짜 해결책. iframe attribute만으론 부족")
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        super().end_headers()

    def log_message(self, format, *args):
        # 404 빼고 조용하게
        if '404' in args[1] if len(args) > 1 else False:
            return
        super().log_message(format, *args)


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


print(f"AURA dev server (no cache) on http://localhost:{PORT}")
print("Ctrl+C 로 종료")
print()

with ReusableTCPServer(("", PORT), NoCacheHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n종료")
