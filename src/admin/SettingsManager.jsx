import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Link2,
  Palette,
  Plus,
  RefreshCw,
  Settings,
  Sliders,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  DEFAULT_WEBSITE_SETTINGS,
  getWebsiteSettings,
  saveWebsiteSettings,
} from '../services/settingsService.js'

export default function SettingsManager() {
  const { user, role } = useAuth()
  const [activeTab, setActiveTab] = useState('general') // 'general' | 'branding' | 'links' | 'maintenance' | 'config'
  const [form, setForm] = useState(DEFAULT_WEBSITE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const data = await getWebsiteSettings()
      setForm(data)
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Unable to load website settings.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      void loadSettings()
    }, 0)
    return () => clearTimeout(id)
  }, [loadSettings])

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setBanner(null)
    try {
      await saveWebsiteSettings(form, { ...user, role })
      setBanner({ type: 'success', text: 'Website settings saved successfully.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to save settings.' })
    } finally {
      setSaving(false)
    }
  }

  function addSocialLink() {
    setForm((p) => ({
      ...p,
      socialLinks: [
        ...(p.socialLinks || []),
        { id: `custom-${Date.now()}`, label: 'Custom Link', url: '' },
      ],
    }))
  }

  function updateSocialLink(idx, field, value) {
    setForm((p) => ({
      ...p,
      socialLinks: p.socialLinks.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      ),
    }))
  }

  function removeSocialLink(idx) {
    setForm((p) => ({
      ...p,
      socialLinks: p.socialLinks.filter((_, i) => i !== idx),
    }))
  }

  return (
    <div className="settings-manager">
      <section className="admin-page-head">
        <div>
          <h1>Website Settings</h1>
          <p>
            Configure Swadhyay branding, theme defaults, social links, maintenance mode, and
            site behavior.
          </p>
        </div>
        <div className="cms-head-left">
          <div className="cms-filter-group" role="tablist">
            {[
              ['general', 'General', Settings],
              ['branding', 'Branding', Palette],
              ['links', 'Navigation & Social', Link2],
              ['maintenance', 'Maintenance Mode', Wrench],
              ['config', 'Configuration', Sliders],
            ].map(([id, label, TabIcon]) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                onClick={() => setActiveTab(id)}
              >
                <TabIcon size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="admin-btn-secondary" onClick={loadSettings}>
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {form.maintenanceEnabled ? (
        <div className="cmt-pending-banner">
          <div className="cmt-pending-banner-copy">
            <AlertTriangle size={18} />
            <span>
              <strong>Maintenance Mode is ACTIVE:</strong> Public visitors currently see the
              maintenance page while admins retain full access.
            </span>
          </div>
        </div>
      ) : null}

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

      <section className="admin-card">
        <form className="cms-form" onSubmit={handleSave}>
          {activeTab === 'general' ? (
            <>
              <div className="cms-field-row">
                <div className="cms-field">
                  <label>Website Name</label>
                  <input
                    value={form.siteName}
                    onChange={(e) => setForm((p) => ({ ...p, siteName: e.target.value }))}
                  />
                </div>
                <div className="cms-field">
                  <label>Website URL</label>
                  <input
                    value={form.siteUrl}
                    onChange={(e) => setForm((p) => ({ ...p, siteUrl: e.target.value }))}
                  />
                </div>
              </div>
              <div className="cms-field-row">
                <div className="cms-field">
                  <label>Website Tagline</label>
                  <input
                    value={form.tagline}
                    onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))}
                  />
                </div>
                <div className="cms-field">
                  <label>Contact Email</label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
                  />
                </div>
              </div>
              <div className="cms-field">
                <label>Website Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="cms-field-row">
                <div className="cms-field">
                  <label>Default Language</label>
                  <select
                    value={form.defaultLanguage}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, defaultLanguage: e.target.value }))
                    }
                  >
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="cms-field">
                  <label>Default Theme</label>
                  <select
                    value={form.defaultTheme}
                    onChange={(e) => setForm((p) => ({ ...p, defaultTheme: e.target.value }))}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>
              </div>
              <div className="cms-field-row">
                <div className="cms-field">
                  <label>Date Format</label>
                  <input
                    value={form.dateFormat}
                    onChange={(e) => setForm((p) => ({ ...p, dateFormat: e.target.value }))}
                  />
                </div>
                <div className="cms-field">
                  <label>Timezone</label>
                  <input
                    value={form.timezone}
                    onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                  />
                </div>
              </div>
            </>
          ) : activeTab === 'branding' ? (
            <>
              <div className="cms-field-row">
                <div className="cms-field">
                  <label>Website Logo URL</label>
                  <input
                    value={form.siteLogo}
                    onChange={(e) => setForm((p) => ({ ...p, siteLogo: e.target.value }))}
                    placeholder="https://notes.swadhyay.in/logo.png"
                  />
                </div>
                <div className="cms-field">
                  <label>Admin Panel Logo URL</label>
                  <input
                    value={form.adminLogo}
                    onChange={(e) => setForm((p) => ({ ...p, adminLogo: e.target.value }))}
                  />
                </div>
              </div>
              <div className="cms-field-row">
                <div className="cms-field">
                  <label>Favicon URL</label>
                  <input
                    value={form.faviconUrl}
                    onChange={(e) => setForm((p) => ({ ...p, faviconUrl: e.target.value }))}
                  />
                </div>
                <div className="cms-field">
                  <label>Default Font Family</label>
                  <select
                    value={form.defaultFont}
                    onChange={(e) => setForm((p) => ({ ...p, defaultFont: e.target.value }))}
                  >
                    <option value="system">System UI / Noto Sans</option>
                    <option value="serif">Editorial Serif</option>
                    <option value="inter">Inter / Clean Sans</option>
                  </select>
                </div>
              </div>
              <div className="cms-field-row">
                <div className="cms-field">
                  <label>Primary Theme Color</label>
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
                    style={{ height: 42, padding: 4 }}
                  />
                </div>
                <div className="cms-field">
                  <label>Secondary Theme Color</label>
                  <input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, secondaryColor: e.target.value }))
                    }
                    style={{ height: 42, padding: 4 }}
                  />
                </div>
              </div>
              <div className="cms-field">
                <label>Footer Appearance Text</label>
                <input
                  value={form.footerText}
                  onChange={(e) => setForm((p) => ({ ...p, footerText: e.target.value }))}
                />
              </div>
            </>
          ) : activeTab === 'links' ? (
            <>
              <div className="cms-card-head">
                <div>
                  <h2>Social &amp; Community Links</h2>
                  <p className="cms-muted">
                    Header/Footer navigation items can be reordered in{' '}
                    <a href="#/admin/navigation">Navigation Menu</a>.
                  </p>
                </div>
                <button type="button" className="admin-btn-secondary" onClick={addSocialLink}>
                  <Plus size={14} /> Add Link
                </button>
              </div>
              {(form.socialLinks || []).map((link, idx) => (
                <div key={link.id || idx} className="cms-field-row" style={{ alignItems: 'center' }}>
                  <div className="cms-field">
                    <label>Platform Label</label>
                    <input
                      value={link.label}
                      onChange={(e) => updateSocialLink(idx, 'label', e.target.value)}
                    />
                  </div>
                  <div className="cms-field" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label>URL</label>
                      <input
                        value={link.url}
                        onChange={(e) => updateSocialLink(idx, 'url', e.target.value)}
                        placeholder="https://t.me/..."
                      />
                    </div>
                    <button
                      type="button"
                      className="cmt-action-btn is-delete"
                      onClick={() => removeSocialLink(idx)}
                      title="Remove link"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          ) : activeTab === 'maintenance' ? (
            <>
              <label className="cmt-toggle-row">
                <div>
                  <strong>Enable Maintenance Mode</strong>
                  <p className="cms-subtext">
                    Regular visitors see the maintenance page below; signed-in Admins can still
                    browse the site.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={form.maintenanceEnabled}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, maintenanceEnabled: e.target.checked }))
                  }
                />
              </label>

              <label className="cmt-toggle-row">
                <div>
                  <strong>Allow Admin Access During Maintenance</strong>
                  <p className="cms-subtext">
                    Authorized admins bypass the maintenance screen to verify updates live.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={form.allowAdminDuringMaintenance}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      allowAdminDuringMaintenance: e.target.checked,
                    }))
                  }
                />
              </label>

              <div className="cms-field">
                <label>Maintenance Page Title</label>
                <input
                  value={form.maintenanceTitle}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, maintenanceTitle: e.target.value }))
                  }
                />
              </div>

              <div className="cms-field">
                <label>Custom Maintenance Message</label>
                <textarea
                  rows={3}
                  value={form.maintenanceMessage}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, maintenanceMessage: e.target.value }))
                  }
                />
              </div>
            </>
          ) : (
            <>
              <div className="cms-field-row">
                <div className="cms-field">
                  <label>Posts Per Page on Home</label>
                  <input
                    type="number"
                    min={4}
                    max={50}
                    value={form.postsPerPage}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, postsPerPage: Number(e.target.value || 12) }))
                    }
                  />
                </div>
              </div>
              <label className="cmt-toggle-row">
                <div>
                  <strong>Show Latest Quizzes on Homepage</strong>
                  <p className="cms-subtext">Display featured quizzes on the public home view.</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.showLatestQuizzesOnHome}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, showLatestQuizzesOnHome: e.target.checked }))
                  }
                />
              </label>
              <label className="cmt-toggle-row">
                <div>
                  <strong>Enable Advertisement Slots</strong>
                  <p className="cms-subtext">Master toggle for configured ad placements.</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.adsEnabled}
                  onChange={(e) => setForm((p) => ({ ...p, adsEnabled: e.target.checked }))}
                />
              </label>
            </>
          )}

          <div className="cms-form-actions" style={{ marginTop: 8 }}>
            <button type="submit" className="admin-btn-primary" disabled={saving}>
              {saving ? 'Saving Settings…' : 'Save Website Settings'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
