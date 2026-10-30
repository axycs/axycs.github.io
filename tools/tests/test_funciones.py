"""Pruebas del explorador de ocupaciones: reglas de capacidades, uniones y datos exportados.

Uso: python -m pytest tools/tests -q        (desde web/; las pruebas con datos reales usan SINCO_IA_REPO)
"""
import json
import os
import re
import sys
from pathlib import Path

import pandas as pd
import pytest

TOOLS = Path(__file__).resolve().parents[1]
WEB = TOOLS.parent
sys.path.insert(0, str(TOOLS))
import clasificar  # noqa: E402
import export_funciones as ex  # noqa: E402

REPO = Path(os.environ.get("SINCO_IA_REPO", "C:/Users/Diego/Documents/sinco-ia"))
REGLAS = clasificar.cargar()


def ids(texto):
    return [c for c, _ in clasificar.clasificar(texto, REGLAS)[0]]


# ---------- reglas de capacidades ----------
def test_reglas_bien_formadas():
    cfg = json.loads(clasificar.REGLAS.read_text(encoding="utf-8"))
    vistos = [c["id"] for c in cfg["capacidades"]]
    assert len(vistos) == len(set(vistos))
    todas = [p for c in cfg["capacidades"] for p in c["patrones"] + c["exclusiones"]] + [g["patron"] for g in cfg["exclusiones_globales"]]
    for p in todas:
        re.compile(p)
        assert not re.search(r"[\x00-\x1f]", p), f"carácter de control en el patrón: {p!r}"  # p. ej. \b escrito como retroceso
    for c in cfg["capacidades"]:
        assert c["nombre"] and c["que_hace"] and c["patrones"]


@pytest.mark.parametrize("texto,esperado", [
    ("Acordar citas por teléfono.", "agenda"),
    ("Registrar en agenda los compromisos del jefe y recordarle su cumplimiento oportuno.", "agenda"),
    ("Formular informes detallados sobre las auditorías practicadas.", "informes"),
    ("Cotizar precios y condiciones de venta a crédito.", "cotizaciones"),
    ("Preparar cuentas, facturas, fichas de venta o recibos.", "facturas"),
    ("Recibir y archivar documentos, informes, correspondencia, expedientes, etcétera.", "archivos"),
    ("Capturar datos de encuestas, registros administrativos, nóminas, etcétera.", "datos"),
    ("Escuchar y resolver las quejas de los clientes respecto al producto o servicios.", "seguimiento"),
    ("Planear, dirigir y evaluar programas de educación nutricional y desarrollar materiales educativos para estudiantes.", "material"),
])
def test_capacidad_detectada(texto, esperado):
    assert esperado in ids(texto)


@pytest.mark.parametrize("texto", [
    "Bucear para capturar mariscos y peces.",
    "Preparar materiales y equipos para experimentos, pruebas y análisis.",
    "Clasificar la correspondencia (por la calle, número y acera) y colocarla en una pichonera individual.",
    "Registrar en el expediente de cada paciente, los síntomas y la secuencia del tratamiento aplicado.",
    "Consultar diferentes fuentes de información sobre tendencias económicas, cotizaciones de bolsa.",
    "Imprimir en prensas de pequeñas proporciones tarjetas, recibos de honorarios.",
    "Contestar teléfonos, pasar llamadas o tomar recados.",
    "Realizar otras funciones afines.",
])
def test_sin_capacidad(texto):
    assert ids(texto) == []


@pytest.mark.parametrize("texto,motivo", [
    ("Redactar y/o revisar demandas, contratos, convenios y otros documentos jurídicos y correspondencia.", "legal"),
    ("Analizar registros, informes, resultados de pruebas o información de exámenes para diagnosticar el estado médico.", "clínica"),
    ("Recopilar, registrar y actualizar información del paciente, como su historial médico, informes y resultados.", "clínicos"),
])
def test_exclusion_global_gana(texto, motivo):
    caps, m = clasificar.clasificar(texto, REGLAS)
    assert caps == [] and motivo in m


def test_termino_con_acentos():
    caps, _ = clasificar.clasificar("Tramitar documentación de compraventa.", REGLAS)
    assert ("archivos", "Tramitar documentación") in caps


# ---------- uniones con datos sintéticos: nada se descarta en silencio ----------
def _fuentes_sinteticas():
    funciones = pd.DataFrame({"sinco_code": ["1000", "1000", "2000"], "orden": [1, 2, 1],
                              "funcion": ["Elaborar informes.", "Sacar fotocopias.", "Acordar citas."]})
    def corrida(clases, extra=None):
        t = pd.DataFrame({"sinco_code": ["1000", "1000"], "orden": [1, 2], "exposure_class": clases,
                          "function_text_es": ["Elaborar informes.", "Sacar fotocopias."]})
        return pd.concat([t, extra]) if extra is not None else t
    huerfana = pd.DataFrame({"sinco_code": ["9999"], "orden": [1], "exposure_class": ["E2"], "function_text_es": ["X"]})
    dup = pd.DataFrame({"sinco_code": ["1000"], "orden": [2], "exposure_class": ["E2"], "function_text_es": ["Sacar fotocopias."]})
    corridas = {"a": corrida(["E2", "E0"], huerfana), "b": corrida(["E1", "EX"]), "c": corrida(["E2", "E0"], dup)}
    main = pd.DataFrame({"sinco_code": ["1000", "2000", "3000"], "titulo": ["Uno ", "Dos", "Tres"],
                         "prob_automatizacion_fo": [0.5, None, 0.9], "prob_fo_motivo_na": [None, "sin_coincidencia", None],
                         "match_status": ["ok", "sin_coincidencia", "baja_confianza"], "exp_idx_media_modelos": [0.5, None, None]})
    ejemplos = pd.DataFrame({"sinco_code": ["1000"], "orden": [1], "ocupacion": ["Ejemplo."]})
    return {"main": main, "funciones": funciones, "ejemplos": ejemplos, "corridas": corridas}


