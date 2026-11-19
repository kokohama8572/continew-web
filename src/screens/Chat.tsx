import { Check, ChevronDown, MoreHorizontal, Search, Send, X } from 'lucide-react'
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
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [params] = useSearchParams()
  const focusMessage = params.get('message')
  const messages = state.messages.filter((message) => !message.deletedAt)
  const messageById = new Map(messages.map((message) => [message.id, message]))
  const searchTerm = search.trim().toLocaleLowerCase('ko-KR')
  const visibleMessages = searchTerm
    ? messages.filter((message) => `${message.authorLabel} ${message.body}`.toLocaleLowerCase('ko-KR').includes(searchTerm))
    : messages
  const replyingTo = replyingToId ? messageById.get(replyingToId) : undefined
  const menuMessage = messages.find((message) => message.id === menuId)
  const canEditMenuMessage = !!spaceId && menuMessage?.senderSpaceId === spaceId
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
    dispatch({ type: 'SEND_MESSAGE', authorLabel, body: body.trim(), replyToId: replyingToId ?? undefined })
    setBody('')
    setReplyingToId(null)
    setSearch('')
    setSearchOpen(false)
  }

  return (
    <div className="page page-chat">
      <div className="chat-head">
        <div className="chat-head-row">
          <h1>대화</h1>
          <button type="button" className="chat-search-toggle" aria-label={searchOpen ? '대화 검색 닫기' : '대화 검색'} aria-expanded={searchOpen} onClick={() => {
            setSearchOpen(!searchOpen)
            setSearch('')
          }}>{searchOpen ? <X size={19} aria-hidden /> : <Search size={19} aria-hidden />}</button>
        </div>
        <p className="sub">공간을 넘어 자유롭게 이야기해요.</p>
        {searchOpen && <div className="chat-search">
          <input aria-label="대화 내용 검색" placeholder="이름이나 대화 내용 검색" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
          {search && <button type="button" aria-label="검색어 지우기" onClick={() => setSearch('')}><X size={17} aria-hidden /></button>}
        </div>}
        {searchTerm && <p className="chat-search-count" role="status">검색 결과 {visibleMessages.length}개</p>}
      </div>

      <ul className="chat-list" aria-label="공용 대화" ref={listRef}>
        {visibleMessages.map((message, index) => {
          const mine = !!spaceId && message.senderSpaceId === spaceId
          const previous = visibleMessages[index - 1]
          const grouped = !searchTerm && !!previous && previous.authorLabel === message.authorLabel && previous.senderSpaceId === message.senderSpaceId
          const replySource = message.replyToId ? messageById.get(message.replyToId) : undefined
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
                  <div className="chat-message-text">
                    {message.replyToId && <div className="chat-reply-reference">
                      <strong>{replySource?.authorLabel ?? '이전 메시지'}</strong>
                      <span>{replySource?.body ?? '삭제된 메시지'}</span>
                    </div>}
                    <p className="chat-bubble">{message.body}</p>
                  </div>
                  <button type="button" className="chat-menu-button" aria-label={`${message.body.slice(0, 20)} 메시지 옵션`} onClick={() => setMenuId(message.id)}>
                    <MoreHorizontal size={17} aria-hidden />
                  </button>
                </div>
                <time className="chat-time" dateTime={message.createdAt}>{time(message.createdAt)}{message.editedAt ? ' · 수정됨' : ''}</time>
              </div>
            </li>
          )
        })}
        {searchTerm && visibleMessages.length === 0 && <li className="chat-empty">일치하는 대화가 없어요.</li>}
      </ul>

      <form className="chat-compose" onSubmit={send}>
        {replyingToId && <div className="chat-compose-reply">
          <div><strong>{replyingTo?.authorLabel ?? '이전 메시지'}에게 답장</strong><span>{replyingTo?.body ?? '삭제된 메시지'}</span></div>
          <button type="button" aria-label="답장 취소" onClick={() => setReplyingToId(null)}><X size={18} aria-hidden /></button>
        </div>}
        <div className="chat-author-row">
          <span className="chat-author-label">작성자</span>
          <button type="button" className="chat-author-button" onClick={() => setAuthorOpen(true)}>
            <span>{authorLabel || '선택해 주세요'}</span>
            <ChevronDown size={15} aria-hidden />
          </button>
        </div>
        {currentSpace && authorLabel !== currentSpace.name && <p className="chat-author-hint">이름만 바뀌어요. 이 메시지는 {currentSpace.name} 공간에서 보낸 것으로 남아요.</p>}
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
            if (!menuMessage) return
            setReplyingToId(menuMessage.id)
            setMenuId(null)
            setSearch('')
            setSearchOpen(false)
          }}>답장하기</button>
          <button className="switch-item" onClick={() => {
            if (!menuMessage) return
            setMenuId(null)
            navigate(`/share?type=todo&message=${encodeURIComponent(menuMessage.id)}`)
          }}>할 일·일정으로 남기기</button>
          {canEditMenuMessage && <>
            <button className="switch-item" onClick={() => {
              if (!menuMessage) return
              setEditBody(menuMessage.body)
              setEditingId(menuMessage.id)
              setMenuId(null)
            }}>수정</button>
            <button className="switch-item" onClick={() => {
              const id = menuMessage?.id
              setMenuId(null)
              if (id && window.confirm('이 메시지를 삭제할까요?')) dispatch({ type: 'DELETE_MESSAGE', id })
            }}>삭제</button>
          </>}
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
