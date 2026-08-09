import type { MushroomVisibility, MushroomAreaVertex } from './types';

export interface MushroomSpecies {
    id: string;
    label: string;
    icon: string;
    color: string;
}

// Unicode has essentially one mushroom glyph (🍄), so every curated species shares
// it; `color` is the real per-species visual differentiator (pin/badge background).
export const MUSHROOM_SPECIES: MushroomSpecies[] = [
    { id: 'gul-kantarell', label: 'Gul kantarell', icon: '🍄', color: '#F5B700' },
    { id: 'trattkantarell', label: 'Trattkantarell', icon: '🍄', color: '#C97C2E' },
    { id: 'karl-johan', label: 'Karl-Johan (Stensopp)', icon: '🍄', color: '#8B5A2B' },
    { id: 'champinjon', label: 'Champinjon', icon: '🍄', color: '#E8E1D3' },
    { id: 'blodriska', label: 'Blodriska', icon: '🍄', color: '#B23A2E' },
    { id: 'bjorkmusseron', label: 'Björkmusseron', icon: '🍄', color: '#A98D6B' },
    { id: 'fjallskivling', label: 'Fjällskivling', icon: '🍄', color: '#D9CBB0' },
    { id: 'blek-taggsvamp', label: 'Blek taggsvamp', icon: '🍄', color: '#E0A96D' },
    { id: 'toffelsopp', label: 'Toffelsopp', icon: '🍄', color: '#8A6D3B' },
];

export function isValidMushroomSpeciesId(value: string): boolean {
    return MUSHROOM_SPECIES.some((s) => s.id === value);
}

export function getMushroomSpecies(id: string): MushroomSpecies | undefined {
    return MUSHROOM_SPECIES.find((s) => s.id === id);
}

export const MUSHROOM_VISIBILITIES: MushroomVisibility[] = ['private', 'friends', 'public'];

export function isValidMushroomVisibility(value: string): value is MushroomVisibility {
    return MUSHROOM_VISIBILITIES.includes(value as MushroomVisibility);
}

export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

// Resolves the {label, icon, color} to actually render for an entry, regardless of
// whether it's a curated species or a custom one-off. Used server-side to denormalize
// display fields onto MushroomEntryData; client can reuse it for its own local objects.
export function resolveMushroomDisplay(entry: {
    speciesId?: string | null;
    customLabel?: string | null;
    customColor?: string | null;
}): { label: string; icon: string; color: string } {
    if (entry.speciesId) {
        const species = getMushroomSpecies(entry.speciesId);
        if (species) return { label: species.label, icon: species.icon, color: species.color };
    }
    return {
        label: entry.customLabel ?? 'Okänd svamp',
        icon: '🍄',
        color: entry.customColor ?? '#888888',
    };
}

// Arithmetic-mean centroid of a polygon's vertices — fine for label/flyTo placement,
// not a true area-weighted centroid.
export function computePolygonCentroid(vertices: MushroomAreaVertex[]): { lat: number; lng: number } {
    const lat = vertices.reduce((sum, v) => sum + v.lat, 0) / vertices.length;
    const lng = vertices.reduce((sum, v) => sum + v.lng, 0) / vertices.length;
    return { lat, lng };
}

// Point-in-polygon via ray casting — used client-side to suggest an area when placing a pin.
export function isPointInPolygon(pt: MushroomAreaVertex, polygon: MushroomAreaVertex[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        const intersects =
            a.lat !== b.lat &&
            pt.lat >= Math.min(a.lat, b.lat) &&
            pt.lat < Math.max(a.lat, b.lat) &&
            pt.lng < ((b.lng - a.lng) * (pt.lat - a.lat)) / (b.lat - a.lat) + a.lng;
        if (intersects) inside = !inside;
    }
    return inside;
}

// Pure aggregation for the "weight over time" chart — total grams per visit date,
// used by the client against an already-fetched entries-for-area array.
export function aggregateMushroomWeightByDate(
    entries: { foundDate: string; weightGrams: number }[],
): { date: string; totalGrams: number }[] {
    const byDate = new Map<string, number>();
    for (const e of entries) {
        byDate.set(e.foundDate, (byDate.get(e.foundDate) ?? 0) + e.weightGrams);
    }
    return Array.from(byDate.entries())
        .map(([date, totalGrams]) => ({ date, totalGrams }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
}
