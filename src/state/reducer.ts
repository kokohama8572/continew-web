import type { BoardPost, Confirmation, HomeWidget, Memo, Message, PostType, Space } from '../types/model'
import { ANONYMOUS_LABEL, DEFAULT_WIDGETS } from '../types/model'
import { newId, nowIso } from './utils'

export interface AppState {
  spaces: Space[]
  memos: Memo[]
  posts: BoardPost[]
  messages: Message[]
  confirmations: Confirmation[]
  /** 공간별로 공용 영역을 마지막으로 연 시각 (F-03-9). 읽었다는 표시가 아님 */
  boardViewed: Record<string, string>
  currentSpaceId: string | null
  settings: { aiSummaryEnabled: boolean; aiConsentAt?: string; notifyPreview: boolean }
}

export interface PostDraft {
  type: PostType
  title: string
  body: string
  eventAt?: string
  place?: string
  dueAt?: string
  /** 사용자가 직접 고른 표기. 비어 있으면 게시할 수 없다 (원칙2, F-03-3) */
  authorLabel: string
  confirmRequested: boolean
  origin: BoardPost['origin']
  fromMemoId?: string
  fromMessageId?: string
}

export type Action =
  | { type: 'RESTORE_BACKUP'; state: AppState }
  | { type: 'OPEN_SPACE'; id: string }
  | { type: 'CLOSE_SPACE' }
  | { type: 'ADD_SPACE'; name: string; color: string; icon?: string; description?: string }
  | { type: 'UPDATE_SPACE'; id: string; name: string; color: string; icon: string; description: string }
  | { type: 'SET_SPACE_HIDDEN'; id: string; hidden: boolean }
  | { type: 'MOVE_SPACE'; id: string; direction: 'up' | 'down' }
  | { type: 'SET_WIDGETS'; spaceId: string; widgets: HomeWidget[] }
  | { type: 'ADD_MEMO'; body: string }
  | { type: 'UPDATE_MEMO'; id: string; body: string }
  | { type: 'DELETE_MEMO'; id: string }
  | { type: 'PUBLISH_POST'; draft: PostDraft }
  | { type: 'SEND_MESSAGE'; body: string; authorLabel: string; replyToId?: string }
  | { type: 'EDIT_MESSAGE'; id: string; body: string }
  | { type: 'DELETE_MESSAGE'; id: string }
  | { type: 'CONFIRM'; id?: string; targetType: 'post' | 'message'; targetId: string; label?: string }
  | { type: 'UNCONFIRM'; id: string }
  | { type: 'TOGGLE_TODO'; id: string }
  | { type: 'MARK_BOARD_VIEWED' }
  | { type: 'SET_AI'; enabled: boolean; consentAt?: string }

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'RESTORE_BACKUP':
      return { ...a.state, currentSpaceId: null }
    case 'OPEN_SPACE':
      return s.spaces.some((x) => x.id === a.id && !x.hidden && !x.deletedAt) ? { ...s, currentSpaceId: a.id } : s
    case 'CLOSE_SPACE':
      return { ...s, currentSpaceId: null }
    case 'ADD_SPACE': {
      const name = a.name.trim()
      if (name.length < 1 || name.length > 20) return s // F-01-1
      if (s.spaces.some((x) => x.name === name && !x.deletedAt)) return s // 중복 불가
      const space: Space = {
        id: newId('space'),
        name,
        color: a.color,
        icon: a.icon,
        description: a.description,
        homeWidgets: DEFAULT_WIDGETS.map((w) => ({ ...w })),
        sortOrder: s.spaces.length,
        hidden: false,
        deletedAt: null,
        aiMemoEnabled: false,
      }
      return { ...s, spaces: [...s.spaces, space] }
    }
    case 'UPDATE_SPACE': {
      const name = a.name.trim()
      if (!name || name.length > 20 || s.spaces.some((x) => x.id !== a.id && !x.deletedAt && x.name === name)) return s
      return {
        ...s,
        spaces: s.spaces.map((x) => x.id === a.id && !x.deletedAt
          ? { ...x, name, color: a.color, icon: a.icon, description: a.description.trim() }
          : x),
      }
    }
    case 'SET_SPACE_HIDDEN': {
      const space = s.spaces.find((x) => x.id === a.id && !x.deletedAt)
      if (!space || space.hidden === a.hidden) return s
      return {
        ...s,
        spaces: s.spaces.map((x) => x.id === a.id ? { ...x, hidden: a.hidden } : x),
        currentSpaceId: a.hidden && s.currentSpaceId === a.id ? null : s.currentSpaceId,
      }
    }
    case 'MOVE_SPACE': {
      const ordered = s.spaces.filter((x) => !x.deletedAt).sort((x, y) => x.sortOrder - y.sortOrder)
      const index = ordered.findIndex((x) => x.id === a.id)
      const nextIndex = index + (a.direction === 'up' ? -1 : 1)
      if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return s
      const moved = ordered[index]
      ordered[index] = ordered[nextIndex]
      ordered[nextIndex] = moved
      const orderById = new Map(ordered.map((space, position) => [space.id, position]))
      return { ...s, spaces: s.spaces.map((space) => ({ ...space, sortOrder: orderById.get(space.id) ?? space.sortOrder })) }
    }
    case 'SET_WIDGETS':
      return {
        ...s,
        spaces: s.spaces.map((x) => (x.id === a.spaceId ? { ...x, homeWidgets: a.widgets } : x)),
      }
    case 'ADD_MEMO': {
      if (!s.currentSpaceId) return s
      const t = nowIso()
      const memo: Memo = {
        id: newId('memo'),
        spaceId: s.currentSpaceId,
        body: a.body,
        pinned: false,
        sharedPostIds: [],
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
      }
      return { ...s, memos: [memo, ...s.memos] }
    }
    case 'UPDATE_MEMO':
      return {
        ...s,
        memos: s.memos.map((m) =>
          m.id === a.id && m.spaceId === s.currentSpaceId ? { ...m, body: a.body, updatedAt: nowIso() } : m,
        ),
      }
    case 'DELETE_MEMO': // 휴지통으로 (F-02-4)
      return {
        ...s,
        memos: s.memos.map((m) =>
          m.id === a.id && m.spaceId === s.currentSpaceId ? { ...m, deletedAt: nowIso() } : m,
        ),
      }
    case 'PUBLISH_POST': {
      const d = a.draft
      if (!d.authorLabel.trim()) return s // 작성자 표기를 고르기 전에는 게시 불가
      if (d.type === 'event' && !d.eventAt) return s // 일정은 날짜·시간 필수
      const t = nowIso()
      // BoardPost에는 공간 id를 저장하지 않는다 (8장)
      const post: BoardPost = {
        id: newId('post'),
        type: d.type,
        title: d.title,
        body: d.body,
        eventAt: d.eventAt,
        place: d.place,
        dueAt: d.dueAt,
        authorLabel: d.authorLabel,
        origin: d.origin,
        sourceMessageId: d.fromMessageId,
        pinned: d.type === 'caution',
        confirmRequested: d.type !== 'note' && d.confirmRequested,
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
      }
      return {
        ...s,
        posts: [post, ...s.posts],
        memos: d.fromMemoId
          ? s.memos.map((m) =>
              m.id === d.fromMemoId ? { ...m, sharedPostIds: [...m.sharedPostIds, post.id] } : m,
            )
          : s.memos,
      }
    }
    case 'SEND_MESSAGE': {
      if (!a.authorLabel.trim() || !a.body.trim()) return s
      const replyToId = a.replyToId && s.messages.some((message) => message.id === a.replyToId && !message.deletedAt)
        ? a.replyToId : undefined
      const msg: Message = {
        id: newId('msg'),
        body: a.body,
        authorLabel: a.authorLabel,
        senderSpaceId: s.currentSpaceId ?? undefined,
        replyToId,
        createdAt: nowIso(),
        deletedAt: null,
      }
      return { ...s, messages: [...s.messages, msg] }
    }
    case 'EDIT_MESSAGE': {
      const body = a.body.trim()
      if (!body || body.length > 5000 || !s.currentSpaceId) return s
      return {
        ...s,
        messages: s.messages.map((message) => message.id === a.id && !message.deletedAt && message.senderSpaceId === s.currentSpaceId
          ? { ...message, body, editedAt: nowIso() }
          : message),
      }
    }
    case 'DELETE_MESSAGE': {
      if (!s.currentSpaceId) return s
      return {
        ...s,
        messages: s.messages.map((message) => message.id === a.id && !message.deletedAt && message.senderSpaceId === s.currentSpaceId
          ? { ...message, deletedAt: nowIso() }
          : message),
      }
    }
    case 'CONFIRM': {
      // 공간 id는 저장하지 않는다. 표기 글자만 (F-04-9)
      const c: Confirmation = {
        id: a.id ?? newId('conf'),
        targetType: a.targetType,
        targetId: a.targetId,
        confirmedAt: nowIso(),
        confirmLabel: a.label ?? ANONYMOUS_LABEL,
      }
      return { ...s, confirmations: [...s.confirmations, c] }
    }
    case 'UNCONFIRM':
      return { ...s, confirmations: s.confirmations.filter((c) => c.id !== a.id) }
    case 'TOGGLE_TODO':
      return {
        ...s,
        posts: s.posts.map((p) =>
          p.id === a.id && p.type === 'todo' ? { ...p, doneAt: p.doneAt ? undefined : nowIso() } : p,
        ),
      }
    case 'MARK_BOARD_VIEWED':
      return s.currentSpaceId ? { ...s, boardViewed: { ...s.boardViewed, [s.currentSpaceId]: nowIso() } } : s
    case 'SET_AI':
      return { ...s, settings: { ...s.settings, aiSummaryEnabled: a.enabled && !!a.consentAt, aiConsentAt: a.enabled ? a.consentAt : undefined } }
  }
}
