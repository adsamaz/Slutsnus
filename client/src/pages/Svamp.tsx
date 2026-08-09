import { createSignal, createMemo, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import { useFriends } from '../stores/friends';
import { showToast } from '../components/Toast';
import Button from '../components/Button';
import MapView from '../components/MapView';
import type { MapMarker, MapPolygon, MapFocus } from '../components/MapView';
import VisibilityToggle from '../components/VisibilityToggle';
import FriendPicker from '../components/FriendPicker';
import SvampAreaChart from '../components/SvampAreaChart';
import { MUSHROOM_SPECIES, isPointInPolygon } from '@slutsnus/shared';
import type {
    MushroomEntryData,
    MushroomAreaData,
    MushroomAreaVertex,
    MushroomVisibility,
    CreateMushroomEntryRequest,
    CreateMushroomAreaRequest,
} from '@slutsnus/shared';

function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

const VISIBILITY_ICON: Record<MushroomVisibility, string> = {
    private: '🔒',
    friends: '👥',
    public: '🌍',
};

function formatGrams(grams: number): string {
    return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;
}

async function extractError(res: Response, fallback: string): Promise<string> {
    try {
        const data = await res.json() as { error?: string };
        return data.error ?? fallback;
    } catch {
        return fallback;
    }
}

async function fetchEntries(): Promise<MushroomEntryData[]> {
    const res = await fetch('/api/mushrooms/entries', { credentials: 'include' });
    if (!res.ok) throw new Error('Kunde inte hämta fynd');
    return res.json();
}

async function fetchAreas(): Promise<MushroomAreaData[]> {
    const res = await fetch('/api/mushrooms/areas', { credentials: 'include' });
    if (!res.ok) throw new Error('Kunde inte hämta områden');
    return res.json();
}

async function createEntryReq(body: CreateMushroomEntryRequest): Promise<MushroomEntryData> {
    const res = await fetch('/api/mushrooms/entries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte spara fyndet'));
    return res.json();
}

async function updateEntryReq(id: string, body: CreateMushroomEntryRequest): Promise<MushroomEntryData> {
    const res = await fetch(`/api/mushrooms/entries/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte uppdatera fyndet'));
    return res.json();
}

async function deleteEntryReq(id: string): Promise<void> {
    const res = await fetch(`/api/mushrooms/entries/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte ta bort fyndet'));
}

async function createAreaReq(body: CreateMushroomAreaRequest): Promise<MushroomAreaData> {
    const res = await fetch('/api/mushrooms/areas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte spara området'));
    return res.json();
}

