import {
    createContext,
    useContext,
    onMount,
    ParentComponent,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { UserPublic, RegisterRequest, LoginRequest } from '@slutsnus/shared';

interface AuthState {
    user: UserPublic | null;
    loading: boolean;
}

interface AuthActions {
    login(data: LoginRequest): Promise<void>;
    register(data: RegisterRequest): Promise<void>;
    logout(): Promise<void>;
    fetchMe(): Promise<void>;
    setAvatarUrl(url: string): void;
}

type AuthContext = [AuthState, AuthActions];

const AuthCtx = createContext<AuthContext>();

export const AuthProvider: ParentComponent = (props) => {
    const [state, setState] = createStore<AuthState>({ user: null, loading: true });

    const fetchMe = async () => {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json() as { user: UserPublic };
                setState('user', data.user);
            } else {
                setState('user', null);
            }
        } catch {
            setState('user', null);
        } finally {
            setState('loading', false);
        }
    };

    const login = async (data: LoginRequest) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json() as { error: string };
            throw new Error(err.error);
        }
        const result = await res.json() as { user: UserPublic };
        setState('user', result.user);
    };

    const register = async (data: RegisterRequest) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json() as { error: string };
            throw new Error(err.error);
        }
        const result = await res.json() as { user: UserPublic };
        setState('user', result.user);
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        setState('user', null);
    };

    const setAvatarUrl = (url: string) => {
        setState('user', (u) => u ? { ...u, avatarUrl: url } : u);
    };

    onMount(fetchMe);

    return (
        <AuthCtx.Provider value={[state, { login, register, logout, fetchMe, setAvatarUrl }]} >
            {props.children}
        </AuthCtx.Provider>
    );
};

export function useAuth(): AuthContext {
    const ctx = useContext(AuthCtx);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
