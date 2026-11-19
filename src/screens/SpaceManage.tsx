import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, EyeOff, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { SPACE_ICONS, SpaceIcon } from '../components/icons'
import { SPACE_COLORS } from '../styles/palette'
import { useStore } from '../state/store'

export default function SpaceManageScreen() {
  const { state, dispatch } = useStore()
  const nav = useNavigate()
  const { id } = useParams()
  const editing = id && id !== 'new' ? state.spaces.find((space) => space.id === id && !space.deletedAt) : null
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? 'cloud')
  const [color, setColor] = useState<string>(editing?.color ?? SPACE_COLORS[0])
  const trimmed = name.trim()
  const duplicate = state.spaces.some((s) => s.id !== editing?.id && !s.deletedAt && s.name === trimmed)
  const valid = trimmed.length >= 1 && trimmed.length <= 20 && !duplicate
  const managedSpaces = state.spaces.filter((space) => !space.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder)
  if (!id) return (
    <main className="scroll page editor-page">
      <Link to="/spaces" className="back"><ChevronLeft size={20} aria-hidden /> 공간 선택</Link>
      <h1>공간 관리</h1>
      <p className="sub">공간의 이름·모습·순서를 바꿀 수 있어요. 숨겨도 기록은 남고 여기서 다시 보이게 할 수 있어요.</p>
      <ul className="space-list manage-space-list">
        {managedSpaces.map((space, index) => <li key={space.id}>
          <Link className="space-card" to={`/spaces/manage/${space.id}`} style={{ '--c': space.color } as React.CSSProperties}>
            <span className="chip-icon"><SpaceIcon name={space.icon} size={22} /></span>
            <span className="space-text"><strong>{space.name}</strong>{space.hidden && <small>숨김</small>}{space.description && <small>{space.description}</small>}</span>
            <ChevronRight size={18} aria-hidden />
          </Link>
          <div className="manage-space-controls">
            <button type="button" disabled={index === 0} aria-label={`${space.name} 위로 이동`} onClick={() => dispatch({ type: 'MOVE_SPACE', id: space.id, direction: 'up' })}><ArrowUp size={16} aria-hidden /> 위로</button>
            <button type="button" disabled={index === managedSpaces.length - 1} aria-label={`${space.name} 아래로 이동`} onClick={() => dispatch({ type: 'MOVE_SPACE', id: space.id, direction: 'down' })}><ArrowDown size={16} aria-hidden /> 아래로</button>
            <button type="button" aria-label={`${space.name} ${space.hidden ? '다시 보이기' : '숨기기'}`} onClick={() => dispatch({ type: 'SET_SPACE_HIDDEN', id: space.id, hidden: !space.hidden })}>
              {space.hidden ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
              {space.hidden ? '다시 보이기' : '숨기기'}
            </button>
          </div>
        </li>)}
      </ul>
      <Link className="add-space" to="/spaces/manage/new"><Plus size={18} aria-hidden />새 공간 만들기</Link>
    </main>
  )
  if (id !== 'new' && !editing) return <Navigate to="/spaces/manage" replace />
  return (
    <main className="scroll page editor-page">
      <Link to="/spaces/manage" className="back"><ChevronLeft size={20} aria-hidden /> 공간 관리</Link>
      <h1>{editing ? '공간 수정' : '새 공간 만들기'}</h1>
      <p className="sub">목적에 맞게 이름과 모습을 정해 주세요.</p>
      <label className="form-label" htmlFor="space-name">공간 이름 <small>1~20자</small></label>
      <input id="space-name" className="form-input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 공부" autoFocus />
      {duplicate && <p className="form-error" role="alert">이미 사용 중인 공간 이름이에요.</p>}
      <label className="form-label" htmlFor="space-description">한 줄 설명 <small>선택</small></label>
      <input id="space-description" className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="이 공간에서 할 일을 적어 주세요." />
      <span className="form-label" id="space-icon-label">아이콘</span>
      <div className="choice-grid" role="group" aria-labelledby="space-icon-label">
        {Object.keys(SPACE_ICONS).map((key) => <button key={key} type="button" className={`choice-icon${icon === key ? ' selected' : ''}`} aria-label={`${key} 아이콘`} aria-pressed={icon === key} onClick={() => setIcon(key)}><SpaceIcon name={key} /></button>)}
      </div>
      <span className="form-label" id="space-color-label">색상</span>
      <div className="choice-grid" role="group" aria-labelledby="space-color-label">
        {SPACE_COLORS.map((value) => <button key={value} type="button" className={`choice-color${color === value ? ' selected' : ''}`} style={{ background: value }} aria-label={`${value} 색상`} aria-pressed={color === value} onClick={() => setColor(value)} />)}
      </div>
      <button className="btn btn-primary wide" disabled={!valid} onClick={() => {
        dispatch(editing
          ? { type: 'UPDATE_SPACE', id: editing.id, name: trimmed, description: description.trim(), icon, color }
          : { type: 'ADD_SPACE', name: trimmed, description: description.trim(), icon, color })
        nav('/spaces/manage')
      }}>{editing ? '변경 저장' : '공간 만들기'}</button>
    </main>
  )
}
