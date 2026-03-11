import { useParams } from '@solidjs/router';
import GameContainer from '../games/GameContainer';

export default function GamePage() {
    const params = useParams<{ code: string }>();
    return <GameContainer roomCode={params.code} />;
}
