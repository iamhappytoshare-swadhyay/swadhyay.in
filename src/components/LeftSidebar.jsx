import Icon from './Icon.jsx'
import { CATEGORY_ITEMS } from '../routes.js'

const VALID_TONES = ['red', 'amber', 'teal', 'violet', 'blue', 'navy']

export default function LeftSidebar({
  t,
  category,
  dynamicCategories = [],
  open,
  onSelect,
  onSelectDynamic,
}) {
  const builtinIds = new Set(CATEGORY_ITEMS.map((item) => item.id))
  const extraCategories = dynamicCategories.filter(
    (item) => item.showOnPublic !== false && item.slug && !builtinIds.has(item.slug),
  )

  return (
    <aside
      id="study-categories"
      className={open ? 'sidebar is-open' : 'sidebar'}
      aria-label={t.categoriesTitle}
    >
      <div className="sidebar-card">
        <p className="sidebar-title">{t.categoriesTitle}</p>
        <ul className="side-list">
          {CATEGORY_ITEMS.map((item) => {
            const active = category === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={active ? 'side-link is-active' : 'side-link'}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelect(item.id)}
                >
                  <span className={`tone tone-${item.tone}`}>
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span>{t.category[item.id]}</span>
                </button>
              </li>
            )
          })}

          {extraCategories.map((item) => {
            const active = category === item.slug
            const tone = VALID_TONES.includes(item.tone) ? item.tone : 'navy'
            const isUrlIcon = typeof item.icon === 'string' && /^https?:\/\//i.test(item.icon)
            return (
              <li key={item.id || item.slug}>
                <button
                  type="button"
                  className={active ? 'side-link is-active' : 'side-link'}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelectDynamic?.(item.slug)}
                >
                  <span className={`tone tone-${tone}`}>
                    {isUrlIcon ? (
                      <img src={item.icon} alt="" width={18} height={18} style={{ borderRadius: 4 }} />
                    ) : (
                      <Icon name={item.icon || 'book'} size={18} />
                    )}
                  </span>
                  <span>{item.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
