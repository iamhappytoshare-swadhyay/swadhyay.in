import { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Download,
  Eye,
  FileDown,
  RefreshCw,
  Users,
} from 'lucide-react'
import { fetchAnalyticsSnapshot } from '../services/analyticsService.js'
import { downloadCsv } from '../utils/csvExport.js'

const PIE_COLORS = ['#0f766e', '#1b4f8a', '#b45309', '#b91c1c', '#6d28d9', '#0284c7']

export default function AnalyticsManager() {
  const [preset, setPreset] = useState('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const snapshot = await fetchAnalyticsSnapshot({ preset, customStart, customEnd })
      setData(snapshot)
    } catch (error) {
      setErrorMsg(error?.message || 'Unable to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [preset, customStart, customEnd])

  useEffect(() => {
    const id = setTimeout(() => {
      void loadAnalytics()
    }, 0)
    return () => clearTimeout(id)
  }, [loadAnalytics])

  function handleExportCsv() {
    if (!data) return
    downloadCsv(
      `swadhyay-analytics-${preset}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Page Views', 'Quiz Attempts', 'PDF Views', 'PDF Downloads'],
      data.dailySeries.map((r) => [
        r.date,
        r.pageViews,
        r.quizAttempts,
        r.pdfViews,
        r.pdfDownloads,
      ]),
    )
  }

  const ov = data?.overview || {}
  const qz = data?.quiz || {}

  return (
    <div className="analytics-manager">
      <section className="admin-page-head">
        <div>
          <h1>Analytics Management</h1>
          <p>
            Actual tracked metrics from Firestore events, quiz results, and user activity
            (no fabricated historical estimates).
          </p>
        </div>

        <div className="cms-head-left">
          <select
            className="cmt-filter-select"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            aria-label="Date range"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>

          {preset === 'custom' ? (
            <>
              <input
                type="date"
                className="cmt-filter-input"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <input
                type="date"
                className="cmt-filter-input"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </>
          ) : null}

          <button type="button" className="admin-btn-secondary" onClick={handleExportCsv}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button type="button" className="admin-btn-secondary" onClick={loadAnalytics}>
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {errorMsg ? (
        <div className="admin-alert" role="alert">
          {errorMsg}
        </div>
      ) : null}

      {/* A. Main Analytics Summary Cards */}
      <section className="cmt-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))' }}>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-total">
            <Users size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Tracked Visitors</span>
            <strong className="cmt-stat-value">{ov.totalVisitors ?? 0}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-published">
            <Eye size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Page Views</span>
            <strong className="cmt-stat-value">{ov.totalPageViews ?? 0}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-total">
            <Users size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">DAU / MAU</span>
            <strong className="cmt-stat-value">
              {ov.dau ?? 0} / {ov.mau ?? 0}
            </strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-pending">
            <ClipboardList size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Quiz Attempts</span>
            <strong className="cmt-stat-value">{ov.totalQuizAttempts ?? 0}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-published">
            <FileDown size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">PDF Views / Downloads</span>
            <strong className="cmt-stat-value">
              {ov.totalPdfViews ?? 0} / {ov.totalPdfDownloads ?? 0}
            </strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-total">
            <BookOpen size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Content Views</span>
            <strong className="cmt-stat-value">{ov.totalContentViews ?? 0}</strong>
          </div>
        </div>
      </section>

      {/* E. Visual Charts */}
      <div className="anl-charts-grid">
        <section className="admin-card">
          <div className="cms-card-head">
            <h2>Daily Activity Trend (Line Chart)</h2>
          </div>
          {!data?.dailySeries?.length ? (
            <p className="cms-muted">No tracked daily events in this date range yet.</p>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={data.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pageViews" name="Page Views" stroke="#1b4f8a" strokeWidth={2} />
                  <Line type="monotone" dataKey="quizAttempts" name="Quiz Attempts" stroke="#0f766e" strokeWidth={2} />
                  <Line type="monotone" dataKey="pdfDownloads" name="PDF Downloads" stroke="#b45309" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="cms-card-head">
            <h2>PDF Views vs. Downloads Comparison</h2>
          </div>
          {!data?.dailySeries?.length ? (
            <p className="cms-muted">No PDF preview or download events recorded yet.</p>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={data.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pdfViews" name="PDF Previews" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pdfDownloads" name="PDF Downloads" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="cms-card-head">
            <div>
              <h2>Quiz Analytics</h2>
              <p className="cms-subtext">
                Unique Participants: {qz.uniqueParticipants ?? 0} · Avg Score: {qz.avgScore ?? 0}%
                · Avg Time: {qz.avgCompletionSec ?? 0}s
              </p>
            </div>
          </div>
          {!qz.mostAttempted?.length ? (
            <p className="cms-muted">No quiz attempts in this period.</p>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={qz.mostAttempted} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis dataKey="name" type="category" width={130} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="attempts" name="Attempts" fill="#b91c1c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="cms-card-head">
            <div>
              <h2>Category Engagement (Pie Chart)</h2>
              <p className="cms-subtext">
                Avg Reading Time: {ov.avgReadingTimeSec ?? 0}s · Comments: {ov.totalComments ?? 0}
              </p>
            </div>
          </div>
          {!data?.categoryEngagement?.length ? (
            <p className="cms-muted">No category engagement events tracked yet.</p>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.categoryEngagement}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    label
                  >
                    {data.categoryEngagement.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* C. Document-wise Download Statistics */}
      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="cms-card-head">
          <h2>
            <BarChart3 size={16} style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Document-wise Views &amp; Downloads
          </h2>
        </div>
        {!data?.documentStats?.length ? (
          <p className="cms-muted">No document preview or download events recorded yet.</p>
        ) : (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Document Title</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Preview Views</th>
                  <th>Actual Downloads</th>
                </tr>
              </thead>
              <tbody>
                {data.documentStats.map((docItem) => (
                  <tr key={docItem.title}>
                    <td>
                      <strong>{docItem.title}</strong>
                    </td>
                    <td>{docItem.className}</td>
                    <td>{docItem.subject}</td>
                    <td>{docItem.views}</td>
                    <td>
                      <strong>{docItem.downloads}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
