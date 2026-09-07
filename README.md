# Calculator

A dependency-free web calculator with a keyboard-friendly UI and a small,
tested expression engine.

## Features

- Addition, subtraction, multiplication, division, percent, parentheses
- Correct operator precedence (`2 + 3 × 4 = 14`)
- Live result preview while typing
- Sign toggle (±), backspace, clear, and `Ans` to reuse the last result
- Keyboard input: digits, `+ - * /`, `%`, `( )`, `Enter` for equals,
  `Backspace`, `Esc` to clear
- Light and dark mode via `prefers-color-scheme`
- No `eval()`: expressions are parsed with a recursive-descent parser

## Run it

Open `index.html` in a browser. No build step or server is required.

## Test the engine

```sh
node test.js
```
