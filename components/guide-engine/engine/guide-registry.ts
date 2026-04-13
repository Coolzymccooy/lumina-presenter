import type { GuideJourney } from '../types/guide.types';

const _registry = new Map<string, GuideJourney>();

export function registerJourney(journey: GuideJourney): void {
  _registry.set(journey.id, journey);
}

export function getJourney(id: string): GuideJourney | undefined {
  return _registry.get(id);
}

export function getAllJourneys(): GuideJourney[] {
  return Array.from(_registry.values());
}

export function getJourneysByCategory(category: GuideJourney['category']): GuideJourney[] {
  return getAllJourneys().filter((j) => j.category === category);
}
