import { createSignal, Show } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import Button from '../components/Button';

export default function Login() {
    const [, { login }] = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [error, setError] = createSignal('');
    const [loading, setLoading] = createSignal(false);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login({ username: username(), password: password() });
            navigate('/');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main class="page auth-page">
            <div class="auth-card card">
                <h2 class="auth-title">Login</h2>
                <form onSubmit={handleSubmit}>
                    <div class="form-group">
                        <label class="form-label">Username</label>
                        <input
                            class="input"
                            type="text"
                            value={username()}
                            onInput={(e) => setUsername(e.currentTarget.value)}
                            required
                            autocomplete="username"
                        />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input
                            class="input"
                            type="password"
                            value={password()}
                            onInput={(e) => setPassword(e.currentTarget.value)}
                            required
                            autocomplete="current-password"
                        />
                    </div>
                    <Show when={error()}>
                        <p class="error-text">{error()}</p>
                    </Show>
                    <Button type="submit" disabled={loading()} style={{ width: '100%', 'margin-top': '8px' }}>
                        {loading() ? 'Logging in...' : 'Login'}
                    </Button>
                </form>
                <p class="auth-switch">
                    Don't have an account? <A href="/register">Register</A>
                </p>
            </div>
        </main>
    );
}
