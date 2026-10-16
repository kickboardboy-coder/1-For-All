import { useEffect, useState } from 'react'
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps'

type PlannerMapProps = {
  latitude: number
  longitude: number
  zoom: number
}

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function MapCamera({ latitude, longitude, zoom }: PlannerMapProps) {
  const map = useMap()

  useEffect(() => {
    map?.moveCamera({ center: { lat: latitude, lng: longitude }, zoom })
  }, [map, latitude, longitude, zoom])

  return null
}

function PlannerMap({ latitude, longitude, zoom }: PlannerMapProps) {
  const [loadError, setLoadError] = useState(false)

  if (!apiKey || loadError) {
    return (
      <div className="planner-map">
        <p>{apiKey ? '지도를 불러오지 못했습니다.' : '구글 지도 API 키를 설정해 주세요.'}</p>
      </div>
    )
  }

  return (
    <div className="planner-map">
      <APIProvider apiKey={apiKey} language="ko" region="KR" onError={() => setLoadError(true)}>
        <Map
          className="planner-map-canvas"
          defaultCenter={{ lat: latitude, lng: longitude }}
          defaultZoom={zoom}
          gestureHandling="greedy"
          colorScheme="LIGHT"
        >
          <MapCamera latitude={latitude} longitude={longitude} zoom={zoom} />
        </Map>
      </APIProvider>
    </div>
  )
}

export default PlannerMap
