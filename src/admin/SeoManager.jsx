import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ExternalLink,
  FileCode2,
  Globe,
  RefreshCw,
  SearchCheck,
  X,
} from 'lucide-react'
import { WORKER_API_URL } from '../config/constants.js'
import { useAuth } from '../context/AuthContext.jsx'
import { listPages, listPosts } from '../services/cmsService.js'
import {
  DEFAULT_GLOBAL_SEO,
  DEFAULT_ROBOTS_TXT,
  getGlobalSeoSettings,
  getRobotsTxtSettings,
  saveGlobalSeoSettings,
  savePostSeo,
  saveRobotsTxtSettings,
  validateRobotsTxt,
} from '../services/seoService.js'

export default function SeoManager() {
  const { user, role } = useAuth()
  const [activeTab, setActiveTab] = useState('global') // 'global' | 'posts' | 'sitemap' | 'robots' | 'audit'
  const [globalSeo, setGlobalSeo] = useState(DEFAULT_GLOBAL_SEO)
  const [robotsTxt, setRobotsTxt] = useState(DEFAULT_ROBOTS_TXT)
  const [posts, setPosts] = useState([])
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState(null)

  const [selectedPostId, setSelectedPostId] = useState('')
  const [postSeo, setPostSeo] = useState({
    seoTitle: '',
    metaDescription: '',
    focusKeyword: '',
    canonicalUrl: '',
    ogTitle: '',
    ogDescription: '',
    socialImage: '',
    robotsIndex: true,
    robotsFollow: true,
  })

  const loadAll = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const [g, r, pList, pgList] = await Promise.all([
        getGlobalSeoSettings(),
        getRobotsTxtSettings(),
        listPosts().catch(() => []),
        listPages().catch(() => []),
      ])
      setGlobalSeo(g)
      setRobotsTxt(r)
      setPosts(pList)
      setPages(pgList)
      if (pList.length && !selectedPostId) {
        setSelectedPostId(pList[0].id)
      }
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to load SEO settings.' })
    } finally {
      setLoading(false)
    }
  }, [selectedPostId])

  useEffect(() => {
    const id = setTimeout(() => {
      void loadAll()
    }, 0)
    return () => clearTimeout(id)
  }, [loadAll])

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) || null,
    [posts, selectedPostId],
  )

  useEffect(() => {
    if (!selectedPost) return undefined
    const id = setTimeout(() => {
      setPostSeo({
        seoTitle: selectedPost.seoTitle || selectedPost.title || '',
        metaDescription: selectedPost.metaDescription || selectedPost.shortDescription || '',
        focusKeyword: selectedPost.focusKeyword || '',
        canonicalUrl:
          selectedPost.canonicalUrl || `https://swadhyay.in/#/post/${selectedPost.slug || ''}`,
        ogTitle: selectedPost.ogTitle || selectedPost.seoTitle || selectedPost.title || '',
        ogDescription:
          selectedPost.ogDescription ||
          selectedPost.metaDescription ||
          selectedPost.shortDescription ||
          '',
        socialImage: selectedPost.socialImage || selectedPost.featuredImage || '',
        robotsIndex: selectedPost.robotsIndex !== false,
        robotsFollow: selectedPost.robotsFollow !== false,
      })
    }, 0)
    return () => clearTimeout(id)
  }, [selectedPost])

  const sitemapPreview = useMemo(() => {
    const base = globalSeo.canonicalUrl || 'https://swadhyay.in'
    const urls = [
      `${base}/#/home`,
      `${base}/#/ncert`,
      `${base}/#/pyq`,
      ...posts
        .filter((p) => p.status === 'published' && p.robotsIndex !== false && p.slug)
        .map((p) => p.canonicalUrl || `${base}/#/post/${p.slug}`),
      ...pages
        .filter((p) => p.status === 'published' && p.robotsIndex !== false && p.slug)
        .map((p) => p.canonicalUrl || `${base}/#/page/${p.slug}`),
    ]
    return urls
  }, [posts, pages, globalSeo.canonicalUrl])

  const auditReport = useMemo(() => {
    const published = posts.filter((p) => p.status === 'published')
    const missingTitle = published.filter((p) => !(p.seoTitle || '').trim())
    const missingDesc = published.filter((p) => !(p.metaDescription || '').trim())

    const canonicalCounts = new Map()
    published.forEach((p) => {
      const c = (p.canonicalUrl || '').trim()
      if (!c) return
      canonicalCounts.set(c, [...(canonicalCounts.get(c) || []), p])
    })
    const duplicateCanonicals = Array.from(canonicalCounts.entries()).filter(
      ([, list]) => list.length > 1,
    )

    return {
      totalPublished: published.length,
      missingTitle,
      missingDesc,
      duplicateCanonicals,
    }
  }, [posts])

  const robotsWarning = useMemo(() => validateRobotsTxt(robotsTxt), [robotsTxt])

  async function handleSaveGlobal(event) {
    event.preventDefault()
    setSaving(true)
    setBanner(null)
    try {
      await saveGlobalSeoSettings(globalSeo, { ...user, role })
      setBanner({ type: 'success', text: 'Global SEO settings saved.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePostSeo(event) {
    event.preventDefault()
    if (!selectedPost) return
    setSaving(true)
    setBanner(null)
    try {
      await savePostSeo(selectedPost.id, postSeo, { ...user, role })
      setPosts((prev) =>
        prev.map((p) => (p.id === selectedPost.id ? { ...p, ...postSeo } : p)),
      )
      setBanner({ type: 'success', text: `SEO updated for "${selectedPost.title}".` })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to update post SEO.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveRobots(event) {
    event.preventDefault()
    if (robotsWarning) {
      setBanner({ type: 'error', text: robotsWarning })
      return
    }
    setSaving(true)
    setBanner(null)
    try {
      await saveRobotsTxtSettings(robotsTxt, { ...user, role })
      setBanner({ type: 'success', text: 'robots.txt published.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to save robots.txt.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="seo-manager">
      <section className="admin-page-head">
        <div>
          <h1>SEO Manager</h1>
          <p>
            Configure Swadhyay.in metadata, post-level SEO, dynamic sitemap.xml, robots.txt,
            and SEO health audits.
          </p>
        </div>
        <div className="cms-head-left">
          <div className="cms-filter-group" role="tablist">
            {[
              ['global', 'Global SEO'],
              ['posts', 'Post SEO'],
              ['sitemap', 'Sitemap'],
              ['robots', 'Robots.txt'],
              ['audit', 'SEO Audit'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="admin-btn-secondary" onClick={loadAll}>
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {banner ? (
        <div
          className={banner.type === 'error' ? 'admin-alert' : 'admin-alert cmt-alert-success'}
          role="status"
        >
          <span>{banner.text}</span>
          <button
            type="button"
            className="cmt-alert-close"
            onClick={() => setBanner(null)}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {activeTab === 'global' ? (
        <section className="admin-card">
          <form className="cms-form" onSubmit={handleSaveGlobal}>
            <div className="cms-field-row">
              <div className="cms-field">
                <label>Website SEO Title ({globalSeo.siteTitle.length}/60)</label>
                <input
                  value={globalSeo.siteTitle}
                  onChange={(e) => setGlobalSeo((p) => ({ ...p, siteTitle: e.target.value }))}
                />
              </div>
              <div className="cms-field">
                <label>Canonical Base URL</label>
                <input
                  value={globalSeo.canonicalUrl}
                  onChange={(e) =>
                    setGlobalSeo((p) => ({ ...p, canonicalUrl: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="cms-field">
              <label>
                Website Meta Description ({globalSeo.metaDescription.length}/160)
              </label>
              <textarea
                rows={2}
                value={globalSeo.metaDescription}
                onChange={(e) =>
                  setGlobalSeo((p) => ({ ...p, metaDescription: e.target.value }))
                }
              />
            </div>

            <div className="cms-field-row">
              <div className="cms-field">
                <label>Default Meta Keywords (Optional)</label>
                <input
                  value={globalSeo.metaKeywords}
                  onChange={(e) =>
                    setGlobalSeo((p) => ({ ...p, metaKeywords: e.target.value }))
                  }
                />
              </div>
              <div className="cms-field">
                <label>Default Robots Directive</label>
                <select
                  value={globalSeo.defaultRobots}
                  onChange={(e) =>
                    setGlobalSeo((p) => ({ ...p, defaultRobots: e.target.value }))
                  }
                >
                  <option value="index, follow">index, follow</option>
                  <option value="noindex, follow">noindex, follow</option>
                  <option value="index, nofollow">index, nofollow</option>
                  <option value="noindex, nofollow">noindex, nofollow</option>
                </select>
              </div>
            </div>

            <div className="cms-field-row">
              <div className="cms-field">
                <label>Default Open Graph Image URL</label>
                <input
                  value={globalSeo.ogImage}
                  onChange={(e) => setGlobalSeo((p) => ({ ...p, ogImage: e.target.value }))}
                  placeholder="https://notes.swadhyay.in/og-cover.png"
                />
              </div>
              <div className="cms-field">
                <label>Twitter / X Handle</label>
                <input
                  value={globalSeo.twitterHandle}
                  onChange={(e) =>
                    setGlobalSeo((p) => ({ ...p, twitterHandle: e.target.value }))
                  }
                  placeholder="@swadhyay_in"
                />
              </div>
            </div>

            <div className="cms-field-row">
              <div className="cms-field">
                <label>Google Search Console Verification Code</label>
                <input
                  value={globalSeo.gscVerificationCode}
                  onChange={(e) =>
                    setGlobalSeo((p) => ({ ...p, gscVerificationCode: e.target.value }))
                  }
                  placeholder="google-site-verification token"
                />
              </div>
              <div className="cms-field">
                <label>Google Analytics 4 Measurement ID</label>
                <input
                  value={globalSeo.ga4MeasurementId}
                  onChange={(e) =>
                    setGlobalSeo((p) => ({ ...p, ga4MeasurementId: e.target.value }))
                  }
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
            </div>

            <button type="submit" className="admin-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Global SEO Settings'}
            </button>
          </form>
        </section>
      ) : activeTab === 'posts' ? (
        <div className="cmt-settings-grid">
          <section className="admin-card">
            <div className="cms-field" style={{ marginBottom: 12 }}>
              <label>Select Article / Post</label>
              <select
                value={selectedPostId}
                onChange={(e) => setSelectedPostId(e.target.value)}
              >
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.status || 'draft'})
                  </option>
                ))}
              </select>
            </div>

            {selectedPost ? (
              <form className="cms-form" onSubmit={handleSavePostSeo}>
                <div className="cms-field">
                  <label>
                    SEO Title ({postSeo.seoTitle.length}/60 chars)
                  </label>
                  <input
                    value={postSeo.seoTitle}
                    onChange={(e) => setPostSeo((p) => ({ ...p, seoTitle: e.target.value }))}
                  />
                </div>
                <div className="cms-field">
                  <label>
                    Meta Description ({postSeo.metaDescription.length}/160 chars)
                  </label>
                  <textarea
                    rows={2}
                    value={postSeo.metaDescription}
                    onChange={(e) =>
                      setPostSeo((p) => ({ ...p, metaDescription: e.target.value }))
                    }
                  />
                </div>
                <div className="cms-field-row">
                  <div className="cms-field">
                    <label>Focus Keyword</label>
                    <input
                      value={postSeo.focusKeyword}
                      onChange={(e) =>
                        setPostSeo((p) => ({ ...p, focusKeyword: e.target.value }))
                      }
                    />
                  </div>
                  <div className="cms-field">
                    <label>Canonical URL</label>
                    <input
                      value={postSeo.canonicalUrl}
                      onChange={(e) =>
                        setPostSeo((p) => ({ ...p, canonicalUrl: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="cms-field-row">
                  <div className="cms-field">
                    <label>Open Graph Title</label>
                    <input
                      value={postSeo.ogTitle}
                      onChange={(e) => setPostSeo((p) => ({ ...p, ogTitle: e.target.value }))}
                    />
                  </div>
                  <div className="cms-field">
                    <label>Open Graph Image URL</label>
                    <input
                      value={postSeo.socialImage}
                      onChange={(e) =>
                        setPostSeo((p) => ({ ...p, socialImage: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="cms-field">
                  <label>Open Graph Description</label>
                  <textarea
                    rows={2}
                    value={postSeo.ogDescription}
                    onChange={(e) =>
                      setPostSeo((p) => ({ ...p, ogDescription: e.target.value }))
                    }
                  />
                </div>
                <div className="cms-field-row">
                  <label className="cms-checkbox">
                    <input
                      type="checkbox"
                      checked={postSeo.robotsIndex}
                      onChange={(e) =>
                        setPostSeo((p) => ({ ...p, robotsIndex: e.target.checked }))
                      }
                    />
                    <span>Robots: Index (include in sitemap)</span>
                  </label>
                  <label className="cms-checkbox">
                    <input
                      type="checkbox"
                      checked={postSeo.robotsFollow}
                      onChange={(e) =>
                        setPostSeo((p) => ({ ...p, robotsFollow: e.target.checked }))
                      }
                    />
                    <span>Robots: Follow links</span>
                  </label>
                </div>
                <button type="submit" className="admin-btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Post SEO'}
                </button>
              </form>
            ) : (
              <p className="cms-muted">Create a post first to configure post SEO.</p>
            )}
          </section>

          <section className="admin-card">
            <h2>Live Google SERP Preview</h2>
            <div className="seo-serp-preview">
              <div className="seo-serp-url">
                <Globe size={13} /> {postSeo.canonicalUrl || 'https://swadhyay.in'}
              </div>
              <div className="seo-serp-title">
                {postSeo.seoTitle || 'Untitled Swadhyay Article'}
              </div>
              <div className="seo-serp-desc">
                {postSeo.metaDescription ||
                  'Add a concise meta description (120–160 characters) to improve click-through rate.'}
              </div>
            </div>
          </section>
        </div>
      ) : activeTab === 'sitemap' ? (
        <section className="admin-card">
          <div className="cms-card-head">
            <div>
              <h2>XML Sitemap ({sitemapPreview.length} Public URLs)</h2>
              <p className="cms-muted">
                Automatically includes published posts and pages while excluding drafts and
                noindex items.
              </p>
            </div>
            <a
              href={`${WORKER_API_URL}/sitemap.xml`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn-primary"
            >
              <ExternalLink size={15} />
              <span>Open sitemap.xml</span>
            </a>
          </div>
          <div className="seo-sitemap-list">
            {sitemapPreview.map((url) => (
              <div key={url} className="seo-sitemap-row">
                <FileCode2 size={14} />
                <span>{url}</span>
              </div>
            ))}
          </div>
          <div className="cmt-policy-lock" style={{ marginTop: 14 }}>
            <SearchCheck size={16} />
            <span>
              <strong>Google Search Console:</strong> Submit{' '}
              <code>{WORKER_API_URL}/sitemap.xml</code> (or route{' '}
              <code>https://swadhyay.in/sitemap.xml</code> via Cloudflare Worker route).
            </span>
          </div>
        </section>
      ) : activeTab === 'robots' ? (
        <section className="admin-card">
          <form className="cms-form" onSubmit={handleSaveRobots}>
            <div className="cms-card-head">
              <div>
                <h2>Robots.txt Editor</h2>
                <p className="cms-muted">
                  Live endpoint: <code>{WORKER_API_URL}/robots.txt</code>
                </p>
              </div>
              <button
                type="button"
                className="admin-btn-secondary"
                onClick={() => setRobotsTxt(DEFAULT_ROBOTS_TXT)}
              >
                Restore Default
              </button>
            </div>

            {robotsWarning ? (
              <div className="admin-alert" role="alert">
                <AlertTriangle size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />
                {robotsWarning}
              </div>
            ) : null}

            <textarea
              rows={8}
              value={robotsTxt}
              onChange={(e) => setRobotsTxt(e.target.value)}
              style={{ fontFamily: 'monospace', padding: 12, borderRadius: 10 }}
            />
            <div className="cms-form-actions">
              <button
                type="submit"
                className="admin-btn-primary"
                disabled={saving || Boolean(robotsWarning)}
              >
                {saving ? 'Publishing…' : 'Publish robots.txt'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="admin-card">
          <h2>SEO Health Audit ({auditReport.totalPublished} Published Posts)</h2>
          <div className="cmt-stats-grid" style={{ marginTop: 12 }}>
            <div className="cmt-stat-card">
              <strong className="cmt-stat-value">{auditReport.missingTitle.length}</strong>
              <span className="cmt-stat-label">Missing SEO Title</span>
            </div>
            <div className="cmt-stat-card">
              <strong className="cmt-stat-value">{auditReport.missingDesc.length}</strong>
              <span className="cmt-stat-label">Missing Meta Description</span>
            </div>
            <div className="cmt-stat-card">
              <strong className="cmt-stat-value">
                {auditReport.duplicateCanonicals.length}
              </strong>
              <span className="cmt-stat-label">Duplicate Canonicals</span>
            </div>
          </div>

          {auditReport.missingDesc.length > 0 ? (
            <>
              <h3>Posts Missing Meta Description</h3>
              <ul className="seo-audit-list">
                {auditReport.missingDesc.map((p) => (
                  <li key={p.id}>
                    <span>{p.title}</span>
                    <button
                      type="button"
                      className="cmt-inline-link"
                      onClick={() => {
                        setSelectedPostId(p.id)
                        setActiveTab('posts')
                      }}
                    >
                      Fix SEO
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="cms-muted">All published posts have meta descriptions.</p>
          )}
        </section>
      )}
    </div>
  )
}
