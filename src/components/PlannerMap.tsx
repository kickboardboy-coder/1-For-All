import { useEffect, useRef, useState } from 'react';
import { Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  usePlaceSearch,
  toPlaceSearchResult,
  type PlaceSearchInput,
  type PlaceSearchResult,
} from './PlaceSearchRunner';
import { mapsUnavailableMessage, useMapsStatus } from './MapsProvider';
import { formatPlaceSchedule } from '../utils/placeSchedule';
import plannerClose from '../assets/planner-close.svg';

const mapPlaceFields = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'primaryType',
  'types',
  'regularOpeningHours',
  'photos',
];
const mapPlaceIconFields = ['svgIconMaskURI', 'iconBackgroundColor'];

type PlannerMapProps = {
  latitude: number;
  longitude: number;
  zoom: number;
  places: PlaceSearchResult[];
  pinnedPlace?: PlaceSearchResult | null;
  selectedPlaceId: string | null;
  focus: 'results' | 'place';
  onSelectPlace: (placeId: string | null) => void;
  savedPlaceNames: string[];
  isAddingPlace: boolean;
  onAddPlace: (place: PlaceSearchResult) => void;
};

function MapCamera({ latitude, longitude, zoom }: Pick<PlannerMapProps, 'latitude' | 'longitude' | 'zoom'>) {
  const map = useMap();

  useEffect(() => {
    map?.moveCamera({ center: { lat: latitude, lng: longitude }, zoom });
  }, [map, latitude, longitude, zoom]);

  return null;
}

function MapPlaceClicks({
  onPick,
}: {
  onPick: (placeId: string, latitude: number | null, longitude: number | null) => void;
}) {
  const map = useMap();
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  });

  useEffect(() => {
    if (!map) {
      return;
    }

    const listener = map.addListener(
      'click',
      (event: { placeId?: string; latLng?: { lat: () => number; lng: () => number }; stop?: () => void }) => {
        if (!event.placeId) {
          return;
        }

        event.stop?.();
        onPickRef.current(event.placeId, event.latLng?.lat() ?? null, event.latLng?.lng() ?? null);
      },
    );

    return () => {
      listener.remove();
    };
  }, [map]);

  return null;
}

function MapPlaces({
  places,
  pinnedPlace,
  selectedPlaceId,
  focus,
  onSelectPlace,
}: Pick<PlannerMapProps, 'places' | 'pinnedPlace' | 'selectedPlaceId' | 'focus' | 'onSelectPlace'>) {
  const map = useMap();

  useEffect(() => {
    if (!map) {
      return;
    }

    const selected =
      places.find((place) => place.id === selectedPlaceId) ??
      (pinnedPlace?.id === selectedPlaceId ? pinnedPlace : null);

    if (focus === 'place' && selected) {
      map.moveCamera({ center: { lat: selected.latitude, lng: selected.longitude }, zoom: 15 });
      return;
    }

    if (places.length === 0) {
      return;
    }

    if (places.length === 1) {
      map.moveCamera({ center: { lat: places[0].latitude, lng: places[0].longitude }, zoom: 15 });
      return;
    }

    const latitudes = places.map((place) => place.latitude);
    const longitudes = places.map((place) => place.longitude);
    map.fitBounds({
      north: Math.max(...latitudes),
      south: Math.min(...latitudes),
      east: Math.max(...longitudes),
      west: Math.min(...longitudes),
    });
  }, [map, places, pinnedPlace, selectedPlaceId, focus]);

  return (
    <>
      {places.map((place, index) => (
        <Marker
          key={place.id}
          position={{ lat: place.latitude, lng: place.longitude }}
          title={place.name}
          label={{ text: String(index + 1), color: '#ffffff', fontWeight: '700' }}
          zIndex={place.id === selectedPlaceId ? 2 : 1}
          onClick={() => onSelectPlace(place.id)}
        />
      ))}
      {pinnedPlace && !places.some((place) => place.id === pinnedPlace.id) && (
        <Marker
          key={pinnedPlace.id}
          position={{ lat: pinnedPlace.latitude, lng: pinnedPlace.longitude }}
          title={pinnedPlace.name}
          zIndex={3}
          onClick={() => onSelectPlace(pinnedPlace.id)}
        />
      )}
    </>
  );
}

