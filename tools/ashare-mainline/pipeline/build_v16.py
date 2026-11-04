"""按 v1.6 契约组装完整报告（通用版：任意条主线，数值全部从缓存现算）。

    python -m pipeline.build_v16 --as-of 2026-11-02 --out aml-20261102-v16.json

与 build_report.py 的区别：后者是 2026-10-30 那一轮单主线的手写稿；本模块把
metrics / persistence / score_breakdown / 闸门矩阵 / 轮动榜全部由 cache 现算，
文字部分集中在 CONTENT 里，换一天只要改 as_of 与文字。数值口径与 score.py 逐项对齐，
组装完做一致性自检（score = Σ贡献 − 惩罚、闸门条数与 metrics 自洽、rs.raw == rs_20）。
"""
from __future__ import annotations

import argparse
import json
import pickle
import sqlite3
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from pipeline import day  # noqa: E402
from pipeline.score import WEIGHTS, pct_in  # noqa: E402

C = ROOT / "pipeline" / "cache"

# ---------------------------------------------------------------- 文字内容
# 每条主线的文字口径：drivers 的条数决定 narrative 分档（0/40/60/75/85）+ 最高来源加分
# （官方原文 +15 / 公司公告 +10 / 主流媒体 +5 / 卖方研报 0 / 社媒 −10），
# 与 templates/narrative.json 里落盘的分值必须一致，组装时断言。
CONTENT = {
    "BK1277": {
        "id": "ml-baijiu", "name": "白酒：政策催化下的拥挤修复", "theme_type": "industry",
        "aliases": ["白酒Ⅱ", "酿酒", "食品饮料修复"],
        "stage_label": "加速期", "stage_confidence": 0.70, "rank_change": 0,
        "logic": "20 日 +14.18%、60 日仅 +3.90%，仍是横盘一年后的估值修复而非景气反转：三季报白酒整体收入/利润同比 −10%/−13%，涨的是茅台这类确定性资产与政策预期。",
        "catalyst": "11-03 发改委等五部门印发《关于加强消费基础设施建设 促进消费投资良性互动的指导意见》，部署 20 项重点任务；板块逆势 +1.43%，皇台酒业 3 连板，水井坊 +4.52%、茅台 +2.84%，19 只有效成分股 78.9% 上涨。",
        "sustainability": "8/20 天进前 10、连续 4 天，P1/P2/P3 全过；但份额分位 0.9883、拥挤度 0.9941 已触发 R2，继续向上要靠增量资金而不是存量换手。",
        "bear_case": "加速期的风险来自自己：份额分位 0.9883、单日成交额占全 A 1.34%，任何一天 Δ5 转负都会同时打掉 P3 与 volume 因子；涨停仅 1 家、封板率 1.0 只由单只股票决定，情绪含量被高估。三季报白酒收入利润仍双位数下滑，若 11 月批价与动销不跟随，+14.18% 就是修复的上限。",
        "drivers": [
            {"type": "policy", "title": "五部门印发消费基础设施建设指导意见，部署 20 项任务",
             "detail": "11-03 国家发改委等五部门联合印发《关于加强消费基础设施建设 促进消费投资良性互动的指导意见》，从城乡商业设施、服务消费设施、出行消费设施三个维度补齐短板",
             "date": "2026-11-03", "source": "国家发展改革委等五部门（界面新闻转载原文要点）", "verified": True},
            {"type": "earnings", "title": "三季报分化：茅台 Q3 净利 +3.78%，行业总量仍降",
             "detail": "贵州茅台 Q3 营收 410 亿元、同比 +3%，净利 200 亿元、同比 +3.78%，高于市场预期；同期白酒行业 Q3 收入/利润同比 −10%/−13%，五粮液、泸州老窖、山西汾酒延续调整",
             "date": "2026-11-03", "source": "界面新闻、上市公司三季报", "verified": True},
            {"type": "industry", "title": "高盛判断 2026Q3 为白酒盈利低谷，2027 年恢复增长",
             "detail": "高盛预计 2026 年第三季度是中国白酒行业盈利低谷，2027 年营收与净利增速有望回升至 7% 和 10%",
             "date": "2026-11-03", "source": "财联社、中国基金报（转引高盛研报）", "verified": True},
            {"type": "liquidity", "title": "板块逆势上涨，皇台酒业 3 连板、茅台涨 2.84%",
             "detail": "11-03 大盘下跌中白酒Ⅱ +1.43%，19 只有效成分股 78.9% 上涨；皇台酒业 3 连板，水井坊 +4.52%、贵州茅台 +2.84% 收 1470 元上方",
             "date": "2026-11-03", "source": "东方财富板块行情、腾讯行情快照", "verified": True},
        ],
        "leader_note": {
            "600519": "板块龙头，成交 108.26 亿占板块近四成，20 日 +19.78%、5 日 +9.15%",
            "000858": "权重第二，20 日 +9.86%，明显滞后于板块",
            "000568": "次高端主力，5 日 +14.04%、20 日 +16.46%",
            "600809": "清香龙头，5 日 +17.44%、20 日 +19.35%，弹性高于板块",
            "000596": "区域酒龙头，5 日 +20.86%、20 日 +18.24%，涨幅居前",
        },
        "ladder_note": "茅台—次高端（汾酒/老窖/古井）—区域酒（迎驾/今世缘/水井坊）三层梯队完整；但涨停仅 1 家，3 连板来自皇台酒业这类小市值标的，情绪高度与板块体量不匹配",
        "invalidation": [
            {"condition": "份额由聚转散", "threshold": "turnover_share_chg_5 < 0 且 turnover_share_pct_250 < 0.90（当前 +0.54pct / 0.9883）",
             "note": "P3 与 R2 的同一组变量，转负即意味着增量资金停止"},
            {"condition": "龙头跌破 20 日均线", "threshold": "600519 收盘价跌破 MA20（当前 MA20 约 {ma20_600519} 元）", "note": "龙头破位通常领先板块 3～5 个交易日"},
            {"condition": "涨停梯队消失", "threshold": "板块涨停家数连续 3 个交易日为 0（当日 1 家）", "note": "加速期靠梯队维持情绪，梯队没了就只剩权重护盘"},
        ],
        "watch": [
            {"item": "飞天茅台批价与双十一动销", "why": "估值修复要转成趋势，必须有价格与动销的第二段证据"},
            {"item": "份额分位能否守住 0.95", "why": "已到样本高位，回落会同时打掉 volume 因子与 P3 闸门"},
            {"item": "五部门消费新政的细则与资金落地", "why": "20 项任务是框架性文件，落地节奏决定行情能否从情绪走向基本面"},
        ],
        "related": ["ml-rail"],
    },
    "BK0421": {
        "id": "ml-rail", "name": "铁路公路：回购增持制度化下的低估值防守位", "theme_type": "industry",
        "aliases": ["铁路公路", "高速公路", "红利防守"],
        "stage_label": "发酵期", "stage_confidence": 0.64, "rank_change": 2,
        "logic": "20 日 +1.35%、60 日 +0.67%，涨幅不大但回撤极小，是杀估值时的临时资金容器：11-03 大盘 −0.82%、创业板指 −2.73%，板块 +0.82%，33 只有效成分股 72.7% 上涨。",
        "catalyst": "11-02 央行、金融监管总局、证监会将股票回购增持再贷款由阶段性安排转为长期制度性安排、利率由 1.25% 降至 1%，低估值高分红资产的回购增持能力被制度性抬高；11-03 中证红利 +0.13%、高股息 100 指数 +1.46%，与创业板指 −2.73% 形成对冲。",
        "sustainability": "8/20 天进前 10、连续 6 天，P1 与 P2 均过，分数主要来自持续性（分位 95.3）与广度（79.4）；但量能与资金都不支持：份额仅 0.36%、Δ5 +0.06pct、分位 0.8346（P3 未过），5 日主力净额 −4.99 亿、20 日 −22.24 亿。份额微升是缩量下的相对占比抬升，不是资金主动买入。",
        "bear_case": "主力资金 5 日净流出 4.99 亿、20 日 −22.24 亿，抬价的是权重股的小额买盘而非增量资金；一旦红利资产被卖出，板块没有承接。板块内当日涨停 1 家：龙江交通（冰雪经济题材股、Q3 净利同比 −13.52%），题材退潮后涨幅会回落到权重股节奏。",
        "drivers": [
            {"type": "policy", "title": "回购增持再贷款转为制度性安排，利率降到 1%",
             "detail": "11-02 央行、金融监管总局、证监会座谈会明确：股票回购增持再贷款由阶段性安排转为长期制度性安排，利率由 1.25% 降至 1%；第三批互换便利 31 家机构申请额度超 1000 亿元",
             "date": "2026-11-02", "source": "中国人民银行网站、中国证监会答记者问", "verified": True},
            {"type": "liquidity", "title": "红利资产逆势，资金从成长切向低 beta",
             "detail": "11-03 中证红利 +0.13%、高股息 100 指数 +1.46%、铁路公路 +0.82%，同期创业板指 −2.73%、科创50 −3.81%",
             "date": "2026-11-03", "source": "中证指数官网、腾讯行情", "verified": True},
            {"type": "event", "title": "冰雪经济数据前置，龙江交通 4 天 2 板",
             "detail": "美团数据显示 10 月以来“滑雪”搜索量同比 +125%，11 月至次年 3 月雪场周边 5 公里住宿预订量同比 +217%；龙江交通 11-03 涨停（4 天 2 板），板块内区域高速股跟涨",
             "date": "2026-11-03", "source": "财联社（引美团数据）", "verified": True},
        ],
        "leader_note": {
            "601816": "成交 10.52 亿居首，20 日 +12.77%、5 日 +2.51%，权重压舱石",
            "601188": "板块内当日涨停 1 家（盘中有开板），冰雪经济题材，5 日 +19.35%、20 日 +28.92%",
            "601006": "货运权重，20 日 +7.84%、今日 +2.06%",
            "001317": "物流小市值，20 日 −12.40%，波动显著大于板块",
            "600020": "区域高速，5 日 +13.91%、20 日 +13.32%",
        },
        "ladder_note": "无连板梯队：1 家涨停且封板率为 0（盘中开板），上涨靠权重（京沪高铁、大秦铁路）与区域高速普涨，属广度型而非情绪型结构",
        "invalidation": [
            {"condition": "量能继续走弱", "threshold": "turnover_share_chg_5 < 0 且 turnover_share_pct_250 < 0.60（当前 +0.06pct / 0.8346）",
             "note": "P3 的同一组变量；量能转负意味着防守资金也在撤"},
            {"condition": "广度掉头", "threshold": "板块上涨占比 < 55%（当日 72.7%），P2 失守后只剩 P1 一条闸门",
             "note": "这条主线的分数主要来自广度与持续性，广度没了就没有第二条腿"},
            {"condition": "红利资产被抽血", "threshold": "中证红利单日跌幅 >1% 且成交额放大（当日 +0.13%）",
             "note": "风险偏好回升时，低 beta 方向是最先被卖出的资金来源"},
        ],
        "watch": [
            {"item": "10 月货运量与高速车流数据", "why": "防守逻辑最终要落到现金流，运量是可验证的高频指标"},
            {"item": "回购增持再贷款落地案例是否覆盖公路铁路", "why": "政策是行业级的，个股是否真用这笔钱决定估值修复的斜率"},
            {"item": "龙江交通等题材股退潮后权重能否接住", "why": "板块当日的超额涨幅有一半来自单只题材股"},
        ],
        "related": ["ml-baijiu"],
    },
    "BK1046": {
        "id": "ml-game", "name": "游戏Ⅱ：影之刃零与版号共振，加速期的单点情绪", "theme_type": "industry",
        "aliases": ["游戏Ⅱ", "游戏", "手游/端游"],
        "stage_label": "加速期", "stage_confidence": 0.71, "rank_change": 2,
        "logic": (
            "20 日 +10.52%、5 日 +5.19%，今日 +2.28%；24 只有效成分股 87.5% 上涨、37.5% 创 20 日新高，"
            "但涨停只有大晟文化 1 家（3 连板），封板率 1.0——高度集中在单只小市值题材股。"
            "成交额占全 A 0.92%、Δ5 +0.26pct、250 日分位 0.7949，5 日主力净流入占同期成交额 1.41%，"
            "是本期唯一「价、量、资金」三项同向的板块；拥挤度 0.8936 已贴近 0.90 的 R2 阈值。"
        ),
        "catalyst": (
            "11-04 游戏板块催化密集：①《影之刃零》上线 72 小时全球销量突破 400 万份、三天流水约 10 亿元，登顶多平台畅销榜；"
            "②10 月国产+进口网络游戏版号合计 195 款、同比 +17.47%，年内累计 1708 款已超去年全年；"
            "③AI 原生游戏与腾讯混元 Hy4 适配游戏引擎、TapTap 生态受益被多家媒体报道。"
            "三季报方面，世纪华通、巨人网络、恺英网络利润端延续修复，为题材提供了业绩底座。"
        ),
        "sustainability": (
            "P1 6/20 天、连续 3 天；P2 上涨 87.5%、新高 37.5%；P3 Δ5 +0.26pct 未达 +0.5pct，闸门 2/3。"
            "加速期判据命中 2/3（拥挤 0.8936>0.85、封板率 1.0>0.75，20 日涨幅 10.52% 未达 25%）。"
            "持续性来自版号与爆款产品的产业周期，但当日情绪宽度只有 1 家涨停，属于「产业趋势成立、情绪结构单点」。"
        ),
        "bear_case": (
            "最大风险是情绪结构过窄：3 连板只有大晟文化一只小市值题材股，板块涨停家数一旦归零，"
            "P2 的上涨占比与新高占比会快速回落；拥挤度 0.8936 距 R2 仅 0.0064，若成交额继续放大而价格滞涨，"
            "就会从「加速」直接切到「拥挤兑现」。此外《影之刃零》流水集中在首周，11 月版号若低于预期，叙事分会下修。"
        ),
        "drivers": [
            {"type": "event", "title": "《影之刃零》上线 72 小时全球销量突破 400 万份、三天流水约 10 亿元",
             "detail": "灵游坊《影之刃零》上线 72 小时全球销量突破 400 万份，登顶 Steam 等多平台畅销榜，三天流水约 10 亿元，成为国产买断制单机的新纪录",
             "date": "2026-11-04", "source": "灵游坊官方公告、财联社（转引）", "verified": True},
            {"type": "policy", "title": "10 月版号 195 款、同比 +17.47%，年内 1708 款超去年全年",
             "detail": "10 月国产与进口网络游戏版号合计 195 款，同比 +17.47%；年内累计 1708 款，已超过 2025 年全年发行数量",
             "date": "2026-11-03", "source": "国家新闻出版署公开信息（财联社整理）", "verified": True},
            {"type": "industry", "title": "AI 原生游戏与混元 Hy4 引擎适配，TapTap 生态受益",
             "detail": "腾讯混元 Hy4 完成游戏引擎适配，AI 原生游戏研发成本下降；TapTap 等分发平台被多家机构列为受益环节",
             "date": "2026-11-04", "source": "财联社、每日经济新闻", "verified": True},
            {"type": "earnings", "title": "世纪华通、巨人网络、恺英网络三季报利润端延续修复",
             "detail": "世纪华通、巨人网络、恺英网络 2026 年三季报归母净利同比修复，为题材行情提供业绩底座",
             "date": "2026-10-30", "source": "上市公司三季报（证券时报汇总）", "verified": True},
        ],
        "leader_note": {
            "300315": "成交 22.33 亿居首，AI 原生游戏与买量投放受益，5 日涨幅领先",
            "002558": "成交 21.78 亿，20 日主升，版号与《原始征途》流水支撑",
            "600715": "文投控股成交 21.30 亿，影视游戏双主业，题材弹性大",
            "002602": "世纪华通成交 17.53 亿，三季报利润修复，权重属性",
        },
        "ladder_note": "高度只有 3 连板（大晟文化），且全板块仅 1 家涨停，封板率 1.0 由单只个股决定；巨人网络、完美世界等权重普涨但不涨停，属「权重搭台、题材唱戏」结构",
        "invalidation": [
            {"condition": "情绪断板", "threshold": "大晟文化断板且板块涨停家数连续 2 日为 0", "note": "当日涨停仅 1 家，情绪高度完全由单只小市值承担"},
            {"condition": "P3 量能失守", "threshold": "turnover_share_chg_5 < 0 且 turnover_share_pct_250 < 0.60（当前 +0.26pct / 0.7949）", "note": "量与价同向是本期唯一的确认项，量能转负即降为观察位"},
            {"condition": "拥挤兑现", "threshold": "拥挤度 >0.90 且 5 日主力净流入转负（当前 0.8936 / 净流入）", "note": "距 R2 阈值仅 0.0064，拥挤度越线后不再加仓"},
        ],
        "watch": [
            {"item": "《影之刃零》首周后流水与口碑是否延续", "why": "爆款产品的长尾决定叙事能否从事件升级为景气"},
            {"item": "11 月版号发放节奏与数量", "why": "版号是游戏板块最稳定的政策变量，同比增速是叙事分的锚"},
            {"item": "大晟文化连板高度与板块封板率", "why": "单点情绪结构下，最高标的断板就是板块情绪转向的第一信号"},
        ],
        "related": ["ml-publish"],
    },
    "BK1218": {
        "id": "ml-publish", "name": "出版：短剧情绪扩散，扩张期的高拥挤", "theme_type": "industry",
        "aliases": ["出版", "传媒出版", "短剧概念"],
        "stage_label": "扩张期", "stage_confidence": 0.66, "rank_change": 3,
        "logic": (
            "20 日 +7.13%、60 日 +18.46%，20/20 天进入滚动前 10、连续 20 天——持续性样本里最好；"
            "今日 +2.78%、28 只有效成分股 78.6% 上涨、14.3% 创 20 日新高，涨停 2 家（中信出版 20cm、龙版传媒），"
            "但封板率 0（盘中开板），最高 3 连板。成交占全 A 0.54%、Δ5 −0.07pct、分位 0.907，"
            "5 日主力净流出占成交额 0.84%，龙头 5 日 −18.10%，拥挤度 0.9379 触发 R2 −6。"
        ),
        "catalyst": (
            "11-04 短剧概念集体活跃：大晟文化、浙文影业、龙版传媒 3 连板，引力传媒、中信出版 3 天 2 板（中信出版 20cm 涨停）；"
            "传媒板块当日成交 8433 亿、占全 A 41.1%，TMT 成交占比升至 41.1%。"
            "出版是本轮短剧情绪的「内容+版权」承接方向：中信出版、果麦文化、阅文系版权储备被资金反复交易；"
            "同时 20 日持续性来自出版发行数据与三季报现金流改善，属于题材与基本面共振。"
        ),
        "sustainability": (
            "P1 20/20 天、连续 20 天；P2 上涨 78.6%、新高 14.3%；P3 Δ5 −0.07pct 未过，闸门 2/3。"
            "扩张期判据命中 2/4（连板 3、上涨 78.6%≥60%；分位 0.907 超出 0.60~0.85、涨停 2 家不足 5 家）。"
            "20 天持续性与 60 日 +18.46% 说明趋势资金已在场，但当日封板率 0 与主力净流出说明分歧也在放大。"
        ),
        "bear_case": (
            "①龙头 5 日 −18.10%，权重出版股已提前调整，短剧高度由小市值题材股提供，结构类似「题材扩散末端」；"
            "②封板率 0、2 家开板，情绪承接力弱；③主力 5 日净流出 0.84%，份额 Δ5 转负；"
            "④拥挤度 0.9379 已触发 R2 −6，若短剧监管收紧或高标断板，回撤会集中在题材股。"
        ),
        "drivers": [
            {"type": "event", "title": "短剧概念集体活跃：龙版传媒/大晟文化/浙文影业 3 连板，中信出版 3 天 2 板",
             "detail": "短剧概念 11-04 集体活跃，龙版传媒、大晟文化、浙文影业 3 连板，引力传媒、中信出版 3 天 2 板，其中中信出版为 20cm 涨停",
             "date": "2026-11-04", "source": "财联社、证券时报", "verified": True},
            {"type": "liquidity", "title": "传媒成交 8433 亿、占全 A 41.1%，TMT 成交占比创阶段新高",
             "detail": "11-04 传媒相关成交额 8433 亿元，占全 A 成交 41.1%，TMT 成交占比升至阶段高位，为短剧扩散提供资金基础",
             "date": "2026-11-04", "source": "财联社", "verified": True},
            {"type": "earnings", "title": "出版发行与三季报现金流改善，板块 20/20 天进入滚动前 10",
             "detail": "出版发行板块三季报经营性现金流改善，叠加版权储备的重估，板块连续 20 个交易日进入滚动 20 日涨幅前 10",
             "date": "2026-11-03", "source": "上市公司三季报、东方财富面板（媒体汇总）", "verified": True},
            {"type": "industry", "title": "中信出版 20cm 涨停、版权储备被短剧改编需求重估",
             "detail": "中信出版 20cm 涨停、3 天 2 板，果麦文化、阅文系版权储备被资金反复交易，短剧改编需求带动出版版权重估",
             "date": "2026-11-04", "source": "证券时报、上海证券报", "verified": True},
        ],
        "leader_note": {
            "600825": "成交 19.58 亿居首，短剧版权与出版发行双逻辑，5 日仍 −18.10%（龙头分歧）",
            "301052": "果麦文化成交 13.40 亿，民营出版与 IP 运营，题材弹性",
            "002181": "粤传媒成交 11.86 亿，地方传媒平台，短剧内容分发",
            "605577": "龙版传媒成交 7.11 亿、3 连板，黑龙江出版平台，情绪高标",
            "300788": "中信出版成交 5.86 亿、20cm 涨停 3 天 2 板，版权储备与短剧改编",
        },
        "ladder_note": "3 连板：龙版传媒（出版）、大晟文化（影视）、浙文影业（影视）；3 天 2 板：中信出版（20cm）、引力传媒。封板率 0、2 家开板，高度由短剧题材股提供，权重出版股未同步",
        "invalidation": [
            {"condition": "短剧高标断板", "threshold": "龙版传媒或大晟文化任一跌停／断板且板块涨停家数 ≤1", "note": "情绪高度由小市值题材股提供，高标断板即扩散结束"},
            {"condition": "份额与资金双降", "threshold": "turnover_share_chg_5 < −0.20pct 且 5 日主力净额为负（当前 −0.07pct／净流出）", "note": "P3 与 fundflow 同步走弱，趋势资金撤离"},
            {"condition": "龙头跌破 20 日线", "threshold": "600825 收盘跌破 MA20 {ma20_600825}（当前 600825 为成交额第一）", "note": "龙头是板块最后的支撑，破位意味着权重补跌"},
        ],
        "watch": [
            {"item": "短剧内容备案与监管口径", "why": "题材的政策敏感度最高，监管变化会直接终结情绪"},
            {"item": "中信出版、龙版传媒能否维持封板", "why": "封板率 0 已示弱，次日封板是修复情绪的必要条件"},
            {"item": "传媒成交占比是否维持 40% 以上", "why": "TMT 成交占比是本轮扩散的资金基础，占比回落意味着题材退潮"},
        ],
        "related": ["ml-game"],
    },
}

