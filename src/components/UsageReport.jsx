import { useState, useEffect, useCallback, useMemo } from 'react'
import './UsageReport.css'

const RANGES = [
  { key: 'day', label: '日度', short: '今日' },
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

export default function UsageReport() {
  const [range, setRange] = useState('month')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadStats = useCallback(async (r) => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.electronAPI.dbGetUsageStats({ range: r })
      setStats(data)
    } catch (e) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats(range)
  }, [range, loadStats])

  const rangeLabel = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)
    return r ? r.short : ''
  }, [range])

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
            <h1 className="report-title">
              你的<span className="accent-text">{rangeLabel}</span>聆听
            </h1>
            <p className="report-subtitle">
              基于本地播放记录的真实统计 —— 你在声音里停留过的每一秒，都被认真记下。
            </p>
          </div>
          <div className="range-tabs">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={`range-tab ${range === r.key ? 'active' : ''}`}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="report-loading">
            <div className="loading-spinner" />
            <span>正在读取聆听记录...</span>
          </div>
        ) : error ? (
          <div className="report-error">加载失败：{error}</div>
        ) : !hasData ? (
          <EmptyState range={rangeLabel} />
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
                  delta={rangeLabel}
                />
                <MetricCard
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  }
                  value={stats.playCount}
                  label="播放次数"
                  delta={`${rangeLabel}累计`}
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

            {/* ===== Timeline chart ===== */}
            <section className="rp-section">
              <div className="rp-section-head">
                <div className="rp-label">聆听趋势</div>
                <h2 className="rp-title">{range === 'day' ? '一天里的声音分布' : range === 'month' ? '一月里的每日聆听' : '一年里的每月聆听'}</h2>
              </div>
              <div className="chart-card">
                <div className="chart-header">
                  <div>
                    <div className="chart-title">聆听时长分布</div>
                    <div className="chart-subtitle">
                      {range === 'day' ? '按小时（0-23 点）' : range === 'month' ? '按日（1-31）' : '按月（1-12 月）'}
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

            {/* ===== Rankings ===== */}
            <section className="rp-section">
              <div className="rp-section-head">
                <div className="rp-label">偏好排行</div>
                <h2 className="rp-title">最爱的标签、社团与声优</h2>
                <p className="rp-desc">用时长投票 —— 这些是你{rangeLabel}反复回到的声音。</p>
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
                  <p className="rp-desc">Top 10 高频回访 —— 这些是{rangeLabel}真正住进你耳畔的故事。</p>
                </div>
                <div className="works-list">
                  {stats.workRanking.map((w, i) => (
                    <div className="work-row" key={w.id}>
                      <div className="work-rank">{i + 1}</div>
                      <div className="work-cover-wrap">
                        {w.cover ? (
                          <img src={w.cover} alt="" className="work-cover" />
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
}

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

function EmptyState({ range }) {
  return (
    <div className="empty-state">
      <div className="empty-emoji">🌙</div>
      <div className="empty-title">{range}还没有聆听记录</div>
      <div className="empty-desc">
        在「我的库」或「发现」中播放一段声音，<br />
        让聆听被记录下来，回到这里就能看到你的专属数据。
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
        <div className="ranking-empty">暂无数据</div>
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

  // 年度显示全部12个月，月度显示约每2天，日度显示每2小时
  const labelStep = range === 'year'
    ? 1
    : Math.max(1, Math.ceil(timeline.length / 16))

  return (
    <svg className="timeline-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c96442" />
          <stop offset="100%" stopColor="#e0c9a8" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* grid lines */}
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
      {/* bars */}
      {timeline.map((t, i) => {
        const h = max > 0 ? (t.seconds / max) * plotH : 0
        const x = padL + i * (barW + barGap)
        const y = padT + plotH - h
        const isActive = t.seconds > 0
        const showLabel = i % labelStep === 0 || i === timeline.length - 1
        return (
          <g key={i}>
            <rect
              x={x}
              y={isActive ? y : padT + plotH - 2}
              width={barW}
              height={isActive ? h : 2}
              rx="3"
              fill={isActive ? 'url(#tlGrad)' : 'rgba(201,100,66,0.15)'}
            />
            {showLabel && (
              <text
                x={x + barW / 2}
                y={H - padB + 18}
                textAnchor="middle"
                fontSize={range === 'year' ? 11 : 10}
                fill="#b09d8a"
                fontWeight="600"
              >
                {t.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
