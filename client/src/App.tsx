import { Router, Route } from '@solidjs/router';
import { lazy, ParentProps } from 'solid-js';
import { AuthProvider } from './stores/auth';
import { SocketProvider } from './stores/socket';
import { RoomProvider } from './stores/room';
import { FriendsProvider } from './stores/friends';
import Navbar from './components/Navbar';
import { ToastContainer } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Lobby = lazy(() => import('./pages/Lobby'));
const GamePage = lazy(() => import('./pages/GamePage'));
const GameDetail = lazy(() => import('./pages/GameDetail'));
const Friends = lazy(() => import('./pages/Friends'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));

function Layout(props: ParentProps) {
    return (
        <>
            <Navbar />
            <ToastContainer />
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
                            <Route path="/games/:slug" component={GameDetail} />
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
                            <Route
                                path="/leaderboard"
                                component={() => (
                                    <ProtectedRoute>
                                        <Leaderboard />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route
                                path="/profile"
                                component={() => (
                                    <ProtectedRoute>
                                        <Profile />
                                    </ProtectedRoute>
                                )}
                            />
                        </Router>
                    </FriendsProvider>
                </RoomProvider>
            </SocketProvider>
        </AuthProvider>
    );
}