function PlannerMap({
  latitude,
  longitude,
  zoom,
  places,
  pinnedPlace = null,
  selectedPlaceId,
  focus,
  onSelectPlace,
  savedPlaceNames,
  isAddingPlace,
  onAddPlace,
}: PlannerMapProps) {
  const status = useMapsStatus();
  const placesLibrary = useMapsLibrary('places');
  const [mapPlace, setMapPlace] = useState<PlaceSearchResult | null>(null);
  const [pinDetails, setPinDetails] = useState<PlaceSearchResult | null>(null);
  const pickSeq = useRef(0);
  const pinSeq = useRef(0);
  const selectedFromPin = pinnedPlace?.id === selectedPlaceId ? pinnedPlace : null;
  const selectedPlace =
    places.find((place) => place.id === selectedPlaceId) ??
    (selectedFromPin
      ? {
          ...selectedFromPin,
          address: pinDetails?.address ?? selectedFromPin.address,
          iconUrl: pinDetails?.iconUrl ?? selectedFromPin.iconUrl,
          iconBackgroundColor: pinDetails?.iconBackgroundColor ?? selectedFromPin.iconBackgroundColor,
          photoUrl: pinDetails?.photoUrl ?? selectedFromPin.photoUrl,
          openingHours: selectedFromPin.openingHours ?? pinDetails?.openingHours ?? null,
          closedDays: selectedFromPin.closedDays ?? pinDetails?.closedDays ?? null,
          breakTime: selectedFromPin.breakTime ?? pinDetails?.breakTime ?? null,
        }
      : null) ??
    mapPlace;
  const selectedIndex = selectedPlace ? places.findIndex((place) => place.id === selectedPlace.id) : -1;
  const mapsPlaceId = selectedFromPin && pinDetails?.id ? pinDetails.id : selectedPlace?.id;
  const placeSchedule = selectedPlace ? formatPlaceSchedule(selectedPlace) : '';

  useEffect(() => {
    if (places.some((place) => place.id === selectedPlaceId)) {
      setMapPlace(null);
    }
  }, [places, selectedPlaceId]);

  useEffect(() => {
    if (!placesLibrary || !pinnedPlace || selectedPlaceId !== pinnedPlace.id) {
      setPinDetails(null);
      return;
    }

    let ignore = false;
    const seq = ++pinSeq.current;

    void (async () => {
      try {
        const { places: found } = await placesLibrary.Place.searchByText({
          textQuery: pinnedPlace.name,
          fields: mapPlaceFields,
          language: 'ko',
          region: 'KR',
          maxResultCount: 1,
          locationBias: { center: { lat: pinnedPlace.latitude, lng: pinnedPlace.longitude }, radius: 500 },
        });
        const first = found?.[0];

        if (!first || ignore || seq !== pinSeq.current) {
          return;
        }

        try {
          await first.fetchFields({ fields: mapPlaceIconFields });
        } catch {
          // 아이콘은 없어도 주소·영업시간은 카드에 넣는다.
        }

        if (ignore || seq !== pinSeq.current) {
          return;
        }

        const result = toPlaceSearchResult({
          id: first.id,
          displayName: first.displayName,
          formattedAddress: first.formattedAddress,
          location: first.location ?? { lat: pinnedPlace.latitude, lng: pinnedPlace.longitude },
          primaryType: first.primaryType,
          types: first.types,
          regularOpeningHours: first.regularOpeningHours,
          svgIconMaskURI: first.svgIconMaskURI,
          iconBackgroundColor: first.iconBackgroundColor,
          photos: first.photos,
        });

        if (result) {
          setPinDetails(result);
        }
      } catch {
        if (!ignore && seq === pinSeq.current) {
          setPinDetails(null);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [placesLibrary, pinnedPlace, selectedPlaceId]);

  async function pickMapPlace(placeId: string, latitude: number | null, longitude: number | null) {
    const seq = ++pickSeq.current;
    const searched = places.find((place) => place.id === placeId);

    if (searched) {
      setMapPlace(null);
      onSelectPlace(searched.id);
      return;
    }

    setMapPlace(null);
    onSelectPlace(null);

    if (!placesLibrary) {
      return;
    }

    try {
      const place = new placesLibrary.Place({ id: placeId });
      await place.fetchFields({ fields: mapPlaceFields });

      try {
        await place.fetchFields({ fields: mapPlaceIconFields });
      } catch {
        // 아이콘 필드는 없어도 이름만 있으면 카드를 연다.
      }

      if (seq !== pickSeq.current) {
        return;
      }

      const result = toPlaceSearchResult({
        id: place.id || placeId,
        displayName: place.displayName,
        formattedAddress: place.formattedAddress,
        location:
          place.location ?? (latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null),
        primaryType: place.primaryType,
        types: place.types,
        regularOpeningHours: place.regularOpeningHours,
        svgIconMaskURI: place.svgIconMaskURI,
        iconBackgroundColor: place.iconBackgroundColor,
        photos: place.photos,
      });

      if (!result) {
        return;
      }

      setMapPlace(result);
      onSelectPlace(result.id);
    } catch {
      // 이름·위치를 못 받으면 빈 카드는 열지 않는다.
    }
  }

  if (status !== 'ready') {
    return (
      <div className="planner-map" role="alert">
        <p>{mapsUnavailableMessage(status)}</p>
      </div>
    );
  }

  return (
    <div className="planner-map">
      <Map
        className="planner-map-canvas"
        defaultCenter={{ lat: latitude, lng: longitude }}
        defaultZoom={zoom}
        gestureHandling="greedy"
        colorScheme="LIGHT"
        clickableIcons
      >
        <MapCamera latitude={latitude} longitude={longitude} zoom={zoom} />
        <MapPlaceClicks onPick={(placeId, latitude, longitude) => void pickMapPlace(placeId, latitude, longitude)} />
        <MapPlaces
          places={places}
          pinnedPlace={pinnedPlace}
          selectedPlaceId={selectedPlaceId}
          focus={focus}
          onSelectPlace={onSelectPlace}
        />
      </Map>
      {selectedPlace && (
        <article className="planner-place-card">
          <button
            type="button"
            className="planner-place-card-close"
            aria-label="장소 정보 닫기"
            onClick={() => {
              setMapPlace(null);
              onSelectPlace(null);
            }}
          >
            <img src={plannerClose} alt="" />
          </button>
          {selectedPlace.photoUrl ? (
            <div className="planner-place-card-photo">
              <img src={selectedPlace.photoUrl} alt="" />
              {selectedIndex >= 0 && <span>{selectedIndex + 1}</span>}
            </div>
          ) : selectedIndex >= 0 ? (
            <span>{selectedIndex + 1}</span>
          ) : selectedPlace.iconUrl ? (
            <span
              className="planner-place-google-icon"
              style={{ background: selectedPlace.iconBackgroundColor ?? '#27846e' }}
            >
              <img src={selectedPlace.iconUrl} alt="" />
            </span>
          ) : (
            <span>·</span>
          )}
          <div className="planner-place-card-copy">
            <strong>{selectedPlace.name}</strong>
            {selectedPlace.address && <p className="planner-place-card-address">{selectedPlace.address}</p>}
            {placeSchedule !== '영업시간 정보 없음' && <p>{placeSchedule}</p>}
          </div>
          <div className="planner-place-card-actions">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.name)}${mapsPlaceId ? `&query_place_id=${encodeURIComponent(mapsPlaceId)}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              구글에서 보기
            </a>
            <button
              type="button"
              disabled={isAddingPlace || savedPlaceNames.includes(selectedPlace.name)}
              onClick={() => onAddPlace(selectedPlace)}
            >
              {savedPlaceNames.includes(selectedPlace.name) ? '담김' : '주머니에 담기'}
            </button>
          </div>
        </article>
      )}
    </div>
  );
}

export function PlannerMapPanel({
  placeSearch,
  hubSearch,
  ...mapProps
}: PlannerMapProps & { placeSearch: PlaceSearchInput; hubSearch: PlaceSearchInput }) {
  usePlaceSearch(placeSearch);
  usePlaceSearch(hubSearch);
  return <PlannerMap {...mapProps} />;
}
