#!/usr/bin/env python3
"""Local-only beta converter. Exports IDs/names/groups, never contacts or birthdates.
Usage: python scripts/docx_to_coach_roster.py input.docx output.coach.json
Requires: python-docx. DO NOT commit input or output.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

DAYS = ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo')

def folded(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.lower()) if unicodedata.category(c) != 'Mn')

def convert(source):
    doc = Document(source)
    groups, participants = [], []
    current_group = None
    waiting = False
    seen = set()
    for element in doc.element.body.iterchildren():
        if element.tag == qn('w:p'):
            title = ' '.join(Paragraph(element, doc).text.split())
            key = folded(title)
            if not title:
                continue
            if 'lista_de_espera' in key or 'lista de espera' in key:
                waiting = True
            elif any(day in key for day in DAYS) and re.search(r'\b\d{1,2}:\d{2}\b', key):
                day = next(day for day in DAYS if day in key)
                time = re.search(r'\b(\d{1,2}):(\d{2})\b', key)
                hour, minute = int(time.group(1)), int(time.group(2))
                if hour > 23 or minute > 59:
                    raise ValueError('Invalid group time')
                current_group = f'group-{len(groups) + 1:02d}'
                groups.append({'id': current_group, 'title': title, 'sport': 'swimming', 'weekday': day, 'startTime': f'{hour:02d}:{minute:02d}'})
                waiting = False
        elif element.tag == qn('w:tbl'):
            if current_group is None:
                raise ValueError('Table without preceding group heading; review document locally')
            table = Table(element, doc)
            for row in table.rows[1:]:
                cells = [cell.text.strip() for cell in row.cells]
                if len(cells) < 2 or not cells[0] or not cells[1]:
                    continue
                code, name = cells[:2]
                if not re.fullmatch(r'[A-Za-z0-9_-]+', code) or code in seen:
                    raise ValueError('Missing, unsafe or duplicate participant ID')
                seen.add(code)
                participants.append({'id': code, 'groupId': current_group, 'displayName': name, 'status': 'waiting' if waiting else 'enrolled'})
    if not groups or not participants:
        raise ValueError('No groups or participants found; check headings and tables')
    return {'schemaVersion': 1, 'groups': groups, 'participants': participants}

def main():
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python scripts/docx_to_coach_roster.py input.docx output.coach.json')
    source, target = Path(sys.argv[1]), Path(sys.argv[2])
    if source.resolve() == target.resolve():
        raise SystemExit('Input and output must differ')
    result = convert(source)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Wrote {len(result["groups"])} groups and {len(result["participants"])} participant records locally. Review before importing.')

if __name__ == '__main__':
    main()
