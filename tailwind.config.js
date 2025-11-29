/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            transitionDuration: {
                '1250': '1250ms',
            },
            colors: {
                bg: {
                    page: '#F5F4EF',
                    surface: '#FFFFFF',
                    subtle: '#F0F0F0',
                    100: '#F5F4EF', // Claude bg-100
                    0: '#FFFFFF',   // Claude bg-000
                    150: '#E8E6DC',
                    200: '#F0F0F0', // Claude bg-200 (approx)
                    300: '#E5E5E5', // Claude bg-300 (approx)
                },
                border: {
                    DEFAULT: '#E5E5E5',
                    subtle: '#E5E5E5',
                    100: '#E5E5E5',
                    200: '#D1D1D1',
                    300: '#1F1E1D26', //#B0B0B0
                    400: '#999999',
                },
                text: {
                    primary: '#222222',
                    secondary: '#666666',
                    tertiary: '#999999',
                    0: '#222222', // Claude text-000 (approx main text)
                    100: '#333333', // Claude text-100
                    200: '#555555', // Claude text-200
                    300: '#777777', // Claude text-300
                    400: '#73726C', // Claude text-400
                    500: '#B0B0B0', // Claude text-500
                },
                accent: {
                    DEFAULT: '#222222', // Using dark grey/black as accent for buttons
                    hover: '#000000',
                    focus: '#2C84DB',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                serif: ['ui-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
                'claude-response': ['Inter', 'system-ui', 'sans-serif'], // Mapping to sans for now
                'ui': ['Inter', 'system-ui', 'sans-serif'],
                'display': ['ui-serif', 'Georgia', 'serif'], // Mapping display to serif
            },
        },
    },
    plugins: [],
}
