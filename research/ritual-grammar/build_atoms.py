"""Prototype: decompose ritual steps into atomic frames  VERB(theme, +roles).
Closed verb inventory; typed object classes with features; speech acts separate.
Atoms are the grammar; existing unitIds stay as the source-bound 'phrase' layer."""
import json, collections, os
R='../../src/data/rituals/'
# ---- closed inventories -------------------------------------------------
VERBS = {  # primitive: gloss
 'bring':'move a thing into the ritual space', 'take':'pick up / take possession', 'collect':'take substance from a place',
 'combine':'join materials into one (twist, mix)', 'shape':'form material into an object (wreath, figure, gate)',
 'attach':'fasten X onto Y', 'detach':'remove X from Y', 'tie':'tether / bind in place', 'place':'set X at a location',
 'hold-over':'raise/wave X over a person', 'give':'transfer X to person', 'dress':'put garments on', 'undress':'take garments off',
 'cut':'cut / split', 'break':'smash', 'melt':'melt', 'burn':'burn', 'kill':'kill', 'cook':'cook',
 'wash':'wash with a liquid', 'comb':'draw downward over body', 'pour':'libate', 'scatter':'spread over ground',
 'drive':'send an animal/person along a path', 'release':'let go into water/territory', 'pass':'person moves through a boundary',
 'build':'erect a structure', 'select':'choose a person/animal', 'dedicate':'assign X to a deity', 'offer':'set food/drink before a deity',
 'touch':'lay hold of a living exemplar', 'draw-out':'pull X out of body orifice', 'exchange':'swap one object for another',
 'speak':'utterance (see speech act)',
}
SPEECH = {'petition':'ask a deity for X','assignment':'declare X belongs to / is for Y','substitution':'declare X replaces Y',
 'dismissal':'tell the harm/god to go','analogy':'as X, so may Y','invocation':'call a deity to be present'}
