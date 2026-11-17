from PIL import Image, ImageDraw, ImageFont
import sys
DATE=sys.argv[1] if len(sys.argv)>1 else '1 November 2026'
W,H=1080,1920
BG=(11,18,32); CREAM=(246,242,234); RED=(196,52,38); MUTED=(160,170,190)
def font(path,size,wght=None):
    f=ImageFont.truetype(path,size)
    if wght:
        try: f.set_variation_by_axes([wght,100])
        except Exception as e: print('axes fail',path,e)
    return f
A='fonts/Archivo.ttf'; P='fonts/IBMPlexSans-Regular.ttf'
def base():
    im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
    # subtle vertical gradient
    for y in range(H):
        t=y/H; c=(int(11+8*t),int(18+10*t),int(32+18*t)); d.line([(0,y),(W,y)],fill=c)
    return im,ImageDraw.Draw(im)
def center(d,y,txt,f,fill):
    w=d.textlength(txt,font=f); d.text(((W-w)/2,y),txt,font=f,fill=fill)
# title
im,d=base()
center(d,640,'WEEKLY CHECK-IN',font(P,44,500),RED)
center(d,720,'Football',font(A,150,800),CREAM)
center(d,870,'Analytics Pro',font(A,150,800),CREAM)
center(d,1080,'Model record · '+DATE,font(P,46,400),MUTED)
d.rounded_rectangle([390,1180,690,1188],radius=4,fill=RED)
im.save('title.png')
# end
im,d=base()
center(d,560,'TODAY’S PICKS ARE LIVE',font(P,44,500),RED)
center(d,650,'footballanalytics.pro',font(A,92,800),CREAM)
center(d,800,'Link in bio',font(P,50,400),MUTED)
d.rounded_rectangle([390,900,690,908],radius=4,fill=RED)
center(d,980,'Free daily picks on Telegram',font(P,50,400),MUTED)
center(d,1060,'t.me/fanalytics_pro',font(A,84,800),CREAM)
center(d,1260,'Measured record · no odds · analytics only',font(P,36,400),(110,120,140))
im.save('end.png')
print('ok')
