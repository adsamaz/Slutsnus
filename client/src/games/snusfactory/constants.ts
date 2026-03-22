import type { StationType, SnusFlavorType } from '@slutsnus/shared';

export const CANVAS_W = 1600;
export const CANVAS_H = 960;
export const TICK_MS = 20;

export interface StationRect {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
}

export const STATION_RECTS: Record<StationType, StationRect> = {
    'planter-l':             { x: 50,   y: 110, w: 160, h: 120, label: 'PLANTER'  },
    'planter-r':             { x: 1390, y: 110, w: 160, h: 120, label: 'PLANTER'  },
    'patch-1':               { x: 460,  y: 100, w: 130, h: 130, label: 'PATCH'    },
    'patch-2':               { x: 735,  y: 100, w: 130, h: 130, label: 'PATCH'    },
    'patch-3':               { x: 1010, y: 100, w: 130, h: 130, label: 'PATCH'    },
    'flavor-shelf-mint':     { x: 470,  y: 300, w: 130, h: 110, label: 'MINT'     },
    'flavor-shelf-juniper':  { x: 735,  y: 300, w: 130, h: 110, label: 'JUNIPER'  },
    'flavor-shelf-licorice': { x: 1000, y: 300, w: 130, h: 110, label: 'LICORICE' },
    'grinder':               { x: 560,  y: 500, w: 180, h: 140, label: 'GRINDER'  },
    'packager':              { x: 860,  y: 500, w: 180, h: 140, label: 'PACKAGER' },
    'order-0':               { x: 160,  y: 780, w: 280, h: 110, label: 'ORDER'    },
    'order-1':               { x: 660,  y: 780, w: 280, h: 110, label: 'ORDER'    },
    'order-2':               { x: 1160, y: 780, w: 280, h: 110, label: 'ORDER'    },
    'storage-l-1':           { x: 230,  y: 408, w: 100, h: 85,  label: 'STORAGE'  },
    'storage-l-2':           { x: 230,  y: 528, w: 100, h: 85,  label: 'STORAGE'  },
    'storage-r-1':           { x: 1270, y: 408, w: 100, h: 85,  label: 'STORAGE'  },
    'storage-r-2':           { x: 1270, y: 528, w: 100, h: 85,  label: 'STORAGE'  },
};

export const PLAYER_INTERACT_RADIUS = 100;
export const ORDER_INTERACT_RADIUS = 180;

export const PLAYER_COLORS = ['#4a9eff', '#ff4a4a', '#4eff8a', '#ffe04a'];
export const PLAYER_RADIUS = 20;

export const FLAVOR_COLORS: Record<SnusFlavorType, string> = {
    mint:     '#3ddba0',
    juniper:  '#4a7c59',
    licorice: '#7c3aed',
    original: '#8b5a2b',
};

export const FLAVOR_LABEL: Record<SnusFlavorType, string> = {
    mint:     'ZYN COOL MINT',
    juniper:  'KNOX BLUE WHITE',
    licorice: 'KALIBER VIT SALMIAK',
    original: 'ORIGINAL',
};

export const ORDER_EXPIRY_TICKS = 1500; // must match server
