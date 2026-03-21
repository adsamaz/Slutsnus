import { Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import Avatar from './Avatar';

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
                <A href="/" class="navbar-logo">Slutsnus</A>
            </div>
            <div class="navbar-links">
                <A href="/" class="nav-link" end>Games</A>
                <Show when={auth.user}>
                    <A href="/friends" class="nav-link">Friends</A>
                    <A href="/leaderboard" class="nav-link">Leaderboard</A>
                </Show>
            </div>
            <div class="navbar-auth">
                <Show
                    when={auth.user}
                    fallback={
                        <>
                            <A href="/login" class="btn btn-secondary">Login</A>
                            <A href="/register" class="btn btn-primary">Register</A>
                        </>
                    }
                >
                    <A href="/profile" class="navbar-username">
                        <Avatar username={auth.user!.username} avatarUrl={auth.user!.avatarUrl} />
                        {auth.user!.username}
                    </A>
                </Show>
            </div>
        </nav>
    );
}
