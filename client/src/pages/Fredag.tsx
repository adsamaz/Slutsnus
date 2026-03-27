import { createSignal, createResource, For, Show } from 'solid-js';
import { useAuth } from '../stores/auth';
import Avatar from '../components/Avatar';
import type { FredagCommentData, FredagPostData, FredagPostType } from '../../../shared/src/types';

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

// Per-post card — owns its own comment open/draft state
function PostCard(props: {
    post: FredagPostData;
    currentTabLabel: string;
    myUserId: () => string | undefined;
    onDelete: (postId: string) => void;
    onReact: (postId: string, emoji: string) => void;
    onCommentAdded: (postId: string, comment: FredagCommentData) => void;
    onCommentDeleted: (postId: string, commentId: string) => void;
}) {
    const [commentsOpen, setCommentsOpen] = createSignal(false);
    const [draft, setDraft] = createSignal('');
    const [submitting, setSubmitting] = createSignal(false);

    const handleSubmitComment = async () => {
        const body = draft().trim();
        if (!body || submitting()) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/fredag/${props.post.id}/comments`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body }),
            });
            if (!res.ok) return;
            const comment = await res.json() as FredagCommentData;
            props.onCommentAdded(props.post.id, comment);
            setDraft('');
        } finally {
            setSubmitting(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmitComment();
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        const res = await fetch(`/api/fredag/${props.post.id}/comments/${commentId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (res.ok) props.onCommentDeleted(props.post.id, commentId);
    };

    return (
        <div class="card fredag-post">
            <div class="fredag-post-header">
                <Avatar username={props.post.username} avatarUrl={props.post.avatarUrl} size="sm" />
                <span class="fredag-post-username">{props.post.username}</span>
                <span class="fredag-post-date muted">
                    {new Date(props.post.createdAt).toLocaleDateString('sv-SE', {
                        weekday: 'short', day: 'numeric', month: 'short',
                    })}
                </span>
                <Show when={props.myUserId() === props.post.userId}>
                    <button
                        class="fredag-delete-btn"
                        onClick={() => props.onDelete(props.post.id)}
                        title="Delete post"
                    >
                        ✕
</button>
                </Show>
            </div>

            <Show
                when={props.post.type === 'lat'}
                fallback={
                    <img
                        class="fredag-post-image"
                        src={props.post.fileUrl}
                        alt={props.post.caption ?? props.currentTabLabel}
                        loading="lazy"
                    />
                }
            >
                <iframe
                    class="fredag-spotify-embed"
                    src={props.post.fileUrl.replace('open.spotify.com/', 'open.spotify.com/embed/')}
                    width="100%"
                    height="152"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                />
            </Show>

            <Show when={props.post.caption}>
                <p class="fredag-post-caption">{props.post.caption}</p>
            </Show>

            {/* Reactions */}
            <div class="fredag-reactions">
                <Show when={props.post.reactions.length > 0}>
                    <div class="fredag-reaction-pills">
                        <For each={props.post.reactions}>
                            {r => (
                                <button
                                    class={`fredag-reaction-pill${r.reactedByMe ? ' fredag-reaction-pill--mine' : ''}`}
                                    onClick={() => props.onReact(props.post.id, r.emoji)}
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
                            const myReaction = () => props.post.reactions.find(r => r.reactedByMe);
                            const isActive = () => myReaction()?.emoji === emoji;
                            return (
                                <button
                                    class={`fredag-emoji-btn${isActive() ? ' fredag-emoji-btn--active' : ''}`}
                                    onClick={() => props.onReact(props.post.id, emoji)}
                                    title={isActive() ? 'Remove reaction' : `React with ${emoji}`}
                                >
                                    {emoji}
                                </button>
                            );
                        }}
                    </For>
                </div>
            </div>

            {/* Comments */}
            <div class="fredag-comments-section">
                <button
                    class="fredag-comments-toggle"
                    onClick={() => setCommentsOpen(o => !o)}
                >
                    💬 {props.post.comments.length > 0
                        ? `${props.post.comments.length} comment${props.post.comments.length === 1 ? '' : 's'}`
                        : 'Comment'}
                    <span class="fredag-comments-chevron">{commentsOpen() ? '▲' : '▼'}</span>
                </button>

                <Show when={commentsOpen()}>
                    <div class="fredag-comments">
                        <For each={props.post.comments}>
                            {comment => (
                                <div class="fredag-comment">
                                    <Avatar username={comment.username} avatarUrl={comment.avatarUrl} size="sm" />
                                    <div class="fredag-comment-body">
                                        <span class="fredag-comment-username">{comment.username}</span>
                                        <span class="fredag-comment-text">{comment.body}</span>
                                    </div>
                                    <Show when={props.myUserId() === comment.userId}>
                                        <button
                                            class="fredag-delete-btn"
                                            onClick={() => handleDeleteComment(comment.id)}
                                            title="Delete comment"
                                        >
                                            ✕
                    </button>
                                    </Show>
                                </div>
                            )}
                        </For>

                        <Show when={props.myUserId()}>
                            <div class="fredag-comment-form">
                                <input
                                    class="input fredag-comment-input"
                                    type="text"
                                    placeholder="Write a comment…"
                                    maxLength={500}
                                    value={draft()}
                                    onInput={e => setDraft((e.target as HTMLInputElement).value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={submitting()}
                                />
                                <button
                                    class="btn btn-primary fredag-comment-submit"
                                    onClick={handleSubmitComment}
                                    disabled={!draft().trim() || submitting()}
                                >
                                    Send
                                </button>
                            </div>
                        </Show>
                    </div>
                </Show>
            </div>
        </div>
    );
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
                if (res.status === 413) {
                    throw new Error('File is too large. Max size is 5 MB.');
                }
                try {
                    const err = await res.json() as { error: string };
                    throw new Error(err.error);
                } catch {
                    throw new Error('Upload failed');
                }
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

    const handleDelete = async (postId: string) => {
        try {
            const res = await fetch(`/api/fredag/${postId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) return;
            mutate(prev => (prev ?? []).filter(p => p.id !== postId));
        } catch {
            // ignore
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

    const handleCommentAdded = (postId: string, comment: FredagCommentData) => {
        mutate(prev =>
            (prev ?? []).map(p => p.id === postId
                ? { ...p, comments: [...p.comments, comment] }
                : p
            )
        );
    };

    const handleCommentDeleted = (postId: string, commentId: string) => {
        mutate(prev =>
            (prev ?? []).map(p => p.id === postId
                ? { ...p, comments: p.comments.filter(c => c.id !== commentId) }
                : p
            )
        );
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
                                            <span style={{ 'font-size': '0.75rem' }}>JPEG, PNG, WebP, GIF · max 5 MB</span>
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
                        <PostCard
                            post={post}
                            currentTabLabel={currentTab().label}
                            myUserId={() => auth.user?.id}
                            onDelete={handleDelete}
                            onReact={handleReact}
                            onCommentAdded={handleCommentAdded}
                            onCommentDeleted={handleCommentDeleted}
                        />
                    )}
                </For>
            </div>
        </main>
    );
}
