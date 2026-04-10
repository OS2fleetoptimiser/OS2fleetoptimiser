import seedrandom from 'seedrandom';

const hashCode = function (string: string) {
    let hash = 0,
        i,
        chr;
    if (string.length === 0) return hash;
    for (i = 0; i < string.length; i++) {
        chr = string.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

const distinctPalette = [
    '#4E79A7',
    '#F28E2B',
    '#E15759',
    '#76B7B2',
    '#59A14F',
    '#EDC948',
    '#B07AA1',
    '#FF9DA7',
    '#9C755F',
    '#BAB0AC',
    '#5591C3',
    '#D4742C',
    '#8CD17D',
    '#F1CE63',
    '#A0CBE8',
    '#FABFD2',
];

const paletteCache = new Map<string, string>();

export function generateFromPalette(seed: string, opacity?: number) {
    const key = `${seed}:${opacity ?? 1}`;
    const cached = paletteCache.get(key);
    if (cached) return cached;

    const rng = seedrandom(hashCode(seed).toString());
    const colorIndex = Math.floor(rng() * distinctPalette.length);
    const selectedColor = distinctPalette[colorIndex];
    const result = hexToRgba(selectedColor, opacity ?? 1);
    paletteCache.set(key, result);
    return result;
}

function hexToRgba(hex: string, opacity: number) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
