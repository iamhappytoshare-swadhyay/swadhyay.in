import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Folder,
  Grid,
  Image as ImageIcon,
  List,
  RefreshCw,
  Replace,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  ACCEPTED_MEDIA_TYPES,
  deleteMediaFile,
  formatBytes,
  getMediaKind,
  listMediaFiles,
  MEDIA_FOLDERS,
  renameMediaFile,
  replaceMediaFile,
  uploadMediaFile,
} from '../services/mediaService.js'
import { formatDateTime } from '../utils/slugify.js'

function FileTypeIcon({ kind }) {
  if (kind === 'image') return <ImageIcon size={22} />
  if (kind === 'pdf') return <FileText size={22} />
  return <FileSpreadsheet size={22} />
}

async function extractFilesFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return []
  const items = dataTransfer.items
  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const fileEntries = []
    const queue = []

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry()
      if (entry) queue.push(entry)
    }

    while (queue.length > 0) {
      const entry = queue.shift()
      if (entry.isFile) {
        await new Promise((resolve) => {
          entry.file(
            (file) => {
              if (file) {
                const rel = entry.fullPath ? entry.fullPath.replace(/^\/+/, '') : file.name
                try {
                  Object.defineProperty(file, 'webkitRelativePath', {
                    value: rel,
                    configurable: true,
                    writable: true,
                  })
                } catch {
                  file._relativePath = rel
                }
                fileEntries.push(file)
              }
              resolve()
            },
            () => resolve(),
          )
        })
      } else if (entry.isDirectory) {
        const reader = entry.createReader()
        const subEntries = await new Promise((resolve) => {
          const acc = []
          function readBatch() {
            reader.readEntries(
              (batch) => {
                if (!batch || batch.length === 0) {
                  resolve(acc)
                } else {
                  acc.push(...batch)
                  readBatch()
                }
              },
              () => resolve(acc),
            )
          }
          readBatch()
        })
        queue.push(...subEntries)
      }
    }

    if (fileEntries.length > 0) return fileEntries
  }

  return Array.from(dataTransfer.files || [])
}

