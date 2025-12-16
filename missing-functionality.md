# Missing Functionality to Consider

## 1. Data Export/Import
Currently, data only lives in localStorage. Users might want to:
- Export projects as JSON for backup
- Import previously exported data
- Export time reports as CSV for invoicing/reporting

## 2. Task Status/Priority
Tasks don't have:
- Status (Todo, In Progress, Done, Blocked)
- Priority levels (High, Medium, Low)
- Ability to reorder tasks

## 3. Search & Filtering
- Global search across all projects/tasks
- Filter tasks by status, date range, or time spent
- Sort tasks by different criteria

## 4. Time Reports
- Weekly/monthly time summaries
- Time breakdown by project or task
- Visual charts (pie/bar charts for time distribution)

## 5. Due Date Notifications
- Visual indicators for overdue tasks in the task list
- Summary of upcoming deadlines

## 6. Session Editing
- Currently sessions can only be deleted or stopped — no way to edit an existing session's start/end time

## 7. Keyboard Shortcuts
- Quick actions like `N` for new task, `S` for new session

## 8. Undo/Redo
- Accidental deletions are permanent — an undo feature would help

## 9. Floating session controls reliability
- The floating session window's interactive controls (Close/X, Open) sometimes didn't trigger because dragging logic captured pointer events — handled in a recent fix: the draggable header won't start dragging when clicking on interactive elements, and the Open button now selects the associated project before navigating to the project view.
- **Picture-in-Picture enhancement**: The floating session now uses Document Picture-in-Picture API (Chrome 116+, Edge 116+) to open in a separate always-on-top window, making it visible across tabs and applications. Falls back to in-page floating div for unsupported browsers.