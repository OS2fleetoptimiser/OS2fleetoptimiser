/** @type {import('tailwindcss').Config} */
module.exports = {
    corePlugins: {
        preflight: false,
    },
    important: '#__next',
    content: [
        './app/**/*.{js,ts,jsx,tsx}',
        './pages/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',

        // Or if using `src` directory:
        './src/**/*.{js,ts,jsx,tsx}',
    ],

    theme: {
        extend: {
             screens: {
                'tiny': '400px',
              },
            fontFamily: { 'body': ["Inter Tight", "Montserrat", "Helvetica", "Arial", "sans-serif"] },
            colors: {
                blaa: '#224bb4',
                moerkeblaa: '#003d7a',
                primary: '#4f7c64',
                secondary: '#70ea33',
                explanation: 'rgba(0,0,0,0.5)',
                'red-25': '#dd333308',
                'green-25': '#44ce7708',
                'blue-25': '#224bb408',
                'indigo-25': '#6366f108'
            },
            scale: {
                101: '1.01',
                103: '1.03'
            },
            spacing: {
                '84': '21rem',
                '80': '20rem',
                '76': '19rem',
                '70': '17.5rem',
                '68': '17rem',
                '66': '16.5rem',
                '128': '32rem',
                '168': '42rem',
                '256': '64rem'
            },
            width: {
                '168': '42rem'
            },
            height: {
                '168': '42rem'
            },
            lineHeight: {
                'explanation': '1.66',
            },
            maxHeight: {
                'limit': '80%'
            },
            maxWidth: {
                '128': '32rem'
            }
        }
    },
    plugins: [],
};
