"""Genera web/data/ocupaciones.js para el explorador de ocupaciones (ocupaciones.html y la sección Para quién).

Fuentes (repositorio sinco-ia, data/processed):
  - main_sinco_comp_table.parquet: una fila por grupo unitario SINCO (490). Título, probabilidad de automatización de
    Frey y Osborne (prob_automatizacion_fo) y exposición de la ocupación (exp_idx_media_modelos). Ninguna se recalcula.
  - sinco_funciones.parquet: funciones de cada grupo; llave (sinco_code, orden).
  - annotations/ruta_s/parquet/run_<id>.parquet: exposure_class (E0/E1/E2) por función en las 6 corridas base.
    Exposición de la función = promedio de las 6 corridas con el mapa E0 = 0, E1 = 0.5, E2 = 1 (el mismo con el que
    main_sinco_comp_table calcula exp_idx; el promedio simple de las funciones reproduce exp_idx_media_modelos).
  - sinco_ocupaciones_ejemplo.parquet: ocupaciones de ejemplo, solo como palabras de búsqueda.
Capacidades de Mi Primer Agente: tools/capacidades.json (reglas; ver clasificar.py). Sinónimos de búsqueda: tools/sinonimos.json.

Uso: python tools/export_funciones.py <ruta_repo_sinco_ia>
Escribe también tools/reporte_funciones.json con la validación de las uniones (no descarta registros en silencio).
"""
import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clasificar  # noqa: E402

TOOLS = Path(__file__).resolve().parent
WEB = TOOLS.parent
CORRIDAS = {  # las 6 corridas base de ann-s-v1 (las mismas de main_sinco_comp_table.corridas_base)
    "sonnet_01": "ann-s-v1-2026-10-20-01",
    "sonnet_02": "ann-s-v1-2026-10-20-02",
    "haiku_01": "ann-s-v1-2026-10-22-haiku-01",
    "haiku_02": "ann-s-v1-2026-10-22-haiku-02",
    "opus_01": "ann-s-v1-2026-10-22-opus-01",
    "opus_02": "ann-s-v1-2026-10-22-opus-02",
}
VAL_EXP = {"E0": 0.0, "E1": 0.5, "E2": 1.0}
LLAVE = ["sinco_code", "orden"]


def cargar(repo):
    proc = Path(repo) / "data" / "processed"
    runs = proc / "annotations" / "ruta_s" / "parquet"
    return {
        "main": pd.read_parquet(proc / "main_sinco_comp_table.parquet"),
        "funciones": pd.read_parquet(proc / "sinco_funciones.parquet"),
        "ejemplos": pd.read_parquet(proc / "sinco_ocupaciones_ejemplo.parquet"),
        "corridas": {k: pd.read_parquet(runs / f"run_{v}.parquet") for k, v in CORRIDAS.items()},
    }


def exposicion_funciones(funciones, corridas, rep):
    """Promedio de exposure_class por función. Devuelve funciones + columnas score y n_anot; llena rep."""
    largo = []
    for k, t in corridas.items():
        dup = t.duplicated(LLAVE, keep=False)
        rep["corridas"][k] = {"filas": len(t), "llaves_duplicadas": int(dup.sum()),
                              "clases_desconocidas": int((~t["exposure_class"].isin(VAL_EXP)).sum())}
        largo.append(t.loc[~dup, LLAVE + ["exposure_class", "function_text_es"]].assign(corrida=k))
    largo = pd.concat(largo, ignore_index=True)
    largo["v"] = largo["exposure_class"].map(VAL_EXP)  # clase desconocida -> NaN, no se imputa

    j = largo.merge(funciones[LLAVE + ["funcion"]], on=LLAVE, how="outer", indicator=True)
    huerf = j[j["_merge"] == "left_only"]
    rep["anotaciones_sin_funcion"] = huerf[LLAVE].drop_duplicates().astype(str).values.tolist()
    ambos = j[j["_merge"] == "both"]
    rep["texto_distinto"] = int((ambos["function_text_es"].str.strip() != ambos["funcion"].str.strip()).sum())

    agg = largo.groupby(LLAVE).agg(score=("v", "mean"), n_anot=("v", "count"))
    out = funciones.merge(agg, on=LLAVE, how="left")
    out["n_anot"] = out["n_anot"].fillna(0).astype(int)
    rep["funciones"] = len(funciones)
    rep["funciones_llave_duplicada"] = int(funciones.duplicated(LLAVE).sum())
    rep["funciones_sin_anotacion"] = out.loc[out["n_anot"] == 0, LLAVE].astype(str).values.tolist()
    rep["funciones_anotacion_incompleta"] = out.loc[out["n_anot"].between(1, len(corridas) - 1), LLAVE].astype(str).values.tolist()
    return out


