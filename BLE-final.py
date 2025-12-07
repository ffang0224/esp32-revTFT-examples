import time
import json
import board
import displayio
import terminalio
import base64
from fourwire import FourWire

from adafruit_display_text import label
from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService
import adafruit_ssd1680

# ---------- ON-BOARD DISPLAY (for text) ----------
display = board.DISPLAY  # On-board TFT display

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

# ---------- E-INK DISPLAY (for images) ----------
# Will be initialized lazily when needed (to avoid "too many display busses" error)
eink_display = None


def set_text(t, c=0x00FFFF):
    text_label.text = t[:40]
    text_label.color = c
    # Restore background and text label (remove image if present)
    while len(splash) > 0:
        splash.pop()
    splash.append(bg)
    splash.append(text_label)


def init_eink_display():
    """Initialize e-ink display (lazy initialization to avoid bus conflicts)"""
    global eink_display
    if eink_display is not None:
        return eink_display
    
    print("Initializing e-ink display...")
    # Release on-board display temporarily to free up the bus
    displayio.release_displays()
    
    # Pin configuration - adjust if needed for your board
    spi = board.SPI()  # Uses SCK and MOSI
    epd_cs = board.D9
    epd_dc = board.D10
    epd_reset = None  # Set to None for FeatherWing
    epd_busy = None  # Set to None for FeatherWing
    
    display_bus = FourWire(spi, command=epd_dc, chip_select=epd_cs, reset=epd_reset, baudrate=1000000)
    time.sleep(1)
    
    # Initialize e-ink display - match test-eink.py exactly
    eink_display = adafruit_ssd1680.SSD1680(
        display_bus,
        width=250,
        height=122,
        busy_pin=epd_busy,
        highlight_color=0xFF0000,
        rotation=270,
        colstart=-8,  # Comment out for older displays
    )
    
    print("E-ink display initialized")
    return eink_display


