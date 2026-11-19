"""
Generates 5 botanically realistic sample PNGs in backend/samples/ for instant
1-click Edge-CV testing (Healthy, Late Blight, Powdery Mildew, Apple Scab/Rust,
and Yellow Sticky Trap with Pests).
"""

import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "samples")


def _draw_base_leaf(seed: int = 42):
    rng = random.Random(seed)
    w, h = 480, 360
    img = Image.new("RGB", (w, h), (22, 28, 24))
    draw = ImageDraw.Draw(img)

    # Subtle soil/greenhouse background bokeh
    for _ in range(45):
        bx = rng.randint(0, w)
        by = rng.randint(0, h)
        br = rng.randint(12, 48)
        c = rng.randint(18, 36)
        draw.ellipse([bx - br, by - br, bx + br, by + br], fill=(c, c + 6, c + 2))
    img = img.filter(ImageFilter.GaussianBlur(8))
    draw = ImageDraw.Draw(img)

    # Leaf polygon (organic pointed ovate leaf)
    cx, cy = w // 2, h // 2
    pts = []
    steps = 72
    for i in range(steps):
        ang = (2 * math.pi * i) / steps
        # Pointed tip at right, stem base at left
        rx = 185
        ry = 112 * (0.82 + 0.25 * math.sin(ang + math.pi / 2))
        x = cx + rx * math.cos(ang)
        y = cy + ry * math.sin(ang) * (1.0 - 0.28 * max(0.0, math.cos(ang)))
        pts.append((x, y))

    # Stem
    draw.line([(cx - 215, cy + 8), (cx - 170, cy)], fill=(65, 118, 52), width=10)
    # Leaf body
    draw.polygon(pts, fill=(44, 134, 58))

    # Organic surface texture / chlorophyll mottling
    for _ in range(380):
        px = rng.randint(cx - 165, cx + 165)
        py = rng.randint(cy - 90, cy + 90)
        if ((px - cx) / 170.0) ** 2 + ((py - cy) / 95.0) ** 2 < 0.88:
            r = rng.randint(4, 16)
            g_col = rng.randint(118, 154)
            draw.ellipse([px - r, py - r, px + r, py + r], fill=(rng.randint(36, 56), g_col, rng.randint(42, 62)))

    # Midrib and lateral veins
    draw.line([(cx - 175, cy), (cx + 165, cy - 2)], fill=(96, 172, 86), width=5)
    for vx in range(-120, 125, 36):
        draw.line([(cx + vx, cy), (cx + vx + 38, cy - 68)], fill=(86, 160, 78), width=2)
        draw.line([(cx + vx, cy), (cx + vx + 36, cy + 68)], fill=(86, 160, 78), width=2)

    return img, draw, rng


def generate_all_samples() -> None:
    os.makedirs(SAMPLES_DIR, exist_ok=True)

    # 1. Healthy leaf
    img, _, _ = _draw_base_leaf(seed=101)
    img.save(os.path.join(SAMPLES_DIR, "healthy.png"))

    # 2. Late Blight (Фитофтороз — dark necrotic lesions with chlorotic rim)
    img, draw, rng = _draw_base_leaf(seed=202)
    blight_spots = [(195, 145, 34), (275, 205, 42), (320, 135, 28), (155, 210, 24)]
    for sx, sy, sr in blight_spots:
        # Pale yellow halo
        draw.ellipse([sx - sr - 7, sy - sr - 5, sx + sr + 7, sy + sr + 5], fill=(142, 148, 62))
        # Dark water-soaked necrotic core
        for _ in range(18):
            ox = rng.randint(-sr // 2, sr // 2)
            oy = rng.randint(-sr // 2, sr // 2)
            rr = rng.randint(sr // 3, int(sr * 0.72))
            draw.ellipse(
                [sx + ox - rr, sy + oy - rr, sx + ox + rr, sy + oy + rr],
                fill=(rng.randint(32, 54), rng.randint(24, 38), rng.randint(18, 28)),
            )
    img.save(os.path.join(SAMPLES_DIR, "late_blight.png"))

    # 3. Powdery Mildew (Мучнистая роса — white powdery mycelium colonies)
    img, draw, rng = _draw_base_leaf(seed=303)
    mildew_patches = [(180, 155, 34), (255, 130, 38), (300, 205, 36), (215, 220, 26)]
    for sx, sy, sr in mildew_patches:
        for _ in range(36):
            ox = rng.randint(-sr, sr)
            oy = rng.randint(-sr, sr)
            if ox * ox + oy * oy <= sr * sr:
                rr = rng.randint(4, 13)
                v = rng.randint(218, 248)
                draw.ellipse([sx + ox - rr, sy + oy - rr, sx + ox + rr, sy + oy + rr], fill=(v, v, v - 6))
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    img.save(os.path.join(SAMPLES_DIR, "powdery_mildew.png"))

    # 4. Apple Scab / Rust (Парша / Ржавчина — ochre-orange rust pustules)
    img, draw, rng = _draw_base_leaf(seed=404)
    rust_spots = [
        (170, 150, 20), (225, 132, 24), (265, 178, 26),
        (315, 150, 21), (205, 215, 22), (288, 220, 18), (145, 195, 17),
    ]
    for sx, sy, sr in rust_spots:
        draw.ellipse([sx - sr - 4, sy - sr - 4, sx + sr + 4, sy + sr + 4], fill=(196, 152, 46))
        draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(184, 96, 26))
        draw.ellipse([sx - sr // 2, sy - sr // 2, sx + sr // 2, sy + sr // 2], fill=(138, 62, 18))
    img.save(os.path.join(SAMPLES_DIR, "scab_rust.png"))

    # 5. Yellow Sticky Trap with Pests (Жёлтая клеевая ловушка с тлёй/белокрылкой)
    rng = random.Random(505)
    w, h = 480, 360
    img = Image.new("RGB", (w, h), (35, 58, 38))
    draw = ImageDraw.Draw(img)
    # Bright yellow sticky card
    draw.rounded_rectangle([38, 26, w - 38, h - 26], radius=16, fill=(246, 206, 28), outline=(218, 175, 18), width=4)
    # Measurement grid on trap
    for gx in range(78, w - 50, 48):
        draw.line([(gx, 34), (gx, h - 34)], fill=(232, 188, 22), width=1)
    for gy in range(66, h - 40, 48):
        draw.line([(46, gy), (w - 46, gy)], fill=(232, 188, 22), width=1)
    # Mounting hole at top
    draw.ellipse([w // 2 - 10, 38, w // 2 + 10, 58], fill=(35, 58, 38))
    # Dark insects / aphid clusters stuck on trap
    clusters = [(145, 125), (275, 165), (335, 240), (190, 255)]
    for cx, cy in clusters:
        for _ in range(7):
            ix = cx + rng.randint(-28, 28)
            iy = cy + rng.randint(-22, 22)
            rx = rng.randint(5, 9)
            ry = rng.randint(3, 6)
            draw.ellipse([ix - rx, iy - ry, ix + rx, iy + ry], fill=(28, 24, 22))
            # Tiny wings
            draw.ellipse([ix - rx - 3, iy - ry - 3, ix, iy], fill=(82, 74, 60))
    img.save(os.path.join(SAMPLES_DIR, "sticky_trap_pests.png"))


if __name__ == "__main__":
    generate_all_samples()
    print(f"Generated 5 samples in {SAMPLES_DIR}")
