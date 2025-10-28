import time, board, terminalio, displayio
from adafruit_display_text import label

import analogio
pot = analogio.AnalogIn(board.A1)

display = board.DISPLAY
group = displayio.Group()
text = label.Label(terminalio.FONT, text="Pot: --%", scale=3, x=10, y=40)
group.append(text)
display.root_group = group

while True:
    pct = int((pot.value / 65535) * 100)
    text.text = f"Pot: {pct}%"
    time.sleep(0.05)
