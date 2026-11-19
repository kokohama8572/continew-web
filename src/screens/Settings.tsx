import BackupPanel from '../components/BackupPanel'
import { Link } from 'react-router-dom'
import { useLock } from '../security/LockProvider'
import { useState } from 'react'
import { useStore } from '../state/store'

// SCR-09 설정 · 우선 기기 변경용 백업과 복원을 제공한다.
export default function SettingsScreen() {
  const { hasPin, delay, setDelay, lock } = useLock()
  const { state, dispatch } = useStore()
  const [consent, setConsent] = useState(false)
  const aiOn = state.settings.aiSummaryEnabled && !!state.settings.aiConsentAt
  const preview = import.meta.env.VITE_USE_MOCK_SUMMARY === 'true'
  return (
    <div className="page page-settings">
      <h1>설정</h1>
      <section className="settings-section">
        <h2>공용 기록 요약</h2>
        {preview ? (
          <p className="sub">화면 체험용 요약입니다. 서버에 기록을 보내지 않아요.</p>
        ) : (
          <p className="sub">요약을 요청하면 선택한 기간의 공용 게시글과 대화가 contiNEW 서버로 전송돼요. 서버 설정에 따라 외부 AI 제공자에게도 전달될 수 있어요. 개인 메모는 보내지 않아요. 실제 기록을 쓰기 전에 운영자의 데이터 처리 안내를 확인해 주세요.</p>
        )}
        {aiOn ? (
          <button className="btn btn-ghost wide" onClick={() => { dispatch({ type: 'SET_AI', enabled: false }); setConsent(false) }}>요약 끄기</button>
        ) : (
          <>
            {!preview && <label className="share-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> 공용 기록 전송 내용을 이해하고 요약 사용에 동의해요.</label>}
            <button className="btn btn-ghost wide" disabled={!preview && !consent} onClick={() => { dispatch({ type: 'SET_AI', enabled: true, consentAt: new Date().toISOString() }); setConsent(false) }}>요약 켜기</button>
          </>
        )}
      </section>
      <section className="settings-section">
        <h2>앱 잠금</h2>
        <p className="sub">PIN은 앱 화면만 잠급니다. 브라우저에 저장된 기록은 암호화되지 않습니다.</p>
        {hasPin ? (
          <>
            <label className="backup-pin-label" htmlFor="lock-delay">
              앱을 벗어난 뒤 잠금
            </label>
            <select
              id="lock-delay"
              className="settings-select"
              value={delay}
              onChange={(event) => setDelay(event.target.value as typeof delay)}
            >
              <option value="instant">즉시</option>
              <option value="1m">1분 후</option>
              <option value="5m">5분 후</option>
            </select>
            <button className="btn btn-ghost wide" onClick={lock}>
              지금 잠그기
            </button>
          </>
        ) : (
          <Link className="btn btn-ghost wide settings-link" to="/lock" state={{ from: '/settings' }}>
            PIN 설정하기
          </Link>
        )}
      </section>
      <BackupPanel />
    </div>
  )
}
