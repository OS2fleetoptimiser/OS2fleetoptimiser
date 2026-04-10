import { brand, gray, red } from './themePrimitives'

const fontFamily = 'Inter, sans-serif'

export const nivoTheme = {
  text: { fontFamily },
  axis: {
    ticks: { text: { fontFamily } },
    legend: { text: { fontFamily } },
  },
  labels: { text: { fontFamily } },
  legends: { text: { fontFamily } },
  grid: {
    line: {
      stroke: gray[200],
      strokeDasharray: '2 3',
    },
  },
}

export const vehicleTypeColors: Record<string, string> = {
  'Cykel': '#1B7D4E',
  'El-cykel': '#E8900C',
  'El-bil': brand[400],
  'Fossil-bil': '#C4314B',
  'Ikke tildelt': gray[500],
}

export const heatmapGradient = [brand[400], '#ffffff'] as const
export const heatmapWarningGradient = [red[400], '#ffffff'] as const

export const shiftGradient = [
  brand[200],
  brand[300],
  brand[400],
  brand[500],
  brand[700],
] as const