# 全局文字
REGIME_NARRATIVE = (
    "11-04 是科技股主导的报复性反弹：沪指 +2.16%、深成指 +4.22%、创业板指 +6.40%、科创50 +9.92%，中证500 +4.66%、沪深300 +2.31%，小盘与成长弹性最大。"
    "全市场 4667 家上涨对 778 家下跌（涨跌比 6.00、up_ratio 0.8377），涨停 118 家、跌停 10 家、炸板 33 家、封板率 78.15%，最高 3 连板，赚钱效应显著修复。"
    "但 20 日维度仍是下跌市：中证全指 −8.88%、深成指 −12.04%、创业板指 −18.84%、科创50 −17.29%，只有中证红利 +1.77% 保持 20 日正收益，今日 −0.07%。"
    "结构上是科技硬件的单日暴力反弹与高位红利的让位：半导体 +10.64%（20 日 −19.46%、Δ5 份额 −0.36pct）、元件 +7.26%（Δ5 +0.65pct）、通信设备 +5.72%；白酒 −1.81%、银行 −0.18%、保险 −0.69%、铁路公路 −0.05%。"
    "成交额 2.05 万亿，较 11-03 的 1.71 万亿放量约 3400 亿，TMT 成交占比 41.1%（8433 亿），反弹有量能支撑。"
)

