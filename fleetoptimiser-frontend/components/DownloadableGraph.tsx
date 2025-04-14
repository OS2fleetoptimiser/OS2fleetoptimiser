import React, { useRef } from 'react';
import Tooltip from '@mui/material/Tooltip';
import { IconButton } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

type DownloadableGraphProps = {
    filename?: string;
    children: React.ReactNode;
    downloadPlacement?: string;
};

export const DownloadableGraph = ({ filename = 'graph.png', children, downloadPlacement }: DownloadableGraphProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDownload = () => {
        if (!containerRef.current) return;

        // First try to find a <canvas> element.
        const canvasElement = containerRef.current.querySelector('canvas');
        if (canvasElement) {
            const width = canvasElement.width;
            const height = canvasElement.height;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = width;
            newCanvas.height = height;
            const ctx = newCanvas.getContext('2d');
            if (ctx) {
                // Fill white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                // Draw the canvas graph on top
                ctx.drawImage(canvasElement, 0, 0);
                const url = newCanvas.toDataURL('image/png', 1.0);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
            }
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
            const width = svgElement.clientWidth;
            const height = svgElement.clientHeight;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                const url = canvas.toDataURL('image/png', 1.0);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(URLObject);
            }
        };

        img.src = URLObject;
    };

    return (
        <div className="w-full h-full relative" ref={containerRef}>
            {children}
            <Tooltip title="Download som billede">
                <IconButton onClick={handleDownload} className={`${downloadPlacement ?? 'absolute top-0 right-2'} border-none text-gray-700 hover:text-black`}>
                    <DownloadIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </div>
    );
};
