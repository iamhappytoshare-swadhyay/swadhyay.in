import { useState, useEffect, useMemo, useCallback } from 'react'
import Icon from './Icon.jsx'
import { WORKER_API_URL } from '../config/constants.js'

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function NcertExplorer({
  t,
  onOpenFile,
  onTrackDownload,
}) {
  const [currentPrefix, setCurrentPrefix] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [treeData, setTreeData] = useState({
    folders: [],
    files: [],
    breadcrumbs: [],
  })
  const [searchQuery, setSearchQuery] = useState('')

  const fetchTree = useCallback(async (prefix = '') => {
    setLoading(true)
    setError(null)
    try {
      const url = `${WORKER_API_URL}/api/public/ncert/tree?prefix=${encodeURIComponent(prefix)}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`R2 NCERT सर्वर से डेटा प्राप्त नहीं हो सका (${res.status})`)
      }
      const data = await res.json()
      if (!data.ok) {
        throw new Error(data.error || 'अज्ञात त्रुटि')
      }
      setTreeData({
        folders: Array.isArray(data.folders) ? data.folders : [],
        files: Array.isArray(data.files) ? data.files : [],
        breadcrumbs: Array.isArray(data.breadcrumbs) ? data.breadcrumbs : [],
      })
    } catch (err) {
      console.error('[NcertExplorer] Fetch error:', err)
      setError(err.message || 'सामग्री लोड करने में असमर्थ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTree(currentPrefix)
  }, [currentPrefix, fetchTree])

  const filteredFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return treeData.folders
    return treeData.folders.filter((f) => f.name.toLowerCase().includes(q))
  }, [treeData.folders, searchQuery])

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return treeData.files
    return treeData.files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.title && f.title.toLowerCase().includes(q)) ||
        (f.subject && f.subject.toLowerCase().includes(q)),
    )
  }, [treeData.files, searchQuery])

  // Get parent prefix for "Up/Back" button
  const parentPrefix = useMemo(() => {
    if (!currentPrefix) return null
    const parts = currentPrefix.replace(/\/+$/, '').split('/')
    if (parts.length <= 1) return ''
    parts.pop()
    return `${parts.join('/')}/`
  }, [currentPrefix])

  return (
    <section className="panel ncert-explorer-panel" style={{ padding: '20px 24px', marginBottom: 24 }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(2, 132, 199, 0.12)',
                color: '#0284c7',
              }}
            >
              <Icon name="cloud" size={22} />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>
                NCERT Books &amp; Study Material
              </h2>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Cloudflare R2 &apos;ncert&apos; बकेट से लाइव कनेक्टेड फोल्डर व ओरिजिनल PDF
              </span>
            </div>
          </div>
        </div>

        {/* Quick Search & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 220 }}>
            <input
              type="search"
              placeholder="खोजें (फ़ोल्डर / फ़ाइल)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--input-bg)',
                fontSize: '0.86rem',
                outline: 'none',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              <Icon name="search" size={15} />
            </span>
          </div>

          <button
            type="button"
            className="text-button"
            title="रिफ्रेश करें"
            onClick={() => fetchTree(currentPrefix)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.86rem',
              cursor: 'pointer',
              background: 'var(--card-bg, #fff)',
            }}
          >
            <Icon name="refresh" size={15} />
            <span>रिफ्रेश</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation Bar */}
      <nav
        aria-label="R2 Folder Breadcrumbs"
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          padding: '8px 12px',
          background: 'var(--input-bg, #f8fafc)',
          borderRadius: 8,
          border: '1px solid var(--border, #e2e8f0)',
          marginBottom: 18,
          fontSize: '0.88rem',
        }}
      >
        <button
          type="button"
          onClick={() => setCurrentPrefix('')}
          style={{
            background: 'none',
            border: 'none',
            color: currentPrefix === '' ? 'var(--text-primary, #0f172a)' : '#0284c7',
            fontWeight: currentPrefix === '' ? 700 : 500,
            cursor: currentPrefix === '' ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 4px',
          }}
        >
          <Icon name="folder" size={16} />
          <span>NCERT Home</span>
        </button>

        {treeData.breadcrumbs.map((crumb, idx) => {
          const isLast = idx === treeData.breadcrumbs.length - 1
          return (
            <span key={crumb.prefix} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <button
                type="button"
                onClick={() => setCurrentPrefix(crumb.prefix)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isLast ? 'var(--text-primary, #0f172a)' : '#0284c7',
                  fontWeight: isLast ? 700 : 500,
                  cursor: isLast ? 'default' : 'pointer',
                  padding: '2px 4px',
                  textDecoration: isLast ? 'none' : 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                {crumb.name}
              </button>
            </span>
          )
        })}

        {parentPrefix !== null && (
          <button
            type="button"
            onClick={() => setCurrentPrefix(parentPrefix)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#0284c7',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon name="arrowUp" size={14} />
            <span>ऊपर जाएं (Back)</span>
          </button>
        )}
      </nav>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '1.1rem', marginBottom: 8 }}>Cloudflare R2 बकेट लोड हो रहा है…</div>
          <span style={{ fontSize: '0.85rem' }}>कृपया प्रतीक्षा करें</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>त्रुटि:</strong> {error}
          </div>
          <button
            type="button"
            onClick={() => fetchTree(currentPrefix)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #dc2626',
              background: '#dc2626',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.84rem',
            }}
          >
            पुनः प्रयास करें
          </button>
        </div>
      )}

      {/* Content View */}
      {!loading && !error && (
        <>
          {/* Folders Section */}
          {filteredFolders.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 12,
                }}
              >
                फ़ोल्डर्स ({filteredFolders.length})
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 12,
                }}
              >
                {filteredFolders.map((folder) => (
                  <button
                    key={folder.prefix}
                    type="button"
                    onClick={() => {
                      setCurrentPrefix(folder.prefix)
                      setSearchQuery('')
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: '1px solid var(--border, #e2e8f0)',
                      background: 'var(--card-bg, #ffffff)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0284c7'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(2,132,199,0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)'
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'rgba(2, 132, 199, 0.12)',
                        color: '#0284c7',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="folder" size={20} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.94rem',
                          color: 'var(--text-primary, #0f172a)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={folder.name}
                      >
                        {folder.name}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#0284c7' }}>
                        फ़ोल्डर खोलें →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          {filteredFiles.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 12,
                }}
              >
                दस्तावेज़ एवं अध्याय PDF ({filteredFiles.length})
              </div>
              <div className="list">
                {filteredFiles.map((file) => {
                  const directProxyUrl = `${WORKER_API_URL}${file.proxyUrl}`
                  return (
                    <div
                      key={file.key}
                      className="row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                        padding: '12px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 300px' }}>
                        <span className="tone tone-red" style={{ flexShrink: 0 }}>
                          <Icon name="book" size={18} />
                        </span>
                        <div className="row-copy" style={{ minWidth: 0 }}>
                          <span className="row-title" style={{ wordBreak: 'break-word' }}>
                            {file.title || file.name}
                          </span>
                          <span className="row-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {file.classLevel && <span>{file.classLevel}</span>}
                            {file.subject && <span>· {file.subject}</span>}
                            {file.size > 0 && (
                              <span style={{ color: 'var(--text-muted)' }}>
                                · {formatBytes(file.size)}
                              </span>
                            )}
                            <span style={{ color: '#0284c7', fontWeight: 600 }}>☁️ R2</span>
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={(e) => {
                            if (onOpenFile) {
                              onOpenFile(e, {
                                href: directProxyUrl,
                                id: `r2_${file.key}`,
                                type: 'ncert',
                                title: file.title || file.name,
                                category: 'ncert',
                              })
                            } else {
                              window.open(directProxyUrl, '_blank', 'noopener,noreferrer')
                              onTrackDownload?.({
                                id: `r2_${file.key}`,
                                type: 'ncert',
                                title: file.title || file.name,
                                category: 'ncert',
                                url: directProxyUrl,
                              })
                            }
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            fontSize: '0.84rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            cursor: 'pointer',
                          }}
                        >
                          <Icon name="book" size={14} />
                          <span>पढ़ें / देखें</span>
                        </button>

                        <a
                          href={directProxyUrl}
                          download={file.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            onTrackDownload?.({
                              id: `r2_${file.key}`,
                              type: 'ncert',
                              title: file.title || file.name,
                              category: 'ncert',
                              url: directProxyUrl,
                            })
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--card-bg, #fff)',
                            color: 'var(--text-primary)',
                            fontSize: '0.84rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <Icon name="download" size={14} />
                          <span>डाउनलोड</span>
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty folder message */}
          {filteredFolders.length === 0 && filteredFiles.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.96rem' }}>
                {searchQuery
                  ? `&quot;${searchQuery}&quot; से मेल खाता कोई फ़ोल्डर या PDF नहीं मिला।`
                  : 'इस फ़ोल्डर में कोई सामग्री उपलब्ध नहीं है।'}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
