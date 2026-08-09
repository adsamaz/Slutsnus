import { onMount, onCleanup, createEffect, createSignal, For, Show } from 'solid-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MushroomAreaVertex, MushroomVisibility } from '@slutsnus/shared';

interface SearchResult {
    displayName: string;
    lat: number;
    lng: number;
    boundingBox?: [[number, number], [number, number]];
}

export interface MapMarker {
    id: string;
    lat: number;
    lng: number;
    color: string;
    icon: string;
    isMine: boolean;
    visibility: MushroomVisibility;
    title: string;
}

export interface MapPolygon {
    id: string;
    points: MushroomAreaVertex[];
    isMine: boolean;
    highlighted: boolean;
}

export interface MapFocus {
    lat: number;
    lng: number;
    zoom?: number;
    key: number;
}

export interface MapViewProps {
    markers: MapMarker[];
    polygons: MapPolygon[];
    drawingVertices: MushroomAreaVertex[];
    editingVertices?: MushroomAreaVertex[];
    cursorMode: 'default' | 'crosshair';
    focus?: MapFocus;
    onMapClick: (pt: MushroomAreaVertex) => void;
    onMarkerClick: (id: string) => void;
    onPolygonClick: (id: string) => void;
    onVertexDrag?: (index: number, pt: MushroomAreaVertex) => void;
}

const DEFAULT_CENTER: [number, number] = [59.3293, 18.0686]; // Stockholm
const DEFAULT_ZOOM = 6;
const GEOLOCATION_ZOOM = 14;

