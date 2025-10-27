import time
import board
import digitalio

led = digitalio.DigitalInOut(getattr(board, "LED", board.NEOPIXEL))  # NeoPixel for LED
led.direction = digitalio.Direction.OUTPUT
power = digitalio.DigitalInOut(board.NEOPIXEL_POWER)
power.direction = digitalio.Direction.OUTPUT # set the power pin to output
while True:
    power.value = True
    led.value = True
    time.sleep(5)
    led.value = False
    time.sleep(0.5)
