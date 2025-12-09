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


def render_image(binary_data, width, height, prompt_text=""):
    """Render 1-bit packed binary image data to e-ink display with split layout:
    - Left side: square image (122x122)
    - Right side: prompt text (128x122)
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
        
        # Determine layout based on actual dimensions
        # If display is wider than tall (250x122), use horizontal split (image left, text right)
        # If display is taller than wide (122x250), use vertical split (image top, text bottom)
        if display_width >= display_height:
            # Horizontal layout: image on left, text on right
            image_size = min(display_height - MARGIN * 2, display_width // 2 - MARGIN * 2, 122)
            image_width = image_size
            image_height = image_size
            text_width = display_width - image_width - MARGIN * 3  # margin on left, between, right
            text_height = display_height - MARGIN * 2
            image_x = MARGIN
            image_y = MARGIN
            text_area_x = image_width + MARGIN * 2
            text_area_y = MARGIN
            layout = "horizontal"
        else:
            # Vertical layout: image on top, text on bottom
            image_size = min(display_width - MARGIN * 2, display_height // 2 - MARGIN * 2, 122)
            image_width = image_size
            image_height = image_size
            text_width = display_width - MARGIN * 2
            text_height = display_height - image_height - MARGIN * 3  # margin on top, between, bottom
            image_x = (display_width - image_width) // 2  # Center image horizontally
            image_y = MARGIN
            text_area_x = MARGIN
            text_area_y = image_height + MARGIN * 2
            layout = "vertical"
        
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
        
        # Unpack binary data (MSB first, bit=1 means Black)
        # Data is a continuous stream of bits in row-major order
        # Pixels are packed sequentially: pixel 0, pixel 1, pixel 2, ... pixel (width*height-1)
        
        # CENTER-CROP: If source is larger than target, take the center portion
        # This ensures the image content stays centered even when cropping
        crop_x_start = max(0, (width - actual_width) // 2)
        crop_y_start = max(0, (height - actual_height) // 2)
        crop_x_end = crop_x_start + actual_width
        crop_y_end = crop_y_start + actual_height
        
        print(f"Center crop: source ({crop_x_start},{crop_y_start}) to ({crop_x_end},{crop_y_end})")
        
        # Unpack directly into the destination positions using (x, y) indexing
        source_pixel_index = 0
        pixels_set = 0
        
        # Process bytes sequentially
        for byte in binary_data:
            if source_pixel_index >= width * height:
                break
            
            # Process 8 bits per byte, MSB first
            for bit_pos in range(7, -1, -1):  # 7, 6, 5, 4, 3, 2, 1, 0
                if source_pixel_index >= width * height:
                    break
                
                # Calculate which row and column this source pixel is in
                source_row = source_pixel_index // width
                source_col = source_pixel_index % width
                
                # Check if this pixel is within our center-crop area
                if (crop_y_start <= source_row < crop_y_end and 
                    crop_x_start <= source_col < crop_x_end):
                    # Calculate destination position in the cropped bitmap
                    dst_x = source_col - crop_x_start
                    dst_y = source_row - crop_y_start
                    
                    # Extract bit (MSB first)
                    bit = (byte >> bit_pos) & 1
                    # bit=1 means Black (palette index 1), bit=0 means White (palette index 0)
                    img_bitmap[dst_x, dst_y] = bit
                    pixels_set += 1
                
                source_pixel_index += 1
        
        print(f"Unpacked {pixels_set} pixels into {actual_width}x{actual_height} bitmap (center-cropped from {width}x{height})")
        
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
                chars_per_line = text_width // 6  # Rough estimate
                max_lines = text_height // 8  # Rough estimate for line height
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
                    background_color=0xFFFFFF,
                )
                
                # bitmap_label.Label is a TileGrid - access its bitmap
                label_bitmap = text_label.bitmap
                
                if label_bitmap:
                    # Get dimensions - limit to text area size
                    label_w = min(label_bitmap.width, text_width)
                    label_h = min(label_bitmap.height, text_height)
                    
                    print(f"Label bitmap: {label_bitmap.width}x{label_bitmap.height}, using {label_w}x{label_h}")
                    
                    # Center text vertically in the text area
                    text_y_offset = max(0, (text_height - label_h) // 2)
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
                # Fallback: draw a border around text area using (x, y) indexing
                for x in range(text_width):
                    dst_x = text_area_x + x
                    if dst_x < display_width:
                        if text_area_y < display_height:
                            screen_bitmap[dst_x, text_area_y] = 1  # Top border
                        if text_area_y + text_height - 1 < display_height:
                            screen_bitmap[dst_x, text_area_y + text_height - 1] = 1  # Bottom border
                for y in range(text_height):
                    dst_y = text_area_y + y
                    if dst_y < display_height:
                        if text_area_x < display_width:
                            screen_bitmap[text_area_x, dst_y] = 1  # Left border
                        if text_area_x + text_width - 1 < display_width:
                            screen_bitmap[text_area_x + text_width - 1, dst_y] = 1  # Right border
        
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
}


# ---------- BLE ----------
ble = BLERadio()
# Sometimes BLE holds onto an old name or connection.
# Force name setting:
try:
    ble.name = "FaustoBadge"
    print(f"Set BLE name to: {ble.name}")
except Exception as e:
    print(f"Warning: Could not set BLE name: {e}")

uart = UARTService()
advertisement = ProvideServicesAdvertisement(uart)
# Ensure 'complete_name' is actually broadcast in the scan response or main packet if space allows
advertisement.complete_name = "FaustoBadge"
advertisement.short_name = "Fausto"

# Track advertising state to avoid unnecessary operations
is_advertising = False

print("BLE initialized, ready to advertise as FaustoBadge")

while True:
    print("WAITING...")
    set_text("Waiting for BLE...", 0x00FFFF)
    
    # Always ensure clean state: stop advertising if it's running
    # This prevents issues with stale advertising state
    if is_advertising:
        try:
            ble.stop_advertising()
            print("Stopped previous advertising")
        except Exception as e:
            print(f"Note: Error stopping advertising (may not have been active): {e}")
        is_advertising = False
        time.sleep(0.2)  # Brief pause to ensure clean state
    
    # Start advertising with error handling
    try:
        ble.start_advertising(advertisement)
        is_advertising = True
        print("Started advertising - waiting for connection...")
        # Give advertising a moment to start broadcasting
        time.sleep(0.1)
    except Exception as e:
        print(f"Failed to start advertising: {e}")
        set_text("Adv error!", 0xFF0000)
        is_advertising = False
        time.sleep(2)  # Wait longer before retrying on error
        continue

    # Wait for connection with timeout check
    connection_timeout = 60  # 60 seconds timeout
    start_wait = time.monotonic()
    while not ble.connected:
        if time.monotonic() - start_wait > connection_timeout:
            print("Connection timeout - restarting advertising")
            break  # Break out to restart advertising
        time.sleep(0.1)
    
    # If we broke due to timeout, restart the loop
    if not ble.connected:
        continue

    # Stop advertising when connected
    if is_advertising:
        try:
            ble.stop_advertising()
            is_advertising = False
            print("Stopped advertising (connected)")
        except Exception as e:
            print(f"Error stopping advertising: {e}")
    
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

            # Debug: log what we're receiving
            print(f"RX: {len(raw)}B, recv={image_state['receiving']}, data={len(image_state['data']) if image_state['receiving'] else 0}")

            # If receiving image data, handle binary chunks
            if image_state["receiving"]:
                # Check if this might be a new image_start command (JSON)
                # This handles the case where user pressed send again
                is_new_command = False
                try:
                    test_str = raw.decode("utf-8").strip()
                    if test_str.startswith("{") and "cmd" in test_str:
                        print("Detected new command while receiving - resetting state")
                        image_state["receiving"] = False
                        image_state["data"] = bytearray()
                        image_state["prompt"] = ""
                        image_state["last_chunk_time"] = 0
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
                                image_state["last_chunk_time"] = 0
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
                        
                        # Check if complete
                        if len(image_state["data"]) >= image_state["expected_len"]:
                            print("Image complete! Rendering...")
                            # Truncate to expected length
                            image_state["data"] = image_state["data"][:image_state["expected_len"]]
                            # Render image to display with prompt text
                            render_image(
                                image_state["data"],
                                image_state["width"],
                                image_state["height"],
                                image_state["prompt"]
                            )
                            # Reset state
                            image_state["receiving"] = False
                            image_state["data"] = bytearray()
                            image_state["prompt"] = ""
                            image_state["last_chunk_time"] = 0
                    except Exception as e:
                        print("Image decode error:", e)
                        print(f"Error type: {type(e).__name__}")
                        image_state["receiving"] = False
                        image_state["data"] = bytearray()
                        image_state["prompt"] = ""
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
                    # ALWAYS reset state when receiving a new image_start
                    # This handles cases where previous transfer was incomplete
                    if image_state["receiving"]:
                        print("Warning: Cancelling previous incomplete transfer")
                    
                    # Completely reset all image state
                    image_state["receiving"] = True
                    image_state["width"] = msg.get("w", 0)
                    image_state["height"] = msg.get("h", 0)
                    image_state["expected_len"] = msg.get("len", 0)
                    image_state["prompt"] = msg.get("prompt", "")
                    image_state["data"] = bytearray()  # Fresh buffer
                    image_state["last_chunk_time"] = time.monotonic()
                    
                    # Validate the incoming parameters
                    if image_state["expected_len"] <= 0 or image_state["width"] <= 0 or image_state["height"] <= 0:
                        print(f"Invalid image params: w={image_state['width']}, h={image_state['height']}, len={image_state['expected_len']}")
                        image_state["receiving"] = False
                        set_text("Invalid image!", 0xFF0000)
                        continue
                    
                    print(f"Image start: {image_state['width']}x{image_state['height']}, {image_state['expected_len']} bytes")
                    if image_state["prompt"]:
                        print(f"Prompt: {image_state['prompt'][:50]}...")
                    print(f"Waiting for {image_state['expected_len']} bytes...")
                    set_text("Receiving...", 0xFFFF00)
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
    image_state["prompt"] = ""
    image_state["last_chunk_time"] = 0
    
    # Ensure advertising is stopped before restarting
    if is_advertising:
        try:
            ble.stop_advertising()
            is_advertising = False
            print("Stopped advertising (disconnected)")
        except Exception as e:
            print(f"Error stopping advertising on disconnect: {e}")
    
    # Small delay after disconnect before restarting advertising to ensure clean state
    time.sleep(0.5)
    # loop repeats, advertising will restart at the top
