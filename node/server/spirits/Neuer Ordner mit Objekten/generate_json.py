import json
import re
from difflib import get_close_matches

MODEL_FILES = [
    "Ebisu.glb","Enenra.glb","Enenra2.glb","Oboroguruma.glb","Oiwa.glb","Okiku.glb","Okomeki.001.glb",
    "Okuninushi.glb","Oni.glb","Onryo.glb","Oyamatsumi.001.glb","Raijin.glb","Rokurokubi.glb","Ryujin.glb",
    "Sarutahiko_Okami.glb","Shinigami.001.glb","Shuten_Doji.glb","Sojobo.glb","Sojobo2.glb","Susanoo.glb",
    "Takeminakata.glb","Takeminakata2.001.glb","Tanuki.glb","Tengu.glb","Tenjin.glb","Tsukumogami.glb",
    "Tsukuyomi_No_Mikoto.glb","Tsurube_Otoshi.glb","Tsurube_Otoshi2.glb","Tsurube_Otoshi3.glb","Tsurube_Otoshi4.glb",
    "Ubume.glb","Yama_Uba.glb","Yama_Uba2.glb","Yamata_No_Orichi.glb","Yamawaro.glb","Yatagarasu2.glb",
    "Yuki_Onna.glb","Yurei.glb","Abe_No_Seimei.glb","Abura_Akago.glb","Abura_Sumashi.glb","Abura_Sumashi2.glb",
    "Aka_Manto.glb","Akaname.glb","Akateko2.glb","Akkorokamui.glb","Akuchu.glb","Amabie2.glb","Amanojaku.glb",
    "Amaterasu.glb","Ame_No_Uzume.001.glb","Amenominakanushi.glb","Aoandon.001.glb","Aoandon2.001.glb",
    "Ashiari_Yashiki.glb","Ashinaga_Tenaga2.glb","Azukiarai.glb","Azukibabaa.glb","Azukihakari.glb",
    "Bake_Kujira.glb","Bake_Kujira2.glb","Bake_Kujira3.glb","Bakezori.glb","Baku.glb","Basan.glb",
    "Benzaiten.glb","Betobeto_San.glb","Bishamonten.glb","Biwa_Bokuboku.glb","Chochin_Obake.glb","Daidarabotchi.glb",
    "Daikokuten+Text.glb","Daikokuten.glb","Fujin.glb","Funayurei.glb","Furaribi.glb","Futakuchi_Onna.glb",
    "Gaki.glb","Gashadokuro.glb","Hachiman.glb","Hiderigami.001.glb","Hitotsume_Kozo.glb","Hoko.glb",
    "Inari_Okami.glb","Ittan_Momen2.glb","Izanagi_No_Mikoto.glb","Izanami_No_Mikoto.glb","Jikininki.glb",
    "Jorogumo3.glb","Kamaitachi.glb","Kamikiri.glb","Kappa.glb","Karakasa_Obake.glb","Karakasa_Obake2.glb",
    "Kitsune.glb","Kodama.glb","Kudan.glb","Mizushi.glb","Mokumokuren.glb","Mujina.glb","Nekomata.glb",
    "Noppera_Bo.glb","Nue.glb","Nuppeppo2.glb","Nurarihyon.glb","Nure_Onna.glb","Nurikabe.glb","Nurikabe2.glb"
]

def normalize(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9]", "", s)
    s = s.replace("ou", "o")  # für "YamatanoOrOchi" vs "Yamata_No_Orichi"
    return s

def generate_candidates(spirit_name):
    base = spirit_name.split()[0]
    latin = re.split(r"\s|\(|（", spirit_name)[0]
    candidates = [latin]
    candidates += [latin.replace("-", "_"), latin.replace("-", ""), latin.replace("_", ""), latin.title(), latin.upper()]
    if not latin.endswith("NoMikoto"):
        candidates.append(latin + "NoMikoto")
        candidates.append(latin + "_No_Mikoto")
    return list(set([normalize(c) for c in candidates]))

def find_best_model(spirit_name):
    candidates = generate_candidates(spirit_name)
    model_names = [f[:-4] for f in MODEL_FILES]
    normalized_models = [normalize(n) for n in model_names]
    results = []
    for c in candidates:
        for i, n in enumerate(normalized_models):
            dist = levenshtein(c, n)
            if dist <= 2 or c in n or n in c:
                results.append(MODEL_FILES[i])
    results = sorted(list(set(results)))
    if not results:
        matches = get_close_matches(candidates[0], normalized_models, n=3, cutoff=0.6)
        models = [MODEL_FILES[normalized_models.index(m)] for m in matches]
        return models
    return results

def levenshtein(a, b):
    if a == b: return 0
    if not a: return len(b)
    if not b: return len(a)
    v0 = list(range(len(b) + 1))
    v1 = [0] * (len(b) + 1)
    for i in range(len(a)):
        v1[0] = i + 1
        for j in range(len(b)):
            cost = 0 if a[i] == b[j] else 1
            v1[j + 1] = min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
        v0, v1 = v1, v0
    return v0[len(b)]

def main():
    with open("spirit_list.json", encoding="utf-8") as f:
        spirits = json.load(f)
    output = []
    for spirit in spirits:
        name = spirit.get("Name", "")
        matches = find_best_model(name)
        if not matches:
            print(f"[!] Kein Modell gefunden für '{name}'!")
            new_spirit = spirit.copy()
            new_spirit["Model URL"] = ""
            output.append(new_spirit)
        elif len(matches) == 1:
            new_spirit = spirit.copy()
            new_spirit["Model URL"] = "/assets/models/spirits/" + matches[0]
            output.append(new_spirit)
        else:
            print(f"\n[?] Mehrere mögliche Modelle für '{name}': {matches}")
            for m in matches:
                new_spirit = spirit.copy()
                new_spirit["Model URL"] = "/assets/models/spirits/" + m
                output.append(new_spirit)
    with open("spirit_list_out.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print("\nFERTIG. Ergebnis: spirit_list_out.json")

if __name__ == "__main__":
    main()