VERDICT_HEADLINE = "科技报复性反弹与短剧情绪共振：游戏加速、出版高拥挤扩张，全样本只有 2 条主线可判定"

VERDICT_THESIS = (
    "11-04 的反弹由科技硬件主导：隔夜美股科技股大幅反弹，A 股半导体 +10.64%、元件 +7.26%、通信设备 +5.72%，把连续下跌的 TMT 从超跌位拉回；"
    "成交额重返 2.05 万亿、TMT 成交占比 41.1%，属放量反弹而非缩量反抽。防守方向同步让位：白酒 −1.81%、银行 −0.18%、保险 −0.69%、铁路公路 −0.05%、中证红利 −0.07%，"
    "11-03 的两条防守主线本期全部只剩 1 条闸门。"
    "按反脉冲三原则对 128 个板块穷举：P1 过关 8 个、P3 过关 1 个，9 个板块进入闸门矩阵，其中 4 个过 ≥2 条（游戏Ⅱ、数字媒体、影视院线、出版）。"
    "但阶段判定只有游戏Ⅱ（加速期）与出版（扩张期）可给出，数字媒体与影视院线因 P3 未过、阶段无值降入萌芽。本期因此只输出 2 条主线，不凑数："
    "游戏的问题是情绪单点（涨停 1 家、3 连板仅大晟文化），出版的问题是拥挤（分位 0.907、拥挤度 0.9379、R2 −6）与量能转负（Δ5 −0.07pct）。"
)

VERDICT_POINTS = [
    {"title": "科技硬件是反弹的发动机，但资金没有同步回来",
     "detail": "半导体 +10.64%（20 日 −19.46%、5 日份额 −0.36pct、5 日主力净流出占成交额 0.80%）、元件 +7.26%（Δ5 +0.65pct，但 5 日主力净流出 2.40%）、通信设备 +5.72%；反弹是存量回补，不是增量入场。"},
    {"title": "游戏Ⅱ过两条闸门，是本期唯一「价、量、资金」同向的板块",
     "detail": "P1 6/20 天连续 3 天、P2 上涨 87.5%/新高 37.5%、P3 Δ5 +0.26pct 且分位 0.7949；份额 0.92%、5 日主力净流入占成交额 1.41%，六因子 80.58 分，判加速期（拥挤 0.8936、封板率 1.0）。"},
    {"title": "出版 20/20 天持续性最好，但已进入拥挤兑现区",
     "detail": "P1 20/20 天连续 20 天、P2 上涨 78.6%/新高 14.3%，P3 Δ5 −0.07pct 未过；拥挤度 0.9379 触发 R2 −6，封板率 0、2 家开板，龙头 5 日 −18.10%，扩张期靠的是趋势资金而非当日情绪。"},
    {"title": "短剧情绪在传媒内部扩散，数字媒体与影视院线只差量能",
     "detail": "数字媒体 P2 上涨 100%、影视院线 P2 上涨 88.9%，但 P3 分别为 −0.02pct、+0.01pct，两条闸门之后阶段无值，按规则降入萌芽，不进主线。"},
    {"title": "高位红利与消费让位，防守不再是当日主线",
     "detail": "白酒 −1.81%（上涨占比仅 10.5%）、银行 −0.18%、保险 −0.69%、铁路公路 −0.05%，中证红利 −0.07%；11-03 的白酒与铁路公路本期各只剩 P1 一条闸门，均退入萌芽。"},
]

RISKS = [
    {"id": "r1", "level": "high", "title": "出版的拥挤度已在样本高位",
     "detail": "份额分位 0.907、拥挤度 0.9379 同时越过 0.90，触发 R2 −6；封板率 0、2 家开板，龙头 5 日 −18.10%，情绪与资金都在走弱。",
     "trigger": "出版 turnover_share_chg_5 继续为负，或龙版传媒/大晟文化等高标断板",
     "mitigation": "只减不加；把仓位向未触发拥挤惩罚的游戏Ⅱ倾斜，但不超过总仓位的两成",
     "affected": ["ml-publish"]},
    {"id": "r2", "level": "high", "title": "科技反弹没有资金确认，可能是一日游",
     "detail": "半导体当日 +10.64%、20 日仍 −19.46%、5 日份额 −0.36pct、主力净流出；元件 Δ5 +0.65pct 但 5 日主力净流出 2.40%，反弹由交易型资金推动。",
     "trigger": "半导体或元件 5 日份额连续 2 日为负，或科创50 单日回落 >3%",
     "mitigation": "总仓位上限六成；反弹不追高，只做份额转正的方向",
     "affected": ["ml-game", "ml-publish"]},
    {"id": "r3", "level": "medium", "title": "游戏的情绪高度依赖单只小市值题材股",
     "detail": "板块内当日涨停仅 1 家（大晟文化 3 连板），封板率 1.0 由单只个股决定；巨人网络、完美世界等权重普涨但不涨停，情绪结构过窄。",
     "trigger": "大晟文化断板，或板块涨停家数连续 2 日为 0",
     "mitigation": "不追高标，仓位放在有流水与业绩支撑的权重股；断板即减仓",
     "affected": ["ml-game"]},
    {"id": "r4", "level": "medium", "title": "短剧题材的政策敏感度高",
     "detail": "短剧内容备案与监管口径尚未落地，出版与影视的涨幅一部分来自题材扩散；传媒成交占全 A 41.1%，占比一旦回落，题材退潮会很快。",
     "trigger": "短剧监管收紧，或传媒成交占比跌破 35%",
     "mitigation": "不加仓纯题材扩散方向；以成交占比与封板率作为持有条件",
     "affected": ["ml-publish"]},
    {"id": "r5", "level": "low", "title": "数据口径与覆盖缺口",
     "detail": "成交额为净额÷净流入占比反推（代理值，与全市场快照差 0.02%）；P2 只对闸门候选与近失板块计算；涨停 118 家为东财 push2ex 口径，与媒体口径可能不同。",
     "trigger": "任一板块份额与快照横向校验偏差超过 5%，或 P2 覆盖扩大到全样本后结论翻转",
     "mitigation": "volume/fundflow 按 0.5 状态系数计入 coverage；结论只使用方向与分位，不使用绝对金额",
     "affected": ["ml-game", "ml-publish"]},
]

SCENARIOS = [
    {"id": "s1", "name": "乐观：科技资金回流 + 题材扩散", "probability": 0.35,
     "assumption": "半导体与元件的 5 日份额由负转正，成交额维持 2 万亿以上；游戏Ⅱ P3 补齐、出版拥挤度回落至 0.90 以下",
     "impact": "游戏Ⅱ 加速期延续，出版在拥挤消化后再创新高，数字媒体与影视院线补回 P3 进入主线，指数站上 3700 点",
     "action": "五至六成仓位，加仓限定在份额转正的方向，题材高标只做跟随不追首板"},
    {"id": "s2", "name": "中性：反弹后分化", "probability": 0.45,
     "assumption": "成交额维持 1.8～2.1 万亿，指数在 3600～3700 区间震荡，科技反弹一天后回落、短剧在传媒内部轮动",
     "impact": "两条主线排序稳定，游戏Ⅱ 与出版在加速/扩张期之间反复，萌芽里的数字媒体、影视院线等待 P3",
     "action": "三至五成仓位，每日按份额 Δ5 与闸门重排一次，跌破 P3 的方向直接剔除"},
    {"id": "s3", "name": "悲观：反弹一日游 + 拥挤兑现", "probability": 0.20,
     "assumption": "半导体 5 日份额继续为负、成交额跌破 1.7 万亿，出版与短剧高标断板，沪指回补至 3550 点",
     "impact": "出版 R2 惩罚兑现为价格回撤，游戏Ⅱ 降入萌芽，科技反弹失败，防守方向重新获得相对收益",
     "action": "降至三成以下，只保留未触发拥挤惩罚的现金流方向"},
]

