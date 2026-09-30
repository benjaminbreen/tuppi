import json, os, importlib.util, sys
spec=importlib.util.spec_from_file_location('b','build_atoms.py');
src=open('build_atoms.py').read().split('# ---- analysis')[0]
ns={}; exec(src,ns)
D=ns['D']; o=ns['o']; A=ns['A']; S=ns['S']; H=ns['H']; G=ns['G']; ANIMAL=ns['ANIMAL']; FOOD=ns['FOOD']; WOOL=ns['WOOL']
# refinements after reading the translations
D['uhhamuwa']['appeal-over-ram']=[S('assignment',G('hostile god'),about=ANIMAL('ram',adorned=True)),S('appeasement',G('hostile god'))]
D['uhhamuwa']['address-horses-chariot']=[S('assignment',G('hostile god'),about=FOOD('fodder')),S('appeasement',G('hostile god')),S('dismissal',G('hostile god'),goal='his own land')]
D['uhhamuwa']['bring-food-drink']=[A('bring',FOOD(x)) for x in ['cheese','bread','fruit']]+[A('bring',o('drink',x)) for x in ['wine','beer']]
D['ashella']['appeal']=[S('assignment',G('plague god'),about=ANIMAL('ram',adorned=True)),S('appeasement',G('plague god'))]
D['ashella']['wash-salt-water']=[A('combine',o('stone','salt'),with_=o('liquid','water')),A('wash',o('body','hands'),medium='salt water')]
D['tunnawiya']['offer-at-riverbank']=[A('offer',FOOD('bread'),recipient=G('Mother-goddess'),location='riverbank'),A('pour',o('drink','wine'),location='riverbank')]
D['tunnawiya']['offer-at-spring']=[A('offer',FOOD('bread'),location='spring'),A('pour',o('drink','wine'),location='spring')]
D['tunnawiya']['collect-spring-clay']=[S('analogy',o('place','spring'),about=o('harm','impurity')),A('collect',o('clay'),source='spring')]
D['tunnawiya']['hold-black-sheep']=[A('hold-over',ANIMAL('sheep',color='black'),over=H('patient')),S('dismissal',about=o('harm','impurity'))]
D['tunnawiya']['hold-piglet']=[A('hold-over',ANIMAL('piglet'),over=H('patient'))]
D['tunnawiya']['hold-puppy']=[A('hold-over',ANIMAL('puppy'),over=H('patient'))]
D['tunnawiya']['melt-figures']=[A('hold-over',o('figure',material='wax'),over=H('patient')),S('declaration',about=o('figure')),A('melt',o('figure',material='wax')),A('melt',o('figure',material='tallow')),S('analogy',about=o('harm','sorcery'))]
D['tunnawiya']['wash-with-water']=[A('wash',H('patient'),medium='water')]
D['tunnawiya']['remove-coloured-wool']=[A('detach',WOOL(colors=['blue','red']),from_=H('patient'))]
D['tunnawiya']['smash-empty-pot']=[A('hold-over',o('vessel','pot',empty=True),over=H('patient')),A('break',o('vessel','pot')),S('dismissal',about=o('harm','impurity'))]
D['tunnawiya']['pass-through-gate']=[A('pass',H('patient'),boundary='beneath the alanza-wood gate'),S('analogy',about=o('structure','gate'))]
D['tunnawiya']['release-into-river']=[A('release',o('materials'),goal='river')]
D['tunnawiya']['wish-for-offspring']=[S('analogy',G('Sun-god'),about=ANIMAL('cow'))]
D['tunnawiya']['wish-by-tree']=[S('analogy',G('Sun-god'),about=o('tree','fruit tree'))]
D['tunnawiya']['touch-fruit-tree']=[A('touch',o('tree','fruit tree'))]
D['tunnawiya']['libate-sun-god']=[A('pour',o('drink','wine'),recipient=G('Sun-god')),S('petition',G('Sun-god'))]
D['pulisa']['address-man']=[S('substitution',G('male deity'),about=H('prisoner')),S('dismissal',about=o('harm','plague'))]
D['pulisa']['address-bull']=[S('substitution',G('male deity'),about=ANIMAL('bull')),S('dismissal',about=o('harm','plague'))]
D['pulisa']['send-animals-ahead']=[A('drive',ANIMAL('bull'),goal='ahead of the substitutes'),A('drive',ANIMAL('ewe'),goal='ahead of the substitutes')]
D['paskuwatti']['arrange-offerings']=[A('place',FOOD(x),location='on soldier-bread') for x in ['bread','fig','raisin','groats']]+[A('place',o('drink','wine'),location='on soldier-bread'),A('place',WOOL(),location='on soldier-bread'),A('place',o('garment'),location='on soldier-bread')]
D['paskuwatti']['exchange-implements']=[A('detach',o('implement','spindle'),from_=H('offerant')),A('exchange',o('implement','distaff'),for_=o('implement','bow'))]
D['paskuwatti']['speak-exchange']=[S('declaration',about=o('implement','bow')),S('analogy',about=o('implement','bow'))]
D['paskuwatti']['set-home-table']=[A('carry',FOOD('offerings'),goal='home'),A('place',FOOD('offerings'),location='on a new table')]
RENAME={'from_':'from','with_':'with','for_':'for'}
def fix(x):
  if isinstance(x,dict):
    out={}
    for k,v in x.items():
      k=RENAME.get(k,k)
      if k in('class','sub'): out[k]=v; continue
      if k in ('f',): out[k]=fix(v); continue
      out[k]=fix(v)
    # move stray features into f
    if 'class' in out:
      f=out.get('f',{});
      for k in list(out):
        if k not in ('class','sub','count','f','ref','label'): f[k]=out.pop(k)
      if 'count' in f: out['count']=f.pop('count')
      if f: out['f']=f
      elif 'f' in out: del out['f']
      if out.get('sub') is None: out.pop('sub',None)
    else:
      for k in [k for k,v in out.items() if v is None]: out.pop(k)
    return out
  if isinstance(x,list): return [fix(v) for v in x]
  return x
os.makedirs('staging/_atoms',exist_ok=True)
for r,steps in D.items():
  json.dump({k:fix(v) for k,v in steps.items()},open(f'staging/_atoms/{r}.json','w'),ensure_ascii=False,indent=1)
print('written',list(D))
