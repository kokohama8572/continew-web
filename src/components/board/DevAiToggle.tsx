import { useStore } from '../../state/store'

/** 개발·공개 미리보기용. 실제 AI 동의 화면(F-05-1)이 생기면 교체한다. */
export default function DevAiToggle() {
  const { state, dispatch } = useStore()
  const on = state.settings.aiSummaryEnabled
  const preview = import.meta.env.PROD && import.meta.env.VITE_USE_MOCK_SUMMARY === 'true'
  return (
    <div className="dev-box">
      <span>{preview ? '화면 체험용 요약' : '개발용 · AI 요약'} {on ? '켜짐' : '꺼짐'}</span>
      <button className="mini mini-ghost" onClick={() => dispatch({ type: 'SET_AI', enabled: !on, consentAt: !on ? new Date().toISOString() : undefined })}>
        {on ? '끄기' : '켜기'}
      </button>
    </div>
  )
}
