import { Mark, Node, mergeAttributes } from '@tiptap/core'

export const StyledText = Mark.create({
  name: 'styledText',

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily || null,
        renderHTML: (attributes) =>
          attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) =>
          attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
      },
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) =>
          attributes.color ? { style: `color: ${attributes.color}` } : {},
      },
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) =>
          attributes.backgroundColor
            ? { style: `background-color: ${attributes.backgroundColor}` }
            : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element) => {
          const { fontFamily, fontSize, color, backgroundColor } = element.style
          if (!fontFamily && !fontSize && !color && !backgroundColor) return false
          return {}
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },
})

export function resolveVideoEmbed(rawUrl) {
  const url = String(rawUrl || '').trim()
  if (!url) return null

  // YouTube watch / short / embed
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  )
  if (ytMatch) {
    return {
      kind: 'iframe',
      src: `https://www.youtube.com/embed/${ytMatch[1]}`,
      originalUrl: url,
    }
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return {
      kind: 'iframe',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      originalUrl: url,
    }
  }

  // Direct MP4/WebM/Ogg video
  if (/^https?:\/\//i.test(url)) {
    return {
      kind: 'video',
      src: url,
      originalUrl: url,
    }
  }

  return null
}

export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: '' },
      kind: { default: 'iframe' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-video-embed]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src || ''
    const kind = HTMLAttributes.kind || 'iframe'
    if (kind === 'video') {
      return [
        'div',
        { 'data-video-embed': 'true', class: 'cms-video-embed' },
        ['video', { src, controls: 'true', preload: 'metadata' }],
      ]
    }
    return [
      'div',
      { 'data-video-embed': 'true', class: 'cms-video-embed' },
      [
        'iframe',
        {
          src,
          title: 'Embedded video',
          frameborder: '0',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: 'true',
        },
      ],
    ]
  },
})

export const JumpBreak = Node.create({
  name: 'jumpBreak',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'hr[data-jump-break]' }]
  },

  renderHTML() {
    return ['hr', { 'data-jump-break': 'true', class: 'cms-jump-break' }]
  },
})
