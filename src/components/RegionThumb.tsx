import { useEffect, useState } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { findRegion } from '../data/destinations'

const photoCache = new Map<string, string>()

type RegionThumbProps = {
  country: string | null
  region: string
}

function RegionThumb({ country, region }: RegionThumbProps) {
  const places = useMapsLibrary('places')
  const [photoUrl, setPhotoUrl] = useState(() => photoCache.get(`${country}:${region}`) ?? null)

  useEffect(() => {
    const cacheKey = `${country}:${region}`
    const cached = photoCache.get(cacheKey)

    if (cached) {
      setPhotoUrl(cached)
      return
    }

    if (!places) {
      return
    }

    const destination = findRegion(country, region)
    const query = destination?.landmark ?? region
    let ignore = false

    places.Place.searchByText({
      textQuery: query,
      fields: ['photos'],
      language: 'ko',
      maxResultCount: 1,
      locationBias: destination
        ? { center: { lat: destination.latitude, lng: destination.longitude }, radius: 25000 }
        : undefined,
    })
      .then(({ places: found }: { places: Array<{ photos?: Array<{ getURI?: (options?: { maxWidth?: number; maxHeight?: number }) => string }> | null }> }) => {
        const photo = found[0]?.photos?.[0]
        const url = typeof photo?.getURI === 'function' ? photo.getURI({ maxWidth: 200, maxHeight: 200 }) : null

        if (ignore || !url) {
          return
        }

        photoCache.set(cacheKey, url)
        setPhotoUrl(url)
      })
      .catch(() => {
        // 사진을 못 받아도 빈 칸만 두고 목록은 그대로 둔다.
      })

    return () => {
      ignore = true
    }
  }, [country, places, region])

  return (
    <div className="plan-card-thumb" aria-hidden="true">
      {photoUrl ? <img src={photoUrl} alt="" /> : null}
    </div>
  )
}

export default RegionThumb
