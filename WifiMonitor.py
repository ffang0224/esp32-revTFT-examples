# Feather ESP32-S3 Reverse TFT — WiFi AP Connection Monitor
# Shows connection information on the TFT display

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
PASSWORD = "aaron123"   # ≥8 chars
ROTATION = 0              # 0/90/180/270
TEXT_COLOR = 0xFFFFFF
BG_COLOR = 0x000000
SCALE = 1                 # text size multiplier
PADDING = 8                # px margin around text
# ---------------------------

# Initialize TFT display
tft_power = digitalio.DigitalInOut(board.TFT_I2C_POWER)
tft_power.switch_to_output(value=True)
time.sleep(0.1)

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

# Text label
text_label = label.Label(
    terminalio.FONT,
    text="Starting...",
    color=TEXT_COLOR,
    line_spacing=1.1,
)
text_label.anchor_point = (0, 0)
text_label.anchored_position = (PADDING, PADDING)
root.append(text_label)

def show_lines(lines):
    """Display multiple lines of text on the TFT"""
    text_label.text = "\n".join(lines)
    text_label.scale = SCALE

# Show startup message
show_lines([
    "Starting WiFi...",
    "",
    "Please wait..."
])

# Start WiFi AP
if PASSWORD:
    radio.start_ap(SSID, PASSWORD)
else:
    radio.start_ap(SSID)
time.sleep(0.4)
ip = str(radio.ipv4_address_ap)

# Show WiFi AP info
show_lines([
    "WiFi AP Running!",
    "",
    f"SSID: {SSID}",
    f"IP: {ip}",
    "",
    "Waiting for connections..."
])
time.sleep(2)

# Setup simple HTTP server
pool = socketpool.SocketPool(radio)
srv = pool.socket(pool.AF_INET, pool.SOCK_STREAM)
srv.settimeout(0)
srv.setsockopt(pool.SOL_SOCKET, pool.SO_REUSEADDR, 1)
srv.bind(("0.0.0.0", 80))
srv.listen(5)

# Simple response
SIMPLE_RESPONSE = """HTTP/1.1 200 OK\r
Content-Type: text/plain\r
Connection: close\r
Content-Length: 17\r
\r
Connected!
"""

connection_count = 0
connection_history = []

# Main loop
while True:
    try:
        client, addr = srv.accept()
        connection_count += 1
        ip_str = str(addr[0]) if addr else "unknown"
        timestamp = time.localtime()
        time_str = f"{timestamp.tm_hour:02d}:{timestamp.tm_min:02d}:{timestamp.tm_sec:02d}"
        
        # Add to history (keep last 10)
        connection_history.append({
            "num": connection_count,
            "ip": ip_str,
            "time": time_str
        })
        if len(connection_history) > 10:
            connection_history.pop(0)
        
        # Show connection info on TFT
        display_lines = [
            f"Connection #{connection_count}",
            f"IP: {ip_str}",
            f"Time: {time_str}",
            "",
            "Total: " + str(connection_count),
            ""
        ]
        
        # Show recent connections (last 3)
        if len(connection_history) > 1:
            display_lines.append("Recent:")
            for conn in connection_history[-3:]:
                display_lines.append(f"  #{conn['num']}: {conn['ip']}")
        
        show_lines(display_lines)
        
        # Small delay to let client send data
        time.sleep(0.05)
        
    except Exception as accept_err:
        time.sleep(0.05)
        continue
    
    try:
        client.settimeout(1.0)
        
        # Simple read
        req = b""
        for _ in range(5):
            try:
                data = client.recv(1024)
                if data:
                    req += data
                    if b"\r\n\r\n" in req:
                        break
                    time.sleep(0.01)
                else:
                    break
            except:
                break
        
        # Send simple response
        try:
            client.send(SIMPLE_RESPONSE.encode("utf-8"))
        except:
            pass
            
    except Exception:
        pass
    finally:
        try:
            client.close()
        except Exception:
            pass

