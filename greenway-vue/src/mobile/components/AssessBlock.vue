<template>
  <section class="assess-block" v-if="item">
    <!-- 头部：标题 + 等级徽章 -->
    <div class="ab-header">
      <h3 class="ab-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        绿道体检
      </h3>
      <span class="ab-grade" :class="gradeClass">{{ item.grade }}</span>
    </div>

    <!-- 综合评分 + AI 报告入口 -->
    <div class="ab-score-row">
      <div class="ab-score-main">
        <div class="ab-score-line">
          <span class="ab-score-val font-number">{{ item.score }}</span>
          <span class="ab-score-unit">分</span>
        </div>
        <div class="ab-rank">全市第 <b>{{ item.rank }}</b> / {{ total }} 名 · 全长 {{ item.lenKm }} km</div>
      </div>
      <button class="ab-ai-btn" :disabled="aiLoading" @click="askAI">
        <svg v-if="!aiLoading" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M8 7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/><line x1="12" y1="11" x2="12" y2="15"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>
        <svg v-else class="ab-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>
        {{ aiLoading ? '解读中…' : (aiText ? '重新解读' : 'AI 深度报告') }}
      </button>
    </div>

    <!-- 五维评分 -->
    <div class="ab-dims">
      <div class="ab-dim" v-for="d in dimList" :key="d.key">
        <div class="ab-dim-label">
          <span>{{ d.label }}</span>
          <span class="ab-dim-val font-number">{{ item.dims[d.key] }}</span>
        </div>
        <div class="ab-dim-track">
          <div class="ab-dim-fill" :style="{ width: Math.min(100, item.dims[d.key]) + '%' }"></div>
          <!-- 全市平均刻度线 -->
          <div v-if="avgDims[d.key] != null" class="ab-dim-avg" :style="{ left: Math.min(100, avgDims[d.key]) + '%' }" :title="`全市平均 ${avgDims[d.key]}`"></div>
        </div>
      </div>
    </div>

    <!-- 功能画像 -->
    <div class="ab-profile" v-if="profileList.length">
      <div class="ab-profile-label">功能画像</div>
      <div class="ab-profile-bar">
        <span v-for="p in profileList" :key="p.key" class="ab-profile-seg"
              :style="{ width: p.v + '%', background: p.color }" />
      </div>
      <div class="ab-profile-legend">
        <span v-for="p in profileList" :key="p.key">
          <i :style="{ background: p.color }"></i>{{ p.label }} {{ p.v }}%
        </span>
      </div>
    </div>

    <!-- 亮点 / 短板 -->
    <div class="ab-points" v-if="item.highlights?.length || item.weakPoints?.length">
      <div class="ab-points-col ab-good" v-if="item.highlights?.length">
        <div class="ab-points-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          亮点
        </div>
        <ul class="ab-points-list">
          <li v-for="(h, i) in item.highlights" :key="i">{{ h.text }}</li>
        </ul>
      </div>
      <div class="ab-points-col ab-weak" v-if="item.weakPoints?.length">
        <div class="ab-points-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          短板
        </div>
        <ul class="ab-points-list">
          <li v-for="(w, i) in item.weakPoints" :key="i">{{ w.text }}</li>
        </ul>
      </div>
    </div>

    <!-- AI 深度报告 -->
    <div class="ab-ai-text" v-if="aiText">
      <div class="ab-ai-head">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M8 7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/></svg>
        AI 深度报告
      </div>
      <p class="ab-ai-content">{{ aiText }}</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchGreenwayAssess, aiChat } from '../services/api'

const props = defineProps({
  trailName: { type: String, required: true }
})

const item = ref(null)
const total = ref(0)
const avgDims = ref({})
const aiText = ref('')
const aiLoading = ref(false)

/* 五维定义（与 Web 端一致） */
const DIM_LABEL = { eco: '生态自然度', transport: '出行便捷度', facility: '设施完备度', heat: '人气活力值', leisure: '休闲适宜度' }
const dimList = computed(() => Object.keys(DIM_LABEL).map(k => ({ key: k, label: DIM_LABEL[k] })))

/* 等级配色 */
const GRADE_CLASS = { 优: 'ab-grade-good', 良: 'ab-grade-mid', 中: 'ab-grade-ok', 待提升: 'ab-grade-bad' }
const gradeClass = computed(() => GRADE_CLASS[item.value?.grade] || 'ab-grade-mid')

/* 画像配色（与 Web 端一致） */
const PROFILE_COLORS = { eco: '#16a34a', scenic: '#14b8a6', history: '#b8860b', urban: '#2563eb' }
const PROFILE_CN = { eco: '生态', scenic: '风景', history: '历史文化', urban: '城市' }
const profileList = computed(() => {
  if (!item.value?.profile) return []
  return Object.keys(item.value.profile).map(k => ({
    key: k, label: PROFILE_CN[k], color: PROFILE_COLORS[k], v: item.value.profile[k] || 0
  })).filter(p => p.v > 0)
})

onMounted(async () => {
  try {
    const data = await fetchGreenwayAssess()
    total.value = data.total || 0
    avgDims.value = data.avgDims || {}
    const name = (props.trailName || '').trim()
    item.value = (data.items || []).find(i => (i.name || '').trim() === name) || null
  } catch (e) {
    // 静默失败：体检数据非核心，加载失败不打扰用户
    console.error('[体检评估] 加载失败:', e)
  }
})

