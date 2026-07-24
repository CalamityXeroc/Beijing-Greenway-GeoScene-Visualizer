/**
 * 数据库迁移：从 MD 汇总文件更新绿道文字信息
 * 运行: node scripts/update-greenway-data.js
 */
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'greenway'
});

// MD 文档 → 数据库名称映射（按 MD 中的顺序）
const UPDATES = [
  { db_name: '温榆河绿道',             length: 108,    image: 'wenyuhe.jpg' },
  { db_name: '亮马河绿道',             length: 18,     image: 'liangmahe.jpg' },
  { db_name: '环二环城市绿道',         length: 80,     image: 'huanerhuan.jpg' },
  { db_name: '朝阳绿道',               length: 9.5,    image: 'chaoyang.jpg' },
  { db_name: '昌平42绿道',             length: 44,     image: 'changping42.jpg' },
  { db_name: '常营半马绿道',           length: 5.2,    image: 'changying.jpg' },
  { db_name: '三山五园绿道',           length: 36.09,  image: 'sanshan.jpg' },
  { db_name: '南沙绿道',               length: 20.4,   image: 'nansha.jpg' },
  { db_name: '营城建都绿道',           length: 9.3,    image: 'yingcheng.jpg' },
  { db_name: '北运河绿道',             length: 8.6,    image: 'beiyunhe.jpg' },
  { db_name: '丽都商圈绿道',           length: 2.2,    image: 'lidu.jpg' },
  { db_name: '奥林匹克森林公园绿道',   length: 10.6,   image: 'aosen.jpg' },
];

// 从 MD 文件提取的简介和特色
const DESCRIPTIONS = {
  '温榆河绿道': {
    introduction: '温榆河滨水绿道是北京市级滨水型绿道，沿温榆河两岸建设，途经昌平、顺义、朝阳、通州四区。河流周边生态环境优越，串联巩华城、东郊森林公园、大运河森林公园等景观节点。绿道全线共设置13处游客服务中心和驿站，定位为郊野型绿道，以骑行为主、步行为辅。',
    features: '滨水生态廊道 | 四区贯通 | 13处驿站 | 郊野骑行',
    coverage_area: '昌平、顺义、朝阳、通州'
  },
  '亮马河绿道': {
    introduction: '亮马河滨水慢行系统西起香河园路，一路沿河向东延伸至燕莎、蓝港，在朝阳湖向东南延伸，至红领巾湖为终点，沿河流两侧形成闭环。绿道沿途经过24桥18景，营造出变化丰富而趣味横生的滨水空间。',
    features: '24桥18景 | 国际风情水岸 | 滨水慢行闭环 | 商圈地标',
    coverage_area: '朝阳区亮马河沿线'
  },
  '环二环城市绿道': {
    introduction: '环二环城市绿道是北京中心城区沿护城河打造的绿色人行步道系统，串联东城、西城、朝阳、丰台四区。绿道连接龙潭公园、明城墙遗址公园等460余公顷绿地及天坛、雍和宫等40余处历史文化地标，配套9处便民休闲驿站，是北京的"水岸花园"文化名片。',
    features: '护城河绿廊 | 460公顷绿地 | 40处文化地标 | 9处驿站 | 城市水岸花园',
    coverage_area: '东城、西城、朝阳、丰台'
  },
  '朝阳绿道': {
    introduction: '绿道主要沿东四环两侧敷设，北起安立路与清河交界，南至望和公园北园，串联奥林匹克森林公园、仰山公园、北小河公园等多处公园绿地和林地。',
    features: '东四环绿廊 | 串联多处公园 | 城市休闲',
    coverage_area: '朝阳区东四环沿线'
  },
  '昌平42绿道': {
    introduction: '该绿道纵贯都市、滨河及郊野区域，串联东小口森林公园、贺新公园、太平郊野公园等10余个郊野公园及温榆河、十三陵水库等风景名胜，形成覆盖7万亩的生态系统，配套活动广场、架空栈桥等休憩设施。',
    features: '全马长度 | 10余郊野公园 | 7万亩生态 | 架空栈桥 | 骑行胜地',
    coverage_area: '昌平区'
  },
  '常营半马绿道': {
    introduction: '常营半马绿道将沿线六大绿地公园连片成环，打造了多层次便捷的生态跑道体系，为北京东部首个专业半程马拉松赛道。',
    features: '半马赛道 | 六大公园连片 | 生态跑道 | 北京东部首个',
    coverage_area: '朝阳区常营'
  },
  '三山五园绿道': {
    introduction: '全长36.09公里，绿地面积51.34公顷，2016年全线贯通。东起清华大学西门，西至香山南路与闵庄路交汇处，串联香山、玉泉山、万寿山三座山丘及静宜园、静明园等五大皇家园林，是连接西郊皇家行宫苑囿的线性廊道，兼具历史文化和生态休闲功能。',
    features: '皇家园林廊道 | 三山五园 | 51公顷绿地 | 历史文化名径 | 2016年贯通',
    coverage_area: '海淀区西郊'
  },
  '南沙绿道': {
    introduction: '贯通20.4公里的滨水慢行步道，缝合160公顷的蓝绿空间。河道全长11.2公里，流域面积115.9平方公里，包含南沙河、周家巷沟及东埠头沟三条河道。将海淀北部生态和城市资源串联起来，打造现代、活力、自然的滨水休闲空间。',
    features: '160公顷蓝绿空间 | 三河贯通 | 滨水慢行 | 骑行/步行/跑步',
    coverage_area: '海淀区北部'
  },
  '营城建都绿道': {
    introduction: '北起木樨地，南至永定门桥，全长约9.3公里。绿道周边途径白云观、天宁寺、先农坛等历史古迹，以及大观园、陶然亭等人文景观。骑行其中，可欣赏垂柳吐新碧，河水映两岸垂柳的"半壕春水一城花"意境，是体验京城历史文化的理想路线。',
    features: '历史古迹 | 白云观/天宁寺/先农坛 | 大观园/陶然亭 | 京城文化名径',
    coverage_area: '西城区（木樨地-永定门）'
  },
  '北运河绿道': {
    introduction: '位于北京市通州区北运河通州新城城市段，北起六环路潞阳桥，南至武窑桥。总建设面积713.33公顷，构建"一河、两岸、六园、十八景"景观体系。2024年2月被评为5A级文化旅游景区，是北京重要的滨水休闲目的地。',
    features: '5A级景区 | 一河两岸六园十八景 | 713公顷 | 运河文化',
    coverage_area: '通州区'
  },
  '丽都商圈绿道': {
    introduction: '从北京丽都皇冠假日酒店西侧开始，挨着机场高速，独立骑行道和人行道，全程被树荫覆盖。一直往南可骑到四得公园南入口，是望京地区舒适骑行绿道。作为北京最早涉外商圈的绿道系统，与丽都商圈城市更新项目相配套，形成"蓝绿交织、动静相宜"的国际化区域。',
    features: '涉外商圈 | 独立骑行道 | 全程树荫 | 蓝绿交织',
    coverage_area: '朝阳区望京/丽都商圈'
  },
  '奥林匹克森林公园绿道': {
    introduction: '奥森公园绿道是亚洲最大的城市绿化景观之一，以"通向自然的轴线"为理念，串联南、北两园，已建成10公里全程塑胶乐跑健走道，另外还有3公里、5公里的奔跑行进路线可供选择，是北京知名的全民健身与跑步圣地。',
    features: '亚洲最大城市绿化 | 塑胶跑道 | 10+3+5公里路线 | 全民健身圣地',
    coverage_area: '朝阳区奥林匹克公园'
  }
};

