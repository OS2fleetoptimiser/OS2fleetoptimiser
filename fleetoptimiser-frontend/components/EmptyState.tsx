import { Card, Typography } from '@mui/material';

interface EmptyStateProps {
    icon: React.ReactElement;
    children: React.ReactNode;
}

const EmptyState = ({ icon, children }: EmptyStateProps) => {
    return (
        <Card sx={{ p: 3, maxWidth: 480 }} className="flex items-start space-x-4">
            <div className="pt-0.5">
                {icon}
            </div>
            <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 1.7 }}>
                {children}
            </Typography>
        </Card>
    );
};

export default EmptyState;
