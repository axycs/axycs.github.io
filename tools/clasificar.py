"""Clasifica funciones del SINCO según las capacidades de Mi Primer Agente (reglas en capacidades.json).

Es independiente de la presentación: el exportador guarda el resultado en los datos y la página solo lo muestra.
"""
import json
import re
import unicodedata
from pathlib import Path

REGLAS = Path(__file__).with_name("capacidades.json")


def normalizar(texto):
    """Minúsculas y sin acentos, para que las reglas no dependan de la ortografía."""
    t = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def cargar(ruta=REGLAS):
    cfg = json.loads(Path(ruta).read_text(encoding="utf-8"))
    caps = []
    for c in cfg["capacidades"]:
        caps.append({**c, "_pat": [re.compile(p) for p in c["patrones"]], "_exc": [re.compile(p) for p in c["exclusiones"]]})
    glob = [(re.compile(g["patron"]), g["motivo"]) for g in cfg["exclusiones_globales"]]
    return caps, glob


def clasificar(texto, reglas):
    """Devuelve (capacidades, motivo_exclusion).

    capacidades: [(id, término que coincidió)] en el orden de capacidades.json; vacío si no aplica ninguna.
    motivo_exclusion: texto si una exclusión global bloqueó una coincidencia; None en otro caso.
    """
    caps, glob = reglas
    t = normalizar(texto)
    hits = []
    for c in caps:
        m = next((m for p in c["_pat"] if (m := p.search(t))), None)
        if m and not any(e.search(t) for e in c["_exc"]):
            a, b = m.span()  # misma longitud que el original: se muestra el término con sus acentos
            hits.append((c["id"], (texto[a:b] if len(texto) == len(t) else m.group(0)).strip()))
    if hits:
        for pat, motivo in glob:
            if pat.search(t):
                return [], motivo
    return hits, None
