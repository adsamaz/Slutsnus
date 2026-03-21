import { createSignal, Show } from 'solid-js';
import { useAuth } from '../stores/auth';
import { useNavigate } from '@solidjs/router';
import Button from '../components/Button';

export default function Profile() {
    const [authState, { logout, setAvatarUrl }] = useAuth();
    const navigate = useNavigate();
    const [uploading, setUploading] = createSignal(false);
    const [uploadError, setUploadError] = createSignal('');

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const user = () => authState.user;

    const handleAvatarChange = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        setUploadError('');
        setUploading(true);

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const res = await fetch('/api/profile/avatar', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            if (!res.ok) {
                const err = await res.json() as { error: string };
                throw new Error(err.error);
            }
            const data = await res.json() as { avatarUrl: string };
            setAvatarUrl(`${data.avatarUrl}?t=${Date.now()}`);
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <main class="page">
            <h2 class="page-title">Profile</h2>
            <div class="card profile-card">
                <div class="profile-avatar-section">
                <label class="profile-avatar-wrap" title="Change profile picture">
                    <Show
                        when={user()?.avatarUrl}
                        fallback={
                            <div class="profile-avatar profile-avatar--letter">
                                {user()?.username?.charAt(0).toUpperCase()}
                            </div>
                        }
                    >
                        <img class="profile-avatar profile-avatar--img" src={user()!.avatarUrl!} alt="avatar" />
                    </Show>
                    <span class="profile-avatar-overlay" />
                    <span class="profile-avatar-badge">
                        {uploading() ? (
                            <span class="profile-avatar-badge-spinner" />
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                <circle cx="12" cy="13" r="4"/>
                            </svg>
                        )}
                    </span>
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarChange}
                        disabled={uploading()}
                    />
                </label>
                <p class="profile-avatar-hint">Click to change photo</p>
                </div>

                <Show when={uploadError()}>
                    <p class="error-text">{uploadError()}</p>
                </Show>

                <div class="profile-info">
                    <div class="form-group">
                        <label class="form-label">Username</label>
                        <p class="profile-value">{user()?.username}</p>
                    </div>
                </div>
                <Button class="btn btn-danger" onClick={handleLogout} style={{ 'margin-top': '1.5rem' }}>
                    Logout
                </Button>
            </div>
        </main>
    );
}
