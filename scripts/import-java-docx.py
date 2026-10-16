#!/usr/bin/env python3
"""Convert the retained Java Word source to the shared original-document schema.

This is a read-only source conversion: body order, text runs, list levels, tables,
embedded images, source heading styles and code indentation are retained. Chapter
boundaries are navigational groups, never summaries or rewritten source content.
Run with the bundled workspace Python runtime from the sde2prep project root.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import posixpath
import re
from collections import Counter
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as ET

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "v": "urn:schemas-microsoft-com:vml",
}
W = "{" + NS["w"] + "}"


def value(node, attr="val", default=None):
    return node.get(W + attr, default) if node is not None else default


def color(hex_value):
    if not hex_value or not re.fullmatch(r"[0-9a-fA-F]{6}", hex_value):
        return None
    channels = [int(hex_value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return {"color": {"rgbColor": dict(zip(("red", "green", "blue"), channels))}}


def merge_properties(*nodes):
    result = {}
    for node in nodes:
        if node is not None:
            for child in node:
                result[ET.QName(child).localname] = child
    return result


class Converter:
    def __init__(self, source: Path, root: Path):
        self.source, self.root = source, root
        self.zip = ZipFile(source)
        self.document = ET.fromstring(self.zip.read("word/document.xml"))
        self.styles_root = ET.fromstring(self.zip.read("word/styles.xml"))
        self.styles = {s.get(W + "styleId"): s for s in self.styles_root.findall("w:style", NS)}
        self.relationships = {
            r.get("Id"): r for r in ET.fromstring(self.zip.read("word/_rels/document.xml.rels"))
        }
        self.defaults = self.styles_root.find("w:docDefaults/w:rPrDefault/w:rPr", NS)
        self.pdefaults = self.styles_root.find("w:docDefaults/w:pPrDefault/w:pPr", NS)
        self.inline_objects = {}
        self.lists = self.read_lists()
        self.index = 1
        self.paragraphs = []
        self.image_sequence = []
        self.source_image_sequence = [
            b.get("{" + NS["r"] + "}embed") for b in self.document.findall(".//a:blip", NS)
        ]
        self.stats = Counter()

    def read_lists(self):
        numbering = ET.fromstring(self.zip.read("word/numbering.xml"))
        definitions = {a.get(W + "abstractNumId"): a for a in numbering.findall("w:abstractNum", NS)}
        lists = {}
        glyphs = {"decimal": "DECIMAL", "lowerLetter": "ALPHA", "upperLetter": "UPPER_ALPHA",
                  "lowerRoman": "ROMAN", "upperRoman": "UPPER_ROMAN"}
        for num in numbering.findall("w:num", NS):
            abstract = definitions.get(value(num.find("w:abstractNumId", NS)))
            if abstract is None:
                continue
            levels = []
            for level in abstract.findall("w:lvl", NS):
                fmt = value(level.find("w:numFmt", NS))
                item = {"startNumber": int(value(level.find("w:start", NS), default="1")),
                        "glyphType": glyphs.get(fmt, "GLYPH_TYPE_UNSPECIFIED")}
                symbol = value(level.find("w:lvlText", NS))
                if symbol:
                    item["glyphSymbol"] = symbol
                levels.append(item)
            lists["java-list-" + num.get(W + "numId")] = {"listProperties": {"nestingLevels": levels}}
        return lists

    def style_chain(self, style_id, tag):
        chain, seen = [], set()
        while style_id and style_id not in seen:
            seen.add(style_id)
            s = self.styles.get(style_id)
            if s is None:
                break
            chain.insert(0, s.find("w:" + tag, NS))
            style_id = value(s.find("w:basedOn", NS))
        return chain

    def text_style(self, props):
        result = {}
        for key, target in (("b", "bold"), ("i", "italic"), ("strike", "strikethrough")):
            if key in props:
                result[target] = value(props[key], default="true") not in ("0", "false", "off")
        if "u" in props:
            result["underline"] = value(props["u"], default="single") not in ("none", "0", "false")
        if "sz" in props:
            result["fontSize"] = {"magnitude": float(value(props["sz"])) / 2}
        if "rFonts" in props:
            font = value(props["rFonts"], "ascii") or value(props["rFonts"], "hAnsi")
            if font:
                result["weightedFontFamily"] = {"fontFamily": font}
        foreground = color(value(props.get("color")))
        if foreground:
            result["foregroundColor"] = foreground
        background = color(value(props.get("shd"), "fill"))
        if "highlight" in props:
            background = color({"yellow": "ffff00", "green": "00ff00", "cyan": "00ffff",
                                "magenta": "ff00ff", "blue": "0000ff", "red": "ff0000",
                                "lightGray": "d3d3d3", "darkGray": "a9a9a9"}.get(value(props["highlight"]))) or background
        if background:
            result["backgroundColor"] = background
        if "vertAlign" in props:
            result["baselineOffset"] = {"superscript": "SUPERSCRIPT", "subscript": "SUBSCRIPT"}.get(value(props["vertAlign"]), "NORMAL")
        return result

    def image(self, drawing):
        result = []
        for blip in drawing.findall(".//a:blip", NS):
            rid = blip.get("{" + NS["r"] + "}embed")
            rel = self.relationships.get(rid)
            if rel is None:
                raise ValueError("Missing embedded image relationship")
            target = posixpath.normpath(posixpath.join("word", rel.get("Target")))
            data = self.zip.read(target)
            filename = "java-" + Path(target).name
            dest = self.root / "public" / "diagrams" / filename
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            object_id = "java-image-" + str(len(self.inline_objects) + 1)
            extent = drawing.find(".//wp:extent", NS)
            props = drawing.find(".//wp:docPr", NS)
            embedded = {"title": (props.get("descr") or props.get("name")) if props is not None else filename,
                        "imageProperties": {"localPath": "/diagrams/" + filename}}
            if extent is not None:
                embedded["size"] = {"width": {"magnitude": int(extent.get("cx")) / 12700},
                                    "height": {"magnitude": int(extent.get("cy")) / 12700}}
            self.inline_objects[object_id] = {"inlineObjectProperties": {"embeddedObject": embedded}}
            result.append({"inlineObjectElement": {"inlineObjectId": object_id}})
            self.image_sequence.append(rid)
            self.stats["images"] += 1
        return result

    def paragraph(self, node):
        start = self.index
        ppr = node.find("w:pPr", NS)
        style_id = value(node.find("w:pPr/w:pStyle", NS), default="Normal")
        properties = merge_properties(self.pdefaults, *self.style_chain(style_id, "pPr"), ppr)
        run_bases = [self.defaults, *self.style_chain(style_id, "rPr")]
        ps = {}
        if style_id == "Title":
            ps["namedStyleType"] = "HEADING_1"
        elif re.fullmatch(r"Heading[1-6]", style_id):
            ps["namedStyleType"] = "HEADING_" + str(min(6, int(style_id[-1]) + 1))
        if "jc" in properties:
            ps["alignment"] = {"center": "CENTER", "right": "END", "both": "JUSTIFIED"}.get(value(properties["jc"]), "START")
        if "spacing" in properties:
            for attr, name in (("before", "spaceAbove"), ("after", "spaceBelow")):
                val = value(properties["spacing"], attr)
                if val is not None:
                    ps[name] = {"magnitude": float(val) / 20}
        if "ind" in properties:
            indent = value(properties["ind"], "left")
            if indent:
                ps["indentStart"] = {"magnitude": float(indent) / 20}
        elements = []

        def emit_text(text, style):
            if not text:
                return
            if elements and elements[-1].get("textRun", {}).get("textStyle") == style:
                elements[-1]["textRun"]["content"] += text
            else:
                elements.append({"textRun": {"content": text, "textStyle": style}})

        def walk_inline(parent, link=None):
            for child in parent:
                tag = ET.QName(child).localname
                if tag == "r":
                    rpr = child.find("w:rPr", NS)
                    rstyle = value(child.find("w:rPr/w:rStyle", NS))
                    run_style = self.text_style(merge_properties(*run_bases, *self.style_chain(rstyle, "rPr"), rpr))
                    if link and re.match(r"^(https?://|mailto:)", link, re.I):
                        run_style["link"] = {"url": link}
                    for item in child:
                        itag = ET.QName(item).localname
                        if itag == "t":
                            emit_text(item.text or "", run_style)
                        elif itag == "tab":
                            emit_text("\t", run_style)
                        elif itag in ("br", "cr"):
                            emit_text("\n", run_style)
                        elif itag == "drawing":
                            elements.extend(self.image(item))
                        elif itag == "pict" and item.find("v:rect", NS) is not None:
                            elements.append({"horizontalRule": {}})
                            self.stats["horizontalRules"] += 1
                elif tag == "hyperlink":
                    rel = self.relationships.get(child.get("{" + NS["r"] + "}id"))
                    target = rel.get("Target") if rel is not None else None
                    walk_inline(child, target)
                elif tag in ("sdt", "sdtContent", "smartTag", "ins", "customXml"):
                    walk_inline(child, link)

        walk_inline(node)
        # A terminal newline represents each Word paragraph without changing its text.
        elements.append({"textRun": {"content": "\n"}})
        paragraph = {"elements": elements, "sourceStyleId": style_id}
        if ps:
            paragraph["paragraphStyle"] = ps
        numpr = properties.get("numPr")
        if numpr is not None:
            num_id = value(numpr.find("w:numId", NS))
            if num_id and num_id != "0":
                paragraph["bullet"] = {"listId": "java-list-" + num_id,
                                       "nestingLevel": int(value(numpr.find("w:ilvl", NS), default="0"))}
                self.stats["listItems"] += 1
        body_text = "".join(e.get("textRun", {}).get("content", "") for e in elements)
        self.index += len(body_text.encode("utf-16-le")) // 2 + sum("inlineObjectElement" in e for e in elements)
        self.paragraphs.append(body_text[:-1])
        self.stats["paragraphs"] += 1
        return {"startIndex": start, "paragraph": paragraph}

    def blocks(self, parent):
        result = []
        for node in parent:
            tag = ET.QName(node).localname
            if tag == "p":
                result.append(self.paragraph(node))
            elif tag == "tbl":
                start = self.index
                self.index += 1
                rows = []
                for row in node.findall("w:tr", NS):
                    cells = []
                    for cell in row.findall("w:tc", NS):
                        item = {"content": self.blocks(cell)}
                        cell_style = {}
                        span = value(cell.find("w:tcPr/w:gridSpan", NS))
                        if span:
                            cell_style["columnSpan"] = int(span)
                        background = color(value(cell.find("w:tcPr/w:shd", NS), "fill"))
                        if background:
                            cell_style["backgroundColor"] = background
                        if cell_style:
                            item["tableCellStyle"] = cell_style
                        cells.append(item)
                        self.stats["tableCells"] += 1
                    rows.append({"tableCells": cells})
                    self.stats["tableRows"] += 1
                result.append({"startIndex": start, "table": {"tableRows": rows}})
                self.stats["tables"] += 1
            elif tag in ("sdt", "sdtContent", "customXml", "ins"):
                result.extend(self.blocks(node))
        return result

    def validate(self):
        expected = []
        for p in self.document.findall(".//w:p", NS):
            pieces = []
            for element in p.iter():
                tag = ET.QName(element).localname
                if tag == "t":
                    pieces.append(element.text or "")
                elif tag == "tab":
                    pieces.append("\t")
                elif tag in ("br", "cr"):
                    pieces.append("\n")
            expected.append("".join(pieces))
        assert expected == self.paragraphs, "Paragraph text or ordering changed"
        assert self.source_image_sequence == self.image_sequence, "Image ordering changed"
        assert len(self.document.findall(".//w:tbl", NS)) == self.stats["tables"]
        assert len(self.document.findall(".//w:tc", NS)) == self.stats["tableCells"]
        self.stats["characters"] = sum(len(x) for x in expected)
        self.stats["words"] = sum(len(x.split()) for x in expected)
        self.stats["monospaceRuns"] = len(self.document.xpath(".//w:r[w:rPr/w:rFonts[contains(@w:ascii,'Mono') or contains(@w:ascii,'Courier')]]", namespaces=NS))
        return expected

    def convert(self):
        blocks = self.blocks(self.document.find("w:body", NS))
        texts = self.validate()
        # Contiguous chapter boundaries follow the source's Word Title headings.
        boundaries = [
            (None, "Thread coordination and coding exercises", "java-thread-coordination"),
            ("Implement a Custom Thread Pool", "Thread pools, blocking queues and producer–consumer", "java-blocking-queues"),
            ("Read–Write Lock Problem:", "Read–write locks, dining philosophers and parallel sums", "java-locks-parallel-sums"),
            ("Parallel Processing:", "Parallel processing and executor fundamentals", "java-parallel-processing"),
            ("ScheduledThreadPoolExecutor", "Scheduled executors and thread pool internals", "java-scheduled-executors"),
            ("DelayQueue:", "Delay queues, abstract executors and scheduling", "java-delay-queues-scheduling"),
            ("Singleton", "Singleton, deadlocks and task exceptions", "java-deadlocks-exceptions"),
            ("Reentrant Locks:", "Reentrant locks, futures and concurrent collections", "java-reentrant-locks-futures"),
            ("Hierarchy", "Hierarchy and RADIUS notes", "java-hierarchy-radius"),
            ("Hashmap:", "HashMap, copies and Java records", "java-reference-topics"),
        ]
        starts = [0]
        for marker, _, _ in boundaries[1:]:
            found = [i for i, b in enumerate(blocks) if b.get("paragraph", {}).get("sourceStyleId") == "Title"
                     and "".join(e.get("textRun", {}).get("content", "") for e in b["paragraph"]["elements"]).strip() == marker]
            assert len(found) == 1, f"Expected a single source chapter marker: {marker}"
            starts.append(found[0])
        assert starts == sorted(starts)
        tabs = []
        for i, (_, title, tab_id) in enumerate(boundaries):
            body = blocks[starts[i]:starts[i + 1] if i + 1 < len(starts) else len(blocks)]
            tabs.append({"tabId": tab_id, "title": title, "body": {"content": body},
                         "inlineObjects": self.inline_objects, "lists": self.lists})
        document = {"documentId": "1og2-c3UBJMrFMtWdZzRWMHq4IvyL7w14", "title": "Java multithreading",
                    "sourceTitle": "ciena multithreading.docx", "sourceId": "java-multithreading",
                    "sourceUrl": "https://docs.google.com/document/d/1og2-c3UBJMrFMtWdZzRWMHq4IvyL7w14/edit",
                    "sourceFormat": "docx", "tabs": tabs,
                    "fidelity": {"paragraphTextExact": True, "paragraphOrderExact": True, "imageOrderExact": True,
                                 "tableStructureExact": True, "codeIndentationPreserved": True,
                                 "chapterGrouping": "Ten contiguous groups follow source Word Title boundaries; all original content is retained once.",
                                 "sourceSha256": hashlib.sha256(self.source.read_bytes()).hexdigest(),
                                 "textSha256": hashlib.sha256("\n".join(texts).encode()).hexdigest(),
                                 "counts": dict(self.stats)}}
        return document


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="content/raw/java-original.docx")
    parser.add_argument("--output", default="content/raw/java-native.json")
    args = parser.parse_args()
    root = Path.cwd()
    converter = Converter(root / args.input, root)
    result = converter.convert()
    (root / args.output).write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    report = {"source": result["sourceTitle"], "chapters": len(result["tabs"]), **result["fidelity"]}
    (root / "content/raw/java-fidelity.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
