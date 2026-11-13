export const ADMIN_NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', description: 'Live website metrics, content growth, and quick actions.' },
    ],
  },
  {
    id: 'content',
    label: 'Blogger CMS',
    items: [
      { id: 'posts', label: 'Posts', icon: 'FileText', description: 'Create, schedule, edit, and publish articles with Blogger-style rich text.' },
      { id: 'pages', label: 'Pages', icon: 'FileCode2', description: 'Manage static pages like About Us, Privacy Policy, and Contact.' },
      { id: 'categories', label: 'Categories', icon: 'FolderTree', description: 'Organize parent/child categories, icons, and tags/labels.' },
      { id: 'media', label: 'Media Library', icon: 'Image', description: 'Manage PDFs, images, and documents stored on Cloudflare R2.' },
      { id: 'comments', label: 'Comments', icon: 'MessageSquare', description: 'Approve, reject, reply to, or flag reader comments.' },
    ],
  },
  {
    id: 'education',
    label: 'Education',
    items: [
      { id: 'ncert', label: 'NCERT Content', icon: 'BookOpen', description: 'Organize NCERT books and chapters by class, subject, and language.' },
      { id: 'pyq', label: 'PYQ / Previous Year Questions', icon: 'ClipboardList', description: 'Manage previous year papers, answer keys, and solutions.' },
      { id: 'notes', label: 'Notes & Study Materials', icon: 'NotebookPen', description: 'Publish subject notes, thumbnails, and downloadable study packs.' },
      { id: 'quizzes', label: 'Quizzes', icon: 'HelpCircle', description: 'Manage quizzes, question banks, negative marking, and results.' },
      { id: 'reports', label: 'Question Reports', icon: 'AlertTriangle', description: 'Review reported question errors, student descriptions, and attachments.' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth & Site',
    items: [
      { id: 'users', label: 'Users', icon: 'Users', description: 'Inspect registered learners, quiz participation, and account status.' },
      { id: 'notifications', label: 'Notifications', icon: 'Bell', description: 'Compose, schedule, and dispatch user notifications.' },
      { id: 'analytics', label: 'Analytics', icon: 'BarChart3', description: 'Track real quiz attempts, downloads, and content engagement.' },
      { id: 'seo', label: 'SEO Manager', icon: 'SearchCheck', description: 'Configure meta tags, canonical URLs, sitemap.xml, and robots.txt.' },
      { id: 'navigation', label: 'Navigation Menu', icon: 'Menu', description: 'Reorder, enable/disable, and nest public website menu items.' },
      { id: 'ads', label: 'Advertisement Manager', icon: 'Megaphone', description: 'Configure header, sidebar, in-article, and footer ad slots.' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'settings', label: 'Website Settings', icon: 'Settings', description: 'Control branding, links, default theme/language, and maintenance mode.' },
      { id: 'permissions', label: 'Admin Users & Permissions', icon: 'ShieldCheck', description: 'Assign Super Admin, Admin, Editor, and Author access.', superAdminOnly: true },
      { id: 'logs', label: 'Backup & Activity Logs', icon: 'History', description: 'Audit administrative actions and export database backups.' },
    ],
  },
]

export const ADMIN_SECTIONS = ADMIN_NAV_GROUPS.flatMap((group) => group.items)

export const ADMIN_SECTION_IDS = ADMIN_SECTIONS.map((item) => item.id)

export function getAdminSection(sectionId) {
  return ADMIN_SECTIONS.find((item) => item.id === sectionId) || ADMIN_SECTIONS[0]
}
