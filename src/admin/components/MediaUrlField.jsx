import { useState } from 'react'
import { ExternalLink, FolderUp, X } from 'lucide-react'
import MediaLibrary from '../MediaLibrary.jsx'

export default function MediaUrlField({
  id,
  label,
  value,
  onChange,
  placeholder = 'https://notes.swadhyay.in/...',
  modalTitle = 'Choose or Upload File (Cloudflare R2)',
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="cms-field">
      <label htmlFor={id}>{label}</label>
      <div className="cms-inline-add">
        <input
          id={id}
          type="url"
          placeholder={placeholder}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="admin-pill-link"
          onClick={() => setPickerOpen(true)}
          title="Upload PDF/Image or pick from Cloudflare R2 Media Library"
        >
          <FolderUp size={14} />
          <span>R2 Library</span>
        </button>
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-icon-btn"
            title="Open current URL"
            aria-label={`Open ${label}`}
          >
            <ExternalLink size={14} />
          </a>
        ) : null}
      </div>

      {pickerOpen ? (
        <div className="media-modal-backdrop" role="dialog" aria-modal="true">
          <div className="media-modal-card is-wide">
            <div className="admin-panel-head">
              <h2>{modalTitle}</h2>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => setPickerOpen(false)}
                aria-label="Close media picker"
              >
                <X size={16} />
              </button>
            </div>
            <MediaLibrary
              compact
              onSelectMedia={(item) => {
                onChange(item.url)
                setPickerOpen(false)
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
