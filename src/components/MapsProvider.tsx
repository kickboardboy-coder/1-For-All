import { createContext, useContext, useState, type ReactNode } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'

type MapsStatus = 'ready' | 'missing' | 'failed'

const MapsStatusContext = createContext<MapsStatus>('missing')

export function useMapsStatus() {
  return useContext(MapsStatusContext)
}

export function WhenMapsReady({ children }: MapsProviderProps) {
  const status = useMapsStatus()

  if (status !== 'ready') {
    return null
  }

  return children
}

type MapsProviderProps = {
  children: ReactNode
}

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function MapsProvider({ children }: MapsProviderProps) {
  const [failed, setFailed] = useState(false)

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
