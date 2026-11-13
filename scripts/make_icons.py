"""Generate PWA icons: emerald rounded square with a white container + wrench glyph."""
from PIL import Image, ImageDraw, ImageFont

EMERALD = (4, 120, 87, 255)
WHITE = (255, 255, 255, 255)

def make_icon(size, path, maskable=False):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # background rounded square (full bleed for maskable)
    if maskable:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=EMERALD)
        pad = int(size * 0.10)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=EMERALD)
        pad = int(size * 0.16)
    s = size - 2 * pad
    # container body (white rounded rect)
    body_w, body_h = int(s * 0.72), int(s * 0.52)
    x0, y0 = pad + (s - body_w) // 2, pad + (s - body_h) // 2
    d.rounded_rectangle([x0, y0, x0 + body_w, y0 + body_h], radius=int(body_w * 0.10), fill=WHITE)
    # door split line + vents
    mid = x0 + body_w // 2
    d.line([mid, y0 + int(body_h * 0.08), mid, y0 + body_h - int(body_h * 0.08)], fill=EMERALD, width=max(2, size // 64))
    for fx in (0.22, 0.36, 0.64, 0.78):
        xx = x0 + int(body_w * fx)
        d.line([xx, y0 + int(body_h * 0.22), xx, y0 + int(body_h * 0.78)], fill=EMERALD, width=max(2, size // 80))
    img.save(path)
    print('saved', path)

import os
os.makedirs('/home/z/my-project/public/icons', exist_ok=True)
make_icon(192, '/home/z/my-project/public/icons/icon-192.png')
make_icon(512, '/home/z/my-project/public/icons/icon-512.png')
make_icon(512, '/home/z/my-project/public/icons/icon-maskable-512.png', maskable=True)
