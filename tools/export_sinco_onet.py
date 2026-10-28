"""Genera web/data/sinco_onet.js para el estudio SINCO -> O*NET (Sankey).

Entradas:
  - main_sinco_comp_table_completa.csv (tabla MAIN del proyecto sinco-ia; modelo principal bge-m3, top-2)
  - sinco-ia/data/processed: sinco, onet_ocupaciones, puente O*NET 2019 -> SOC 2010, Frey-Osborne
La probabilidad de cada O*NET se calcula con pfo._combinar de sinco-ia (misma regla que la agregación a SINCO):
un O*NET con varios SOC 2010 reparte su peso por igual y se promedian los que tienen probabilidad; nada se imputa.
Solo se exporta la probabilidad de automatización (Frey-Osborne); ninguna columna de exposición.

Uso: python tools/export_sinco_onet.py <ruta_csv_main> <ruta_repo_sinco_ia>
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

csv_main, repo = Path(sys.argv[1]), Path(sys.argv[2])
sys.path.insert(0, str(repo / "src" / "match"))
import pfo  # noqa: E402

proc = repo / "data" / "processed"
main = pd.read_csv(csv_main, dtype={"sinco_code": str, "division": str, "subgrupo": str})
sinco = pd.read_parquet(proc / "sinco.parquet")
onet = pd.read_parquet(proc / "onet_ocupaciones.parquet").set_index("onet_soc_code")["titulo_en"]
puente = pfo.mapa_puente(pd.read_parquet(proc / "puente_onet_soc2019_soc2010.parquet"))
fot = pd.read_parquet(proc / "frey_osborne_probabilidades.parquet")
fo = dict(zip(fot["soc_2010"], fot["probabilidad_automatizacion_fo"]))


def r(x, n=3):
    return None if pd.isna(x) else round(float(x), n)


nombres = dict(zip(sinco["sinco_code"], sinco["titulo"].str.strip()))
divisiones = {c: nombres[c] for c in sorted(sinco.loc[sinco.nivel == "division", "sinco_code"])}
grupos = {c: nombres[c] for c in sorted(sinco.loc[sinco.nivel == "grupo_principal", "sinco_code"])}

filas, usados = [], set()
for _, x in main.sort_values("sinco_code").iterrows():
    links = []
    for k in ("onet1", "onet2"):
        soc = x[f"{k}_soc"]
        if pd.isna(soc):
            continue
        usados.add(soc)
        links.append({"o": soc, "w": r(x[f"{k}_peso_softmax"]), "s": r(x[f"{k}_similitud"])})
    filas.append({
        "c": x["sinco_code"], "t": x["titulo"].strip(), "g": x["sinco_code"][:2],
        "p": r(x["prob_automatizacion_fo"]), "st": x["match_status"], "cov": x["prob_fo_cobertura"],
        "e5": bool(x["match_top1_coincide_otro_modelo"]) if not pd.isna(x["match_top1_coincide_otro_modelo"]) else None,
        "l": links,
    })

ocup = {}
for soc in sorted(usados):
    socs = puente.get(soc, [])
    media = pfo._combinar(np.array([1.0]), [socs], fo)["media"] if socs else np.nan
    ocup[soc] = {"t": onet.get(soc, soc), "p": r(media)}

resumen = {
    "grupos_unitarios": len(filas),
    "con_probabilidad": sum(f["p"] is not None for f in filas),
    "baja_confianza": int((main["match_status"] == "baja_confianza").sum()),
    "sin_coincidencia": int((main["match_status"] == "sin_coincidencia").sum()),
    "onet_distintos": len(ocup),
    "top1_coincide_e5": int(main["match_top1_coincide_otro_modelo"].fillna(False).astype(bool).sum()),
    "tau": r(main["match_tau"].iloc[0], 3),
    "run_id": main["match_run_id"].iloc[0],
}
print(json.dumps(resumen, ensure_ascii=False, indent=1))

out = Path(__file__).resolve().parent.parent / "data" / "sinco_onet.js"
js = ("// Estudio SINCO 2019 -> O*NET con probabilidad de automatización (Frey-Osborne). "
      "Generado por tools/export_sinco_onet.py; no editar a mano.\n"
      "window.SINCO_ONET = " + json.dumps({"divisiones": divisiones, "grupos": grupos, "sinco": filas,
                                            "onet": ocup, "resumen": resumen},
                                           ensure_ascii=False, separators=(",", ":")) + ";\n")
out.write_text(js, encoding="utf-8")
print(out, out.stat().st_size, "bytes")
