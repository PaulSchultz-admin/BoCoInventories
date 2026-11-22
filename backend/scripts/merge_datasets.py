"""
merge_datasets.py

Merge a cooperator's copy of a dataset ("other") into your copy ("base"),
writing the result to a NEW dataset folder. Neither input is modified.

Records are matched by natural keys, not database IDs (IDs never line up
between independently edited copies):

    species        scientific name (whitespace/case-insensitive)
    fields         field name            categories     category name
    images         image filename        glossary       term
    page content   page name             location photos image filename

Rules:
  * Anything present in only one copy is kept.
  * A value that is blank in one copy and filled in the other takes the
    filled one.
  * A real conflict (both filled, different) keeps BASE's value by default,
    or OTHER's with --prefer other. Every conflict is listed in the report
    so you can fix individual ones by hand afterwards.
  * Species keep base's IDs (display_list.json depends on them); species
    new from other get fresh IDs and other's display lists are remapped.
  * Image files referenced by merged records (species photos, location
    photos, images embedded in page/glossary text) are copied over.
  * Stray leading/trailing whitespace in names is trimmed.

The output folder lives under backend/data/, so the running app picks it up
as its own dataset (e.g. ?dataset=wildflowers-merged) for review. When you're
happy with it, back up the original folder and swap the merged one in.

Usage (from backend/):
    venv/Scripts/python.exe scripts/merge_datasets.py wildflowers wildflowers-live
    venv/Scripts/python.exe scripts/merge_datasets.py wildflowers wildflowers-live --prefer other
    venv/Scripts/python.exe scripts/merge_datasets.py wildflowers wildflowers-live --out wildflowers-merged --dry-run

BASE / OTHER / --out are folder names under backend/data/ or full paths.
A report is written to <out>/merge_report.md (and printed).
"""

import argparse
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import uuid

THIS_FOLDER = os.path.dirname(os.path.abspath(__file__))
DATA_FOLDER = os.path.join(os.path.dirname(THIS_FOLDER), "data")

IMAGE_FIELDS = ["copyright", "date_taken", "location_taken", "comment", "sort_order", "metadata"]


def resolve(p):
    return p if os.path.isabs(p) else os.path.join(DATA_FOLDER, p)


def norm(s):
    return re.sub(r"\s+", " ", (s or "")).strip().casefold()


def clean(s):
    return re.sub(r"\s+", " ", s).strip() if isinstance(s, str) else s


def blank(v):
    return v is None or (isinstance(v, str) and v.strip() == "")


def short(v, n=120):
    s = "" if v is None else str(v).replace("\n", " ")
    return s if len(s) <= n else s[:n] + "…"


