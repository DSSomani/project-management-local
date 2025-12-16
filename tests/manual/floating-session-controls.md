Manual test steps: Floating session controls

1. Open `index.html` in a modern browser (Chrome 116+ / Edge 116+ for Picture-in-Picture support)
2. Create a project and a task
3. Start a session for the task (click session 'Start')
4. Click the ℹ️ button next to the running session to open the floating session window
5. **In Chrome/Edge 116+**: A Picture-in-Picture window should open in a separate always-on-top window
6. **In other browsers**: A floating div should appear in the bottom-right of the page
7. Click ✕ (top-right) — the floating session should close
8. Re-open the floating session and click Open — the app should navigate to the project's task list and expand the relevant task (if any)
9. Confirm the Stop button stops the session

Picture-in-Picture features:
- The PiP window stays on top of other windows and tabs
- You can resize and move the PiP window
- Closing the PiP window or the main tab will clean up the session timer
- The PiP window inherits styles from the main document

Browser support:
- Chrome 116+ ✅
- Edge 116+ ✅
- Safari: Not supported (falls back to in-page floating div)
- Firefox: Not supported (falls back to in-page floating div)

Notes:
- If the Close (✕) or Open button does not respond, verify JavaScript console for errors; check `app.js` for interactive code and pointer capture handling.
- If the project doesn't open to the right task, confirm that `currentProjectId` is set and `expandedTasks` contains the task id.
- If PiP doesn't open, check browser version and console for API errors; the app will automatically fall back to in-page mode.
