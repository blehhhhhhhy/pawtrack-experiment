# Figma prototype for the Maze studies

`build-prototype.js` rebuilds the four "Build the bowl" tasks (A-85, A-130, B-85, B-130) as a Figma
prototype that Maze can test. Maze's free plan can't load the HTML pages directly, so every state
of each screen is a separate frame and every tap is a prototype link. Maze can then track paths,
success, misclicks and time.

## What it builds

- Version A (pills): the 42 / 85 / 170 g pills plus Custom. Custom opens an on-screen number pad
  (1 to 250 g, up to 3 digits, with backspace), about 256 screens per task.
- Version B (slider): tap anywhere on the track to move the thumb. It snaps to 5 g steps and to the
  42 / 85 / 170 g marks within 5 g, like the HTML version. 48 screens per task.
- Food, water, back and close are shown but static. Taps on them count as misclicks in Maze.
- Next goes to "Amount logged (SUCCESS)" when the amount is in range (85 g exactly, or 125 to 135 g)
  and to an identical-looking "Amount logged (wrong amount)" screen otherwise. In Maze only the
  SUCCESS screen ends the task, so a wrong amount is recorded as a fail.

## Differences from the HTML pages

- No typing or real slider dragging: Figma prototypes can't do either.
- Re-opening Custom starts with an empty field instead of the last value typed.

## How to run

1. Open an empty page in a Figma design file.
2. Run a code-runner plugin such as Scripter and paste:
   ```js
   const code = await fetchText("https://raw.githubusercontent.com/blehhhhhhhy/pawtrack-experiment/main/figma/build-prototype.js")
   await eval(code)
   ```
   To build one task at a time, set `PAWTRACK_TASKS = ["A85"]` before the `eval`.
3. Set the prototype device to iPhone 14 (390 x 844).
