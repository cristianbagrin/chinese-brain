#!/usr/bin/env python3
"""American English for every English string the extension shows.

Used by build_data.py (CC-CEDICT definitions) and build_examples.py (example
translations). Run directly to rewrite the bundled data files in place:

    python3 scripts/american.py
"""
import gzip
import os
import re
import sys

# British -> American spellings. Each key also matches its inflections
# (colours, coloured, colouring ...) through the shared suffix group below.
SPELLING = {
    "colour": "color", "tricolour": "tricolor", "multicolour": "multicolor", "flavour": "flavor", "favourite": "favorite", "behaviour": "behavior",
    "neighbour": "neighbor", "honour": "honor", "humour": "humor", "labour": "labor",
    "harbour": "harbor", "rumour": "rumor", "vapour": "vapor", "odour": "odor", "armour": "armor",
    "endeavour": "endeavor", "savour": "savor", "parlour": "parlor", "splendour": "splendor",
    "vigour": "vigor", "valour": "valor", "rigour": "rigor", "clamour": "clamor", "glamour": "glamor",
    "tumour": "tumor", "saviour": "savior", "fervour": "fervor", "candour": "candor", "ardour": "ardor",
    "centre": "center", "theatre": "theater", "metre": "meter", "litre": "liter", "fibre": "fiber",
    "kilometre": "kilometer", "centimetre": "centimeter", "millimetre": "millimeter", "sombre": "somber",
    "calibre": "caliber", "spectre": "specter", "lustre": "luster", "meagre": "meager", "sabre": "saber",
    "analyse": "analyze", "paralyse": "paralyze", "catalyse": "catalyze",
    "travelled": "traveled", "travelling": "traveling", "traveller": "traveler",
    "cancelled": "canceled", "cancelling": "canceling", "labelled": "labeled", "labelling": "labeling",
    "modelled": "modeled", "modelling": "modeling", "signalled": "signaled", "fuelled": "fueled",
    "levelled": "leveled", "marvellous": "marvelous", "quarrelled": "quarreled", "counsellor": "counselor",
    "jewellery": "jewelry", "woollen": "woolen", "dialled": "dialed", "totalled": "totaled",
    "enrolment": "enrollment", "fulfilment": "fulfillment", "instalment": "installment",
    "skilful": "skillful", "wilful": "willful", "enrol": "enroll", "fulfil": "fulfill", "fulfils": "fulfills",
    "programme": "program", "licence": "license", "defence": "defense", "offence": "offense",
    "pretence": "pretense", "practise": "practice", "practised": "practiced", "practising": "practicing",
    "grey": "gray", "greyish": "grayish", "cheque": "check", "tyre": "tire", "aluminium": "aluminum",
    "cosy": "cozy", "moustache": "mustache", "pyjamas": "pajamas", "plough": "plow", "sceptical": "skeptical",
    "sceptic": "skeptic", "kerb": "curb", "aeroplane": "airplane", "judgement": "judgment", "ageing": "aging",
    "catalogue": "catalog", "manoeuvre": "maneuver", "oestrogen": "estrogen", "foetus": "fetus",
    "anaemia": "anemia", "anaesthetic": "anesthetic", "diarrhoea": "diarrhea", "paediatric": "pediatric",
    "encyclopaedia": "encyclopedia", "mould": "mold", "smoulder": "smolder", "draught": "draft",
    "storey": "story", "whilst": "while", "amongst": "among", "learnt": "learned", "spelt": "spelled",
    "dreamt": "dreamed", "spilt": "spilled", "maths": "math",
}
# -ise verbs that American English writes with -ize (organise, realised, apologising, organisation ...).
IZE = (
    "organi realis recogni apologi critici summari memori emphasi speciali prioriti minimi maximi utili "
    "sympathi civili moderni standardi authori categori characteri finali harmoni hospitali industriali "
    "legali mobili neutrali normali optimi populari privati publici stabili symboli visuali urbani "
    "capitali commerciali centrali colonis immuni fertili sterili tranquilli vandali scrutini agoni "
    "familiari fantasi galvani hypnoti idoli jeopardi localis magnetis mechanis mesmeris monopoli "
    "nationalis naturali oxidis penalis polaris pulveris rationalis revolutionis romantici sensitis "
    "socialis stigmatis subsidis synchronis terroris theoris tyrannis vapori westernis globalis "
    "digitis computeris customis energis criminalis decentralis democratis demoralis desensitis "
    "dramatis economis equalis evangelis externalis formalis fossilis generalis humanis idealis "
    "immortalis individualis internalis legitimis liberalis marginalis materialis militaris "
    "miniaturis motoris neutralis patronis personalis plagiaris politicis prioritis radicalis "
    "regularis reorganis satiris secularis spiritualis sterilis trivialis unionis verbalis"
).split()