function pinIcon(marker: MapMarker): L.DivIcon {
    return L.divIcon({
        className: 'svamp-pin-wrapper',
        html: `<div class="svamp-pin svamp-pin--${marker.visibility}" style="--pin-color:${marker.color}">${marker.icon}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
    });
}

const VERTEX_DOT_ICON = L.divIcon({
    className: 'svamp-vertex-wrapper',
    html: '<div class="svamp-vertex-dot"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
});

export default function MapView(props: MapViewProps) {
    let containerRef: HTMLDivElement | undefined;
    let map: L.Map | undefined;
    let markersLayer: L.LayerGroup | undefined;
    let polygonsLayer: L.LayerGroup | undefined;
    let drawLayer: L.LayerGroup | undefined;
    let editLayer: L.LayerGroup | undefined;
    let editMarkers: L.Marker[] = [];
    let editPolygon: L.Polygon | undefined;

    const [searchQuery, setSearchQuery] = createSignal('');
    const [searchResults, setSearchResults] = createSignal<SearchResult[]>([]);
    const [searchOpen, setSearchOpen] = createSignal(false);
    const [searching, setSearching] = createSignal(false);
    let searchDebounce: ReturnType<typeof setTimeout> | undefined;
    let searchAbort: AbortController | undefined;

    async function runSearch(query: string) {
        searchAbort?.abort();
        if (!query.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }
        const abort = new AbortController();
        searchAbort = abort;
        setSearching(true);
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}`;
            const res = await fetch(url, { signal: abort.signal, headers: { Accept: 'application/json' } });
            const data = (await res.json()) as Array<{
                display_name: string;
                lat: string;
                lon: string;
                boundingbox: [string, string, string, string];
            }>;
            setSearchResults(
                data.map((d) => ({
                    displayName: d.display_name,
                    lat: parseFloat(d.lat),
                    lng: parseFloat(d.lon),
                    boundingBox: [
                        [parseFloat(d.boundingbox[0]), parseFloat(d.boundingbox[2])],
                        [parseFloat(d.boundingbox[1]), parseFloat(d.boundingbox[3])],
                    ],
                })),
            );
        } catch {
            // aborted or network error; ignore
        } finally {
            if (searchAbort === abort) setSearching(false);
        }
    }

    function handleSearchInput(value: string) {
        setSearchQuery(value);
        setSearchOpen(true);
        if (searchDebounce) clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => runSearch(value), 400);
    }

    function selectSearchResult(result: SearchResult) {
        if (!map) return;
        if (result.boundingBox) {
            map.fitBounds(result.boundingBox);
        } else {
            map.flyTo([result.lat, result.lng], 15);
        }
        setSearchQuery(result.displayName);
        setSearchOpen(false);
        setSearchResults([]);
    }

    onMount(() => {
        if (!containerRef) return;
        map = L.map(containerRef, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, zoomControl: false });
        L.control.zoom({ position: 'topright' }).addTo(map);
        L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
                maxZoom: 19,
            },
        ).addTo(map);
        L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19 },
        ).addTo(map);

        markersLayer = L.layerGroup().addTo(map);
        polygonsLayer = L.layerGroup().addTo(map);
        drawLayer = L.layerGroup().addTo(map);
        editLayer = L.layerGroup().addTo(map);

        map.on('click', (e: L.LeafletMouseEvent) => {
            props.onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    map?.setView([pos.coords.latitude, pos.coords.longitude], GEOLOCATION_ZOOM);
                },
                () => {
                    // ignore; keep default center
                },
                { enableHighAccuracy: false, timeout: 8000 },
            );
        }
    });

    onCleanup(() => {
        if (searchDebounce) clearTimeout(searchDebounce);
        searchAbort?.abort();
        map?.remove();
    });

    createEffect(() => {
        if (!markersLayer) return;
        markersLayer.clearLayers();
        for (const m of props.markers) {
            const marker = L.marker([m.lat, m.lng], { icon: pinIcon(m) })
                .on('click', (e: L.LeafletMouseEvent) => {
                    L.DomEvent.stopPropagation(e);
                    props.onMarkerClick(m.id);
                })
                .addTo(markersLayer!);
            if (!m.isMine) {
                marker.bindPopup(`<strong>${m.title}</strong>`);
            }
        }
    });

    createEffect(() => {
        if (!polygonsLayer) return;
        polygonsLayer.clearLayers();
        for (const poly of props.polygons) {
            if (poly.points.length < 3) continue;
            L.polygon(
                poly.points.map((p): [number, number] => [p.lat, p.lng]),
                {
                    color: '#39d353',
                    weight: poly.highlighted ? 3 : 2,
                    dashArray: poly.isMine ? undefined : '4 4',
                    fillOpacity: poly.highlighted ? 0.25 : 0.12,
                },
            )
                .on('click', (e: L.LeafletMouseEvent) => {
                    if (props.cursorMode === 'crosshair') return;
                    L.DomEvent.stopPropagation(e);
                    props.onPolygonClick(poly.id);
                })
                .addTo(polygonsLayer!);
        }
    });

    createEffect(() => {
        if (!editLayer) return;
        const editing = props.editingVertices ?? [];

        if (editing.length === 0) {
            if (editMarkers.length > 0 || editPolygon) {
                editLayer.clearLayers();
                editMarkers = [];
                editPolygon = undefined;
            }
            return;
        }

        if (editMarkers.length !== editing.length) {
            // Vertex count changed (or a different area started editing) — rebuild from scratch.
            editLayer.clearLayers();
            editPolygon = undefined;
            editMarkers = editing.map((pt, i) =>
                L.marker([pt.lat, pt.lng], { icon: VERTEX_DOT_ICON, draggable: true })
                    .on('drag', (e: L.LeafletEvent) => {
                        const ll = (e.target as L.Marker).getLatLng();
                        props.onVertexDrag?.(i, { lat: ll.lat, lng: ll.lng });
                    })
                    .addTo(editLayer!),
            );
            if (editing.length >= 3) {
                editPolygon = L.polygon(editing.map((p): [number, number] => [p.lat, p.lng]), {
                    color: '#39d353',
                    weight: 2,
                    dashArray: '4 4',
                    fillOpacity: 0.15,
                }).addTo(editLayer);
            }
            return;
        }

        // Same vertex count (e.g. a drag-driven position update) — move markers in place
        // instead of removing/recreating them, or a marker mid-drag would lose its native
        // drag interaction and stop tracking the cursor.
        editing.forEach((pt, i) => {
            editMarkers[i].setLatLng([pt.lat, pt.lng]);
        });
        editPolygon?.setLatLngs(editing.map((p): [number, number] => [p.lat, p.lng]));
    });

    createEffect(() => {
        if (!drawLayer) return;
        drawLayer.clearLayers();

        const vertices = props.drawingVertices;
        if (vertices.length > 0) {
            if (vertices.length >= 2) {
                L.polyline(vertices.map((p): [number, number] => [p.lat, p.lng]), {
                    color: '#39d353',
                    weight: 2,
                    dashArray: '6 6',
                }).addTo(drawLayer);
            }
            vertices.forEach((pt, i) => {
                L.circleMarker([pt.lat, pt.lng], {
                    radius: i === 0 ? 6 : 4,
                    color: '#39d353',
                    fillColor: '#39d353',
                    fillOpacity: 1,
                }).addTo(drawLayer!);
            });
        }
    });

    createEffect(() => {
        const focus = props.focus;
        if (focus && map) {
            map.flyTo([focus.lat, focus.lng], focus.zoom ?? 15);
        }
    });

    createEffect(() => {
        if (containerRef) {
            containerRef.style.cursor = props.cursorMode === 'crosshair' ? 'crosshair' : '';
        }
    });

    return (
        <div class="svamp-map-wrapper">
            <div class="svamp-map-search">
                <input
                    class="input svamp-map-search-input"
                    type="text"
                    placeholder="Sök plats…"
                    value={searchQuery()}
                    onInput={(e) => handleSearchInput(e.currentTarget.value)}
                    onFocus={() => setSearchOpen(true)}
                    onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                />
                <Show when={searchOpen() && (searching() || searchResults().length > 0)}>
                    <ul class="svamp-map-search-results">
                        <Show when={searching()}>
                            <li class="svamp-map-search-result svamp-map-search-result--status">Söker…</li>
                        </Show>
                        <For each={searchResults()}>
                            {(result) => (
                                <li
                                    class="svamp-map-search-result"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectSearchResult(result)}
                                >
                                    {result.displayName}
                                </li>
                            )}
                        </For>
                    </ul>
                </Show>
            </div>
            <div class="svamp-map" ref={containerRef} />
        </div>
    );
}
