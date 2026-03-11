import { SnusBrand, SnusItemOnMap } from '@slutsnus/shared';
import { v4 as uuidv4 } from 'uuid';

const MAP_WIDTH = 25;
const MAP_HEIGHT = 25;

export function generateMap(): { grid: number[][]; floorTiles: { x: number; y: number }[] } {
    const grid: number[][] = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(0));

    // Border walls
    for (let x = 0; x < MAP_WIDTH; x++) {
        grid[0][x] = 1;
        grid[MAP_HEIGHT - 1][x] = 1;
    }
    for (let y = 0; y < MAP_HEIGHT; y++) {
        grid[y][0] = 1;
        grid[y][MAP_WIDTH - 1] = 1;
    }

    // Horizontal wall corridors with gaps
    const horizontalCorridors = 6;
    const hSpacing = Math.floor((MAP_HEIGHT - 6) / (horizontalCorridors + 1));
    for (let i = 1; i <= horizontalCorridors; i++) {
        const y = 2 + i * hSpacing;
        if (y < MAP_HEIGHT - 2) {
            for (let x = 2; x < MAP_WIDTH - 2; x++) {
                if (Math.random() > 0.2) {
                    grid[y][x] = 1;
                }
            }
        }
    }

    // Vertical wall corridors with gaps
    const verticalCorridors = 6;
    const vSpacing = Math.floor((MAP_WIDTH - 6) / (verticalCorridors + 1));
    for (let i = 1; i <= verticalCorridors; i++) {
        const x = 2 + i * vSpacing;
        if (x < MAP_WIDTH - 2) {
            for (let y = 2; y < MAP_HEIGHT - 2; y++) {
                if (Math.random() > 0.2) {
                    grid[y][x] = 1;
                }
            }
        }
    }

    // Keep center area open
    for (let y = 8; y < 17; y++) {
        for (let x = 8; x < 17; x++) {
            grid[y][x] = 0;
        }
    }

    // Ensure spawn corners are clear
    for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
            grid[1 + dy][1 + dx] = 0;
            grid[1 + dy][MAP_WIDTH - 2 - dx] = 0;
            grid[MAP_HEIGHT - 2 - dy][1 + dx] = 0;
            grid[MAP_HEIGHT - 2 - dy][MAP_WIDTH - 2 - dx] = 0;
        }
    }

    const floorTiles: { x: number; y: number }[] = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            if (grid[y][x] === 0) {
                floorTiles.push({ x, y });
            }
        }
    }

    return { grid, floorTiles };
}

export function placeSnusItems(
    floorTiles: { x: number; y: number }[],
    brands: SnusBrand[],
    count: number,
): SnusItemOnMap[] {
    const items: SnusItemOnMap[] = [];
    const shuffled = [...floorTiles].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
        const tile = shuffled[i];
        const brand = brands[Math.floor(Math.random() * brands.length)];
        items.push({
            id: uuidv4(),
            brandId: brand.id,
            x: tile.x,
            y: tile.y,
            collected: false,
        });
    }

    return items;
}

export function getSpawnPositions(): { x: number; y: number }[] {
    return [
        { x: 2, y: 2 },
        { x: MAP_WIDTH - 3, y: 2 },
        { x: 2, y: MAP_HEIGHT - 3 },
        { x: MAP_WIDTH - 3, y: MAP_HEIGHT - 3 },
    ];
}