def test_union_reporta_problemas():
    datos, rep = ex.construir(_fuentes_sinteticas(), REGLAS, {"2000": ["sinonimo"]})
    assert rep["anotaciones_sin_funcion"] == [["9999", "1"]]
    assert rep["corridas"]["c"]["llaves_duplicadas"] == 2          # las dos filas con la llave repetida se apartan
    assert rep["corridas"]["b"]["clases_desconocidas"] == 1
    assert rep["funciones_sin_anotacion"] == [["2000", "1"]]
    assert ["1000", "2"] in rep["funciones_anotacion_incompleta"]
    assert rep["ocupaciones_sin_funciones"] == ["3000"]
    occ = {o["c"]: o for o in datos["occ"]}
    f1, f2 = occ["1000"]["f"]
    assert f1[2] == round((1 + 0.5 + 1) / 3, 3)               # promedio de las corridas válidas
    assert f2[2] == 0.0                                              # E0 de "a"; "EX" y la duplicada no cuentan
    assert occ["2000"]["f"][0][2] is None                           # sin anotación: no se imputa
    assert occ["2000"]["p"] is None and occ["2000"]["pm"] == "sin_coincidencia"
    assert occ["3000"]["f"] == [] and occ["3000"]["bc"] is True
    assert occ["1000"]["t"] == "Uno" and occ["1000"]["k"] == ["Ejemplo"]
    assert occ["2000"]["k"] == ["sinonimo"]
    assert [datos["caps"][i]["id"] for i, _ in f1[3]] == ["informes"]


# ---------- datos reales de sinco-ia ----------
@pytest.fixture(scope="module")
def reales():
    if not (REPO / "data" / "processed" / "main_sinco_comp_table.parquet").exists():
        pytest.skip("sin el repositorio sinco-ia")
    fuentes = ex.cargar(REPO)
    datos, rep = ex.construir(fuentes, REGLAS, {})
    return fuentes, datos, rep


def test_uniones_reales_completas(reales):
    _, _, rep = reales
    assert rep["funciones"] == 3542 and rep["ocupaciones"] == 490
    for k in ("anotaciones_sin_funcion", "funciones_sin_anotacion", "funciones_anotacion_incompleta", "funciones_de_grupos_fuera_de_main"):
        assert rep[k] == [], k
    assert rep["texto_distinto"] == 0 and rep["funciones_llave_duplicada"] == 0 and rep["ocupaciones_codigo_duplicado"] == 0
    assert all(c["llaves_duplicadas"] == 0 and c["clases_desconocidas"] == 0 for c in rep["corridas"].values())
    assert len(rep["ocupaciones_sin_funciones"]) == 33
    assert rep["max_dif_exposicion_ocupacion"] < 1e-12             # el promedio de funciones reproduce exp_idx_media_modelos


def test_valores_reales_sin_recalcular(reales):
    fuentes, datos, _ = reales
    m = fuentes["main"].set_index("sinco_code")
    for o in datos["occ"]:
        p, x = m.at[o["c"], "prob_automatizacion_fo"], m.at[o["c"], "exp_idx_media_modelos"]
        assert (o["p"] is None) == pd.isna(p) and (o["p"] is None or o["p"] == round(float(p), 3))
        assert (o["x"] is None) == pd.isna(x) and (o["x"] is None or o["x"] == round(float(x), 3))
        for f in o["f"]:
            assert 0 <= f[2] <= 1 and abs(f[2] * 12 - round(f[2] * 12)) < 0.01   # promedio de 6 corridas de 0 / .5 / 1
    assert sum(len(o["f"]) for o in datos["occ"]) == 3542


def test_archivo_publicado_al_dia(reales):
    """web/data/ocupaciones.js corresponde a las fuentes y reglas actuales (si falla: correr export_funciones.py)."""
    _, datos, _ = reales
    s = (WEB / "data" / "ocupaciones.js").read_text(encoding="utf-8")
    pub = json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))
    assert pub["caps"] == datos["caps"]
    assert [(o["c"], o["p"], o["x"], [f[:4] for f in o["f"]]) for o in pub["occ"]] == \
           [(o["c"], o["p"], o["x"], [f[:4] for f in o["f"]]) for o in datos["occ"]]


def test_misma_probabilidad_que_la_pagina_principal():
    s = (WEB / "data" / "automatizacion.js").read_text(encoding="utf-8")
    auto = {r["c"]: r["p"] for r in json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))["rows"]}
    s = (WEB / "data" / "ocupaciones.js").read_text(encoding="utf-8")
    occ = {o["c"]: o["p"] for o in json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))["occ"]}
    comunes = set(auto) & set(occ)
    assert len(comunes) >= 400
    assert all(auto[c] == occ[c] or (auto[c] is not None and occ[c] is not None and abs(auto[c] - occ[c]) < 1e-3) for c in comunes)
