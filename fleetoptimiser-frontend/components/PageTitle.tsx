import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

type PageTitleProps =
  | { title: string; subtitle?: string; level?: 'page' }
  | { title: string; level: 'section' };

export default function PageTitle(props: PageTitleProps) {
  if (props.level === 'section') {
    return (
      <Typography
        component="h3"
        variant="h6"
        sx={{ fontWeight: 600, color: 'text.primary', mt: 2, mb: 1 }}
      >
        {props.title}
      </Typography>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        component="h2"
        variant="h4"
        sx={{ fontWeight: 600, color: 'text.primary' }}
      >
        {props.title}
      </Typography>
      {props.subtitle && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, maxWidth: 720 }}
        >
          {props.subtitle}
        </Typography>
      )}
    </Box>
  );
}
