/**
 * 七大年画流派的"画面鉴别要点"
 *
 * 为什么单独抽出来：
 * 向量检索只能比较字面相似度，而流派之间的关键差异是"技法是否吻合"
 * （半印半绘 vs 纯套色），属于语义判断，必须交给大模型逐条比对。
 *
 * 这些要点的编写原则：只写"能从画面上看出来"的特征。
 * 历史沿革、传承人名录这类不可见信息不写进来，避免干扰判断。
 */

export type SchoolProfile = {
  school: string;
  technique: string;
  color: string;
  line: string;
  theme: string;
  look: string;
};

export const SCHOOL_PROFILES: SchoolProfile[] = [
  {
    school: "杨柳青",
    technique: "半印半绘——木版只印墨线轮廓，大面积色彩靠手工敷彩，人物面部有肉色晕染和开脸（眉眼唇用笔勾画），能看到明显手绘笔触",
    color: "雅致柔和，粉红、湖蓝、藕荷等中间色多，对比不强烈",
    line: "细而匀，不是粗犷刻线",
    theme: "仕女、胖娃娃（抱鱼/抱石榴）、戏曲故事、吉祥图案",
    look: "整体接近工笔画，有文人气息，人物面部细腻",
  },
  {
    school: "桃花坞",
    technique: "一版一色纯套印，无手绘痕迹，色块边界清晰干净",
    color: "清丽偏冷，蓝、绿、紫较多，对比不强烈",
    line: "刻工精细，线条流畅如刀刻，版画味明确",
    theme: "戏曲故事、市井生活、仕女",
    look: "构图疏朗，留白较多，常见大段题字",
  },
  {
    school: "杨家埠",
    technique: "纯木版套色，绝无手绘",
    color: "极浓烈——大红、大绿、亮黄、紫并置，撞色强烈，远看极度醒目",
    line: "粗犷简练，以块面为主",
    theme: "门神、财神、灶王、吉祥娃娃",
    look: "满构图，几乎不留白",
  },
  {
    school: "朱仙镇",
    technique: "纯木版套色",
    color: "厚重沉稳偏暗，红青黄为主但不艳丽（多用矿物颜料）",
    line: "最粗犷有力，如铁线；人物造型古拙，头大、五官高度简化",
    theme: "几乎全是门神",
    look: "严格对称构图",
  },
  {
    school: "绵竹",
    technique: "以手工彩绘为主——先印墨线再大面积手绘，笔法流畅自由，手绘感强。分「红货」（彩色）「黑货」（墨色）",
    color: "明快通透，大红大绿但不厚重",
    line: "粗细变化适中，有写意感",
    theme: "门神、戏曲故事、民间传说",
    look: "人物灵动，笔触自由",
  },
  {
    school: "武强",
    technique: "纯木版套色",
    color: "鲜艳但比杨家埠素净，红黄蓝为主",
    line: "简洁传神，装饰性较弱",
    theme: "最具特色是农事生活场景（耕作、纺织）、节令习俗，乡土气息极浓；也有门神",
    look: "朴素，题材接地气",
  },
  {
    school: "佛山",
    technique: "大红底 + 手工描金——底色是大红（不是白纸底），再套印其他色，最后用金线勾勒，金红交辉",
    color: "整体呈浓重的红金调，非常华丽",
    line: "有金线勾勒",
    theme: "门神、神像",
    look: "红底描金是所有北方年画都没有的独有标志",
  },
];

/** 生成给大模型看的要点文本 */
export function profilesAsText(): string {
  return SCHOOL_PROFILES.map(
    (p) =>
      `【${p.school}】\n- 技法：${p.technique}\n- 色彩：${p.color}\n- 线条：${p.line}\n- 题材：${p.theme}\n- 观感：${p.look}`,
  ).join("\n\n");
}

export const SCHOOL_NAMES = SCHOOL_PROFILES.map((p) => p.school);
