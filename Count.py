import time
import board
import terminalio
import displayio
from adafruit_display_text import label

display = board.DISPLAY
display.rotation = 0

splash = displayio.Group()
display.root_group = splash

# Background color
color_bitmap = displayio.Bitmap(display.width, display.height, 1)
color_palette = displayio.Palette(1)
color_palette[0] = 0x000000  # black
bg_sprite = displayio.TileGrid(color_bitmap, pixel_shader=color_palette)
splash.append(bg_sprite)

# Create text label
text_area = label.Label(
    terminalio.FONT,
    text="Hello World!",
    color=0xFFFFFF,
    x=10,
    y=40,
)
splash.append(text_area)

# Dynamically update text
count = 0
while True:
    count += 1
    text_area.text = f"Count: {count}"
    time.sleep(1)
