'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import MuiCard from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import logo from '../../../public/logo_shadows.svg'
import { signIn } from '@/lib/auth-client'
import AppTheme from '@/theme/AppTheme'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'

const Card = styled(MuiCard)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  alignItems: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(3),
  margin: 'auto',
  [theme.breakpoints.up('sm')]: {
    maxWidth: '420px',
  },
  boxShadow:
    'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
}))

const SignInContainer = styled(Stack)(({ theme }) => ({
  height: '100dvh',
  minHeight: '100%',
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
  },
  '&::before': {
    content: '""',
    display: 'block',
    position: 'absolute',
    zIndex: -1,
    inset: 0,
    backgroundImage:
      'radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))',
    backgroundRepeat: 'no-repeat',
  },
}))

export default function Page() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  const handleLogin = async () => {
    await signIn.oauth2({
      providerId: 'keycloak',
      callbackURL: '/',
      scopes: ['openid', 'email', 'profile'],
    })
  }

  return (
    <AppTheme>
      <SignInContainer direction="column" justifyContent="center">
        <Card variant="outlined">
          <Image
            alt="FleetOptimiser logo"
            src={logo}
            width={0}
            height={0}
            style={{ width: '100px', height: 'auto' }}
            priority
          />
          <Typography
            component="h1"
            variant="h4"
            sx={{ fontWeight: 600 }}
          >
            FleetOptimiser
          </Typography>
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleLogin}
            startIcon={<LoginRoundedIcon />}
            sx={{ mt: 1 }}
          >
            Log ind
          </Button>
          {message === 'invalidrole' && (
            <Alert severity="error" sx={{ width: '100%' }}>
              Du har ikke en godkendt FleetOptimiser rolle.
            </Alert>
          )}
        </Card>
      </SignInContainer>
    </AppTheme>
  )
}
