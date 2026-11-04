"""估值读数段：价格在哪 / 区间多宽 / 两法分歧。

这条测的不是"有没有这个字段"，而是**读数会不会骗人**：现价正好压在下沿时算内还是外、
并集区间能不能读位置、方法不适用时会不会编一个位置出来。
"""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from stockframe.valuation import _position_of, synthesize
from stockframe.wording import scan

ROOT = Path(__file__).resolve().parents[1]

DCF = {"value_per_share_low": 33.13, "value_per_share_high": 44.43,
       "value_per_share_central": 37.97}
REL = {"implied_price_range": {"low": 25.08, "high": 39.9}}


def _syn(price=32.5, dcf=DCF, rel=REL, gate=None, warnings=()):
    return synthesize(dcf, rel, price=price, dcf_warnings=list(warnings), gate=gate)


# ---------------------------------------------------------------- 位置四档

@pytest.mark.parametrize("price,lo,hi,code", [
    (30.0, 33.13, 39.9, "below"),
    (33.13, 33.13, 39.9, "inside"),   # 压在下沿：属于区间内，不算"跌出去"
    (39.9, 33.13, 39.9, "inside"),    # 压在上沿同理
    (45.0, 33.13, 39.9, "above"),
    (None, 33.13, 39.9, "unknown"),
    (32.5, None, None, "unknown"),
])
def test_position_four_states(price, lo, hi, code):
    assert _position_of(price, lo, hi)["code"] == code


def test_position_gap_and_zone():
    # 下沿 33.13、现价 32.5 → 低 1.9%（不是相对现价，也不是相对上沿）
    below = _position_of(32.5, 33.13, 39.9)
    assert below["gap_pct"] == pytest.approx(1.9, abs=0.05)
    assert below["zone_pct"] is None

    # 区间中点 → 50% 位置
    inside = _position_of(36.5, 33.13, 39.9)
    assert inside["zone_pct"] == pytest.approx(50.0, abs=0.5)
    assert inside["gap_pct"] is None

    above = _position_of(44.0, 33.13, 39.9)
    assert above["gap_pct"] == pytest.approx(10.3, abs=0.1)


# ---------------------------------------------------------------- 交集的读数

def test_intersection_reading_has_three_lines():
    rd = _syn()["reading"]
    assert rd["summary"].startswith("价格在合成区间下方")
    assert rd["position"]["code"] == "below"
    # 三件事：价格在哪 / 区间多宽 / 两法分歧
    joined = "\n".join(rd["lines"])
    assert "低于合成区间下沿" in joined
    assert "区间宽度" in joined
    assert "相对法中枢比 DCF" in joined
    assert "不回答「该不该动手」" in rd["caveat"]


def test_reading_matches_range_numbers():
    """读数必须与同一份报告里的区间数字自洽，不能各说各的。"""
    s = _syn()
    rd, lo, hi = s["reading"], s["combined_range"]["low"], s["combined_range"]["high"]
    assert rd["price"] == 32.5
    assert rd["width"]["abs"] == pytest.approx(round(hi - lo, 2))
    central = (lo + hi) / 2
    assert rd["width"]["pct"] == pytest.approx(round((hi - lo) / central * 100, 1), abs=0.05)
    # summary 里的百分比就是 position.gap_pct，不是另算一遍
    assert f"{rd['position']['gap_pct']}%" in rd["summary"]


def test_reading_lines_pass_wording_gate():
    """读数段是全文最像"贵/便宜判断"的一段，必须过 A4 词表。"""
    rd = _syn()["reading"]
    assert scan(rd["summary"]) == []
    assert scan("\n".join(rd["lines"])) == []
    assert scan(rd["caveat"]) == []


# ---------------------------------------------------------------- 并集：位置无意义

def test_union_has_no_position():
    """两法区间不重叠时，并集的两端来自不同方法，位置与中点都没有经济含义。"""
    rel2 = {"implied_price_range": {"low": 45.0, "high": 50.0}}
    s = _syn(rel=rel2, warnings=["终值占比过高"])
    assert s["mode"] == "union"
    rd = s["reading"]
    assert rd["position"]["code"] == "unknown"
    assert rd["position"]["gap_pct"] is None
    assert "不重叠" in rd["summary"]
    assert "对比下面 DCF 与相对法两条单项" in rd["lines"][0]
    # 并集下仍然能报宽度与分歧——那两个数不依赖中点是否有意义
    assert rd["width"]["abs"] is not None


# ---------------------------------------------------------------- 不出区间：不编位置

def test_not_applicable_reading_says_no_range():
    gate = SimpleNamespace(dcf_applicable=False, code="BANK",
                           reason="银行不适用 FCFF 折现")
    s = _syn(gate=gate)
    assert s["mode"] == "not_applicable"
    rd = s["reading"]
    assert rd["position"]["code"] == "unknown"
    assert "不适用" in rd["summary"]
    assert any("不该用这把尺子" in x for x in rd["lines"])
    assert rd["width"] == {"abs": None, "pct": None}


def test_rejected_reading_says_no_range():
    bad = {"value_per_share_low": -5.0, "value_per_share_high": 12.0,
           "value_per_share_central": 3.0}
    s = _syn(dcf=bad)
    assert s["mode"] == "rejected"
    rd = s["reading"]
    assert rd["position"]["code"] == "unknown"
    assert "非正" in rd["summary"]


# ---------------------------------------------------------------- 报告级：schema + 落盘

def test_sample_report_reading_block_is_valid():
    report = json.loads((ROOT / "examples" / "sample_report.json").read_text(encoding="utf-8"))
    rd = report["valuation"]["synthesis"]["reading"]
    for key in ("price", "position", "width", "confidence_level", "summary", "lines", "caveat"):
        assert key in rd
    assert rd["lines"], "读数段不能是空数组：空数组等于没写"

    from stockframe.validate import validate_report
    ok, errors = validate_report(report)
    assert ok, errors


def test_single_method_is_not_labelled_as_divergence():
    """单法（relative_only / dcf_only）不能被说成「方法分歧」——它压根没有第二种方法。"""
    s = _syn(dcf={"value_per_share_low": None, "value_per_share_high": None,
                  "value_per_share_central": None})
    assert s["mode"] == "relative_only"
    rd = s["reading"]
    assert rd["position"]["code"] in ("below", "inside", "above")
    # 只有一条方法，第三条（两法分歧）不该出现
    assert not any("相对法中枢比 DCF" in x for x in rd["lines"])
