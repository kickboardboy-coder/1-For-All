import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { commitBatched } from './batch';
import { touchPlan } from './plans';
import { requireUser } from './session';
import { placeCategories, type Place, type PlaceCategory } from '../types/place';
import { googlePlaceTypes } from '../utils/placeCategory';
import { effectiveClosedDays } from '../utils/placeSchedule';

type NewPlace = {
  name: string;
  category: PlaceCategory;
  primaryType?: string | null;
  types?: string[] | null;
  latitude: number;
  longitude: number;
  openingHours: string | null;
  closedDays: string | null;
  breakTime: string | null;
  photoUrl: string | null;
};

function typesFromData(data: DocumentData) {
  return googlePlaceTypes(
    typeof data.primaryType === 'string' ? data.primaryType : null,
    Array.isArray(data.types) ? data.types.filter((type): type is string => typeof type === 'string') : [],
  );
}

function placesCollection(planId: string) {
  return collection(db, 'plans', planId, 'places');
}

function isPlaceCategory(value: unknown): value is PlaceCategory {
  return placeCategories.some((category) => category === value);
}

function toPlace(id: string, planId: string, data: DocumentData): Place | null {
  if (typeof data.name !== 'string' || !isPlaceCategory(data.category)) {
    return null;
  }

  const googleTypes = typesFromData(data);

  return {
    id,
    planId,
    name: data.name,
    latitude: typeof data.latitude === 'number' ? data.latitude : 0,
    longitude: typeof data.longitude === 'number' ? data.longitude : 0,
    category: data.category,
    primaryType: googleTypes.primaryType,
    types: googleTypes.types,
    openingHours: typeof data.openingHours === 'string' ? data.openingHours : null,
    closedDays: effectiveClosedDays(
      typeof data.openingHours === 'string' ? data.openingHours : null,
      typeof data.closedDays === 'string' ? data.closedDays : null,
    ),
    breakTime: typeof data.breakTime === 'string' ? data.breakTime : null,
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : null,
  };
}

export async function getPlaces(planId: string): Promise<Place[]> {
  requireUser();

  const snapshot = await getDocs(query(placesCollection(planId), orderBy('name')));

  return snapshot.docs.flatMap((item) => {
    const place = toPlace(item.id, planId, item.data());
    return place ? [place] : [];
  });
}

export async function getPlaceCount(planId: string): Promise<number> {
  requireUser();

  const snapshot = await getCountFromServer(placesCollection(planId));
  return snapshot.data().count;
}

export async function addPlace(
  planId: string,
  { name, category, primaryType, types, latitude, longitude, openingHours, closedDays, breakTime, photoUrl }: NewPlace,
): Promise<Place> {
  requireUser();

  const googleTypes = googlePlaceTypes(primaryType, types);
  const place = {
    planId,
    name: name.trim(),
    latitude,
    longitude,
    category,
    primaryType: googleTypes.primaryType,
    types: googleTypes.types,
    openingHours,
    closedDays,
    breakTime,
    photoUrl,
  };
  const docRef = await addDoc(placesCollection(planId), place);
  await touchPlan(planId);

  return { id: docRef.id, ...place };
}

export async function deletePlace(planId: string, placeId: string) {
  requireUser();

  await deleteDoc(doc(db, 'plans', planId, 'places', placeId));
  await touchPlan(planId);
}

export async function clearPlaces(planId: string) {
  requireUser();

  const snapshot = await getDocs(placesCollection(planId));

  if (snapshot.empty) {
    return;
  }

  await commitBatched(snapshot.docs.map((item) => (batch) => batch.delete(item.ref)));
  await touchPlan(planId);
}
