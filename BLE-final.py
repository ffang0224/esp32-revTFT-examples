import time
import json
import board
import displayio
import terminalio

from adafruit_display_text import label
from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService

# ---------- DISPLAY ----------
display = board.DISPLAY

splash = displayio.Group()
display.root_group = splash

bg_bitmap = displayio.Bitmap(display.width, display.height, 1)
bg_palette = displayio.Palette(1)
bg_palette[0] = 0x000000
bg = displayio.TileGrid(bg_bitmap, pixel_shader=bg_palette)
splash.append(bg)

text_label = label.Label(
    terminalio.FONT,
    text="Booting...",
    color=0x00FFFF,
)
text_label.anchor_point = (0.5, 0.5)
text_label.anchored_position = (display.width // 2, display.height // 2)
splash.append(text_label)


def set_text(t, c=0x00FFFF):
    text_label.text = t[:40]
    text_label.color = c


def parse_color(h, default=0x00FFFF):
    if not h:
        return default
    try:
        s = h.strip().lstrip("#")
        if len(s) == 6:
            return int(s, 16)
    except Exception as e:
        print("Color parse error:", e)
    return default


# ---------- BLE ----------
ble = BLERadio()
# Sometimes BLE holds onto an old name or connection.
# Force name setting:
ble.name = "FaustoBadge"

uart = UARTService()
advertisement = ProvideServicesAdvertisement(uart)
# Ensure 'complete_name' is actually broadcast in the scan response or main packet if space allows
advertisement.complete_name = "FaustoBadge"
advertisement.short_name = "Fausto"

print("Advertising as FaustoBadge")

while True:
    print("WAITING...")
    set_text("Waiting for BLE...", 0x00FFFF)
    # Stop any previous advertising just in case
    ble.stop_advertising()
    ble.start_advertising(advertisement)

    while not ble.connected:
        time.sleep(0.1)

    ble.stop_advertising()
    print("CONNECTED")
    set_text("Connected ✅", 0x00FF00)

    while ble.connected:
        if uart.in_waiting:
            try:
                raw = uart.read(uart.in_waiting)
            except Exception as e:
                print("UART read error:", repr(e))
                break

            if not raw:
                continue

            try:
                s = raw.decode("utf-8", "ignore").strip()
            except Exception as e:
                print("Decode error:", repr(e), raw)
                continue

            print("RX:", s)

            # Try JSON {"text": "...", "color": "#RRGGBB"}
            try:
                msg = json.loads(s)
                txt = msg.get("text") or ""
                col = parse_color(msg.get("color"), 0x00FFFF)
            except Exception:
                txt = s
                col = 0x00FFFF

            if txt:
                set_text(txt, col)

                try:
                    uart.write(b'{"ok":true}\n')
                except Exception as e:
                    print("ACK write failed:", repr(e))

        time.sleep(0.05)

    print("DISCONNECTED")
    # loop repeats, advertising restarts
