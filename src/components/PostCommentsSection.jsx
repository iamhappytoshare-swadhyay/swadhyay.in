import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  DEFAULT_COMMENT_SETTINGS,
  getCommentSettings,
  listPublishedCommentsForPost,
  submitComment,
} from '../services/commentService.js'
import { formatDate, toMillis } from '../utils/slugify.js'

function formatCommentDate(value) {
  if (!value) return ''
  const ms = typeof value === 'string' ? Date.parse(value) : toMillis(value)
  if (!ms || Number.isNaN(ms)) return formatDate(value)
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(ms))
  } catch {
    return formatDate(value)
  }
}

export default function PostCommentsSection({ post }) {
  const { user, signInWithGoogle } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_COMMENT_SETTINGS)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const loadCommentsAndSettings = useCallback(async () => {
    if (!post?.id) return
    setLoading(true)
    try {
      const [loadedSettings, published] = await Promise.all([
        getCommentSettings(),
        listPublishedCommentsForPost(post.id),
      ])
      setSettings(loadedSettings)
      setComments(published)
    } finally {
      setLoading(false)
    }
  }, [post?.id])

  useEffect(() => {
    const id = setTimeout(() => {
      void loadCommentsAndSettings()
    }, 0)
    return () => clearTimeout(id)
  }, [loadCommentsAndSettings])

  const globallyEnabled = settings.commentsEnabledGlobally !== false
  const postEnabled = post?.commentsEnabled !== false

  if (!globallyEnabled || !postEnabled) {
    return (
      <section className="post-comments-section" aria-label="Comments">
        <h2 className="post-comments-title">Comments</h2>
        <p className="post-comments-muted">Comments are closed for this article.</p>
      </section>
    )
  }

  const canComment = Boolean(user) || Boolean(settings.allowGuestComments)

  async function handleSubmit(event) {
    event.preventDefault()
    setFeedback(null)

    const authorName = user?.displayName || guestName.trim()
    const authorEmail = user?.email || guestEmail.trim()

    if (!authorName) {
      setFeedback({ type: 'error', text: 'Please enter your name.' })
      return
    }
    if (!commentText.trim()) {
      setFeedback({ type: 'error', text: 'Please write a comment before submitting.' })
      return
    }

    setSubmitting(true)
    try {
      const result = await submitComment({
        post,
        authorName,
        authorEmail,
        uid: user?.uid || '',
        content: commentText,
        settings,
      })

      setCommentText('')
      if (result.status === 'published') {
        setFeedback({ type: 'success', text: 'Your comment has been published.' })
        await loadCommentsAndSettings()
      } else if (result.status === 'spam') {
        setFeedback({
          type: 'info',
          text: 'Your comment was held by spam protection for moderator review.',
        })
      } else {
        setFeedback({
          type: 'info',
          text: 'Thank you! Your comment has been submitted and is awaiting admin approval.',
        })
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error?.message || 'Unable to submit your comment. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="post-comments-section" aria-label="Reader Comments">
      <div className="post-comments-head">
        <h2 className="post-comments-title">
          Comments ({comments.length})
        </h2>
        <span className="post-comments-note">
          Submitted comments cannot be edited after posting.
        </span>
      </div>

      {canComment ? (
        <form className="post-comment-form" onSubmit={handleSubmit}>
          {!user ? (
            <div className="post-comment-guest-row">
              <input
                type="text"
                placeholder="Your Name *"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </div>
          ) : (
            <p className="post-comments-as">
              Commenting as <strong>{user.displayName || user.email}</strong>
            </p>
          )}

          <textarea
            rows={3}
            placeholder="Share your thoughts or ask a question…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            required
          />

          {feedback ? (
            <p className={`post-comment-feedback is-${feedback.type}`} role="status">
              {feedback.text}
            </p>
          ) : null}

          <button
            type="submit"
            className="primary-button"
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Post Comment'}
          </button>
        </form>
      ) : (
        <div className="post-comment-signin-box">
          <p>Sign in with Google to leave a comment on this article.</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => signInWithGoogle()}
          >
            Sign in with Google
          </button>
        </div>
      )}

      <div className="post-comments-list">
        {loading ? (
          <p className="post-comments-muted">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="post-comments-muted">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="post-comment-item">
              <div className="post-comment-meta">
                <strong>{comment.authorName || 'Reader'}</strong>
                <span>{formatCommentDate(comment.createdAt)}</span>
              </div>
              <p className="post-comment-body">{comment.content}</p>

              {comment.adminReply?.text ? (
                <div className="post-comment-admin-reply">
                  <div className="post-comment-admin-reply-head">
                    <span className="post-comment-admin-badge">Admin Reply</span>
                    <span>
                      {comment.adminReply.authorName || 'Swadhyay Admin'} ·{' '}
                      {formatCommentDate(
                        comment.adminReply.updatedAt || comment.adminReply.createdAt,
                      )}
                    </span>
                  </div>
                  <p>{comment.adminReply.text}</p>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
