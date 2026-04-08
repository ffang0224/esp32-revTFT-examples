import time
import json
import board
import displayio
import terminalio
import base64
from fourwire import FourWire

from adafruit_display_text import label, bitmap_label
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


def init_eink_display(force_reinit=False):
    """Initialize e-ink display (lazy initialization to avoid bus conflicts)
    
    Args:
        force_reinit: If True, reinitialize even if already initialized.
                      This resets the driver's internal refresh timer.
    """
    global eink_display
    if eink_display is not None and not force_reinit:
        return eink_display
    
    print("Initializing e-ink display..." + (" (forced reinit)" if force_reinit else ""))
    # Release displays to free up the bus and reset driver state
    displayio.release_displays()
    eink_display = None  # Clear old reference
    
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
        rotation=270,
        colstart=-8,  # Comment out for older displays
    )
    
    print("E-ink display initialized")
    return eink_display


def _mix_seed(seed, value):
    seed = (seed ^ (value & 0xFFFFFFFF)) & 0xFFFFFFFF
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
    return seed


def _rand01(seed):
    return ((seed >> 8) & 0xFFFFFF) / 16777215.0


def generate_ink_blot(bitmap, seed):
    """Generate mirrored Rorschach-style blot into a 1-bit bitmap."""
    w = bitmap.width
    h = bitmap.height
    half_w = w // 2

    blob_count = 8 + int(_rand01(_mix_seed(seed, 0xA5A5)) * 6)  # 8..13
    blobs = []
    local_seed = seed
    for i in range(blob_count):
        local_seed = _mix_seed(local_seed, i * 97 + 13)
        r = 8 + int(_rand01(local_seed) * max(10, min(w, h) // 5))
        local_seed = _mix_seed(local_seed, i * 131 + 29)
        cx = int(half_w * (0.18 + _rand01(local_seed) * 0.70))
        local_seed = _mix_seed(local_seed, i * 163 + 41)
        cy = int(h * (0.18 + _rand01(local_seed) * 0.64))
        local_seed = _mix_seed(local_seed, i * 193 + 53)
        stretch = 0.70 + _rand01(local_seed) * 0.90
        local_seed = _mix_seed(local_seed, i * 223 + 67)
        weight = 0.70 + _rand01(local_seed) * 1.00
        blobs.append((cx, cy, r, stretch, weight))

    threshold = 0.78
    center_x = (w - 1) * 0.5
    center_y = (h - 1) * 0.5
    inv_rx = 1.0 / max(1.0, w * 0.58)
    inv_ry = 1.0 / max(1.0, h * 0.72)

    for y in range(h):
        for x in range(half_w + (w % 2)):
            density = 0.0
            for (cx, cy, r, stretch, weight) in blobs:
                dx = (x - cx) / float(r)
                dy = (y - cy) / float(r * stretch)
                d2 = dx * dx + dy * dy
                if d2 < 1.0:
                    density += (1.0 - d2) * weight

            rx = (x - center_x) * inv_rx
            ry = (y - center_y) * inv_ry
            radial = 1.0 - (rx * rx + ry * ry)
            if radial < 0:
                radial = 0
            density *= radial

            grain_seed = _mix_seed(seed, x * 73856093 ^ y * 19349663)
            grain = (_rand01(grain_seed) - 0.5) * 0.20
            bit = 1 if (density + grain) > threshold else 0

            mirror_x = w - 1 - x
            bitmap[x, y] = bit
            bitmap[mirror_x, y] = bit


def render_image(binary_data, width, height, prompt_text=""):
    """Render 1-bit packed binary image data to e-ink display with stacked layout:
    - Top: image region (center-cropped from source)
    - Bottom: prompt text region
    """
    try:
        print(f"Rendering image to e-ink: {width}x{height}, data length: {len(binary_data)} bytes")
        if prompt_text:
            print(f"Prompt text: {prompt_text[:50]}...")
        
        # Initialize e-ink display (force reinit to reset driver's refresh timer)
        eink = init_eink_display(force_reinit=True)
        
        expected_bytes = (width * height + 7) // 8  # Ceiling division
        if len(binary_data) < expected_bytes:
            print(f"Warning: Expected {expected_bytes} bytes, got {len(binary_data)}")
        
        # Get ACTUAL display dimensions (accounts for rotation)
        # Don't hardcode - query from the display object
        display_width = eink.width
        display_height = eink.height
        print(f"Actual display dimensions: {display_width}x{display_height}")
        
        # Margins for cleaner look
        MARGIN = 6  # Pixels of margin around content
        
        # Always use a stacked layout for the ink-blot style:
        # image on top, text at the bottom.
        # Keep a guaranteed text band when prompt text is present.
        min_text_band = 30 if prompt_text else 0
        max_text_band = 44
        text_height = min(max_text_band, min_text_band + (len(prompt_text) // 24) * 8)
        text_height = min(text_height, max(0, display_height - MARGIN * 3 - 24))

        image_width = display_width - MARGIN * 2
        image_height = display_height - text_height - MARGIN * 3
        image_height = max(24, image_height)

        text_width = display_width - MARGIN * 2
        image_x = MARGIN
        image_y = MARGIN
        text_area_x = MARGIN
        # Nudge text band slightly lower to better align with panel optics.
        text_area_y = image_y + image_height + MARGIN + 2
        layout = "stacked"
        
        print(f"Layout: {layout}, image area: {image_width}x{image_height} at ({image_x},{image_y}), text area: {text_width}x{text_height} at ({text_area_x},{text_area_y})")
        
        # Ensure image dimensions match expected square size
        # Crop to fit the 122x122 square area
        actual_width = min(width, image_width)
        actual_height = min(height, image_height)
        
        print(f"Original image: {width}x{height}, displaying: {actual_width}x{actual_height} in {image_width}x{image_height} area")
        
        # Create bitmap for the image (2 colors = 1 bit per pixel, but value_count=2)
        img_bitmap = displayio.Bitmap(actual_width, actual_height, 2)
        
        # Create palette: [0] = White, [1] = Black
        img_palette = displayio.Palette(2)
        img_palette[0] = 0xFFFFFF  # White
        img_palette[1] = 0x000000  # Black
        
        # Build a deterministic seed from payload+prompt and generate a mirrored ink blot.
        seed = _mix_seed(0xC0FFEE, len(binary_data))
        for b in binary_data[:128]:
            seed = _mix_seed(seed, b)
        for ch in prompt_text[:96]:
            seed = _mix_seed(seed, ord(ch))
        generate_ink_blot(img_bitmap, seed)
        print(f"Generated ink blot in {actual_width}x{actual_height} area (seed={seed})")
        
        # Create a full-screen bitmap filled with white (to prevent tiling)
        screen_bitmap = displayio.Bitmap(display_width, display_height, 2)
        # Fill with white (palette index 0) using x,y indexing
        for y in range(display_height):
            for x in range(display_width):
                screen_bitmap[x, y] = 0
        
        # Copy the image bitmap to the image area (position set by layout)
        # Center the image within the image area
        center_x_offset = max(0, (image_width - actual_width) // 2)
        center_y_offset = max(0, (image_height - actual_height) // 2)
        
        # Ensure we don't exceed bounds
        copy_height = min(actual_height, image_height - center_y_offset)
        copy_width = min(actual_width, image_width - center_x_offset)
        
        # Copy using explicit (x, y) coordinates
        # Image starts at (image_x, image_y) set by layout
        for y in range(copy_height):
            for x in range(copy_width):
                src_x = x
                src_y = y
                dst_x = image_x + center_x_offset + x
                dst_y = image_y + center_y_offset + y
                if dst_y < display_height and dst_x < display_width:
                    screen_bitmap[dst_x, dst_y] = img_bitmap[src_x, src_y]
        
        print(f"Image placed: {actual_width}x{actual_height} at ({image_x + center_x_offset}, {image_y + center_y_offset})")
        
        # Render text in the text area if prompt is provided
        # text_area_x and text_area_y are already set by the layout logic above
        if prompt_text:
            try:
                # Word wrap text to fit within text area
                # Estimate: terminalio.FONT is about 6 pixels wide per character
                chars_per_line = max(1, text_width // 6)  # Rough estimate
                max_lines = max(1, text_height // 8)  # Rough estimate for line height
                max_chars = chars_per_line * max_lines
                
                # Simple word wrapping function
                def wrap_text(text, max_width_chars):
                    words = text.split()
                    lines = []
                    current_line = ""
                    
                    for word in words:
                        # If adding this word would exceed the line, start a new line
                        test_line = current_line + (" " if current_line else "") + word
                        if len(test_line) <= max_width_chars:
                            current_line = test_line
                        else:
                            if current_line:
                                lines.append(current_line)
                            # If word itself is too long, truncate it
                            if len(word) > max_width_chars:
                                current_line = word[:max_width_chars]
                            else:
                                current_line = word
                    
                    if current_line:
                        lines.append(current_line)
                    
                    return "\n".join(lines[:max_lines])  # Limit to max_lines
                
                wrapped_text = wrap_text(prompt_text[:max_chars], chars_per_line)
                print(f"Rendering text ({len(wrapped_text)} chars, {wrapped_text.count(chr(10))+1} lines): '{wrapped_text[:50]}...'")
                
                # Create bitmap label for text rendering with wrapped text
                text_label = bitmap_label.Label(
                    terminalio.FONT,
                    text=wrapped_text,
                    color=0x000000,
                )
                
                # bitmap_label.Label is a TileGrid - access its bitmap
                label_bitmap = text_label.bitmap
                
                if label_bitmap:
                    # Get dimensions - limit to text area size
                    label_w = min(label_bitmap.width, text_width)
                    label_h = min(label_bitmap.height, text_height)
                    
                    print(f"Label bitmap: {label_bitmap.width}x{label_bitmap.height}, using {label_w}x{label_h}")
                    
                    # Bottom-align text in the text band.
                    text_y_offset = max(0, text_height - label_h)
                    # Center text horizontally in the text area (if text is narrower than text_width)
                    text_x_offset = max(0, (text_width - label_w) // 2)
                    
                    print(f"Text centered: x_offset={text_x_offset}, y_offset={text_y_offset}")
                    
                    # Copy label bitmap to the text area of screen bitmap, centered
                    # Ensure we don't exceed bounds
                    copy_h = min(label_h, text_height - text_y_offset)
                    copy_w = min(label_w, text_width - text_x_offset)
                    
                    # Use explicit (x, y) coordinates for clarity
                    for y in range(copy_h):
                        for x in range(copy_w):
                            dst_y = text_area_y + text_y_offset + y
                            dst_x = text_area_x + text_x_offset + x
                            if dst_y < display_height and dst_x < display_width:
                                # Try to access label_bitmap with (x, y) or linear indexing
                                try:
                                    pixel_val = label_bitmap[x, y]
                                except (TypeError, IndexError):
                                    # Fallback to linear indexing
                                    src_idx = y * label_bitmap.width + x
                                    if src_idx < label_bitmap.width * label_bitmap.height:
                                        pixel_val = label_bitmap[src_idx]
                                    else:
                                        pixel_val = 0
                                
                                # 0 = white/background, non-zero = black/foreground
                                if pixel_val != 0:
                                    screen_bitmap[dst_x, dst_y] = 1  # Black
                                else:
                                    screen_bitmap[dst_x, dst_y] = 0  # White
                    
                    print(f"Text rendered in text area: {label_w}x{label_h} at ({text_area_x}, {text_area_y})")
                else:
                    print("Warning: Could not access label bitmap, text will not be displayed")
                    
            except Exception as text_err:
                print(f"Text rendering error: {text_err}")
                print(f"Error type: {type(text_err).__name__}")

        # Keep any rows below the text band explicitly white to avoid artifacts.
        bottom_start = min(display_height, text_area_y + text_height)
        for y in range(bottom_start, display_height):
            for x in range(display_width):
                screen_bitmap[x, y] = 0
        
        print(f"Screen bitmap size: {screen_bitmap.width}x{screen_bitmap.height}")
        print(f"Display size: {display_width}x{display_height}")
        
        # Create TileGrid for the full-screen bitmap
        # Explicitly set to 1x1 tiles to prevent any tiling behavior
        screen_tile = displayio.TileGrid(
            screen_bitmap, 
            pixel_shader=img_palette,
            width=1,
            height=1,
            tile_width=screen_bitmap.width,
            tile_height=screen_bitmap.height,
            x=0,
            y=0
        )
        
        # Create a new group for the e-ink display (clear any previous content)
        # Match test-eink.py pattern exactly
        eink_group = displayio.Group()
        # Remove any existing items
        while len(eink_group) > 0:
            eink_group.pop()
        # Add only our single full-screen tile
        eink_group.append(screen_tile)
        
        # Set root group on e-ink display - match test-eink.py pattern
        eink.root_group = eink_group
        
        # Small delay to ensure framebuffer is fully written before refresh
        # This can help prevent partial/incomplete image issues
        time.sleep(0.5)
        print("Framebuffer ready, starting refresh...")
        
        # Refresh the e-ink display - match test-eink.py pattern exactly
        eink.refresh()
        print("Refresh command sent")
        
        print(f"Split layout rendered: {width}x{height} image + text")
        
        # Wait for the physical refresh to complete
        # E-ink displays need time for the physical update (electrophoretic particles moving)
        # The SSD1680 typically takes 3-5 seconds for a full refresh
        # Using a longer wait to ensure complete refresh
        refresh_wait = 6
        print(f"Waiting {refresh_wait}s for physical e-ink refresh to complete...")
        time.sleep(refresh_wait)
        print("E-ink refresh complete")
        
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
    "prompt": "",  # Store prompt text for split layout
    "transfer_id": None,  # Transfer identifier used by rn-ble-test ACK flow
    "last_progress_sent": -1,  # Last progress % reported to app
}


# ---------- BLE ----------
BLE_DEVICE_NAME = "FaustoBD"
BLE_ADV_INTERVAL = 0.1


def ble_log(message):
    print(f"[BLE {time.monotonic():.3f}] {message}")


ble = BLERadio()
# Sometimes BLE holds onto an old name or connection.
# Force name setting:
try:
    ble.name = BLE_DEVICE_NAME
    ble_log(f"Set BLE name to: {ble.name}")
except Exception as e:
    ble_log(f"Warning: Could not set BLE name: {e}")

uart = UARTService()
advertisement = ProvideServicesAdvertisement(uart)
# Use only a complete_name to keep the advertising payload simple and compatible.
# If you run into size issues, prefer a shorter complete_name rather than also
# setting short_name, which can increase packet size and cause truncation.
advertisement.complete_name = BLE_DEVICE_NAME
# If you really need a short name, you can enable this, but try leaving it
# disabled first for best compatibility:
# advertisement.short_name = "Fausto"

ble_log(f"BLE initialized, ready to advertise as {BLE_DEVICE_NAME}")


def send_uart_json(payload):
    """Send newline-delimited JSON to the BLE UART TX characteristic."""
    try:
        uart.write((json.dumps(payload) + "\n").encode("utf-8"))
    except Exception as e:
        print("UART JSON write failed:", repr(e), payload)

while True:
    ble_log("WAITING for connection")
    set_text("Waiting for BLE...", 0x00FFFF)

    # Always try to stop any prior advertising; ignore errors if it wasn't active.
    try:
        ble.stop_advertising()
        ble_log("Ensured advertising is stopped before starting")
    except Exception as e:
        ble_log(f"Note: stop_advertising (pre-start) ignored: {e}")

    # Start advertising with error handling
    try:
        ble.start_advertising(advertisement, interval=BLE_ADV_INTERVAL)
        ble_log(f"Started advertising name={BLE_DEVICE_NAME}, interval={BLE_ADV_INTERVAL}s")
        # Give advertising a moment to start broadcasting
        time.sleep(0.1)
    except Exception as e:
        ble_log(f"Failed to start advertising: {e}")
        set_text("Adv error!", 0xFF0000)
        time.sleep(2)  # Wait longer before retrying on error
        continue

    # Wait for connection with timeout check
    connection_timeout = 60  # 60 seconds timeout
    start_wait = time.monotonic()
    while not ble.connected:
        if time.monotonic() - start_wait > connection_timeout:
            ble_log("Connection timeout - restarting advertising")
            break  # Break out to restart advertising
        time.sleep(0.1)

    # If we broke due to timeout, restart the loop and re-advertise
    if not ble.connected:
        try:
            ble.stop_advertising()
        except Exception as e:
            ble_log(f"stop_advertising after timeout ignored: {e}")
        continue

    # Connected: stop advertising if still active
    try:
        ble.stop_advertising()
        ble_log("Stopped advertising (connected)")
    except Exception as e:
        ble_log(f"Error stopping advertising after connect: {e}")

    ble_log("CONNECTED")
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

            # Debug: log what we're receiving
            print(f"RX: {len(raw)}B, recv={image_state['receiving']}, data={len(image_state['data']) if image_state['receiving'] else 0}")

            # If receiving image data, handle binary chunks
            if image_state["receiving"]:
                # Check if this might be a new image_start command (JSON)
                # This handles the case where user pressed send again
                is_new_command = False
                try:
                    test_str = raw.decode("utf-8").strip()
                    if test_str.startswith("{") and ('"cmd"' in test_str or '"t"' in test_str):
                        print("Detected new command while receiving - resetting state")
                        image_state["receiving"] = False
                        image_state["data"] = bytearray()
                        image_state["prompt"] = ""
                        image_state["transfer_id"] = None
                        image_state["last_chunk_time"] = 0
                        image_state["last_progress_sent"] = -1
                        is_new_command = True
                        # Fall through to JSON processing below
                except:
                    pass  # Not a JSON command, continue as image data
                
                if not is_new_command:
                    try:
                        current_time = time.monotonic()
                        
                        # Check for timeout (20 seconds without receiving data)
                        if image_state["last_chunk_time"] > 0:
                            time_since_last = current_time - image_state["last_chunk_time"]
                            if time_since_last > 20:
                                print("Image receive timeout! Resetting...")
                                image_state["receiving"] = False
                                image_state["data"] = bytearray()
                                image_state["prompt"] = ""
                                image_state["transfer_id"] = None
                                image_state["last_chunk_time"] = 0
                                image_state["last_progress_sent"] = -1
                                set_text("Timeout!", 0xFF0000)
                                continue
                        
                        # Process as image chunk
                        # react-native-ble-plx's writeWithoutResponse DECODES base64 before sending
                        # So we receive RAW BINARY data, not base64 strings
                        # Just append the raw bytes directly!
                        image_state["data"].extend(raw)
                        
                        # Log progress periodically
                        if len(image_state["data"]) % 500 < len(raw):
                            print(f"Chunk: {len(raw)}B, total: {len(image_state['data'])}/{image_state['expected_len']}")
                        
                        image_state["last_chunk_time"] = current_time
                        
                        # Update progress on display every 10%
                        progress = (len(image_state["data"]) * 100) // image_state["expected_len"] if image_state["expected_len"] > 0 else 0
                        if progress % 10 == 0 or len(image_state["data"]) >= image_state["expected_len"]:
                            set_text(f"Receiving: {progress}%", 0xFFFF00)
                        if image_state["transfer_id"] and progress != image_state["last_progress_sent"] and progress % 10 == 0:
                            send_uart_json({
                                "t": "prog",
                                "id": image_state["transfer_id"],
                                "pct": progress,
                                "rx": len(image_state["data"]),
                            })
                            image_state["last_progress_sent"] = progress
                        
                        # Check if complete
                        if len(image_state["data"]) >= image_state["expected_len"]:
                            print("Image complete! Rendering...")
                            # Truncate to expected length
                            image_state["data"] = image_state["data"][:image_state["expected_len"]]
                            # Send completion ACK before the long e-ink refresh so the app
                            # does not timeout while the panel is physically updating.
                            if image_state["transfer_id"]:
                                send_uart_json({
                                    "t": "ack",
                                    "id": image_state["transfer_id"],
                                    "st": "rendering",
                                    "ok": 1,
                                })
                            # Render image to display with prompt text
                            render_ok = True
                            try:
                                render_image(
                                    image_state["data"],
                                    image_state["width"],
                                    image_state["height"],
                                    image_state["prompt"]
                                )
                            except Exception as render_err:
                                render_ok = False
                                print("Render exception after image complete:", render_err)

                            if image_state["transfer_id"] and not render_ok:
                                send_uart_json({
                                    "t": "ack",
                                    "id": image_state["transfer_id"],
                                    "st": "render_error",
                                    "ok": 0,
                                })
                            # Reset state
                            image_state["receiving"] = False
                            image_state["data"] = bytearray()
                            image_state["prompt"] = ""
                            image_state["transfer_id"] = None
                            image_state["last_chunk_time"] = 0
                            image_state["last_progress_sent"] = -1
                    except Exception as e:
                        print("Image decode error:", e)
                        print(f"Error type: {type(e).__name__}")
                        if image_state["transfer_id"]:
                            send_uart_json({
                                "t": "ack",
                                "id": image_state["transfer_id"],
                                "st": "decode_error",
                                "ok": 0,
                            })
                        image_state["receiving"] = False
                        image_state["data"] = bytearray()
                        image_state["prompt"] = ""
                        image_state["transfer_id"] = None
                        image_state["last_chunk_time"] = 0
                        image_state["last_progress_sent"] = -1
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
                
                # Check for image command: support both legacy and rn-ble-test compact protocol.
                is_legacy_start = msg.get("cmd") == "image_start"
                is_compact_start = msg.get("t") == "img"
                if is_legacy_start or is_compact_start:
                    # ALWAYS reset state when receiving a new image_start
                    # This handles cases where previous transfer was incomplete
                    if image_state["receiving"]:
                        print("Warning: Cancelling previous incomplete transfer")
                    
                    # Completely reset all image state
                    image_state["receiving"] = True
                    image_state["width"] = msg.get("w", 0)
                    image_state["height"] = msg.get("h", 0)
                    image_state["expected_len"] = msg.get("len", 0)
                    image_state["prompt"] = msg.get("p", "") if is_compact_start else msg.get("prompt", "")
                    image_state["transfer_id"] = msg.get("id", None) if is_compact_start else None
                    image_state["data"] = bytearray()  # Fresh buffer
                    image_state["last_chunk_time"] = time.monotonic()
                    image_state["last_progress_sent"] = -1
                    
                    # Validate the incoming parameters
                    if image_state["expected_len"] <= 0 or image_state["width"] <= 0 or image_state["height"] <= 0:
                        print(f"Invalid image params: w={image_state['width']}, h={image_state['height']}, len={image_state['expected_len']}")
                        if image_state["transfer_id"]:
                            send_uart_json({
                                "t": "ack",
                                "id": image_state["transfer_id"],
                                "st": "bad_params",
                                "ok": 0,
                            })
                        image_state["receiving"] = False
                        image_state["transfer_id"] = None
                        set_text("Invalid image!", 0xFF0000)
                        continue
                    
                    print(f"Image start: {image_state['width']}x{image_state['height']}, {image_state['expected_len']} bytes")
                    if image_state["prompt"]:
                        print(f"Prompt: {image_state['prompt'][:50]}...")
                    print(f"Waiting for {image_state['expected_len']} bytes...")
                    set_text("Receiving...", 0xFFFF00)
                    if image_state["transfer_id"]:
                        send_uart_json({
                            "t": "ack",
                            "id": image_state["transfer_id"],
                            "st": "start",
                            "ok": 1,
                            "rx": 0,
                            "len": image_state["expected_len"],
                        })
                    continue
                
                if msg.get("t") == "bat":
                    # Minimal telemetry response so rn-ble-test fetchBatteryData can clear loading.
                    send_uart_json({"t": "bat", "mv": 0, "pct": 0, "tmp": None, "src": "unsupported"})
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

    ble_log("DISCONNECTED")
    # Reset image state on disconnect
    image_state["receiving"] = False
    image_state["data"] = bytearray()
    image_state["prompt"] = ""
    image_state["transfer_id"] = None
    image_state["last_chunk_time"] = 0
    image_state["last_progress_sent"] = -1

    # Always try to stop advertising to ensure a clean state
    try:
        ble.stop_advertising()
        ble_log("Stopped advertising (disconnected)")
    except Exception as e:
        ble_log(f"Error stopping advertising on disconnect: {e}")

    # Small delay after disconnect before restarting advertising to ensure clean state
    time.sleep(0.5)
    # loop repeats, advertising will restart at the top
