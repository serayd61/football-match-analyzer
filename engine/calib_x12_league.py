"""Lig bazlı 1X2 sıcaklık (temperature) kalibrasyonu + kısmi havuzlama ölçümü (2026-11-22).
Girdi: engine_predictions tablosundan dc-1.0 sonuçlanmış satırların JSON dökümü
(fixture_id, league_id, league_name, kickoff, p_home, p_draw, p_away, result H/D/A).
Rapor: reports/backtest-x12-league-calib.md — sonuç NEGATİF, motora alınmadı."""
"""1X2 lig bazlı sıcaklık kalibrasyonu + kısmi havuzlama (adım 3 ön çalışma).
p'_i ∝ p_i^t ; t<1 düzleştirir (aşırı güven), t>1 keskinleştirir. t_L = (n_L·t̂_L + k·t̂_g)/(n_L+k).
Zaman ayrımı: ilk %70 fit, son %30 test (lig başına ve toplam log-loss)."""
import json, math, collections, sys
rows=json.load(open('data/dc10_settled.json'))
ALIAS={938218:1000001801,916561:916561}
for r in rows:
    r['league_id']=ALIAS.get(r['league_id'],r['league_id'])
    if r['league_id']==1000001801: r['league_name']='Championship'
rows=[r for r in rows if r['result'] in ('H','D','A') and r['p_home'] and r['p_draw'] and r['p_away']]
rows.sort(key=lambda r:r['kickoff'])
def probs(r): return [float(r['p_home']),float(r['p_draw']),float(r['p_away'])]
IDX={'H':0,'D':1,'A':2}
def temp(p,t):
    q=[max(x,1e-6)**t for x in p]; s=sum(q); return [x/s for x in q]
def ll(rows,t):
    return sum(-math.log(max(temp(probs(r),t)[IDX[r['result']]],1e-12)) for r in rows)/max(len(rows),1)
def fit_t(rows, lo=0.2, hi=2.0):
    # 1-D golden section on log-loss
    gr=(math.sqrt(5)-1)/2
    a,b=lo,hi; c=b-gr*(b-a); d=a+gr*(b-a)
    for _ in range(40):
        if ll(rows,c)<ll(rows,d): b=d
        else: a=c
        c=b-gr*(b-a); d=a+gr*(b-a)
    return (a+b)/2
n=len(rows); cut=int(n*0.7); tr=rows[:cut]; te=rows[cut:]
print(f'rows {n} | train {len(tr)} (to {tr[-1]["kickoff"][:10]}) | test {len(te)} (from {te[0]["kickoff"][:10]})')
tg=fit_t(tr); print(f'global t = {tg:.3f} | train LL raw {ll(tr,1.0):.4f} → {ll(tr,tg):.4f} | test LL raw {ll(te,1.0):.4f} → global {ll(te,tg):.4f}')
byL=collections.defaultdict(list)
for r in tr: byL[r['league_id']].append(r)
tL={L:fit_t(v) for L,v in byL.items() if len(v)>=40}
nL={L:len(v) for L,v in byL.items()}
def pooled(L,k):
    if L not in tL: return tg
    return (nL[L]*tL[L]+k*tg)/(nL[L]+k)
print('\nk sweep (test LL, all leagues):')
best=None
for k in (0,50,100,200,400,800,1e9):
    v=sum(-math.log(max(temp(probs(r),pooled(r['league_id'],k))[IDX[r['result']]],1e-12)) for r in te)/len(te)
    print(f'  k={k:>6}: {v:.4f}')
    if best is None or v<best[1]: best=(k,v)
print('best k', best)
k=200
print(f'\nper-league (train n≥100), k={k}: t_raw → t_pooled, test n, test LL raw → global → pooled')
names={r['league_id']:r['league_name'] for r in rows}
teL=collections.defaultdict(list)
for r in te: teL[r['league_id']].append(r)
out=[]
for L,v in sorted(byL.items(), key=lambda kv:-len(kv[1])):
    if len(v)<100 or L not in teL: continue
    t=teL[L]; raw=ll(t,1.0); g=ll(t,tg); p=ll(t,pooled(L,k))
    out.append((names[L],L,len(v),tL.get(L,float('nan')),pooled(L,k),len(t),raw,g,p))
for o in out[:25]:
    print(f'  {o[0][:26]:26s} {o[1]:>8} n={o[2]:4d} t={o[3]:.2f}→{o[4]:.2f} | test n={o[5]:3d} LL {o[6]:.4f} → {o[7]:.4f} → {o[8]:.4f}')
ch=[o for o in out if 'hampionship' in o[0]]
print('\nChampionship rows:', [(o[0],o[1],o[2],round(o[3],2),round(o[4],2)) for o in ch])
# how many leagues improved with pooled vs global on test
imp=sum(1 for o in out if o[8]<o[7]); print(f'\npooled beats global in {imp}/{len(out)} leagues (test)')
json.dump({'t_global':tg,'k':k,'leagues':{str(L):pooled(L,k) for L in tL}}, open('calib_x12_fit.json','w'), indent=1)
