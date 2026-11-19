import { Check, ChevronDown, MoreHorizontal, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Sheet from '../components/Sheet'
import { visibleSpaces } from '../state/selectors'
import { useStore } from '../state/store'
import { ANONYMOUS_LABEL } from '../types/model'

const time = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))

const authorTone = (label: string) =>
  Array.from(label).reduce((hash, char) => hash + char.codePointAt(0)!, 0) % 4

/** 열린 공간을 기본 작성자로 쓰고, 다른 표기를 고를 수 있다. */
export default function ChatScreen() {
  const navigate = useNavigate()
  const { state, dispatch, currentSpace } = useStore()
  const [authorChoice, setAuthorChoice] = useState<{ spaceId: string | null; label: string } | null>(null)
  const spaceId = currentSpace?.id ?? null
  const authorLabel = authorChoice?.spaceId === spaceId ? authorChoice.label : (currentSpace?.name ?? '')
  const [body, setBody] = useState('')
  const [authorOpen, setAuthorOpen] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [params] = useSearchParams()
  const focusMessage = params.get('message')
  const messages = state.messages.filter((message) => !message.deletedAt)
  const listRef = useRef<HTMLUListElement>(null)
  const scrollAfterSend = useRef(false)

  useEffect(() => {
    if (!scrollAfterSend.current) return
    scrollAfterSend.current = false
    const list = listRef.current
    if (!list) return
    const frame = requestAnimationFrame(() => {
      list.scrollTo({
        top: list.scrollHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [messages.length])

  useEffect(() => {
    if (!focusMessage) return
    const frame = requestAnimationFrame(() =>
      document.getElementById(`message-${focusMessage}`)?.scrollIntoView({ block: 'center' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [focusMessage])

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!authorLabel || !body.trim()) return
    scrollAfterSend.current = true
    dispatch({ type: 'SEND_MESSAGE', authorLabel, body: body.trim() })
    setBody('')
  }

  return (
    <div className="page page-chat">
      <div className="chat-head">
        <h1>대화</h1>
        <p className="sub">공간을 넘어 자유롭게 이야기해요.</p>
      </div>

      <ul className="chat-list" aria-label="공용 대화" ref={listRef}>
        {messages.map((message, index) => {
          const mine = !!spaceId && message.senderSpaceId === spaceId
          const previous = messages[index - 1]
          const grouped = !!previous && previous.authorLabel === message.authorLabel && previous.senderSpaceId === message.senderSpaceId
          return (
            <li
              className={`chat-message chat-tone-${authorTone(message.authorLabel)}${mine ? ' is-own' : ''}${grouped ? ' is-grouped' : ''}${message.id === focusMessage ? ' is-target' : ''}`}
              id={`message-${message.id}`}
              key={message.id}
            >
              <span className={`chat-avatar${grouped ? ' is-placeholder' : ''}`} aria-hidden>
                {message.authorLabel.slice(0, 1)}
              </span>
              <div className="chat-content">
                {!grouped && (
                  <div className="chat-meta">
                    <strong>{message.authorLabel}</strong>
                  </div>
                )}
                <div className="chat-bubble-row">
                  <p className="chat-bubble">{message.body}</p>
                  {mine && (
                    <button type="button" className="chat-menu-button" aria-label={`${message.body.slice(0, 20)} 메시지 옵션`} onClick={() => setMenuId(message.id)}>
                      <MoreHorizontal size={17} aria-hidden />
                    </button>
                  )}
                </div>
                <time className="chat-time" dateTime={message.createdAt}>{time(message.createdAt)}{message.editedAt ? ' · 수정됨' : ''}</time>
                <div className="chat-actions">
                  <button type="button" onClick={() => navigate(`/share?type=todo&message=${encodeURIComponent(message.id)}`)}>할 일·일정으로 남기기</button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <form className="chat-compose" onSubmit={send}>
        <div className="chat-author-row">
          <span className="chat-author-label">작성자</span>
          <button type="button" className="chat-author-button" onClick={() => setAuthorOpen(true)}>
            <span>{authorLabel || '선택해 주세요'}</span>
            <ChevronDown size={15} aria-hidden />
          </button>
        </div>
        <div className="chat-input-row">
          <input
            aria-label="메시지"
            placeholder="메시지를 입력하세요..."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={5000}
          />
          <button type="submit" aria-label="메시지 보내기" disabled={!authorLabel || !body.trim()}>
            <Send size={18} aria-hidden />
          </button>
        </div>
      </form>
      <Sheet open={authorOpen} onClose={() => setAuthorOpen(false)} title="작성자 표기">
        <p className="sheet-note">이 메시지에 표시할 이름을 선택해 주세요.</p>
        <ul className="switch-list">
          {[...visibleSpaces(state).map((space) => space.name), ANONYMOUS_LABEL].map((label) => (
            <li key={label}>
              <button
                className="switch-item"
                onClick={() => {
                  setAuthorChoice({ spaceId, label })
                  setAuthorOpen(false)
                }}
              >
                <span className="switch-name">{label}</span>
                {label === authorLabel && <Check size={18} aria-label="선택됨" />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={menuId !== null} onClose={() => setMenuId(null)} title="메시지 옵션">
        <div className="switch-list">
          <button className="switch-item" onClick={() => {
            const message = messages.find((item) => item.id === menuId)
            if (!message || message.senderSpaceId !== spaceId) return
            setEditBody(message.body)
            setEditingId(message.id)
            setMenuId(null)
          }}>수정</button>
          <button className="switch-item" onClick={() => {
            const id = menuId
            setMenuId(null)
            if (id && window.confirm('이 메시지를 삭제할까요?')) dispatch({ type: 'DELETE_MESSAGE', id })
          }}>삭제</button>
        </div>
      </Sheet>
      <Sheet open={editingId !== null} onClose={() => setEditingId(null)} title="메시지 수정">
        <textarea className="form-input chat-edit-input" aria-label="수정할 메시지" maxLength={5000} value={editBody} onChange={(event) => setEditBody(event.target.value)} />
        <button className="btn btn-primary wide" disabled={!editBody.trim()} onClick={() => {
          if (editingId) dispatch({ type: 'EDIT_MESSAGE', id: editingId, body: editBody })
          setEditingId(null)
        }}>수정 저장</button>
      </Sheet>
    </div>
  )
}
