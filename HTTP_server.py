# Feather ESP32-S3 Reverse TFT — Wi-Fi AP with HTTP form using adafruit_httpserver
# Requires: lib/adafruit_display_text/, lib/adafruit_httpserver/

import time
import board
import displayio
import terminalio
import digitalio
from adafruit_display_text import label
import wifi
import socketpool
from adafruit_httpserver import Request, Response, Server, POST, Redirect

# ---------- CONFIG ----------
AP_SSID = "CapstoneTestWifi"
AP_PASSWORD = "aaron123"  # set "" for open
ROTATION = 0
TEXT_COLOR = 0xFFFFFF
BG_COLOR = 0x000000
SCALE = 1
PADDING = 8
# ---------------------------

# Power on TFT rail
try:
    tft_power = digitalio.DigitalInOut(board.TFT_I2C_POWER)
    tft_power.switch_to_output(value=True)
    time.sleep(0.1)
except Exception:
    pass

# Display setup
display = board.DISPLAY
display.rotation = ROTATION
if hasattr(display, "brightness") and display.brightness is not None:
    try:
        display.brightness = 1.0
    except Exception:
        pass

root = displayio.Group()
display.root_group = root

bg_bitmap = displayio.Bitmap(display.width, display.height, 1)
bg_palette = displayio.Palette(1)
bg_palette[0] = BG_COLOR
bg = displayio.TileGrid(bg_bitmap, pixel_shader=bg_palette)
root.append(bg)

text_label = label.Label(
    terminalio.FONT,
    text="",
    color=TEXT_COLOR,
    line_spacing=1.1,
)
text_label.anchor_point = (0, 0)
text_label.anchored_position = (PADDING, PADDING)
root.append(text_label)


def set_text(msg):
    # Simple word-wrap to fit width at current scale
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
    text_label.scale = SCALE


def show_lines(lines):
    set_text("\n".join(lines))


def url_decode(s):
    # Decode application/x-www-form-urlencoded: '+' becomes space, %HH decoded
    if s is None:
        return ""
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == '+':
            out.append(' ')
            i += 1
        elif c == '%' and i + 2 < len(s):
            try:
                out.append(chr(int(s[i+1:i+3], 16)))
                i += 3
            except Exception:
                out.append('%')
                i += 1
        else:
            out.append(c)
            i += 1
    return ''.join(out)


show_lines(["Starting AP…"])

# Start AP
if AP_PASSWORD:
    wifi.radio.start_ap(ssid=AP_SSID, password=AP_PASSWORD)
else:
    wifi.radio.start_ap(ssid=AP_SSID)

# Give radio a moment
time.sleep(0.4)

ip = str(wifi.radio.ipv4_address_ap)
show_lines([
    "Connect to:",
    "  " + AP_SSID,
    "",
    "Open:",
    "  http://" + ip + "/",
])

# HTTP server
pool = socketpool.SocketPool(wifi.radio)
server = Server(pool, "/static", debug=True)


def html_page(message):
    return (
        "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        "<title>Feather Text</title>"
        "<style>body{font-family:system-ui;margin:1rem;}" \
        "input,button,textarea{font:inherit;padding:.6rem;width:100%;margin:.5rem 0;}" \
        "code{background:#eee;padding:.2rem .4rem;border-radius:.25rem}</style></head><body>"
        "<h2>Capstone Test</h2>"
        "<p>Connected to <b>" + AP_SSID + "</b>. Send text to the TFT:</p>"
        "<form method=\"POST\" action=\"/submit\">"
        "<textarea name=\"t\" rows=\"6\" placeholder=\"Type here...\"></textarea>"
        "<button type=\"submit\">Show</button>"
        "</form>"
        "<p>Or GET: <code>/?t=Hello%20World</code></p>"
        "<p>Current: <code>" + message.replace("<", "&lt;").replace(">", "&gt;") + "</code></p>"
        "</body></html>"
    )


@server.route("/")
def index(request: Request):
    # Query param t for quick testing
    query = request.query_params or {}
    msg = query.get("t")
    if msg:
        set_text(url_decode(msg))
        return Redirect(request, "/")
    return Response(request, html_page(text_label.text), content_type="text/html")


@server.route("/submit", POST)
def submit(request: Request):
    form = request.form_data
    msg = form.get("t") if form else None
    if msg is not None:
        set_text(url_decode(msg))
    return Redirect(request, "/")


server.serve_forever(ip)