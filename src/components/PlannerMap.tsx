import { useEffect } from 'react'
import { Map, useMap } from '@vis.gl/react-google-maps'
import { useMapsStatus } from './MapsProvider'

type PlannerMapProps = {
  latitude: number
  longitude: number
  zoom: number
}

function MapCamera({ latitude, longitude, zoom }: PlannerMapProps) {
  const map = useMap()

  useEffect(() => {
    map?.moveCamera({ center: { lat: latitude, lng: longitude }, zoom })
  }, [map, latitude, longitude, zoom])

  return null
}

function PlannerMap({ latitude, longitude, zoom }: PlannerMapProps) {
  const status = useMapsStatus()

  if (status !== 'ready') {
    return (
      <div className="planner-map">
        <p>{status === 'missing' ? '구글 지도 API 키를 설정해 주세요.' : '지도를 불러오지 못했습니다.'}</p>
      </div>
    )
  }

  return (
    <div className="planner-map">
      <Map
        className="planner-map-canvas"
        defaultCenter={{ lat: latitude, lng: longitude }}
        defaultZoom={zoom}
        gestureHandling="greedy"
        colorScheme="LIGHT"
      >
        <MapCamera latitude={latitude} longitude={longitude} zoom={zoom} />
      </Map>
    </div>
  )
}

export default PlannerMap
