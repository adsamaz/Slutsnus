import { Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useAuth } from '../stores/auth';

export default function Navbar() {
    const [auth, { logout }] = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <nav class="navbar">
            <div class="navbar-brand">
                <A href="/" class="navbar-logo">🎮 Slutsnus</A>
            </div>
            <div class="navbar-links">
                <A href="/" class="nav-link">Games</A>
                <Show when={auth.user}>
                    <A href="/friends" class="nav-link">Friends</A>
                    <A href="/leaderboard" class="nav-link">Leaderboard</A>
                    <A href="/profile" class="nav-link">Profile</A>
                </Show>
            </div>
            <div class="navbar-auth">
                <Show
                    when={auth.user}
                    fallback={
                        <>
                            <A href="/login" class="btn btn-secondary" style={{ 'margin-right': '8px' }}>Login</A>
                            <A href="/register" class="btn btn-primary">Register</A>
                        </>
                    }
                >
                    <span class="navbar-username">{auth.user!.username}</span>
                    <button class="btn btn-danger" onClick={handleLogout} style={{ 'margin-left': '12px' }}>
                        Logout
                    </button>
                </Show>
            </div>
        </nav>
    );
}
