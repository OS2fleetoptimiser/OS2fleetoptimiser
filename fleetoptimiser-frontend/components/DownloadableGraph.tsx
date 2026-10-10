import React, { useRef } from 'react';
import { Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { gray } from '@/theme/themePrimitives';

export type GraphHeaderStat = {
    label: string;
    value: string;
    sub?: string;
};

// the title and key figures shown above a graph; passed in rather than read back out
// of the dom so the downloaded image carries the same numbers the user is looking at
export type GraphHeader = {
    title: string;
    stats?: GraphHeaderStat[];
};

type DownloadableGraphProps = {
    filename?: string;
    header?: GraphHeader;
    children: React.ReactNode;
    downloadPlacement?: string;
};

const fontFamily = 'Inter, sans-serif';

// css pixel sizes, scaled to device pixels before drawing so the header text ends up
// as sharp as the graph it sits above
const layout = {
    padding: 16,
    titleSize: 16,
    titleLine: 22,
    titleToStats: 14,
    labelSize: 11,
    labelLine: 16,
    valueSize: 18,
    valueLine: 24,
    subSize: 11,
    subLine: 15,
    statGap: 32,
    statRowGap: 12,
    separatorGap: 14,
};

const measuringContext = () => document.createElement('canvas').getContext('2d');

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    return lines;
};

// draws the header when given a context, measures it when given null. both passes run
// the same layout, so the measured height is exactly what the drawn header occupies.
const renderHeader = (ctx: CanvasRenderingContext2D | null, header: GraphHeader, width: number, scale: number) => {
    const pen = ctx ?? measuringContext();
    if (!pen) return 0;

    const px = (value: number) => value * scale;
    const pad = px(layout.padding);
    const maxWidth = width - pad * 2;
    if (maxWidth <= 0) return 0;

    let y = pad;

    pen.textBaseline = 'top';
    pen.font = `600 ${px(layout.titleSize)}px ${fontFamily}`;
    for (const line of wrapText(pen, header.title, maxWidth)) {
        if (ctx) {
            ctx.fillStyle = gray[800];
            ctx.fillText(line, pad, y);
        }
        y += px(layout.titleLine);
    }

    const stats = header.stats?.filter((stat) => stat.value !== '') ?? [];
    if (stats.length > 0) {
        const columns = stats.map((stat) => {
            pen.font = `${px(layout.labelSize)}px ${fontFamily}`;
            const labelWidth = pen.measureText(stat.label).width;
            pen.font = `600 ${px(layout.valueSize)}px ${fontFamily}`;
            const valueWidth = pen.measureText(stat.value).width;
            let subWidth = 0;
            if (stat.sub) {
                pen.font = `${px(layout.subSize)}px ${fontFamily}`;
                subWidth = pen.measureText(stat.sub).width;
            }
            return { stat, width: Math.max(labelWidth, valueWidth, subWidth) };
        });

        // pack the columns into rows so a graph split on many vagter wraps instead of
        // running off the right edge of the image
        const gap = px(layout.statGap);
        const rows: (typeof columns)[] = [];
        let row: typeof columns = [];
        let rowWidth = 0;
        for (const column of columns) {
            const advance = row.length ? gap + column.width : column.width;
            if (row.length && rowWidth + advance > maxWidth) {
                rows.push(row);
                row = [column];
                rowWidth = column.width;
            } else {
                row.push(column);
                rowWidth += advance;
            }
        }
        if (row.length) rows.push(row);

        y += px(layout.titleToStats);
        for (const [rowIndex, columnsInRow] of rows.entries()) {
            const hasSub = columnsInRow.some((column) => column.stat.sub);
            let x = pad;
            for (const [columnIndex, column] of columnsInRow.entries()) {
                if (ctx) {
                    // mirrors the divide-x separators on the stat box in the dashboards
                    if (columnIndex > 0) {
                        ctx.strokeStyle = gray[300];
                        ctx.lineWidth = Math.max(1, px(1));
                        ctx.beginPath();
                        ctx.moveTo(x - gap / 2, y);
                        ctx.lineTo(x - gap / 2, y + px(layout.labelLine + layout.valueLine));
                        ctx.stroke();
                    }
                    ctx.fillStyle = gray[600];
                    ctx.font = `${px(layout.labelSize)}px ${fontFamily}`;
                    ctx.fillText(column.stat.label, x, y);
                    ctx.fillStyle = gray[800];
                    ctx.font = `600 ${px(layout.valueSize)}px ${fontFamily}`;
                    ctx.fillText(column.stat.value, x, y + px(layout.labelLine));
                    if (column.stat.sub) {
                        ctx.fillStyle = gray[500];
                        ctx.font = `${px(layout.subSize)}px ${fontFamily}`;
                        ctx.fillText(column.stat.sub, x, y + px(layout.labelLine + layout.valueLine));
                    }
                }
                x += column.width + gap;
            }
            y += px(layout.labelLine + layout.valueLine + (hasSub ? layout.subLine : 0));
            if (rowIndex < rows.length - 1) y += px(layout.statRowGap);
        }
    }

    y += px(layout.separatorGap);
    if (ctx) {
        ctx.strokeStyle = gray[200];
        ctx.lineWidth = Math.max(1, px(1));
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(width - pad, y);
        ctx.stroke();
    }

    return y + px(layout.separatorGap);
};

export const DownloadableGraph = ({ filename = 'graph.png', header, children, downloadPlacement }: DownloadableGraphProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDownload = () => {
        if (!containerRef.current) return;

        const compose = (source: CanvasImageSource, width: number, height: number, scale: number, done?: () => void) => {
            const headerHeight = header ? Math.round(renderHeader(null, header, width, scale)) : 0;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height + headerHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            // Fill white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (header) renderHeader(ctx, header, width, scale);
            // Draw the graph below the header
            ctx.drawImage(source, 0, headerHeight, width, height);
            const url = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            done?.();
        };

        // First try to find a <canvas> element.
        const canvasElement = containerRef.current.querySelector('canvas');
        if (canvasElement) {
            // canvas graphs are drawn at device resolution, so the header has to be scaled
            // by the same factor to stay proportional to the graph
            const scale = canvasElement.clientWidth > 0 ? canvasElement.width / canvasElement.clientWidth : 1;
            compose(canvasElement, canvasElement.width, canvasElement.height, scale);
            return;
        }

        // if not a canvas graph, we look for a svg element that contains the graph
        const svgElement = containerRef.current.querySelector('svg');
        if (!svgElement) return;

        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svgElement);

        // svg necessary namespaces.
        if (!svgString.match(/xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        if (!svgString.match(/xmlns:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/))
            svgString = svgString.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URLObject = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            compose(img, svgElement.clientWidth, svgElement.clientHeight, 1, () => URL.revokeObjectURL(URLObject));
        };

        img.src = URLObject;
    };

    return (
        <div className="w-full h-full relative" ref={containerRef}>
            {children}
            <Button
                onClick={handleDownload}
                size="small"
                startIcon={<DownloadIcon fontSize="small" />}
                className={downloadPlacement ?? 'absolute top-0 right-0'}
                sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
                Download
            </Button>
        </div>
    );
};
