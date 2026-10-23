import type { PlaceCategory } from './place';

export const itineraryStopKinds = ['lodging', 'visit', 'breakfast', 'lunch', 'dinner', 'arrival', 'departure'] as const;

export type ItineraryStopKind = (typeof itineraryStopKinds)[number];

export const mealStopKinds = ['breakfast', 'lunch', 'dinner'] as const;

export type MealStopKind = (typeof mealStopKinds)[number];

export function itineraryStopBadge(kind: ItineraryStopKind, visitNumber: number) {
  if (kind === 'lodging') {
    return '숙소';
  }

  if (kind === 'arrival') {
    return '도착';
  }

  if (kind === 'departure') {
    return '출발';
  }

  if (kind === 'breakfast') {
    return '아침';
  }

  if (kind === 'lunch') {
    return '점심';
  }

  if (kind === 'dinner') {
    return '저녁';
  }

  return String(visitNumber);
}

export type ItineraryStop = {
  placeId: string;
  name: string;
  category: PlaceCategory;
  kind: ItineraryStopKind;
  startTime: string;
  endTime: string;
  travelMinutes: number | null;
};

export type ItineraryDay = {
  day: number;
  date: string;
  stops: ItineraryStop[];
};

export type Itinerary = {
  planId: string;
  days: ItineraryDay[];
};
