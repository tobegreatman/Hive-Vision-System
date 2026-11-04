"""估值模块：方法一 FCFF DCF（三情景+敏感性）+ 方法二 相对估值（分位带）+ 区间合成。

设计文档 §7：
- 不给单点价格预测，只给区间；
- 永续 TV 占比 >70% 触发警示（终值主导 → 结论可信度降档）；
- WACC 默认区间 8%-12%，永续 g 2%-3%（超 GDP 增速报警）；
- 全部输入为 assumption（预测数据隔离），报告中原样标注；
- 输入缺失（PE/EPS/现价）时降级为单法或不可用，**不外推、不补零**。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


@dataclass(frozen=True)
class DCFParams:
    """单一情景的 DCF 假设（全部为 assumption，单位：亿元/比率）。"""
    wacc: float
    terminal_growth: float
    revenue_growth_path: Tuple[float, float, float, float, float]
    ebit_margin_path: Tuple[float, float, float, float, float]
    tax_rate: float
    dep_amort_pct_rev: float
    capex_pct_rev: float
    nwc_pct_rev_delta: float
    revenue_base: float          # 最近完整年度营收（亿元）
    net_debt: float              # 净债务（亿元），净现金为负
    shares: float                # 总股本（亿股）


def _fcff_pv(params: DCFParams) -> Tuple[float, float, float]:
    """返回 (EV, PV(TV), 显性期 PV 合计)。"""
    rev = params.revenue_base
    pv_explicit = 0.0
    fcff_last = 0.0
    for i in range(5):
        rev = rev * (1.0 + params.revenue_growth_path[i])
        ebit = rev * params.ebit_margin_path[i]
        nopat = ebit * (1.0 - params.tax_rate)
        da = rev * params.dep_amort_pct_rev
        capex = rev * params.capex_pct_rev
        delta_nwc = rev * params.nwc_pct_rev_delta
        fcff = nopat + da - capex - delta_nwc
        pv_explicit += fcff / (1.0 + params.wacc) ** (i + 1)
        fcff_last = fcff
    denom = params.wacc - params.terminal_growth
    if denom <= 0.005:
        raise ValueError(f"WACC({params.wacc}) 与永续增长率({params.terminal_growth}) 差距过小，终值不可计算")
    tv = fcff_last * (1.0 + params.terminal_growth) / denom
    pv_tv = tv / (1.0 + params.wacc) ** 5
    return pv_explicit + pv_tv, pv_tv, pv_explicit


def value_per_share(params: DCFParams) -> Tuple[float, float]:
    """返回 (每股价值, TV 占比)。"""
    ev, pv_tv, _ = _fcff_pv(params)
    equity = ev - params.net_debt
    if equity <= 0:
        raise ValueError("DCF 股权价值为负：假设不成立（营收/利润率路径过低或净债务过高）")
    return equity / params.shares, pv_tv / ev


def _perturbed(params: DCFParams, wacc_delta: float) -> DCFParams:
    return DCFParams(**{**params.__dict__, "wacc": params.wacc + wacc_delta})


def dcf_not_applicable(gate_reason: str, gate_code: str) -> Dict[str, Any]:
    """前门判定不适用：不出区间、不出敏感性网格，只记录理由。"""
    return {
        "method": "FCFF_DCF",
        "assumptions_kind": "assumption",
        "applicable": False,
        "gate": {"code": gate_code, "reason": gate_reason},
        "warnings": [f"未执行 DCF：{gate_reason}"],
    }


def run_dcf(assumptions: Dict[str, Any]) -> Dict[str, Any]:
    """三情景 DCF + 基准情景敏感性网格 + 警示列表。"""
    warnings: List[str] = []
    scenario_results: Dict[str, Any] = {}
    for name in ("optimistic", "base", "pessimistic"):
        a = assumptions[name]
        params = DCFParams(
            wacc=a["wacc"], terminal_growth=a["terminal_growth"],
            revenue_growth_path=tuple(a["revenue_growth_path"]),
            ebit_margin_path=tuple(a["ebit_margin_path"]),
            tax_rate=a.get("tax_rate", 0.15),
            dep_amort_pct_rev=a.get("dep_amort_pct_rev", 0.05),
            capex_pct_rev=a.get("capex_pct_rev", 0.07),
            nwc_pct_rev_delta=a.get("nwc_pct_rev_delta", 0.01),
            revenue_base=a["revenue_base"], net_debt=a["net_debt"], shares=a["shares"],
        )
        central, tv_share = value_per_share(params)
        try:
            v_low, _ = value_per_share(_perturbed(params, +0.01))
            v_high, _ = value_per_share(_perturbed(params, -0.01))
        except ValueError:
            v_low, v_high = central, central
            warnings.append(f"{name} 情景 WACC 扰动失败（WACC-g 过小），区间退化为中枢点")
        if v_low > v_high:
            v_low, v_high = v_high, v_low
        if tv_share > 0.70:
            warnings.append(
                f"{name} 情景永续终值占比 {tv_share:.0%} > 70%：估值高度依赖终值假设，可信度降档"
            )
        if params.terminal_growth > 0.03:
            warnings.append(f"{name} 情景永续增长率 {params.terminal_growth:.1%} 超过 GDP 长期增速上限")
        if not (0.08 <= params.wacc <= 0.12):
            warnings.append(f"{name} 情景 WACC {params.wacc:.1%} 超出默认合理区间 8%-12%")
        scenario_results[name] = {
            "wacc": params.wacc,
            "terminal_growth": params.terminal_growth,
            "revenue_growth_path": list(params.revenue_growth_path),
            "ebit_margin_path": list(params.ebit_margin_path),
            "value_per_share_central": round(central, 2),
            "value_per_share_low": round(v_low, 2),
            "value_per_share_high": round(v_high, 2),
            "terminal_value_share": round(tv_share, 3),
            "net_debt_assumption": params.net_debt,
            "shares_assumption": params.shares,
        }

    base_a = assumptions["base"]
    base_params = DCFParams(
        wacc=base_a["wacc"], terminal_growth=base_a["terminal_growth"],
        revenue_growth_path=tuple(base_a["revenue_growth_path"]),
        ebit_margin_path=tuple(base_a["ebit_margin_path"]),
        tax_rate=base_a.get("tax_rate", 0.15),
        dep_amort_pct_rev=base_a.get("dep_amort_pct_rev", 0.05),
        capex_pct_rev=base_a.get("capex_pct_rev", 0.07),
        nwc_pct_rev_delta=base_a.get("nwc_pct_rev_delta", 0.01),
        revenue_base=base_a["revenue_base"], net_debt=base_a["net_debt"], shares=base_a["shares"],
    )
    w0 = base_params.wacc
    g0 = base_params.terminal_growth
    wacc_values = [round(w0 + d / 10000.0, 4) for d in (-150, -75, 0, 75, 150)]
    g_values = [round(g0 + d / 10000.0, 4) for d in (-50, -25, 0, 25, 50)]
    grid: List[List[Any]] = []
    nan_cells = 0
    for w in wacc_values:
        row: List[Any] = []
        for g in g_values:
            try:
                p = DCFParams(**{**base_params.__dict__, "wacc": w, "terminal_growth": g})
                v, _ = value_per_share(p)
                row.append(round(v, 2))
            except ValueError:
                row.append(None)
                nan_cells += 1
        grid.append(row)
    if nan_cells:
        warnings.append(f"敏感性网格 {nan_cells} 个格点不可计算（WACC 与 g 差距过小），以 null 表示")

    return {
        "method": "FCFF_DCF",
        "assumptions_kind": "assumption",
        "applicable": True,
        "scenario_results": scenario_results,
        "sensitivity_grid_base": {"wacc_values": wacc_values, "g_values": g_values, "values": grid},
        "warnings": warnings,
    }


# ---------------------------------------------------------------- 相对估值

def percentile_band(pctile: float) -> str:
    if pctile < 30:
        return "low"
    if pctile > 70:
        return "high"
    return "neutral"


# 同业锚的可比区间：本公司估值与同业中位相差在 0.5–2 倍以内，才认为"同一门生意"可比。
# 超出这个范围时，横向锚不给折算价位——业务结构差异（如代工 vs 品牌）足以解释倍数差，
# 此时把中位数乘 EPS 折成价位，等于用一个不可比的锚定价，是变相的点位判断。
PEER_COMPARABLE_RANGE = (0.5, 2.0)


def _peer_anchor(own: Optional[float], peer_median: Optional[float],
                 eps_ttm: Optional[float]) -> Dict[str, Any]:
    if not peer_median or not own:
        return {
            "peer_median": peer_median,
            "premium_pct": None,
            "implied_price": None,
            "comparable": False,
            "note": "同业数据缺失，横向锚未启用（不猜测同业中枢）",
        }
    premium = (own / peer_median - 1.0) * 100.0
    lo, hi = PEER_COMPARABLE_RANGE
    ratio = own / peer_median
    comparable = lo <= ratio <= hi
    implied = peer_median * eps_ttm if (comparable and eps_ttm) else None
    note = (
        f"本公司 {own:.1f} 倍 vs 同业中位 {peer_median:.1f} 倍 → "
        f"{'折价' if premium < 0 else '溢价'} {abs(premium):.0f}%"
    )
    if comparable:
        note += "；倍数处于同一可比区间，横向锚仅作参照，不构成价位判断"
    else:
        note += ("；两者倍数相差过大（超出 0.5–2 倍可比区间），业务结构差异足以解释，"
                 "横向折算价位不成立，此处不给单点估值")
    return {
        "peer_median": peer_median,
        "premium_pct": round(premium, 1),
        "implied_price": round(implied, 2) if implied else None,
        "comparable": comparable,
        "note": note,
    }


def run_relative(
    metric: str,
    current: Optional[float],
    pctile: Optional[float],
    hist_p25: Optional[float],
    hist_p75: Optional[float],
    eps_ttm: Optional[float],
    peer_median: Optional[float],
    fwd_growth_pct: Optional[float],
    unsupported_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """相对估值。任一必需输入缺失/非正 → available=False，输出 null 而非补零/外推。

    非正不是"缺失"，但后果一样：PE≤0 的"低估"没有含义，EPS≤0 乘出来的价位是负数。
    两者都按不可用处理，并写明原因。
    """
    missing = []
    if current is None:
        missing.append(f"{metric}(TTM)")
    if eps_ttm is None:
        missing.append("EPS(TTM)")
    if current is not None and current <= 0:
        missing.append(f"{metric}(TTM)≤0（亏损状态下该倍数无意义）")
    if eps_ttm is not None and eps_ttm <= 0:
        missing.append("EPS(TTM)≤0（分位带折算价位会得到负股价）")

    if missing or unsupported_reason:
        why = "、".join(missing) if missing else (unsupported_reason or "")
        return {
            "method": "percentile_band",
            "available": False,
            "metric": metric,
            "current": current,
            "percentile_10y": pctile,
            "band": percentile_band(pctile) if pctile is not None else None,
            "bands_definition": {"low": "<30%", "neutral": "30-70%", "high": ">70%"},
            "implied_price_range": {"low": None, "high": None, "eps_used": eps_ttm, "eps_kind": "TTM"},
            "peer_anchor": {
                "peer_median": peer_median,
                "premium_pct": None,
                "implied_price": None,
                "comparable": False,
                "note": "相对估值未启用：" + why + "（不补零、不外推）",
            },
            "priced_in_narrative": (
                "相对估值不可用：" + why
                + "；本报告该法按缺失处理，估值结论仅依赖 DCF 单法，置信度相应降档。"
            ),
        }

    band = percentile_band(pctile) if pctile is not None else None
    if hist_p25 and hist_p75:
        low = hist_p25 * eps_ttm
        high = hist_p75 * eps_ttm
        eps_used, eps_kind = eps_ttm, "TTM"
    else:
        # 无历史分位带数据时退化为 ±20% 中枢带（记录于 note）
        low, high = current * 0.8, current * 1.2
        eps_used, eps_kind = eps_ttm, "TTM"
    anchor = _peer_anchor(current, peer_median, eps_ttm)
    if band is None:
        narrative_parts = [f"当前 {metric}(TTM) {current:.1f} 倍；十年分位数据缺失，分位带不作判定"]
    else:
        narrative_parts = [
            f"当前 {metric}(TTM) {current:.1f} 倍处于十年 {pctile:.0f}% 分位（"
            + {"low": "偏低", "neutral": "中性", "high": "偏高"}[band] + "区间）"
        ]
    if fwd_growth_pct is not None:
        narrative_parts.append(
            f"基准情景预期 EPS 增速约 {fwd_growth_pct:.0f}%，"
            f"当前估值隐含的增长预期与该增速{'匹配' if fwd_growth_pct >= 15 else '存在落差，需催化剂验证'}"
        )
    if band == "high":
        narrative_parts.append("高分位意味着市场已定价较充分的景气与增长预期，超预期空间收窄")
    elif band == "low":
        narrative_parts.append("低分位可能隐含市场对持续性的怀疑，需核对是错杀还是基本面确有瑕疵")
    narrative_parts.append("以上为基于分位与增速的拆解，不构成价格点位判断")

    return {
        "method": "percentile_band",
        "available": True,
        "metric": metric,
        "current": current,
        "percentile_10y": pctile,
        "band": band,
        "bands_definition": {"low": "<30%", "neutral": "30-70%", "high": ">70%"},
        "implied_price_range": {
            "low": round(low, 2), "high": round(high, 2),
            "eps_used": eps_used, "eps_kind": eps_kind,
        },
        "peer_anchor": anchor,
        "priced_in_narrative": "；".join(narrative_parts) + "。",
    }


# ---------------------------------------------------------------- 区间合成

# 读数段的免责句。它必须把"这张图回答什么、不回答什么"说死：
# 区间是两种方法各自认可的价位范围，不是价格预测；"落在下方"也不是动手信号。
_READ_CAVEAT = (
    "这三行只回答「价格落在哪、区间本身有多确定」，不回答「该不该动手」——"
    "后者在结论段的立场句里。区间也不保证会实现：它只是两种方法各自认可的价位范围。"
)


def _position_of(price: Optional[float], lo: Optional[float], hi: Optional[float]) -> Dict[str, Any]:
    """现价相对区间的位置。这是"贵/便宜"唯一可核查的读法，所以必须引擎算。

    三档只有一种含义：价格在区间外还是内。它不是判分，也不算"低估/高估"——
    后者要先承认这套区间是对的，而那正是 note 与 caveat 反复否认的事。
    """
    if price is None or lo is None or hi is None or price <= 0:
        return {"code": "unknown", "gap_pct": None, "zone_pct": None}
    if price < lo:
        return {"code": "below", "gap_pct": round((lo - price) / lo * 100.0, 1), "zone_pct": None}
    if price > hi:
        return {"code": "above", "gap_pct": round((price - hi) / hi * 100.0, 1), "zone_pct": None}
    span = hi - lo
    zone = 50.0 if span <= 0 else round((price - lo) / span * 100.0, 1)
    return {"code": "inside", "gap_pct": None, "zone_pct": zone}


def _reading(
    price: Optional[float],
    lo: Optional[float],
    hi: Optional[float],
    central: Optional[float],
    mode: str,
    divergence: Optional[float],
    dcf_central: Optional[float],
    rel_central: Optional[float],
    confidence: str,
) -> Dict[str, Any]:
    """把三条区间读成三句话：价格在哪、区间有多宽、两法分歧多大。

    此前这三件事全在读者脑子里：现价是条竖线，要和刻度对齐才知道位置；安全边际一个
    "+12.4%" 没有标尺，旁边的 DCF 单法 +16.8% 与相对法 -0.0% 摆着也不知道看哪个；
    交集/并集只是形态标签，没说分歧大就等于区间不可当锚。图上一目了然的是形状，
    真正要说的是读数——所以读数由引擎生成，界面只负责显示。
    """
    pos = _position_of(price, lo, hi)
    lines: List[str] = []

    # ① 价格在哪
    if mode == "union":
        # 并集的两端来自不同方法，中点和位置都没有经济含义（同 safety_margin_pct 的处理）
        pos = {"code": "unknown", "gap_pct": None, "zone_pct": None}
        summary = "两法区间不重叠，并集位置不可读——请分别看下面两条单法区间"
        lines.append(
            "两法区间没有重叠，并集的两端来自不同方法：它的「位置」没有经济含义，所以这里不给读数，"
            "请直接对比下面 DCF 与相对法两条单项，以及各自的单法偏离度。")
    elif pos["code"] == "below":
        summary = f"价格在合成区间下方 {pos['gap_pct']}%（区间外偏低）"
        lines.append(
            f"现价 {price:.2f} 低于合成区间下沿 {lo:.2f} 约 {pos['gap_pct']}%："
            "价格落在两法都认可的范围之外，偏低的一侧。")
    elif pos["code"] == "above":
        summary = f"价格在合成区间上方 {pos['gap_pct']}%（区间外偏高）"
        lines.append(
            f"现价 {price:.2f} 高于合成区间上沿 {hi:.2f} 约 {pos['gap_pct']}%："
            "价格落在两法都认可的范围之外，偏高的一侧。")
    elif pos["code"] == "inside":
        summary = f"价格在合成区间内（{pos['zone_pct']:.0f}% 位置）"
        lines.append(
            f"现价 {price:.2f} 落在合成区间 {lo:.2f}–{hi:.2f} 之内，"
            f"位于区间 {pos['zone_pct']:.0f}% 处：谈不上偏低或偏高，区间本身已经把现价包含在内。")
    else:
        summary = "现价缺失，位置不可读"
        lines.append("现价缺失或区间不可用：位置读数缺失，不补数、不猜。")

    # ② 区间有多宽：宽度即方法自身的不确定度
    width: Dict[str, Any] = {"abs": None, "pct": None}
    if lo is not None and hi is not None and central:
        width = {"abs": round(hi - lo, 2), "pct": round((hi - lo) / central * 100.0, 1)}
        lines.append(
            f"区间宽度 {width['abs']:.2f} 元，相当于中值的 {width['pct']}%："
            "这是两种方法自身的不确定度，越宽越不该把上下沿当硬边界。")

    # ③ 两法分歧：分歧大时该先解释假设，再谈价格在哪
    # 两个"中枢"口径不同（DCF 取基准值、相对法取区间中点），所以必须标出来：
    # 直接摆两个数不说明，读者会拿区间中点去对 DCF 的 37.97 对不上，反而多一层困惑。
    if divergence is not None and dcf_central is not None and rel_central is not None:
        side = "低" if divergence < 0 else "高"
        lines.append(
            f"相对法中枢比 DCF {side} {abs(divergence):.0f}%"
            f"（DCF 基准值 {dcf_central:.2f} / 相对法区间中点 {rel_central:.2f}，两者口径不同）："
            "分歧越大，越该先解释两套假设差在哪，再看价格落在哪——"
            "否则「便宜」只是挑了对自己有利的那一条。")

    return {
        "price": price,
        "position": pos,
        "width": width,
        "confidence_level": confidence,
        "summary": summary,
        "lines": lines,
        "caveat": _READ_CAVEAT,
    }


def synthesize(
    dcf_base: Optional[Dict[str, Any]],
    relative: Dict[str, Any],
    price: Optional[float],
    dcf_warnings: List[str],
    gate: Optional[Any] = None,
) -> Dict[str, Any]:
    # 前门不适用：连 DCF 都没算，任何"合成"都是编的
    if gate is not None and not getattr(gate, "dcf_applicable", True):
        return {
            "dcf_base_range": {"low": None, "high": None},
            "relative_range": {"low": None, "high": None},
            "combined_range": {"low": None, "high": None},
            "mode": "not_applicable",
            "safety_margin_pct": None,
            "margin_basis": "none",
            "dcf_margin_pct": None,
            "relative_margin_pct": None,
            "divergence_pct": None,
            "confidence_level": "none",
            "reading": {
                "price": price,
                "position": {"code": "unknown", "gap_pct": None, "zone_pct": None},
                "width": {"abs": None, "pct": None},
                "confidence_level": "none",
                "summary": "不出区间：本框架对该类公司不适用",
                "lines": [
                    f"{gate.code}：{gate.reason}",
                    "没有区间就没有「价格落在哪」这个读数——不是读不懂，是这类公司不该用这把尺子量。",
                ],
                "caveat": _READ_CAVEAT,
            },
            "note": (f"估值前门判定不适用（{gate.code}）：{gate.reason}"
                     "本报告不出估值区间，也不计算安全边际——给一个数再标低置信度，"
                     "读者只会记住那个数。"),
        }

    d_lo = dcf_base["value_per_share_low"] if dcf_base else None
    d_hi = dcf_base["value_per_share_high"] if dcf_base else None
    rel_ok = bool(relative.get("available", True)) and relative["implied_price_range"]["low"] is not None

    if rel_ok:
        r_lo = relative["implied_price_range"]["low"]
        r_hi = relative["implied_price_range"]["high"]
        relative_range = {"low": r_lo, "high": r_hi}
        if d_lo is None:
            mode, lo, hi = "relative_only", r_lo, r_hi
        else:
            inter_lo, inter_hi = max(d_lo, r_lo), min(d_hi, r_hi)
            if inter_lo <= inter_hi:
                mode, lo, hi = "intersection", inter_lo, inter_hi
            else:
                mode, lo, hi = "union", min(d_lo, r_lo), max(d_hi, r_hi)
    else:
        mode, lo, hi = "dcf_only", d_lo, d_hi
        relative_range = {"low": None, "high": None}

    # 最后一道闸：股价不可能为负。宁可不出区间，也不出一个 -17.6 元的区间。
    if lo is not None and (lo <= 0 or (hi is not None and hi <= 0)):
        return {
            "dcf_base_range": {"low": d_lo, "high": d_hi},
            "relative_range": relative_range,
            "combined_range": {"low": None, "high": None},
            "mode": "rejected",
            "safety_margin_pct": None,
            "margin_basis": "none",
            "dcf_margin_pct": None,
            "relative_margin_pct": None,
            "divergence_pct": None,
            "confidence_level": "none",
            "reading": {
                "price": price,
                "position": {"code": "unknown", "gap_pct": None, "zone_pct": None},
                "width": {"abs": None, "pct": None},
                "confidence_level": "none",
                "summary": "不出区间：区间上下限出现非正值",
                "lines": [
                    f"区间 [{lo}, {hi}] 含非正值：股价不可能为负，说明方法或输入已失效。",
                    "方法已失效时，任何「现价在区间上方/下方」的读数都是伪造的，所以不给。",
                ],
                "caveat": _READ_CAVEAT,
            },
            "note": (f"区间下限/上限为非正（[{lo}, {hi}]）：股价不可能为负，"
                     "说明方法或输入已失效（典型原因：亏损公司、负 EPS、净债务超过 EV）。"
                     "本报告拒绝输出该区间。"),
        }

    central = (lo + hi) / 2.0 if (lo is not None and hi is not None) else None

    # 两个单法口径各自的中枢与偏离度：即使不给"合成安全边际"，也要让读者看到分歧有多大。
    # DCF 中枢必须取 value_per_share_central——那是评分卡 val.dcf_margin 用的同一个数。
    # 用 [low, high] 的中点会得到第二个口径（样例 19.3% vs 评分卡 16.8%），
    # 等于把"两个安全边际"从页面上删掉又重新造了一个。
    dcf_central = dcf_base.get("value_per_share_central") if dcf_base else None
    if dcf_central is None and d_lo is not None and d_hi is not None:
        dcf_central = (d_lo + d_hi) / 2.0
    rel_central = (r_lo + r_hi) / 2.0 if rel_ok else None

    def _margin(c: Optional[float]) -> Optional[float]:
        if c is None or not price or price <= 0:
            return None
        return round((c - price) / price * 100.0, 1)

    dcf_margin = _margin(dcf_central)
    rel_margin = _margin(rel_central)
    divergence = (round((rel_central / dcf_central - 1.0) * 100.0, 1)
                  if (rel_central and dcf_central and dcf_central > 0) else None)

    # 两法无重叠时，并集的中点没有经济含义：一端来自 DCF 区间、另一端来自 10 年 PE 分位带，
    # 中点既不是"DCF 的结论"也不是"市场给的价"。此前它照样被算成安全边际，
    # 于是宁德时代出现 +282%、茅台 +38.6%，而同一份报告的评分卡里 DCF 单法是 +45.9% / -9.4%
    # ——同页两个"安全边际"互相矛盾，读者只会挑对自己有利的那个。
    if mode == "union":
        safety = None
        margin_basis = "none"
    else:
        safety = _margin(central)
        margin_basis = "combined"

    if mode == "dcf_only":
        level = "low"
    elif mode == "intersection" and not dcf_warnings:
        level = "high"
    elif mode == "intersection" or not dcf_warnings:
        level = "medium"
    else:
        level = "low"
    if mode == "dcf_only":
        note = "相对估值不可用，合成区间退化为基准情景 DCF 单法区间；置信度按 low 处理（单法无法交叉验证）。"
    elif mode == "relative_only":
        note = "DCF 未执行，合成区间退化为相对估值单法；单法无法交叉验证，置信度按 low 处理。"
    elif mode == "union":
        note = (
            f"两法区间无重叠（方法分歧）：DCF [{d_lo}, {d_hi}] 对相对法 [{r_lo}, {r_hi}]，中枢相差 "
            f"{divergence:+.0f}%）：并集范围由较宽一侧决定，其中点既不是 DCF 结论也不是市场价位，"
            "没有经济含义，故**不输出合成安全边际**。请分别读 DCF 单法安全边际"
            f"（{dcf_margin}%）与相对法分位带隐含折溢价（{rel_margin}%）。"
            "两法分歧本身就是结论的一部分：分歧越大，越应先解释假设差异，再谈贵贱。"
        )
    else:
        note = (
            "合成区间 = 基准情景 DCF 区间与相对估值分位带区间的交集"
            "；仅为安全边际度量基准，非价格点位预测；加权期望值同为参考量。"
        )
    return {
        "dcf_base_range": {"low": d_lo, "high": d_hi},
        "relative_range": relative_range,
        "combined_range": {"low": round(lo, 2) if lo is not None else None,
                           "high": round(hi, 2) if hi is not None else None},
        "mode": mode,
        "safety_margin_pct": safety,
        "margin_basis": margin_basis,
        "dcf_margin_pct": dcf_margin,
        "relative_margin_pct": rel_margin,
        "divergence_pct": divergence,
        "confidence_level": level,
        "reading": _reading(
            price=price, lo=lo, hi=hi, central=central, mode=mode,
            divergence=divergence, dcf_central=dcf_central, rel_central=rel_central,
            confidence=level,
        ),
        "note": note,
    }
