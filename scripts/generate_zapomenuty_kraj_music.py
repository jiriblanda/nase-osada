import ctypes as C, numpy as np, wave, math, subprocess, os
from pathlib import Path
lib=C.CDLL('libfluidsynth.so.3')
def fn(name,restype,args):
 f=getattr(lib,name); f.restype=restype; f.argtypes=args; return f
ptr=C.c_void_p; I=C.c_int; F=C.c_float; D=C.c_double; S=C.c_char_p
settings_new=fn('new_fluid_settings',ptr,[])
settings_num=fn('fluid_settings_setnum',I,[ptr,S,D])
settings_int=fn('fluid_settings_setint',I,[ptr,S,I])
synth_new=fn('new_fluid_synth',ptr,[ptr])
sfload=fn('fluid_synth_sfload',I,[ptr,S,I])
program=fn('fluid_synth_program_change',I,[ptr,I,I])
noteon=fn('fluid_synth_noteon',I,[ptr,I,I,I]); noteoff=fn('fluid_synth_noteoff',I,[ptr,I,I])
write_float=fn('fluid_synth_write_float',I,[ptr,I,ptr,I,I,ptr,I,I])
settings=settings_new(); SR=22050
settings_num(settings,b'synth.sample-rate',SR)
settings_num(settings,b'synth.gain',0.45)
settings_num(settings,b'synth.reverb.room-size',0.7)
settings_num(settings,b'synth.reverb.level',0.25)
settings_num(settings,b'synth.chorus.level',1.0)
settings_int(settings,b'synth.reverb.active',1)
settings_int(settings,b'synth.chorus.active',1)
s=synth_new(settings)
font=b'/usr/share/sounds/sf2/TimGM6mb.sf2'
assert sfload(s,font,1)>=0
for ch,inst in [(0,89),(1,48),(2,46),(3,10)]:program(s,ch,inst)
T=218.50
bar=4.28
chords=[
 ('Em9',[52,55,59,66]),('Cmaj7',[48,55,59,64]),('Gadd9',[43,50,59,69]),('Dsus2',[50,57,62,64]),
 ('Am7',[45,52,55,60]),('Cmaj7',[48,55,59,64]),('Bm7',[47,54,57,62]),('Em9',[52,55,59,66]),
 ('Gadd9',[43,50,59,69]),('Cmaj7',[48,55,59,64]),('Em9',[52,55,59,66]),('Dsus2',[50,57,62,64]),
 ('Am7',[45,52,55,60]),('Em9',[52,55,59,66]),('Bm7',[47,54,57,62]),('Dsus2',[50,57,62,64]),
]
EV=[]
for j in range(math.ceil(T/bar)):
 start=j*bar; name,notes=chords[j%len(chords)]
 for p in notes:
  EV += [(start,1,0,p,53), (min(T,start+bar*0.99),0,0,p,0)]
 if j%2==0:
  root=notes[0]-12
  EV += [(start+0.12,1,1,root,42),(min(T,start+bar*1.95),0,1,root,0)]
 if j%2==0 and start < T-12:
  upper=notes[1:]
  pattern=[upper[0]+12,upper[1]+12,upper[2]+12,upper[1]+12]
  for k,p in enumerate(pattern):
   at=start+0.45+k*0.88
   EV += [(at,1,2,p,35),(at+1.05,0,2,p,0)]
 if j%4==3 and start<T-12:
  p=notes[-1]+12
  EV += [(start+2.15,1,3,p,18),(start+4,0,3,p,0)]
EV.sort(key=lambda x:(x[0],x[1]))
out='public/zapomenuty-kraj-hudba.wav'
eventix=0; chunk=SR//2; N=int(T*SR)
peak=0.
with wave.open(out,'wb') as wf:
 wf.setnchannels(2); wf.setsampwidth(2);wf.setframerate(SR)
 for i in range(0,N,chunk):
  ns=min(chunk,N-i); now=i/SR
  while eventix<len(EV) and EV[eventix][0]<=now+1e-7:
   tt,on,ch,p,v=EV[eventix]
   (noteon(s,ch,p,v) if on else noteoff(s,ch,p))
   eventix+=1
  l=np.empty(ns,dtype=np.float32);r=np.empty(ns,dtype=np.float32)
  write_float(s,ns,l.ctypes.data,0,1,r.ctypes.data,0,1)
  t=(np.arange(ns,dtype=np.float32)+i)/SR
  fade=np.minimum(1,np.minimum(t/5.,(T-t)/9.))
  amp=0.34*(0.93+0.07*np.sin(2*np.pi*t/38.))*np.maximum(0,fade)
  sig=np.column_stack((l*amp,r*amp))
  peak=max(peak,float(np.max(np.abs(sig))))
  pcm=(np.clip(sig,-1,1)*32767).astype('<i2')
  wf.writeframes(pcm.tobytes())
final='public/zapomenuty-kraj-hudba.mp3'
subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',out,'-codec:a','libmp3lame','-b:a','128k',final],check=True)
os.remove(out)
print('Output:',final,'Size:',os.path.getsize(final),'Peak:',peak,'Duration:',T)