async function main() {
  try {
    console.log('[绿道数据更新] 正在更新绿道信息...\n');

    let updated = 0;
    for (const item of UPDATES) {
      const desc = DESCRIPTIONS[item.db_name];
      if (!desc) {
        console.log(`  ✗ ${item.db_name}: 未找到描述数据`);
        continue;
      }

      const result = await pool.query(
        `UPDATE greenways
         SET description = $1,
             introduction = $2,
             length = $3,
             features = $4,
             coverage_area = $5,
             image = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE name = $7`,
        [desc.introduction.substring(0, 200), desc.introduction, item.length,
         desc.features, desc.coverage_area, item.image, item.db_name]
      );

      if (result.rowCount > 0) {
        console.log(`  ✓ ${item.db_name}: 已更新 (${item.length}km, 图片: ${item.image})`);
        updated++;
      } else {
        console.log(`  ⚠ ${item.db_name}: 数据库中未找到此绿道`);
      }
    }

    console.log(`\n[绿道数据更新] 完成！共更新 ${updated} 条记录。`);

    // 显示未更新的绿道
    const all = await pool.query('SELECT name FROM greenways ORDER BY id');
    const updated_names = new Set(UPDATES.map(u => u.db_name));
    const missing = all.rows.filter(r => !updated_names.has(r.name));
    if (missing.length > 0) {
      console.log('\n以下绿道在数据库中但尚未导入数据（仅DB有，文档无）：');
      for (const r of missing) {
        console.log(`  - ${r.name}`);
      }
    }

  } catch (err) {
    console.error('[绿道数据更新] 失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
