#!/usr/bin/env python3
"""
Generate all logo, icon, favicon, and splash screen assets from a source image.

Usage:
    python3 apps/web/scripts/generate-icons.py [source_image]

    source_image: Path to source PNG (default: apps/web/public/{{name}}.png)

Requirements:
    pip install Pillow
"""

import os
import sys
from collections import Counter
from PIL import Image

# Defaults
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "public"))
DEFAULT_SRC = os.path.join(PUBLIC, "{{name}}.png")
ICONS = os.path.join(PUBLIC, "icons")
SPLASH = os.path.join(PUBLIC, "splash")

def detect_primary_color(img):
    """Detect the most common non-white, non-transparent color in the image."""
    pixels = list(img.getdata())
    # Filter out near-white (R,G,B all > 200) and transparent pixels
    colored = [
        (r, g, b)
        for r, g, b, a in pixels
        if a > 128 and not (r > 200 and g > 200 and b > 200)
    ]
    if not colored:
        return (26, 42, 74)  # fallback
    most_common = Counter(colored).most_common(1)[0][0]
    return most_common


def make_white_version(img):
    """Convert all non-transparent pixels to white."""
    white_img = img.copy()
    data = white_img.getdata()
    new_data = []
    for r, g, b, a in data:
        if a > 0:
            new_data.append((255, 255, 255, a))
        else:
            new_data.append((0, 0, 0, 0))
    white_img.putdata(new_data)
    return white_img


def resize_and_save(src_img, size, path, fmt="PNG"):
    resized = src_img.resize((size, size), Image.LANCZOS)
    if fmt == "WEBP":
        resized.save(path, "WEBP", quality=90)
    else:
        resized.save(path, fmt)
    print(f"  Created: {os.path.basename(path)} ({size}x{size})")


def make_maskable(src_img, size, path, bg_color):
    """Create maskable icon: logo at 80% with background fill for safe zone."""
    canvas = Image.new("RGBA", (size, size), bg_color + (255,))
    logo_size = int(size * 0.8)
    logo = src_img.resize((logo_size, logo_size), Image.LANCZOS)
    offset = (size - logo_size) // 2
    canvas.paste(logo, (offset, offset), logo)
    canvas.save(path, "PNG")
    print(f"  Created: {os.path.basename(path)} ({size}x{size}, maskable)")


def make_splash(white_img, width, height, path, bg_color):
    """Create splash screen: white logo centered on primary color background."""
    canvas = Image.new("RGBA", (width, height), bg_color + (255,))
    logo_size = int(min(width, height) * 0.3)
    logo = white_img.resize((logo_size, logo_size), Image.LANCZOS)
    x = (width - logo_size) // 2
    y = (height - logo_size) // 2
    canvas.paste(logo, (x, y), logo)
    canvas.save(path, "PNG")
    print(f"  Created: {os.path.basename(path)} ({width}x{height})")


def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC

    if not os.path.exists(src_path):
        print(f"Error: Source image not found: {src_path}")
        sys.exit(1)

    print(f"Source: {src_path}\n")
    img = Image.open(src_path).convert("RGBA")

    # The icons/ and splash/ subdirectories are outputs, not inputs: on a clean
    # checkout they do not exist yet and Pillow will not create them, so every
    # write below fails with FileNotFoundError.
    os.makedirs(ICONS, exist_ok=True)
    os.makedirs(SPLASH, exist_ok=True)

    # Detect primary color and create white version for splash screens
    primary_color = detect_primary_color(img)
    print(f"Detected primary color: RGB{primary_color}")
    white_img = make_white_version(img)

    # 1. Main logo.webp
    print("\n=== Main Logo ===")
    resize_and_save(img, 630, os.path.join(PUBLIC, "logo.webp"), "WEBP")

    # 2. Favicon.ico (multi-size)
    print("\n=== Favicon ===")
    sizes_ico = [16, 32, 48]
    ico_images = [img.resize((s, s), Image.LANCZOS) for s in sizes_ico]
    ico_path = os.path.join(PUBLIC, "favicon.ico")
    ico_images[0].save(
        ico_path, "ICO",
        sizes=[(s, s) for s in sizes_ico],
        append_images=ico_images[1:],
    )
    print(f"  Created: favicon.ico (multi-size: {sizes_ico})")

    # 3. Standard icons
    print("\n=== Standard Icons ===")
    standard_icons = {
        "favicon-96x96.png": 96,
        "apple-touch-icon.png": 180,
        "web-app-manifest-72x72.png": 72,
        "web-app-manifest-96x96.png": 96,
        "web-app-manifest-128x128.png": 128,
        "web-app-manifest-144x144.png": 144,
        "web-app-manifest-152x152.png": 152,
        "web-app-manifest-192x192.png": 192,
        "web-app-manifest-384x384.png": 384,
        "web-app-manifest-512x512.png": 512,
    }
    for name, size in standard_icons.items():
        resize_and_save(img, size, os.path.join(ICONS, name))

    # 4. Maskable icons
    print("\n=== Maskable Icons ===")
    make_maskable(img, 192, os.path.join(ICONS, "web-app-manifest-192x192-maskable.png"), primary_color)
    make_maskable(img, 512, os.path.join(ICONS, "web-app-manifest-512x512-maskable.png"), primary_color)

    # 5. Splash screens
    print("\n=== Splash Screens ===")
    splashes = [
        (640, 1136, "apple-splash-640x1136.png"),
        (750, 1334, "apple-splash-750x1334.png"),
        (1242, 2208, "apple-splash-1242x2208.png"),
        (1125, 2436, "apple-splash-1125x2436.png"),
        (1284, 2778, "apple-splash-1284x2778.png"),
    ]
    for w, h, name in splashes:
        make_splash(white_img, w, h, os.path.join(SPLASH, name), primary_color)

    print("\nDone! All assets generated.")


if __name__ == "__main__":
    main()
