# Feather ESP32-S3 Reverse TFT — Wi-Fi AP text input → shows on TFT
# Requires: /lib/adafruit_display_text/
# This opens a WiFi access point and allows the user to input text to be displayed on the TFT. (Second part still in work)
import time
import board
import displayio
import terminalio
import digitalio
from adafruit_display_text import label
import wifi
import socketpool

# Use the WiFi radio singleton
radio = wifi.radio

# ---------- CONFIG ----------
SSID = "Capstone Test Wifi!"
PASSWORD = "aaron123"   # ≥8 chars; set "" for open
ROTATION = 0          # 0/90/180/270 to taste, probably 0 or 180 is better
TEXT_COLOR = 0xFFFFFF
BG_COLOR = 0x000000
SCALE = 1              # text size multiplier
PADDING = 8               # px margin around text
# ---------------------------

tft_power = digitalio.DigitalInOut(board.TFT_I2C_POWER)
tft_power.switch_to_output(value=True)
time.sleep(0.1)

# 2) Display
display = board.DISPLAY
display.rotation = ROTATION
if hasattr(display, "brightness") and display.brightness is not None:
    try:
        display.brightness = 1.0
    except Exception:
        pass

# Root group + background
root = displayio.Group()
display.root_group = root

bg_bitmap = displayio.Bitmap(display.width, display.height, 1)
bg_palette = displayio.Palette(1)
bg_palette[0] = BG_COLOR
bg = displayio.TileGrid(bg_bitmap, pixel_shader=bg_palette)
root.append(bg)

# Text label (we’ll update .text)
text_label = label.Label(
    terminalio.FONT,
    text="",
    color=TEXT_COLOR,
    line_spacing=1.1,
)
# anchor top-left, add padding
text_label.anchor_point = (0, 0)
text_label.anchored_position = (PADDING, PADDING)
root.append(text_label)

def set_text(msg: str):
    # Simple word-wrap to fit display width at current SCALE
    cols = max(1, (display.width - 2 * PADDING) // (terminalio.FONT.get_bounding_box()[0] * SCALE))
    lines_out = []
    for paragraph in (msg.replace("\r", "")).split("\n"):
        words = paragraph.split(" ")
        line = ""
        for w in words:
            candidate = w if not line else (line + " " + w)
            if len(candidate) <= cols:
                line = candidate
            else:
                lines_out.append(line)
                line = w
        lines_out.append(line)
    text_label.text = "\n".join(lines_out)
    # Recenter vertically if you prefer top-left; we keep top-left.
    text_label.scale = SCALE

def show_lines(lines):
    set_text("\n".join(lines))

show_lines(["Starting AP…"])

# 3) Wi-Fi AP
if PASSWORD:
    radio.start_ap(SSID, PASSWORD)
else:
    radio.start_ap(SSID)
time.sleep(0.4)
ip = str(radio.ipv4_address_ap)

show_lines([
    "Connect to:",
    f"  {SSID}",
    "",
    "Open:",
    f"  http://{ip}/",
])

# 4) Tiny HTTP server (no extra HTTP libs)
pool = socketpool.SocketPool(radio)
srv = pool.socket(pool.AF_INET, pool.SOCK_STREAM)
srv.settimeout(0)
# Socket options
srv.setsockopt(pool.SOL_SOCKET, pool.SO_REUSEADDR, 1)
# Bind to all interfaces (empty string) on port 80
srv.bind(("", 80))
srv.listen(1)

HTML_FORM = f"""\
HTTP/1.1 200 OK\r
Content-Type: text/html; charset=utf-8\r
Connection: close\r
\r
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Feather Text</title>
<style>
body{{font-family:system-ui;margin:1rem;}}
input,button,textarea{{font:inherit;padding:.6rem;width:100%;margin:.5rem 0;}}
code{{background:#eee;padding:.2rem .4rem;border-radius:.25rem}}
</style></head><body>
<h2>Feather Text</h2>
<p>Connected to <b>{SSID}</b>. Send text to the TFT:</p>
<form method="POST">
<textarea name="t" rows="6" placeholder="Type here…"></textarea>
<button type="submit">Show</button>
</form>
<p>Or GET: <code>/?t=Hello%20World</code></p>
</body></html>
"""

HTML_REDIRECT = "HTTP/1.1 303 See Other\r\nLocation: /\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"

def url_decode(s: str) -> str:
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == '+':
            out.append(' '); i += 1
        elif c == '%' and i + 2 < len(s):
            try:
                out.append(chr(int(s[i+1:i+3], 16))); i += 3
            except Exception:
                out.append('%'); i += 1
        else:
            out.append(c); i += 1
    return ''.join(out)

def add_content_length(content: str) -> str:
    """Add Content-Length header to HTTP response"""
    lines = content.split("\r\n")
    # Find the blank line separating headers from body
    for i, line in enumerate(lines):
        if line == "":
            body = "\r\n".join(lines[i+1:])
            body_len = len(body.encode("utf-8"))
            # Insert Content-Length before blank line
            lines.insert(i, f"Content-Length: {body_len}")
            return "\r\n".join(lines)
    return content

def handle_request(raw: bytes):
    if not raw:
        return HTML_FORM
    head = raw.split(b"\r\n", 1)[0].decode("utf-8", "ignore")
    parts = head.split(" ")
    method = parts[0] if parts else "GET"
    path = parts[1] if len(parts) > 1 else "/"

    if method == "GET":
        if "?" in path and "t=" in path:
            q = path.split("?", 1)[1]
            tval = ""
            for kv in q.split("&"):
                if kv.startswith("t="):
                    tval = kv[2:]; break
            msg = url_decode(tval)
            set_text(msg)
            return HTML_REDIRECT
        return HTML_FORM

    if method == "POST":
        # crude parse body
        try:
            header, body = raw.split(b"\r\n\r\n", 1)
        except ValueError:
            return HTML_FORM
        # form-encoded: t=...
        if b"t=" in body:
            t = body.split(b"t=", 1)[1]
            amp = t.find(b"&")
            if amp != -1:
                t = t[:amp]
            msg = url_decode(t.decode("utf-8", "ignore"))
            set_text(msg)
            return HTML_REDIRECT
        return HTML_FORM

    return HTML_FORM

# 5) Serve forever
while True:
    try:
        client, _ = srv.accept()
    except Exception:
        time.sleep(0.05)
        continue
    try:
        client.settimeout(5)
        req = client.recv(2048)
        if req:
            resp = handle_request(req)
            # Add Content-Length header for proper HTTP
            resp = add_content_length(resp)
            # Send response in chunks if needed
            resp_bytes = resp.encode("utf-8")
            sent = 0
            while sent < len(resp_bytes):
                chunk = client.send(resp_bytes[sent:])
                if chunk == 0:
                    break
                sent += chunk
    except Exception as e:
        # Ignore errors, just close the connection
        pass
    finally:
        try:
            client.close()
        except Exception:
            pass