/* AI 深度报告 */
async function askAI() {
  if (!item.value) return
  aiLoading.value = true
  aiText.value = ''
  try {
    const it = item.value
    const avg = avgDims.value || {}
    const detail =
      `${it.name}（综合${it.score}分/${it.grade}，全市第${it.rank}名，长${it.lenKm}km）\n` +
      `五维体检：生态自然度${it.dims.eco}分（全市平均${avg.eco ?? '—'}）、出行便捷度${it.dims.transport}分（平均${avg.transport ?? '—'}）、` +
      `设施完备度${it.dims.facility}分（平均${avg.facility ?? '—'}）、人气活力值${it.dims.heat}分（平均${avg.heat ?? '—'}）、` +
      `休闲适宜度${it.dims.leisure}分（平均${avg.leisure ?? '—'}）\n` +
      `功能画像：生态${it.profile.eco}%/风景${it.profile.scenic}%/历史文化${it.profile.history}%/城市${it.profile.urban}%\n` +
      `亮点：${it.highlights.map(h => h.text).join('；')}\n` +
      `短板：${it.weakPoints.map(w => w.text).join('；') || '无明显短板'}`

    const { reply } = await aiChat(
      `请为这条北京绿道写一份"市民体检报告"（250-300字），数据如下（注意：北京全市仅有 17 条绿道，不要虚构更多）：\n${detail}\n\n` +
      `要求：1) 先给一句总体评价（结合分数和等级）；2) 说说它的核心亮点（结合五维和画像）；` +
      `3) 指出它的短板和适合的人群/场景（遛娃、骑行、跑步、访古、亲近自然等）；` +
      `4) 给 1-2 条出发建议。语言通俗亲切，像朋友推荐一样。`
    )
    aiText.value = reply || 'AI 暂时无法解读，请稍后重试。'
  } catch (e) {
    aiText.value = 'AI 深度报告生成失败：' + (e.message || '请稍后重试')
  } finally {
    aiLoading.value = false
  }
}
</script>

<style scoped>
.assess-block {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  border: 0.5px solid var(--color-border-light);
  margin: 0 16px 20px;
}

.ab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ab-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-heading-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.2px;
}
.ab-title svg { color: var(--color-primary); }

.ab-grade {
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  padding: 3px 12px;
  border-radius: var(--radius-full);
  color: #fff;
}
.ab-grade-good { background: #16a34a; }
.ab-grade-mid { background: #2563eb; }
.ab-grade-ok { background: #f59e0b; }
.ab-grade-bad { background: #ef4444; }

/* 综合评分 + AI 按钮 */
.ab-score-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0 14px;
  border-bottom: 0.5px solid var(--color-divider);
}
.ab-score-line { display: flex; align-items: baseline; }
.ab-score-val {
  font-size: 34px;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: 1;
  letter-spacing: -1px;
}
.ab-score-unit { font-size: 14px; color: var(--color-text-secondary); margin-left: 3px; }
.ab-rank { font-size: var(--text-sm); color: var(--color-text-secondary); margin-top: 4px; }
.ab-rank b { color: var(--color-primary); font-weight: var(--font-weight-semibold); }

.ab-ai-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding: 9px 16px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}
.ab-ai-btn:active:not(:disabled) { transform: scale(0.95); }
.ab-ai-btn:disabled { opacity: 0.6; }
.ab-spin { animation: ab-spin 0.8s linear infinite; }
@keyframes ab-spin { to { transform: rotate(360deg); } }

/* 五维评分 */
.ab-dims {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 0;
}
.ab-dim-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: 5px;
}
.ab-dim-val {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
.ab-dim-track {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: var(--color-surface-2);
  overflow: hidden;
}
.ab-dim-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--gradient-brand-light);
  transition: width 0.5s ease;
}
.ab-dim-avg {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--color-text-tertiary);
  opacity: 0.55;
  border-radius: 1px;
}

/* 功能画像 */
.ab-profile { padding: 2px 0 4px; }
.ab-profile-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}
.ab-profile-bar {
  display: flex;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--color-surface-2);
}
.ab-profile-seg { height: 100%; transition: width 0.5s ease; }
.ab-profile-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 8px;
}
.ab-profile-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.ab-profile-legend i {
  width: 8px;
  height: 8px;
  border-radius: 3px;
  display: inline-block;
}

/* 亮点 / 短板 */
.ab-points {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.ab-points-col {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius-md);
  padding: 10px 12px;
}
.ab-good { background: color-mix(in srgb, #16a34a 9%, transparent); }
.ab-weak { background: color-mix(in srgb, #ef4444 8%, transparent); }
.ab-points-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  margin-bottom: 6px;
}
.ab-good .ab-points-label { color: #16a34a; }
.ab-weak .ab-points-label { color: #ef4444; }
.ab-points-list {
  margin: 0;
  padding-left: 15px;
}
.ab-points-list li {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

/* AI 报告 */
.ab-ai-text {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-primary) 7%, transparent);
  border: 0.5px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
}
.ab-ai-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  margin-bottom: 8px;
}
.ab-ai-content {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text-primary);
  white-space: pre-wrap;
}
</style>
