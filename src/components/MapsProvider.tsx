import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'

type MapsStatus = 'ready' | 'missing' | 'failed'

const MapsStatusContext = createContext<MapsStatus>('missing')

export function useMapsStatus() {
  return useContext(MapsStatusContext)
}

export function mapsUnavailableMessage(status: Exclude<MapsStatus, 'ready'>) {
  return status === 'missing'
    ? '구글 지도 API 키를 설정해 주세요.'
    : '지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

type MapsProviderProps = {
  children: ReactNode
}

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function MapsProvider({ children }: MapsProviderProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const mapWindow = window as Window & { gm_authFailure?: () => void }
    const previous = mapWindow.gm_authFailure

    mapWindow.gm_authFailure = () => {
      setFailed(true)
      previous?.()
    }

    return () => {
      mapWindow.gm_authFailure = previous
    }
  }, [])

  if (!apiKey || failed) {
    return <MapsStatusContext.Provider value={apiKey ? 'failed' : 'missing'}>{children}</MapsStatusContext.Provider>
  }

  return (
    <APIProvider apiKey={apiKey} language="ko" region="KR" onError={() => setFailed(true)}>
      <MapsStatusContext.Provider value="ready">{children}</MapsStatusContext.Provider>
    </APIProvider>
  )
}

export default MapsProvider