# object classes: class:subtype{features}
def o(cls, sub=None, **f): return {'class':cls,'sub':sub, **({'f':f} if f else {})}
ANIMAL=lambda s,**f:o('animal',s,**f); WOOL=lambda **f:o('wool',None,**f); FOOD=lambda s:o('food',s)
H=lambda s,**f:o('person',s,**f); G=lambda s:o('deity',s)
# ---- decomposition: stepId -> list of atoms ------------------------------
# atom = (verb, theme, {role: value}) ; speech atoms carry 'act'
A=lambda v,t=None,**r:{'verb':v,'theme':t,**r}
S=lambda act,to=None,about=None,**r:{'verb':'speak','act':act,'addressee':to,'about':about,**r}
D = {
'uhhamuwa':{
 'bring-ram':[A('bring',ANIMAL('ram'))],
 'twist-wool':[A('combine',WOOL(colors=['blue','red','yellow-green','black','white']),result=o('wool','cord'))],
 'make-wreath':[A('shape',WOOL(),result=o('ornament','wreath'))],
 'crown-ram':[A('attach',o('ornament','wreath',material='wool'),onto=ANIMAL('ram',part='head'))],
 'lead-to-road':[A('drive',ANIMAL('ram',adorned=True),goal='road to enemy land')],
 'appeal-over-ram':[S('petition',G('hostile god'),about=ANIMAL('ram')), S('assignment',G('hostile god'),about=ANIMAL('ram'))],
 'drive-away-ram':[A('drive',ANIMAL('ram',adorned=True),goal='enemy land')],
 'bring-fodder-fat':[A('bring',FOOD('fodder')),A('bring',o('fat','sheep'))],
 'address-horses-chariot':[S('petition',G('hostile god'),about=FOOD('fodder')),S('dismissal',G('hostile god'),goal='his own land')],
 'bring-goat-sheep':[A('bring',ANIMAL('goat')),A('bring',ANIMAL('sheep',count=2))],
 'dedicate-goat':[A('dedicate',ANIMAL('goat'),recipient=G('the Seven'))],
 'dedicate-sheep':[A('dedicate',ANIMAL('sheep'),recipient=G('Sun-god'))],
 'kill-sheep':[A('kill',ANIMAL('sheep'))],
 'cook-sheep':[A('cook',o('meat','sheep'))],
 'bring-food-drink':[A('bring',FOOD(x)) for x in ['cheese','bread','wine','beer','fruit']],
 'prepare-for-road-god':[A('offer',FOOD('provisions'),recipient=G('god of the road'))]},
'ashella':{
 'prepare-ram':[A('bring',ANIMAL('ram'),agent=H('army lord'),time='dusk')],
 'twist-wool':[A('combine',WOOL(colors=['white','red','green']),result=o('wool','cord'))],
 'bind-ram':[A('attach',o('wool','cord'),onto=ANIMAL('ram',part='neck')),A('attach',o('ornament','metal'),onto=ANIMAL('ram',part='horns'))],
 'tether-ram':[A('tie',ANIMAL('ram',adorned=True),location='before a tent',time='night')],
 'appeal':[S('petition',G('plague god'),about=ANIMAL('ram'))],
 'release-rams':[A('drive',ANIMAL('ram',adorned=True),location='through the camp'),A('release',ANIMAL('ram'),goal='enemy border')],
 'slaughter-ram':[A('kill',ANIMAL('ram'),instrument='bronze knife')],
 'cook-meat':[A('cook',o('meat','sheep'))],
 'wash-salt-water':[A('combine',o('salt'),with_='water'),A('wash',o('body','hands'),medium='salt water')],
 'pass-between-fires':[A('burn',o('fire',count=2)),A('pass',H('participants'),boundary='between two fires')],
 'offer-goats':[A('dedicate',ANIMAL('goat',count=2),recipient=G('Tutelary deity'))],
 'bring-pig':[A('drive',ANIMAL('pig'),goal='open place')],
 'offer-pig':[A('dedicate',ANIMAL('pig'),recipient=G('plague god'))],
 'offer-bull':[A('dedicate',ANIMAL('bull'),recipient=G('Storm-god'))],
 'offer-ewe':[A('dedicate',ANIMAL('ewe'),recipient=G('Sun-god'))],
 'offer-rams':[A('dedicate',ANIMAL('sheep',count=3),recipient=G('all the gods'))]},
'tunnawiya':{
 'prepare-black-animals':[A('bring',ANIMAL(x,color='black')) for x in ['sheep','piglet','puppy']],
 'set-out-black-clothes':[A('bring',o('garment',x,color='black')) for x in ['shirt','leggings','shoes']],
 'offer-at-riverbank':[A('offer',FOOD('bread'),recipient=G('Mother-goddess'),location='riverbank'),A('pour',FOOD('wine'),location='riverbank')],
 'address-riverbank-goddess':[S('petition',G('Mother-goddess'),about=o('clay'))],
 'collect-river-clay':[A('collect',o('clay'),source='riverbank')],
 'offer-at-spring':[A('offer',FOOD('bread'),location='spring'),A('pour',FOOD('wine'),location='spring')],
 'collect-spring-clay':[S('petition',o('place','spring')),A('collect',o('clay'),source='spring')],
 'build-reed-hut':[A('build',o('structure','hut',material='reed'),location='riverside')],
 'make-clay-figures':[A('shape',o('clay'),result='tongue x12'),A('shape',o('clay'),result='ox x2')],
 'dress-in-black':[A('dress',o('garment',color='black'),on=H('patient'))],
 'hold-black-sheep':[A('hold-over',ANIMAL('sheep',color='black'),over=H('patient')),S('analogy')],
 'hold-piglet':[A('hold-over',ANIMAL('piglet'),over=H('patient')),S('analogy')],
 'hold-puppy':[A('hold-over',ANIMAL('puppy'),over=H('patient')),S('analogy')],
 'hold-clay-tongue':[A('hold-over',o('figure','tongue',material='clay'),over=H('patient'))],
 'melt-figures':[A('melt',o('figure',material='wax')),A('melt',o('figure',material='tallow'))],
 'wash-hands-wine':[A('wash',o('body','hands'),medium='wine')],
 'wash-with-water':[A('wash',H('patient'),medium='water')],
 'remove-coloured-wool':[A('detach',WOOL(colors=['blue','red']),from_=H('patient'))],
 'strip-black-clothes':[A('cut',o('garment','shirt',color='black')),A('undress',o('garment',color='black'),from_=H('patient'))],
 'smash-empty-pot':[A('hold-over',o('vessel','pot',empty=True),over=H('patient')),A('break',o('vessel','pot'))],
 'bathe-over-figure':[A('place',o('figure',material='clay'),location='under feet'),A('wash',H('patient'),medium='water')],
 'comb-down':[A('comb',H('patient'),instrument='boxwood comb')],
 'release-into-river':[A('release',o('used materials'),goal='river')],
 'burn-small-animals':[A('burn',ANIMAL('piglet'),location='uncultivated ground'),A('burn',ANIMAL('puppy'))],
 'pass-through-gate':[A('pass',H('patient'),boundary='gate')],
 'return-river-offering':[A('offer',FOOD('bread'),location='riverbank')],
 'take-cow-by-horn':[A('touch',ANIMAL('cow',part='horn'))],
 'wish-for-offspring':[S('analogy',G('Sun-god'),about=ANIMAL('cow'))],
 'touch-fruit-tree':[A('touch',o('tree','fruit-bearing'))],
 'wish-by-tree':[S('analogy',G('Sun-god'),about=o('tree'))],
 'libate-sun-god':[A('pour',FOOD('wine'),recipient=G('Sun-god')),S('petition',G('Sun-god'))]},
'pulisa':{
 'select-substitutes':[A('select',H('prisoner')),A('select',H('woman'))],
 'remove-king-garments':[A('undress',o('garment','festive'),from_=H('king'))],
 'dress-man':[A('dress',o('garment','festive'),on=H('prisoner'))],
 'dress-woman':[A('dress',o('garment','festive'),on=H('woman'))],
 'address-man':[S('substitution',G('male deity'),about=H('prisoner')),S('dismissal',about='plague')],
 'address-woman':[S('substitution',G('female deity'),about=H('woman'))],
 'bring-bull-ewe':[A('bring',ANIMAL('bull')),A('bring',ANIMAL('ewe'))],
 'ring-bull':[A('attach',o('ornament','ring'),onto=ANIMAL('bull',part='ears'))],
 'draw-wool':[A('draw-out',WOOL(colors=['red','green','black','white']),from_=H('king',part='mouth'))],
 'address-bull':[S('substitution',G('male deity'),about=ANIMAL('bull')),S('dismissal',about='plague')],
 'address-ewe':[S('substitution',G('female deity'),about=ANIMAL('ewe'))],
 'send-animals-ahead':[A('drive',ANIMAL('bull')),A('drive',ANIMAL('ewe'))]},
'paskuwatti':{
 'arrange-offerings':[A('place',FOOD(x),location='on soldier-bread') for x in ['bread','fig','raisin','groats','wine']]+[A('place',WOOL(),location='on soldier-bread'),A('place',o('garment'),location='on soldier-bread')],
 'carry-offerings':[A('take',FOOD('offerings'),agent=H('virgin girl')),A('drive',H('offerant'),goal='open country')],
 'make-reed-gate':[A('build',o('structure','gate',material='reed'))],
 'bind-gate':[A('attach',WOOL(colors=['red','white']),onto=o('structure','gate'))],
 'give-spindle':[A('give',o('implement','spindle'),to=H('offerant')),A('give',o('implement','distaff'),to=H('offerant'))],
 'pass-gate':[A('pass',H('offerant'),boundary='gate')],
 'exchange-implements':[A('exchange',o('implement','spindle'),for_=o('implement','bow'))],
 'speak-exchange':[S('analogy',about=o('implement','bow'))],
 'entreat-uliliyassi':[S('petition',G('Uliliyassi'))],
 'set-home-table':[A('place',FOOD('offerings'),location='new table')]},
}
# ---- analysis ------------------------------------------------------------
def key(a):  # grammar signature: verb + theme class/sub (+speech act)
    if a['verb']=='speak': return f"speak:{a['act']}"
    t=a.get('theme') or {}; return f"{a['verb']}({t.get('class')}{':'+t['sub'] if t.get('sub') else ''})"
