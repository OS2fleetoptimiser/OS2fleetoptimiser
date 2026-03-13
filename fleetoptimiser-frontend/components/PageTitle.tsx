import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface PageTitleProps {
  title: string;
  subtitle?: string;
}

export default function PageTitle({ title, subtitle }: PageTitleProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        component="h2"
        variant="h3"
        sx={{ fontWeight: 600, color: 'text.primary', mt: 3 }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, maxWidth: 720 }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
