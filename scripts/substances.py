"""Curated substance map (v0.1). Keys are TLHdig lemma strings (as chosen analysis gives them).

Each entry: class, English label, and optionally `needs_det` (the scribe must have written this determinative
for the reading to apply, e.g. GIŠ TÚG = boxwood, but TÚG alone = garment).

Identification status is derived from the TLHdig gloss: '?' -> tentative; parenthesised '(a plant)' -> class only.
Labels here only fix TLHdig's wrong-sense selections (GEŠTIN 'wine official' -> wine); they add no new identifications.
"""

S = {
    # ---- animal-derived ----
    "SÍG": ("animal", "wool"), "GA.KIN.AG": ("animal", "cheese"), "ešḫ=ar": ("animal", "blood"),
    "išḫ=ar": ("animal", "blood"), "išḫan=ant-": ("animal", "blood"), "ešḫan=ant-": ("animal", "blood"),
    "SA": ("animal", "sinew"), "išḫuna=uwar": ("animal", "sinew"), "išḫunauw=ant-": ("animal", "sinew"),
    "MATNU": ("animal", "sinew"), "KUŠ": ("animal", "leather, hide"), "DUḪ.LÀL": ("animal", "wax"),
    "Ì.UDU": ("animal", "tallow"), "LÀL": ("animal", "honey"), "Ì.NUN": ("animal", "ghee"), "SI": ("animal", "horn"),
    "NÍG.GIG": ("animal", "liver"), "leš=i-": ("animal", "liver"), "GA": ("animal", "milk"),
    "kišr=i-": ("animal", "tuft of wool (kišri-)"), "ḪAṢARTU": ("animal", "green wool"), "mit=a/i-": ("animal", "red wool"),
    "ešar=a-": ("animal", "wool band"), "pu=ttar": ("animal", "animal hair"), "šukšuk=a-": ("animal", "(a kind of hair)"),
    "UZU": ("animal", "meat"), "šupp=a-": ("animal", "meat (sacral)"), "šupp=i-": ("animal", "meat (sacral)"),
    "ḫašt=ai-2": ("animal", "bone"), "ḫaštiy=ant-": ("animal", "bone"), "Ì.ŠAḪ": ("animal", "lard"),
    "ÉLLAG": ("animal", "kidney"), "šeḫ=ur": ("animal", "urine"), "malul=i-": ("animal", "(an organ) malul-"),
    "milul=i-": ("animal", "(an organ) malul-"), "melul=i-": ("animal", "(an organ) malul-"),
    # ---- food & drink ----
    "ZÌ.DA": ("food", "flour"), "ZÌ": ("food", "flour"), "GEŠTIN": ("food", "wine"), "KAŠ": ("food", "beer"),
    "KAŠ.GEŠTIN": ("food", "beer-wine (a drink)"), "NINDA": ("food", "bread"),
    "NINDA.GUR₄.RA": ("food", "thick bread"), "mem=al-": ("food", "groats"), "mar=i-2": ("food", "(spear-shaped bread)"),
    "NINDA.ÉRIN": ("food", "soldier bread"), "NINDA.Ì.E.DÉ.A": ("food", "batter cake"), "NINDA.SIG": ("food", "flat bread"),
    "NINDA.KU₇": ("food", "sweet bread"), "NINDA.GIDIM": ("food", "bread for the dead"), "NINDA.Ì": ("food", "fat bread"),
    "NINDA.ÚKUŠ": ("food", "cucumber bread"), "BAPPIR": ("food", "beer bread (wort)"), "ân-": ("food", "warm bread"),
    "iššan=a-": ("food", "dough"), "Ì": ("food", "oil, fat"), "Ì.GIŠ": ("food", "oil"), "Ì.DU₁₀.GA": ("food", "fine oil"),
    "taw=al-": ("food", "tawal (a drink)"), "limm=a-": ("food", "limma- (a drink)"), "walaḫḫ=i-": ("food", "walḫi- (a drink)"),
    "ši=eššar": ("food", "šeššar (a beer)"), "ḫuwart=i-": ("food", "(a brew?)"), "KA.GAG": ("food", "(a kind of beer)"),
    "ḫarš=i-": ("food", "loaf"), "ḫarnantašš=a/i-": ("food", "(a pastry)"), "ḫal=i-": ("food", "(a bread)"),
    "wag=eššar": ("food", "(a bread)"), "naḫḫit=i-": ("food", "(a bread)"), "tawataim=i-": ("food", "(a bread)"),
    "TU₇": ("food", "soup, stew"), "TU₇°ḪI.A°-TIM": ("food", "soup, stew"), "BA.BA.ZA": ("food", "barley porridge"),
    "TU₇˽BA.BA.ZA": ("food", "barley-porridge soup"), "DIM₄": ("food", "malt"),
    # ---- minerals & metals ----
    "ZABAR": ("mineral", "bronze"), "KÙ.SI₂₂": ("mineral", "gold"), "KÙ.BABBAR": ("mineral", "silver"),
    "URUDU": ("mineral", "copper"), "AN.BAR": ("mineral", "iron"), "MUN": ("mineral", "salt"), "A.GAR₅": ("mineral", "lead"),
    "IM.SAḪAR.KUR.RA": ("mineral", "alum"), "ZÚ": ("mineral", "obsidian"), "šarlawit=i-": ("mineral", "(a stone)"),
    "paššil=a-": ("mineral", "pebble, stone"), "wātar2": ("mineral", "'water stone'"), "IM": ("mineral", "clay"),
    "ZA.GÌN": ("mineral", "lapis lazuli; blue"), "NA₄": ("mineral", "stone"),
    # ---- plants ----
    "TÚG": ("plant", "boxwood", "GIŠ"), "ZÍZ": ("plant", "emmer wheat"), "KUNĪŠU": ("plant", "emmer wheat"),
    "NUMUN": ("plant", "seed"), "gapan=u-": ("plant", "bulb, tuber"), "INBU": ("plant", "fruit"),
    "šumanz=a(n)-": ("plant", "reed, cord"), "šumanzan=a-": ("plant", "reed, cord"), "šummanz=a-": ("plant", "reed, cord"),
    "šummanzan=a-": ("plant", "reed, cord"), "Ú": ("plant", "plant, herb"), "ḪAŠḪUR.KUR.RA": ("plant", "apricot"),
    "ŠENNUR": ("plant", "medlar(?)"), "GÚ.TUR": ("plant", "lentil"), "šeppi=t-": ("plant", "(a cereal) šeppit-"),
    "GEŠTIN.ḪÁD.DU.A": ("plant", "raisins"), "GI": ("plant", "reed"), "GÚ.GAL.GAL": ("plant", "broad bean"),
    "GÚ.GAL": ("plant", "chickpea"), "karš=a-": ("plant", "wheat(?)"), "kara=š-": ("plant", "wheat(?)"),
    "k=ant-": ("plant", "wheat(?)"), "ey=an-": ("plant", "yew(?)"), "iy=an-": ("plant", "yew(?)"),
    "ḫalk=i-": ("plant", "grain"), "PÈŠ": ("plant", "fig"), "parašd=u-": ("plant", "shoot"),
    "parḫuen=a-": ("plant", "(a cereal) parḫuena-"), "parḫuin=a-": ("plant", "(a cereal) parḫuena-"),
    "ḪAŠḪUR": ("plant", "apple"), "alkišt=an-": ("plant", "branch"), "ḫapu=š-": ("plant", "stalk"),
    "ḫapušašš=a-": ("plant", "stalk"), "ḫatalkišn=a-": ("plant", "hawthorn"), "ḫattalkišn=a-": ("plant", "hawthorn"),
    "ḫattalkešn=a-": ("plant", "hawthorn"), "alanz=a-": ("plant", "(a tree) alanza-"), "alanz=an-": ("plant", "(a tree) alanza-"),
    "AZANNU": ("plant", "bitter garlic(?)"), "ḫariyat=i-": ("plant", "(a medicinal herb)"), "šuwar=i(t)-": ("plant", "(a plant)"),
    "arnitašš=a/i-": ("plant", "(of the arni(t)-plant)"), "AN.DAḪ.ŠUM": ("plant", "crocus(?)"), "ZÀ.AḪ.LI": ("plant", "cress(?)"),
    "šullittinni=": ("plant", "(a vegetable)"), "šum=eššar": ("plant", "legume(?)"), "šank=u-": ("plant", "(a flower)"),
    "artart=i-": ("plant", "(a tree or shrub)"), "iššarašil=a-": ("plant", "(a plant)"), "ḫuwalli=š-": ("plant", "juniper"),
    "GIŠ.KÍN": ("plant", "(a tree and its fruit)"), "U₄.ḪI.IN": ("plant", "unripe date"), "ḫaršanil=a-": ("plant", "(a grain)"),
    "SERDU": ("plant", "olive"), "šamam=a-": ("plant", "sesame"), "ḫaššikk=a-": ("plant", "(a fruit tree?)"),
    "wardul=i-": ("plant", "(a plant substance)"), "ḫaḫuišaya=": ("plant", "(a medicinal herb)"),
    "ḫaḫliw=ant-": ("plant", "(a herb)"), "ŠU.ÚR.MÌN": ("plant", "cypress"), "ZÚ.LUM": ("plant", "date"),
    "ŠINIG": ("plant", "tamarisk"), "EREN": ("plant", "cedar"), "NU.LUḪ.ḪA": ("plant", "(a garden plant)"),
    "GA.RAŠ": ("plant", "leek"), "ŠURŠU": ("plant", "root"), "UZZIPIRĀTUM": ("plant", "(a medicinal plant)"),
    "BURĀŠU": ("plant", "juniper"), "maršankuaš=": ("plant", "(a fruit)"), "LAM.ḪAL": ("plant", "(a pistachio)"),
    "NU.ÚR.MA": ("plant", "pomegranate"), "MA.NU": ("plant", "cornel(?)"), "ŠAKIR.RA": ("plant", "(a plant) šakirû"),
    "Ú.ḪI.A": ("plant", "plants, herbs"), "ŠE": ("plant", "barley"), "ŠE.LÚ": ("plant", "coriander"),
    "SUM": ("plant", "garlic", "SAR"), "GAMUN": ("plant", "cumin"),
}

# never substances even if a determinative suggests so (objects, people, cult installations)
EXCLUDE = {"KÚR", "šen=a-", "ŠUMU", "MEŠĒDU", "AD.KID", "dar=iya-", "patt=ar-2", "KIŠIB", "ḫeku=r-", "ḫuwaš=i-",
           "ZI.KIN", "DUB", "TUPPU", "tupp=i-", "šakuniy=a-", "ŠÀ-BI", "SAKAR", "NIGA"}

# action verbs -> category (by chosen lemma's English gloss keywords)
ACTIONS = {
    "prepare": r"\b(grind|crush|pound|cook|boil|mix|heat|strain|filter|dry|ferment|melt|salt|peel|cut|knead)\b",
    "apply": r"\b(anoint|oil|smear|coat|wash|bathe|drink|eat|rub|sprinkle|dip|wrap|splash|drip)\b",
    "offer": r"\b(libate|offer|slaughter|burn|break|bury|throw|pour|send|carry away|drive)\b",
    "speak": r"\b(speak|conjure|recite|call|cry out|say|address|swear)\b",
}