def coarse(a):
    if a['verb']=='speak': return f"speak:{a['act']}"
    return f"{a['verb']}({(a.get('theme') or {}).get('class')})"
out=[]; fine=collections.defaultdict(set); crs=collections.defaultdict(set); nsteps=0
for r,steps in D.items():
    real={s['id'] for s in json.load(open(R+r+'.json'))['steps']}
    assert set(steps)==real,(r,real^set(steps))
    for sid,atoms in steps.items():
        nsteps+=1
        for i,a in enumerate(atoms):
            assert a['verb'] in VERBS,a
            a={'id':f'{r}/{sid}#{i}','step':f'{r}/{sid}',**a}; out.append(a)
            fine[key(a)].add(r); crs[coarse(a)].add(r)
json.dump({'verbs':VERBS,'speechActs':SPEECH,'atoms':out},open('atoms.draft.json','w'),ensure_ascii=False,indent=1)
old=collections.Counter(); O=json.load(open(R+'occurrences.json'))
oldshared=sum(1 for v in O.values() if len({x['ritualId'] for x in v if x['ritualId'] in D})>1)
oldtot=sum(1 for v in O.values() if any(x['ritualId'] in D for x in v))
print(f"steps {nsteps} -> atoms {len(out)}")
print(f"OLD units in these 5 rituals: {oldtot}, shared across rituals: {oldshared}")
for name,m in [('fine verb(class:sub)',fine),('coarse verb(class)',crs)]:
    sh=[k for k,v in m.items() if len(v)>1]
    print(f"NEW {name}: {len(m)} types, {len(sh)} shared across rituals")
print('most widely shared:'); [print(' ',k,sorted(v)) for k,v in sorted(crs.items(),key=lambda kv:-len(kv[1]))[:15]]
