"""Neon Bastion 앱 아이콘 (택티컬 홀로그램). 2배로 그린 뒤 1024 로 줄인다.  사용: python3 tools/make_icon.py 출력.png"""
import math, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 2048
C = S / 2
CYAN = (59, 227, 255)
AMBER = (255, 178, 36)
RED = (255, 77, 94)
LINE = (42, 74, 92)


def layer():
    return Image.new('RGB', (S, S), (0, 0, 0))


def glow(base, lay, radii=((60, 0.9), (20, 1.0)), keep=True):
    out = base
    for r, k in radii:
        g = lay.filter(ImageFilter.GaussianBlur(r))
        if k != 1:
            g = Image.eval(g, lambda v, k=k: int(v * k))
        out = ImageChops.screen(out, g)
    if keep:
        out = ImageChops.screen(out, lay)
    return out


def poly(cx, cy, r, n, rot):
    return [(cx + r * math.cos(rot + i * 2 * math.pi / n), cy + r * math.sin(rot + i * 2 * math.pi / n)) for i in range(n)]


# 배경: 중앙이 살짝 밝은 방사형 그라디언트
bg = Image.new('RGB', (S, S))
px = bg.load()
for y in range(0, S, 4):
    for x in range(0, S, 4):
        d = math.hypot(x - C, y - C * 0.96) / (S * 0.72)
        t = max(0.0, 1 - d)
        col = (int(4 + 14 * t * t), int(7 + 30 * t * t), int(11 + 40 * t * t))
        for yy in range(y, y + 4):
            for xx in range(x, x + 4):
                px[xx, yy] = col

# 격자 (가장자리로 갈수록 흐리게)
grid = layer()
gd = ImageDraw.Draw(grid)
step = S // 16
for i in range(17):
    v = i * step
    gd.line([(v, 0), (v, S)], fill=(18, 32, 42), width=3)
    gd.line([(0, v), (S, v)], fill=(18, 32, 42), width=3)
mask = Image.new('L', (S, S))
md = ImageDraw.Draw(mask)
for r in range(int(S * 0.75), 0, -16):
    md.ellipse([C - r, C - r, C + r, C + r], fill=int(255 * (1 - r / (S * 0.75)) ** 0.6))
bg = Image.composite(ImageChops.add(bg, grid), bg, mask)

# 레이더 링 · 눈금
radar = layer()
rd = ImageDraw.Draw(radar)
for r, w in ((900, 5), (690, 4), (470, 3)):
    rd.ellipse([C - r, C - r, C + r, C + r], outline=LINE, width=w)
for i in range(72):
    a = i * math.pi / 36
    major = i % 6 == 0
    r0, r1 = (870, 960) if major else (900, 940)
    col = CYAN if major else LINE
    rd.line([(C + r0 * math.cos(a), C + r0 * math.sin(a)), (C + r1 * math.cos(a), C + r1 * math.sin(a))], fill=col, width=10 if major else 5)
bg = ImageChops.add(bg, radar)

# 스윕 (오른쪽 위로 도는 부채꼴, 앞쪽 가장자리가 가장 밝음)
lead = -math.pi * 0.30
sweep = layer()
sd = ImageDraw.Draw(sweep)
span = math.radians(70)
steps = 70
for i in range(steps):
    a0 = lead - span * (i + 1) / steps
    a1 = lead - span * i / steps
    k = (1 - i / steps) ** 2.2
    col = tuple(int(c * 0.5 * k) for c in CYAN)
    sd.pieslice([C - 900, C - 900, C + 900, C + 900], math.degrees(a0), math.degrees(a1) + 0.4, fill=col)
bg = ImageChops.add(bg, sweep)
edge = layer()
ImageDraw.Draw(edge).line([(C, C), (C + 900 * math.cos(lead), C + 900 * math.sin(lead))], fill=CYAN, width=10)
bg = glow(bg, edge, ((24, 0.8),))