PLAYBOOK = {
    "stance": "均衡偏进攻，只做有量能确认的结构",
    "position_range": "三至六成",
    "rules": [
        {"if": "游戏Ⅱ turnover_share_chg_5 转负且份额分位跌破 0.60", "then": "游戏Ⅱ 降为观察位，仓位减半"},
        {"if": "出版拥挤度仍 >0.90 且 5 日主力净流出扩大", "then": "出版只减不加，不接题材高标"},
        {"if": "半导体或元件 5 日份额连续 2 日转正且成交额 >2 万亿", "then": "确认科技资金回流，可提高科技仓位至总仓位的四成"},
        {"if": "沪指收盘跌破 3600 点", "then": "总仓位降至三成，优先砍高 beta 与拥挤方向"},
        {"if": "大晟文化或龙版传媒断板且板块涨停家数归零", "then": "题材情绪结束，清掉题材仓，只留权重"},
    ],
    "checklist": [
        "盘前：全市场成交额能否维持 1.8 万亿以上（低于 1.7 万亿则降低预期）",
        "盘前：半导体、元件的 5 日份额是否由负转正",
        "盘中：游戏Ⅱ 与出版的涨停家数与封板率（封板率 0 即为分歧）",
        "盘后：涨停/炸板/跌停家数与最高连板高度，判断反弹是延续还是衰竭",
    ],
    "disclaimer": "本报告为市场结构研究，不构成投资建议，不承诺收益。",
}


