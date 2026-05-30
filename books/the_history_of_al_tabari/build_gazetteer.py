#!/usr/bin/env python3
"""
Build a place-name gazetteer for the medieval Islamic world covered by
al-Tabari's History, and write it to `gazetteer.json`.

Coordinates are decimal degrees (WGS84), chosen for the historical site where
it differs from the modern city, otherwise the modern city centre. They are
approximate — adequate for a map view at country/region zoom, not survey-grade.

Each entry:
  name    canonical display name
  type    city | region | battle | river | site
  modern  modern location hint
  lat,lon coordinates
  aliases extra surface forms to match, INCLUDING common OCR variants
          (the matcher also auto-derives diacritic/al- variants, so only
           non-obvious spellings need listing here)
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

# name, type, modern, lat, lon, [aliases]
GAZ = [
    # --- Hijaz & Arabia ---
    ("Mecca", "city", "Mecca, Saudi Arabia", 21.4225, 39.8262, ["makkah"]),
    ("Medina", "city", "Medina, Saudi Arabia", 24.4709, 39.6121, ["al-madinah", "madinah", "yathrib"]),
    ("Badr", "battle", "Badr, Saudi Arabia", 23.7800, 38.7906, []),
    ("Uhud", "battle", "Mount Uhud, Medina", 24.5100, 39.6130, []),
    ("Hunayn", "battle", "near Ta'if", 21.4600, 40.2000, []),
    ("Khaybar", "site", "Khaybar, Saudi Arabia", 25.7000, 39.2900, []),
    ("Nakhlah", "site", "between Mecca and Ta'if", 21.5000, 40.2000, []),
    ("al-Ta'if", "city", "Ta'if, Saudi Arabia", 21.2700, 40.4150, ["taif", "ta'if"]),
    ("al-Yamamah", "region", "central Najd, Arabia", 24.1000, 47.3000, ["yamamah"]),
    ("Najran", "city", "Najran, Saudi Arabia", 17.4900, 44.1300, []),
    ("Dumat al-Jandal", "site", "al-Jawf, Saudi Arabia", 29.8120, 39.8670, ["dumah"]),
    ("al-Bahrayn", "region", "eastern Arabia (al-Qatif/al-Hasa)", 26.5600, 49.9960, ["bahrayn", "bahrain"]),
    ("Oman", "region", "Oman (Suhar)", 24.3470, 56.7090, ["uman", "'uman"]),
    ("Yemen", "region", "Yemen (San'a')", 15.3550, 44.2060, ["yaman"]),
    ("Hadramawt", "region", "Hadramawt, Yemen", 15.5000, 48.5000, []),
    ("San'a'", "city", "Sana'a, Yemen", 15.3550, 44.2060, ["sana", "sanaa"]),
    ("al-Hijaz", "region", "Hijaz, western Arabia", 23.5000, 39.5000, ["hijaz"]),

    # --- Iraq ---
    ("Baghdad", "city", "Baghdad, Iraq", 33.3152, 44.3661, []),
    ("al-Kufah", "city", "Kufa, Iraq", 32.0336, 44.4019, ["kufah", "kufa", "kiifah", "kufan", "kufans"]),
    ("al-Basrah", "city", "Basra, Iraq", 30.5085, 47.7836, ["basrah", "basra", "bagrah", "bagra", "bagrans", "basrans"]),
    ("Wasit", "city", "Wasit (near Kut), Iraq", 32.1800, 46.3000, ["wasit"]),
    ("Samarra", "city", "Samarra, Iraq", 34.1980, 43.8740, ["samarra", "surra man ra'a"]),
    ("al-Mada'in", "city", "Ctesiphon/al-Mada'in, Iraq", 33.0900, 44.5800, ["madain", "ctesiphon", "mada'in"]),
    ("al-Anbar", "city", "al-Anbar (near Fallujah), Iraq", 33.3700, 43.6900, ["anbar"]),
    ("al-Hirah", "city", "al-Hira (near Kufa), Iraq", 31.9000, 44.3000, ["hirah", "hira"]),
    ("Karbala", "battle", "Karbala, Iraq", 32.6100, 44.0200, ["karbala", "kerbala"]),
    ("al-Qadisiyyah", "battle", "al-Qadisiyyah (near Kufa)", 31.7100, 44.3600, ["qadisiyyah", "qadisiya"]),
    ("Jalula", "battle", "Jalawla, Iraq", 34.2700, 45.1600, ["jalula", "jalawla"]),
    ("al-Ubullah", "city", "al-Ubulla (near Basra)", 30.5000, 47.9000, ["ubullah"]),
    ("Daskarah", "site", "al-Daskara, Iraq", 33.9700, 44.9300, ["daskarah"]),
    ("al-Nukhaylah", "site", "near Kufa", 32.1000, 44.3500, ["nukhaylah"]),
    ("al-Madhar", "battle", "Maysan, Iraq", 31.7000, 47.1500, ["madhar"]),
    ("Dayr al-Jathaliq", "battle", "near al-Anbar, Iraq", 33.6000, 43.9000, []),
    ("Kaskar", "city", "Kaskar (near Wasit), Iraq", 32.0000, 46.0000, ["kaskar"]),
    ("Dhu Qar", "battle", "Dhu Qar (SE of Kufa)", 30.9700, 46.1000, ["dhu qar", "dhi qar"]),
    ("al-Khawarnaq", "site", "al-Khawarnaq (near al-Hira)", 31.9500, 44.4000, ["khawarnaq"]),
    ("Shahrazur", "city", "Sharazor (Iraqi Kurdistan)", 35.4000, 45.8500, ["shahrazur", "sharazor"]),
    ("Qarqisiya", "city", "Circesium (Khabur-Euphrates)", 35.1600, 40.4300, ["qarqisiya", "qarqisiya'", "circesium"]),
    ("Balanjar", "battle", "Balanjar (Khazar frontier, Dagestan)", 42.5000, 47.0000, ["balanjar"]),

    # --- the Jazirah & northern Mesopotamia ---
    ("al-Jazirah", "region", "Upper Mesopotamia", 36.5000, 40.5000, ["jazirah"]),
    ("Mosul", "city", "Mosul, Iraq", 36.3400, 43.1300, ["al-mawsil", "mawsil"]),
    ("Nisibis", "city", "Nusaybin, Turkey", 37.0700, 41.2200, ["nasibin", "nisibin"]),
    ("Harran", "city", "Harran, Turkey", 36.8600, 39.0300, ["harran"]),
    ("al-Raqqah", "city", "Raqqa, Syria", 35.9500, 39.0100, ["raqqah", "raqqa"]),
    ("the Zab", "battle", "Great Zab river (battle of 750)", 36.0700, 43.4600, ["zab", "great zab"]),
    ("Sinjar", "city", "Sinjar, Iraq", 36.3200, 41.8700, []),

    # --- Syria & the Levant ---
    ("Syria", "region", "Greater Syria (al-Sham)", 34.5000, 37.5000, ["al-sham", "sham"]),
    ("Damascus", "city", "Damascus, Syria", 33.5138, 36.2765, ["dimashq"]),
    ("Hims", "city", "Homs, Syria", 34.7300, 36.7100, ["hims", "homs", "emesa"]),
    ("Aleppo", "city", "Aleppo, Syria", 36.2000, 37.1600, ["halab"]),
    ("Qinnasrin", "city", "Qinnasrin (south of Aleppo)", 35.9900, 37.0500, ["qinnasrin", "chalcis"]),
    ("Antioch", "city", "Antakya, Turkey", 36.2000, 36.1600, ["antakiyah", "antakya"]),
    ("Siffin", "battle", "Siffin (on the Euphrates)", 35.9500, 39.0000, ["siffin"]),
    ("Marj Rahit", "battle", "near Damascus", 33.6000, 36.5000, ["marj rahit", "marj rahil"]),
    ("al-Yarmuk", "battle", "Yarmouk river (battle of 636)", 32.7200, 35.9500, ["yarmuk", "yarmouk"]),
    ("Ajnadayn", "battle", "Ajnadayn, Palestine", 31.7000, 34.9000, ["ajnadayn"]),
    ("Fihl", "battle", "Pella, Jordan", 32.4500, 35.6100, ["fihl", "pella", "fahl"]),
    ("Jerusalem", "city", "Jerusalem", 31.7800, 35.2300, ["bayt al-maqdis", "iliya", "aelia"]),
    ("al-Ramlah", "city", "Ramla, Palestine", 31.9300, 34.8700, ["ramlah"]),
    ("Tiberias", "city", "Tiberias", 32.7900, 35.5300, ["tabariyyah"]),
    ("Caesarea", "city", "Caesarea Maritima", 32.5000, 34.9000, ["qaysariyyah"]),

    # --- Egypt & North Africa ---
    ("Egypt", "region", "Egypt (Fustat)", 30.0070, 31.2300, ["misr", "fustat", "al-fustat"]),
    ("Alexandria", "city", "Alexandria, Egypt", 31.2000, 29.9200, ["al-iskandariyyah"]),
    ("Ifriqiya", "region", "Ifriqiya (Tunisia)", 35.5000, 9.5000, ["ifriqiyah"]),
    ("al-Qayrawan", "city", "Kairouan, Tunisia", 35.6800, 10.1000, ["qayrawan", "kairouan"]),
    ("the Maghrib", "region", "the Maghrib (NW Africa)", 33.5000, -6.0000, ["maghrib", "morocco"]),
    ("al-Andalus", "region", "al-Andalus (Iberia)", 37.8800, -4.7800, ["andalus", "cordoba", "cordova"]),

    # --- al-Jibal, Persian Iraq & the west of Iran ---
    ("al-Rayy", "city", "Rayy (near Tehran)", 35.5900, 51.4300, ["rayy", "rai", "ray"]),
    ("Nihawand", "battle", "Nahavand, Iran", 34.1900, 48.3700, ["nihawand", "nahavand"]),
    ("Hulwan", "city", "Hulwan (Sarpol-e Zahab)", 34.4500, 45.8500, ["hulwan"]),
    ("Hamadhan", "city", "Hamadan, Iran", 34.8000, 48.5000, ["hamadan", "hamadhan", "ecbatana"]),
    ("Dinawar", "city", "Dinavar, Iran", 34.6000, 47.4000, ["dinawar"]),
    ("Isbahan", "city", "Isfahan, Iran", 32.6500, 51.6700, ["isfahan", "isbahan", "ispahan"]),
    ("Qom", "city", "Qom, Iran", 34.6400, 50.8800, ["qum", "qomm"]),

    # --- Khuzistan, Fars, Kirman ---
    ("al-Ahwaz", "city", "Ahvaz, Iran", 31.3200, 48.6700, ["ahwaz", "ahvaz"]),
    ("Khuzistan", "region", "Khuzestan, Iran", 31.3000, 49.0000, ["khuzistan", "ahwaz region"]),
    ("Fars", "region", "Fars, Iran", 29.6000, 52.5000, ["fars", "pars", "persis"]),
    ("Shiraz", "city", "Shiraz, Iran", 29.6000, 52.5300, ["shiraz"]),
    ("Istakhr", "city", "Istakhr (near Persepolis)", 29.9800, 52.9000, ["istakhr"]),
    ("Kirman", "region", "Kerman, Iran", 30.2800, 57.0800, ["kirman", "kerman"]),

    # --- the Caspian provinces & Caucasus ---
    ("Tabaristan", "region", "Tabaristan (Mazandaran)", 36.4000, 52.5000, ["tabaristan", "tabaristin"]),
    ("Jurjan", "city", "Gorgan, Iran", 36.8400, 54.4400, ["jurjan", "gurgan", "gorgan"]),
    ("Qumis", "region", "Qumis (Damghan)", 36.1700, 54.3500, ["qumis", "damghan"]),
    ("al-Daylam", "region", "Daylam (Gilan)", 36.9000, 49.8000, ["daylam"]),
    ("Adharbayjan", "region", "Azerbaijan (NW Iran)", 37.8000, 46.3000, ["adharbayjan", "azerbaijan", "azarbayjan"]),
    ("Armenia", "region", "Armenia", 40.0000, 44.5000, ["arminiyah"]),
    ("Barda'ah", "city", "Barda, Azerbaijan", 40.3700, 47.1300, ["bardaah", "barda'a", "bardha'ah"]),
    ("Dabil", "city", "Dvin, Armenia", 40.0000, 44.5800, ["dabil", "dvin"]),
    ("Tiflis", "city", "Tbilisi, Georgia", 41.7000, 44.8000, ["tiflis"]),
    ("the Khazars", "region", "Khazar lands (lower Volga)", 47.0000, 47.0000, ["khazar", "khazars"]),

    # --- Khurasan & the east ---
    ("Khurasan", "region", "Khurasan (NE Iran/Central Asia)", 36.3000, 59.6000, ["khurasan", "khurasin", "khurisin", "khurisan", "khur3san", "khorasan"]),
    ("Nishapur", "city", "Nishapur, Iran", 36.2100, 58.7900, ["nishapur", "naysabur", "nisabur"]),
    ("Tus", "city", "Tus (near Mashhad)", 36.4800, 59.6000, ["tus"]),
    ("Sarakhs", "city", "Sarakhs", 36.5400, 61.1600, ["sarakhs"]),
    ("Abiward", "city", "Abivard, Turkmenistan", 37.9000, 59.0000, ["abiward", "abaward"]),
    ("Marw", "city", "Merv, Turkmenistan", 37.6600, 62.1900, ["marw", "merv", "marv"]),
    ("Herat", "city", "Herat, Afghanistan", 34.3500, 62.2000, ["harat", "herat"]),
    ("Balkh", "city", "Balkh, Afghanistan", 36.7600, 66.9000, ["balkh"]),
    ("Sijistan", "region", "Sistan (Zaranj)", 31.0000, 61.5000, ["sijistan", "sijistin", "sistan", "sagistan"]),
    ("Kabul", "city", "Kabul, Afghanistan", 34.5500, 69.2000, ["kabul"]),
    ("Tukharistan", "region", "Tokharistan (upper Oxus)", 36.7000, 68.0000, ["tukharistan", "tokharistan"]),
    ("al-Khuttal", "region", "Khuttal (SW Tajikistan)", 37.9000, 69.8000, ["khuttal", "khuttalan"]),

    # --- Transoxania (ma wara' al-nahr) ---
    ("Transoxania", "region", "Transoxania (between Oxus & Jaxartes)", 39.7000, 65.7000, ["ma wara al-nahr", "transoxiana", "soghd", "sughd"]),
    ("Bukhara", "city", "Bukhara, Uzbekistan", 39.7700, 64.4200, ["bukhara", "bukhar"]),
    ("Samarqand", "city", "Samarkand, Uzbekistan", 39.6500, 66.9600, ["samarqand", "samarkand"]),
    ("Khwarazm", "region", "Khwarazm (Khiva)", 41.3780, 60.3640, ["khwarazm", "khwarazm", "khorezm"]),
    ("al-Shash", "city", "Tashkent", 41.3000, 69.3000, ["shash", "shish", "tashkent", "chach"]),
    ("Kashghar", "city", "Kashgar, Xinjiang", 39.4700, 75.9900, ["kashghar", "kashgar"]),
    ("Farghanah", "region", "Fergana valley", 40.4000, 71.8000, ["farghanah", "fergana", "ferghana"]),
    ("Khujandah", "city", "Khujand, Tajikistan", 40.2800, 69.6200, ["khujandah", "khujand"]),
    ("Nasaf", "city", "Nasaf (Qarshi)", 38.8600, 65.7900, ["nasaf", "nakhshab"]),
    ("Kish", "city", "Kesh (Shahrisabz)", 39.0500, 66.8300, ["kish", "kashsh"]),
    ("Tirmidh", "city", "Termez, Uzbekistan", 37.2200, 67.2800, ["tirmidh", "termez", "termidh"]),

    # --- Sind & India ---
    ("Sind", "region", "Sindh (lower Indus)", 26.0000, 68.5000, ["sind", "sindh"]),
    ("Daybul", "city", "Debal (Indus delta)", 24.0000, 67.0000, ["daybul", "debal"]),
    ("Multan", "city", "Multan, Pakistan", 30.2000, 71.5000, ["multan"]),

    # --- Anatolia / Byzantine frontier ---
    ("Tarsus", "city", "Tarsus, Turkey", 36.9200, 34.8900, ["tarsus"]),
    ("the Byzantines", "region", "Byzantine Anatolia", 39.0000, 33.0000, ["byzantines", "byzantium", "rum", "al-rum"]),
    ("Constantinople", "city", "Istanbul", 41.0100, 28.9800, ["qustantiniyyah", "constantinople"]),
    ("Amorium", "battle", "Amorium, Anatolia", 39.0200, 31.3000, ["ammuriyah", "amorium"]),
    ("Malatya", "city", "Malatya, Turkey", 38.3500, 38.3000, ["malatiyah", "melitene"]),

    # --- broad regional umbrellas ---
    ("Iraq", "region", "Iraq", 32.5000, 44.5000, ["al-iraq"]),
    ("Persia", "region", "Iran (Persia)", 32.0000, 53.0000, ["persia", "iran", "fars empire"]),
]


def main():
    out = []
    for name, typ, modern, lat, lon, aliases in GAZ:
        out.append({
            "name": name, "type": typ, "modern": modern,
            "lat": lat, "lon": lon, "aliases": aliases,
        })
    path = HERE / "gazetteer.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"Wrote {len(out)} places -> {path}")


if __name__ == "__main__":
    main()
