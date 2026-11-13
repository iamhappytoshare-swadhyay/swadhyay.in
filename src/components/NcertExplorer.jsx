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

const FOLDER_PALETTE = [
  '#dc2626', // Red (Class 6)
  '#ea580c', // Orange (Class 7)
  '#d97706', // Yellow / Gold (Class 8)
  '#16a34a', // Green (Class 9)
  '#2563eb', // Blue (Class 10)
  '#4f46e5', // Indigo (Class 11)
  '#7c3aed', // Purple (Class 12)
  '#0d9488', // Teal
  '#db2777', // Pink
  '#0284c7', // Sky
]

function getFolderColor(name, index) {
  const clean = String(name || '').toLowerCase()
  if (clean.includes('6')) return FOLDER_PALETTE[0]
  if (clean.includes('7')) return FOLDER_PALETTE[1]
  if (clean.includes('8')) return FOLDER_PALETTE[2]
  if (clean.includes('9')) return FOLDER_PALETTE[3]
  if (clean.includes('10')) return FOLDER_PALETTE[4]
  if (clean.includes('11')) return FOLDER_PALETTE[5]
  if (clean.includes('12')) return FOLDER_PALETTE[6]
  return FOLDER_PALETTE[index % FOLDER_PALETTE.length]
}

export default function NcertExplorer({ onOpenFile, onTrackDownload }) {
  const [currentPrefix, setCurrentPrefix] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [treeData, setTreeData] = useState({
    folders: [],
    files: [],
    breadcrumbs: [],
  })

  const fetchTree = useCallback(async (prefix = '') => {
    setLoading(true)
    setError(null)
    try {
      const url = `${WORKER_API_URL}/api/public/ncert/tree?prefix=${encodeURIComponent(prefix)}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`सर्वर से डेटा लोड नहीं हो सका (${res.status})`)
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

  // Get parent prefix for "Back" navigation
  const parentPrefix = useMemo(() => {
    if (!currentPrefix) return null
    const parts = currentPrefix.replace(/\/+$/, '').split('/')
    if (parts.length <= 1) return ''
    parts.pop()
    return `${parts.join('/')}/`
  }, [currentPrefix])

  // Current folder title
  const currentTitle = useMemo(() => {
    if (!currentPrefix) return 'NCERT Books'
    const parts = currentPrefix.replace(/\/+$/, '').split('/')
    return parts[parts.length - 1] || 'NCERT Books'
  }, [currentPrefix])

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '8px 0 32px' }}>
      {/* Clean Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {currentPrefix ? (
            <button
              type="button"
              onClick={() => setCurrentPrefix(parentPrefix !== null ? parentPrefix : '')}
              aria-label="पीछे जाएं"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: '50%',
                color: '#1e293b',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          ) : null}

          <h1
            style={{
              margin: 0,
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#1e1b4b',
              letterSpacing: '-0.3px',
              wordBreak: 'break-word',
            }}
          >
            {currentTitle}
          </h1>
        </div>

        {/* Refresh Icon Button */}
        <button
          type="button"
          onClick={() => fetchTree(currentPrefix)}
          title="रिफ्रेश करें"
          aria-label="रिफ्रेश करें"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            borderRadius: '50%',
            color: '#1e1b4b',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
            e.currentTarget.style.transform = 'rotate(45deg)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.transform = 'none'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
          </svg>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
            लोड हो रहा है…
          </div>
          <span style={{ fontSize: '0.88rem' }}>कृपया प्रतीक्षा करें</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 14,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <strong>त्रुटि:</strong> {error}
          </div>
          <button
            type="button"
            onClick={() => fetchTree(currentPrefix)}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            पुनः प्रयास करें
          </button>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && (
        <div>
          {/* Folders List (Exact banner style from reference image) */}
          {treeData.folders.map((folder, idx) => {
            const cardBg = getFolderColor(folder.name, idx)
            const countText =
              typeof folder.fileCount === 'number' && folder.fileCount > 0
                ? `${folder.fileCount} फाइलें • खोलें`
                : 'खोलें'

            return (
              <div
                key={folder.prefix}
                onClick={() => setCurrentPrefix(folder.prefix)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setCurrentPrefix(folder.prefix)
                  }
                }}
                style={{
                  background: cardBg,
                  borderRadius: 18,
                  padding: '18px 24px',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.16)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
                }}
              >
                {/* Left: Folder Icon + Title & Subtitle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {/* Bold Solid Folder SVG */}
                    <svg
                      width="38"
                      height="38"
                      viewBox="0 0 24 24"
                      fill="#ffffff"
                      stroke="#ffffff"
                      strokeWidth="0.5"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 700,
                        lineHeight: 1.25,
                        letterSpacing: '-0.2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={folder.name}
                    >
                      {folder.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.92rem',
                        color: 'rgba(255, 255, 255, 0.92)',
                        marginTop: 4,
                        fontWeight: 500,
                      }}
                    >
                      {countText}
                    </div>
                  </div>
                </div>

                {/* Right: Chevron Arrow */}
                <div style={{ flexShrink: 0, paddingLeft: 12 }}>
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            )
          })}

          {/* Files List (When inside a folder that has PDFs) */}
          {treeData.files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {treeData.files.map((file) => {
                const directProxyUrl = `${WORKER_API_URL}${file.proxyUrl}`
                return (
                  <div
                    key={file.key}
                    style={{
                      background: 'var(--card-bg, #ffffff)',
                      borderRadius: 14,
                      padding: '14px 18px',
                      border: '1px solid var(--border, #e2e8f0)',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    {/* Left: PDF Icon + Title & File Size */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 280px', minWidth: 0 }}>
                      <span
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: '#fef2f2',
                          color: '#dc2626',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="file" size={20} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '1rem',
                            color: 'var(--text-primary, #0f172a)',
                            lineHeight: 1.35,
                            wordBreak: 'break-word',
                          }}
                        >
                          {file.title || file.name}
                        </div>
                        {file.size > 0 && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                            {formatBytes(file.size)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
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
                          padding: '7px 16px',
                          borderRadius: 8,
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        पढ़ें
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
                          padding: '7px 14px',
                          borderRadius: 8,
                          border: '1px solid var(--border, #cbd5e1)',
                          background: 'var(--input-bg, #f8fafc)',
                          color: 'var(--text-primary, #1e293b)',
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        डाउनलोड
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty Folder Message */}
          {treeData.folders.length === 0 && treeData.files.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>
                इस फ़ोल्डर में कोई सामग्री उपलब्ध नहीं है।
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
