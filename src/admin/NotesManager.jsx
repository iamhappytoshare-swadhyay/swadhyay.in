import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, ExternalLink, NotebookPen, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { deleteNote, listNotes, saveNote } from '../services/eduService.js'
import MediaUrlField from './components/MediaUrlField.jsx'

const EMPTY_FORM = {
  title: '',
  description: '',
  subject: 'Geography',
  classLevel: '',
  examName: 'KVS / EMRS',
  category: 'geography',
  fileUrl: '',
  thumbnailUrl: '',
  language: 'en',
  status: 'published',
}

export default function NotesManager() {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [langFilter, setLangFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [notice, setNotice] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listNotes()
      setNotes(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    listNotes()
      .then((list) => {
        if (active) setNotes(list)
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
    const matched = notes.filter((n) => {
      if (statusFilter !== 'all' && (n.status || 'published') !== statusFilter) return false
      if (langFilter !== 'all' && (n.language || 'en') !== langFilter) return false
      if (!q) return true
      return `${n.title || ''} ${n.subject || ''} ${n.examName || ''} ${n.classLevel || ''} ${n.category || ''}`
        .toLowerCase()
        .includes(q)
    })
    if (sortBy === 'title') {
      return [...matched].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }
    return matched
  }, [notes, search, statusFilter, langFilter, sortBy])

  function startNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setNotice('')
  }

  function startEdit(item) {
    setEditing(item)
    setForm({
      title: item.title || '',
      description: item.description || '',
      subject: item.subject || '',
      classLevel: item.classLevel || item.class || '',
      examName: item.examName || item.exam || '',
      category: item.category || '',
      fileUrl: item.fileUrl || item.pdfUrl || item.url || '',
      thumbnailUrl: item.thumbnailUrl || item.thumbnail || '',
      language: item.language || 'en',
      status: item.status === 'draft' ? 'draft' : 'published',
    })
    setNotice('')
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!form.title.trim()) {
      setNotice('Please provide a title for the study note.')
      return
    }
    setSaving(true)
    setNotice('')
    try {
      await saveNote({ id: editing?.id || null, data: form, user })
      await reload()
      startNew()
      setNotice('Study note saved to Firestore.')
    } catch (err) {
      setNotice(err?.message || 'Unable to save study note.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete study note "${item.title}"?`)) return
    setSaving(true)
    try {
      await deleteNote(item.id)
      await reload()
      if (editing?.id === item.id) startNew()
      setNotice('Study note deleted.')
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
          <h1>Notes &amp; Study Materials</h1>
          <p>
            Publish downloadable PDF notes, lecture handouts, and thumbnails stored in Cloudflare R2.
          </p>
        </div>
        <div className="admin-quick-actions">
          <button type="button" className="admin-pill-link" onClick={reload} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button type="button" className="admin-pill-link is-primary" onClick={startNew}>
            <Plus size={15} />
            <span>New Study Note</span>
          </button>
        </div>
      </section>

      {notice ? <div className="admin-alert">{notice}</div> : null}

      <div className="cms-split-grid">
        <form className="admin-card cms-side-card" onSubmit={handleSave}>
          <h2>{editing ? 'Edit Study Note' : 'Publish Study Note'}</h2>
          <div className="cms-field">
            <label htmlFor="note-title">Title</label>
            <input
              id="note-title"
              type="text"
              required
              placeholder="e.g. Indian Monsoon Complete Handwritten Notes"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="cms-field">
            <label htmlFor="note-desc">Description</label>
            <textarea
              id="note-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="note-subject">Subject</label>
              <input
                id="note-subject"
                type="text"
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div className="cms-field">
              <label htmlFor="note-class">Class</label>
              <input
                id="note-class"
                type="text"
                placeholder="Class 11 / UG / All"
                value={form.classLevel}
                onChange={(e) => setForm((p) => ({ ...p, classLevel: e.target.value }))}
              />
            </div>
          </div>
          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="note-exam">Exam</label>
              <input
                id="note-exam"
                type="text"
                placeholder="KVS, NVS, EMRS"
                value={form.examName}
                onChange={(e) => setForm((p) => ({ ...p, examName: e.target.value }))}
              />
            </div>
            <div className="cms-field">
              <label htmlFor="note-cat">Category Slug</label>
              <input
                id="note-cat"
                type="text"
                placeholder="geography / history / gk"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
          </div>

          <MediaUrlField
            id="note-file-url"
            label="Material File URL (PDF / Document)"
            value={form.fileUrl}
            onChange={(url) => setForm((p) => ({ ...p, fileUrl: url }))}
          />
          <MediaUrlField
            id="note-thumb-url"
            label="Thumbnail Image URL"
            value={form.thumbnailUrl}
            onChange={(url) => setForm((p) => ({ ...p, thumbnailUrl: url }))}
          />

          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="note-lang">Language</label>
              <select
                id="note-lang"
                value={form.language}
                onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="both">Bilingual</option>
              </select>
            </div>
            <div className="cms-field">
              <label htmlFor="note-status">Status</label>
              <select
                id="note-status"
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
              <span>{saving ? 'Saving…' : editing ? 'Update Note' : 'Save Note'}</span>
            </button>
          </div>
        </form>

        <section className="admin-card">
          <div className="cms-toolbar" style={{ marginBottom: '12px' }}>
            <div className="cms-search-box">
              <input
                type="search"
                placeholder="Filter by title, subject, exam…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="cms-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <select
              className="cms-select"
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
            >
              <option value="all">All Languages</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="both">Bilingual</option>
            </select>
            <select
              className="cms-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="recent">Sort: Recent</option>
              <option value="title">Sort: Title A-Z</option>
            </select>
          </div>

          {loading ? (
            <p className="admin-empty">Loading notes…</p>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">
              <NotebookPen size={26} />
              <p>No study notes match your filter.</p>
            </div>
          ) : (
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Subject · Exam</th>
                    <th>Lang</th>
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
                          {item.category || 'general'}
                          {item.classLevel ? ` · ${item.classLevel}` : ''}
                        </span>
                      </td>
                      <td>
                        {item.subject || '—'} · {item.examName || 'All'}
                      </td>
                      <td>{(item.language || 'en').toUpperCase()}</td>
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
                          {item.fileUrl || item.pdfUrl || item.url ? (
                            <a
                              href={item.fileUrl || item.pdfUrl || item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="admin-icon-btn"
                              title="Open study file"
                            >
                              <ExternalLink size={14} />
                            </a>
                          ) : null}
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
