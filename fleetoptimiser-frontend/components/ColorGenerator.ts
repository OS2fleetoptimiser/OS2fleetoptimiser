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

function hslToHex(h: number, s: number, l: number) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, '0'); // convert to Hex and prefix "0" if needed
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// Generate random pastel colors from seed. Used to generate colors in dashboard
export function generateColor(seed: string, opacity?: number) {
    const rng = seedrandom(hashCode(seed).toString());
    const hue = 360 * rng();
    const saturation = 50;
    const lightness = 70;
    if (opacity) return `hsl(${hue} ${saturation}% ${lightness}% / ${opacity})`;
    else return `hsl(${hue} ${saturation}% ${lightness}% / 1)`;
}


const colorPalette = ['#052528', '#134d54', '#038696', '#048a9d', '#15b3c5', '#63d4e0', '#73979a', '#d1eff3'];
const softColorPalette = [
  '#A8D5BA', // Soft Mint Green
  '#F6D8AE', // Gentle Peach
  '#FFD3B4', // Light Coral
  '#D4A5A5', // Soft Rose
  '#A0C1B8', // Muted Aqua
  '#F1E1A6', // Light Honey Yellow
  '#BFD7EA', // Pale Sky Blue
  '#E8D9B5', // Soft Beige
  '#C8B8DB', // Lavender Mist
  '#EFD9CE'  // Blush Pink
];
const extendedSoftColorPalette = [
  '#A8D5BA', // Soft Mint Green
  '#F6D8AE', // Gentle Peach
  '#FFD3B4', // Light Coral
  '#D4A5A5', // Soft Rose
  '#A0C1B8', // Muted Aqua
  '#F1E1A6', // Light Honey Yellow
  '#BFD7EA', // Pale Sky Blue
  '#E8D9B5', // Soft Beige
  '#C8B8DB', // Lavender Mist
  '#EFD9CE', // Blush Pink
  '#C2E1C2', // Light Sage Green
  '#FFE2CC', // Soft Apricot
  '#F7C7C7', // Soft Pastel Red
  '#D3BECF', // Muted Lilac
  '#A4C5C6', // Light Powder Blue
  '#F2E4C7', // Gentle Sand
  '#DAE8FC', // Pale Periwinkle Blue
  '#E7E3D4', // Soft Warm Gray
  '#D1C2E8', // Gentle Lilac
  '#E6CBC5'  // Soft Pink Blush
];


export function generateFromPalette(seed: string, opacity?: number) {
    const rng = seedrandom(hashCode(seed).toString());
    const colorIndex = Math.floor(rng() * extendedSoftColorPalette.length);
    const selectedColor = extendedSoftColorPalette[colorIndex];

    if (opacity !== undefined) {
        return hexToRgba(selectedColor, opacity);
    }
    return hexToRgba(selectedColor, 1);
}

function hexToRgba(hex: string, opacity: number) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
