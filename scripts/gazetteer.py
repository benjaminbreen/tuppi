"""Hand-curated gazetteer for places named in TLHdig.

Keys are TLHdig's normalized place glosses (several spellings can map to one place).
Coordinates are for drawing, not for citing:

  conf  site      identification generally accepted (usually texts found on the site); point = the site
        proposed  a specific site has been proposed but is debated; point = the proposed site
        region    a land or region whose extent is only broadly known; point = a label anchor, not a location
        river     a river whose identification is accepted; point = snapped onto the modern river
        offmap    outside the map frame; drawn as an arrow at the frame edge

Where a lat/lon comes from Wikidata the item is given in `wd`. Places not listed here are
shown in the "not located" list — for most Hittite toponyms the location is simply unknown.
"""

# key: (display name, kind, conf, lat, lon, modern / note, wikidata, [extra TLHdig gloss keys])
G = {
    # --- capital and core ---------------------------------------------------------------
    "Ḫattuša": ("Ḫattuša", "city", "site", 40.0197, 34.6153, "Boğazköy (Boğazkale). Includes mentions of the land of Ḫatti.", "Q181007",
               ["Ḫatti", "Ḫattuša-"]),
    "Šapinuwa": ("Šapinuwa", "city", "site", 40.2528, 35.2375, "Ortaköy (Çorum); archive found on site.", "Q3620", []),
    "Šare/išša": ("Šarišša", "city", "site", 39.3083, 36.9097, "Kuşaklı (Sivas); tablets found on site.", "Q1040082", []),
    "Tapik(k)a": ("Tapikka", "city", "site", 40.1483, 35.7622, "Maşat Höyük (Tokat); letter archive found on site.", "Q3303460", []),
    "Šamuḫa": ("Šamuḫa", "city", "site", 39.6103, 36.5103, "Kayalıpınar (Sivas); identification widely accepted.", "Q1352918", []),
    "Nerik": ("Nerik", "city", "site", 41.2051, 35.4394, "Oymaağaç Höyük (Vezirköprü); identification from tablets found on site. Point at the modern village.", "Q7116284",
              ["Gebiet von Nerik"]),
    "Kane/iš": ("Kaneš / Neša", "city", "site", 38.85, 35.6333, "Kültepe (Kayseri).", "Q538605", ["Neša"]),
    "Tuwanuwa": ("Tuwanuwa", "city", "site", 37.8234, 34.5705, "Classical Tyana (Kemerhisar).", "Q1423615", []),
    "Ḫupi(š)na": ("Ḫupišna", "city", "site", 37.5058, 34.0517, "Classical Cybistra (Ereğli, Konya).", "Q2372030", []),
    "Adaniya": ("Adaniya", "city", "site", 36.9864, 35.3253, "Adana.", "Q38545", []),
    "Tarša": ("Tarša", "city", "site", 36.9167, 34.9, "Tarsus.", "Q134287", []),
    "Apaša": ("Apaša", "city", "site", 37.9397, 27.3408, "Ephesus; capital of Arzawa.", "Q47611", []),
    # --- proposed sites -----------------------------------------------------------------
    "Arinna": ("Arinna", "city", "proposed", 40.2339, 34.6956, "Location unknown, about a day's journey from Ḫattuša. Alaca Höyük is one proposal among several.", "Q558861", []),
    "Zip(p)(a)l(an)ta": ("Zippalanda", "city", "proposed", 39.8131, 35.0526, "Uşaklı Höyük (Yozgat) proposed by its excavators; Mount Daḫa = Kerkenes Dağ.", "Q114635661", []),
    "Ankuwa": ("Ankuwa", "city", "proposed", 39.6061, 35.2614, "Alişar Höyük proposed.", "Q9148422", []),
    "Tau(i)niya": ("Tawiniya", "city", "proposed", 39.8589, 34.5068, "Classical Tavium (Büyüknefes) proposed.", "Q1413514", []),
    "Kumman(n)i": ("Kummanni", "city", "proposed", 38.33, 36.30, "Traditionally classical Comana (Şar); debated. Cult centre of Kizzuwatna. Point approximate.", None, []),
    "Ḫakmiš": ("Ḫakmiš", "city", "proposed", 40.65, 35.8333, "Usually placed at or near Amasya.", "Q170532", []),
    "Zalpa": ("Zalpa", "city", "proposed", 41.6140, 35.8706, "On the Black Sea near the mouth of the Kızılırmak; İkiztepe proposed.", "Q6098838", []),
    "Purušḫanta": ("Purušḫanda", "city", "proposed", 38.4116, 33.8355, "Acemhöyük proposed (others prefer Karahöyük-Konya).", "Q8438175", []),
    "Ura": ("Ura", "city", "proposed", 36.3783, 33.9261, "Port on the Cilician coast, near Silifke.", "Q650630", []),
    "Waššukanni": ("Waššukanni", "city", "proposed", 36.84, 40.0687, "Capital of Mittani; Tell Fakhariya proposed.", "Q1149666", []),
    # --- Syria, Mesopotamia -------------------------------------------------------------
    "Karkamiš": ("Karkamiš", "city", "site", 36.8297, 38.015, "Carchemish (Jerablus / Karkamış).", "Q283680", []),
    "Ḫalab": ("Ḫalab", "city", "site", 36.2, 37.16, "Aleppo.", "Q41183", []),
    "Ugarit": ("Ugarit", "city", "site", 35.6019, 35.7856, "Ras Shamra.", "Q191369", []),
    "Alalaḫ": ("Alalaḫ", "city", "site", 36.2378, 36.3847, "Tell Atchana.", "Q575249", []),
    "Aštata": ("Aštata", "land", "region", 35.9872, 38.1102, "Land on the middle Euphrates; capital Emar (Meskene).", "Q1196243", ["Emar"]),
    "Kenza": ("Kinza", "city", "site", 34.5576, 36.52, "Qadesh (Tell Nebi Mend).", "Q690035", []),
    "Aššur": ("Aššur", "city", "site", 35.4567, 43.2625, "Qal'at Sherqat.", "Q200200", []),
    "Ninuwa": ("Ninuwa", "city", "site", 36.3594, 43.1528, "Nineveh.", "Q5680", ["von Ninuwa"]),
    # --- regions ------------------------------------------------------------------------
    "Kizuwatna": ("Kizzuwatna", "land", "region", 37.35, 35.55, "Cilicia and the Anti-Taurus.", None, ["von Kizzuwatna"]),
    "Kaška": ("Kaška", "land", "region", 41.05, 34.9, "Peoples of the Pontic highlands north of Ḫattuša.", None, []),
    "Arzawa": ("Arzawa", "land", "region", 38.35, 28.4, "Western Anatolia; capital Apaša (Ephesus).", None, ["Arzawiya"]),
    "Mi/era": ("Mira", "land", "region", 38.55, 30.0, "West-central Anatolia, upper Maeander.", None, []),
    "Ḫapalla": ("Ḫapalla", "land", "region", 38.0, 31.25, "East of Mira, perhaps the Lake District.", None, []),
    "Šeḫa": ("Šeḫa River Land", "land", "region", 39.05, 27.75, "North-western Anatolia (Caicus / Hermus valleys).", None, []),
    "Lukka": ("Lukka", "land", "region", 36.65, 29.8, "Later Lycia and Pamphylia.", None, []),
    "Pala": ("Pala", "land", "region", 41.25, 33.4, "Later Paphlagonia.", None, []),
    "Išuwa": ("Išuwa", "land", "region", 38.72, 39.25, "Upper Euphrates, around Elazığ.", None, []),
    "Ḫayaša": ("Ḫayaša–Azzi", "land", "region", 39.95, 40.3, "North-eastern Anatolia.", None, ["Azzi"]),
    "Ḫurri": ("Ḫurri / Mittani", "land", "region", 36.75, 40.7, "The Hurrian lands of the upper Ḫabur; the kingdom of Mittani.", None, ["Mittanni"]),
    "Amurru": ("Amurru", "land", "region", 34.65, 36.1, "Coastal Syria and Lebanon.", None, ["Amurri"]),
    "Nuḫašša": ("Nuḫašše", "land", "region", 35.4, 36.95, "Between the Orontes and the Euphrates, south of Aleppo.", None, []),
    "Amka": ("Amka", "land", "region", 33.85, 35.95, "The Beqaa valley.", None, []),
    "Alašiya": ("Alašiya", "land", "region", 35.1, 33.35, "Cyprus, or part of it.", None, []),
    "Oberes Land": ("Upper Land", "land", "region", 39.85, 37.35, "East of Ḫattuša, around Šamuḫa.", None, []),
    "Unteres Land": ("Lower Land", "land", "region", 37.95, 33.3, "South of the Kızılırmak, the Konya plain.", None, []),
    "Tarḫuntašša": ("Tarḫuntašša", "land", "region", 37.25, 33.15, "South-central Anatolia; capital unlocated.", None, []),
    "Ḫulaya": ("Ḫulaya River Land", "land", "region", 37.45, 32.45, "West of the Lower Land (Çarşamba basin?).", None, []),
    # --- rivers -------------------------------------------------------------------------
    "Mala": ("Mala (Euphrates)", "river", "river", 37.55, 38.45, "The Euphrates.", None, []),
    "Maraš(š)anta": ("Maraššanta (Kızılırmak)", "river", "river", 38.72, 34.85, "The Halys / Kızılırmak.", None, ["Maraššantiya", "Maraš(š)antiya"]),
    # --- beyond the frame ---------------------------------------------------------------
    "Mizri": ("Egypt", "land", "offmap", 29.85, 31.25, "Mizri.", None, []),
    "Babylon": ("Babylon", "city", "offmap", 32.5425, 44.4211, "Babylon; also Karduniya (Babylonia).", "Q5684", ["Kar(an)duniya"]),
    "Aḫḫiya(wa)": ("Aḫḫiyawa", "land", "offmap", 37.73, 22.76, "Probably Mycenaean Greece.", None, []),
    "Elam": ("Elam", "land", "offmap", 32.19, 48.25, "South-western Iran.", None, []),
}

# gloss strings that are not places (language adverbs, ethnic adjectives, generic nouns)
NOT_PLACES = {
    "auf Hattisch", "hattisch", "auf Palaisch", "auf Hurritisch", "auf Luwisch", "hurritisch", "luwisch", "palaisch",
    "Ruinenhügel", "(gen. c.)", "Stadt", "Land", "Berg", "Fluss", "Quelle", "",
}
