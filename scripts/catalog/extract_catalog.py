"""Extracts the technique catalog from the reviewed spreadsheet into a staging CSV.

Read-only: the .xlsx is never modified. Standard library only (an .xlsx is a zip of XML).
Usage: python -I scripts/catalog/extract_catalog.py

Layout of the source sheets (Básico / Intermediário / Avançado): blocks of columns, each with
a category header cell followed, in the rows below, by "<number> <technique name>" pairs.
Categories change down the sheet when a new header cell appears in the same block.
Hidden sheets (Avaliação, Tempo de Faixa, Planilha2, Planilha3) and 'Material de Estudo' are NOT imported.
"""
import csv
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "references" / "Plano de Treino_Básico ao Avançado.xlsx"
OUT = ROOT / "data" / "catalog" / "techniques_staging.csv"

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
# sheet name -> (level label stored in the catalog, belt written in the sheet header)
SHEETS = {
    "Básico": ("Básico", "BRANCA"),
    "Intermediário": ("Intermediário", "AZUL"),
    "Avançado": ("Avançado", "ROXA"),
}


def col_index(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def load_sheets(path):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    sheets = {}
    for s in wb.find("m:sheets", NS):
        target = rels[s.get("{%s}id" % NS["r"])].lstrip("/")
        part = target if target.startswith("xl/") else "xl/" + target
        rows = {}
        for row in ET.fromstring(z.read(part)).iter("{%s}row" % NS["m"]):
            cells = {}
            for c in row.findall("m:c", NS):
                v = c.find("m:v", NS)
                if c.get("t") == "s" and v is not None:
                    val = shared[int(v.text)]
                elif c.get("t") == "inlineStr":
                    val = "".join(t.text or "" for t in c.iter("{%s}t" % NS["m"]))
                elif v is not None:
                    val = v.text
                else:
                    val = ""
                if clean(val):
                    cells[col_index(c.get("r"))] = clean(val)
            if cells:
                rows[int(row.get("r"))] = cells
        sheets[s.get("name")] = (s.get("state", "visible"), rows)
    return sheets


def is_int(text):
    return re.fullmatch(r"\d+", text) is not None


def extract_sheet(rows):
    """Yield (row, col, number, name, category) for every technique of a sheet."""
    # Columns that hold technique numbers: an integer cell followed by a text cell.
    # A real column repeats on many rows; isolated numbers (e.g. the "Acertos" score) do not.
    hits = {}
    for cells in rows.values():
        for c, v in cells.items():
            nxt = cells.get(c + 1)
            if is_int(v) and nxt and not is_int(nxt):
                hits[c] = hits.get(c, 0) + 1
    number_cols = {c for c, n in hits.items() if n >= 3}

    category = {}  # number column -> current category
    for r in sorted(rows):
        cells = rows[r]
        for c, v in sorted(cells.items()):
            if v.lower() == "x" or is_int(v):
                continue
            after_number = is_int(cells.get(c - 1, ""))
            if after_number and (c - 1) in number_cols:
                continue  # technique name, handled below
            # header cell: belongs to the number column at c or c+1
            group = c if c in number_cols else (c + 1 if (c + 1) in number_cols else None)
            if group is not None:
                category[group] = v
        for c in sorted(number_cols):
            num, name = cells.get(c), cells.get(c + 1)
            if num and is_int(num) and name and not is_int(name):
                if c not in category:
                    raise SystemExit(f"Técnica sem categoria: linha {r}, coluna {c}: {name!r}")
                yield r, c, int(num), name, category[c]


def main():
    sheets = load_sheets(SOURCE)
    records = []
    for sheet, (level, belt) in SHEETS.items():
        state, rows = sheets[sheet]
        if state != "visible":
            raise SystemExit(f"Aba {sheet!r} não está visível; revisar antes de importar.")
        for r, c, number, name, category in extract_sheet(rows):
            records.append(
                {
                    "source_sheet": sheet,
                    "source_row": r,
                    "source_col": c + 1,  # 1-based, like Excel
                    "source_number": number,
                    "raw_name": name,
                    "category": category,
                    "level": level,
                    "belt": belt,
                }
            )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(records[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(records)
    by_sheet = {}
    for rec in records:
        by_sheet[rec["source_sheet"]] = by_sheet.get(rec["source_sheet"], 0) + 1
    print(f"{len(records)} linhas -> {OUT.relative_to(ROOT)}  {by_sheet}")


if __name__ == "__main__":
    sys.exit(main())
