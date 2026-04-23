import { gray } from './themePrimitives'

const fontFamily = 'Inter, sans-serif'

export const chartLabelDark = gray[800]
export const chartLabelLight = gray[50]

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

export const chartPalette = {
  blue100: 'hsl(210, 50%, 85%)',
  blue200: 'hsl(210, 50%, 75%)',
  blue500: 'hsl(210, 50%, 55%)',
  blue700: 'hsl(210, 45%, 42%)',
  blue900: 'hsl(210, 45%, 30%)',
  vehicleBike: 'hsl(145, 40%, 48%)',
  vehicleEBike: 'hsl(35, 70%, 58%)',
  vehicleElectric: 'hsl(210, 50%, 55%)',
  vehicleFossil: 'hsl(0, 55%, 58%)',
  vehicleUnassigned: 'hsl(220, 20%, 42%)',
  heatmap: 'hsl(210, 50%, 55%)',
  heatmapWarning: 'hsl(0, 55%, 58%)',
  heatmapEmpty: 'hsl(220, 20%, 88%)',
}

export const vehicleTypeColors: Record<string, string> = {
  'Cykel': chartPalette.vehicleBike,
  'El-cykel': chartPalette.vehicleEBike,
  'El-bil': chartPalette.vehicleElectric,
  'Fossil-bil': chartPalette.vehicleFossil,
  'Ikke tildelt': chartPalette.vehicleUnassigned,
}

export const heatmapGradient = [chartPalette.heatmap, '#ffffff'] as const
export const heatmapWarningGradient = [chartPalette.heatmapWarning, '#ffffff'] as const

export const shiftGradient = [
  chartPalette.blue100,
  chartPalette.blue200,
  chartPalette.blue500,
  chartPalette.blue700,
  chartPalette.blue900,
] as const

const contrastTextMap: Record<string, string> = {
  [chartPalette.blue100]: chartLabelDark,
  [chartPalette.blue200]: chartLabelDark,
  [chartPalette.blue500]: chartLabelLight,
  [chartPalette.blue700]: chartLabelLight,
  [chartPalette.blue900]: chartLabelLight,
  [chartPalette.vehicleBike]: chartLabelLight,
  [chartPalette.vehicleEBike]: chartLabelDark,
  [chartPalette.vehicleFossil]: chartLabelLight,
}

export const getContrastTextColor = (bgColor: string): string =>
  contrastTextMap[bgColor] ?? chartLabelDark

