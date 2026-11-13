import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Edit3, ExternalLink, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { deletePyqItem, listPyqItems, savePyqItem } from '../services/eduService.js'
import MediaUrlField from './components/MediaUrlField.jsx'

const EXAMS = ['KVS', 'NVS', 'EMRS', 'UPESSC', 'CTET', 'UGC NET', 'SSC', 'UPSC', 'Other']

const EMPTY_FORM = {
  title: '',
  examName: 'KVS',
  year: String(new Date().getFullYear()),
  subject: 'Geography',
  classOrPost: 'PGT / TGT',
  language: 'both',
  questionPaperUrl: '',
  answerKeyUrl: '',
  solutionUrl: '',
  notes: '',
  status: 'published',
}

export default function PyqManager() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [examFilter, setExamFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listPyqItems()
      setItems(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    listPyqItems()
      .then((list) => {
        if (active) setItems(list)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (examFilter !== 'all' && item.examName !== examFilter) return false
      if (!q) return true
      return `${item.title || ''} ${item.examName || ''} ${item.year || ''} ${item.subject || ''} ${item.classOrPost || ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [items, examFilter, search])

  function startNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setNotice('')
  }

  function startEdit(item) {
    setEditing(item)
    setForm({
      title: item.title || '',
      examName: item.examName || 'KVS',
      year: item.year || '',
      subject: item.subject || '',
      classOrPost: item.classOrPost || '',
      language: item.language || 'both',
      questionPaperUrl: item.questionPaperUrl || '',
      answerKeyUrl: item.answerKeyUrl || '',
      solutionUrl: item.solutionUrl || '',
      notes: item.notes || '',
      status: item.status === 'draft' ? 'draft' : 'published',
    })
    setNotice('')
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    try {
      await savePyqItem({ id: editing?.id || null, data: form, user })
      await reload()
      startNew()
      setNotice('Previous Year Paper saved.')
    } catch (err) {
      setNotice(err?.message || 'Unable to save PYQ entry.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete PYQ "${item.title}"?`)) return
    setSaving(true)
    try {
      await deletePyqItem(item.id)
      await reload()
      if (editing?.id === item.id) startNew()
      setNotice('PYQ entry deleted.')
    } catch (err) {
      setNotice(err?.message || 'Delete failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="admin-page-head">
        <div>
          <h1>PYQ / Previous Year Questions</h1>
          <p>
            Manage exam papers, official answer keys, and detailed solutions with direct Cloudflare
            R2 PDF attachments.
          </p>
        </div>
        <div className="admin-quick-actions">
          <button type="button" className="admin-pill-link" onClick={reload} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button type="button" className="admin-pill-link is-primary" onClick={startNew}>
            <Plus size={15} />
            <span>New PYQ Paper</span>
          </button>
        </div>
      </section>

      {notice ? <div className="admin-alert">{notice}</div> : null}

      <div className="cms-split-grid">
        <form className="admin-card cms-side-card" onSubmit={handleSave}>
          <h2>{editing ? 'Edit PYQ Paper' : 'Add PYQ Paper'}</h2>
          <div className="cms-field">
            <label htmlFor="pyq-title">Paper Title</label>
            <input
              id="pyq-title"
              type="text"
              placeholder="e.g. KVS PGT Geography 2023 Solved Paper"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="pyq-exam">Exam Name</label>
              <select
                id="pyq-exam"
                value={form.examName}
                onChange={(e) => setForm((p) => ({ ...p, examName: e.target.value }))}
              >
                {EXAMS.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            </div>
            <div className="cms-field">
              <label htmlFor="pyq-year">Year</label>
              <input
                id="pyq-year"
                type="text"
                placeholder="2024"
                value={form.year}
                onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
              />
            </div>
          </div>
          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="pyq-subject">Subject</label>
              <input
                id="pyq-subject"
                type="text"
                placeholder="Geography / History / GK"
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div className="cms-field">
              <label htmlFor="pyq-post">Class / Post</label>
              <input
                id="pyq-post"
                type="text"
                placeholder="PGT / TGT / Paper 1"
                value={form.classOrPost}
                onChange={(e) => setForm((p) => ({ ...p, classOrPost: e.target.value }))}
              />
            </div>
          </div>

          <MediaUrlField
            id="pyq-paper-url"
            label="Question Paper PDF URL"
            value={form.questionPaperUrl}
            onChange={(url) => setForm((p) => ({ ...p, questionPaperUrl: url }))}
          />
          <MediaUrlField
            id="pyq-key-url"
            label="Answer Key PDF URL"
            value={form.answerKeyUrl}
            onChange={(url) => setForm((p) => ({ ...p, answerKeyUrl: url }))}
          />
          <MediaUrlField
            id="pyq-solution-url"
            label="Solutions PDF / Explanation URL"
            value={form.solutionUrl}
            onChange={(url) => setForm((p) => ({ ...p, solutionUrl: url }))}
          />

          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="pyq-lang">Language</label>
              <select
                id="pyq-lang"
                value={form.language}
                onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
              >
                <option value="both">Bilingual</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
            <div className="cms-field">
              <label htmlFor="pyq-status">Status</label>
              <select
                id="pyq-status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="cms-editor-actions">
            {editing ? (
              <button type="button" className="admin-pill-link" onClick={startNew}>
                Cancel Edit
              </button>
            ) : null}
            <button type="submit" className="admin-pill-link is-primary" disabled={saving}>
              <Save size={15} />
              <span>{saving ? 'Saving…' : editing ? 'Update PYQ' : 'Save PYQ'}</span>
            </button>
          </div>
        </form>

        <section className="admin-card">
          <div className="cms-toolbar" style={{ marginBottom: '12px' }}>
            <div className="cms-search-box">
              <input
                type="search"
                placeholder="Search exam, year, subject…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="cms-select"
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
            >
              <option value="all">All Exams</option>
              {EXAMS.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="admin-empty">Loading PYQ archive…</p>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">
              <ClipboardList size={26} />
              <p>No PYQ papers found for this filter.</p>
            </div>
          ) : (
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Exam · Year</th>
                    <th>Files</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.title}</strong>
                        <span className="cms-sub-line">
                          {item.subject || 'General'} · {item.classOrPost || 'All'}
                        </span>
                      </td>
                      <td>
                        {item.examName} ({item.year || '—'})
                      </td>
                      <td>
                        <div className="cms-row-actions">
                          {item.questionPaperUrl ? (
                            <a
                              href={item.questionPaperUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cms-chip-btn"
                            >
                              Paper <ExternalLink size={11} />
                            </a>
                          ) : null}
                          {item.answerKeyUrl ? (
                            <a
                              href={item.answerKeyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cms-chip-btn"
                            >
                              Key <ExternalLink size={11} />
                            </a>
                          ) : null}
                          {item.solutionUrl ? (
                            <a
                              href={item.solutionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cms-chip-btn"
                            >
                              Sol <ExternalLink size={11} />
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`cms-status-badge ${
                            item.status === 'draft' ? 'is-draft' : 'is-published'
                          }`}
                        >
                          {item.status || 'published'}
                        </span>
                      </td>
                      <td>
                        <div className="cms-row-actions">
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => startEdit(item)}
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn is-danger"
                            onClick={() => handleDelete(item)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
