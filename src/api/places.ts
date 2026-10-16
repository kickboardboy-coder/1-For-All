import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { touchPlan } from './plans'
import { placeCategories, type Place, type PlaceCategory } from '../types/place'

type NewPlace = {
  name: string
  category: PlaceCategory
  latitude: number
  longitude: number
}

function placesCollection(planId: string) {
  return collection(db, 'plans', planId, 'places')
}

function requireUser() {
  if (!auth.currentUser) {
    throw new Error('로그인된 사용자가 없습니다.')
  }
}

function isPlaceCategory(value: unknown): value is PlaceCategory {
  return placeCategories.some((category) => category === value)
}

function toPlace(id: string, planId: string, data: DocumentData): Place | null {
  if (typeof data.name !== 'string' || !isPlaceCategory(data.category)) {
    return null
  }

  return {
    id,
    planId,
    name: data.name,
    latitude: typeof data.latitude === 'number' ? data.latitude : 0,
    longitude: typeof data.longitude === 'number' ? data.longitude : 0,
    category: data.category,
    openingHours: typeof data.openingHours === 'string' ? data.openingHours : null,
    closedDays: typeof data.closedDays === 'string' ? data.closedDays : null,
    breakTime: typeof data.breakTime === 'string' ? data.breakTime : null,
  }
}

export async function getPlaces(planId: string): Promise<Place[]> {
  requireUser()

  const snapshot = await getDocs(query(placesCollection(planId), orderBy('name')))

  return snapshot.docs.flatMap((item) => {
    const place = toPlace(item.id, planId, item.data())
    return place ? [place] : []
  })
}

export async function getPlaceCount(planId: string): Promise<number> {
  requireUser()

  const snapshot = await getCountFromServer(placesCollection(planId))
  return snapshot.data().count
}

export async function addPlace(planId: string, { name, category, latitude, longitude }: NewPlace): Promise<Place> {
  requireUser()

  const place = {
    planId,
    name: name.trim(),
    latitude,
    longitude,
    category,
    openingHours: null,
    closedDays: null,
    breakTime: null,
  }
  const docRef = await addDoc(placesCollection(planId), place)
  await touchPlan(planId)

  return { id: docRef.id, ...place }
}

export async function deletePlace(planId: string, placeId: string) {
  requireUser()

  await deleteDoc(doc(db, 'plans', planId, 'places', placeId))
  await touchPlan(planId)
}

export async function clearPlaces(planId: string) {
  requireUser()

  const snapshot = await getDocs(placesCollection(planId))

  if (snapshot.empty) {
    return
  }

  const batch = writeBatch(db)
  snapshot.docs.forEach((item) => batch.delete(item.ref))
  await batch.commit()
  await touchPlan(planId)
}