def construir(fuentes, reglas, sinonimos):
    rep = {"corridas": {}}
    main, ej = fuentes["main"], fuentes["ejemplos"]
    fun = exposicion_funciones(fuentes["funciones"], fuentes["corridas"], rep)

    rep["ocupaciones"] = len(main)
    rep["ocupaciones_codigo_duplicado"] = int(main["sinco_code"].duplicated().sum())
    rep["funciones_de_grupos_fuera_de_main"] = sorted(set(fun["sinco_code"]) - set(main["sinco_code"]))
    rep["ocupaciones_sin_funciones"] = sorted(set(main["sinco_code"]) - set(fun["sinco_code"]))
    # el promedio de las funciones debe reproducir la exposición de la ocupación que trae la tabla MAIN
    media = fun.groupby("sinco_code")["score"].mean()
    dif = (main.set_index("sinco_code")["exp_idx_media_modelos"] - media).abs()
    rep["max_dif_exposicion_ocupacion"] = float(dif.max()) if dif.notna().any() else None

    caps_cfg = reglas[0]
    cap_idx = {c["id"]: i for i, c in enumerate(caps_cfg)}
    kw = ej.assign(o=ej["ocupacion"].str.strip().str.rstrip(".")).groupby("sinco_code")["o"].apply(list).to_dict()
    por_grupo = {c: g.sort_values("orden") for c, g in fun.groupby("sinco_code")}

    def num(x, n=3):
        return None if pd.isna(x) else round(float(x), n)

    occ, n_sop, n_excl = [], 0, 0
    for r in main.sort_values("sinco_code").itertuples():
        filas = []
        for f in por_grupo.get(r.sinco_code, pd.DataFrame(columns=fun.columns)).itertuples():
            hits, motivo = clasificar.clasificar(f.funcion, reglas)
            n_sop += bool(hits); n_excl += bool(motivo)
            filas.append([int(f.orden), f.funcion.strip(), num(f.score), [[cap_idx[i], t] for i, t in hits], motivo])
        occ.append({
            "c": r.sinco_code, "t": r.titulo.strip(), "p": num(r.prob_automatizacion_fo),
            "pm": None if pd.isna(r.prob_fo_motivo_na) else r.prob_fo_motivo_na,
            "bc": bool(r.match_status == "baja_confianza"),
            "x": num(r.exp_idx_media_modelos),
            "k": kw.get(r.sinco_code, []) + sinonimos.get(r.sinco_code, []),
            "f": filas,
        })
    rep["funciones_con_capacidad"] = n_sop
    rep["funciones_bloqueadas_por_exclusion_global"] = n_excl
    rep["ocupaciones_con_alguna_capacidad"] = sum(any(f[3] for f in o["f"]) for o in occ)
    datos = {
        "v": {"generado": date.today().isoformat(), "corridas": list(CORRIDAS.values()),
              "capacidades_version": json.loads(clasificar.REGLAS.read_text(encoding="utf-8"))["_version"]},
        "caps": [{"id": c["id"], "n": c["nombre"], "q": c["que_hace"]} for c in caps_cfg],
        "occ": occ,
    }
    return datos, rep


def main():
    fuentes = cargar(sys.argv[1])
    sinonimos = {k: v for k, v in json.loads((TOOLS / "sinonimos.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}
    datos, rep = construir(fuentes, clasificar.cargar(), sinonimos)
    (TOOLS / "reporte_funciones.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    out = WEB / "data" / "ocupaciones.js"
    out.write_text("// Explorador de ocupaciones: funciones SINCO 2019, exposición a la IA por función, probabilidad de Frey y Osborne "
                   "y capacidades de Mi Primer Agente. Generado por tools/export_funciones.py; no editar a mano.\n"
                   "window.OCUPACIONES = " + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    resumen = {k: (len(v) if isinstance(v, list) else v) for k, v in rep.items() if k != "corridas"}
    print(json.dumps(resumen, ensure_ascii=False, indent=1))
    print(out, out.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
