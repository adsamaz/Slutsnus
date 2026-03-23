import { createSignal, createResource, For, Show } from 'solid-js';
import { useAuth } from '../stores/auth';
import Avatar from '../components/Avatar';
import type { FredagPostData, FredagPostType } from '../../../shared/src/types';

const POST_TYPES: { type: FredagPostType; label: string; emoji: string; description: string }[] = [
    { type: 'bild', label: 'Fredagsbilden', emoji: '📸', description: 'Fredagsbilden' },
    { type: 'lat', label: 'Fredagslåten', emoji: '🎵', description: 'Fredagslåten' },
    { type: 'ol', label: 'Fredagsölen', emoji: '🍺', description: 'Fredagsölen' },
];

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🤙', '💀'];

async function fetchPosts(): Promise<FredagPostData[]> {
    const res = await fetch('/api/fredag', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch posts');
    return res.json() as Promise<FredagPostData[]>;
}

export default function Fredag() {
    const [auth] = useAuth();
    const [activeTab, setActiveTab] = createSignal<FredagPostType>('bild');
    const [posts, { mutate }] = createResource(fetchPosts);

    // Upload form state
    const [uploading, setUploading] = createSignal(false);
    const [uploadError, setUploadError] = createSignal('');
    const [caption, setCaption] = createSignal('');
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [previewUrl, setPreviewUrl] = createSignal('');
    const [dragging, setDragging] = createSignal(false);
    const [spotifyUrl, setSpotifyUrl] = createSignal('');

    const filteredPosts = () => (posts() ?? []).filter(p => p.type === activeTab());

    const applyFile = (file: File | null) => {
        setSelectedFile(file);
        if (previewUrl()) URL.revokeObjectURL(previewUrl());
        setPreviewUrl(file ? URL.createObjectURL(file) : '');
    };

    const handleFileChange = (e: Event) => {
        applyFile((e.target as HTMLInputElement).files?.[0] ?? null);
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        setDragging(true);
    };

    const handleDragLeave = () => setDragging(false);

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer?.files?.[0] ?? null;
        if (file) applyFile(file);
    };

    const handleUpload = async () => {
        const isLat = activeTab() === 'lat';

        if (!isLat && !selectedFile()) return;
        if (isLat && !spotifyUrl().trim()) return;

        setUploadError('');
        setUploading(true);

        try {
            let res: globalThis.Response;
            if (isLat) {
                res = await fetch('/api/fredag', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'lat',
                        spotifyUrl: spotifyUrl().trim(),
                        caption: caption().trim() || undefined,
                    }),
                });
            } else {
                const formData = new FormData();
                formData.append('file', selectedFile()!);
                formData.append('type', activeTab());
                if (caption().trim()) formData.append('caption', caption().trim());
                res = await fetch('/api/fredag', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                });
            }

            if (!res.ok) {
                const err = await res.json() as { error: string };
                throw new Error(err.error);
            }
            const newPost = await res.json() as FredagPostData;
            mutate(prev => [newPost, ...(prev ?? [])]);
            setSelectedFile(null);
            setCaption('');
            setSpotifyUrl('');
            if (previewUrl()) { URL.revokeObjectURL(previewUrl()); setPreviewUrl(''); }
            const input = document.getElementById('fredag-file-input') as HTMLInputElement | null;
            if (input) input.value = '';
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleReact = async (postId: string, emoji: string) => {
        try {
            const res = await fetch(`/api/fredag/${postId}/react`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emoji }),
            });
            if (!res.ok) return;
            const { reactions } = await res.json() as { reactions: FredagPostData['reactions'] };
            mutate(prev =>
                (prev ?? []).map(p => p.id === postId ? { ...p, reactions } : p)
            );
        } catch {
            // ignore
        }
    };

    const currentTab = () => POST_TYPES.find(t => t.type === activeTab())!;

    return (
        <main class="page fredag-page">
            <h2 class="page-title">🍺 Friday</h2>

            <div class="tab-bar">
                <For each={POST_TYPES}>
                    {tab => (
                        <button
                            class={`tab-btn${activeTab() === tab.type ? ' tab-btn--active' : ''}`}
                            onClick={() => setActiveTab(tab.type)}
                        >
                            {tab.emoji} {tab.label}
                        </button>
                    )}
                </For>
            </div>

            {/* Upload card */}
            <Show when={auth.user}>
                <div class="card fredag-upload-card">
                    <p class="fredag-upload-title">
                        Post {currentTab().label}
                    </p>

                    <Show
                        when={activeTab() === 'lat'}
                        fallback={
                            <label
                                class={`fredag-dropzone${dragging() ? ' fredag-dropzone--over' : ''}${selectedFile() ? ' fredag-dropzone--has-file' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    id="fredag-file-input"
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleFileChange}
                                    disabled={uploading()}
                                />
                                <Show
                                    when={previewUrl()}
                                    fallback={
                                        <div class="fredag-dropzone-hint">
                                            <span class="fredag-dropzone-icon">🖼️</span>
                                            <span>Drag here or <u>click</u> to choose image</span>
                                            <span style={{ 'font-size': '0.75rem' }}>JPEG, PNG, WebP, GIF · max 3 MB</span>
                                        </div>
                                    }
                                >
                                    <img class="fredag-preview" src={previewUrl()} alt="preview" />
                                    <span class="fredag-dropzone-replace">Drag or click to replace</span>
                                </Show>
                            </label>
                        }
                    >
                        <input
                            class="input"
                            type="url"
                            placeholder="https://open.spotify.com/track/…"
                            value={spotifyUrl()}
                            onInput={e => setSpotifyUrl((e.target as HTMLInputElement).value)}
                            disabled={uploading()}
                        />
                    </Show>

                    <div class="fredag-upload-row">
                        <input
                            class="input fredag-caption-input"
                            type="text"
                            placeholder={activeTab() === 'lat' ? 'Song caption (optional)' : 'Caption (optional)'}
                            maxLength={200}
                            value={caption()}
                            onInput={e => setCaption((e.target as HTMLInputElement).value)}
                            disabled={uploading()}
                        />

                        <button
                            class="btn btn-primary"
                            onClick={handleUpload}
                            disabled={(activeTab() === 'lat' ? !spotifyUrl().trim() : !selectedFile()) || uploading()}
                        >
                            {uploading() ? 'Posting…' : 'Post'}
                        </button>
                    </div>

                    <Show when={uploadError()}>
                        <p class="error-text">{uploadError()}</p>
                    </Show>
                </div>
            </Show>

            {/* Posts */}
            <Show when={posts.loading}>
                <p class="muted" style={{ 'margin-top': '2rem' }}>Loading…</p>
            </Show>

            <Show when={!posts.loading && filteredPosts().length === 0}>
                <div class="card fredag-empty">
                    <p>{currentTab().emoji}</p>
                    <p class="muted">Nobody has posted {currentTab().label} yet. Be first!</p>
                </div>
            </Show>

            <div class="fredag-posts">
                <For each={filteredPosts()}>
                    {post => (
                        <div class="card fredag-post">
                            <div class="fredag-post-header">
                                <Avatar username={post.username} avatarUrl={post.avatarUrl} size="sm" />
                                <span class="fredag-post-username">{post.username}</span>
                                <span class="fredag-post-date muted">
                                    {new Date(post.createdAt).toLocaleDateString('sv-SE', {
                                        weekday: 'short', day: 'numeric', month: 'short',
                                    })}
                                </span>
                            </div>

                            <Show
                                when={post.type === 'lat'}
                                fallback={
                                    <img
                                        class="fredag-post-image"
                                        src={post.fileUrl}
                                        alt={post.caption ?? currentTab().label}
                                        loading="lazy"
                                    />
                                }
                            >
                                <iframe
                                    class="fredag-spotify-embed"
                                    src={post.fileUrl.replace('open.spotify.com/', 'open.spotify.com/embed/')}
                                    width="100%"
                                    height="152"
                                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                    loading="lazy"
                                />
                            </Show>

                            <Show when={post.caption}>
                                <p class="fredag-post-caption">{post.caption}</p>
                            </Show>

                            {/* Reactions */}
                            <div class="fredag-reactions">
                                <Show when={post.reactions.length > 0}>
                                    <div class="fredag-reaction-pills">
                                        <For each={post.reactions}>
                                            {r => (
                                                <button
                                                    class={`fredag-reaction-pill${r.reactedByMe ? ' fredag-reaction-pill--mine' : ''}`}
                                                    onClick={() => handleReact(post.id, r.emoji)}
                                                    title={r.users.join(', ')}
                                                >
                                                    {r.emoji} {r.count}
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </Show>

                                <div class="fredag-emoji-picker">
                                    <For each={QUICK_EMOJIS}>
                                        {emoji => {
                                            const myReaction = () => post.reactions.find(r => r.reactedByMe);
                                            const isActive = () => myReaction()?.emoji === emoji;
                                            return (
                                                <button
                                                    class={`fredag-emoji-btn${isActive() ? ' fredag-emoji-btn--active' : ''}`}
                                                    onClick={() => handleReact(post.id, emoji)}
                                                    title={isActive() ? 'Remove reaction' : `React with ${emoji}`}
                                                >
                                                    {emoji}
                                                </button>
                                            );
                                        }}
                                    </For>
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </main>
    );
}