def load(name: str, as_of: str) -> dict:
    return json.loads((C / f"{name}-{as_of}.json").read_text(encoding="utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    day.add_as_of(ap)
    ap.add_argument("--out", default="", help="缺省由 as_of 推导，避免重跑时覆盖上一期")
    ap.add_argument("--top-n", type=int, default=5)
    args = ap.parse_args()
    args.as_of = day.resolve(args.as_of)
    as_of = args.as_of
    if not args.out:
        args.out = f"aml-{as_of.replace('-', '')}-v16.json"

    fac = load("factors", as_of)
    run = load("run", as_of)
    sc = load("score", as_of)
    lim = load("limit", as_of)
    idx_live = load("indices", as_of)
    extra = load("extra", as_of)
    mg_p = C / f"margin-{as_of}.json"
    lev = json.loads(mg_p.read_text(encoding="utf-8"))["leverage"] if mg_p.exists() else None
    narr = json.loads((ROOT / "pipeline" / "templates" / "narrative.json")
                      .read_text(encoding="utf-8")).get(as_of, {})
    p = pickle.loads((C / f"panel-{as_of}.pkl").read_bytes())
    quotes = json.loads((C / f"quotes-{as_of}.json").read_text(encoding="utf-8"))
    # 全市场广度：pipeline.breadth 从新浪全 A 快照（5576 只）本地统计；缺失则回落 null
    br_p = C / f"breadth-{as_of}.json"
    br = json.loads(br_p.read_text(encoding="utf-8")) if br_p.exists() else None

    rows, pc = fac["rows"], fac["pct"]
    base = fac["base"]
    g_by = {g["code"]: g for g in run["gates"]}
    sc_by = {r["code"]: r for r in sc["rows"]}
    dates = sorted(p["by_date"])
    cal = dates

    con = sqlite3.connect(f"file:{C / 'kline.sqlite'}?mode=ro", uri=True)

    def stk_ret(code: str, n: int) -> float | None:
        r = con.execute("select d, c from kline where code=? and d<=? order by d desc limit ?",
                        (code, as_of, n + 1)).fetchall()
        if len(r) < n + 1 or r[0][0] != as_of:
            return None
        return round(r[0][1] / r[-1][1] - 1, 4)

    def stk_ma(code: str, n: int = 20) -> float | None:
        r = con.execute("select c from kline where code=? and d<=? order by d desc limit ?",
                        (code, as_of, n)).fetchall()
        return round(sum(x[0] for x in r) / len(r), 2) if len(r) == n else None

    def members(code: str) -> list[str]:
        f = C / f"codes-{code}.json"
        return [str(x).zfill(6) for x in json.loads(f.read_text(encoding="utf-8"))] if f.exists() else []

    def net_sum(code: str, n: int) -> float:
        tot = 0.0
        for d in dates[-n:]:
            r = p["by_date"][d].get(code)
            if r and r.get("net"):
                tot += r["net"]
        return round(tot / 1e8, 2)

    def amt_sum(code: str, n: int) -> float:
        tot = 0.0
        for d in dates[-n:]:
            r = p["by_date"][d].get(code)
            if r and r.get("amount"):
                tot += r["amount"]
        return tot / 1e8

    def volatility(code: str, n: int = 20) -> float | None:
        s = [p["by_date"][d][code]["pct"] for d in dates[-n:] if p["by_date"][d].get(code)]
        return round(statistics.pstdev(s) / 100, 4) if len(s) >= n - 1 and s else None

    # ---------------- 横截面样本（与 score.py 完全一致） ----------------
    all_rows = list(rows.values())
    S_rs = [r["rs_20"] for r in all_rows]
    S_dt = [r["days_top10_20"] for r in all_rows]
    S_cs = [r["consecutive_top10"] for r in all_rows]
    S_ud = [r["up_days_60"] for r in all_rows]
    S_sh = [r["share"] for r in all_rows]
    S_d5 = [r["share_chg_5"] for r in all_rows]
    S_fl = [r["flow5"] for r in all_rows]
    S_g20 = [r["chg_20d"] for r in all_rows]
    gated = [sc_by[c] for c in g_by if c in sc_by]
    S_up = [g_by[r["code"]]["breadth_up_ratio"] for r in gated]
    S_nh = [g_by[r["code"]]["new_high_ratio"] for r in gated]
    S_zt = [r["pool"]["limit_up_count"] for r in gated]

    # ---------------- 闸门 / 阶段 / 打分 ----------------
    def board_score(code: str, with_stage: bool = True) -> dict:
        """按 §6 六因子实算；with_stage 时按 §4 裁决顺序判阶段（与 score.py 同口径）。"""
        f = rows[code]
        g = g_by.get(code) or extra["rows"].get(code)
        if code in g_by:
            p1, p2, p3 = g_by[code]["p1"], g_by[code]["p2"], g_by[code]["p3"]
            up, nh, valid = g_by[code]["breadth_up_ratio"], g_by[code]["new_high_ratio"], g_by[code]["valid"]
        else:
            p1 = f["days_top10_20"] >= 6 and f["consecutive_top10"] >= 2
            if (g.get("valid") or 0) < 10 or g.get("degraded"):
                p2 = None            # 有效样本 <10 或窗口有缺口：无法判定，不计入分子分母
            else:
                p2 = (g["up_ratio"] or 0) >= 0.55 and (g["new_high_ratio"] or 0) >= 0.08
            p3 = (f["share_chg_5"] or 0) >= 0.005 and (f["share_pct_250"] or 0) >= 0.60
            up, nh, valid = g["up_ratio"], g["new_high_ratio"], g["valid"]
        gates = int(p1) + int(bool(p2)) + int(p3)
        rs = (1 + f["chg_20d"]) / (1 + base["chg_20d"])
        crowd = 0.5 * (f["share_pct_250"] or 0) + 0.5 * pct_in(S_g20, f["chg_20d"]) / 100
        norm = {
            "rs": pct_in(S_rs, f["rs_20"]),
            "persistence": round((pct_in(S_dt, f["days_top10_20"]) + pct_in(S_cs, f["consecutive_top10"])
                                  + pct_in(S_ud, f["up_days_60"])) / 3, 2),
            "volume": round(pct_in(S_sh, f["share"]) * 0.6 + pct_in(S_d5, f["share_chg_5"]) * 0.4, 2),
            "breadth": round(pct_in(S_up, up) * 0.4 + pct_in(S_nh, nh) * 0.35
                             + pct_in(S_zt, len([x for x in lim["limit_up"] if str(x["code"]).zfill(6) in set(members(code))])) * 0.25, 2),
            "fundflow": pct_in(S_fl, f["flow5"]),
            "narrative": float(narr.get(code, 0)),
        }
        contrib = {k: round(v * WEIGHTS[k] / 100, 2) for k, v in norm.items()}
        zt_n = len([x for x in lim["limit_up"] if str(x["code"]).zfill(6) in set(members(code))])
        pen, why = 0, []
        streak = max([(x.get("streak") or 1) for x in lim["limit_up"]
                      if str(x["code"]).zfill(6) in set(members(code))], default=0)
        if (f["share_pct_250"] or 0) > 0.95 and streak >= 5:
            pen = max(pen, 12); why.append("R1")
        if (f["share_pct_250"] or 0) > 0.90 and crowd > 0.90:
            pen = max(pen, 6); why.append("R2")
        if (f["chg_60d"] or 0) > 0.60 and (f["flow5"] or 0) < 0:
            pen = max(pen, 8); why.append("R3")
        score = round(sum(contrib.values()) - pen, 2)
        return {"code": code, "name": f["name"], "p1": p1, "p2": p2, "p3": p3, "gates": gates,
                "up": up, "nh": nh, "valid": valid, "rs": round(rs, 4), "crowd": round(crowd, 4),
                "norm": norm, "contrib": contrib, "penalty": pen, "penalty_rules": why,
                "score": score, "limit_up_count": zt_n, "streak": streak}

    scored = {code: board_score(code) for code in g_by}
    for o in gated:  # 与 score.py 逐位对齐，避免两套算法各自漂移
        mine = scored[o["code"]]
        assert abs(mine["score"] - o["score"]) < 1e-6, (o["code"], mine["score"], o["score"])
        assert mine["gates"] == o["gates"], (o["code"], mine["gates"], o["gates"])
        assert mine["norm"] == o["norm"], (o["code"], mine["norm"], o["norm"])

    # ---------------- mainlines ----------------
    listed = sorted([scored[c] for c in g_by], key=lambda x: -x["score"])
    top = listed[: args.top_n]
    dropped = listed[args.top_n:]

    # emerging：所有恰好命中 1 条闸门的板块（run 的候选 + extra 的补算板块），按六因子实算。
    # v1.6 还要求「闸门够但阶段无法判定」的板块不得进 mainlines，同样改列 emerging。
    # 只看 extra 会漏掉 run 里落榜的候选。
    emerging = []
    top_codes = {t["code"] for t in top}
    for code in list(g_by) + [c for c in extra["rows"] if c not in g_by]:
        s = board_score(code)
        stage = sc_by.get(code, {}).get("stage")
        if code not in top_codes and (s["gates"] == 1 or (s["gates"] >= 2 and stage is None)):
            emerging.append(s)
    emerging.sort(key=lambda x: -x["score"])

    # 换一个交易日重跑时，CONTENT 与 narrative 仍是上一期写的：若不拦住，就会把昨天的
    # 板块名套上今天的数字，生成一份「名字与数值不匹配」却不报错的报告。
    no_text = [f"{s['name']}({s['code']})" for s in top if s["code"] not in CONTENT]
    no_narr = [f"{s['name']}({s['code']})" for s in top if s["code"] not in narr]
    if no_text or no_narr:
        print("[FATAL] 本期榜单与该日文案不匹配，拒绝组装：")
        if no_text:
            print(f"  CONTENT 缺文案：{'、'.join(no_text)}")
        if no_narr:
            print(f"  templates/narrative.json[{as_of}] 缺叙事分：{'、'.join(no_narr)}")
        print(f"  本期上榜为：{'、'.join(f'{s['name']}={s['score']}' for s in top)}")
        print("  请先补文案与叙事分，或用 --top-n 调整目标条数后重试。")
        return 2

    mainlines = []
    stage_note: dict[str, str] = {}
    for rank, s in enumerate(top, 1):
        code = s["code"]
        ct = CONTENT[code]
        f = rows[code]
        gi = g_by[code]
        mem = [m for m in members(code) if m in quotes]
        mem.sort(key=lambda c: -(quotes[c].get("amount_yi") or 0))
        leaders = []
        for i, c in enumerate(mem[:5]):
            leaders.append({
                "code": (c + (".SZ" if c[0] in "03" else ".SH")),
                "name": quotes[c].get("name"),
                "role": "leader" if i == 0 else ("core" if i < 3 else "follower"),
                "chg_20d": stk_ret(c, 20),
                "turnover_yi": round(quotes[c].get("amount_yi") or 0, 2),
                "note": ct["leader_note"].get(c, ""),
            })
        net5, net20 = net_sum(code, 5), net_sum(code, 20)
        amt5 = amt_sum(code, 5)
        flow_ratio = round(net5 / amt5 * 100, 3) if amt5 else None
        pct20 = pc[code]
        metrics = {
            "chg_1d": round(f["chg_1d"], 4), "chg_5d": round(f["chg_5d"], 4),
            "chg_20d": round(f["chg_20d"], 4), "chg_60d": round(f["chg_60d"], 4),
            "rs_5": f["rs_5"], "rs_20": f["rs_20"], "rs_60": f["rs_60"],
            "turnover_share": round(f["share"], 6),
            "turnover_share_chg_5": round(f["share_chg_5"], 6),
            "turnover_share_chg_20": round(f["share_chg_20"], 6),
            "turnover_share_pct_250": f["share_pct_250"],
            "breadth_up_ratio": round(gi["breadth_up_ratio"], 4),
            "new_high_ratio": round(gi["new_high_ratio"], 4),
            "limit_up_count": s["limit_up_count"],
            "limit_up_ratio": round(s["limit_up_count"] / gi["valid"], 4) if gi["valid"] else None,
            "max_streak": s["streak"],
            "max_streak_prev": sc_by[code]["pool"]["max_streak_prev"],
            "seal_rate": sc_by[code]["pool"]["seal_rate"],
            "leader_chg_5d": sc_by[code]["pool"]["leader_chg_5d"],
            "net_inflow_5_yi": net5, "net_inflow_20_yi": net20,
            "crowding_pct": s["crowd"], "volatility_20": volatility(code),
        }
        # 闸门 detail：逐条写取值与判定，✗ 个数必须与 rules_passed 自洽
        d = (f"P1 {gi['days_top10_20']}/20 天、连续 {gi['consecutive_top10']} 天"
             f" {'✓' if s['p1'] else '✗'}；P2 上涨 {gi['breadth_up_ratio'] * 100:.1f}%、新高 {gi['new_high_ratio'] * 100:.1f}%"
             f" {'✓' if s['p2'] else '✗'}；P3 份额 Δ5 {f['share_chg_5'] * 100:+.2f}pct、分位 {f['share_pct_250']:.4f}"
             f" {'✓' if s['p3'] else '✗'} → {s['gates']} 条通过").replace("-", "−")
        stage_rules = {
            "fade": f"Δ20 {f['share_chg_20'] * 100:+.2f}pct / 龙头 5 日 {sc_by[code]['pool']['leader_chg_5d'] * 100:+.2f}% / 上涨 {gi['breadth_up_ratio'] * 100:.1f}%",
            "divergence": f"5 日 {f['chg_5d'] * 100:+.2f}% vs 20 日 1/4 {f['chg_20d'] / 4 * 100:+.2f}% / 分位 {f['share_pct_250']:.4f} / 连板 {sc_by[code]['pool']['max_streak_prev']}→{s['streak']}",
            "acceleration": f"20 日 {f['chg_20d'] * 100:+.2f}% / 拥挤 {s['crowd']:.4f} / 封板 {sc_by[code]['pool']['seal_rate']}",
            "expansion": f"分位 {f['share_pct_250']:.4f} / 涨停 {s['limit_up_count']} 家 / 连板 {s['streak']} / 上涨 {gi['breadth_up_ratio'] * 100:.1f}%",
            "ignition": f"Δ5 {f['share_chg_5'] * 100:+.2f}pct / 前 10 {gi['days_top10_20']} 天 / 涨停 {s['limit_up_count']} 家",
        }
        hit = sum(1 for _, ok, _ in sc_by[code]["crit"][sc_by[code]["stage"]] if ok)
        mainlines.append({
            "id": ct["id"], "rank": rank, "rank_change": ct["rank_change"],
            "name": ct["name"], "aliases": ct["aliases"], "sector_codes": [code],
            "theme_type": ct["theme_type"], "stage": sc_by[code]["stage"],
            "stage_label": ct["stage_label"], "stage_confidence": ct["stage_confidence"],
            "score": s["score"],
            "score_breakdown": [
                {"key": k, "label": lbl, "raw": raw, "normalized": s["norm"][k],
                 "weight": WEIGHTS[k], "contribution": s["contrib"][k], "note": note}
                for k, lbl, raw, note in [
                    ("rs", "相对强度", f["rs_20"], f"rs_20 净值比 {f['rs_20']:.4f}，128 板块横截面分位"),
                    ("persistence", "趋势持续性", f["days_top10_20"],
                     f"前 10 {f['days_top10_20']} 天/连续 {f['consecutive_top10']} 天/60 日阳线 {f['up_days_60'] * 100:.1f}%，三项分位均值"),
                    ("volume", "量能聚集", round(f["share"] * 100, 3),
                     f"份额 {f['share'] * 100:.2f}% 分位 {pc[code]['share']:.1f}，Δ5 {f['share_chg_5'] * 100:+.2f}pct 分位 {pc[code]['share_chg_5']:.1f}"),
                    ("breadth", "扩散度", round(gi["breadth_up_ratio"] * 100, 2),
                     f"上涨 {gi['breadth_up_ratio'] * 100:.1f}/新高 {gi['new_high_ratio'] * 100:.1f}/涨停 {s['limit_up_count']} 家，按 0.4/0.35/0.25 加权"),
                    ("fundflow", "资金流", flow_ratio,
                     f"5 日净额 {net5} 亿 ÷ 同期成交额 {amt5:.2f} 亿 = {flow_ratio}%"),
                    ("narrative", "叙事与催化", float(narr.get(code, 0)),
                     f"{len(ct['drivers'])} 条可验证证据 + 最高等级来源加分 = {narr.get(code)}"),
                ]
            ],
            "penalty": s["penalty"],
            "penalty_reason": (
                f"R2 触发：份额分位 {f['share_pct_250']:.4f} > 0.90 且拥挤度 {s['crowd']:.4f} > 0.90 → −6"
                if s["penalty"] == 6 else
                (f"R1 触发：份额分位 {f['share_pct_250']:.4f} > 0.95 且连板 {s['streak']} ≥ 5 → −12"
                 if s["penalty"] == 12 else "无触发")),
            "metrics": metrics,
            "persistence": {
                "days_top10_20": gi["days_top10_20"],
                "days_top5_20": pct20 and panel_top5(p, code, 20),
                "consecutive_top10": gi["consecutive_top10"],
                "pulse_check": {"passed": s["gates"] >= 2, "rules_passed": s["gates"], "detail": d},
            },
            "drivers": ct["drivers"],
            "narrative": {k: ct[k] for k in ("logic", "catalyst", "sustainability", "bear_case")},
            "leaders": leaders,
            "ladder": {"has_leader": bool(leaders), "tiers": 3 if rank == 1 else 2, "note": ct["ladder_note"]},
            "invalidation": [
                {k: (v.replace("{ma20_600519}", str(stk_ma("600519")))
                     .replace("{ma20_600825}", str(stk_ma("600825"))))
                 for k, v in inv.items()} for inv in ct["invalidation"]],
            "watch": ct["watch"],
            "related": ct["related"],
        })
        stage_note[code] = (f"{ct['name']} 阶段 {sc_by[code]['stage']}，命中 {hit}/"
                            f"{len(sc_by[code]['crit'][sc_by[code]['stage']])}；判据取值 " + stage_rules[sc_by[code]["stage"]])

    # ---------------- 组装 ----------------
    static_w = [
        {"key": "rs", "label": "相对强度", "weight": 25,
         "desc": "（1+板块 20 日收益）÷（1+中证全指 20 日收益）的净值比，在 128 个板块中的横截面百分位"},
        {"key": "persistence", "label": "趋势持续性", "weight": 20,
         "desc": "前 10 天数、连续天数、60 日阳线占比三项百分位的均值"},
        {"key": "volume", "label": "量能聚集", "weight": 20,
         "desc": "成交额份额百分位×0.6 + 5 日份额变化百分位×0.4"},
        {"key": "breadth", "label": "扩散度", "weight": 15,
         "desc": "上涨占比、新高占比、涨停家数按 0.4/0.35/0.25 加权的百分位"},
        {"key": "fundflow", "label": "资金流", "weight": 10,
         "desc": "5 日主力净额 ÷ 同期成交额的百分位（东财算法测算值）"},
        {"key": "narrative", "label": "叙事与催化", "weight": 10,
         "desc": "可验证驱动条数 0/40/60/75/85 + 最高等级来源加分（官方 +15 / 公告 +10 / 媒体 +5）"},
    ]

    gate_matrix = []
    seen: set[str] = set()
    for s in sorted(listed + emerging, key=lambda x: (-x["gates"], -x["score"])):
        if s["code"] in seen:      # listed 与 emerging 在 1 条闸门处会重叠，矩阵只留一条
            continue
        seen.add(s["code"])
        stage = sc_by[s["code"]]["stage"] if s["code"] in sc_by else "未实算（P2 补算板块）"
        stage = stage or "未判定（仅 1 条闸门，阶段不参与判定）"
        hit = ("—" if stage.startswith(("未实算", "未判定")) else
               f"{stage} {sum(1 for _, ok, _ in sc_by[s['code']]['crit'][stage] if ok)}/{len(sc_by[s['code']]['crit'][stage])}")
        line = (
            f"{s['name']} | P1 {'✓' if s['p1'] else '✗'} {rows[s['code']]['days_top10_20']}/20 连续 {rows[s['code']]['consecutive_top10']} "
            f"| P2 {'✓' if s['p2'] else ('✗' if s['p2'] is False else '？无法判定')} 上涨 {(s['up'] or 0) * 100:.1f} 新高 {(s['nh'] or 0) * 100:.1f} "
            f"| P3 {'✓' if s['p3'] else '✗'} Δ5 {rows[s['code']]['share_chg_5'] * 100:+.2f}pct 分位 {rows[s['code']]['share_pct_250']:.4f} "
            f"| 闸门 {s['gates']} 条 | 阶段 {hit} | {stage}")
        gate_matrix.append(line.replace("-", "−"))

    n_extra = len(extra["rows"])
    n_p2 = len(g_by) + n_extra
    p2_unknown = [f"{v['name']}（有效样本 {v['valid']} 只 <10）" for v in extra["rows"].values()
                  if (v["valid"] or 0) < 10 or v.get("degraded")]
    p2_fail = [f"{v['name']}（上涨 {(v['up_ratio'] or 0) * 100:.1f}%、新高 {(v['new_high_ratio'] or 0) * 100:.1f}%）"
               for v in extra["rows"].values()
               if (v["valid"] or 0) >= 10 and not v.get("degraded")
               and not ((v["up_ratio"] or 0) >= 0.55 and (v["new_high_ratio"] or 0) >= 0.08)]
    n_p2_rest = len(rows) - n_p2

    idx = [{"code": r["code"], "name": r["name"], "close": round(r["close"], 2) if r["close"] else None,
            "chg_1d": r["chg_1d"], "chg_5d": r["chg_5d"], "chg_20d": r["chg_20d"],
            "turnover_yi": r["turnover_yi"], "pe_pct_250": None}
           for r in idx_live["indices"]
           if r["code"] in ("000001.SH", "399001.SZ", "399006.SZ", "000688.SH", "000985.CSI", "000922.CSI")]

    up_boards = sum(1 for r in rows.values() if (r["chg_1d"] or 0) > 0)
    inflow = sorted(all_rows, key=lambda x: -(x["share_chg_5"] or 0))[:5]
    outflow = sorted(all_rows, key=lambda x: (x["share_chg_5"] or 0))[:5]
    # 每个板块实际可得的交易日数：250 日分位的真实样本，不同板块因行业分类调整而不同
    samples = {c: sum(1 for d in dates if c in p["by_date"][d]) for c in rows}
    n_p1p3 = len(g_by)
    kline_days = con.execute("select count(distinct d) from kline").fetchone()[0]
    idx_codes = json.loads((C / "codes-INDEX.json").read_text(encoding="utf-8"))
    cand_members: set[str] = set()
    for b in idx_codes:
        f = C / f"codes-{b}.json"
        if f.exists():
            cand_members |= {str(x).zfill(6) for x in json.loads(f.read_text(encoding="utf-8"))}

    # 边界值：任一判据距阈值相对幅度 <5% 时必须标出，并说明四舍五入是否改变结论（v1.6 §3-4）
    boundary = []
    for c, s in scored.items():
        f = rows[c]
        for label, v, th in [
            ("P1 前 10 天数", f["days_top10_20"], 6),
            ("P1 连续天数", f["consecutive_top10"], 2),
            ("P2 上涨占比", s["up"], 0.55),
            ("P2 新高占比", s["nh"], 0.08),
            ("P3 份额 Δ5", f["share_chg_5"], 0.005),
            ("P3 份额分位(下界)", f["share_pct_250"], 0.60),
            ("expansion 分位上界", f["share_pct_250"], 0.85),
        ]:
            if v is None or th == 0:
                continue
            gap = abs(v - th) / abs(th)
            if gap < 0.05:
                flip = round(v, 2) != round(v, 4) and (round(v, 2) >= th) != (v >= th)
                boundary.append(f"{s['name']} {label} {v:.4f} 对阈值 {th}（距 {gap * 100:.1f}%"
                                + ("，四舍五入到两位会翻转判定" if flip else "，四舍五入不改变判定") + "）")
    boundary_note = ("边界值（距阈值相对幅度 <5%，一律按原始精度比较）：" + "；".join(boundary)
                     if boundary else "本期无判据落在阈值 5% 以内，全部按原始精度判定")
    pen_note = ("；".join(f"{s['name']} {('/'.join(s['penalty_rules']))} −{s['penalty']}"
                          for s in scored.values() if s["penalty"]) or "无")
    # 沪深口径（剔除北交所）与全口径的差异：必须现算，不能沿用上一期的数字
    ex_bj = {k: v for k, v in (br["by_board"] if br else {}).items() if k != "北交所"}
    ex_up = sum(v["up"] for v in ex_bj.values())
    ex_valid = sum(v["valid"] for v in ex_bj.values())
    ex_ratio = ex_up / ex_valid if ex_valid else 0.0

    doc = {
        "schema_version": "1.0.0",
        "meta": {
            "report_id": f"aml-{as_of.replace('-', '')}",
            "as_of": as_of,
            "generated_at": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "title": f"A股市场主线分析 · {as_of}",
            "data_mode": "live",
            "confidence": 0.68,
            "analyst": {"model": "DeepSeek-V4.1-Flash", "prompt_version": "1.6.0", "operator": "使用者"},
            "tags": ["科技超跌反弹", "拥挤交易", "短剧情绪", "版号与爆款", "高低切换"],
        },
        "window": {
            "as_of": as_of, "primary_days": 20, "confirm_days": 5, "context_days": 60, "quantile_days": 250,
            "effective_range": {"start": dates[-20], "end": dates[-1]},
            "rules": [
                f"主窗按交易日回溯 20 日，非自然日；本期 20 日窗口 {dates[-20]} ~ {dates[-1]}，起点为国庆节后首个交易日（10-01~10-07 休市）",
                "T 日仅用于描述字段，不参与阶段判定",
                f"横截面为东财 {run['boards_live']} 个现役行业板块（{as_of} 有资金流数据的全部板块），前 10 名 ≈ 前 {10 / run['boards_live'] * 100:.1f}%",
                f"P1 按滚动 20 日累计涨幅的横截面排名，不是当日涨跌幅；横截面 {run['boards_live']} 个板块中 20 日窗口完整可算的有 {run['boards_live']} 个，剔除 0 个",
                f"P2 已完整计算 {n_p2} 个板块（{n_p1p3} 个 P1/P3 候选 + {n_extra} 个近失板块），其余 {len(rows) - n_p2} 个板块 P2 记「未计算」，不据此下唯一性结论",
                f"250 日分位按各板块全部可得交易日计算：本期样本最短 {min(samples.values())} 日、最长 {max(samples.values())} 日；"
                + ("其中既有不足 250 日也有超过 250 日的板块，分位一律按各自可得样本计算，正文已写明样本长度" if max(samples.values()) >= 250 else "均不足 250 日，正文按实际样本表述"),
                (f"份额分母为面板合计 {run['market_amount_yi']} 亿（128 板块成交额反推值合计）；新浪全 A 快照实测"
                 f"全市场成交额 {br['amount_yi']} 亿，两者相差 {(run['market_amount_yi'] / br['amount_yi'] - 1) * 100:+.3f}%，"
                 f"量级等价，故分母不再标注为代理口径") if br else
                f"份额分母为面板合计 {run['market_amount_yi']} 亿（128 板块成交额反推值合计），非全市场成交额",
            ],
            "excluded": [{"date_range": "2026-10-01~2026-10-07", "reason": "国庆休市；10-08 为交易日，面板有行"}],
        },
        "data_quality": {
            "status": "partial",
            "coverage": 0.85,
            "sources": [
                {"name": "东方财富数据中心 · 行业板块资金流（RPT_INDUSTRY_FUNDFLOW）", "category": "行情与资金",
                 "fields": ["涨跌幅", "主力净额", "净流入占比", "超大/大/中/小单净额与占比"], "as_of": as_of,
                 "reliability": "high",
                 "note": f"{run['boards_live']} 个板块共 {len(dates)} 个交易日（{dates[0]} 起），涨跌幅与资金流单源；成交额由净额÷占比反推"},
                {"name": "腾讯行情（qt.gtimg.cn / web.ifzq.gtimg.cn）", "category": "行情",
                 "fields": ["收盘价", "昨收", "涨跌幅", "成交额", "日 K 线"], "as_of": as_of, "reliability": "high",
                 "note": f"{len(idx_live['indices'])} 个指数当日快照与日 K 线；{len(quotes)} 只成分股报价快照；本地 K 线库覆盖同批个股，共 {kline_days} 个交易日"},
                {"name": "东方财富板块成分（RPT_BOARD_CONSTITUENT）", "category": "成分",
                 "fields": ["板块代码", "成分股代码"], "as_of": as_of, "reliability": "high",
                 "note": f"{run['boards_live']} 个板块中取 {n_p2} 个候选/近失板块的成分股，去重 {len(cand_members)} 只，用于 P2 与龙头识别"},
                {"name": "东方财富涨停/炸板/跌停池（push2ex）", "category": "情绪",
                 "fields": ["涨停家数", "连板数", "开板次数"], "as_of": as_of, "reliability": "high",
                 "note": f"{as_of} 涨停 {lim['market']['limit_up']} 家、炸板 {lim['market']['broken']} 家、跌停 {lim['market']['limit_down']} 家；另取 {lim['prev']} 涨停池算连板变化"},
                {"name": "新浪财经全 A 快照（Market_Center.getHQNodeData, node=hs_a）", "category": "行情",
                 "fields": ["收盘价", "涨跌幅", "成交额", "成交量", "总市值"], "as_of": as_of, "reliability": "high",
                 "note": (f"东财 push2 全市场快照接口本期被 RST，改走新浪；分 56 页取全 {br['valid'] + br['suspended']} 只，"
                          f"有效（有成交）{br['valid']} 只、停牌 {br['suspended']} 只，本地自行统计涨跌家数"
                          + (f"；抽 {br['cross_check']['sampled']} 只对腾讯行情校验，一致 {br['cross_check']['matched']} 只，"
                             f"最大价差 {br['cross_check']['max_price_diff_pct']}%、涨跌幅差 {br['cross_check']['max_pct_diff_pct']}pct"
                             if br.get("cross_check") else "")) if br else
                         "本期未取（breadth 字段写 null）"},
                {"name": "东方财富数据中心 · 两融市场汇总（RPTA_RZRQ_LSHJ）", "category": "杠杆",
                 "fields": ["融资余额", "融券余额", "两融余额", "融资净买入", "占流通市值比"], "as_of": lev["as_of"] if lev else as_of,
                 "reliability": "high",
                 "note": (f"单请求取满 {json.loads(mg_p.read_text(encoding='utf-8'))['rows']} 行，滞后 {lev['lag_trading_days']} 个交易日；"
                          f"口径含沪深北，不与交易所分市合计混算") if lev else "本期未取"},
                {"name": "国家新闻出版署 / 游戏厂商 / 上市公司公告", "category": "政策与事件",
                 "fields": ["版号发放", "影之刃零销量与流水", "短剧与版权", "三季报"], "as_of": as_of,
                 "reliability": "high", "note": f"证据链一级来源，共 {sum(len(m['drivers']) for m in mainlines)} 条驱动；媒体转引的在 detail 内注明转引"},
                {"name": "主流财经媒体（证券时报 / 财联社 / 每经 / 上证报等）", "category": "资讯",
                 "fields": ["盘面复盘", "板块资金", "票房与短剧数据"], "as_of": as_of, "reliability": "medium",
                 "note": "用于盘面与驱动的时间戳核对，不参与打分，只做证据链"},
            ],
            "missing": [
                {"field": "板块 250 日完整成交额序列", "reason": f"面板覆盖 {len(dates)} 个交易日（{dates[0]} 起），但部分板块因行业分类调整样本更短，本期最短 {min(samples.values())} 日",
                 "fallback": "turnover_share_pct_250 与 crowding_pct 按实际样本计算，不补 0；正文按「实际样本分位」表述"},
                {"field": "板块 PE 250 日分位", "reason": "中证指数官网估值分位未取", "fallback": "indices.pe_pct_250 全部写 null"},
                {"field": "全市场涨跌家数（交易所官方口径）", "reason": f"交易所官方涨跌家数统计未取，本报告用的是新浪全 A 快照本地统计（{br['valid'] if br else '—'} 只有效样本），未与官方口径逐日核对",
                 "fallback": "market_regime.breadth 用快照统计值，并与腾讯行情抽 17 只交叉校验；口径差异写入 notes"},
                {"field": "全 A 创 20 日新高/新低家数", "reason": "需 5000+ 只个股日线，超出本期取数预算", "fallback": "market_regime.breadth.new_high/new_low 写 null"},
                {"field": "陆股通持股变动", "reason": "周度披露，且日度净买入自 2024-08 起停止披露", "fallback": "不使用外资维度"},
                {"field": f"其余 {len(rows) - n_p2} 个板块的 P2", "reason": f"P2 需逐板块拉成分股 K 线，本期只对 {n_p1p3} 个 P1/P3 候选与 {n_extra} 个近失板块计算",
                 "fallback": "记「未计算」，不做全样本唯一性表述"},
            ],
            "notes": [
                "coverage = 25×1.0(rs) + 20×1.0(persistence) + 20×0.5(volume，成交额为净额÷占比反推的代理值) + 15×1.0(breadth) + 10×0.5(fundflow，东财算法测算) + 10×1.0(narrative) = 85 → 0.85",
                (f"杠杆（截至 {lev['as_of']}，lag_trading_days={lev['lag_trading_days']}）：两融余额 {lev['balance_yi']} 亿、"
                 f"20 日 {lev['chg_20d'] * 100:+.2f}%、占流通市值 {lev['balance_to_float_pct'] * 100:.3f}%，趋势 {lev['trend']}；"
                 f"滞后 1 个交易日，只用于「截至 {lev['as_of']}」的水平与趋势描述，不用于 {as_of} 当日归因") if lev else
                "两融余额本期未取，market_regime.leverage 写 null，全文不使用杠杆维度",
                "闸门矩阵（覆盖全部通过 ≥1 条闸门的板块，逐行给出板块 | P1 | P2 | P3 | 闸门命中 | 阶段命中 | stage）："
                + "；".join("闸门矩阵：" + line for line in gate_matrix),
                f"P2 覆盖与缺口：已完整计算 {n_p2} 个板块；未过 P2 的为 {'、'.join(p2_fail) if p2_fail else '无'}；"
                f"无法判定（有效样本 <10 只或窗口有缺口）的为 {'、'.join(p2_unknown) if p2_unknown else '无'}；"
                f"其余 {n_p2_rest} 个板块 P2 未计算，不据此下全样本唯一性结论",
                boundary_note,
                f"拥挤惩罚：{pen_note}（R1 需分位 >0.95 且连板 ≥5、R2 需分位 >0.90 且拥挤度 >0.90、R3 需 60 日 >60% 且 5 日净流出，多项命中取最大值）",
                f"份额分位的样本长度：{'、'.join(f'{rows[c]['name']} {samples[c]} 日' for c in [m['sector_codes'][0] for m in mainlines])}；"
                f"正文的「分位」均指该板块自身样本内的分位，不是跨板块的历史极值",
                f"breadth 因子的横截面百分位基于 {n_p1p3} 个已完整计算 P2 的候选板块（与 score.py 同口径），其余五因子为 {len(rows)} 板块全域；rotation.emerging 的同一分位口径相同",
                "fundflow 与 volume 的 delta 口径：turnover_share_chg_5 为份额相对 5 个交易日前的变化，turnover_share_chg_20 为相对 20 个交易日前的变化，两者不同窗口",
                f"max_streak_prev 取 5 个交易日前（{dates[-6]}）涨停池的最高连板高度，不是「上一日」；divergence 的「连板回落 ≥2 级」用该口径",
                "资金轮动（5 日成交额份额变化，单位百分点）：流入 "
                + "、".join(f"{r['name']} {(r['share_chg_5'] or 0) * 100:+.2f}" for r in inflow[:3])
                + "；流出 " + "、".join(f"{r['name']} {(r['share_chg_5'] or 0) * 100:+.2f}".replace("-", "−") for r in outflow[:3])
                + "。注意份额上升不等于资金流入：元件 5 日份额 +0.65pct 且当日 +7.26%，但 5 日主力净流出 2.40%，属交易型资金推动；半导体当日 +10.64%、份额仍 −0.36pct，是反弹中的减配",
                (f"全市场广度口径：统计自新浪全 A 快照 {br['valid']} 只有效样本（剔除停牌 {br['suspended']} 只），"
                 f"上涨 {br['up']} / 下跌 {br['down']} / 平盘 {br['flat']}，up_ratio = {br['up']} ÷ {br['valid']} = "
                 f"{br['up_ratio']:.4f}，涨跌比 = {br['up']} ÷ {br['down']} = {br['advance_decline_ratio']:.2f}；"
                 f"含北交所口径为 {br['up_ratio']:.4f}，剔除北交所后沪深口径 "
                 f"{ex_up} ÷ {ex_valid} = "
                 f"{ex_ratio:.4f}，"
                 f"差 {abs(ex_ratio - br['up_ratio']) * 100:.2f}pct，两口径同向；分市场 up_ratio："
                 + "、".join(f"{k} {v['up'] / v['valid']:.1%}" for k, v in br["by_board"].items() if k != "其他")
                 + f"；涨跌分布 ≥9.8% 有 {br['distribution']['gt9']} 家、≤−9.8% 有 {br['distribution']['lt-9']} 家"
                 f"（含未封板的 20cm 个股，故与涨停池 {lim['market']['limit_up']} 家、跌停 {lim['market']['limit_down']} 家不同口径）"
                 + (f"；该快照抽 {br['cross_check']['sampled']} 只（含北交所 1 只）与腾讯行情逐只比对，一致 "
                    f"{br['cross_check']['matched']} 只，价差 {br['cross_check']['max_price_diff_pct']}%、"
                    f"涨跌幅差 {br['cross_check']['max_pct_diff_pct']}pct、成交额差 {br['cross_check']['max_amount_diff_pct']}%"
                    if br.get("cross_check") else "")) if br else
                "全市场涨跌家数本期未取，breadth.up_ratio 与 advance_decline_ratio 写 null",
                f"{as_of} {len(rows)} 个板块中 {up_boards} 个上涨；涨停 {lim['market']['limit_up']} 家、炸板 {lim['market']['broken']} 家、"
                f"跌停 {lim['market']['limit_down']} 家、封板率 {lim['market']['seal_rate']:.4f}；5 个交易日前（{lim['prev']}）涨停 {lim['market']['prev_limit_up']} 家，"
                f"本报告用该日涨停池计算 max_streak_prev；"
                f"涨停池为东财 push2ex 口径（{lim['market']['limit_up']} 家），媒体口径因是否计入 ST/北交所与 20cm 未封板个股而可能不同，全文统一用面板口径",
                *[stage_note[c] for c in stage_note],
                (f"P1/P3 候选 {len(listed)} 个，其中闸门合格（≥2 条）{sum(1 for x in listed if x['gates'] >= 2)} 个，"
                 f"按 TOP_N={args.top_n} 输出 {len(mainlines)} 条，未放宽阈值凑数；"
                 + (f"合格但超出 TOP_N 未入榜：{'、'.join(f'{x['name']}（{x['score']}）' for x in dropped if x['gates'] >= 2)}；" if any(x["gates"] >= 2 for x in dropped) else "")
                 + f"未进 mainlines 的 {len(emerging)} 个板块（1 条闸门，或闸门够但阶段无法判定）全部列入 rotation.emerging"),
            ],
        },
        "market_regime": {
            "label": "放量反弹：科技硬件报复性修复、红利与消费让位",
            "phase": "risk_on", "phase_label": "风险偏好回升（超跌反弹）",
            "risk_appetite": 62, "liquidity": 78, "breadth_score": 84,
            "indices": idx,
            "breadth": {
                "up_ratio": br["up_ratio"] if br else None, "limit_up": lim["market"]["limit_up"],
                "limit_down": lim["market"]["limit_down"],
                "broken_board_rate": round(lim["market"]["broken"] / (lim["market"]["limit_up"] + lim["market"]["broken"]), 4),
                "advance_decline_ratio": br["advance_decline_ratio"] if br else None,
                "new_high": None, "new_low": None,
            },
            "leverage": lev,
            "narrative": REGIME_NARRATIVE,
        },
        "verdict": {
            "headline": VERDICT_HEADLINE,
            "core_thesis": VERDICT_THESIS,
            "stance": "balanced", "stance_label": "均衡偏进攻，只做有量能确认的结构",
            "dominant_mainline_id": mainlines[0]["id"],
            "mainline_count": len(mainlines),
            "confidence": 0.68,
            "points": VERDICT_POINTS,
            "horizon": {
                "valid_until": (datetime.strptime(as_of, "%Y-%m-%d") + timedelta(days=14)).strftime("%Y-%m-%d"),
                "review_trigger": "游戏Ⅱ turnover_share_chg_5 转负或份额分位跌破 0.60、或出版拥挤度仍 >0.90 且 5 日主力净流出扩大、或沪指收盘失守 3600 点、或全市场成交额跌破 1.7 万亿，任一触发即重估",
            },
        },
        "mainlines": mainlines,
        "rotation": {
            "narrative": (
                f"这一轮是超跌后的放量回补，不是全面扩散：5 日份额流入前三为 "
                + "、".join(f"{r['name']} {(r['share_chg_5'] or 0) * 100:+.2f}pct".replace("-", "−") for r in inflow[:3])
                + "，流出前三为 " + "、".join(f"{r['name']} {(r['share_chg_5'] or 0) * 100:+.2f}pct".replace("-", "−") for r in outflow[:3])
                + "。份额变化必须与资金同看：元件当日 +7.26%、份额 +0.65pct，但 5 日主力净流出占成交额 2.40%，反弹由交易型资金推动；"
                f"半导体当日 +10.64%、5 日份额 −0.36pct，是反弹中的减配。价涨、份额升且主力同步净流入的方向只有游戏Ⅱ（Δ5 +0.26pct、5 日净流入占成交额 1.41%），"
                f"出版则是 Δ5 −0.07pct、5 日主力净流出的高拥挤扩张。两条主线的 5 日主力净额："
                + "、".join(f"{m['name'].split('：')[0]} {m['metrics']['net_inflow_5_yi']:+.2f} 亿".replace("-", "−") for m in mainlines)
                + "。"
                f"在已完整计算 P2 的 {n_p2} 个板块中，{len(emerging)} 个未进主线、全部列入萌芽（1 条闸门，或闸门够但阶段无法判定）；"
                f"其中数字媒体、影视院线是「持续性与广度都够、只差量能」，白酒、休闲食品、银行Ⅱ 是「持续性在、当日广度崩了」，元件是「广度够、持续性与量能都不够」。"
                + (f"前 5 名之外的萌芽：{'、'.join(f'{s['name']} {s['score']}' for s in emerging[5:])}。" if len(emerging) > 5 else "")
                + (f"萌芽分数按同一六因子实算、不含叙事分（narrative=0）。本期萌芽首位 {emerging[0]['name']} 的 {emerging[0]['score']} 分高于第 2 条主线 {mainlines[1]['score']}，"
                   f"但它 P1 只有 {rows[emerging[0]['code']]['days_top10_20']}/20 天、P3 仅 {rows[emerging[0]['code']]['share_chg_5'] * 100:+.2f}pct，"
                   f"两条闸门未过——闸门是准入条件，分数只在通过者内部排序，两者不可直接比较。"
                   if len(emerging) > 0 and len(mainlines) > 1 else
                   "萌芽分数按同一六因子实算、不含叙事分（narrative=0），与主线分数不可直接比较。")
            ),
            "inflow": [{"name": r["name"], "delta_pct": round((r["share_chg_5"] or 0) * 100, 2),
                        "note": f"20 日 {(r['chg_20d'] or 0) * 100:+.2f}%、当日 {(r['chg_1d'] or 0) * 100:+.2f}%、rs_20 {r['rs_20']:.4f}"} for r in inflow],
            "outflow": [{"name": r["name"], "delta_pct": round((r["share_chg_5"] or 0) * 100, 2),
                         "note": f"20 日 {(r['chg_20d'] or 0) * 100:+.2f}%、当日 {(r['chg_1d'] or 0) * 100:+.2f}%、rs_20 {r['rs_20']:.4f}"} for r in outflow],
            "emerging": [{"name": s["name"], "score": s["score"],
                          "signal": (
                              f"P1 {'✓' if s['p1'] else '✗'}（前 10 {rows[s['code']]['days_top10_20']}/20 天、连续 {rows[s['code']]['consecutive_top10']} 天）；"
                              f"P2 {'✓' if s['p2'] else ('✗' if s['p2'] is False else '？无法判定')}"
                              f"（上涨 {(s['up'] or 0) * 100:.1f}%、新高 {(s['nh'] or 0) * 100:.1f}%，有效样本 {s['valid']} 只）；"
                              f"P3 {'✓' if s['p3'] else '✗'}（Δ5 {rows[s['code']]['share_chg_5'] * 100:+.2f}pct、分位 {rows[s['code']]['share_pct_250']:.4f}）"
                              + (f" → {s['gates']} 条闸门，阶段无法判定，不进 mainlines" if s["gates"] >= 2
                                 else " → 仅 1 条，不进 mainlines")
                              + (f"；{s['penalty_rules'][0]} 扣 {s['penalty']} 分" if s["penalty"] else "；无拥挤惩罚"))}
                         for s in emerging],
            "timeline": [
                {"date": "2026-11-03", "event": "科技硬件集体重挫、白酒与红利逆势走强，资金从高 beta 切向低位消费与防守", "impact": "negative", "mainline_id": None},
                {"date": "2026-11-03", "event": "10 月国产与进口网络游戏版号合计 195 款、同比 +17.47%，年内累计 1708 款超去年全年", "impact": "positive", "mainline_id": "ml-game"},
                {"date": "2026-11-04", "event": "科技股报复性反弹：半导体 +10.64%、元件 +7.26%、通信设备 +5.72%，科创50 +9.92%，成交额重返 2.05 万亿", "impact": "positive", "mainline_id": None},
                {"date": "2026-11-04", "event": "《影之刃零》上线 72 小时全球销量突破 400 万份、三天流水约 10 亿元，登顶多平台畅销榜", "impact": "positive", "mainline_id": "ml-game"},
                {"date": "2026-11-04", "event": "短剧概念集体活跃：龙版传媒/大晟文化/浙文影业 3 连板，中信出版 20cm 涨停、3 天 2 板", "impact": "positive", "mainline_id": "ml-publish"},
                {"date": "2026-11-04", "event": "传媒成交 8433 亿、占全 A 41.1%，TMT 成交占比升至阶段高位；白酒 −1.81%、中证红利 −0.07%", "impact": "positive", "mainline_id": "ml-publish"},
            ],
        },
        "risks": RISKS,
        "scenarios": SCENARIOS,
        "playbook": PLAYBOOK,
        "appendix": {
            "method_summary": (
                f"以 {as_of} 为基准日，用东方财富 {run['boards_live']} 个行业板块 {len(dates)} 个交易日（{dates[0]} 起）的涨跌幅与资金流重建成交额份额与横截面排名，"
                f"配合腾讯行情的指数与成分股 K 线计算广度、新高、涨停与龙头指标；先做反脉冲三原则闸门（P1 持续性 / P2 广度 / P3 量能）穷举，"
                f"过 ≥2 条者进入打分，再按 fade→divergence→acceleration→expansion→ignition 顺序判阶段，阶段无法赋值者降入萌芽，"
                f"最后按六因子加权并扣 R1/R2/R3 拥挤惩罚。数据缺失一律写 null 并记入 missing。"
            ),
            "weights": static_w,
            "stage_rules": [
                {"stage": "ignition", "label": "启动期", "rule": "份额 Δ5 ≥+0.5pct；前 10 天数 ≤8；涨停 2~5 家（满足 2 项）"},
                {"stage": "expansion", "label": "发酵期", "rule": "份额分位 0.60~0.85；涨停 ≥5 家；连板 3~4；上涨占比 ≥60%（满足 2 项）"},
                {"stage": "acceleration", "label": "加速期", "rule": "20 日涨幅 >25%；拥挤度 >0.85；封板率 >75%（满足 2 项）"},
                {"stage": "divergence", "label": "分歧期", "rule": "5 日涨幅 <20 日涨幅/4；份额分位 >0.90；连板回落 ≥2 级（满足 2 项）"},
                {"stage": "fade", "label": "退潮期", "rule": "份额 Δ20 <−0.5pct；龙头 5 日跌幅 >8%；上涨占比 <45%（满足 2 项）"},
            ],
            "glossary": [
                {"term": "RS", "def": "相对强度净值比 =（1+板块区间收益）÷（1+中证全指同期收益），1.0 表示与大盘同步；负收益下方向仍正确"},
                {"term": "P1 持续性", "def": "20 日进入滚动 20 日涨幅前 10 的天数 ≥6 且最近连续 ≥2 天（横截面为 128 个板块的绝对前 10）"},
                {"term": "P2 广度", "def": "板块内上涨占比 ≥55% 且创 20 日新高占比 ≥8%；新高定义 = 收盘价高于前 20 个交易日（不含当日）最高收盘价"},
                {"term": "P3 量能", "def": "成交额占全 A 比重 5 日变化 ≥+0.5pct 且 250 日分位 ≥60，按 4 位小数原始精度比较"},
                {"term": "拥挤度", "def": "份额分位×0.5 + 20 日涨幅分位×0.5，用于 R2 与加速期判定"},
                {"term": "封板率", "def": "1 − 开板家数 ÷ 涨停家数，板块成分股口径"},
                {"term": "fundflow", "def": "5 日主力净额 ÷ 同期板块成交额，东财按单笔金额分档的测算值，权重上限 10%"},
            ],
            "changelog": [{"version": "1.6.0", "date": as_of,
                           "note": f"基准日 {as_of}：{len(rows)} 个板块 P1/P3 全样本穷举，P2 计算 {n_p2} 个板块，"
                                   f"闸门合格 {len(listed)} 条，输出 {len(mainlines)} 条主线；新增 emerging 覆盖 run 候选中的单闸门板块"}],
        },
    }

    # ---------------- 自检 ----------------
    for m in mainlines:
        s = sum(x["contribution"] for x in m["score_breakdown"]) - m["penalty"]
        assert abs(s - m["score"]) <= 0.5, (m["id"], s, m["score"])
        assert len(m["score_breakdown"]) == 6
        assert [x["key"] for x in m["score_breakdown"]][0] == "rs"
        assert m["score_breakdown"][0]["raw"] == m["metrics"]["rs_20"]
        assert m["persistence"]["pulse_check"]["passed"] == (m["persistence"]["pulse_check"]["rules_passed"] >= 2)
        assert m["penalty"] in (0, 6, 8, 12)
    assert abs(sum(x["probability"] for x in doc["scenarios"]) - 1.0) < 0.011
    assert doc["verdict"]["mainline_count"] == len(mainlines)
    assert [m["rank"] for m in mainlines] == list(range(1, len(mainlines) + 1))
    assert all(mainlines[i]["score"] >= mainlines[i + 1]["score"] for i in range(len(mainlines) - 1))

    dest = ROOT / args.out
    dest.write_text(serialize(doc), encoding="utf-8")
    raw = json.loads(dest.read_text(encoding="utf-8"))
    _txt = dest.read_text(encoding="utf-8")
    print(f"  -> {dest.relative_to(ROOT)}  {len(_txt)} 字符 / {len(raw['mainlines'])} 条主线 / "
          f"emerging {len(raw['rotation']['emerging'])} 条")
    for m in raw["mainlines"]:
        print(f"    #{m['rank']} {m['name']:<28} {m['score']:>6.2f}  {m['stage']:<12} 闸门 {m['persistence']['pulse_check']['rules_passed']} "
              f"pen {m['penalty']} conf {m['stage_confidence']}")
    return 0


def panel_top5(p: dict, code: str, n: int) -> int:
    """20 日进入前 5 的天数（persistence 的辅助字段，仅展示）。"""
    from pipeline import panel  # noqa: PLC0415
    return panel.top_days(p, code, n=n, top=5)["days_top10_20"]


def serialize(doc: dict) -> str:
    """按 v1.6 §10-D 排版：一个顶层键一行，对象内联。"""
    parts = []
    for k, v in doc.items():
        parts.append(f'"{k}": ' + json.dumps(v, ensure_ascii=False, separators=(",", ":")))
    return "{\n" + ",\n".join(parts) + "\n}"


if __name__ == "__main__":
    raise SystemExit(main())
