import { useAuth } from '../stores/auth';
import { useNavigate } from '@solidjs/router';
import Button from '../components/Button';

export default function Profile() {
    const [authState, { logout }] = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const user = () => authState.user;

    return (
        <main class="page">
            <h2 class="page-title">Profile</h2>
            <div class="card profile-card">
                <div class="profile-avatar">{user()?.username?.charAt(0).toUpperCase()}</div>
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
