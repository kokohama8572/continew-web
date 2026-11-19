import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ScopeBadge } from '../components/common'
import { visibleSpaces } from '../state/selectors'
import { useStore } from '../state/store'
import { ANONYMOUS_LABEL, type PostType } from '../types/model'

const TYPES: { value: PostType; label: string }[] = [
  { value: 'note', label: '게시글' }, { value: 'event', label: '일정' },
  { value: 'todo', label: '할 일' }, { value: 'caution', label: '주의사항' },
]

export default function ShareConfirmScreen() {
  const { state, currentSpace, dispatch } = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const memo = state.memos.find((m) => m.id === params.get('memo') && m.spaceId === currentSpace?.id && !m.deletedAt)
  const message = state.messages.find((m) => m.id === params.get('message') && !m.deletedAt)
  const requestedType = params.get('type')
  const draftKey = `continew:share-draft:${currentSpace?.id ?? 'none'}:${memo?.id ?? message?.id ?? requestedType ?? 'new'}`
  const [draft] = useState(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return null
      const saved: unknown = JSON.parse(raw)
      if (!saved || typeof saved !== 'object') return null
      const value = saved as Record<string, unknown>
      if (!TYPES.some((item) => item.value === value.type) ||
        !['title', 'body', 'eventAt', 'authorLabel'].every((key) => typeof value[key] === 'string')) return null
      return value as { type: PostType; title: string; body: string; eventAt: string; dueAt?: string; authorLabel: string }
    } catch { return null }
  })
  const [type, setType] = useState<PostType>(draft?.type ?? (TYPES.some((t) => t.value === requestedType) ? requestedType as PostType : 'note'))
  const [title, setTitle] = useState(draft?.title ?? memo?.body.split('\n')[0] ?? message?.body.slice(0, 80) ?? '')
  const [body, setBody] = useState(draft?.body ?? memo?.body ?? message?.body ?? '')
  const [eventAt, setEventAt] = useState(draft?.eventAt ?? '')
  const [dueAt, setDueAt] = useState(draft?.dueAt ?? '')
  const [authorLabel, setAuthorLabel] = useState(draft?.authorLabel ?? '')
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ type, title, body, eventAt, dueAt, authorLabel })) }
    catch { /* 저장할 수 없으면 현재 입력만 유지한다. */ }
  }, [draftKey, type, title, body, eventAt, dueAt, authorLabel])
  const clearDraft = () => { try { localStorage.removeItem(draftKey) } catch { /* 저장할 수 없었던 초안 */ } }
  const valid = title.trim() && body.trim() && authorLabel && confirmed && (type !== 'event' || eventAt)
  return <div className="page editor-page">
    <button className="back" onClick={() => nav(memo ? `/memo/${memo.id}` : message ? `/chat?message=${encodeURIComponent(message.id)}` : '/board')}><ChevronLeft size={20} aria-hidden /> 돌아가기</button>
    <h1>공용에 공유하기</h1>
    <ScopeBadge scope="shared" />
    <p className="sub">게시하면 모든 공간에서 볼 수 있어요. {memo && '원본 메모는 현재 공간에 남아요. '}작성 중인 내용은 이 브라우저에 임시 저장돼요.</p>
    {message && <p className="notice">대화 원문을 가져왔어요. 제목과 날짜를 확인한 뒤 게시해 주세요.</p>}
    <label className="form-label" htmlFor="share-type">유형</label>
    <select id="share-type" className="form-input" value={type} onChange={(e) => setType(e.target.value as PostType)}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
    <label className="form-label" htmlFor="share-title">제목</label>
    <input id="share-title" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
    <label className="form-label" htmlFor="share-body">내용</label>
    <textarea id="share-body" className="form-input memo-input" value={body} onChange={(e) => setBody(e.target.value)} />
    {type === 'event' && <><label className="form-label" htmlFor="share-date">날짜와 시간</label><input id="share-date" type="datetime-local" className="form-input" value={eventAt} onChange={(e) => setEventAt(e.target.value)} /></>}
    {type === 'todo' && <><label className="form-label" htmlFor="share-due">마감 날짜 (선택)</label><input id="share-due" type="date" className="form-input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></>}
    <label className="form-label" htmlFor="share-author">작성자 표기</label>
    <select id="share-author" className="form-input" value={authorLabel} onChange={(e) => setAuthorLabel(e.target.value)}>
      <option value="">선택해 주세요</option>
      {visibleSpaces(state).map((space) => <option key={space.id} value={space.name}>{space.name}</option>)}
      <option value={ANONYMOUS_LABEL}>{ANONYMOUS_LABEL}</option>
    </select>
    <label className="share-consent"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> 이 내용을 공용 게시판에 공개하는 데 동의해요.</label>
    <button className="btn btn-primary wide" disabled={!valid} onClick={() => { if (!valid) return; dispatch({ type: 'PUBLISH_POST', draft: { type, title: title.trim(), body: body.trim(), eventAt: type === 'event' ? new Date(eventAt).toISOString() : undefined, dueAt: type === 'todo' && dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : undefined, authorLabel, confirmRequested: false, origin: message ? 'message' : memo ? 'memo' : 'manual', fromMemoId: memo?.id, fromMessageId: message?.id } }); clearDraft(); nav('/board') }}>공용 게시판에 올리기</button>
  </div>
}
