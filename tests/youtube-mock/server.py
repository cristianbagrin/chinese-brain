"""Minimal stand-in for youtube.com/watch, for testing the subtitle overlay offline.

Run: python3 tests/youtube-mock/server.py 8800  (Firefox needs network.dns.localDomains=www.youtube.com)
Serves /watch?v=TEST with a fake #movie_player (player API subset) whose setOption()
fetches /api/timedtext like the real player, so the extension's capture path runs.
"""
import http.server, json, os, subprocess, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
LINES = [
    (0.5, 3.0, '大家好，歡迎來到我的頻道', 'Hello everyone, welcome to my channel'),
    (3.2, 6.0, '今天我們要去夜市吃滷肉飯', "Today we're going to the night market to eat braised pork rice"),
    (6.2, 9.0, '颱風要來了，記得多買一點泡麵', "A typhoon is coming, remember to buy some instant noodles"),
    (9.2, 12.5, '我騎機車去捷運站，然後搭捷運回家', 'I ride my scooter to the MRT station and then take the MRT home'),
    (12.7, 16.0, '这句是简体字幕，我们明天见', 'This line is in simplified characters, see you tomorrow'),
]

def json3(tlang):
    evs = []
    for s, e, zh, en in LINES:
        evs.append({'tStartMs': int(s * 1000), 'dDurationMs': int((e - s) * 1000), 'segs': [{'utf8': en if tlang else zh}]})
    return json.dumps({'wireMagic': 'pb3', 'events': evs})

PAGE = open(os.path.join(HERE, 'watch.html'), encoding='utf-8').read()

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def send(self, code, ctype, body):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == '/watch':
            return self.send(200, 'text/html; charset=utf-8', PAGE)
        if u.path == '/api/timedtext':
            print('TIMEDTEXT', self.path, flush=True)
            if q.get('tlang') and os.environ.get('MOCK_TLANG_429'):
                return self.send(429, 'text/html', '<html><body><p>Sorry...</p></body></html>')
            return self.send(200, 'application/json; charset=utf-8', json3(q.get('tlang', [''])[0]))
        if u.path == '/v.webm':
            path = os.path.join(HERE, '.v.webm')
            if not os.path.exists(path):
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=10', '-t', '20',
                                '-c:v', 'libvpx', '-b:v', '200k', path], check=True)
            return self.send(200, 'video/webm', open(path, 'rb').read())
        self.send(404, 'text/plain', 'not found')

http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8800), H).serve_forever()
