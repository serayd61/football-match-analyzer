from PIL import Image, ImageDraw, ImageFont
import sys, json
# usage: today_card.py picks.json  -> [{league,time,match,pick,prob}] ; optional 2nd arg date label, 3rd arg record line
ARGS=sys.argv[1:]
DATE=(ARGS[1] if len(ARGS)>1 else '1 November').upper()
RECORD=ARGS[2] if len(ARGS)>2 else 'Measured double-chance record: 77.7% on 23,060 matches'
W,H=1080,1350
CREAM=(246,242,234); INK=(22,24,28); RED=(196,52,38); MUTED=(120,124,132); LINE=(215,210,200)
A='fonts/Archivo.ttf'; P='fonts/IBMPlexSans-Regular.ttf'
def f(path,size,w=None):
    ft=ImageFont.truetype(path,size)
    if w:
        try: ft.set_variation_by_axes([w,100])
        except Exception as e: print('axes fail',path,e)
    return ft
picks=[(p.get('league',''),p.get('time',''),p['match'],p['pick'],p.get('prob','')) for p in json.load(open(ARGS[0]))][:5] if ARGS else [("Eliteserien","14:30","Brann – Molde","BTTS Yes","75%"),("1. Divisjon","17:00","Strømsgodset – Moss","Over 2.5","79%"),("1. Divisjon","17:00","Åsane – FK Haugesund","Over 2.5","80%")]
im=Image.new('RGB',(W,H),CREAM); d=ImageDraw.Draw(im)
d.text((70,70),DATE+" · MODEL PICKS",font=f(P,26,500),fill=RED)
d.text((70,110),"Today's picks",font=f(A,76,800),fill=INK)
d.text((70,205),"Selection rule fixed before kick-off · results posted tomorrow",font=f(P,28),fill=MUTED)
d.line([(70,265),(W-70,265)],fill=INK,width=3)
y=300
for lg,t,m,pick,prob in picks:
    d.text((70,y),lg,font=f(P,26),fill=MUTED); tw=d.textlength(t,font=f(P,26)); d.text((W-70-tw,y),t,font=f(P,26),fill=MUTED)
    d.text((70,y+40),m,font=f(A,50,700),fill=INK)
    d.text((70,y+110),pick,font=f(A,42,700),fill=RED)
    lab=("model "+prob) if prob else ""; lw=d.textlength(lab,font=f(P,34,500)); d.text((W-70-lw,y+116),lab,font=f(P,34,500),fill=INK)
    y+=185; d.line([(70,y-10),(W-70,y-10)],fill=LINE,width=2)
d.text((70,H-180),RECORD,font=f(P,28),fill=MUTED)
d.text((70,H-130),"Free daily picks on Telegram · t.me/fanalytics_pro",font=f(P,28),fill=MUTED)
d.text((70,H-80),"footballanalytics.pro",font=f(A,34,800),fill=INK)
im.save('today-en.png'); print('ok')