class Merger:
    def __init__(self, out_db, other_db, out_imgs, other_imgs, prefer, other_name):
        self.o = out_db      # connection to the output (starts as a copy of base)
        self.s = other_db    # connection to other (read only)
        self.out_imgs, self.other_imgs = out_imgs, other_imgs
        self.prefer_other = prefer == "other"
        self.other_name = other_name
        self.added, self.updated, self.conflicts, self.notes = [], [], [], []
        self.files_to_copy = {}  # other filename -> output filename
        self.id_map = {}         # other wildlife id -> output wildlife id

    # ---- helpers -------------------------------------------------------
    def resolve_value(self, where, base_v, other_v):
        """Return (value_to_store, changed?)."""
        if blank(other_v) or base_v == other_v:
            return base_v, False
        if blank(base_v):
            self.updated.append(f"{where}: filled in from {self.other_name}: {short(other_v)}")
            return other_v, True
        winner = other_v if self.prefer_other else base_v
        self.conflicts.append(
            f"{where}\n    base:  {short(base_v)}\n    other: {short(other_v)}\n"
            f"    → kept {'OTHER' if self.prefer_other else 'BASE'}")
        return winner, self.prefer_other

    def want_file(self, fname):
        """Schedule a file from other's uploaded_images; returns output name."""
        if fname in self.files_to_copy:
            return self.files_to_copy[fname]
        src = os.path.join(self.other_imgs, fname)
        dst = os.path.join(self.out_imgs, fname)
        out_name = fname
        if os.path.exists(dst) and os.path.exists(src):
            if os.path.getsize(dst) != os.path.getsize(src) or open(dst, "rb").read() != open(src, "rb").read():
                out_name = uuid.uuid4().hex + os.path.splitext(fname)[1]
                self.notes.append(f"file name clash for {fname}: different content, copied as {out_name}")
        elif not os.path.exists(src):
            self.notes.append(f"WARNING: {fname} referenced in {self.other_name} but missing from its uploaded_images")
        self.files_to_copy[fname] = out_name
        return out_name

    # ---- structure -----------------------------------------------------
    def merge_categories_and_fields(self):
        o, s = self.o, self.s
        self.cat_map = {}
        base_cats = {norm(n): i for i, n in o.execute("select id, name from Categories")}
        other_cats = s.execute("select id, parent_id, name, field_order from Categories").fetchall()
        # parents first
        for cid, parent, name, _ in sorted(other_cats, key=lambda r: r[1] is not None):
            if norm(name) in base_cats:
                self.cat_map[cid] = base_cats[norm(name)]
            else:
                cur = o.execute("insert into Categories (parent_id, name) values (?, ?)",
                                (self.cat_map.get(parent), clean(name)))
                self.cat_map[cid] = base_cats[norm(name)] = cur.lastrowid
                self.added.append(f"category: {name}")

        self.field_map = {}
        base_fields = {norm(n): (i, t) for i, t, n in o.execute("select id, type, name from Fields")}
        for fid, ftype, name in s.execute("select id, type, name from Fields"):
            if norm(name) in base_fields:
                bid, btype = base_fields[norm(name)]
                if btype != ftype:
                    self.notes.append(f"field '{name}' type differs (base {btype}, other {ftype}); kept base")
                self.field_map[fid] = bid
            else:
                cur = o.execute("insert into Fields (type, name) values (?, ?)", (ftype, clean(name)))
                self.field_map[fid] = cur.lastrowid
                self.added.append(f"field: {name} ({ftype})")
        for fid, cid in s.execute("select field_id, category_id from FieldsToCategories"):
            o.execute("insert or ignore into FieldsToCategories values (?, ?)",
                      (self.field_map[fid], self.cat_map[cid]))

        # append newly added fields to each category's display order
        for cid, _, _, forder in other_cats:
            bcid = self.cat_map[cid]
            row = o.execute("select field_order from Categories where id = ?", (bcid,)).fetchone()
            base_order = json.loads(row[0]) if row and row[0] else []
            other_order = [self.field_map[f] for f in (json.loads(forder) if forder else []) if f in self.field_map]
            new = [f for f in other_order if f not in base_order]
            if new and (base_order or other_order):
                o.execute("update Categories set field_order = ? where id = ?",
                          (json.dumps(base_order + new), bcid))

        self.opt_map = {}
        base_opts = {(f, norm(v)): i for i, f, v in o.execute("select id, field_id, option_value from EnumeratedOptions")}
        for oid, fid, val in s.execute("select id, field_id, option_value from EnumeratedOptions"):
            key = (self.field_map[fid], norm(val))
            if key not in base_opts:
                cur = o.execute("insert into EnumeratedOptions (field_id, option_value) values (?, ?)",
                                (key[0], clean(val)))
                base_opts[key] = cur.lastrowid
                self.added.append(f"enum option: {val}")
            self.opt_map[oid] = base_opts[key]

    # ---- species -------------------------------------------------------
    def merge_species(self):
        o, s = self.o, self.s
        # trim stray whitespace in base names
        for wid, name, sci in o.execute("select id, name, scientific_name from Wildlife").fetchall():
            if clean(name) != name or clean(sci) != sci:
                o.execute("update Wildlife set name = ?, scientific_name = ? where id = ?", (clean(name), clean(sci), wid))
                self.notes.append(f"trimmed whitespace: '{sci}' / '{name}'")

        base_by_sci = {norm(sci): (wid, name) for wid, name, sci in o.execute("select id, name, scientific_name from Wildlife")}
        base_by_name = {norm(name): (wid, sci) for wid, name, sci in o.execute("select id, name, scientific_name from Wildlife")}
        field_names = dict(s.execute("select id, name from Fields"))

        for sid, cat, thumb, name, sci in s.execute(
                "select id, category_id, thumbnail_id, name, scientific_name from Wildlife").fetchall():
            label = f"{clean(sci)} ({clean(name)})"
            if norm(sci) in base_by_sci:
                bid, bname = base_by_sci[norm(sci)]
                self.id_map[sid] = bid
                if norm(bname) != norm(name):
                    v, _ = self.resolve_value(f"{label} — common name", bname, clean(name))
                    o.execute("update Wildlife set name = ? where id = ?", (v, bid))
                is_new = False
            else:
                if norm(name) in base_by_name:
                    self.notes.append(
                        f"'{clean(name)}' exists in base as {base_by_name[norm(name)][1]} but other calls it "
                        f"{clean(sci)} — added as a separate species; check for a scientific-name change")
                    name = f"{clean(name)} ({clean(sci)})"  # common name must be unique
                # never reuse an ID base's display_list.json still mentions
                bid = max([o.execute("select coalesce(max(id), 0) from Wildlife").fetchone()[0],
                           *self.reserved_ids]) + 1
                o.execute("insert into Wildlife (id, category_id, name, scientific_name) values (?, ?, ?, ?)",
                          (bid, self.cat_map[cat], clean(name), clean(sci)))
                self.id_map[sid] = bid
                base_by_sci[norm(sci)] = (bid, clean(name))
                self.added.append(f"species: {label}")
                is_new = True

            # field values
            for fid, val in s.execute("select field_id, value from FieldValues where wildlife_id = ?", (sid,)).fetchall():
                bfid = self.field_map[fid]
                row = o.execute("select value from FieldValues where wildlife_id = ? and field_id = ?", (bid, bfid)).fetchone()
                if row is None:
                    if not blank(val):
                        o.execute("insert into FieldValues values (?, ?, ?)", (bid, bfid, val))
                        if not is_new:
                            self.updated.append(f"{label} [{field_names[fid]}]: added from {self.other_name}")
                else:
                    v, changed = self.resolve_value(f"{label} [{field_names[fid]}]", row[0], val)
                    if changed:
                        o.execute("update FieldValues set value = ? where wildlife_id = ? and field_id = ?", (v, bid, bfid))
            for (oid,) in s.execute("select option_id from EnumeratedFieldValues where wildlife_id = ?", (sid,)).fetchall():
                o.execute("insert or ignore into EnumeratedFieldValues values (?, ?)", (bid, self.opt_map[oid]))

            # images
            img_map = {}
            base_imgs = {os.path.basename(p): (i, p) for i, p in o.execute(
                "select id, image_path from Images where wildlife_id = ?", (bid,))}
            for row in s.execute(f"select id, image_path, {', '.join(IMAGE_FIELDS)} from Images where wildlife_id = ?",
                                 (sid,)).fetchall():
                iid, path, vals = row[0], row[1], dict(zip(IMAGE_FIELDS, row[2:]))
                fname = os.path.basename(path)
                if fname in base_imgs:
                    biid = base_imgs[fname][0]
                    brow = dict(zip(IMAGE_FIELDS, o.execute(
                        f"select {', '.join(IMAGE_FIELDS)} from Images where id = ?", (biid,)).fetchone()))
                    for k in IMAGE_FIELDS:
                        v, changed = self.resolve_value(f"{label} image {fname} [{k}]", brow[k], vals[k])
                        if changed:
                            o.execute(f"update Images set {k} = ? where id = ?", (v, biid))
                    img_map[iid] = biid
                else:
                    out_name = self.want_file(fname)
                    cur = o.execute(
                        f"insert into Images (wildlife_id, image_path, {', '.join(IMAGE_FIELDS)}) values (?, ?, {', '.join('?' * len(IMAGE_FIELDS))})",
                        (bid, out_name, *[vals[k] for k in IMAGE_FIELDS]))
                    img_map[iid] = cur.lastrowid
                    if not is_new:
                        self.added.append(f"image for {label}: {fname}")

            if thumb in img_map:
                bthumb = o.execute("select thumbnail_id from Wildlife where id = ?", (bid,)).fetchone()[0]
                if bthumb is None or is_new:
                    o.execute("update Wildlife set thumbnail_id = ? where id = ?", (img_map[thumb], bid))
                elif bthumb != img_map[thumb]:
                    bp = o.execute("select image_path from Images where id = ?", (bthumb,)).fetchone()
                    v, changed = self.resolve_value(f"{label} thumbnail", bp[0] if bp else None,
                                                    os.path.basename(s.execute("select image_path from Images where id = ?", (thumb,)).fetchone()[0]))
                    if changed:
                        o.execute("update Wildlife set thumbnail_id = ? where id = ?", (img_map[thumb], bid))

    # ---- simple keyed tables ------------------------------------------
    def merge_keyed(self, table, key, value, label):
        o, s = self.o, self.s
        base = {norm(k): (k, v) for k, v in o.execute(f"select {key}, {value} from {table}")}
        for k, v in s.execute(f"select {key}, {value} from {table}").fetchall():
            v = self.rewrite_embedded_images(v)
            if norm(k) not in base:
                o.execute(f"insert into {table} ({key}, {value}) values (?, ?)", (clean(k), v))
                self.added.append(f"{label}: {clean(k)}")
            else:
                bk, bv = base[norm(k)]
                nv, changed = self.resolve_value(f"{label} '{bk}'", bv, v)
                if changed:
                    o.execute(f"update {table} set {value} = ? where {key} = ?", (nv, bk))

    def rewrite_embedded_images(self, text):
        """Schedule copies of uploaded images mentioned in page/glossary text."""
        if not isinstance(text, str) or not os.path.isdir(self.other_imgs):
            return text
        for fname in re.findall(r"[0-9a-f]{32}\.[A-Za-z0-9]+", text):
            if os.path.exists(os.path.join(self.other_imgs, fname)):
                out_name = self.want_file(fname)
                if out_name != fname:
                    text = text.replace(fname, out_name)
        return text

    def merge_location_photos(self):
        o, s = self.o, self.s
        base = {os.path.basename(p) for (p,) in o.execute("select image_path from LocationPhotos")}
        for path, lat, lon, comment in s.execute("select image_path, latitude, longitude, comment from LocationPhotos").fetchall():
            fname = os.path.basename(path)
            if fname not in base:
                o.execute("insert into LocationPhotos (image_path, latitude, longitude, comment) values (?, ?, ?, ?)",
                          (self.want_file(fname), lat, lon, comment))
                self.added.append(f"location photo: {fname}")

    def merge_display_list(self, base_json, other_json):
        def load(p):
            try:
                with open(p, encoding="utf-8") as f:
                    return json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                return None
        b, s = load(base_json), load(other_json)
        if s is None:
            return b
        if b is None:
            b = {"common_ids": [], "lists": {}}
        valid = {i for (i,) in self.o.execute("select id from Wildlife")}
        other_valid = {i for (i,) in self.s.execute("select id from Wildlife")}
        def remap(ids):
            # drop stale IDs that point at no species in other
            return [self.id_map[i] for i in ids if i in other_valid and i in self.id_map]
        for i in remap(s.get("common_ids", [])):
            if i not in b.setdefault("common_ids", []):
                b["common_ids"].append(i)
                self.updated.append(f"display list 'common': added species id {i}")
        for lname, ids in s.get("lists", {}).items():
            cur = b.setdefault("lists", {}).setdefault(lname, [])
            for i in remap(ids):
                if i not in cur:
                    cur.append(i)
                    self.updated.append(f"display list '{lname}': added species id {i}")
        stale = [i for i in b.get("common_ids", []) if i not in valid]
        if stale:
            self.notes.append(f"display_list common_ids contains IDs with no species (left as is): {stale}")
        return b


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base")
    ap.add_argument("other")
    ap.add_argument("--out", help="output dataset folder (default: <base>-merged)")
    ap.add_argument("--prefer", choices=["base", "other"], default="base",
                    help="which copy wins real conflicts (default: base)")
    ap.add_argument("--dry-run", action="store_true", help="report only; write nothing")
    ap.add_argument("--force", action="store_true", help="overwrite an existing output folder")
    args = ap.parse_args()

    base_dir, other_dir = resolve(args.base), resolve(args.other)
    out_dir = resolve(args.out or os.path.basename(os.path.normpath(base_dir)) + "-merged")
    for d in (base_dir, other_dir):
        if not os.path.isfile(os.path.join(d, "database.db")):
            sys.exit(f"No database.db in {d}")
    if os.path.normcase(os.path.abspath(out_dir)) in {os.path.normcase(os.path.abspath(d)) for d in (base_dir, other_dir)}:
        sys.exit("--out must be a new folder, not one of the inputs")

    work = tempfile.mkdtemp(prefix="merge_") if args.dry_run else out_dir
    if not args.dry_run:
        if os.path.exists(out_dir):
            if not args.force:
                sys.exit(f"{out_dir} already exists (use --force to replace it)")
            shutil.rmtree(out_dir)
        os.makedirs(out_dir)
    # copy base's database and flat files (not images yet: copied below)
    for name in os.listdir(base_dir):
        src = os.path.join(base_dir, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(work, name))
    out_imgs = os.path.join(out_dir if not args.dry_run else work, "uploaded_images")
    base_imgs = os.path.join(base_dir, "uploaded_images")
    if not args.dry_run:
        if os.path.isdir(base_imgs):
            shutil.copytree(base_imgs, out_imgs)
        else:
            os.makedirs(out_imgs)

    o = sqlite3.connect(os.path.join(work, "database.db"))
    s = sqlite3.connect(f"file:{os.path.join(other_dir, 'database.db')}?mode=ro", uri=True)
    m = Merger(o, s, out_imgs if not args.dry_run else base_imgs,
               os.path.join(other_dir, "uploaded_images"), args.prefer, os.path.basename(other_dir))
    try:
        with open(os.path.join(base_dir, "display_list.json"), encoding="utf-8") as f:
            dl = json.load(f)
        m.reserved_ids = set(dl.get("common_ids", [])) | {i for ids in dl.get("lists", {}).values() for i in ids}
    except (FileNotFoundError, json.JSONDecodeError):
        m.reserved_ids = set()

    m.merge_categories_and_fields()
    m.merge_species()
    m.merge_keyed("GlossaryTerms", "term", "description", "glossary term")
    m.merge_keyed("PageContent", "page", "content", "page")
    m.merge_location_photos()
    display = m.merge_display_list(os.path.join(base_dir, "display_list.json"),
                                   os.path.join(other_dir, "display_list.json"))

    problems = o.execute("pragma foreign_key_check").fetchall()
    if problems:
        m.notes.append(f"WARNING: foreign key problems: {problems}")
    o.commit()
    counts = {t: o.execute(f"select count(*) from {t}").fetchone()[0]
              for t in ("Wildlife", "Images", "FieldValues", "GlossaryTerms", "PageContent")}
    o.close()

    copied = 0
    if not args.dry_run:
        for src_name, out_name in m.files_to_copy.items():
            src = os.path.join(other_dir, "uploaded_images", src_name)
            dst = os.path.join(out_imgs, out_name)
            if os.path.exists(src) and not os.path.exists(dst):
                shutil.copy2(src, dst)
                copied += 1
        if display is not None:
            with open(os.path.join(out_dir, "display_list.json"), "w", encoding="utf-8") as f:
                json.dump(display, f)
    else:
        shutil.rmtree(work, ignore_errors=True)

    lines = [f"# Merge report: {os.path.basename(base_dir)} + {os.path.basename(other_dir)}",
             "", f"- Output: {'(dry run, nothing written)' if args.dry_run else out_dir}",
             f"- Conflicts resolved in favour of: {args.prefer.upper()}",
             f"- Result: " + ", ".join(f"{k} {v}" for k, v in counts.items()),
             f"- Image files copied from {os.path.basename(other_dir)}: "
             + (str(copied) if not args.dry_run else f"{len(m.files_to_copy)} (would copy)")]
    for title, items in [("Added", m.added), ("Filled in / updated", m.updated),
                         ("Conflicts", m.conflicts), ("Notes", m.notes)]:
        lines += ["", f"## {title} ({len(items)})"] + ([f"- {i}" for i in items] or ["- none"])
    report = "\n".join(lines) + "\n"
    if not args.dry_run:
        with open(os.path.join(out_dir, "merge_report.md"), "w", encoding="utf-8") as f:
            f.write(report)
    sys.stdout.reconfigure(encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
