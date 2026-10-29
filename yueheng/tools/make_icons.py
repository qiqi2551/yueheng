# -*- coding: utf-8 -*-
"""生成月衡的图标（渐变底 + 三根上升的柱子）。"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
os.makedirs(OUT, exist_ok=True)

SS = 4  # 超采样倍数，缩小后边缘更顺

TOP = (109, 139, 255)
BOTTOM = (47, 73, 214)


def gradient(size):
    img = Image.new("RGB", (size, size), BOTTOM)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        # 用一点缓动，让上亮下暗过渡更自然
        t = t ** 0.85
        c = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)
    return img


def draw_mark(img, scale=1.0):
    """在正方形画布中间画三根柱子，scale 控制占画布的比例。"""
    size = img.size[0]
    d = ImageDraw.Draw(img)

    bar_w = size * 0.105 * scale
    gap = size * 0.072 * scale
    total = bar_w * 3 + gap * 2
    left = (size - total) / 2
    bottom = size * 0.5 + size * 0.185 * scale
    radius = bar_w * 0.34

    heights = [0.5, 0.71, 0.92]
    for i, h in enumerate(heights):
        hh = size * 0.235 * scale * h * 2
        x0 = left + i * (bar_w + gap)
        y0 = bottom - hh
        d.rounded_rectangle([x0, y0, x0 + bar_w, bottom], radius=radius, fill=(255, 255, 255, 255))


def make(size, maskable=False, path=None):
    S = size * SS
    img = gradient(S).convert("RGBA")
    draw_mark(img, scale=0.62 if maskable else 1.0)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path, "PNG", optimize=True)
    return path


if __name__ == "__main__":
    make(180, False, os.path.join(OUT, "icon-180.png"))
    make(192, False, os.path.join(OUT, "icon-192.png"))
    make(512, False, os.path.join(OUT, "icon-512.png"))
    make(512, True, os.path.join(OUT, "icon-maskable-512.png"))
    print("ok")
