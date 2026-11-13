import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Cloud,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Folder,
  FolderSync,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  deleteNcrtFromR2,
  deleteNcertItem,
  listNcertItems,
  listR2NcrtFiles,
  saveNcertItem,
  syncR2NcrtWithFirestore,
  uploadNcrtToR2,
} from '../services/eduService.js'
import { formatBytes } from '../services/mediaService.js'
import MediaUrlField from './components/MediaUrlField.jsx'

const EMPTY_FORM = {
  title: '',
  classLevel: 'Class 12',
  subject: 'Geography',
  book: '',
  chapter: '',
  language: 'en',
  contentType: 'PDF',
  fileUrl: '',
  r2Key: '',
  size: 0,
  description: '',
  status: 'published',
  targetCollection: 'ncert_content',
}

const CLASSES = [
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
]

export default function NcertManager() {
  const { user, getIdToken } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [langFilter, setLangFilter] = useState('all')
  const [r2Filter, setR2Filter] = useState('all')
  const [notice, setNotice] = useState('')

  // R2 Bucket Explorer State
  const [viewMode, setViewMode] = useState('catalog') // 'catalog' | 'r2_bucket'
  const [r2Files, setR2Files] = useState([])
  const [r2Loading, setR2Loading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingToR2, setUploadingToR2] = useState(false)
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listNcertItems()
      setItems(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadR2BucketFiles = useCallback(async () => {
    setR2Loading(true)
    try {
      const files = await listR2NcrtFiles()
      setR2Files(files)
    } catch (err) {
      console.warn('Failed to load R2 ncrt bucket files:', err)
    } finally {
      setR2Loading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    listNcertItems()
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

  useEffect(() => {
    if (viewMode === 'r2_bucket') {
      void loadR2BucketFiles()
    }
  }, [viewMode, loadR2BucketFiles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (classFilter !== 'all' && item.classLevel !== classFilter) return false
      if (langFilter !== 'all' && item.language !== langFilter) return false
      if (r2Filter === 'r2_only' && !item.r2Key && !String(item.fileUrl || '').includes('r2'))
        return false
      if (!q) return true
      return `${item.title || ''} ${item.subject || ''} ${item.book || ''} ${item.chapter || ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [items, search, classFilter, langFilter, r2Filter])

  function startNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setNotice('')
  }

  function startEdit(item) {
    setEditing(item)
    setForm({
      title: item.title || '',
      classLevel: item.classLevel || item.class || 'Class 12',
      subject: item.subject || '',
      book: item.book || '',
      chapter: item.chapter || '',
      language: item.language || 'en',
      contentType: item.contentType || 'PDF',
      fileUrl: item.fileUrl || item.url || item.pdfUrl || '',
      r2Key: item.r2Key || '',
      size: item.size || 0,
      description: item.description || '',
      status: item.status === 'draft' ? 'draft' : 'published',
      targetCollection: item._collection === 'ncert_books' ? 'ncert_books' : 'ncert_content',
    })
    setNotice('')
    setViewMode('catalog')
  }

  async function handleR2Sync() {
    setSyncing(true)
    setNotice('')
    try {
      const res = await syncR2NcrtWithFirestore(user)
      await reload()
      await loadR2BucketFiles()
      setNotice(
        `Cloudflare R2 'ncrt' बकेट से सफलतापूर्वक सिंक किया गया! (R2 में कुल फ़ाइलें: ${res.totalR2}, नई जुड़ीं: ${res.added}, अपडेट: ${res.updated})`,
      )
    } catch (err) {
      setNotice(err?.message || 'Cloudflare R2 से सिंक करने में त्रुटि आई। कृपया Worker API जांचें।')
    } finally {
      setSyncing(false)
    }
  }

  async function handleDirectR2Upload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingToR2(true)
    setUploadProgress(0)
    setNotice('')

    try {
      const idToken = typeof getIdToken === 'function' ? await getIdToken() : null
      if (!idToken) throw new Error('कृपया पहले लॉगिन करें।')

      const uploaded = await uploadNcrtToR2({
        file,
        classLevel: form.classLevel,
        subject: form.subject,
        idToken,
        onProgress: setUploadProgress,
      })

      setForm((prev) => ({
        ...prev,
        title: prev.title.trim() ? prev.title : uploaded.title || uploaded.name,
        classLevel: uploaded.classLevel || prev.classLevel,
        subject: uploaded.subject || prev.subject,
        chapter: uploaded.chapter || prev.chapter,
        fileUrl: uploaded.url,
        r2Key: uploaded.key,
        size: uploaded.size,
        contentType: 'PDF',
      }))
      setNotice(`फ़ाइल सफलतापूर्वक Cloudflare R2 'ncrt' बकेट में अपलोड हो गई: ${uploaded.name}`)
    } catch (err) {
      setNotice(err?.message || 'Cloudflare R2 ncrt बकेट पर अपलोड विफल रहा।')
    } finally {
      setUploadingToR2(false)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleFolderR2Upload(event) {
    const rawFiles = Array.from(event.target.files || [])
    if (!rawFiles.length) return

    // Filter valid document / book files
    const validFiles = rawFiles.filter((f) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)
    })

    if (!validFiles.length) {
      setNotice('चयनित फोल्डर में कोई मान्य PDF या डॉक्यूमेंट फ़ाइल नहीं मिली।')
      if (folderInputRef.current) folderInputRef.current.value = ''
      return
    }

    setUploadingToR2(true)
    setNotice(`NCERT फोल्डर अपलोडिंग प्रारंभ: कुल ${validFiles.length} फ़ाइलें…`)

    try {
      const idToken = typeof getIdToken === 'function' ? await getIdToken() : null
      if (!idToken) throw new Error('कृपया पहले लॉगिन करें।')

      let uploadedCount = 0
      let failedCount = 0

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        const relPath = file.webkitRelativePath || file.name
        setUploadProgress(Math.round(((i + 1) / validFiles.length) * 100))
        setNotice(`NCERT फोल्डर अपलोड हो रहा है (${i + 1}/${validFiles.length}): ${file.name}…`)

        try {
          const uploaded = await uploadNcrtToR2({
            file,
            classLevel: form.classLevel,
            subject: form.subject,
            relativePath: relPath,
            idToken,
          })

          // Automatically sync / save this file into Firestore ncert_content
          await saveNcertItem({
            id: null,
            targetCollection: 'ncert_content',
            data: {
              title: uploaded.title || file.name.replace(/\.[^/.]+$/, ''),
              classLevel: uploaded.classLevel || form.classLevel || 'Class 12',
              subject: uploaded.subject || form.subject || 'Geography',
              chapter: uploaded.chapter || '',
              book: form.book || '',
              language: form.language || 'en',
              contentType: 'PDF',
              fileUrl: uploaded.url,
              r2Key: uploaded.key,
              size: uploaded.size || file.size,
              status: 'published',
              syncedAt: new Date().toISOString(),
            },
            user,
          })

          uploadedCount++
        } catch (itemErr) {
          console.error(`Failed to upload ${file.name}:`, itemErr)
          failedCount++
        }
      }

      await reload()
      await loadR2BucketFiles()

      setNotice(
        `NCERT फोल्डर अपलोड पूर्ण! कुल ${uploadedCount} फ़ाइलें Cloudflare R2 'ncrt' बकेट में अपलोड हुईं और वेबसाइट पर सिंक हो गईं।${
          failedCount > 0 ? ` (${failedCount} असफल)` : ''
        }`,
      )
    } catch (err) {
      setNotice(err?.message || 'NCERT फोल्डर अपलोड करने में त्रुटि आई।')
    } finally {
      setUploadingToR2(false)
      setUploadProgress(0)
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  async function handleImportR2File(r2File) {
    setSaving(true)
    setNotice('')
    try {
      await saveNcertItem({
        id: null,
        targetCollection: 'ncert_content',
        data: {
          title: r2File.title || r2File.filename || 'NCERT Resource',
          classLevel: r2File.classLevel || 'Class 12',
          subject: r2File.subject || 'Geography',
          chapter: r2File.chapter || '',
          book: r2File.book || '',
          language: r2File.language || 'en',
          contentType: 'PDF',
          fileUrl: r2File.url,
          r2Key: r2File.key,
          size: r2File.size || 0,
          status: 'published',
        },
        user,
      })
      await reload()
      setNotice(`"${r2File.filename}" सफलतापूर्वक एडमिन व वेबसाइट दोनों पर लिंक हो गया!`)
    } catch (err) {
      setNotice(err?.message || 'इम्पोर्ट विफल रहा।')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!form.title.trim()) {
      setNotice('Please enter a title for the NCERT resource.')
      return
    }
    setSaving(true)
    setNotice('')
    try {
      await saveNcertItem({
        id: editing?.id || null,
        targetCollection: form.targetCollection,
        data: form,
        user,
      })
      await reload()
      startNew()
      setNotice('NCERT resource saved and synced to website!')
    } catch (err) {
      setNotice(err?.message || 'Unable to save NCERT item.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    const hasR2 = Boolean(item.r2Key)
    const msg = hasR2
      ? `Delete NCERT resource "${item.title}"? \n(Also delete the linked file from Cloudflare R2 ncrt bucket?)`
      : `Delete NCERT resource "${item.title}"?`
    if (!window.confirm(msg)) return

    setSaving(true)
    try {
      await deleteNcertItem(item.id, item._collection)
      if (item.r2Key) {
        await deleteNcrtFromR2(item.r2Key).catch(() => {})
      }
      await reload()
      if (editing?.id === item.id) startNew()
      setNotice('NCERT item deleted from Firestore and R2.')
    } catch (err) {
      setNotice(err?.message || 'Delete failed.')
    } finally {
      setSaving(false)
    }
  }

  const r2KeySet = useMemo(() => {
    const keys = new Set()
    items.forEach((it) => {
      if (it.r2Key) keys.add(it.r2Key)
      if (it.fileUrl) keys.add(it.fileUrl)
    })
    return keys
  }, [items])

  return (
    <>
      <section className="admin-page-head">
        <div>
          <h1>NCERT Content Manager</h1>
          <p>
            Cloudflare R2 <code>ncrt</code> बकेट, एडमिन कंसोल एवं पब्लिक वेबसाइट (
            <code>#/ncert</code>) के बीच 100% लिंक्ड एवं लाइव डेटा सिंक।
          </p>
        </div>
        <div className="admin-quick-actions">
          <button
            type="button"
            className="admin-pill-link"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent-text)' }}
            onClick={handleR2Sync}
            disabled={syncing || loading}
            title="Scan Cloudflare R2 'ncrt' bucket and sync all files with Firestore & Website"
          >
            <FolderSync size={15} />
            <span>{syncing ? 'Syncing R2 ncrt…' : 'Sync R2 (ncrt बकेट)'}</span>
          </button>
          <button type="button" className="admin-pill-link" onClick={reload} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button type="button" className="admin-pill-link is-primary" onClick={startNew}>
            <Plus size={15} />
            <span>New NCERT Entry</span>
          </button>
        </div>
      </section>

      {notice ? <div className="admin-alert">{notice}</div> : null}

      {/* Sync Status Banner */}
      <div
        className="admin-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          marginBottom: 16,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Cloud size={20} style={{ color: '#0284c7' }} />
          <div>
            <strong>Cloudflare R2 ncrt Sync Engine</strong>
            <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              कुल प्रकाशित सामग्री: {items.length} · R2 सिंक स्थिति: सक्रिय
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`admin-pill-link ${viewMode === 'catalog' ? 'is-primary' : ''}`}
            onClick={() => setViewMode('catalog')}
          >
            <BookOpen size={14} />
            <span>Catalog ({items.length})</span>
          </button>
          <button
            type="button"
            className={`admin-pill-link ${viewMode === 'r2_bucket' ? 'is-primary' : ''}`}
            onClick={() => {
              setViewMode('r2_bucket')
              void loadR2BucketFiles()
            }}
          >
            <Cloud size={14} />
            <span>R2 Bucket Explorer {r2Files.length > 0 ? `(${r2Files.length})` : ''}</span>
          </button>
        </div>
      </div>

      <div className="cms-split-grid">
        <form className="admin-card cms-side-card" onSubmit={handleSave}>
          <h2>{editing ? 'Edit NCERT Resource' : 'Add NCERT Resource'}</h2>

          {/* Direct R2 Upload Box */}
          <div
            style={{
              padding: '14px',
              borderRadius: 12,
              background: 'var(--accent-soft)',
              border: '1.5px dashed var(--card-hover-border)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <UploadCloud size={24} style={{ color: 'var(--accent)' }} />
            <div>
              <strong style={{ fontSize: '0.9rem', display: 'block' }}>
                Cloudflare R2 (ncrt बकेट) में डायरेक्ट अपलोड करें
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                PDF फ़ाइल चुनते ही वह सीधे ncrt बकेट में स्टोर हो जाएगी
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx"
              style={{ display: 'none' }}
              onChange={handleDirectR2Upload}
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              accept=".pdf,.docx,.xlsx"
              style={{ display: 'none' }}
              onChange={handleFolderR2Upload}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                className="admin-pill-link"
                disabled={uploadingToR2}
                onClick={() => fileInputRef.current?.click()}
                title="सिंगल PDF फ़ाइल अपलोड करें"
              >
                <UploadCloud size={14} />
                <span>Upload PDF</span>
              </button>
              <button
                type="button"
                className="admin-pill-link is-primary"
                disabled={uploadingToR2}
                onClick={() => folderInputRef.current?.click()}
                title="पूरा NCERT फोल्डर (अध्यायों की PDF) एक साथ R2 में अपलोड करें"
              >
                <Folder size={14} />
                <span>Upload NCERT Folder</span>
              </button>
            </div>
            {uploadingToR2 ? (
              <div
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${uploadProgress}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="cms-field">
            <label htmlFor="ncert-title">Title</label>
            <input
              id="ncert-title"
              type="text"
              required
              placeholder="e.g. Ch. 1: Resources and Development"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="ncert-class">Class</label>
              <select
                id="ncert-class"
                value={form.classLevel}
                onChange={(e) => setForm((p) => ({ ...p, classLevel: e.target.value }))}
              >
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="cms-field">
              <label htmlFor="ncert-subject">Subject</label>
              <input
                id="ncert-subject"
                type="text"
                placeholder="Geography / History / Polity"
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              />
            </div>
          </div>

          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="ncert-book">Book Name</label>
              <input
                id="ncert-book"
                type="text"
                placeholder="Fundamentals of Human Geography"
                value={form.book}
                onChange={(e) => setForm((p) => ({ ...p, book: e.target.value }))}
              />
            </div>
            <div className="cms-field">
              <label htmlFor="ncert-chapter">Chapter</label>
              <input
                id="ncert-chapter"
                type="text"
                placeholder="Chapter 1"
                value={form.chapter}
                onChange={(e) => setForm((p) => ({ ...p, chapter: e.target.value }))}
              />
            </div>
          </div>

          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="ncert-lang">Language</label>
              <select
                id="ncert-lang"
                value={form.language}
                onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="both">Bilingual</option>
              </select>
            </div>
            <div className="cms-field">
              <label htmlFor="ncert-type">Content Type</label>
              <select
                id="ncert-type"
                value={form.contentType}
                onChange={(e) => setForm((p) => ({ ...p, contentType: e.target.value }))}
              >
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="XLSX">XLSX</option>
                <option value="Notes">Chapter Notes</option>
              </select>
            </div>
          </div>

          <MediaUrlField
            id="ncert-file-url"
            label="File URL (Cloudflare R2 direct or public URL)"
            value={form.fileUrl}
            onChange={(url) => setForm((p) => ({ ...p, fileUrl: url }))}
          />

          {form.r2Key ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ☁️ <strong>R2 Storage Key:</strong> <code>{form.r2Key}</code>
              {form.size ? ` (${formatBytes(form.size)})` : ''}
            </div>
          ) : null}

          <div className="cms-two-col">
            <div className="cms-field">
              <label htmlFor="ncert-status">Status</label>
              <select
                id="ncert-status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="published">Published (Website पर दिखेगा)</option>
                <option value="draft">Draft (ड्राफ्ट)</option>
              </select>
            </div>
            <div className="cms-field">
              <label htmlFor="ncert-desc">Short Note</label>
              <input
                id="ncert-desc"
                type="text"
                placeholder="Optional summary"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
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
              <span>{saving ? 'Saving…' : editing ? 'Update NCERT' : 'Save & Publish'}</span>
            </button>
          </div>
        </form>

        <section className="admin-card">
          {viewMode === 'catalog' ? (
            <>
              <div className="cms-toolbar" style={{ marginBottom: '12px' }}>
                <div className="cms-search-box">
                  <input
                    type="search"
                    placeholder="Search NCERT title, book, chapter…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="cms-select"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <option value="all">All Classes</option>
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
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
                  value={r2Filter}
                  onChange={(e) => setR2Filter(e.target.value)}
                >
                  <option value="all">All Files</option>
                  <option value="r2_only">☁️ R2 Synced Only</option>
                </select>
              </div>

              {loading ? (
                <p className="admin-empty">Loading NCERT catalog…</p>
              ) : filtered.length === 0 ? (
                <div className="admin-empty">
                  <BookOpen size={26} />
                  <p>No NCERT materials match this filter yet.</p>
                  <button
                    type="button"
                    className="admin-pill-link is-primary"
                    style={{ marginTop: 10 }}
                    onClick={handleR2Sync}
                    disabled={syncing}
                  >
                    <FolderSync size={15} />
                    <span>R2 ncrt बकेट से ऑटो-सिंक करें</span>
                  </button>
                </div>
              ) : (
                <div className="cms-table-wrap">
                  <table className="cms-table">
                    <thead>
                      <tr>
                        <th>Title &amp; Book</th>
                        <th>Class · Subject</th>
                        <th>Type / Storage</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => {
                        const isR2 = Boolean(item.r2Key || String(item.fileUrl || '').includes('r2'))
                        return (
                          <tr key={`${item._collection}-${item.id}`}>
                            <td>
                              <strong>{item.title}</strong>
                              <span className="cms-sub-line">
                                {item.book ? `${item.book}` : item._collection}
                                {item.chapter ? ` · ${item.chapter}` : ''}
                              </span>
                            </td>
                            <td>
                              {item.classLevel || item.class || '—'} · {item.subject || 'General'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <span className="admin-role-pill">
                                  {item.contentType || 'PDF'} · {(item.language || 'en').toUpperCase()}
                                </span>
                                {isR2 ? (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      color: '#0284c7',
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    <Cloud size={11} /> R2 Synced
                                    {item.size ? ` · ${formatBytes(item.size)}` : ''}
                                  </span>
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
                                {item.fileUrl || item.url ? (
                                  <a
                                    href={item.fileUrl || item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="admin-icon-btn"
                                    title="Open file from R2"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  className="admin-icon-btn"
                                  title="Edit"
                                  onClick={() => startEdit(item)}
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="admin-icon-btn is-danger"
                                  title="Delete"
                                  onClick={() => handleDelete(item)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              {/* R2 Bucket Explorer View */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Cloudflare R2 'ncrt' Bucket Files</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    R2 स्टोरेज बकेट में मौजूद सभी रॉ फ़ाइलें। किसी भी फ़ाइल को सीधे वेबसाइट से लिंक करें।
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="admin-pill-link"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingToR2}
                  >
                    <UploadCloud size={14} />
                    <span>Upload File</span>
                  </button>
                  <button
                    type="button"
                    className="admin-pill-link is-primary"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={uploadingToR2}
                  >
                    <Folder size={14} />
                    <span>Upload Folder</span>
                  </button>
                  <button
                    type="button"
                    className="admin-pill-link"
                    onClick={loadR2BucketFiles}
                    disabled={r2Loading}
                  >
                    <RefreshCw size={14} />
                    <span>Refresh Bucket</span>
                  </button>
                </div>
              </div>

              {r2Loading ? (
                <p className="admin-empty">Scanning Cloudflare R2 ncrt bucket…</p>
              ) : r2Files.length === 0 ? (
                <div className="admin-empty">
                  <Cloud size={26} />
                  <p>No files found in R2 'ncrt' bucket yet, or bucket is loading.</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: 10, justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="admin-pill-link"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingToR2}
                    >
                      <UploadCloud size={14} />
                      <span>Upload First PDF</span>
                    </button>
                    <button
                      type="button"
                      className="admin-pill-link is-primary"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={uploadingToR2}
                    >
                      <Folder size={14} />
                      <span>Upload Entire Folder</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cms-table-wrap">
                  <table className="cms-table">
                    <thead>
                      <tr>
                        <th>R2 Key / Filename</th>
                        <th>Detected Class &amp; Subject</th>
                        <th>Size</th>
                        <th>Website Link Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r2Files.map((file) => {
                        const isLinked = r2KeySet.has(file.key) || r2KeySet.has(file.url)
                        return (
                          <tr key={file.key}>
                            <td>
                              <strong>{file.filename || file.key}</strong>
                              <span className="cms-sub-line">{file.key}</span>
                            </td>
                            <td>
                              {file.classLevel} · {file.subject}
                              {file.chapter ? ` · ${file.chapter}` : ''}
                            </td>
                            <td>{formatBytes(file.size)}</td>
                            <td>
                              {isLinked ? (
                                <span className="cms-status-badge is-published">
                                  ✓ Linked to Website
                                </span>
                              ) : (
                                <span className="cms-status-badge is-draft">Unlinked</span>
                              )}
                            </td>
                            <td>
                              <div className="cms-row-actions">
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="admin-icon-btn"
                                  title="View in R2"
                                >
                                  <ExternalLink size={14} />
                                </a>
                                {!isLinked ? (
                                  <button
                                    type="button"
                                    className="admin-pill-link is-primary"
                                    style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                                    onClick={() => handleImportR2File(file)}
                                    disabled={saving}
                                  >
                                    + Link to Site
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}
