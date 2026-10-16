#!/usr/bin/env python3
"""Frame the plain 1080x1920 Play screenshots with a headline band.

    python3 scripts/play-screenshot-frames.py

Input : marketing/play/screenshots/<locale>/0N-*.png (plain phone captures)
Output: marketing/play/screenshots/framed/<locale>/0N-*.png (1080x1920)
Spec  : docs/aso/SCREENSHOT_DESIGN_SPEC.md. Brand colours come from
src/app/(site)/site.css (--s-brand dark-theme value for the band). Font: Arial
Bold from macOS (Manrope is not installed locally; swap FONT if it is).
Only Pillow is needed (already installed on this machine).
"""
import glob, os, re, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'marketing', 'play', 'screenshots')
OUT = os.path.join(SRC, 'framed')
W, H = 1080, 1920
BAND_H = 470
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
FONT_REG = '/System/Library/Fonts/Supplemental/Arial.ttf'

def css_rgb(var, dark=False):
    css = open(os.path.join(ROOT, 'src', 'app', '(site)', 'site.css'), encoding='utf-8').read()
    hits = re.findall(rf'{re.escape(var)}:\s*(\d+)\s+(\d+)\s+(\d+)', css)
    r, g, b = hits[1] if dark and len(hits) > 1 else hits[0]
    return (int(r), int(g), int(b))

BAND = css_rgb('--s-bg', dark=True)        # 14 19 17 — dark surface
ACCENT = css_rgb('--s-brand', dark=True)   # 22 122 79 — brand green
INK = (255, 255, 255)
MUTED = (200, 210, 204)

COPY = {
  'en': {
    '01': ('Match probabilities,\nbefore kick-off', '1X2, over/under and BTTS for 11 leagues'),
    '02': ('A public track record', 'Every prediction settled, wins and losses alike'),
    '03': ('Tables, form and\nhead-to-head', 'Context for every fixture'),
    '04': ('How the model works', 'Dixon-Coles, calibrated against real results'),
  },
  'tr': {
    '01': ('Maç öncesi olasılıklar', '11 ligde 1X2, alt/üst ve karşılıklı gol'),
    '02': ('Herkese açık karne', 'Her tahmin sonuçlanır, tutan da tutmayan da'),
    '03': ('Puan durumu, form ve\ngeçmiş maçlar', 'Her maç için bağlam'),
    '04': ('Model nasıl çalışır', 'Dixon-Coles, gerçek sonuçlara göre kalibre'),
  },
}

def frame(src, head, sub, dst):
    shot = Image.open(src).convert('RGB')
    canvas = Image.new('RGB', (W, H), BAND)
    d = ImageDraw.Draw(canvas)
    # accent rule under the band
    d.rectangle([0, BAND_H - 6, W, BAND_H], fill=ACCENT)
    f_head = ImageFont.truetype(FONT, 70)
    f_sub = ImageFont.truetype(FONT_REG, 36)
    y = 120
    for line in head.split('\n'):
        d.text((72, y), line, font=f_head, fill=INK)
        y += 84
    d.text((72, y + 14), sub, font=f_sub, fill=MUTED)
    # phone-ish card: screenshot scaled to 936px wide, rounded, cut at the bottom edge
    sw = 936
    sh = round(shot.height * sw / shot.width)
    card = shot.resize((sw, sh), Image.LANCZOS)
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=36, fill=255)
    x0, y0 = (W - sw) // 2, BAND_H + 60
    # subtle border
    d.rounded_rectangle([x0 - 3, y0 - 3, x0 + sw + 2, y0 + sh + 2], radius=39, fill=(60, 72, 66))
    canvas.paste(card, (x0, y0), mask)
    canvas = canvas.crop((0, 0, W, H))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    canvas.save(dst, optimize=True)
    return dst

def main():
    n = 0
    for loc, items in COPY.items():
        for num, (head, sub) in items.items():
            srcs = sorted(glob.glob(os.path.join(SRC, loc, f'{num}-*.png')))
            if not srcs:
                print(f'skip {loc}/{num}: no source screenshot'); continue
            dst = os.path.join(OUT, loc, os.path.basename(srcs[0]))
            print('wrote', os.path.relpath(frame(srcs[0], head, sub, dst), ROOT)); n += 1
    print(f'{n} framed screenshots')

if __name__ == '__main__':
    sys.exit(main())