export default function MediaLibrary({ onSelectMedia, compact = false }) {
  const { user, getIdToken } = useAuth()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [folderFilter, setFolderFilter] = useState('all')
  const [uploadFolder, setUploadFolder] = useState('general')
  const [viewMode, setViewMode] = useState('grid')
  const [dragActive, setDragActive] = useState(false)
  const [uploads, setUploads] = useState([])
  const [copiedId, setCopiedId] = useState('')
  const [previewItem, setPreviewItem] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [editName, setEditName] = useState('')
  const [editFolder, setEditFolder] = useState('general')
  const [replacingItem, setReplacingItem] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorReferences, setErrorReferences] = useState([])

  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const replaceInputRef = useRef(null)

  useEffect(() => {
    let active = true
    listMediaFiles()
      .then((list) => {
        if (active) setFiles(list)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function refreshFiles() {
    setLoading(true)
    try {
      const list = await listMediaFiles()
      setFiles(list)
    } finally {
      setLoading(false)
    }
  }

  async function handleFilesUpload(fileList) {
    const items = Array.from(fileList || [])
    if (!items.length) return

    setStatusMessage('')
    setErrorReferences([])

    let idToken
    try {
      idToken = await getIdToken()
    } catch {
      setStatusMessage('Unable to read Firebase authentication token.')
      return
    }

    const queueItems = items.map((file, idx) => {
      const rel = file.webkitRelativePath || file._relativePath || ''
      const parts = rel ? rel.split('/').filter(Boolean) : []
      let itemFolder = uploadFolder || 'general'
      if (parts.length > 1) {
        const subPath = parts.slice(0, -1).join('/')
        itemFolder =
          uploadFolder && uploadFolder !== 'general' ? `${uploadFolder}/${subPath}` : subPath
      }

      return {
        queueId: `${Date.now()}-${idx}`,
        name: file.name,
        relPath: rel || file.name,
        targetFolder: itemFolder,
        size: file.size,
        progress: 0,
        status: 'uploading',
        error: '',
      }
    })
    setUploads((prev) => [...queueItems, ...prev])

    let successfulCount = 0
    await Promise.all(
      items.map(async (file, idx) => {
        const qItem = queueItems[idx]
        const qId = qItem.queueId
        try {
          await uploadMediaFile({
            file,
            folder: qItem.targetFolder,
            idToken,
            user,
            onProgress: (percent) => {
              setUploads((prev) =>
                prev.map((u) => (u.queueId === qId ? { ...u, progress: percent } : u)),
              )
            },
          })
          successfulCount++
          setUploads((prev) =>
            prev.map((u) => (u.queueId === qId ? { ...u, progress: 100, status: 'done' } : u)),
          )
        } catch (error) {
          setUploads((prev) =>
            prev.map((u) =>
              u.queueId === qId
                ? { ...u, status: 'error', error: error?.message || 'Upload failed' }
                : u,
            ),
          )
        }
      }),
    )

    if (successfulCount > 0) {
      setStatusMessage(`सफलतापूर्वक ${successfulCount} फ़ाइलें Cloudflare R2 पर अपलोड हो गईं।`)
    }
    await refreshFiles()
  }

  async function handleReplaceChosen(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !replacingItem) return

    setStatusMessage('')
    setErrorReferences([])
    try {
      const idToken = await getIdToken()
      await replaceMediaFile({ mediaItem: replacingItem, file, idToken })
      setStatusMessage(`Replaced "${replacingItem.name}" at ${replacingItem.objectKey}.`)
      setReplacingItem(null)
      await refreshFiles()
    } catch (error) {
      setStatusMessage(error?.message || 'Failed to replace file.')
    }
  }

  async function handleRenameSubmit(event) {
    event.preventDefault()
    if (!editingItem || !editName.trim()) return
    await renameMediaFile({ id: editingItem.id, name: editName, folder: editFolder })
    setEditingItem(null)
    setStatusMessage('Media metadata updated.')
    await refreshFiles()
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}" from Cloudflare R2 and Firestore?`)) return
    setStatusMessage('')
    setErrorReferences([])
    try {
      const idToken = await getIdToken()
      await deleteMediaFile({ mediaItem: item, idToken })
      setStatusMessage(`Deleted "${item.name}".`)
      await refreshFiles()
    } catch (error) {
      setStatusMessage(error?.message || 'Failed to delete file.')
      if (Array.isArray(error?.references)) {
        setErrorReferences(error.references)
      }
    }
  }

  async function handleCopyUrl(item) {
    try {
      await navigator.clipboard.writeText(item.url)
      setCopiedId(item.id)
      window.setTimeout(() => setCopiedId(''), 1800)
    } catch {
      setStatusMessage(item.url)
    }
  }

  const folders = useMemo(() => {
    const set = new Set(MEDIA_FOLDERS)
    for (const f of files) {
      if (f.folder) set.add(f.folder)
    }
    return [...set]
  }, [files])

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return files.filter((item) => {
      const kind = item.kind || getMediaKind(item.mimeType, item.name)
      if (typeFilter !== 'all' && kind !== typeFilter) return false
      if (folderFilter !== 'all' && (item.folder || 'general') !== folderFilter) return false
      if (q) {
        const hay = `${item.name || ''} ${item.objectKey || ''} ${item.folder || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [files, typeFilter, folderFilter, searchQuery])

  return (
    <>
      {!compact ? (
        <section className="admin-page-head">
          <div>
            <h1>Media Library (Cloudflare R2)</h1>
            <p>
              Upload, organize, preview, replace, and manage PDFs, images, and documents stored on
              Cloudflare R2 via the secure Worker API.
            </p>
          </div>
          <div className="admin-quick-actions">
            <button type="button" className="admin-pill-link" onClick={refreshFiles} disabled={loading}>
              <RefreshCw size={15} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="admin-pill-link"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={15} />
              <span>Upload Files</span>
            </button>
            <button
              type="button"
              className="admin-pill-link is-primary"
              onClick={() => folderInputRef.current?.click()}
              title="पूरा फोल्डर एक साथ Cloudflare R2 पर अपलोड करें"
            >
              <Folder size={15} />
              <span>Upload Folder</span>
            </button>
          </div>
        </section>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_MEDIA_TYPES}
        style={{ display: 'none' }}
        onChange={(event) => {
          handleFilesUpload(event.target.files)
          event.target.value = ''
        }}
      />

      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={(event) => {
          handleFilesUpload(event.target.files)
          event.target.value = ''
        }}
      />

      <input
        ref={replaceInputRef}
        type="file"
        accept={ACCEPTED_MEDIA_TYPES}
        style={{ display: 'none' }}
        onChange={handleReplaceChosen}
      />

      {statusMessage ? (
        <div className="admin-alert" role="status">
          <div>{statusMessage}</div>
          {errorReferences.length > 0 ? (
            <ul style={{ margin: '8px 0 0 18px', fontWeight: 500 }}>
              {errorReferences.map((ref) => (
                <li key={`${ref.type}-${ref.id}`}>
                  {ref.type}: <strong>{ref.title}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <section
        className={dragActive ? 'media-dropzone is-active' : 'media-dropzone'}
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={async (event) => {
          event.preventDefault()
          setDragActive(false)
          const extractedFiles = await extractFilesFromDataTransfer(event.dataTransfer)
          handleFilesUpload(extractedFiles)
        }}
      >
        <UploadCloud size={28} />
        <div>
          <strong>Drag &amp; drop files or entire folders here</strong> or{' '}
          <button
            type="button"
            className="media-browse-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            browse files
          </button>{' '}
          or{' '}
          <button
            type="button"
            className="media-browse-btn"
            onClick={() => folderInputRef.current?.click()}
          >
            browse folder
          </button>
          <p className="cms-subtext">
            Supports PDF, JPG, PNG, WebP, DOCX, XLSX, PPTX (folder structures will be preserved)
          </p>
        </div>
        <div className="media-folder-select">
          <label htmlFor="media-upload-folder">Target Base Folder:</label>
          <select
            id="media-upload-folder"
            className="rte-select"
            value={uploadFolder}
            onChange={(event) => setUploadFolder(event.target.value)}
          >
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
        </div>
      </section>

      {uploads.length > 0 ? (
        <section className="admin-card">
          <div className="cms-card-head">
            <h2>Upload Progress ({uploads.length})</h2>
            <button type="button" className="admin-pill-link" onClick={() => setUploads([])}>
              Clear
            </button>
          </div>
          <div className="media-upload-list">
            {uploads.map((u) => (
              <div key={u.queueId} className="media-upload-row">
                <div className="media-upload-meta">
                  <strong>{u.relPath || u.name}</strong>
                  <span>
                    {u.targetFolder ? `[📁 ${u.targetFolder}] ` : ''}
                    {formatBytes(u.size)}
                  </span>
                </div>
                {u.status === 'error' ? (
                  <p className="cms-subtext" style={{ color: 'var(--accent-text)' }}>
                    {u.error}
                  </p>
                ) : (
                  <div className="meter">
                    <div className="meter-fill" style={{ width: `${u.progress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="admin-card">
        <div className="cms-toolbar-bar">
          <div className="cms-status-tabs">
            {[
              ['all', 'All Types'],
              ['image', 'Images'],
              ['pdf', 'PDFs'],
              ['document', 'Documents'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={typeFilter === key ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                onClick={() => setTypeFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="cms-filter-group">
            <select
              className="rte-select"
              aria-label="Filter by folder"
              value={folderFilter}
              onChange={(event) => setFolderFilter(event.target.value)}
            >
              <option value="all">All Folders</option>
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  Folder: {folder}
                </option>
              ))}
            </select>

            <label className="admin-search">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search media…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="rte-mode-tabs">
              <button
                type="button"
                className={viewMode === 'grid' ? 'rte-mode-btn is-active' : 'rte-mode-btn'}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <Grid size={14} />
              </button>
              <button
                type="button"
                className={viewMode === 'list' ? 'rte-mode-btn is-active' : 'rte-mode-btn'}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {filteredFiles.length === 0 ? (
          <p className="cms-muted">
            {loading
              ? 'Loading media files…'
              : 'No media files match the current filter. Upload files above to store them on Cloudflare R2.'}
          </p>
        ) : viewMode === 'grid' ? (
          <div className="media-grid">
            {filteredFiles.map((item) => {
              const kind = item.kind || getMediaKind(item.mimeType, item.name)
              return (
                <article key={item.id} className="media-card">
                  <div className="media-thumb-box">
                    {kind === 'image' ? (
                      <img src={item.url} alt={item.name} loading="lazy" />
                    ) : (
                      <div className="media-file-placeholder">
                        <FileTypeIcon kind={kind} />
                        <span>{kind.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="media-card-body">
                    <strong className="media-card-title" title={item.name}>
                      {item.name}
                    </strong>
                    <div className="cms-subtext">
                      <Folder size={12} style={{ verticalAlign: 'middle' }} /> {item.folder || 'general'} ·{' '}
                      {formatBytes(item.size)}
                    </div>
                    <div className="cms-subtext">{formatDateTime(item.createdAt)}</div>
                  </div>
                  <div className="media-card-actions">
                    {onSelectMedia ? (
                      <button
                        type="button"
                        className="admin-pill-link is-primary"
                        onClick={() => onSelectMedia(item)}
                      >
                        Select
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => setPreviewItem(item)}
                      title="Preview"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => handleCopyUrl(item)}
                      title="Copy URL"
                    >
                      {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => {
                        setEditingItem(item)
                        setEditName(item.name || '')
                        setEditFolder(item.folder || 'general')
                      }}
                      title="Rename / Move"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => {
                        setReplacingItem(item)
                        replaceInputRef.current?.click()
                      }}
                      title="Replace file"
                    >
                      <Replace size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => handleDelete(item)}
                      title="Delete file"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Folder</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <div className="cms-subtext">{item.objectKey}</div>
                    </td>
                    <td>{item.folder || 'general'}</td>
                    <td>{formatBytes(item.size)}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>
                      <div className="cms-row-actions">
                        {onSelectMedia ? (
                          <button
                            type="button"
                            className="admin-pill-link is-primary"
                            onClick={() => onSelectMedia(item)}
                          >
                            Select
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => setPreviewItem(item)}
                          title="Preview"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => handleCopyUrl(item)}
                          title="Copy URL"
                        >
                          {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
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

      {editingItem ? (
        <div className="media-modal-backdrop" role="dialog" aria-modal="true">
          <form className="media-modal-card" onSubmit={handleRenameSubmit}>
            <div className="cms-card-head">
              <h2>Rename / Move Media</h2>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => setEditingItem(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="cms-form">
              <div className="cms-field">
                <label htmlFor="media-edit-name">Display Name</label>
                <input
                  id="media-edit-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </div>
              <div className="cms-field">
                <label htmlFor="media-edit-folder">Folder</label>
                <input
                  id="media-edit-folder"
                  type="text"
                  value={editFolder}
                  onChange={(event) => setEditFolder(event.target.value)}
                />
              </div>
              <div className="cms-form-actions">
                <button type="submit" className="admin-pill-link is-primary">
                  Save Changes
                </button>
                <button
                  type="button"
                  className="admin-pill-link"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {previewItem ? (
        <div className="media-modal-backdrop" role="dialog" aria-modal="true">
          <div className="media-modal-card is-wide">
            <div className="cms-card-head">
              <h2>{previewItem.name}</h2>
              <div className="cms-row-actions">
                <a
                  href={previewItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-pill-link"
                >
                  <ExternalLink size={14} />
                  <span>Open Original</span>
                </a>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => setPreviewItem(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="media-preview-stage">
              {(previewItem.kind || getMediaKind(previewItem.mimeType, previewItem.name)) ===
              'image' ? (
                <img src={previewItem.url} alt={previewItem.name} />
              ) : (previewItem.kind || getMediaKind(previewItem.mimeType, previewItem.name)) ===
                'pdf' ? (
                <iframe src={previewItem.url} title={previewItem.name} />
              ) : (
                <p className="cms-muted">
                  Preview is unavailable for this document format. Use &ldquo;Open Original&rdquo;
                  above to download or view it.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
