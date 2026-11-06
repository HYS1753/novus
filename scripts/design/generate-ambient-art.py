#!/usr/bin/env python3
"""Generates the bundled ambient artwork (src/assets/ambient/*.jpg).

Usage: python3 scripts/design/generate-ambient-art.py <out-dir>   # writes PNGs
Then:  sips -s format jpeg -s formatOptions 70 <png> --out src/assets/ambient/<name>.jpg
Requires numpy. Each scene is deterministic for its name.
"""
import numpy as np, zlib, struct, sys, os
W,H=1600,1000
out=sys.argv[1]
def png(path, img):
    a=(np.clip(img,0,1)*255+0.5).astype(np.uint8)
    raw=b''.join(b'\x00'+a[y].tobytes() for y in range(a.shape[0]))
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',a.shape[1],a.shape[0],8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,6))+chunk(b'IEND',b'')
    open(path,'wb').write(data)
def up(g, h, w):
    gh,gw=g.shape
    ys=np.linspace(0,gh-1.001,h); xs=np.linspace(0,gw-1.001,w)
    y0=ys.astype(int); x0=xs.astype(int); fy=(ys-y0)[:,None]; fx=(xs-x0)[None,:]
    fy=fy*fy*(3-2*fy); fx=fx*fx*(3-2*fx)
    a=g[y0][:,x0]; b=g[y0][:,x0+1]; c=g[y0+1][:,x0]; d=g[y0+1][:,x0+1]
    return a*(1-fx)*(1-fy)+b*fx*(1-fy)+c*(1-fx)*fy+d*fx*fy
def fbm(h,w,base,oct,rng,stretch=1.0):
    acc=np.zeros((h,w)); amp=1; tot=0
    for o in range(oct):
        gy=max(2,int(base*(2**o)/stretch)); gx=int(base*(2**o)*w/h)+2
        acc+=amp*up(rng.random((gy+1,gx+1)),h,w); tot+=amp; amp*=0.5
    return acc/tot
def fbm2(h,w,gy,gx,oct,rng):
    acc=np.zeros((h,w)); amp=1; tot=0
    for o in range(oct):
        acc+=amp*up(rng.random((int(gy*2**o)+2,int(gx*2**o)+2)),h,w); tot+=amp; amp*=0.5
    return acc/tot
def fbm1(w,base,oct,rng):
    acc=np.zeros(w); amp=1; tot=0
    for o in range(oct):
        n=int(base*2**o)+2; g=rng.random(n+1)
        xs=np.linspace(0,n-1.001,w); x0=xs.astype(int); f=xs-x0; f=f*f*(3-2*f)
        acc+=amp*(g[x0]*(1-f)+g[x0+1]*f); tot+=amp; amp*=0.5
    return acc/tot
def lerp(a,b,t): return a+(b-a)*t
def col(h): return np.array([int(h[i:i+2],16)/255 for i in (1,3,5)])
def vgrad(stops,h):
    y=np.linspace(0,1,h)[:,None]; out=np.zeros((h,3))
    for (p0,c0),(p1,c1) in zip(stops,stops[1:]):
        m=(y[:,0]>=p0)&(y[:,0]<=p1); t=((y[m,0]-p0)/(p1-p0))[:,None]
        out[m]=lerp(col(c0),col(c1),t)
    return out
def grain(img,rng,s=0.018):
    return img+(rng.standard_normal(img.shape[:2])[...,None]*s)
def vignette(img,k=0.28):
    y,x=np.mgrid[0:H,0:W]; d=((x/W-0.5)**2*1.2+(y/H-0.5)**2)
    return img*(1-k*d[...,None]*1.6)

