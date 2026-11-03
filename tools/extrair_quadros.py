# Extrai os Quadros I e II do Despacho 2074/2009 a partir do texto (pdftotext -layout).
# Uso: python3 extrair_quadros.py <texto.txt> <saida_dir>
import re, sys, json, os
txt = open(sys.argv[1], encoding='utf-8').read().split('\n')
out = sys.argv[2]
os.makedirs(out, exist_ok=True)

def num(s):
    return float(s.replace(' ', '').replace(',', '.'))

# ---------- Quadro I ----------
i1 = next(i for i, l in enumerate(txt) if 'QUADRO I' in l and 'II' not in l)
i2 = next(i for i, l in enumerate(txt) if 'QUADRO II' in l)
mat = []
pat = re.compile(r'(\S.*?)\s{2,}(\d+(?:,\d+)?)(?=\s{2,}|\s*$)')
for l in txt[i1:i2]:
    if 'Diário da República' in l or 'Produto' in l or '(1)' in l:
        continue
    for m in pat.finditer(l):
        nome = m.group(1).strip()
        if len(nome) < 3: continue
        mat.append({'nome': nome, 'hi': num(m.group(2))})
# ---------- Quadro II ----------
rows = []
pat2 = re.compile(r'^(?P<nome>[^\d\s].*?)\s{2,}(?P<n1>\d[\d ]*)\s+(?P<r1>Alto|Médio|Baixo)(?:\s{2,}(?P<n2>\d[\d ]*)\s+(?P<r2>Alto|Médio|Baixo))?\s*$')
pagina = 0
paginas = {}
nao = []
pai = ''
sub = re.compile(r'^\s*-\s*(?P<nome>[^\d].*?)\s{2,}(?P<n1>\d[\d ]*)\s+(?P<r1>Alto|Médio|Baixo)(?:\s{2,}(?P<n2>\d[\d ]*)\s+(?P<r2>Alto|Médio|Baixo))?\s*$')
for l in txt[i2:]:
    if 'Diário da República' in l:
        pagina += 1
        continue
    if l.rstrip().endswith(':') and not re.search(r'\d\s+(Alto|Médio|Baixo)', l):
        pai = re.sub(r'^\d*[-–]?', '', l).strip().rstrip(':')
        continue
    ms = sub.match(l)
    if ms and pai:
        paginas.setdefault(pagina, []).append((ms, l, pai))
        continue
    m = pat2.match(l)
    if not m:
        if re.search(r'\b(Alto|Médio|Baixo)\b', l): nao.append(l)
        continue
    paginas.setdefault(pagina, []).append((m, l, ''))
for p, lst in paginas.items():
    # posição típica da 1.ª coluna (fabricação) e da 2.ª (armazenamento) nesta página
    dup = [(m.start('n1'), m.start('n2')) for m, l, _ in lst if m.group('n2')]
    if dup:
        c1 = sorted(d[0] for d in dup)[len(dup)//2]
        c2 = sorted(d[1] for d in dup)[len(dup)//2]
        lim = (c1 + c2) / 2
    else:
        lim = None
    for m, l, pai_ in lst:
        nome = m.group('nome').strip()
        if pai_: nome = pai_ + ' — ' + nome.lstrip('- ')
        r = {'nome': nome, 'pag': p}
        if m.group('n2'):
            r.update(qsi=num(m.group('n1')), raFab=m.group('r1').lower(), qvi=num(m.group('n2')), raArm=m.group('r2').lower())
        else:
            fim = m.end('n1')
            arm = lim is not None and m.start('n1') >= lim - 6
            if lim is None: r['ambiguo'] = True; arm = False
            if arm: r.update(qvi=num(m.group('n1')), raArm=m.group('r1').lower())
            else: r.update(qsi=num(m.group('n1')), raFab=m.group('r1').lower())
        rows.append(r)
json.dump(mat, open(out + '/quadro1.json', 'w'), ensure_ascii=False, indent=1)
json.dump(rows, open(out + '/quadro2.json', 'w'), ensure_ascii=False, indent=1)
print('materiais', len(mat), 'atividades', len(rows), 'linhas nao lidas', len(nao))
for l in nao[:15]: print('NAO:', l.strip()[:150])
print('ambiguos', sum(1 for r in rows if r.get('ambiguo')))
