import { describe, expect, it } from 'vitest'
import { makeSeed } from '../mocks/seed'
import { reducer, type PostDraft } from './reducer'
import { memosOf, sortBoard } from './selectors'

const draft: PostDraft = {
  type: 'note',
  title: '테스트',
  body: '',
  authorLabel: '하루',
  confirmRequested: false,
  origin: 'manual',
}

describe('원칙2 · 작성자 표기는 직접 고른 뒤에만', () => {
  it('작성자 표기가 비어 있으면 게시되지 않는다', () => {
    const s = makeSeed()
    expect(reducer(s, { type: 'PUBLISH_POST', draft: { ...draft, authorLabel: '' } })).toBe(s)
  })
  it('메시지도 작성자 표기가 비어 있으면 보내지지 않는다', () => {
    const s = makeSeed()
    expect(reducer(s, { type: 'SEND_MESSAGE', body: '안녕', authorLabel: '' })).toBe(s)
  })
  it('일정은 날짜·시간 없이 게시되지 않는다', () => {
    const s = makeSeed()
    expect(reducer(s, { type: 'PUBLISH_POST', draft: { ...draft, type: 'event' } })).toBe(s)
  })
})

describe('대화에서 공용 할 일로 옮기기', () => {
  it('마감일과 원문 메시지 연결을 저장한다', () => {
    const before = makeSeed()
    const dueAt = '2026-11-20T00:00:00.000Z'
    const after = reducer(before, {
      type: 'PUBLISH_POST',
      draft: { ...draft, type: 'todo', origin: 'message', fromMessageId: before.messages[0].id, dueAt },
    })
    expect(after.posts[0]).toMatchObject({ type: 'todo', origin: 'message', sourceMessageId: before.messages[0].id, dueAt })
    expect(after.messages).toEqual(before.messages)
  })
})

describe('공간에서 보낸 메시지 수정·삭제', () => {
  it('보낸 공간에서만 수정하고 삭제할 수 있다', () => {
    let state = reducer(makeSeed(), { type: 'OPEN_SPACE', id: 'space_a' })
    state = reducer(state, { type: 'SEND_MESSAGE', body: '원문', authorLabel: '이름 없이' })
    const id = state.messages.at(-1)!.id
    expect(state.messages.at(-1)?.senderSpaceId).toBe('space_a')
    const otherSpace = reducer(state, { type: 'OPEN_SPACE', id: 'space_b' })
    expect(reducer(otherSpace, { type: 'EDIT_MESSAGE', id, body: '변경' }).messages.at(-1)?.body).toBe('원문')
    expect(reducer(otherSpace, { type: 'DELETE_MESSAGE', id }).messages.at(-1)?.deletedAt).toBeNull()
    const edited = reducer(state, { type: 'EDIT_MESSAGE', id, body: '변경' })
    expect(edited.messages.at(-1)?.body).toBe('변경')
    expect(edited.messages.at(-1)?.editedAt).toBeTruthy()
    expect(reducer(edited, { type: 'DELETE_MESSAGE', id }).messages.at(-1)?.deletedAt).toBeTruthy()
  })
})

describe('공용 기록 요약 동의', () => {
  it('동의 시각 없이 요약을 켤 수 없고, 끄면 동의 기록도 지운다', () => {
    const initial = makeSeed()
    const withoutConsent = reducer(initial, { type: 'SET_AI', enabled: true })
    expect(withoutConsent.settings.aiSummaryEnabled).toBe(false)
    const enabled = reducer(initial, { type: 'SET_AI', enabled: true, consentAt: '2026-11-19T00:00:00.000Z' })
    expect(enabled.settings.aiSummaryEnabled).toBe(true)
    const disabled = reducer(enabled, { type: 'SET_AI', enabled: false })
    expect(disabled.settings).toMatchObject({ aiSummaryEnabled: false })
    expect(disabled.settings.aiConsentAt).toBeUndefined()
  })
})

describe('8장 · 공간 id 미저장', () => {
  it('게시물·확인 기록에 공간 id가 들어가지 않는다', () => {
    let s = reducer(makeSeed(), { type: 'OPEN_SPACE', id: 'space_a' })
    s = reducer(s, { type: 'PUBLISH_POST', draft })
    s = reducer(s, { type: 'CONFIRM', targetType: 'post', targetId: s.posts[0].id })
    expect(JSON.stringify(s.posts[0])).not.toContain('space_a')
    expect(JSON.stringify(s.confirmations[0])).not.toContain('space_a')
    expect(s.confirmations[0].confirmLabel).toBe('이름 없이')
  })
})

describe('원칙1 · 개인 메모는 열린 공간에서만', () => {
  it('다른 공간의 메모는 읽히지 않는다', () => {
    const s = makeSeed()
    expect(memosOf(s, 'space_a').every((m) => m.spaceId === 'space_a')).toBe(true)
    expect(memosOf(s, null)).toEqual([])
  })
  it('다른 공간에서는 메모를 고칠 수 없다', () => {
    let s = reducer(makeSeed(), { type: 'OPEN_SPACE', id: 'space_b' })
    s = reducer(s, { type: 'UPDATE_MEMO', id: 'memo_1', body: '바꿈' })
    expect(s.memos.find((m) => m.id === 'memo_1')?.body).not.toBe('바꿈')
  })
})

describe('공간 수정', () => {
  it('이름과 모습을 저장하고 기존 메모와 홈 구성은 유지한다', () => {
    const before = makeSeed()
    const original = before.spaces[0]
    const after = reducer(before, {
      type: 'UPDATE_SPACE', id: original.id, name: '새 이름', description: '새 설명',
      icon: 'cloud', color: '#ffffff',
    })
    expect(after.spaces[0]).toMatchObject({ id: original.id, name: '새 이름', description: '새 설명' })
    expect(after.spaces[0].homeWidgets).toEqual(original.homeWidgets)
    expect(after.memos).toEqual(before.memos)
  })
  it('중복된 이름은 저장하지 않는다', () => {
    const before = makeSeed()
    const after = reducer(before, {
      type: 'UPDATE_SPACE', id: before.spaces[0].id, name: before.spaces[1].name,
      description: '', icon: 'cloud', color: '#ffffff',
    })
    expect(after).toBe(before)
  })
})

describe('F-03-5 · 게시판 정렬', () => {
  it('주의사항 → 일정 → 할 일 → 메모 순이고 지난 일정은 past로 간다', () => {
    const { active, past } = sortBoard(makeSeed().posts)
    const rank = { caution: 0, event: 1, todo: 2, note: 3 }
    const ranks = active.map((p) => rank[p.type])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    const events = active.filter((p) => p.type === 'event').map((p) => p.eventAt ?? '')
    expect(events).toEqual([...events].sort())
    expect(past.map((p) => p.id).sort()).toEqual(['post_5', 'post_6'])
  })
})

describe('기기 변경용 복원', () => {
  it('백업 상태로 전체 기록을 교체하고 열린 공간은 닫는다', () => {
    const current = makeSeed()
    const restored = { ...makeSeed(), currentSpaceId: 'space_b', messages: [] }
    const result = reducer(current, { type: 'RESTORE_BACKUP', state: restored })
    expect(result.messages).toEqual([])
    expect(result.currentSpaceId).toBeNull()
    expect(result.memos).toEqual(restored.memos)
  })
})