def dawn(rng):
    hz=int(H*0.62)
    img=np.zeros((H,W,3))
    sky=vgrad([(0,'#161a3d'),(0.32,'#3f3768'),(0.66,'#b56f6c'),(0.9,'#eea883'),(1,'#f6cf9e')],hz); img[:hz]=sky[:,None,:]
    y,x=np.mgrid[0:H,0:W]; sx,sy=W*0.66,hz-30
    d=np.sqrt((x-sx)**2+(y-sy)**2)
    glow=np.exp(-np.sqrt((x-sx)**2+((y-sy)*2.2)**2)/300)[...,None]
    img[:hz]+=glow[:hz]*col('#ffc894')*0.5
    st=fbm2(hz,W,10,2.2,6,rng); st=np.clip((st-0.5)*3.4,0,1)
    band=np.exp(-((np.arange(hz)/hz-0.6)/0.2)**2)[:,None]; st=st*band
    lit=np.exp(-d[:hz]/650)[...,None]
    ccol=lerp(col('#2e2850'),col('#ffb07c'),np.clip(lit*1.1+np.linspace(0,0.45,hz)[:,None,None],0,1))
    img[:hz]=lerp(img[:hz],ccol,st[...,None]*0.8)
    n=H-hz
    sea=vgrad([(0,'#5f4f78'),(0.2,'#3a345f'),(1,'#0c0f22')],n); img[hz:]=sea[:,None,:]
    refl=np.flipud(img[hz-n:hz]); img[hz:]=lerp(img[hz:],refl*0.6,0.4)
    yy=np.arange(n)[:,None]
    rip=fbm2(n,W,60,3,3,rng)
    wave=0.5+0.5*np.sin(yy*(0.9-0.6*yy/n)*1.0+rip*9)
    spread=60+0.55*yy
    path=np.exp(-((x[hz:]-sx)/spread)**2)*np.clip(wave*1.6-0.6,0,1)
    img[hz:]+=path[...,None]*col('#ffd09a')*0.7*np.exp(-yy/300)[...,None]
    img[hz:]+=(wave[...,None]-0.5)*0.035*np.exp(-yy/400)[...,None]
    img=vignette(img)
    # The sun is drawn last so it stays the brightest point of the frame.
    sky=(y<hz)[...,None]
    bloom=np.exp(-np.clip(d-42,0,None)/22)[...,None]*sky
    img=img+bloom*0.35
    disc=np.clip(1-(d-42)/2.5,0,1)[...,None]*sky
    img=lerp(img,np.ones(3)[None,None,:],disc)
    img=grain(img,rng,0.01)
    return img
def ridges(rng):
    img=np.zeros((H,W,3)); sky=vgrad([(0,'#0e1a33'),(0.5,'#2c4767'),(1,'#7e9db3')],H); img[:]=sky[:,None,:]
    y,x=np.mgrid[0:H,0:W]
    mx,my=W*0.27,H*0.24; d=np.sqrt((x-mx)**2+(y-my)**2)
    img+=np.exp(-d/180)[...,None]*col('#cfe0ef')*0.35
    img=lerp(img,col('#f2f6fa')[None,None,:],np.clip(1-(d-34)/2.5,0,1)[...,None])
    haze=fbm(H,W,4,5,rng,stretch=3)
    layers=[(0.50,'#5c7a96',0.08),(0.60,'#47627e',0.10),(0.70,'#334a62',0.11),(0.80,'#223448',0.12),(0.90,'#121d2b',0.10)]
    for i,(base,c,amp) in enumerate(layers):
        prof=fbm1(W,3+i,5,rng); top=(base-amp*prof*1.6+amp*0.4)*H
        mask=(y>top[None,:]).astype(float)
        depth=np.clip((y-top[None,:])/(H*0.18),0,1)
        lc=lerp(col(c),col(c)*0.82,depth[...,None])
        img=lerp(img,lc,mask[...,None])
        fogy=top[None,:]+H*0.02
        fog=np.exp(-((y-fogy)/(H*0.035))**2)*np.clip(haze*1.4-0.3,0,1)
        img=lerp(img,col('#a9bccb'),(fog*0.35)[...,None])
    img=vignette(img,0.22); img=grain(img,rng,0.015)
    return img
