export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Només el titular de benvinguda (src/index.css). La resta de l'app fa servir la lletra del sistema.
        titular: ['"Fraunces Titular"', '"Fraunces Titular Reserva"', 'Georgia', '"Noto Serif"', 'serif'],
        // La segona línia, manuscrita. Si Satisfy no arriba, la primera lletra del titular (mai la cursiva del sistema).
        'titular-ma': ['"Satisfy Titular"', '"Fraunces Titular"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}