# 적 (붉은 마름모) + 락온 브래킷
enemies = [(C + 660 * math.cos(lead - 0.42), C + 660 * math.sin(lead - 0.42), 72, True),
           (C + 820 * math.cos(-math.pi * 0.62), C + 820 * math.sin(-math.pi * 0.62), 46, False),
           (C + 760 * math.cos(math.pi * 0.80), C + 760 * math.sin(math.pi * 0.80), 50, False),
           (C + 700 * math.cos(math.pi * 0.27), C + 700 * math.sin(math.pi * 0.27), 42, False)]
en = layer()
ed = ImageDraw.Draw(en)
for x, y, r, _ in enemies:
    ed.polygon(poly(x, y, r, 4, 0), outline=RED, width=14)
    ed.ellipse([x - r * 0.28, y - r * 0.28, x + r * 0.28, y + r * 0.28], fill=RED)
bg = glow(bg, en, ((34, 0.7), (10, 0.5)))

lx, ly, lr, _ = enemies[0]
lock = layer()
ld = ImageDraw.Draw(lock)
b, arm = lr + 46, 40
for sx in (-1, 1):
    for sy in (-1, 1):
        cx, cy = lx + sx * b, ly + sy * b
        ld.line([(cx, cy), (cx - sx * arm, cy)], fill=AMBER, width=12)
        ld.line([(cx, cy), (cx, cy - sy * arm)], fill=AMBER, width=12)
# 포탑 → 락온 대상 사격선
ang = math.atan2(ly - C, lx - C)
ld.line([(C + 330 * math.cos(ang), C + 330 * math.sin(ang)), (lx - (lr + 20) * math.cos(ang), ly - (lr + 20) * math.sin(ang))], fill=AMBER, width=12)
bg = glow(bg, lock, ((26, 0.6), (8, 0.4)))

# 코어: 채움은 글로우 없이 바탕에, 외곽선은 두 다각형 차이로 이음매 없이
R = 400
fill = layer()
ImageDraw.Draw(fill).polygon(poly(C, C, R, 6, math.pi / 6), fill=(7, 30, 40))
mask_hex = Image.new('L', (S, S))
ImageDraw.Draw(mask_hex).polygon(poly(C, C, R, 6, math.pi / 6), fill=255)
bg = Image.composite(fill, bg, mask_hex)
core = layer()
cd = ImageDraw.Draw(core)
cd.polygon(poly(C, C, R + 26, 6, math.pi / 6), fill=CYAN)
cd.polygon(poly(C, C, R - 26, 6, math.pi / 6), fill=(0, 0, 0))
cd.ellipse([C - 232, C - 232, C + 232, C + 232], outline=CYAN, width=30)
bw = 66
p1 = (C + 150 * math.cos(ang), C + 150 * math.sin(ang))
p2 = (C + 350 * math.cos(ang), C + 350 * math.sin(ang))
nx, ny = -math.sin(ang) * bw / 2, math.cos(ang) * bw / 2
cd.polygon([(p1[0] + nx, p1[1] + ny), (p2[0] + nx, p2[1] + ny), (p2[0] - nx, p2[1] - ny), (p1[0] - nx, p1[1] - ny)], fill=(200, 244, 255))
cd.ellipse([C - 112, C - 112, C + 112, C + 112], fill=(150, 236, 255))
cd.ellipse([C - 64, C - 64, C + 64, C + 64], fill=(236, 252, 255))
bg = glow(bg, core, ((140, 0.45), (50, 0.6), (14, 0.5)))

# 육각형 안쪽 하이라이트(살짝 밝은 띠)
hl = layer()
ImageDraw.Draw(hl).line(poly(C, C, R - 46, 6, math.pi / 6) + [poly(C, C, R - 46, 6, math.pi / 6)[0]], fill=(20, 70, 84), width=8)
bg = ImageChops.add(bg, hl)

out = bg.resize((1024, 1024), Image.LANCZOS)
out.save(sys.argv[1] if len(sys.argv) > 1 else 'icon.png')
