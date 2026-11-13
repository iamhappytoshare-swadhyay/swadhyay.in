import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Icon from './Icon.jsx'
import {
  DEFAULT_MENU_ITEMS,
  buildMenuTree,
  isExternalUrl,
  normalizeMenuPath,
} from '../services/menuService.js'

function isItemActive(item, view, routeSlug) {
  if (isExternalUrl(item.url)) return false
  if (item.routeId && view === item.routeId) return true
  const target = normalizeMenuPath(item.url)
  if (target === `/${view}`) return true
  if (view === 'post' && target === `/post/${routeSlug}`) return true
  if (view === 'page' && target === `/page/${routeSlug}`) return true
  if (view === 'category' && target === `/category/${routeSlug}`) return true
  return false
}

export default function Navigation({
  t,
  lang = 'en',
  view,
  routeSlug = '',
  menuItems = [],
  onNavigate,
}) {
  const [openDropdownId, setOpenDropdownId] = useState('')
  const navRef = useRef(null)

  const headerTree = useMemo(() => {
    const sourceItems = menuItems.length > 0 ? menuItems : DEFAULT_MENU_ITEMS
    const enabledHeaderItems = sourceItems.filter(
      (item) => item.enabled !== false && (item.location || 'header') === 'header',
    )
    return buildMenuTree(enabledHeaderItems, 'header')
  }, [menuItems])

  useEffect(() => {
    function onDocClick(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenDropdownId('')
      }
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpenDropdownId('')
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  function getLabel(item) {
    const label = lang === 'hi' ? item.labelHi || item.labelEn : item.labelEn
    return label || t.nav?.[item.routeId || item.id] || item.id
  }

  function renderLink(item, isSubItem = false) {
    const displayLabel = getLabel(item)
    const external = isExternalUrl(item.url)
    const active = isItemActive(item, view, routeSlug)
    const baseClass = isSubItem ? 'nav-dropdown-link' : 'nav-link'

    if (external) {
      return (
        <a
          className={baseClass}
          href={item.url}
          target={item.openInNewTab === false ? undefined : '_blank'}
          rel={item.openInNewTab === false ? undefined : 'noopener noreferrer'}
          onClick={() => setOpenDropdownId('')}
        >
          {item.icon ? <Icon name={item.icon} size={14} /> : null}
          <span>{displayLabel}</span>
        </a>
      )
    }

    return (
      <button
        type="button"
        className={active ? `${baseClass} is-active` : baseClass}
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          setOpenDropdownId('')
          onNavigate(normalizeMenuPath(item.url))
        }}
      >
        {item.icon ? <Icon name={item.icon} size={14} /> : null}
        <span>{displayLabel}</span>
      </button>
    )
  }

  return (
    <nav
      className={`nav ${view !== 'home' ? 'mobile-subpage-hide' : ''}`}
      ref={navRef}
      aria-label={t.mainMenu}
    >
      <ul className="nav-list">
        {headerTree.map((item) => {
          const hasChildren = Array.isArray(item.children) && item.children.length > 0
          const isOpen = openDropdownId === item.id
          const active =
            isItemActive(item, view, routeSlug) ||
            (hasChildren && item.children.some((c) => isItemActive(c, view, routeSlug)))

          if (!hasChildren) {
            return <li key={item.id}>{renderLink(item)}</li>
          }

          return (
            <li
              key={item.id}
              className={isOpen ? 'nav-has-dropdown is-open' : 'nav-has-dropdown'}
            >
              <div className="nav-dropdown-trigger-group">
                {renderLink(item)}
                <button
                  type="button"
                  className={active ? 'nav-dropdown-toggle is-active' : 'nav-dropdown-toggle'}
                  aria-label={`Toggle ${getLabel(item)} submenu`}
                  aria-expanded={isOpen}
                  onClick={() => setOpenDropdownId((prev) => (prev === item.id ? '' : item.id))}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <ul className="nav-dropdown" aria-label={`${getLabel(item)} submenu`}>
                {item.children.map((child) => (
                  <li key={child.id}>{renderLink(child, true)}</li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
