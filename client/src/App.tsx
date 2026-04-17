import { Router, Route } from '@solidjs/router';
import { lazy, ParentProps } from 'solid-js';
import { AuthProvider } from './stores/auth';
import { SocketProvider } from './stores/socket';
import { RoomProvider } from './stores/room';
import { FriendsProvider } from './stores/friends';
import Navbar from './components/Navbar';
import { ToastContainer } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import GameInviteModal from './components/GameInviteModal';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Lobby = lazy(() => import('./pages/Lobby'));
const GamePage = lazy(() => import('./pages/GamePage'));
const Friends = lazy(() => import('./pages/Friends'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Fredag = lazy(() => import('./pages/Fredag'));

function Layout(props: ParentProps) {
    return (
        <>
            <Navbar />
            <ToastContainer />
            <GameInviteModal />
            {props.children}
        </>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <SocketProvider>
                <RoomProvider>
                    <FriendsProvider>
                        <Router root={Layout}>
                            <Route path="/" component={Home} />
                            <Route path="/login" component={Login} />
                            <Route path="/register" component={Register} />
                            <Route
                                path="/lobby/:code"
                                component={() => (
                                    <ProtectedRoute>
                                        <Lobby />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route
                                path="/game/:code"
                                component={() => (
                                    <ProtectedRoute>
                                        <GamePage />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route
                                path="/friends"
                                component={() => (
                                    <ProtectedRoute>
                                        <Friends />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route path="/leaderboard" component={Leaderboard} />
                            <Route
                                path="/profile"
                                component={() => (
                                    <ProtectedRoute>
                                        <Profile />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route path="/fredag" component={Fredag} />
                        </Router>
                    </FriendsProvider>
                </RoomProvider>
            </SocketProvider>
        </AuthProvider>
    );
}
