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
    '#729ECE',
    '#FF9E4A',
    '#67BF5C',
    '#ED665D',
    '#AD8BC9',
    '#A8786E',
    '#ED97CA',
    '#A2A2A2',
    '#CDCC5D',
    '#6DCCDA',
    '#9CB3D6',
    '#B4CDA2',
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
