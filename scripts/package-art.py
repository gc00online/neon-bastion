# Rebuild platform icons and splash screens from the approved pot sprite.
# Requires Python 3 and Pillow.
from pathlib import Path
from PIL import Image, ImageDraw
r=Path(__file__).resolve().parents[1]
pot=Image.open(r/'public/art/pot.png').convert('RGBA')
def icon(size, foreground=False):
    im=Image.new('RGBA',(size,size),(0,0,0,0) if foreground else '#f4d5a0')
    a=pot.resize((int(size*.78),int(size*.78)),Image.Resampling.LANCZOS)
    im.alpha_composite(a,((size-a.width)//2,(size-a.height)//2))
    return im
for name,n in [('icon-512.png',512),('icon-192.png',192),('apple-touch-icon.png',180)]: icon(n).convert('RGB').save(r/'public'/name)
icon(1024).convert('RGB').save(r/'assets/icon-only.png')
icon(1024,True).save(r/'assets/icon-foreground.png')
Image.new('RGB',(1024,1024),'#f4d5a0').save(r/'assets/icon-background.png')
for p in (r/'android/app/src/main/res').glob('mipmap-*/*.png'):
    with Image.open(p) as old: n=old.width
    im=Image.new('RGBA',(n,n),'#f4d5a0') if 'background' in p.name else icon(n,'foreground' in p.name)
    im.save(p)
p=r/'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';icon(1024).convert('RGB').save(p)
paths=list((r/'android/app/src/main/res').glob('drawable*/splash.png'))+list((r/'ios/App/App/Assets.xcassets/Splash.imageset').glob('*.png'))+[r/'assets/splash.png',r/'assets/splash-dark.png']
for p in paths:
    with Image.open(p) as old: w,h=old.size
    im=Image.new('RGBA',(w,h),'#191822');n=int(min(w,h)*.24);a=pot.resize((n,n),Image.Resampling.LANCZOS);im.alpha_composite(a,((w-n)//2,(h-n)//2));im.convert('RGB').save(p)
