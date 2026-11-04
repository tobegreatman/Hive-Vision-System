/**
 * 领域常量 —— 单一事实来源
 * 计量单位、阈值、枚举值全部在此声明，契约与渲染共用。
 */

export const SCHEMA_ID = 'industry-flow/v1'
export const SCHEMA_VERSION = 1
export const UNIVERSE_ID = 'sw3-m90-t2'

/** 申万一级行业（31），作为可枚举分组域的根 */
export const L1_INDUSTRIES = [
  '农林牧渔', '基础化工', '钢铁', '有色金属', '电子', '家用电器', '食品饮料', '纺织服饰',
  '轻工制造', '医药生物', '公用事业', '交通运输', '房地产', '商贸零售', '社会服务', '综合',
  '建筑材料', '建筑装饰', '电力设备', '机械设备', '国防军工', '汽车', '计算机', '传媒',
  '通信', '银行', '非银金融', '煤炭', '石油石化', '环保', '美容护理',
]

/**
 * 申万二级行业（128）—— 数据源把一/二/三级板块平铺在同一个列表里，
 * 且不返回层级字段，只能靠名称判定。名字带 Ⅱ 的是「与父级同名」的二级板块。
 *
 * 为什么需要这张表：一/二/三级是嵌套关系，同一批成分股会在三个层级各出现一次。
 * 不区分层级就会把「电池 + 光伏设备 + 逆变器」当成三个独立板块相加，
 * 金额凭空翻倍（实测全域求和 -282.6 亿 vs 真实 -94.2 亿）。
 */
export const L2_INDUSTRIES = [
  '种植业', '渔业', '林业Ⅱ', '饲料', '农产品加工', '农业综合Ⅱ', '动物保健Ⅱ', '养殖业',
  '化学原料', '化学制品', '化学纤维', '塑料', '橡胶', '农化制品', '非金属材料Ⅱ', '普钢',
  '特钢Ⅱ', '冶钢原料', '贵金属', '工业金属', '小金属', '金属新材料', '能源金属', '半导体',
  '元件', '光学光电子', '消费电子', '电子化学品Ⅱ', '其他电子Ⅱ', '白色家电', '黑色家电', '小家电',
  '厨卫电器', '照明设备Ⅱ', '家电零部件Ⅱ', '其他家电Ⅱ', '白酒Ⅱ', '非白酒', '饮料乳品', '休闲食品',
  '调味发酵品Ⅱ', '食品加工', '纺织制造', '服装家纺', '饰品', '造纸', '包装印刷', '家居用品',
  '文娱用品', '化学制药', '中药Ⅱ', '生物制品', '医药商业', '医疗器械', '医疗服务', '电力',
  '燃气Ⅱ', '航空机场', '铁路公路', '航运港口', '物流', '房地产开发', '房地产服务', '一般零售',
  '专业连锁Ⅱ', '互联网电商', '贸易Ⅱ', '旅游零售Ⅱ', '体育Ⅱ', '酒店餐饮', '旅游及景区', '教育',
  '专业服务', '综合Ⅱ', '水泥', '玻璃玻纤', '装修建材', '房屋建设Ⅱ', '装修装饰Ⅱ', '基础建设',
  '专业工程', '工程咨询服务Ⅱ', '电池', '光伏设备', '风电设备', '电网设备', '电机Ⅱ', '其他电源设备Ⅱ',
  '通用设备', '专用设备', '轨交设备Ⅱ', '工程机械', '自动化设备', '航天装备Ⅱ', '航空装备Ⅱ', '地面兵装Ⅱ',
  '航海装备Ⅱ', '军工电子Ⅱ', '乘用车', '商用车', '汽车零部件', '汽车服务', '摩托车及其他', '计算机设备',
  '软件开发', 'IT服务Ⅱ', '出版', '电视广播Ⅱ', '广告营销', '数字媒体', '影视院线', '游戏Ⅱ',
  '通信设备', '通信服务', '银行Ⅱ', '证券Ⅱ', '保险Ⅱ', '多元金融', '煤炭开采', '焦炭Ⅱ',
  '油气开采Ⅱ', '油服工程', '炼化及贸易', '环境治理', '环保设备Ⅱ', '个护用品', '化妆品', '医疗美容',
]

const L1_SET = new Set(L1_INDUSTRIES)
const L2_SET = new Set(L2_INDUSTRIES)

/**
 * 板块层级：1 = 申万一级，2 = 申万二级，3 = 申万三级（叶子）
 * 精确匹配原始名称——「银行Ⅱ」是二级，「银行」才是一级。
 */
export function levelOf(name) {
  if (L1_SET.has(name)) return 1
  if (L2_SET.has(name)) return 2
  return 3
}

/** 时间粒度：对齐交易周期，而非任意窗口 */
export const PERIODS = [
  { key: 'd1', label: '今日', cn: '当日主力', unit: 'CNY', hours: 4, hint: '09:30–15:00 累计', bar: '日' },
  { key: 'd5', label: '5日', cn: '近一周', unit: 'CNY', hours: 20, hint: '最近 5 个交易日累计', bar: '周' },
  { key: 'd10', label: '10日', cn: '近两周', unit: 'CNY', hours: 40, hint: '最近 10 个交易日累计', bar: '双周' },
]

/** 交易时段（Asia/Shanghai） */
export const SESSIONS = [
  { open: '09:30', close: '11:30' },
  { open: '13:00', close: '15:00' },
]

/** 质量门禁阈值 */
export const GATES = {
  minCoverage: 0.98,
  identityTolerance: 0.05,
  conservationTolerance: 0.02,
  /** 一/二/三级净额求和的相对偏差上限（层级判定失效会放大到 100%+） */
  hierarchyTolerance: 0.015,
  maxStaleSeconds: 300,
  maxNullRate: 0.02,
  minPassRate: 0.8,
}

/** 裁决阈值（全部可计算、可复核） */
export const THRESHOLDS = {
  surgeZ: 1.5,
  panicZ: -2.0,
  surgeBreadth: 0.55,
  panicChg: -3,
  tierBands: { S: 0.98, A: 0.9, B: 0.7, C: 0.3 },
}

/** 强度权重：形成可裁决的复合分 */
export const WEIGHTS = {
  zNet: 0.3,
  zIntensity: 0.28,
  persistence: 0.16,
  breadth: 0.14,
  acceleration: 0.12,
}

export const VERDICTS = {
  surge: { label: '主力抢筹', tone: 'in', weight: 5 },
  accumulate: { label: '持续吸筹', tone: 'in', weight: 4 },
  'mild-in': { label: '温和流入', tone: 'in', weight: 2 },
  distribution: { label: '高位派发', tone: 'out', weight: -2 },
  bleed: { label: '持续失血', tone: 'out', weight: -4 },
  panic: { label: '恐慌出逃', tone: 'out', weight: -5 },
  neutral: { label: '多空平衡', tone: 'flat', weight: 0 },
}

export const REGIMES = {
  'risk-on': { label: '进攻', desc: '净流入扩张，广度占优' },
  rotate: { label: '轮动', desc: '总量收敛，结构分化' },
  'risk-off': { label: '防守', desc: '净流出扩张，广度转弱' },
}
