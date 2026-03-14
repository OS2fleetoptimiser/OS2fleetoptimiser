'use client';
import {createTheme} from '@mui/material/styles'

declare module '@mui/material/Button' {
    interface ButtonPropsVariantOverrides {
        dashed: true;
    }
}

const theme = createTheme({
    palette: {
        primary: {
            main: '#224bb4',  // Tailwind primary color
        },
        secondary: {
            main: '#607fd2'
        },
        info: {
            main: '#e0e0e0'
        },
        background: {
            default: 'hsl(0, 0%, 99%)',
            paper: 'hsl(220, 35%, 97%)',
        },
        divider: 'rgba(194, 199, 208, 0.4)',
    },
    shape: {
        borderRadius: 8,
    },
    typography: {
        fontFamily: ["Inter Tight", "Montserrat", "Helvetica", "Arial", "sans-serif"].join(", "),
        allVariants: {
            MozOsxFontSmoothing: 'grayscale',
            WebkitFontSmoothing: 'antialiased',
            textRendering: 'optimizeLegibility',
        },
        // @ts-expect-error MUI typography fontWeight non-standard keys
        fontWeight: {
            regular: 400,
            bold: 700,
            extrabold: 800,
        },
        h3: {
            fontWeight: 700,
            fontSize: "16pt",
            // letterSpacing: "-.5px"

        },
        h2: {
            fontWeight: 400,
            fontSize: "18pt",
            // letterSpacing: "-.5px"

        },
        h4: {
            fontWeight: 700,
            fontSize: "13pt",
            // letterSpacing: "-.5px"

        },
        h5: {
            fontWeight: 700,
            fontSize: "11pt"
        },
        h6: {
            fontSize: "13pt",
            fontWeight: 700,
            color: "#4d4d4d"
        },
        subtitle: {
            fontSize: "8pt"
        }
    },
    components: {
        MuiPaper: {
            defaultProps: {
                elevation: 0,
            },
        },
        MuiCard: {
            defaultProps: {
                variant: 'outlined' as const,
            },
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#ffffff',
                },
            },
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    '&:last-child': {
                        paddingBottom: 16,
                    },
                },
            },
        },
        MuiAccordion: {
            defaultProps: {
                variant: 'outlined' as const,
            },
            styleOverrides: {
                root: {
                    '&:before': { display: 'none' },
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    "&.subtle": {
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'rgba(0,0,0,0.6)',
                                borderRadius: 3,
                                borderWidth: 0,
                            },
                            '&:hover fieldset': {
                                borderColor: 'rgba(0,0,0,1)',
                                borderWidth: 2
                            },
                            '&.Mui-focused fieldset': {
                                boxShadow: '0 0 3px rgba(0,61,122,0.5)',
                                borderColor: 'rgba(0,0,0,1)'
                            }
                        },
                        '& .MuiInputLabel-root': { // the label
                            fontWeight: 'normal',
                            color: '#000'
                        },
                        '& .MuiInputBase-input': { // the text when typed in the textfield
                            fontWeight: 'medium',
                            color: '#000',
                            borderRadius: 3,
                            backgroundColor: '#f5f5f5'
                        }
                    }
                }
            }
        },
        MuiSelect: {
            styleOverrides: {
                root: {
                    "&.subtle": {
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'rgba(0,0,0,0.6)',
                                borderRadius: 3,
                                borderWidth: 0,
                            },
                            '&:hover fieldset': {
                                borderColor: 'rgba(0,0,0,1)',
                                borderWidth: 2
                            },
                            '&.Mui-focused fieldset': {
                                boxShadow: '0 0 3px rgba(0,61,122,0.5)',
                                borderColor: 'rgba(0,0,0,1)'
                            },
                            '&.Mui-active fieldset': {
                                boxShadow: '0 0 3px rgba(0,61,122,0.5)',
                                borderColor: 'rgba(0,0,0,1)'
                            }
                        },
                        '& .MuiInputLabel-root': {
                            fontWeight: 'normal',
                            color: '#000'
                        },
                        '& .MuiSelect-select': {
                            fontWeight: 'bold',
                            color: '#000',
                            borderRadius: 3,
                            backgroundColor: '#f5f5f5'
                        }
                    }
                }
            }
        },
        MuiButton: {
            variants: [
                {
                    props: {variant: 'dashed'},
                    style: {
                        textTransform: 'none',
                        border: `2px dashed red`,
                    },
                },
                {
                    props: {variant: 'dashed', color: 'secondary'},
                    style: {
                        border: `4px dashed red`,
                    },
                },
            ],
        },
    }
});

export default theme;
