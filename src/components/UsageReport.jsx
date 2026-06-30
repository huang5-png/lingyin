import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import StateView from './StateView'
import './UsageReport.css'

const RANGES = [
  { key: 'day', label: '日度', short: '今日' },
  { key: 'week', label: '周度', short: '本周' },
  { key: 'month', label: '月度', short: '本月' },
  { key: 'year', label: '年度', short: '本年' },
]

function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 1) return '0 秒'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h} 小时 ${m} 分 ${s} 秒`
  if (m > 0) return `${m} 分 ${s} 秒`
  return `${s} 秒`
}

function formatShortDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 1) return '0s'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h}h${m}m${s}s`
  if (m > 0) return `${m}m${s}s`
  return `${s}s`
}

const UsageReport = memo(function UsageReport() {
  const [range, setRange] = useState('month')
  const [refDate, setRefDate] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef(null)

  const loadStats = useCallback(async (r, date) => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.electronAPI.dbGetUsageStats({ range: r, date })
      setStats(data)
    } catch (e) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats(range, refDate)
  }, [range, refDate, loadStats])

  useEffect(() => {
    if (!showExportMenu) return
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showExportMenu])

  const handleRefresh = useCallback(() => {
    loadStats(range, refDate)
  }, [range, refDate, loadStats])

  const handlePrevPeriod = useCallback(() => {
    const base = refDate ? new Date(refDate) : new Date()
    if (range === 'day') {
      base.setDate(base.getDate() - 1)
    } else if (range === 'week') {
      base.setDate(base.getDate() - 7)
    } else if (range === 'month') {
      base.setMonth(base.getMonth() - 1)
    } else {
      base.setFullYear(base.getFullYear() - 1)
    }
    setRefDate(base.getTime())
  }, [range, refDate])

  const handleNextPeriod = useCallback(() => {
    const base = refDate ? new Date(refDate) : new Date()
    if (range === 'day') {
      base.setDate(base.getDate() + 1)
    } else if (range === 'week') {
      base.setDate(base.getDate() + 7)
    } else if (range === 'month') {
      base.setMonth(base.getMonth() + 1)
    } else {
      base.setFullYear(base.getFullYear() + 1)
    }
    const now = new Date()
    if (base.getTime() > now.getTime()) {
      setRefDate(null)
    } else {
      setRefDate(base.getTime())
    }
  }, [range, refDate])

  const handleResetToNow = useCallback(() => {
    setRefDate(null)
  }, [])

  const handleExportCSV = useCallback(async () => {
    try {
      const csv = await window.electronAPI.dbExportHistoryCSV()
      if (!csv) {
        alert('没有可导出的播放历史')
        return
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `聆音播放历史_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setShowExportMenu(false)
    } catch (e) {
      alert('导出失败：' + e.message)
    }
  }, [])

  const handleExportJSON = useCallback(async () => {
    try {
      const json = await window.electronAPI.dbExportHistoryJSON()
      if (!json) {
        alert('没有可导出的播放历史')
        return
      }
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `聆音播放历史_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setShowExportMenu(false)
    } catch (e) {
      alert('导出失败：' + e.message)
    }
  }, [])

  const isCurrentPeriod = refDate === null

  const rangeLabel = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)
    return r ? r.short : ''
  }, [range])

  const periodLabel = useMemo(() => {
    const d = refDate ? new Date(refDate) : new Date()
    if (range === 'day') {
      const today = new Date()
      const isToday = d.toDateString() === today.toDateString()
      if (isToday) return '今日'
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      if (d.toDateString() === yesterday.toDateString()) return '昨日'
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    } else if (range === 'week') {
      const now = new Date()
      const weekStart = new Date(d)
      const day = weekStart.getDay()
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
      weekStart.setDate(diff)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const isThisWeek = weekStart <= now && now <= weekEnd
      if (isThisWeek) return '本周'
      return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 - ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`
    } else if (range === 'month') {
      const now = new Date()
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return '本月'
      return `${d.getFullYear()}年${d.getMonth() + 1}月`
    } else {
      const now = new Date()
      if (d.getFullYear() === now.getFullYear()) return '本年'
      return `${d.getFullYear()}年`
    }
  }, [range, refDate])

  const hasData = stats && stats.totalSeconds > 0

  return (
    <div className="usage-report">
      <div className="report-scroll">
        {/* ===== Header ===== */}
        <div className="report-header">
          <div className="report-header-left">
            <div className="report-eyebrow">
              <span className="dot" />
              <span>聆音 · 使用报告</span>
            </div>
            <div className="report-title-row">
              <h1 className="report-title">
                你的<span className="accent-text">{periodLabel}</span>聆听
              </h1>
              <div className="period-nav">
                <button
                  className="period-nav-btn"
                  onClick={handlePrevPeriod}
                  title="上一周期"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                {!isCurrentPeriod && (
                  <button
                    className="period-nav-btn reset-btn"
                    onClick={handleResetToNow}
                    title="回到当前"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  </button>
                )}
                <button
                  className="period-nav-btn"
                  onClick={handleNextPeriod}
                  title="下一周期"
                  disabled={isCurrentPeriod}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
            <p className="report-subtitle">
              基于本地播放记录的真实统计 —— 你在声音里停留过的每一秒，都被认真记下。
            </p>
          </div>
          <div className="report-header-right">
            <div className="range-tabs">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  className={`range-tab ${range === r.key ? 'active' : ''}`}
                  onClick={() => { setRange(r.key); setRefDate(null) }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="header-actions">
              <div className="export-menu-wrapper" ref={exportMenuRef}>
                <button
                  className="export-btn"
                  onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu) }}
                  title="导出数据"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  导出
                </button>
                {showExportMenu && (
                  <div className="export-dropdown">
                    <button className="export-dropdown-item" onClick={handleExportCSV}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="8" y1="13" x2="16" y2="13"/>
                        <line x1="8" y1="17" x2="16" y2="17"/>
                      </svg>
                      导出 CSV
                    </button>
                    <button className="export-dropdown-item" onClick={handleExportJSON}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                      </svg>
                      导出 JSON
                    </button>
                  </div>
                )}
              </div>
              <button className="refresh-btn" onClick={handleRefresh} title="刷新统计">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <StateView
            type="loading"
            iconType="loading"
            title="正在读取聆听记录..."
            className="report-state"
          />
        ) : error ? (
          <StateView
            type="error"
            iconType="error"
            title="加载失败"
            description={error}
            className="report-state"
          />
        ) : !hasData ? (
          <StateView
            type="empty"
            iconType="empty"
            title={`${periodLabel}还没有聆听记录`}
            description="在「我的库」或「发现」中播放一段声音，让聆听被记录下来，回到这里就能看到你的专属数据。"
            className="report-state"
          />
        ) : (
          <>
            {/* ===== Key metrics ===== */}
            <section className="rp-section">
              <div className="rp-section-head">
                <div className="rp-label">核心数据</div>
                <h2 className="rp-title">这段时间，你听过的</h2>
              </div>
              <div className="metrics-grid">
                <MetricCard
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  }
                  value={formatDuration(stats.totalSeconds)}
                  label="总聆听时长"
                  delta={periodLabel}
                />
                <MetricCard
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  }
                  value={stats.playCount}
                  label="播放次数"
                  delta={`${periodLabel}累计`}
                />
                <MetricCard
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  }
                  value={stats.uniqueWorks}
                  label="听过作品数"
                  delta="不同作品"
                />
                <MetricCard
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  }
                  value={stats.uniqueCVs}
                  label="不同声优"
                  delta="独特声音"
                />
              </div>
            </section>

            {/* ===== Insights ===== */}
            {stats.insights && (
              <section className="rp-section">
                <div className="rp-section-head">
                  <div className="rp-label">聆听洞察</div>
                  <h2 className="rp-title">你的聆听习惯</h2>
                  <p className="rp-desc">用数据读懂你 —— 这些数字背后，是你与声音的独特相处方式。</p>
                </div>
                <InsightsCard insights={stats.insights} />
              </section>
            )}

            {/* ===== Timeline chart ===== */}
            <section className="rp-section">
              <div className="rp-section-head">
                <div className="rp-label">聆听趋势</div>
                <h2 className="rp-title">{range === 'day' ? '一天里的声音分布' : range === 'week' ? '一周里的每日聆听' : range === 'month' ? '一月里的每日聆听' : '一年里的每月聆听'}</h2>
              </div>
              <div className="chart-card">
                <div className="chart-header">
                  <div>
                    <div className="chart-title">聆听时长分布</div>
                    <div className="chart-subtitle">
                      {range === 'day' ? '按小时（0-23 点）' : range === 'week' ? '按周（周一至周日）' : range === 'month' ? '按日（1-31）' : '按月（1-12 月）'}
                    </div>
                  </div>
                  <div className="chart-legend">
                    <span className="legend-item">
                      <span className="legend-dot" style={{ background: '#c96442' }} />
                      聆听秒数
                    </span>
                  </div>
                </div>
                <TimelineChart timeline={stats.timeline} range={range} />
              </div>
            </section>

            {/* ===== Time period analysis ===== */}
            {stats.insights && stats.insights.timePeriods && (
              <section className="rp-section">
                <div className="rp-section-head">
                  <div className="rp-label">时段分析</div>
                  <h2 className="rp-title">一天中的聆听分布</h2>
                  <p className="rp-desc">你习惯在什么时候与声音相伴？是清晨的唤醒，还是深夜的治愈？</p>
                </div>
                <TimePeriodChart periods={stats.insights.timePeriods} />
              </section>
            )}

            {/* ===== Rankings ===== */}
            <section className="rp-section">
              <div className="rp-section-head">
                <div className="rp-label">偏好排行</div>
                <h2 className="rp-title">最爱的标签、社团与声优</h2>
                <p className="rp-desc">用时长投票 —— 这些是你{periodLabel}反复回到的声音。</p>
              </div>

              <div className="rankings-grid">
                <RankingCard
                  title="标签排行 Top 10"
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>}
                  items={stats.tagRanking}
                  color="#c96442"
                />
                <RankingCard
                  title="社团排行 Top 10"
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
                  items={stats.circleRanking}
                  color="#b0562f"
                />
                <RankingCard
                  title="声优排行 Top 10"
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>}
                  items={stats.cvRanking}
                  color="#e0c9a8"
                />
              </div>
            </section>

            {/* ===== Top works ===== */}
            {stats.workRanking.length > 0 && (
              <section className="rp-section">
                <div className="rp-section-head">
                  <div className="rp-label">作品排行</div>
                  <h2 className="rp-title">陪伴你最久的作品</h2>
                  <p className="rp-desc">Top 10 高频回访 —— 这些是{periodLabel}真正住进你耳畔的故事。</p>
                </div>
                <div className="works-list">
                  {stats.workRanking.map((w, i) => (
                    <div className="work-row" key={w.id}>
                      <div className="work-rank">{i + 1}</div>
                      <div className="work-cover-wrap">
                        {w.cover ? (
                          <img src={w.cover} alt="" className="work-cover" loading="lazy" decoding="async" />
                        ) : (
                          <div className="work-cover-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                        )}
                      </div>
                      <div className="work-info">
                        <div className="work-name">{w.title || '未知作品'}</div>
                        <div className="work-meta">
                          <span>{formatDuration(w.seconds)}</span>
                          <span className="dot-sep">·</span>
                          <span>{w.count} 次播放</span>
                        </div>
                      </div>
                      <div className="work-bar">
                        <div
                          className="work-bar-fill"
                          style={{ width: `${(w.seconds / stats.workRanking[0].seconds) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="report-foot">
              <div className="foot-logo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> 聆音</div>
              <div className="foot-text">
                所有数据均来自本地播放记录 · 不会上传任何服务器
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
})

// ===== Sub components =====

function MetricCard({ icon, value, label, delta }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-delta">{delta}</div>
    </div>
  )
}

function InsightsCard({ insights }) {
  const { activeDays, avgDailySeconds, maxStreak, mostActivePeriodLabel, mostActiveWeekdayLabel, weekdayStats } = insights

  const maxWeekdaySeconds = Math.max(1, ...weekdayStats.map(w => w.seconds))

  return (
    <div className="insights-card">
      <div className="insights-grid">
        <div className="insight-item">
          <div className="insight-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="insight-content">
            <div className="insight-value">{activeDays} 天</div>
            <div className="insight-label">活跃天数</div>
          </div>
        </div>
        <div className="insight-item">
          <div className="insight-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="insight-content">
            <div className="insight-value">{formatShortDuration(avgDailySeconds)}</div>
            <div className="insight-label">日均时长</div>
          </div>
        </div>
        <div className="insight-item">
          <div className="insight-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div className="insight-content">
            <div className="insight-value">{maxStreak} 天</div>
            <div className="insight-label">最长连续</div>
          </div>
        </div>
        <div className="insight-item">
          <div className="insight-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="insight-content">
            <div className="insight-value">{mostActivePeriodLabel}</div>
            <div className="insight-label">最活跃时段</div>
          </div>
        </div>
        <div className="insight-item">
          <div className="insight-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="insight-content">
            <div className="insight-value">{mostActiveWeekdayLabel}</div>
            <div className="insight-label">最活跃日</div>
          </div>
        </div>
      </div>

      <div className="weekday-chart">
        <div className="weekday-chart-title">一周聆听分布</div>
        <div className="weekday-bars">
          {weekdayStats.map((w, i) => {
            const height = maxWeekdaySeconds > 0 ? (w.seconds / maxWeekdaySeconds) * 100 : 0
            return (
              <div className="weekday-bar-item" key={i}>
                <div className="weekday-bar-wrap">
                  <div
                    className="weekday-bar-fill"
                    style={{ height: `${Math.max(2, height)}%` }}
                    title={formatDuration(w.seconds)}
                  />
                </div>
                <div className="weekday-bar-label">{w.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TimePeriodChart({ periods }) {
  const max = Math.max(1, ...periods.map(p => p.seconds))

  return (
    <div className="time-period-card">
      <div className="time-period-list">
        {periods.map((p, i) => (
          <div className="time-period-row" key={p.key}>
            <div className="time-period-info">
              <div className="time-period-label">{p.label}</div>
              <div className="time-period-time">
                {p.key === 'morning' && '6:00 - 9:00'}
                {p.key === 'forenoon' && '9:00 - 12:00'}
                {p.key === 'afternoon' && '12:00 - 18:00'}
                {p.key === 'evening' && '18:00 - 23:00'}
                {p.key === 'lateNight' && '23:00 - 6:00'}
              </div>
            </div>
            <div className="time-period-bar-wrap">
              <div
                className="time-period-bar"
                style={{ width: `${(p.seconds / max) * 100}%` }}
              />
            </div>
            <div className="time-period-duration">{formatShortDuration(p.seconds)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RankingCard({ title, icon, items, color }) {
  const max = items.length > 0 ? items[0].seconds : 1
  return (
    <div className="ranking-card">
      <div className="ranking-head">
        <div className="ranking-icon" style={{ color }}>
          {icon}
        </div>
        <div className="ranking-title">{title}</div>
      </div>
      {items.length === 0 ? (
        <StateView
          type="empty"
          iconType="chart"
          title="暂无数据"
          size="sm"
          className="ranking-empty"
        />
      ) : (
        <div className="ranking-list">
          {items.map((it, i) => (
            <div className="ranking-row" key={it.name}>
              <div className="ranking-rank">{i + 1}</div>
              <div className="ranking-info">
                <div className="ranking-name" title={it.name}>{it.name}</div>
                <div className="ranking-bar">
                  <div
                    className="ranking-bar-fill"
                    style={{ width: `${(it.seconds / max) * 100}%`, background: color }}
                  />
                </div>
              </div>
              <div className="ranking-duration">{formatShortDuration(it.seconds)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TimelineChart({ timeline, range }) {
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [showTrendline, setShowTrendline] = useState(true)
  const containerRef = useRef(null)

  if (!timeline || timeline.length === 0) return null
  const max = Math.max(1, ...timeline.map((t) => t.seconds))
  const W = 940
  const H = 280
  const padL = 58
  const padR = 20
  const padT = 20
  const padB = 40
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const barGap = 4
  const barW = Math.max(2, (plotW / timeline.length) - barGap)

  const labelStep = range === 'year' || range === 'week'
    ? 1
    : Math.max(1, Math.ceil(timeline.length / 16))

  const trendlinePoints = useMemo(() => {
    if (!showTrendline || timeline.length < 3) return null
    const windowSize = Math.min(7, Math.max(3, Math.floor(timeline.length / 4)))
    const smoothed = []
    for (let i = 0; i < timeline.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2))
      const end = Math.min(timeline.length, i + Math.ceil(windowSize / 2))
      const sum = timeline.slice(start, end).reduce((acc, t) => acc + t.seconds, 0)
      smoothed.push(sum / (end - start))
    }
    return smoothed.map((val, i) => {
      const x = padL + i * (barW + barGap) + barW / 2
      const y = padT + plotH - (val / max) * plotH
      return { x, y }
    })
  }, [timeline, showTrendline, barW, barGap, max, plotH, padT, padL])

  const trendlinePath = useMemo(() => {
    if (!trendlinePoints || trendlinePoints.length < 2) return null
    let d = `M ${trendlinePoints[0].x} ${trendlinePoints[0].y}`
    for (let i = 1; i < trendlinePoints.length; i++) {
      const prev = trendlinePoints[i - 1]
      const curr = trendlinePoints[i]
      const cpX = (prev.x + curr.x) / 2
      d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`
    }
    return d
  }, [trendlinePoints])

  const handleMouseMove = (e, index) => {
    const svgRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
    setTooltipPos({
      x: e.clientX - svgRect.left,
      y: e.clientY - svgRect.top,
    })
    setHoveredIndex(index)
  }

  const handleMouseLeave = () => {
    setHoveredIndex(-1)
  }

  return (
    <div className="timeline-container" ref={containerRef}>
      <div className="chart-toggle-row">
        <button
          className={`chart-toggle-btn ${showTrendline ? 'active' : ''}`}
          onClick={() => setShowTrendline(!showTrendline)}
          title="切换趋势线"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          趋势线
        </button>
      </div>
      <svg className="timeline-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c96442" />
            <stop offset="100%" stopColor="#e0c9a8" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="tlGradHover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e07a5a" />
            <stop offset="100%" stopColor="#f0d9c0" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="trendlineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c96442" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#d97757" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e0a082" stopOpacity="0.8" />
          </linearGradient>
          <filter id="trendlineGlow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = padT + plotH * p
          const val = max * (1 - p)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(201,100,66,0.12)" strokeWidth="1" strokeDasharray="3 4" />
              <text x={padL - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#b09d8a" fontWeight="600">
                {formatShortDuration(val)}
              </text>
            </g>
          )
        })}
        {timeline.map((t, i) => {
          const h = max > 0 ? (t.seconds / max) * plotH : 0
          const x = padL + i * (barW + barGap)
          const y = padT + plotH - h
          const isActive = t.seconds > 0
          const isHovered = hoveredIndex === i
          const showLabel = i % labelStep === 0 || i === timeline.length - 1
          return (
            <g key={i}>
              <rect
                x={x}
                y={isActive ? y : padT + plotH - 2}
                width={barW}
                height={isActive ? h : 2}
                rx="3"
                fill={isHovered && isActive ? 'url(#tlGradHover)' : (isActive ? 'url(#tlGrad)' : 'rgba(201,100,66,0.15)')}
                style={{ cursor: isActive ? 'pointer' : 'default', transition: 'fill 0.15s ease' }}
                onMouseMove={(e) => handleMouseMove(e, i)}
                onMouseLeave={handleMouseLeave}
              />
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={H - padB + 18}
                  textAnchor="middle"
                  fontSize={range === 'year' || range === 'week' ? 11 : 10}
                  fill="#b09d8a"
                  fontWeight="600"
                >
                  {t.label}
                </text>
              )}
            </g>
          )
        })}
        {trendlinePath && (
          <g className="trendline-group">
            <path
              d={trendlinePath}
              fill="none"
              stroke="rgba(201,100,66,0.25)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#trendlineGlow)"
            />
            <path
              d={trendlinePath}
              fill="none"
              stroke="url(#trendlineGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {trendlinePoints.slice(-1).map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="4"
                fill="#c96442"
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}
          </g>
        )}
      </svg>
      {hoveredIndex >= 0 && timeline[hoveredIndex] && (
        <div
          className="timeline-tooltip"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 40,
          }}
        >
          <div className="tooltip-label">{timeline[hoveredIndex].label}</div>
          <div className="tooltip-value">{formatDuration(timeline[hoveredIndex].seconds)}</div>
        </div>
      )}
    </div>
  )
}

export default UsageReport