async function updateAreaReq(id: string, body: CreateMushroomAreaRequest): Promise<MushroomAreaData> {
    const res = await fetch(`/api/mushrooms/areas/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte uppdatera området'));
    return res.json();
}

async function deleteAreaReq(id: string): Promise<void> {
    const res = await fetch(`/api/mushrooms/areas/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte ta bort området'));
}

type Mode = 'view' | 'add-entry' | 'draw-area';

export default function Svamp() {
    const [auth] = useAuth();
    const [friendsState] = useFriends();

    const acceptedFriends = createMemo(() =>
        friendsState.friends.filter((f) => f.friendshipStatus === 'accepted'),
    );

    const [entries, { refetch: refetchEntries }] = createResource(
        () => (auth.loading ? undefined : true),
        fetchEntries,
    );
    const [areas, { refetch: refetchAreas }] = createResource(
        () => (auth.loading ? undefined : true),
        fetchAreas,
    );

    const [mode, setMode] = createSignal<Mode>('view');

    // ─── Entry form ───
    const [pendingEntryPos, setPendingEntryPos] = createSignal<MushroomAreaVertex | null>(null);
    const [editingEntry, setEditingEntry] = createSignal<MushroomEntryData | null>(null);
    const [formSpeciesId, setFormSpeciesId] = createSignal<string>(MUSHROOM_SPECIES[0].id);
    const [formCustomLabel, setFormCustomLabel] = createSignal('');
    const [formCustomColor, setFormCustomColor] = createSignal('#8b5e3c');
    const [formWeight, setFormWeight] = createSignal('');
    const [formDate, setFormDate] = createSignal(todayStr());
    const [formVisibility, setFormVisibility] = createSignal<MushroomVisibility>('private');
    const [formVisibleToUserIds, setFormVisibleToUserIds] = createSignal<string[]>([]);
    const [formNotes, setFormNotes] = createSignal('');
    const [saving, setSaving] = createSignal(false);

    function toggleFormVisibleFriend(userId: string) {
        setFormVisibleToUserIds((ids) =>
            ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
        );
    }

    // ─── Area draw/edit ───
    const [drawingVertices, setDrawingVertices] = createSignal<MushroomAreaVertex[]>([]);
    const [pendingAreaPolygon, setPendingAreaPolygon] = createSignal<MushroomAreaVertex[] | null>(null);
    const [editingArea, setEditingArea] = createSignal<MushroomAreaData | null>(null);
    const [reshapeAreaId, setReshapeAreaId] = createSignal<string | null>(null);
    const [editingAreaVertices, setEditingAreaVertices] = createSignal<MushroomAreaVertex[]>([]);
    const [formAreaName, setFormAreaName] = createSignal('');
    const [formAreaVisibility, setFormAreaVisibility] = createSignal<MushroomVisibility>('private');
    const [formAreaVisibleToUserIds, setFormAreaVisibleToUserIds] = createSignal<string[]>([]);
    const [savingArea, setSavingArea] = createSignal(false);

    function toggleFormAreaVisibleFriend(userId: string) {
        setFormAreaVisibleToUserIds((ids) =>
            ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
        );
    }

    // ─── View ───
    const [viewingAreaId, setViewingAreaId] = createSignal<string | null>(null);
    const [mapFocus, setMapFocus] = createSignal<MapFocus | undefined>();

    const myAreas = createMemo(() => (areas() ?? []).filter((a) => a.isMine));

    const entriesByArea = createMemo(() => {
        const map = new Map<string, MushroomEntryData[]>();
        for (const e of entries() ?? []) {
            if (!e.areaId) continue;
            map.set(e.areaId, [...(map.get(e.areaId) ?? []), e]);
        }
        return map;
    });

    const viewingArea = createMemo(() => areas()?.find((a) => a.id === viewingAreaId()) ?? null);

    const areasSorted = createMemo(() =>
        [...(areas() ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'sv')),
    );

    const mapMarkers = createMemo<MapMarker[]>(() => {
        const list: MapMarker[] = (entries() ?? []).map((e) => ({
            id: e.id,
            lat: e.lat,
            lng: e.lng,
            color: e.displayColor,
            icon: e.displayIcon,
            isMine: e.isMine,
            visibility: e.visibility,
            title: e.isMine
                ? `${e.displayLabel} — ${e.weightGrams} g (${e.foundDate})`
                : `${e.displayLabel} — ${e.weightGrams} g (${e.foundDate}) · ${e.username}`,
        }));
        const pending = pendingEntryPos();
        if (pending && !editingEntry()) {
            list.push({
                id: '__pending__',
                lat: pending.lat,
                lng: pending.lng,
                color: '#39d353',
                icon: '📍',
                isMine: true,
                visibility: 'private',
                title: 'Ny plats',
            });
        }
        return list;
    });

    const mapPolygons = createMemo<MapPolygon[]>(() =>
        (areas() ?? [])
            .filter((a) => a.id !== reshapeAreaId())
            .map((a) => ({
                id: a.id,
                points: a.polygon,
                isMine: a.isMine,
                highlighted: a.id === viewingAreaId(),
            })),
    );

    const drawLayerVertices = createMemo<MushroomAreaVertex[]>(() => {
        if (mode() === 'draw-area' || pendingAreaPolygon()) {
            return pendingAreaPolygon() ?? drawingVertices();
        }
        return [];
    });

    const cursorMode = createMemo<'default' | 'crosshair'>(() =>
        mode() === 'add-entry' || mode() === 'draw-area' ? 'crosshair' : 'default',
    );

    // ─── Add / edit entry ───

    function toggleAddEntryMode() {
        setMode((m) => (m === 'add-entry' ? 'view' : 'add-entry'));
    }

    function resetEntryForm() {
        setFormSpeciesId(MUSHROOM_SPECIES[0].id);
        setFormCustomLabel('');
        setFormCustomColor('#8b5e3c');
        setFormWeight('');
        setFormDate(todayStr());
        setFormVisibility('private');
        setFormVisibleToUserIds([]);
        setFormNotes('');
    }

    function handleMapClick(pt: MushroomAreaVertex) {
        if (mode() === 'add-entry') {
            resetEntryForm();
            setPendingEntryPos(pt);
            setMode('view');
        } else if (mode() === 'draw-area') {
            setDrawingVertices((v) => [...v, pt]);
        }
    }

    function openEditEntryPopover(entry: MushroomEntryData) {
        setFormSpeciesId(entry.speciesId ?? 'custom');
        setFormCustomLabel(entry.customLabel ?? '');
        setFormCustomColor(entry.customColor ?? '#8b5e3c');
        setFormWeight(String(entry.weightGrams));
        setFormDate(entry.foundDate);
        setFormVisibility(entry.visibility);
        setFormVisibleToUserIds(entry.visibleToUserIds);
        setFormNotes(entry.notes ?? '');
        setEditingEntry(entry);
    }

    function closeEntryPopover() {
        setPendingEntryPos(null);
        setEditingEntry(null);
    }

    function handleMarkerClick(id: string) {
        const entry = entries()?.find((e) => e.id === id);
        if (entry?.isMine) openEditEntryPopover(entry);
    }

    async function handleSubmitEntry() {
        const weight = parseInt(formWeight(), 10);
        if (!Number.isInteger(weight) || weight <= 0) {
            showToast('Ange en giltig vikt i gram', 'error');
            return;
        }
        const pos = pendingEntryPos();
        const editing = editingEntry();
        if (!pos && !editing) return;

        const entryPos = editing ? { lat: editing.lat, lng: editing.lng } : pos!;
        const area = myAreas().find((a) => isPointInPolygon(entryPos, a.polygon));

        const body: CreateMushroomEntryRequest = {
            weightGrams: weight,
            foundDate: formDate(),
            lat: entryPos.lat,
            lng: entryPos.lng,
            notes: formNotes().trim() || undefined,
            areaId: area?.id ?? null,
            visibility: formVisibility(),
            visibleToUserIds: formVisibility() === 'friends' ? formVisibleToUserIds() : undefined,
        };
        if (formSpeciesId() === 'custom') {
            const label = formCustomLabel().trim();
            if (!label) {
                showToast('Ange ett namn för den egna svampen', 'error');
                return;
            }
            body.customLabel = label;
            body.customColor = formCustomColor();
        } else {
            body.speciesId = formSpeciesId();
        }

        setSaving(true);
        try {
            if (editing) {
                await updateEntryReq(editing.id, body);
                showToast('Fynd uppdaterat', 'success');
            } else {
                await createEntryReq(body);
                showToast('Fynd tillagt 🍄', 'success');
            }
            closeEntryPopover();
            await refetchEntries();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Något gick fel', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteEntry() {
        const editing = editingEntry();
        if (!editing) return;
        setSaving(true);
        try {
            await deleteEntryReq(editing.id);
            showToast('Fynd borttaget', 'success');
            closeEntryPopover();
            await refetchEntries();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Något gick fel', 'error');
        } finally {
            setSaving(false);
        }
    }

    // ─── Draw / edit area ───

    function toggleDrawAreaMode() {
        if (mode() === 'draw-area') {
            cancelDrawing();
        } else {
            setDrawingVertices([]);
            setMode('draw-area');
        }
    }

    function cancelDrawing() {
        setDrawingVertices([]);
        setMode('view');
    }

    function finishDrawing() {
        if (drawingVertices().length < 3) return;
        setPendingAreaPolygon(drawingVertices());
        setFormAreaName('');
        setFormAreaVisibility('private');
        setFormAreaVisibleToUserIds([]);
        setMode('view');
    }

    function openEditAreaPopover(area: MushroomAreaData) {
        setFormAreaName(area.name);
        setFormAreaVisibility(area.visibility);
        setFormAreaVisibleToUserIds(area.visibleToUserIds);
        setEditingArea(area);
    }

    function closeAreaPopover() {
        setPendingAreaPolygon(null);
        setDrawingVertices([]);
        setEditingArea(null);
    }

    function handlePolygonClick(id: string) {
        setViewingAreaId((cur) => (cur === id ? null : id));
    }

    async function handleSubmitArea() {
        const name = formAreaName().trim();
        if (!name) {
            showToast('Ange ett namn för området', 'error');
            return;
        }
        const editing = editingArea();
        const polygon = editing ? editing.polygon : pendingAreaPolygon();
        if (!polygon) return;

        const body: CreateMushroomAreaRequest = {
            name,
            polygon,
            visibility: formAreaVisibility(),
            visibleToUserIds: formAreaVisibility() === 'friends' ? formAreaVisibleToUserIds() : undefined,
        };

        setSavingArea(true);
        try {
            if (editing) {
                await updateAreaReq(editing.id, body);
                showToast('Område uppdaterat', 'success');
            } else {
                await createAreaReq(body);
                showToast('Område skapat', 'success');
            }
            closeAreaPopover();
            await refetchAreas();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Något gick fel', 'error');
        } finally {
            setSavingArea(false);
        }
    }

    async function handleDeleteArea(area: MushroomAreaData) {
        setSavingArea(true);
        try {
            await deleteAreaReq(area.id);
            showToast('Område borttaget', 'success');
            closeAreaPopover();
            if (viewingAreaId() === area.id) setViewingAreaId(null);
            await Promise.all([refetchAreas(), refetchEntries()]);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Något gick fel', 'error');
        } finally {
            setSavingArea(false);
        }
    }

    function startReshape(area: MushroomAreaData) {
        setReshapeAreaId(area.id);
        setEditingAreaVertices(area.polygon);
    }

    function cancelReshape() {
        setReshapeAreaId(null);
        setEditingAreaVertices([]);
    }

    function handleVertexDrag(index: number, pt: MushroomAreaVertex) {
        setEditingAreaVertices((v) => v.map((p, i) => (i === index ? pt : p)));
    }

    async function handleSaveReshape() {
        const areaId = reshapeAreaId();
        const area = areas()?.find((a) => a.id === areaId);
        if (!areaId || !area) return;
        setSavingArea(true);
        try {
            await updateAreaReq(areaId, {
                name: area.name,
                polygon: editingAreaVertices(),
                visibility: area.visibility,
            });
            showToast('Områdets form uppdaterad', 'success');
            cancelReshape();
            await refetchAreas();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Något gick fel', 'error');
        } finally {
            setSavingArea(false);
        }
    }

    function flyToArea(area: MushroomAreaData) {
        setMapFocus({ lat: area.centerLat, lng: area.centerLng, zoom: 15, key: Date.now() });
    }

    function selectAreaFromList(area: MushroomAreaData) {
        flyToArea(area);
        setViewingAreaId(area.id);
    }

    return (
        <main class="page page-svamp">
            <h2 class="page-title">Svamp 🍄</h2>

            <Show when={!auth.user}>
                <p class="muted svamp-login-banner">
                    Logga in för att lägga till fynd och områden — <A href="/login">Logga in</A>
                </p>
            </Show>

            <div class="svamp-toolbar">
                <Show when={auth.user}>
                    <Button
                        variant={mode() === 'add-entry' ? 'primary' : 'secondary'}
                        onClick={toggleAddEntryMode}
                    >
                        📍 Lägg till fynd
                    </Button>
                    <Button
                        variant={mode() === 'draw-area' ? 'primary' : 'secondary'}
                        onClick={toggleDrawAreaMode}
                    >
                        ✏️ Rita område
                    </Button>
                </Show>
                <Show when={mode() === 'draw-area'}>
                    <span class="muted">{drawingVertices().length} punkter</span>
                    <Button variant="primary" disabled={drawingVertices().length < 3} onClick={finishDrawing}>
                        Klar
                    </Button>
                    <Button variant="secondary" onClick={cancelDrawing}>Avbryt</Button>
                </Show>
                <Show when={reshapeAreaId()}>
                    <span class="muted">Dra punkterna för att ändra formen</span>
                    <Button variant="primary" disabled={savingArea()} onClick={handleSaveReshape}>Spara form</Button>
                    <Button variant="secondary" onClick={cancelReshape}>Avbryt</Button>
                </Show>
            </div>

            <div class="svamp-map-layout">
                <div class="svamp-map-container">
                    <MapView
                        markers={mapMarkers()}
                        polygons={mapPolygons()}
                        drawingVertices={drawLayerVertices()}
                        editingVertices={reshapeAreaId() ? editingAreaVertices() : undefined}
                        cursorMode={cursorMode()}
                        focus={mapFocus()}
                        onMapClick={handleMapClick}
                        onMarkerClick={handleMarkerClick}
                        onPolygonClick={handlePolygonClick}
                        onVertexDrag={handleVertexDrag}
                    />

                    <Show when={viewingArea()}>
                        {(area) => (
                            <div class="card svamp-area-panel">
                                <div class="svamp-area-panel-header">
                                    <strong>{area().name}</strong>
                                    <button
                                        type="button"
                                        class="svamp-area-panel-focus"
                                        title="Centrera kartan"
                                        onClick={() => flyToArea(area())}
                                    >
                                        🎯
                                    </button>
                                    <button
                                        type="button"
                                        class="svamp-area-panel-close"
                                        onClick={() => setViewingAreaId(null)}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <p class="muted">
                                    {area().isMine ? 'Ditt område' : `Område av ${area().username}`}
                                </p>
                                <Show when={area().isMine}>
                                    <div class="svamp-area-panel-actions">
                                        <Button variant="secondary" onClick={() => openEditAreaPopover(area())}>Redigera</Button>
                                        <Button variant="secondary" onClick={() => startReshape(area())}>Ändra form</Button>
                                        <Button variant="danger" onClick={() => handleDeleteArea(area())}>Ta bort</Button>
                                    </div>
                                </Show>
                                <SvampAreaChart entries={entriesByArea().get(area().id) ?? []} />
                            </div>
                        )}
                    </Show>
                </div>

                <div class="svamp-area-list-section">
                    <h3 class="svamp-area-list-title">Områden</h3>
                    <Show when={areasSorted().length > 0} fallback={<p class="muted">Inga områden ännu.</p>}>
                        <ul class="svamp-area-list">
                            <For each={areasSorted()}>
                                {(area) => {
                                    const areaEntries = () => entriesByArea().get(area.id) ?? [];
                                    const totalGrams = () => areaEntries().reduce((sum, e) => sum + e.weightGrams, 0);
                                    return (
                                        <li>
                                            <button
                                                type="button"
                                                class={`svamp-area-list-item${area.id === viewingAreaId() ? ' svamp-area-list-item--active' : ''}`}
                                                onClick={() => selectAreaFromList(area)}
                                            >
                                                <span class="svamp-area-list-name">
                                                    {VISIBILITY_ICON[area.visibility]} {area.name}
                                                </span>
                                                <span class="muted svamp-area-list-meta">
                                                    {area.isMine ? 'Ditt område' : `Av ${area.username}`}
                                                    {' · '}
                                                    {areaEntries().length} fynd
                                                    {' · '}
                                                    {formatGrams(totalGrams())}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                }}
                            </For>
                        </ul>
                    </Show>
                </div>
            </div>

            <Show when={pendingEntryPos() || editingEntry()}>
                <div class="svamp-popover-overlay" onClick={closeEntryPopover}>
                    <div class="svamp-popover" onClick={(e) => e.stopPropagation()}>
                        <h3>{editingEntry() ? 'Redigera fynd' : 'Nytt fynd'}</h3>

                        <div class="svamp-species-grid">
                            <For each={MUSHROOM_SPECIES}>
                                {(species) => (
                                    <button
                                        type="button"
                                        class={`vacation-icon-btn${formSpeciesId() === species.id ? ' vacation-icon-btn--selected' : ''}`}
                                        title={species.label}
                                        onClick={() => setFormSpeciesId(species.id)}
                                    >
                                        <span class="svamp-species-swatch" style={{ background: species.color }} />
                                        {species.icon}
                                    </button>
                                )}
                            </For>
                            <button
                                type="button"
                                class={`vacation-icon-btn${formSpeciesId() === 'custom' ? ' vacation-icon-btn--selected' : ''}`}
                                onClick={() => setFormSpeciesId('custom')}
                            >
                                🎨 Eget
                            </button>
                        </div>

                        <Show when={formSpeciesId() === 'custom'}>
                            <div class="svamp-custom-species-row">
                                <input
                                    class="input"
                                    placeholder="Namn på svampen"
                                    maxLength={40}
                                    value={formCustomLabel()}
                                    onInput={(e) => setFormCustomLabel(e.currentTarget.value)}
                                />
                                <input
                                    type="color"
                                    value={formCustomColor()}
                                    onInput={(e) => setFormCustomColor(e.currentTarget.value)}
                                />
                            </div>
                        </Show>

                        <input
                            class="input"
                            type="number"
                            min="1"
                            inputmode="numeric"
                            placeholder="Vikt (gram)"
                            value={formWeight()}
                            onInput={(e) => setFormWeight(e.currentTarget.value)}
                        />
                        <input
                            class="input"
                            type="date"
                            max={todayStr()}
                            value={formDate()}
                            onInput={(e) => setFormDate(e.currentTarget.value)}
                        />
                        <VisibilityToggle value={formVisibility()} onChange={setFormVisibility} />
                        <Show when={formVisibility() === 'friends'}>
                            <FriendPicker
                                friends={acceptedFriends()}
                                selected={formVisibleToUserIds()}
                                onToggle={toggleFormVisibleFriend}
                            />
                        </Show>
                        <textarea
                            class="input"
                            rows={2}
                            maxLength={500}
                            placeholder="Anteckningar (valfritt)"
                            value={formNotes()}
                            onInput={(e) => setFormNotes(e.currentTarget.value)}
                        />

                        <div class="svamp-popover-actions">
                            <Show when={editingEntry()}>
                                <Button variant="danger" disabled={saving()} onClick={handleDeleteEntry}>Ta bort</Button>
                            </Show>
                            <Button variant="secondary" disabled={saving()} onClick={closeEntryPopover}>Avbryt</Button>
                            <Button variant="primary" disabled={saving()} onClick={handleSubmitEntry}>
                                {editingEntry() ? 'Spara' : 'Skapa'}
                            </Button>
                        </div>
                    </div>
                </div>
            </Show>

            <Show when={pendingAreaPolygon() || editingArea()}>
                <div class="svamp-popover-overlay" onClick={closeAreaPopover}>
                    <div class="svamp-popover" onClick={(e) => e.stopPropagation()}>
                        <h3>{editingArea() ? 'Redigera område' : 'Nytt område'}</h3>
                        <input
                            class="input"
                            placeholder="Namn på området"
                            maxLength={60}
                            value={formAreaName()}
                            onInput={(e) => setFormAreaName(e.currentTarget.value)}
                        />
                        <VisibilityToggle value={formAreaVisibility()} onChange={setFormAreaVisibility} />
                        <Show when={formAreaVisibility() === 'friends'}>
                            <FriendPicker
                                friends={acceptedFriends()}
                                selected={formAreaVisibleToUserIds()}
                                onToggle={toggleFormAreaVisibleFriend}
                            />
                        </Show>
                        <div class="svamp-popover-actions">
                            <Show when={editingArea()}>
                                <Button
                                    variant="danger"
                                    disabled={savingArea()}
                                    onClick={() => { const a = editingArea(); if (a) handleDeleteArea(a); }}
                                >
                                    Ta bort
                                </Button>
                            </Show>
                            <Button variant="secondary" disabled={savingArea()} onClick={closeAreaPopover}>Avbryt</Button>
                            <Button variant="primary" disabled={savingArea()} onClick={handleSubmitArea}>
                                {editingArea() ? 'Spara' : 'Skapa'}
                            </Button>
                        </div>
                    </div>
                </div>
            </Show>
        </main>
    );
}