SUFFIX = r"(s|es|ed|d|ing|er|ers|ist|ists|ism|ly|hood|hoods|ite|ites|able|ful|less)?"


def _case(src, dst):
    if src.isupper():
        return dst.upper()
    if src[:1].isupper():
        return dst[:1].upper() + dst[1:]
    return dst


_spell = re.compile(r"\b(" + "|".join(sorted(map(re.escape, SPELLING), key=len, reverse=True)) + r")" + SUFFIX + r"\b", re.I)
_ize = re.compile(r"\b(" + "|".join(sorted({s.rstrip("s") for s in IZE}, key=len, reverse=True)) + r")s(e|es|ed|ing|er|ers|ation|ations|able)\b", re.I)

# Words that need context to change, used only on example translations (whole sentences).
PHRASES = [
    (r"\bqueue(s|d)? up\b", lambda m: {"": "line up", "s": "lines up", "d": "lined up"}[(m.group(1) or "").lower()]),
    (r"\bqueuing up\b", "lining up"),
    (r"\bqueuing\b", "waiting in line"),
    (r"\bqueued\b", "lined up"),
    (r"\blong queues?\b", lambda m: "long lines" if m.group(0).lower().endswith("s") else "long line"),
    (r"\bwith queues\b", "with lines"),
    (r"\bqueue to\b", "line up to"),
    (r"\bqueue for\b", "wait in line for"),
    (r"\bqueue as\b", "line up as"),
    (r"\bqueue\b", "line"),
    (r"\bqueues\b", "lines"),
    (r"\bin hospital\b", "in the hospital"),
    (r"\bthe cinema\b", "the movie theater"),
    (r"\bthis cinema\b", "this movie theater"),
    (r"\boutdoor cinema\b", "outdoor movie theater"),
    (r"\bmobile phones?\b", lambda m: "cell phones" if m.group(0).lower().endswith("s") else "cell phone"),
    (r"\bin the bin\b", "in the trash"),
    (r"\bground floor\b", "first floor"),
    (r"\bback garden\b", "backyard"),
    (r"\bMotorbikes\b", "Scooters"),
    (r"\bmotorbikes?\b", lambda m: "scooters" if m.group(0).lower().endswith("s") else "scooter"),
    (r"\bare on holiday\b", "are on break"),
    (r"\bis on holiday\b", "is on vacation"),
    (r"\bon holiday\b", "on vacation"),
    (r"\brubbish\b", "trash"),
    (r"\bpetrol\b", "gas"),
    (r"\btrousers\b", "pants"),
    (r"\bfortnight\b", "two weeks"),
    (r"\bpavement\b", "sidewalk"),
    (r"\blorry\b", "truck"),
    (r"\blorries\b", "trucks"),
    (r"\bmotorway\b", "freeway"),
    (r"\bcar park\b", "parking lot"),
    (r"\btimetable\b", "schedule"),
    (r"\bMum\b", "Mom"),
    (r"\bmum\b", "mom"),
]
_phrases = [(re.compile(p), r) for p, r in PHRASES]


def spelling(text, keep_capitalized=False):
    """American spellings. keep_capitalized leaves proper names alone (Labour Party, Tyre)."""
    def sub(m, table_lookup):
        word = m.group(0)
        if keep_capitalized and word[:1].isupper():
            return word
        return table_lookup(m)

    def spell(m):
        base = SPELLING[m.group(1).lower()]
        suffix = m.group(2) or ""
        if suffix == "d" and not base.endswith("e"):  # centred -> centered, catalogued -> cataloged
            suffix = "ed"
        return _case(m.group(1), base) + suffix

    def ize(m):
        return m.group(1) + ("z" if m.group(0)[len(m.group(1))] == "s" else "Z") + m.group(2)

    text = _spell.sub(lambda m: sub(m, spell), text)
    return _ize.sub(lambda m: sub(m, ize), text)


def sentence(text):
    """Spelling plus the vocabulary that only changes in full sentences (queue -> line)."""
    text = spelling(text)
    for p, r in _phrases:
        text = p.sub(r, text)
    return text


def definition(text):
    """CC-CEDICT definitions: spelling only, proper names untouched."""
    return spelling(text, keep_capitalized=True)


def _rewrite(path, col, fn):
    out, changed = [], 0
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                out.append(line)
                continue
            parts = line.rstrip("\n").split("\t")
            if col < len(parts):
                new = fn(parts[col])
                if new != parts[col]:
                    changed += 1
                    parts[col] = new
            out.append("\t".join(parts) + "\n")
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as f:
        f.writelines(out)
    print(f"{changed} lines changed -> {path}", file=sys.stderr)


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _rewrite(os.path.join(root, "static", "data", "dict.tsv.gz"), 4, definition)
    _rewrite(os.path.join(root, "static", "data", "examples.tsv.gz"), 2, sentence)
