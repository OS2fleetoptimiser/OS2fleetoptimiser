import React from 'react';
import { Box, Typography, Card, CardActionArea } from '@mui/material';

interface IconTextCardProps {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
}

const IconTextCard = ({ icon, text, onClick }: IconTextCardProps) => {
  return (
    <Card
      sx={{
        width: 120,
        height: 80,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CardActionArea onClick={onClick} sx={{ padding: 2, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {icon}
            {/*//@ts-ignore*/}
          <Typography variant="subtitle" mt={1} fontWeight="fontWeightMedium" sx={{ textTransform: 'uppercase' }}>
              {text}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default IconTextCard;