def render_image(binary_data, width, height):
    """Render 1-bit packed binary image data to e-ink display"""
    try:
        print(f"Rendering image to e-ink: {width}x{height}, data length: {len(binary_data)} bytes")
        
        # Initialize e-ink display if not already done
        eink = init_eink_display()
        
        expected_bytes = (width * height + 7) // 8  # Ceiling division
        if len(binary_data) < expected_bytes:
            print(f"Warning: Expected {expected_bytes} bytes, got {len(binary_data)}")
        
        # Display dimensions: 250x122 (from init_eink_display)
        display_width = 250
        display_height = 122
        
        # Ensure image dimensions don't exceed display (crop if necessary)
        actual_width = min(width, display_width)
        actual_height = min(height, display_height)
        
        # Create bitmap for the image (2 colors = 1 bit per pixel, but value_count=2)
        img_bitmap = displayio.Bitmap(actual_width, actual_height, 2)
        
        # Create palette: [0] = White, [1] = Black
        img_palette = displayio.Palette(2)
        img_palette[0] = 0xFFFFFF  # White
        img_palette[1] = 0x000000  # Black
        
        # Unpack binary data (MSB first, bit=1 means Black)
        # Only unpack pixels that fit in the actual bitmap size
        pixel_index = 0
        max_pixels = actual_width * actual_height
        for byte in binary_data:
            # Process 8 bits per byte, MSB first
            for bit_pos in range(7, -1, -1):  # 7, 6, 5, 4, 3, 2, 1, 0
                if pixel_index >= max_pixels:
                    break
                
                # Extract bit (MSB first)
                bit = (byte >> bit_pos) & 1
                # bit=1 means Black (palette index 1), bit=0 means White (palette index 0)
                img_bitmap[pixel_index] = bit
                pixel_index += 1
        
        print(f"Unpacked {pixel_index} pixels into {actual_width}x{actual_height} bitmap")
        
        # Debug: Check bitmap values
        black_count = sum(1 for i in range(min(100, pixel_index)) if img_bitmap[i] == 1)
        white_count = sum(1 for i in range(min(100, pixel_index)) if img_bitmap[i] == 0)
        print(f"Sample: {black_count} black, {white_count} white pixels (first 100)")
        
        # Create a full-screen bitmap filled with white (to prevent tiling)
        screen_bitmap = displayio.Bitmap(display_width, display_height, 2)
        # Fill with white (palette index 0)
        for i in range(display_width * display_height):
            screen_bitmap[i] = 0
        
        # Calculate centering offsets
        x_offset = max(0, (display_width - actual_width) // 2)
        y_offset = max(0, (display_height - actual_height) // 2)
        
        # Copy the image bitmap into the center of the screen bitmap
        for y in range(min(actual_height, display_height - y_offset)):
            for x in range(min(actual_width, display_width - x_offset)):
                src_index = y * actual_width + x
                dst_index = (y_offset + y) * display_width + (x_offset + x)
                if src_index < actual_width * actual_height and dst_index < display_width * display_height:
                    screen_bitmap[dst_index] = img_bitmap[src_index]
        
        print(f"Centered image in full-screen bitmap: offset ({x_offset}, {y_offset})")
        print(f"Screen bitmap size: {screen_bitmap.width}x{screen_bitmap.height}")
        
        # Create TileGrid for the full-screen bitmap
        # width=1, height=1 means use only one tile (the entire bitmap)
        screen_tile = displayio.TileGrid(
            screen_bitmap, 
            pixel_shader=img_palette,
            width=1,
            height=1
        )
        
        # Ensure the tile is positioned at (0, 0) with no offset
        screen_tile.x = 0
        screen_tile.y = 0
        
        # Create a new group for the e-ink display (clear any previous content)
        eink_group = displayio.Group()
        # Remove any existing items
        while len(eink_group) > 0:
            eink_group.pop()
        # Add only our single full-screen tile
        eink_group.append(screen_tile)
        
        # Set root group on e-ink display - match test-eink.py pattern
        eink.root_group = eink_group
        
        # Refresh the e-ink display - match test-eink.py pattern exactly
        eink.refresh()
        print("refreshed")
        
        print(f"Image rendered to e-ink: {width}x{height}")
        
        # Wait for refresh to complete - match test-eink.py: time_to_refresh + 5
        # Always refresh a little longer. It's not a problem to refresh
        # a few seconds more, but it's terrible to refresh too early
        # (the display will throw an exception if the refresh is too soon)
        time.sleep(eink.time_to_refresh + 5)
        print("waited correct time")
        
        # Re-initialize on-board display after e-ink is done
        # (Note: This will break the on-board display until next reboot, but e-ink works)
        # For now, we'll leave it - the e-ink display is what matters for images
            
    except Exception as e:
        print(f"Image render error: {e}")
        print(f"Error type: {type(e).__name__}")
        set_text("Render error!", 0xFF0000)


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


# Image handling state
image_state = {
    "receiving": False,
    "width": 0,
    "height": 0,
    "expected_len": 0,
    "data": bytearray(),
    "last_chunk_time": 0,  # Track when last chunk was received
}


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

            # Debug: log what we're receiving (but limit output to avoid spam)
            if not image_state["receiving"] or len(image_state["data"]) % 500 < 50:  # Log every ~500 bytes
                print(f"RX: {len(raw)} bytes, receiving={image_state['receiving']}, total={len(image_state['data']) if image_state['receiving'] else 0}")

            # If receiving image data, handle binary chunks
            if image_state["receiving"]:
                try:
                    import time as time_module
                    current_time = time_module.monotonic()
                    
                    # Check for timeout (30 seconds without receiving data)
                    if image_state["last_chunk_time"] > 0:
                        time_since_last = current_time - image_state["last_chunk_time"]
                        if time_since_last > 30:
                            print("Image receive timeout! Resetting...")
                            image_state["receiving"] = False
                            image_state["data"] = bytearray()
                            set_text("Image timeout!", 0xFF0000)
                            continue
                    
                    # React Native sends base64-encoded chunks as strings
                    # writeWithoutResponse sends the base64 string as-is (doesn't decode it)
                    # So we need to decode the base64 string to get the binary data
                    
                    # Try to decode as UTF-8 first to get the base64 string
                    try:
                        base64_string = raw.decode("utf-8").strip()
                        # Decode the base64 string to get binary data
                        decoded = base64.b64decode(base64_string)
                        image_state["data"].extend(decoded)
                        print(f"Image chunk: {len(decoded)} bytes decoded, total: {len(image_state['data'])}/{image_state['expected_len']}")
                    except Exception as decode_err:
                        # If base64 decode fails, maybe it's already binary (fallback)
                        try:
                            image_state["data"].extend(raw)
                            print(f"Image chunk (raw binary fallback): {len(raw)} bytes, total: {len(image_state['data'])}/{image_state['expected_len']}")
                        except Exception as extend_err:
                            print(f"Error adding chunk: decode={decode_err}, extend={extend_err}")
                            raise
                    
                    image_state["last_chunk_time"] = current_time
                    
                    # Update progress on display every 10%
                    progress = (len(image_state["data"]) * 100) // image_state["expected_len"] if image_state["expected_len"] > 0 else 0
                    if progress % 10 == 0 or len(image_state["data"]) >= image_state["expected_len"]:
                        set_text(f"Receiving: {progress}%", 0xFFFF00)
                    
                    # Check if complete
                    if len(image_state["data"]) >= image_state["expected_len"]:
                        print("Image complete! Rendering...")
                        # Truncate to expected length
                        image_state["data"] = image_state["data"][:image_state["expected_len"]]
                        # Render image to display
                        render_image(
                            image_state["data"],
                            image_state["width"],
                            image_state["height"]
                        )
                        # Reset state
                        image_state["receiving"] = False
                        image_state["data"] = bytearray()
                        image_state["last_chunk_time"] = 0
                except Exception as e:
                    print("Image decode error:", e)
                    import sys
                    sys.print_exception(e)
                    image_state["receiving"] = False
                    image_state["data"] = bytearray()
                    image_state["last_chunk_time"] = 0
                    set_text("Image error!", 0xFF0000)
                continue

            # React Native's writeWithoutResponse decodes base64 before sending,
            # so we should receive raw UTF-8 bytes. Try UTF-8 first, then base64 as fallback.
            try:
                # Try direct UTF-8 decode first (most common case)
                s = raw.decode("utf-8", "ignore").strip()
            except Exception:
                # Fall back to base64 decode (in case library behavior differs)
                try:
                    decoded = base64.b64decode(raw)
                    s = decoded.decode("utf-8", "ignore").strip()
                except Exception as e:
                    print("Decode error:", repr(e), raw)
                    continue

            print("RX:", s)

            # Try JSON {"text": "...", "color": "#RRGGBB"} or {"cmd": "image_start", ...}
            try:
                msg = json.loads(s)
                
                # Check for image command
                if msg.get("cmd") == "image_start":
                    import time as time_module
                    # Reset any leftover state from previous incomplete transfers
                    if image_state["receiving"]:
                        print("Warning: Previous image transfer was incomplete, resetting state")
                    image_state["receiving"] = True
                    image_state["width"] = msg.get("w", 0)
                    image_state["height"] = msg.get("h", 0)
                    image_state["expected_len"] = msg.get("len", 0)
                    image_state["data"] = bytearray()  # Clear any old data
                    image_state["last_chunk_time"] = time_module.monotonic()
                    print(f"Image start: {image_state['width']}x{image_state['height']}, {image_state['expected_len']} bytes")
                    print(f"Now waiting for {image_state['expected_len']} bytes of image data...")
                    set_text("Receiving image...", 0xFFFF00)
                    continue
                
                # Regular text message
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
    # Reset image state on disconnect
    image_state["receiving"] = False
    image_state["data"] = bytearray()
    image_state["last_chunk_time"] = 0
    # loop repeats, advertising restarts