def treeline(rng, base, hmin, hmax, density, jag):
    """Silhouette top edge of a conifer line: tiered branches, uneven crowns."""
    xs=np.arange(W, dtype=float)
    top=np.full(W, float(H))
    px=-20.0
    while px<W+20:
        px+=rng.uniform(4,density)
        th=rng.uniform(hmin,hmax)
        hw=th*rng.uniform(0.14,0.22)
        tiers=rng.integers(5,9)
        lean=rng.uniform(-0.08,0.08)*th
        b=base[int(np.clip(px,0,W-1))]+rng.uniform(0,10)
        prof=np.full(W, float(H))
        for k in range(tiers):
            f=k/tiers
            ty=b-th*(1-f)*0.92-th*0.08
            tw=hw*(0.25+0.85*f)*rng.uniform(0.8,1.15)
            cx=px+lean*(1-f)
            d=np.abs(xs-cx)/tw
            tierTop=ty+th/tiers*1.15*np.clip(d,0,1)**0.8
            m=d<1
            prof[m]=np.minimum(prof[m],tierTop[m])
        top=np.minimum(top,prof)
    top+= (fbm1(W,160,2,rng)-0.5)*jag
    return top

def lake(rng):
    hz=int(H*0.6)
    img=np.zeros((H,W,3))
    sky=vgrad([(0,'#273f52'),(0.55,'#8ea7ab'),(1,'#e6d7ba')],hz); img[:hz]=sky[:,None,:]
    y,x=np.mgrid[0:H,0:W]
    cl=fbm2(hz,W,5,2.5,6,rng); cl=np.clip((cl-0.5)*2.2,0,1)*np.linspace(1,0.25,hz)[:,None]
    img[:hz]=lerp(img[:hz],col('#c9d3d0'),cl[...,None]*0.42)
    ridge=hz-(30+fbm1(W,4,5,rng)*55)
    m=(y<hz)&(y>ridge[None,:]); img[m]=lerp(img[m],col('#71878a'),0.7)
    haze1=np.exp(-((y-hz+10)/70.0)**2)
    img=lerp(img,col('#b9c7c5'),(haze1*0.35)[...,None])
    far=treeline(rng, np.full(W,hz-6.0), 26, 62, 9, 3)
    m=(y<hz)&(y>far[None,:]); img[m]=lerp(img[m],col('#4a5f61'),0.9)
    mist=np.exp(-((y-hz+8)/26.0)**2)*np.clip(fbm2(H,W,5,3,4,rng)*1.6-0.25,0,1)
    img=lerp(img,col('#d3dbd6'),(mist*0.55)[...,None])
    near=treeline(rng, np.full(W,hz+2.0), 50, 140, 16, 4)
    m=(y<hz+2)&(y>near[None,:]); img[m]=lerp(img[m],col('#18241f'),0.95)
    n=H-hz
    refl=np.flipud(img[hz-n:hz]).copy()
    rows=np.arange(n)[:,None]
    wob=np.sin(rows*0.55+fbm2(n,W,40,6,3,rng)*10)*(1.5+rows/n*5)
    cols=np.clip((np.arange(W)[None,:]+wob).astype(int),0,W-1)
    rr=refl[rows,cols]
    rr=(rr+np.roll(rr,1,0)+np.roll(rr,2,0)+np.roll(rr,3,0))/4
    water=vgrad([(0,'#7d9391'),(1,'#16201f')],n)[:,None,:]
    img[hz:]=lerp(water,rr,0.5*np.exp(-np.arange(n)/320)[:,None,None])
    streak=fbm2(n,W,90,2,3,rng)
    img[hz:]+=((streak-0.5)*0.05)[...,None]
    img=vignette(img,0.24); img=grain(img,rng,0.01)
    return img
scenes={'dawn-sea':dawn,'ridges':ridges,'misty-lake':lake}
for name,fn in scenes.items():
    rng=np.random.default_rng(zlib.crc32(name.encode()))
    png(os.path.join(out,name+'.png'), fn(rng)); print('ok',name)
