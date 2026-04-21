'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
const segmentLabels: Record<string, string> = {
  dashboard: 'Dashboards',
  driving: 'Kørsel',
  'trip-segments': 'Turoverblik',
  activity: 'Køretøjsaktivitet',
  timeactivity: 'Tidsaktivitet',
  availability: 'Ledighed',
  setup: 'Simuleringssetup',
  configuration: 'Køretøjer',
  fleet: 'Manuel simulering',
  goal: 'Automatisk simulering',
  'simulation-history': 'Simuleringshistorik',
  location: 'Lokationer',
  new: 'Ny lokation',
  settings: 'Settings',
  profile: 'Profile',
};

function getSegmentLabel(seg: string, prevSeg?: string): string {
  if (segmentLabels[seg]) return segmentLabels[seg];
  if (prevSeg && (prevSeg === 'fleet' || prevSeg === 'goal')) {
    return 'Simuleringsresultat';
  }
  return decodeURIComponent(seg);
}

export default function AppBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Placeholder matches rendered Breadcrumbs height (body2 line-height ~24px) + mb
  if (segments.length === 0) return <Box sx={{ height: 24, mb: 3 }} />;

  const crumbs = segments.map((seg, i) => ({
    label: getSegmentLabel(seg, segments[i - 1]),
    href: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <Breadcrumbs aria-label="breadcrumb" separator="/" sx={{ mb: 3 }}>
      <Link
        component={NextLink}
        href="/"
        underline="hover"
        color="text.secondary"
        variant="body2"
      >
        Hjem
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return isLast ? (
          <Typography
            key={crumb.href}
            variant="body2"
            color="text.primary"
            aria-current="page"
          >
            {crumb.label}
          </Typography>
        ) : (
          <Link
            component={NextLink}
            key={crumb.href}
            href={crumb.href}
            underline="hover"
            color="text.secondary"
            variant="body2"
          >
            {crumb.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
