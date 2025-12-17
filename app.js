let projects = [];
let currentProjectId = null;
let expandedTasks = new Set(); // Track which tasks are expanded
let currentView = 'active'; // Track current view: 'active' or 'archived'
let currentProjectSubView = 'tasks'; // 'tasks' or 'notes'
let currentNoteId = null; // currently selected note id for editor
// handler for keyboard save shortcut (Ctrl+S / Cmd+S)
let noteSaveKeyHandler = null;
let currentTheme = localStorage.getItem('theme') || 'light'; // Track current theme
let currentUser = null; // Current authenticated user

// Theme Toggle Functions
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    currentTheme = savedTheme;
    applyTheme(savedTheme);
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    localStorage.setItem('theme', currentTheme);
}

function applyTheme(theme) {
    const stylesheet = document.getElementById('theme-stylesheet');
    const themeIcon = document.getElementById('themeIcon');

    if (theme === 'dark') {
        stylesheet.href = 'dark-theme.css';
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        stylesheet.href = 'styles.css'; // 
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', initTheme);

// Custom Dialog Functions
function showDialog(message, title = '', confirmText = 'Delete') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('customDialog');
        const dialogTitle = document.getElementById('dialogTitle');
        const dialogMessage = document.getElementById('dialogMessage');
        const okBtn = document.getElementById('dialogOk');
        const cancelBtn = document.getElementById('dialogCancel');

        if (title) {
            dialogTitle.textContent = title;
            dialogTitle.style.display = 'block';
        } else {
            dialogTitle.style.display = 'none';
        }
        dialogMessage.textContent = message;
        okBtn.textContent = confirmText;
        dialog.classList.add('active');

        const handleOk = () => {
            dialog.classList.remove('active');
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            dialog.classList.remove('active');
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

/* ----- Notes: subview switching and rendering ----- */
function switchProjectSubview(view) {
    if (!currentProjectId) return; // nothing to switch without project
    currentProjectSubView = view;
    // update subtab classes if present
    const t = document.getElementById('subtabTasks');
    const n = document.getElementById('subtabNotes');
    if (t) t.classList.toggle('btn-subtab-active', view === 'tasks');
    if (n) n.classList.toggle('btn-subtab-active', view === 'notes');
    // reset note selection when switching to tasks and remove any keyboard save listener
    if (view !== 'notes') {
        currentNoteId = null;
        removeNoteSaveShortcut();
    }
    renderProjectContent();
}

function renderProjectNotes(project) {
    // ensure project has notes array
    if (!Array.isArray(project.notes)) project.notes = [];

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="notes-layout">
            <div class="notes-list">
                <div class="notes-controls">
                    <input id="notesSearchInput" class="search-input" placeholder="Search notes..." />
                    <button class="btn-primary" onclick="createNote()">+ New</button>
                </div>
                <div id="notesListInner"></div>
            </div>
            <div id="noteEditorPane" class="note-editor">
                <div style="color: var(--color-text-light); font-size: 13px;">Select a note or create a new one</div>
            </div>
        </div>
    `;

    // wire up search
    const searchInput = document.getElementById('notesSearchInput');
    searchInput.addEventListener('input', (e) => renderNotesList(project, e.target.value || ''));

    renderNotesList(project);
}

function renderNotesList(project, query = '') {
    const container = document.getElementById('notesListInner');
    if (!container) return;

    const filtered = project.notes
        .slice()
        .filter(n => (n.title || '').toLowerCase().includes(query.toLowerCase()) || (n.content || '').toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:12px; color:var(--color-text-light);">No notes found</div>';
        return;
    }

    container.innerHTML = filtered.map(n => `
        <div class="note-item ${n.id === currentNoteId ? 'active' : ''}" onclick="selectNote('${n.id}')">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(n.title)}</div>
                <div class="note-meta">${new Date(n.updatedAt).toLocaleString()}</div>
            </div>
            <div style="flex-shrink:0; margin-left:8px;">
                <button class="btn-small" onclick="event.stopPropagation(); selectNote('${n.id}');">Open</button>
                <button class="btn-small danger" onclick="event.stopPropagation(); deleteNote('${n.id}')">✕</button>
            </div>
        </div>
    `).join('');
}

function createNote() {
    if (!currentProjectId) return showAlert('Please select a project first to add notes.');
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const note = {
        id: Date.now().toString(),
        title: 'Untitled',
        content: '',
        updatedAt: new Date().toISOString()
    };

    project.notes.unshift(note);
    saveProjects();
    currentNoteId = note.id;
    // re-render notes UI and open the editor
    renderProjectNotes(project);
    renderNotesList(project);
    selectNote(note.id);
}

function selectNote(noteId) {
    if (!currentProjectId) return;
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    currentNoteId = noteId;
    const note = project.notes.find(n => n.id === noteId);
    const pane = document.getElementById('noteEditorPane');
    if (!note || !pane) return;

    pane.innerHTML = `
        <input class="title" id="noteTitleInput" value="${escapeHtml(note.title)}" placeholder="Note title" />
        <div class="note-editor-tabs">
            <button class="note-tab note-tab-active" id="noteTabEdit" onclick="switchNoteTab('edit')">✏️ Edit</button>
            <button class="note-tab" id="noteTabPreview" onclick="switchNoteTab('preview')">👁 Preview</button>
        </div>
        <textarea id="noteBodyInput" class="editor-body" placeholder="Write your note here (supports Markdown)...">${escapeHtml(note.content)}</textarea>
        <div id="notePreviewArea" class="note-preview" style="display:none;"></div>
        <div class="editor-footer">
            <div style="font-size:12px; color:var(--color-text-light);">Last edited: ${new Date(note.updatedAt).toLocaleString()}</div>
            <div style="display:flex; gap:8px;">
                <button class="btn-small" onclick="saveNoteNow('${note.id}')">Save</button>
                <button class="btn-small danger" onclick="deleteNote('${note.id}')">Delete</button>
            </div>
        </div>
    `;

    // wire up inputs — save only on explicit Save button or Ctrl/Cmd+S shortcut
    const titleInput = document.getElementById('noteTitleInput');
    const bodyInput = document.getElementById('noteBodyInput');

    // Remove any existing shortcut handler first
    if (noteSaveKeyHandler) {
        document.removeEventListener('keydown', noteSaveKeyHandler);
        noteSaveKeyHandler = null;
    }

    // Add a keydown handler to capture Ctrl+S / Cmd+S and trigger an explicit save
    const handler = (e) => {
        // Normalize: 's' or 'S' — check ctrlKey (Windows/Linux) or metaKey (Mac)
        if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 's') {
            e.preventDefault();
            e.stopPropagation();
            saveNoteNow(note.id);
        }
    };

    document.addEventListener('keydown', handler);
    noteSaveKeyHandler = handler;
}

// Remove the global note save keyboard shortcut listener (if set)
function removeNoteSaveShortcut() {
    if (noteSaveKeyHandler) {
        document.removeEventListener('keydown', noteSaveKeyHandler);
        noteSaveKeyHandler = null;
    }
}

function saveNoteNow(noteId) {
    if (!currentProjectId) return;
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;
    const note = project.notes.find(n => n.id === noteId);
    if (!note) return;

    const titleEl = document.getElementById('noteTitleInput');
    const bodyEl = document.getElementById('noteBodyInput');
    if (!titleEl || !bodyEl) return;

    note.title = titleEl.value || 'Untitled';
    note.content = bodyEl.value || '';
    note.updatedAt = new Date().toISOString();

    // Move this note to the top of the list
    project.notes = [note].concat(project.notes.filter(n => n.id !== noteId));

    saveProjects();
    showToast('Note saved', 'success');
    renderNotesList(project);
    // update editor footer timestamp
    const pane = document.getElementById('noteEditorPane');
    if (pane) {
        const footerTime = pane.querySelector('.editor-footer div');
        if (footerTime) footerTime.textContent = `Last edited: ${new Date(note.updatedAt).toLocaleString()}`;
    }
}

function deleteNote(noteId) {
    if (!currentProjectId) return;
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    showDialog('Delete this note?').then(confirm => {
        if (!confirm) return;
        project.notes = project.notes.filter(n => n.id !== noteId);
        if (currentNoteId === noteId) {
            currentNoteId = null;
            removeNoteSaveShortcut();
        }
        saveProjects();
        showToast('Note deleted', 'error');
        renderProjectNotes(project);
    });
}

/* Switch between Edit and Preview tabs in note editor */
function switchNoteTab(tab) {
    const editTab = document.getElementById('noteTabEdit');
    const previewTab = document.getElementById('noteTabPreview');
    const textarea = document.getElementById('noteBodyInput');
    const preview = document.getElementById('notePreviewArea');
    if (!editTab || !previewTab || !textarea || !preview) return;

    if (tab === 'edit') {
        editTab.classList.add('note-tab-active');
        previewTab.classList.remove('note-tab-active');
        textarea.style.display = '';
        preview.style.display = 'none';
    } else {
        editTab.classList.remove('note-tab-active');
        previewTab.classList.add('note-tab-active');
        textarea.style.display = 'none';
        preview.style.display = '';
        // Render markdown content using the existing parseMarkdown function
        preview.innerHTML = parseMarkdown(textarea.value);
    }
}

/* ----- Generic modal for Task/Session notes ----- */
function ensureEntityNotesModal() {
    if (document.getElementById('entityNotesModal')) return;
    const modal = document.createElement('div');
    modal.id = 'entityNotesModal';
    modal.className = 'notes-modal';
    modal.style = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;';
    modal.innerHTML = `
        <div style="width:1200px; max-width:95%; max-height:90vh; background:var(--color-bg-white); border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.3); display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--color-border);">
                <h2 style="margin:0; font-size:20px; font-weight:700; color:var(--color-text);">Notes</h2>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="btn-primary" id="entityNewNoteBtn" style="padding:8px 16px; font-size:14px;">+ New</button>
                    <button class="btn-secondary" id="entityCloseNotes" style="padding:8px 16px; font-size:14px;">Close</button>
                </div>
            </div>
            <div style="display:flex; gap:0; flex:1; overflow:hidden;">
                <div style="width:320px; border-right:1px solid var(--color-border); display:flex; flex-direction:column; background:var(--color-bg-light);">
                    <div style="padding:16px;">
                        <input id="entityNotesSearch" class="search-input" placeholder="Search notes..." style="width:100%; padding:10px 12px; border:1px solid var(--color-border); border-radius:6px; font-size:14px;" />
                    </div>
                    <div id="entityNotesList" style="flex:1; overflow-y:auto; padding:0 8px 8px 8px;"></div>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
                    <div id="entityNoteEditorPane" style="padding:24px; color:var(--color-text-light); flex:1; overflow-y:auto;">Select a note or create a new one</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('entityCloseNotes').addEventListener('click', () => {
        modal.remove();
        if (noteSaveKeyHandler) { document.removeEventListener('keydown', noteSaveKeyHandler); noteSaveKeyHandler = null; }
    });

    document.getElementById('entityNewNoteBtn').addEventListener('click', () => {
        const ctx = modal._ctx;
        if (!ctx) return;
        createEntityNoteGeneric(ctx);
    });

    document.getElementById('entityNotesSearch').addEventListener('input', (e) => {
        const modalEl = document.getElementById('entityNotesModal');
        if (!modalEl || !modalEl._ctx) return;
        renderEntityNotesList(modalEl._ctx, e.target.value || '');
    });
}

function openTaskNotes(taskId) {
    const ctx = { type: 'task', projectId: currentProjectId, taskId };
    openEntityNotes(ctx);
}

function openSessionNotes(taskId, sessionId) {
    const ctx = { type: 'session', projectId: currentProjectId, taskId: taskId || '', sessionId };
    openEntityNotes(ctx);
}

function openEntityNotes(ctx) {
    if (!currentProjectId) return showAlert('Please select a project first');
    const project = projects.find(p => p.id === ctx.projectId);
    if (!project) return;
    let entity;
    if (ctx.type === 'task') {
        entity = project.tasks.find(t => t.id === ctx.taskId);
    } else if (ctx.type === 'session') {
        if (ctx.taskId) {
            const task = project.tasks.find(t => t.id === ctx.taskId);
            entity = task ? task.sessions.find(s => s.id === ctx.sessionId) : null;
        } else {
            entity = project.sessions.find(s => s.id === ctx.sessionId);
        }
    }
    if (!entity) return showAlert('Entity not found');
    if (!Array.isArray(entity.notes)) entity.notes = [];

    ensureEntityNotesModal();
    const modal = document.getElementById('entityNotesModal');
    modal._ctx = { ctx, entity, project };
    renderEntityNotesList(modal._ctx);
    // select first note if any
    if (entity.notes.length > 0) selectEntityNoteGeneric(entity.notes[0].id, modal._ctx);
    // show modal
    modal.style.display = 'flex';
}

function renderEntityNotesList(ctx, query = '') {
    const modal = document.getElementById('entityNotesModal');
    if (!modal) return;
    const entity = ctx.entity;
    const container = document.getElementById('entityNotesList');
    const filtered = (entity.notes || []).slice().filter(n => (n.title || '').toLowerCase().includes(query.toLowerCase()) || (n.content || '').toLowerCase().includes(query.toLowerCase())).sort((a,b)=> new Date(b.updatedAt)-new Date(a.updatedAt));
    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:16px; text-align:center; color:var(--color-text-light); font-size:13px;">No notes found</div>';
        document.getElementById('entityNoteEditorPane').innerHTML = '<div style="text-align:center; color:var(--color-text-light); padding:24px;">Select a note or create a new one</div>';
        return;
    }

    const currentNoteId = modal._currentNoteId || null;
    container.innerHTML = filtered.map(n => `
        <div class="note-item" style="padding:12px 16px; margin:4px 0; border-radius:6px; cursor:pointer; background:${n.id === currentNoteId ? 'var(--color-primary-light)' : 'transparent'}; border:1px solid ${n.id === currentNoteId ? 'var(--color-primary)' : 'transparent'}; transition:all 0.2s;" 
             onmouseover="if('${n.id}' !== '${currentNoteId}') this.style.background='var(--color-bg-hover)';" 
             onmouseout="if('${n.id}' !== '${currentNoteId}') this.style.background='transparent';" 
             onclick="(function(){ const modal=document.getElementById('entityNotesModal'); modal._currentNoteId='${n.id}'; selectEntityNoteGeneric('${n.id}', modal._ctx); })()">
            <div style="font-weight:600; font-size:14px; color:var(--color-text); margin-bottom:4px;">${escapeHtml(n.title)}</div>
            <div style="font-size:11px; color:var(--color-text-light);">${new Date(n.updatedAt).toLocaleDateString('en-US', {month:'numeric', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'})}</div>
        </div>
    `).join('');
}

function createEntityNoteGeneric(modalCtx) {
    const entity = modalCtx.entity;
    const note = { id: Date.now().toString() + Math.random().toString(36).slice(2,8), title: 'Untitled', content: '', updatedAt: new Date().toISOString() };
    entity.notes.unshift(note);
    saveProjects();
    renderEntityNotesList(modalCtx);
    selectEntityNoteGeneric(note.id, modalCtx);
}

function selectEntityNoteGeneric(noteId, modalCtx) {
    const entity = modalCtx.entity;
    const note = entity.notes.find(n => n.id === noteId);
    const pane = document.getElementById('entityNoteEditorPane');
    if (!note || !pane) return;
    pane.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%;">
            <input class="title" id="entityNoteTitle" value="${escapeHtml(note.title)}" placeholder="Untitled" style="width:100%; border:none; font-size:18px; font-weight:600; padding:0 0 12px 0; margin-bottom:12px; border-bottom:1px solid var(--color-border); background:transparent; color:var(--color-text);" />
            <div style="display:flex; gap:8px; margin-bottom:16px;">
                <button class="btn-small" id="entityNotePreviewBtn" style="background:var(--color-bg-light); border:1px solid var(--color-border); padding:6px 14px; font-size:13px;">Preview</button>
            </div>
            <textarea id="entityNoteBody" class="editor-body" placeholder="Write your note here (supports Markdown)..." style="flex:1; width:100%; border:1px solid var(--color-border); border-radius:6px; padding:12px; font-size:14px; font-family:inherit; line-height:1.6; resize:none;">${escapeHtml(note.content)}</textarea>
            <div id="entityNotePreviewArea" class="note-preview" style="display:none; margin-top:12px; padding:16px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-bg-light); max-height:400px; overflow-y:auto;"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid var(--color-border);">
                <div style="font-size:12px; color:var(--color-text-light);">Last edited: ${new Date(note.updatedAt).toLocaleDateString('en-US', {month:'numeric', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'})}</div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-small danger" id="entityNoteDeleteBtn" style="background:var(--color-error-light); color:var(--color-error); border:1px solid var(--color-error); padding:6px 14px; font-size:13px;">Delete</button>
                    <button class="btn-small" id="entityNoteSaveBtn" style="background:var(--color-bg-light); border:1px solid var(--color-border); padding:6px 14px; font-size:13px;">Save</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing handler
    if (noteSaveKeyHandler) { document.removeEventListener('keydown', noteSaveKeyHandler); noteSaveKeyHandler = null; }

    // Save button
    document.getElementById('entityNoteSaveBtn').addEventListener('click', () => saveEntityNoteNowGeneric(note.id, modalCtx));
    document.getElementById('entityNoteDeleteBtn').addEventListener('click', () => deleteEntityNoteGeneric(note.id, modalCtx));
    document.getElementById('entityNotePreviewBtn').addEventListener('click', () => {
        const ta = document.getElementById('entityNoteBody');
        const pv = document.getElementById('entityNotePreviewArea');
        if (!ta || !pv) return; pv.innerHTML = parseMarkdown(ta.value); pv.style.display = pv.style.display === 'none' ? '' : 'none';
    });

    // keyboard shortcut handler
    const handler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 's') {
            e.preventDefault(); e.stopPropagation(); saveEntityNoteNowGeneric(note.id, modalCtx);
        }
    };
    document.addEventListener('keydown', handler);
    noteSaveKeyHandler = handler;
}

function saveEntityNoteNowGeneric(noteId, modalCtx) {
    const entity = modalCtx.entity;
    const note = entity.notes.find(n => n.id === noteId);
    if (!note) return;
    const titleEl = document.getElementById('entityNoteTitle');
    const bodyEl = document.getElementById('entityNoteBody');
    if (!titleEl || !bodyEl) return;
    note.title = titleEl.value || 'Untitled';
    note.content = bodyEl.value || '';
    note.updatedAt = new Date().toISOString();
    // move to top
    modalCtx.entity.notes = [note].concat(modalCtx.entity.notes.filter(n => n.id !== noteId));
    saveProjects();
    showToast('Note saved', 'success');
    renderEntityNotesList(modalCtx);
    selectEntityNoteGeneric(note.id, modalCtx);
}

function deleteEntityNoteGeneric(noteId, modalCtx) {
    const entity = modalCtx.entity;
    showDialog('Delete this note?').then(confirm => {
        if (!confirm) return;
        entity.notes = entity.notes.filter(n => n.id !== noteId);
        saveProjects();
        showToast('Note deleted', 'error');
        renderEntityNotesList(modalCtx);
        const pane = document.getElementById('entityNoteEditorPane');
        if (pane) pane.innerHTML = '<div style="color:var(--color-text-light);">Select a note or create a new one</div>';
    });
}

/* Toast notification system */
function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠';
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showAlert(message) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('customDialog');
        const dialogMessage = document.getElementById('dialogMessage');
        const okBtn = document.getElementById('dialogOk');
        const cancelBtn = document.getElementById('dialogCancel');
        const dialogTitle = document.getElementById('dialogTitle');

        dialogTitle.style.display = 'none';
        dialogMessage.textContent = message;
        cancelBtn.style.display = 'none';
        okBtn.textContent = 'Close';
        dialog.classList.add('active');

        const handleOk = () => {
            dialog.classList.remove('active');
            cancelBtn.style.display = '';
            okBtn.removeEventListener('click', handleOk);
            resolve(true);
        };

        okBtn.addEventListener('click', handleOk);
    });
}

// Markdown parser for task descriptions
function parseMarkdown(text) {
    if (!text) return 'No description';

    // Split into lines for processing
    const lines = text.split('\n');
    let html = '';
    let inCodeBlock = false;
    let codeBlockContent = '';
    let inList = false;
    let listItems = [];
    let inTable = false;
    let tableRows = [];
    let tableHeader = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Handle code blocks
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                // End code block
                html += `<pre><code>${escapeHtml(codeBlockContent.trim())}</code></pre>`;
                codeBlockContent = '';
                inCodeBlock = false;
            } else {
                // Start code block
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent += line + '\n';
            continue;
        }

        // Handle tables (lines starting with |)
        const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
        const isSeparatorRow = /^\|[\s\-:|]+\|$/.test(line.trim());

        if (isTableRow) {
            if (!inTable) {
                inTable = true;
                tableHeader = true;
                tableRows = [];
            }

            if (isSeparatorRow) {
                // Skip separator row but mark that header is done
                tableHeader = false;
                continue;
            }

            // Parse table cells
            const cells = line.trim().slice(1, -1).split('|').map(c => processInlineMarkdown(c.trim()));
            const tag = tableHeader ? 'th' : 'td';
            tableRows.push(`<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`);
            continue;
        } else if (inTable) {
            // End of table
            html += `<table>${tableRows.join('')}</table>`;
            tableRows = [];
            inTable = false;
            tableHeader = false;
        }

        // Check for list items
        const listMatch = line.match(/^\s*[-*+]\s+(.+)$/);
        const checkboxMatch = line.match(/^\s*-\s+\[(x|\s)\]\s+(.+)$/);

        if (listMatch || checkboxMatch) {
            if (!inList) {
                inList = true;
            }

            if (checkboxMatch) {
                const checked = checkboxMatch[1] === 'x' ? 'checked' : '';
                listItems.push(`<li class="task-checkbox-item"><input type="checkbox" ${checked} disabled> ${processInlineMarkdown(checkboxMatch[2])}</li>`);
            } else {
                listItems.push(`<li>${processInlineMarkdown(listMatch[1])}</li>`);
            }
            continue;
        } else if (inList) {
            // End of list
            html += `<ul>${listItems.join('')}</ul>`;
            listItems = [];
            inList = false;
        }

        // Process other elements
        line = line.trim();

        if (line === '') {
            // Empty line - add paragraph break only if there's content before
            if (html && !html.endsWith('</h1>') && !html.endsWith('</h2>') &&
                !html.endsWith('</h3>') && !html.endsWith('</h4>') &&
                !html.endsWith('</h5>') && !html.endsWith('</h6>') &&
                !html.endsWith('</ul>') && !html.endsWith('</pre>') &&
                !html.endsWith('</blockquote>') && !html.endsWith('</table>')) {
                html += '<br>';
            }
            continue;
        }

        // Headers
        if (line.match(/^#{1,6}\s+/)) {
            const level = line.match(/^(#{1,6})/)[1].length;
            const content = line.replace(/^#{1,6}\s+/, '');
            html += `<h${level}>${processInlineMarkdown(content)}</h${level}>`;
        }
        // Blockquotes
        else if (line.startsWith('>')) {
            const content = line.replace(/^>\s*/, '');
            html += `<blockquote>${processInlineMarkdown(content)}</blockquote>`;
        }
        // Regular paragraph
        else {
            html += `<p>${processInlineMarkdown(line)}</p>`;
        }
    }

    // Close any remaining list
    if (inList) {
        html += `<ul>${listItems.join('')}</ul>`;
    }

    // Close any remaining table
    if (inTable) {
        html += `<table>${tableRows.join('')}</table>`;
    }

    return html;
}

// Helper function to escape HTML
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper function to process inline markdown (bold, italic, code)
function processInlineMarkdown(text) {
    return escapeHtml(text)
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        // Italic (but not in middle of words)
        .replace(/\*([^\*]+?)\*/g, '<em>$1</em>')
        .replace(/\b_([^_]+?)_\b/g, '<em>$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// Initialize
document.addEventListener('DOMContentLoaded', async function () {
    initTheme();

    // Check authentication (localStorage-based)
    const userDataStr = localStorage.getItem('currentUser');
    if (!userDataStr) {
        // Not logged in, redirect to login
        window.location.href = 'login.html';
        return;
    }
    currentUser = JSON.parse(userDataStr);

    await loadProjects();
    await loadHabitsData(); // Load habits from localStorage
    setupSessionCalculation();
});

// Logout function
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

function setupSessionCalculation() {
    const startInput = document.getElementById('startedAtInput');
    const endInput = document.getElementById('endedAtInput');
    const durationDisplay = document.getElementById('durationDisplay');

    [startInput, endInput].forEach(input => {
        input.addEventListener('change', function () {
            durationDisplay.value = '';
            if (!startInput.value) return;

            const start = new Date(startInput.value);

            if (endInput.value) {
                const end = new Date(endInput.value);
                const diff = end - start;
                if (diff > 0) {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    durationDisplay.value = `${hours}h ${minutes}m`;
                } else {
                    durationDisplay.value = 'Invalid time range';
                }
                return;
            }

            // If no Ended At provided, show running duration (from start to now)
            const now = new Date();
            const diff = now - start;
            if (diff > 0) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                durationDisplay.value = `Running — ${hours}h ${minutes}m`;
            } else {
                durationDisplay.value = '';
            }
        });
    });
}

async function loadProjects() {
    // Load from localStorage
    const saved = localStorage.getItem('projects');
    if (saved) {
        projects = JSON.parse(saved);
        normalizeProjects();
        renderProjectList();
    }
}

// Normalize project data structure
function normalizeProjects() {
    projects.forEach(p => {
        if (!Array.isArray(p.sessions)) p.sessions = [];
        if (!Array.isArray(p.tasks)) p.tasks = [];
        if (p.archived === undefined) p.archived = false;
        if (!p.expectedEndDate) p.expectedEndDate = null;
        p.tasks.forEach(t => {
            if (!Array.isArray(t.sessions)) t.sessions = [];
            // Ensure tasks have notes array
            if (!Array.isArray(t.notes)) t.notes = [];
            // Add expectedHours if missing
            if (!t.expectedHours) t.expectedHours = 0;
            // Add completed flag for tasks (default false)
            if (t.completed === undefined) t.completed = false;
            if (!t.expectedEndDate) t.expectedEndDate = null;
            // tolerate missing sessionNo or duration fields
            t.sessions = t.sessions.map(s => ({
                ...s,
                sessionNo: s.sessionNo || 0,
                name: s.name || '',
                durationMinutes: (s.durationMinutes === undefined || s.durationMinutes === null) ? null : s.durationMinutes,
                // Ensure session-level notes exist
                notes: Array.isArray(s.notes) ? s.notes : []
            }));
        });
        // Normalize any project-level (unassigned) sessions too
        if (Array.isArray(p.sessions)) {
            p.sessions = p.sessions.map(s => ({
                ...s,
                sessionNo: s.sessionNo || 0,
                name: s.name || '',
                durationMinutes: (s.durationMinutes === undefined || s.durationMinutes === null) ? null : s.durationMinutes,
                // Ensure session-level notes exist for unassigned sessions
                notes: Array.isArray(s.notes) ? s.notes : []
            }));
        }
        // Ensure every project has a notes array for project-level notes
        if (!Array.isArray(p.notes)) p.notes = [];
        // Normalize notes shape
        p.notes = p.notes.map(n => ({
            id: n.id || String(Date.now()) + Math.random().toString(36).slice(2, 8),
            title: n.title || 'Untitled',
            content: n.content || '',
            updatedAt: n.updatedAt || new Date().toISOString()
        }));
    });
}

function saveProjects() {
    // Save to localStorage
    localStorage.setItem('projects', JSON.stringify(projects));
}

/* ----- Export / Import Backup Helpers ----- */
function exportLocalData() {
    try {
        const backup = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const raw = localStorage.getItem(key);
            try {
                backup[key] = JSON.parse(raw);
            } catch (e) {
                backup[key] = raw;
            }
        }

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const stamp = now.toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `project-manager-backup-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Export created — check your downloads folder', 'success');
    } catch (err) {
        console.error('Export failed', err);
        showToast('Export failed', 'error');
    }
}

function handleImportFile(event) {
    const file = event.target && event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            const keys = Array.isArray(parsed) ? ['projects'] : Object.keys(parsed || {});
            const message = `This file contains keys: ${keys.join(', ')}. Import will overwrite any existing keys with the same names. Proceed?`;
            showDialog(message, 'Import Data', 'Import').then((confirm) => {
                if (!confirm) return;
                // Apply import
                if (Array.isArray(parsed)) {
                    // Common case: exported projects array
                    localStorage.setItem('projects', JSON.stringify(parsed));
                } else if (typeof parsed === 'object' && parsed !== null) {
                    for (const k of Object.keys(parsed)) {
                        const v = parsed[k];
                        // store primitives as raw strings, objects/arrays as JSON
                        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
                            localStorage.setItem(k, v === null ? 'null' : String(v));
                        } else {
                            localStorage.setItem(k, JSON.stringify(v));
                        }
                    }
                } else {
                    showToast('Unrecognized import format', 'error');
                    return;
                }

                // Refresh in-memory data
                loadProjects();
                if (typeof loadHabitsData === 'function') loadHabitsData();
                // If theme was included, apply it
                const maybeTheme = parsed && parsed.theme;
                if (maybeTheme && typeof maybeTheme === 'string') applyTheme(maybeTheme);

                showToast('Import successful', 'success');
            });
        } catch (err) {
            console.error('Import failed', err);
            showToast('Failed to import: invalid JSON file', 'error');
        } finally {
            // Reset input so the same file can be re-selected later if needed
            try { event.target.value = ''; } catch (e) { }
        }
    };
    reader.readAsText(file);
}


function renderProjectList() {
    const list = document.getElementById('projectList');
    list.innerHTML = '';

    // Filter projects based on current view
    const filteredProjects = projects.filter(p => {
        if (currentView === 'active') {
            return !p.archived;
        } else {
            return p.archived;
        }
    });

    filteredProjects.forEach(project => {
        const li = document.createElement('li');
        li.className = `project-item ${project.id === currentProjectId ? 'active' : ''}`;
        li.innerHTML = `
            <div class="project-name">${project.name}</div>
            <div class="task-count">${project.tasks.length} tasks</div>
        `;
        li.onclick = () => selectProject(project.id);
        list.appendChild(li);
    });
}

function switchView(view) {
    currentView = view;
    currentProjectId = null; // Clear selection when switching views
    expandedTasks.clear();

    // Update tab styling
    document.getElementById('activeTab').classList.toggle('active', view === 'active');
    document.getElementById('archivedTab').classList.toggle('active', view === 'archived');

    renderProjectList();

    // Show empty state
    document.getElementById('projectTitle').textContent = view === 'active' ? 'Select a Project' : 'Select an Archived Project';
    document.getElementById('content').innerHTML = `
        <div class="task-list">
            <div class="empty-state">
                <span class="icon-dot icon-dot-success"></span>
                <p> Select a project to get started</p>
            </div>
        </div>
    `;
    // Render chart after we've inserted the HTML (if a financial canvas exists)
    setTimeout(() => renderSpendingChart(), 0);
}

function selectProject(projectId) {
    currentProjectId = projectId;
    expandedTasks.clear(); // Reset expanded tasks when switching projects
    renderProjectList();
    renderProjectContent();
}

function toggleTaskSessions(taskId) {
    if (expandedTasks.has(taskId)) {
        expandedTasks.delete(taskId);
    } else {
        expandedTasks.add(taskId);
    }
    renderProjectContent();
}

function toggleTaskDescription(taskId, event) {
    event.stopPropagation();
    const descElement = document.getElementById(`desc-${taskId}`);
    const button = event.target;

    if (descElement.classList.contains('collapsed')) {
        descElement.classList.remove('collapsed');
        descElement.classList.add('expanded');
        button.textContent = 'Hide';
        button.title = 'Hide description';
    } else {
        descElement.classList.add('collapsed');
        descElement.classList.remove('expanded');
        button.textContent = 'Show description';
        button.title = 'Show description';
    }
}

function renderProjectContent() {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const now = new Date();

    // Calculate days left if expected end date is provided
    let daysLeftHTML = '';
    if (project.expectedEndDate) {
        const endDate = new Date(project.expectedEndDate);
            const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        let daysLeftColor = 'var(--color-primary)';
        if (daysLeft < 0) {
            daysLeftColor = 'var(--color-error)';
        } else if (daysLeft <= 7) {
            daysLeftColor = 'var(--color-warning)';
        }

        daysLeftHTML = `
            <div class="days-left-badge" style="background: ${daysLeftColor};">
                ${daysLeft < 0 ? `Overdue by ${Math.abs(daysLeft)} days` : `${daysLeft} days left`}
            </div>
        `;
    }

    document.getElementById('projectTitle').innerHTML = `
        <div class="project-header">
  <div class="project-header-left">
    <span class="project-title">${project.name}</span>
    ${daysLeftHTML}
  </div>

  <div class="project-header-right">
    <div class="project-subtabs">
      <!-- Tasks tab -->
      <button
        class="btn-subtab ${currentProjectSubView === 'tasks' ? 'btn-subtab-active' : ''}"
        id="subtabTasks"
        onclick="switchProjectSubview('tasks')"
      >
        <span class="icon-dot icon-dot-primary"></span>
        <span>Tasks</span>
      </button>

      <!-- Notes tab -->
      <button
        class="btn-subtab ${currentProjectSubView === 'notes' ? 'btn-subtab-active' : ''}"
        id="subtabNotes"
        onclick="switchProjectSubview('notes')"
      >
        <span class="icon-dot icon-dot-yellow"></span>
        <span>Notes</span>
      </button>
    </div>

    <!-- Edit -->
    <button
      class="btn-action btn-action-edit"
      onclick="openEditProjectModal()"
    >
      <span class="icon-dash">—</span>
      <span>Edit</span>
    </button>

    <!-- Archive / Unarchive -->
    <button
      class="btn-action btn-action-archive"
      onclick="toggleArchiveProject()"
    >
      <span class="icon-dot ${project.archived ? 'icon-dot-green' : 'icon-dot-gray'}"></span>
      <span>${project.archived ? 'Unarchive' : 'Archive'}</span>
    </button>

    <!-- Delete -->
    <button
      class="btn-action btn-action-delete"
      onclick="deleteProject()"
    >
      <span class="icon-dot icon-dot-red"></span>
      <span>Delete</span>
    </button>
  </div>
</div>`;

    // If the selected project subview is Notes, render notes and skip the tasks renderer
    if (currentProjectSubView === 'notes') {
        renderProjectNotes(project);
        return;
    }

    let html = '';

    // Stats
    const totalSessions = project.tasks.reduce((sum, t) => sum + t.sessions.length, 0) + (project.sessions ? project.sessions.length : 0);
    let totalDuration = 0;
    project.tasks.forEach(task => {
        task.sessions.forEach(session => {
            totalDuration += (session.durationMinutes || 0);
        });
    });
    if (project.sessions && project.sessions.length > 0) {
        project.sessions.forEach(s => totalDuration += (s.durationMinutes || 0));
    }
    const totalHours = Math.floor(totalDuration / 60);
    const totalMins = totalDuration % 60;

    html += `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Tasks</div>
                <div class="stat-value">${project.tasks.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Sessions</div>
                <div class="stat-value">${totalSessions}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Time</div>
                <div class="stat-value">${totalHours}h ${totalMins}m</div>
            </div>
        </div>
    `;

    html += `<button class="btn-primary" onclick="openNewTaskModal()" style="width: 100%; margin-bottom: 24px;">+ Add Task/Issue</button>`;

    // show any unassigned/project-level sessions first
    if (project.sessions && project.sessions.length > 0) {
        html += `
            <div class="section-title">Unassigned Sessions</div>
            <div class="task-card">
                ${project.sessions.map(session => `
                    <div class="session-row">
                        <div style="display:flex; flex-direction:column; gap:4px; min-width:80px;">
                            <div style="font-weight:600;">#${session.sessionNo}</div>
                            ${session.name ? `<div style="font-size:12px; color:var(--color-text-light); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(session.name)}</div>` : ''}
                        </div>
                        <div>
                            <div class="session-label">Started</div>
                            <div style="font-size:13px;">${new Date(session.startedAt).toLocaleString()}</div>
                        </div>
                        <div>
                            <div class="session-label">Ended</div>
                            <div style="font-size:13px;">${session.endedAt ? new Date(session.endedAt).toLocaleString() : '<span style="color:var(--color-warning); font-weight:600;">Running</span>'}</div>
                        </div>
                        <div>
                            <div class="session-label">Related Task</div>
                            <div style="font-size:13px;">(Unassigned)</div>
                        </div>
                        <div>
                            <div class="session-label">Duration</div>
                            <div style="font-size:13px; font-weight:600; color:var(--color-primary);">${session.durationMinutes !== null ? `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m` : 'Running'}</div>
                        </div>
                        ${session.endedAt ? `<button class="btn-small danger" onclick="deleteSession('', '${session.id}')" style="padding:4px 8px;">✕</button>` : `<div style="display:flex;gap:8px;align-items:center;"><button class="btn-small" onclick="stopSession('', '${session.id}')" style="padding:4px 8px; background: var(--color-warning); color:#fff;">Stop</button><button class="btn-icon" title="Open floating session window" onclick="event.stopPropagation(); toggleFloatingSession(null, '${session.id}')">ℹ️</button></div>`}
                                ${session.endedAt ? `<button class="btn-small" onclick="openSessionNotes('','${session.id}')">Notes</button><button class="btn-small danger" onclick="deleteSession('', '${session.id}')" style="padding:4px 8px;">✕</button>` : `<div style="display:flex;gap:8px;align-items:center;"><button class="btn-small" onclick="stopSession('', '${session.id}')" style="padding:4px 8px; background: var(--color-warning); color:#fff;">Stop</button><button class="btn-small" onclick="openSessionNotes('','${session.id}')">Notes</button><button class="btn-icon" title="Open floating session window" onclick="event.stopPropagation(); toggleFloatingSession(null, '${session.id}')">ℹ️</button></div>`}
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (project.tasks.length === 0) {
        html += '<div class="empty-state"><p>No tasks yet. Create one to get started!</p></div>';
    } else {
        project.tasks.forEach(task => {
            const taskTime = task.sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
            const taskHours = Math.floor(taskTime / 60);
            const taskMins = taskTime % 60;
            const isExpanded = expandedTasks.has(task.id);
            const hasRunningSessions = task.sessions.some(s => !s.endedAt);

            // Calculate time spent color based on expected hours
            let timeSpentColor = 'var(--color-success)'; // Green for under expected
            const spentHours = taskTime / 60;
            const expectedHours = task.expectedHours || 0;

            if (expectedHours > 0) {
                const percentage = (spentHours / expectedHours) * 100;
                if (percentage >= 100) {
                    timeSpentColor = 'var(--color-error)'; // Red for over expected
                } else if (percentage >= 80) {
                    timeSpentColor = 'var(--color-warning)'; // Orange for 80-99%
                } else {
                    timeSpentColor = 'var(--color-success)'; // Green for under 80%
                }
            }

            // Calculate days left if expected end date is provided
            let taskDaysLeftHTML = '';
            if (task.expectedEndDate) {
                const endDate = new Date(task.expectedEndDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

                let daysLeftColor = 'var(--color-primary)';
                if (daysLeft < 0) {
                    daysLeftColor = 'var(--color-error)';
                } else if (daysLeft <= 7) {
                    daysLeftColor = 'var(--color-warning)';
                }

                taskDaysLeftHTML = `
                    <div class="days-left-badge" style="background: ${daysLeftColor}; font-size: 12px; padding: 4px 12px; margin-top: 8px; display: inline-block;">
                        ${daysLeft < 0 ? `Overdue by ${Math.abs(daysLeft)} days` : `${daysLeft} days left`}
                    </div>
                `;
            }

            html += `
                <div class="task-card">
                    <div class="task-header">
                        <div class="task-header-left">
                            <button class="task-expand-btn ${isExpanded ? 'expanded' : ''}" onclick="toggleTaskSessions('${task.id}')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            <div style="flex: 1; min-width: 0;">
                                <div class="task-title-container">
                                    <div class="task-title" style="${task.completed ? 'text-decoration:line-through; opacity:0.65;' : ''}">${task.title}</div>
                                    ${task.description ? `<button class="task-desc-toggle" onclick="toggleTaskDescription('${task.id}', event)" title="Show description">Show Description</button>` : ''}
                                </div>
                                ${task.description ? `
                                    <div class="task-description collapsed" id="desc-${task.id}">
                                        <div class="task-description-content">${parseMarkdown(task.description)}</div>
                                    </div>
                                ` : ''}
                                <div style="font-size: 12px; margin-top: 8px; font-weight: 600;">
                                    <span style="color: ${timeSpentColor};">Time Spent: ${taskHours}h ${taskMins}m</span> <span style="color: var(--color-text-light);">/</span> <span style="color: var(--color-primary);">Expected: ${task.expectedHours}h</span> <span style="color: var(--color-text-light);">| Sessions: ${task.sessions.length}</span>
                                    ${hasRunningSessions ? ' | <span style="color: var(--color-warning);">⚡ Running</span>' : ''}
                                </div>
                                ${taskDaysLeftHTML}
                            </div>
                        </div>
                            <div class="task-actions">
                                <button class="btn-small" onclick="openNewSessionModal('${task.id}')">+ Session</button>
                                <button class="btn-small" onclick="openTaskNotes('${task.id}')">Notes</button>
                                <button class="btn-small" onclick="openEditTaskModal('${task.id}')" style="background: var(--color-primary); color: white; border-color: var(--color-primary);">Edit</button>
                                <button class="btn-small ${task.completed ? 'btn-ghost' : 'btn-success'}" onclick="toggleTaskComplete('${task.id}')">${task.completed ? 'Undo' : 'Mark Done'}</button>
                                <button class="btn-small danger" onclick="deleteTask('${task.id}')">Delete</button>
                            </div>
                    </div>
                    
                    ${task.sessions.length > 0 ? `
                        <div class="task-sessions ${isExpanded ? 'expanded' : ''}">
                            ${task.sessions.map(session => {
                const endedHtml = session.endedAt ? new Date(session.endedAt).toLocaleString() : '<span style="color:var(--color-warning); font-weight:600;">Running</span>';
                const durationHtml = (session.durationMinutes !== null && session.durationMinutes !== undefined)
                    ? `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m`
                    : (function () {
                        const minutes = Math.round((now - new Date(session.startedAt)) / (1000 * 60));
                        return `Running — ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
                    })();

                return `
                                    <div class="session-row">
                                        <div style="display:flex; flex-direction:column; gap:4px; min-width:80px;">
                                            <div style="font-weight: 600;">#${session.sessionNo}</div>
                                            ${session.name ? `<div style="font-size:12px; color:var(--color-text-light); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(session.name)}</div>` : ''}
                                        </div>
                                        <div>
                                            <div class="session-label">Started</div>
                                            <div style="font-size: 13px;">${new Date(session.startedAt).toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div class="session-label">Ended</div>
                                            <div style="font-size:13px;">${endedHtml}</div>
                                        </div>
                                        <!-- Related Task not shown here because we're already inside the task block -->
                                        <div>
                                            <div class="session-label">Duration</div>
                                            <div style="font-size: 13px; font-weight: 600; color: var(--color-primary);">${durationHtml}</div>
                                        </div>
                                        ${session.endedAt ? `<button class="btn-small" onclick="openSessionNotes('${task.id}','${session.id}')">Notes</button><button class="btn-small danger" onclick="deleteSession('${task.id}', '${session.id}')" style="padding: 4px 8px;">✕</button>` : `<div style="display:flex;gap:8px;align-items:center;"><button class="btn-small" onclick="stopSession('${task.id}', '${session.id}')" style="padding:4px 8px; background: var(--color-warning); color:#fff;">Stop</button><button class="btn-small" onclick="openSessionNotes('${task.id}','${session.id}')">Notes</button><button class="btn-icon" title="Open floating session window" onclick="event.stopPropagation(); toggleFloatingSession('${task.id}', '${session.id}')">ℹ️</button></div>`}
                                    </div>
                                `;
            }).join('')}
                        </div>
                    ` : (isExpanded ? '<div class="task-sessions expanded" style="font-size: 13px; color: var(--color-text-light); padding: 12px;">No sessions recorded yet</div>' : '')}
                </div>
            `;
        });
    }

    document.getElementById('content').innerHTML = html;
}

function openNewProjectModal() {
    document.getElementById('projectNameInput').value = '';
    document.getElementById('projectDescInput').value = '';
    document.getElementById('projectEndDateInput').value = '';
    document.getElementById('newProjectModal').classList.add('active');
}

function openEditProjectModal() {
    if (!currentProjectId) return;

    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    document.getElementById('editProjectNameInput').value = project.name;
    document.getElementById('editProjectDescInput').value = project.description || '';
    document.getElementById('editProjectEndDateInput').value = project.expectedEndDate || '';
    document.getElementById('editProjectModal').classList.add('active');
}

function openNewTaskModal() {
    if (!currentProjectId) {
        showAlert('Please select a project first');
        return;
    }
    document.getElementById('taskTitleInput').value = '';
    document.getElementById('taskDescInput').value = '';
    document.getElementById('taskExpectedHoursInput').value = '';
    document.getElementById('taskEndDateInput').value = '';
    document.getElementById('newTaskModal').classList.add('active');
}

function openEditTaskModal(taskId) {
    if (!currentProjectId) return;

    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskTitleInput').value = task.title;
    document.getElementById('editTaskDescInput').value = task.description || '';
    document.getElementById('editTaskExpectedHoursInput').value = task.expectedHours || '';
    document.getElementById('editTaskEndDateInput').value = task.expectedEndDate || '';
    document.getElementById('editTaskModal').classList.add('active');
}

function openNewSessionModal(taskId) {
    if (!currentProjectId) return;

    const project = projects.find(p => p.id === currentProjectId);
    const taskSelect = document.getElementById('relatedTaskInput');

    // Check if selected task has a running session
    if (taskId) {
        const task = project.tasks.find(t => t.id === taskId);
        if (task) {
            const hasRunningSession = task.sessions.some(s => !s.endedAt);
            if (hasRunningSession) {
                const runningSession = task.sessions.find(s => !s.endedAt);
                // Ask the user if they want to stop the running session now
                showDialog(`This task already has a running session. Stop it to start a new one?`, `Running session for "${task.title}"`, 'Stop').then((confirmed) => {
                    if (!confirmed) return;
                    // stop the running session and then re-open the new session modal for this task
                    stopSession(task.id, runningSession.id);
                    // after stopping, re-open the new session modal so user can add a new one
                    // only open if the session was actually stopped
                    setTimeout(() => {
                        if (runningSession.endedAt) openNewSessionModal(task.id);
                    }, 150);
                });
                return;
            }
        }
    }

    // allow leaving the session unassigned
    taskSelect.innerHTML = `
        <option value="" ${!taskId ? 'selected' : ''}>(Unassigned)</option>
        ${project.tasks.map(t => `<option value="${t.id}" ${t.id === taskId ? 'selected' : ''}>${t.title}</option>`).join('')}
    `;

    // Auto-calculate next session number
    let maxSessionNo = 0;
    // if a task is selected, use its sessions; otherwise use project's unassigned sessions
    if (taskId) {
        const task = project.tasks.find(t => t.id === taskId);
        if (task && task.sessions.length > 0) {
            maxSessionNo = Math.max(...task.sessions.map(s => s.sessionNo));
        }
    } else {
        if (project.sessions && project.sessions.length > 0) {
            maxSessionNo = Math.max(...project.sessions.map(s => s.sessionNo));
        }
    }
    document.getElementById('sessionNoInput').value = maxSessionNo + 1;

    // Prefill "Started At" with current datetime
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const datetimeLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
    document.getElementById('startedAtInput').value = datetimeLocal;
    document.getElementById('sessionNameInput').value = '';

    // Leave "Ended At" empty
    document.getElementById('endedAtInput').value = '';
    document.getElementById('durationDisplay').value = '';
    // update modal duration display so 'Running — ..' shows right away
    document.getElementById('startedAtInput').dispatchEvent(new Event('change'));
    document.getElementById('newSessionModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function createProject(event) {
    event.preventDefault();
    const name = document.getElementById('projectNameInput').value;
    const desc = document.getElementById('projectDescInput').value;
    const endDate = document.getElementById('projectEndDateInput').value;

    const project = {
        id: Date.now().toString(),
        name,
        description: desc,
        expectedEndDate: endDate || null,
        archived: false,
        tasks: [],
        sessions: [],
        notes: [],
        createdAt: new Date()
    };

    projects.push(project);
    saveProjects();
    renderProjectList();
    closeModal('newProjectModal');
    selectProject(project.id);
}

function updateProject(event) {
    event.preventDefault();

    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    project.name = document.getElementById('editProjectNameInput').value;
    project.description = document.getElementById('editProjectDescInput').value;
    project.expectedEndDate = document.getElementById('editProjectEndDateInput').value || null;

    saveProjects();
    renderProjectList();
    renderProjectContent();
    closeModal('editProjectModal');
}

function createTask(event) {
    event.preventDefault();
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const title = document.getElementById('taskTitleInput').value;
    const description = document.getElementById('taskDescInput').value;
    const expectedHours = parseFloat(document.getElementById('taskExpectedHoursInput').value) || 0;
    const endDate = document.getElementById('taskEndDateInput').value;

    const task = {
        id: Date.now().toString(),
        title,
        description,
        expectedHours,
        completed: false,
        expectedEndDate: endDate || null,
        sessions: [],
        createdAt: new Date()
    };

    project.tasks.push(task);
    saveProjects();
    renderProjectContent();
    closeModal('newTaskModal');
}

function updateTask(event) {
    event.preventDefault();

    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const taskId = document.getElementById('editTaskId').value;
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.title = document.getElementById('editTaskTitleInput').value;
    task.description = document.getElementById('editTaskDescInput').value;
    task.expectedHours = parseFloat(document.getElementById('editTaskExpectedHoursInput').value) || 0;
    task.expectedEndDate = document.getElementById('editTaskEndDateInput').value || null;

    saveProjects();
    renderProjectContent();
    closeModal('editTaskModal');
}

function createSession(event) {
    event.preventDefault();
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const relatedTaskId = document.getElementById('relatedTaskInput').value;

    // Check if the selected task already has a running session
    if (relatedTaskId) {
        const task = project.tasks.find(t => t.id === relatedTaskId);
        if (task) {
            const hasRunningSession = task.sessions.some(s => !s.endedAt);
            if (hasRunningSession) {
                const runningSession = task.sessions.find(s => !s.endedAt);
                // Prompt the user to Stop the running session or Cancel
                showDialog('This task already has a running session. Stop it to start a new one?', `Stop running session for \"${task.title}\"?`, 'Stop').then((confirmed) => {
                    if (!confirmed) return;
                    stopSession(task.id, runningSession.id);
                    setTimeout(() => openNewSessionModal(task.id), 120);
                });
                return;
            }
        }
    }

    const sessionNo = parseInt(document.getElementById('sessionNoInput').value);
    const startedAtValue = document.getElementById('startedAtInput').value;
    const endedAtValue = document.getElementById('endedAtInput').value;

    if (!startedAtValue) {
        showAlert('Please provide a start time');
        return;
    }

    const startedAt = new Date(startedAtValue);

    const sessionNameValue = document.getElementById('sessionNameInput').value.trim();

    let session = {
        id: Date.now().toString(),
        sessionNo,
        name: sessionNameValue || '',
        startedAt: startedAt.toISOString(),
        endedAt: null,
        durationMinutes: null,
        createdAt: new Date()
    };

    // If user filled Ended At, calculate duration & save it — otherwise treat as running session
    if (endedAtValue) {
        const endedAt = new Date(endedAtValue);
        const durationMinutes = Math.round((endedAt - startedAt) / (1000 * 60));
        if (durationMinutes <= 0) {
            showAlert('End time must be after start time');
            return;
        }
        session.endedAt = endedAt.toISOString();
        session.durationMinutes = durationMinutes;
    }

    // If relatedTaskId is empty -> treat as unassigned (project-level) session
    if (!relatedTaskId) {
        project.sessions = project.sessions || [];
        project.sessions.push(session);
        project.sessions.sort((a, b) => a.sessionNo - b.sessionNo);
    } else {
        const task = project.tasks.find(t => t.id === relatedTaskId);
        if (!task) {
            showAlert('Related task not found');
            return;
        }
        task.sessions.push(session);
        task.sessions.sort((a, b) => a.sessionNo - b.sessionNo);
    }
    saveProjects();
    renderProjectContent();
    closeModal('newSessionModal');
}

function deleteTask(taskId) {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;

    // If there's a running session, prompt to stop it first
    const runningSession = task.sessions.find(s => !s.endedAt);
    if (runningSession) {
        showDialog('This task has a running session. Stop it before deleting the task?', `Running session for "${task.title}"`, 'Stop').then((confirmed) => {
            if (!confirmed) return;
            stopSession(task.id, runningSession.id);
            // after stopping, re-run delete to confirm
            setTimeout(() => deleteTask(taskId), 150);
        });
        return;
    }

    showDialog(
        'This action is permanent and cannot be undone. All sessions associated with this task will also be permanently deleted.',
        `Delete "${task.title}"?`
    ).then((confirmed) => {
        if (!confirmed) return;

        project.tasks = project.tasks.filter(t => t.id !== taskId);
        expandedTasks.delete(taskId);
        saveProjects();
        renderProjectContent();
    });
}

// Toggle a task's completed state (mark as Done / Undo)
function toggleTaskComplete(taskId) {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    saveProjects();
    showToast(task.completed ? 'Task marked completed' : 'Task marked incomplete', 'success');
    renderProjectContent();
}

function deleteSession(taskId, sessionId) {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    let session = null;
    if (!taskId) {
        session = (project.sessions || []).find(s => s.id === sessionId);
    } else {
        const task = project.tasks.find(t => t.id === taskId);
        if (task) session = task.sessions.find(s => s.id === sessionId);
    }

    if (!session) return;

    showDialog(
        'This action is permanent and cannot be undone. All time tracking data for this session will be permanently deleted.',
        `Delete Session #${session.sessionNo}?`
    ).then((confirmed) => {
        if (!confirmed) return;

        if (!taskId) {
            // unassigned project session
            project.sessions = (project.sessions || []).filter(s => s.id !== sessionId);
        } else {
            const task = project.tasks.find(t => t.id === taskId);
            if (!task) return;
            task.sessions = task.sessions.filter(s => s.id !== sessionId);
        }

        saveProjects();
        // if floating window is showing this session, close it
        if (activeFloating && activeFloating.sessionId === sessionId) closeFloatingSession();
        renderProjectContent();
    });
}

function stopSession(taskId, sessionId) {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    let session = null;
    if (!taskId) {
        project.sessions = project.sessions || [];
        session = project.sessions.find(s => s.id === sessionId);
    } else {
        const task = project.tasks.find(t => t.id === taskId);
        if (!task) return;
        session = task.sessions.find(s => s.id === sessionId);
    }

    if (!session) return;

    const endedAt = new Date();
    const startedAt = new Date(session.startedAt);
    const durationMinutes = Math.round((endedAt - startedAt) / (1000 * 60));
    if (durationMinutes <= 0) {
        showAlert('Stop time must be after start time');
        return;
    }

    session.endedAt = endedAt.toISOString();
    session.durationMinutes = durationMinutes;

    saveProjects();
    // close floating window if it refers to this session (it's no longer running)
    if (activeFloating && activeFloating.sessionId === sessionId) closeFloatingSession();
    renderProjectContent();
}

// Floating running-session window support
let activeFloating = null; // {taskId, sessionId, el, interval, pipWindow}

function toggleFloatingSession(taskId, sessionId) {
    if (activeFloating && activeFloating.sessionId === sessionId) {
        closeFloatingSession();
        return;
    }

    // open a new floating window for this session
    openFloatingSession(taskId, sessionId);
}

async function openFloatingSession(taskId, sessionId) {
    closeFloatingSession();

    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    let session = null;
    let task = null;
    if (!taskId) {
        session = (project.sessions || []).find(s => s.id === sessionId);
    } else {
        task = project.tasks.find(t => t.id === taskId);
        if (!task) return;
        session = task.sessions.find(s => s.id === sessionId);
    }
    if (!session) return;

    const title = escapeHtml(task ? task.title : project.name || 'Project');
    const sname = session.name ? escapeHtml(session.name) : `#${session.sessionNo}`;

    // Check if Document Picture-in-Picture API is available
    const supportsPiP = 'documentPictureInPicture' in window;

    let pipWindow = null;
    let containerEl = null;

    if (supportsPiP) {
        try {
            // Open Picture-in-Picture window
            pipWindow = await window.documentPictureInPicture.requestWindow({
                width: 360,
                height: 240,
            });

            // Copy styles from main document to PiP window
            const styleSheets = Array.from(document.styleSheets);
            styleSheets.forEach((styleSheet) => {
                try {
                    const cssRules = Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join('');
                    const style = pipWindow.document.createElement('style');
                    style.textContent = cssRules;
                    pipWindow.document.head.appendChild(style);
                } catch (e) {
                    // External stylesheets might cause CORS issues, try linking instead
                    const link = pipWindow.document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = styleSheet.href;
                    pipWindow.document.head.appendChild(link);
                }
            });

            // Set body styles
            pipWindow.document.body.style.margin = '0';
            pipWindow.document.body.style.padding = '0';
            pipWindow.document.body.style.overflow = 'hidden';
            pipWindow.document.body.style.background = 'var(--color-bg-white, #ffffff)';
            pipWindow.document.body.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

            containerEl = pipWindow.document.body;

            // Handle PiP window close
            pipWindow.addEventListener('pagehide', () => {
                closeFloatingSession();
            });
        } catch (error) {
            console.warn('Failed to open Picture-in-Picture window:', error);
            // Fall back to in-page floating div
            supportsPiP = false;
        }
    }

    // Create floating element (either in PiP window or main document)
    const el = document.createElement('div');
    el.className = 'floating-session active';
    el.id = `floating-${sessionId}`;
    
    // Adjust styles for PiP mode
    if (supportsPiP && pipWindow) {
        el.style.position = 'relative';
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.boxShadow = 'none';
        el.style.borderRadius = '0';
    }

    el.innerHTML = `
        <div class="floating-header">
            <div style="display:flex;gap:8px;align-items:center;">
                <div class="floating-badge">⏱</div>
                <div style="min-width:0">
                    <div style="font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sname}</div>
                    <div style="font-size:12px; color:var(--color-text-light); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
                </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <button class="btn-small" id="pip-close-btn-${sessionId}">✕</button>
            </div>
        </div>
        <div class="floating-body">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="flex:1">
                    <div style="font-size:12px; color:var(--color-text-light);">Started</div>
                    <div style="font-weight:700;">${new Date(session.startedAt).toLocaleString()}</div>
                </div>
                <div style="text-align:right;min-width:120px;">
                    <div style="font-size:12px; color:var(--color-text-light);">Duration</div>
                    <div id="floating-duration-${sessionId}" style="font-weight:700; color:var(--color-primary);">--</div>
                </div>
            </div>
            <div style="margin-top:10px; display:flex; justify-content:flex-end; gap:8px;">
                <button class="btn-secondary" id="pip-open-btn-${sessionId}">Open</button>
                ${session.endedAt ? `<button class="btn-small danger" id="pip-delete-btn-${sessionId}">Delete</button>` : `<button class="btn-small" id="pip-stop-btn-${sessionId}" style="background: var(--color-warning); color:#fff;">Stop</button>`}
            </div>
        </div>
    `;

    if (supportsPiP && pipWindow && containerEl) {
        containerEl.appendChild(el);
    } else {
        document.body.appendChild(el);
        // enable dragging only for in-page mode
        makeFloatingDraggable(el);
    }

    // Wire up event handlers (works in both PiP and in-page mode)
    const closeBtn = el.querySelector(`#pip-close-btn-${sessionId}`);
    const openBtn = el.querySelector(`#pip-open-btn-${sessionId}`);
    const stopBtn = el.querySelector(`#pip-stop-btn-${sessionId}`);
    const deleteBtn = el.querySelector(`#pip-delete-btn-${sessionId}`);

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFloatingSession();
        });
    }

    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Focus main window
            window.focus();
            currentProjectId = project.id;
            if (task) expandedTasks.add(task.id);
            renderProjectContent();
            closeFloatingSession();
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            stopSession(taskId || '', sessionId);
            closeFloatingSession();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(taskId || '', sessionId);
            closeFloatingSession();
        });
    }

    // update duration immediately and then each second while open
    const updateFn = () => {
        const dEl = el.querySelector(`#floating-duration-${sessionId}`);
        if (!dEl) return;
        if (session.endedAt) {
            const mins = session.durationMinutes || 0;
            dEl.textContent = `${Math.floor(mins / 60)}h ${mins % 60}m`;
        } else {
            const minutes = Math.round((Date.now() - new Date(session.startedAt)) / (1000 * 60));
            dEl.textContent = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
        }
    };

    updateFn();
    const interval = setInterval(updateFn, 1000);

    activeFloating = { taskId, sessionId, el, interval, pipWindow };
}

function closeFloatingSession() {
    if (!activeFloating) return;
    if (activeFloating.interval) clearInterval(activeFloating.interval);
    
    // Close PiP window if open
    if (activeFloating.pipWindow) {
        try {
            activeFloating.pipWindow.close();
        } catch (e) {
            console.warn('Failed to close PiP window:', e);
        }
    }
    
    // Remove element from DOM (in-page mode)
    if (activeFloating.el && activeFloating.el.parentNode) {
        activeFloating.el.parentNode.removeChild(activeFloating.el);
    }
    
    activeFloating = null;
}

function makeFloatingDraggable(el) {
    if (!el) return;
    let dragging = false, startX = 0, startY = 0, origX = 0, origY = 0;
    const header = el.querySelector('.floating-header');
    header.style.cursor = 'grab';

    header.addEventListener('pointerdown', (ev) => {
        // Ignore pointer-driven dragging when clicking on interactive elements within header
        // (e.g. close button). This ensures the button's own click handler is invoked.
        const tag = ev.target && ev.target.tagName ? ev.target.tagName.toLowerCase() : '';
        if (tag === 'button' || tag === 'a' || tag === 'input' || ev.target.closest('[role="button"]')) return;
        // Only start dragging for primary (left) button
        if (typeof ev.button !== 'undefined' && ev.button !== 0) return;

        dragging = true;
        startX = ev.clientX; startY = ev.clientY;
        const rect = el.getBoundingClientRect();
        origX = rect.left; origY = rect.top;
        header.setPointerCapture(ev.pointerId);
    });

    header.addEventListener('pointermove', (ev) => {
        if (!dragging) return;
        const dx = ev.clientX - startX; const dy = ev.clientY - startY;
        el.style.left = (origX + dx) + 'px';
        el.style.top = (origY + dy) + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    });

    header.addEventListener('pointerup', (ev) => {
        dragging = false;
        try { header.releasePointerCapture(ev.pointerId); } catch (e) { }
    });
}

// Close modals on Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => {
            m.classList.remove('active');
        });
    }
});

// Close modal on background click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function (e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

function toggleArchiveProject() {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const action = project.archived ? 'unarchive' : 'archive';
    const confirmText = project.archived ? 'Unarchive' : 'Archive';
    showDialog(`Are you sure you want to ${action} this project?`, '', confirmText).then((confirmed) => {
        if (!confirmed) return;

        project.archived = !project.archived;
        saveProjects();

        // Switch to the appropriate view
        currentView = project.archived ? 'archived' : 'active';
        switchView(currentView);
    });
}

function deleteProject() {
    if (!currentProjectId) return;

    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    showDialog(
        'This action is permanent and cannot be undone. All tasks, sessions, and time tracking data associated with this project will be permanently deleted.',
        `Delete "${project.name}"?`
    ).then(async (confirmed) => {
        if (!confirmed) return;

        const deletedProjectId = currentProjectId;
        projects = projects.filter(p => p.id !== currentProjectId);
        currentProjectId = null;
        // clear any selected note / keyboard listener when removing the project
        currentNoteId = null;
        removeNoteSaveShortcut();
        expandedTasks.clear();

        // Save to localStorage
        localStorage.setItem('projects', JSON.stringify(projects));

        renderProjectList();

        // Show empty state
        document.getElementById('projectTitle').textContent = currentView === 'active' ? 'Select a Project' : 'Select an Archived Project';
        document.getElementById('content').innerHTML = `
            <div class="task-list">
                <div class="empty-state">
                    <span class="icon-dot icon-dot-success"></span>
                    <p> Select a project to get started</p>
                </div>
            </div>
        `;
    });
}

// auto-refresh running session durations in the visible project every 30s
setInterval(() => {
    if (currentProjectId) renderProjectContent();
}, 30 * 1000);

// ==================== HABIT TRACKER ====================

let habits = [];
let habitCompletions = {};
// spendings keyed by YYYY-MM-DD -> [{ id, item, amount, createdAt }]
let habitSpendings = {};
let currentHabitDate = new Date();
let habitsLoaded = false;

const HABIT_CATEGORIES = {
    physical: { name: 'Physical Win', icon: '💪', color: '#ef4444' },
    mental: { name: 'Mental Win', icon: '🧠', color: '#8b5cf6' },
    financial: { name: 'Financial Win', icon: '💰', color: '#22c55e' }
};

// Load habits data from localStorage
async function loadHabitsData() {
    // Load from localStorage
    const savedHabits = localStorage.getItem('habits');
    const savedCompletions = localStorage.getItem('habitCompletions');
    const savedSpendings = localStorage.getItem('habitSpendings');

    if (savedHabits) habits = JSON.parse(savedHabits);
    if (savedCompletions) habitCompletions = JSON.parse(savedCompletions);
    if (savedSpendings) habitSpendings = JSON.parse(savedSpendings);
    
    habitsLoaded = true;
}

function saveHabits() {
    // Always save to localStorage as backup
    localStorage.setItem('habits', JSON.stringify(habits));
    localStorage.setItem('habitCompletions', JSON.stringify(habitCompletions));
    localStorage.setItem('habitSpendings', JSON.stringify(habitSpendings));
}

function getSpendingsForDate(date) {
    const key = getDateKey(date);
    return habitSpendings[key] || [];
}

function calculateSpendingTotal(date) {
    const items = getSpendingsForDate(date);
    return items.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
}

async function addSpending(item, amount, tag = 'Other') {
    if (!item || item.trim() === '') return;
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) return;

    const key = getDateKey(currentHabitDate);

    // Save to localStorage
    if (!habitSpendings[key]) habitSpendings[key] = [];
    habitSpendings[key].push({ 
        id: Date.now().toString(), 
        item: item.trim(), 
        amount: parsed, 
        tag: tag || 'Other', 
        createdAt: new Date().toISOString() 
    });

    saveHabits();
    renderHabitsContent();
}

function addSpendingFromForm(event) {
    if (event) event.stopPropagation();
    const itemEl = document.getElementById('spendingItemInput');
    const amountEl = document.getElementById('spendingAmountInput');
    if (!itemEl || !amountEl) return;

    const tagEl = document.getElementById('spendingTagInput');
    const tagVal = tagEl ? tagEl.value : 'Other';
    addSpending(itemEl.value, amountEl.value, tagVal);

    // clear inputs
    itemEl.value = '';
    amountEl.value = '';
    // focus back to item
    itemEl.focus();
}

async function deleteSpending(spendId) {
    const key = getDateKey(currentHabitDate);
    if (!habitSpendings[key]) return;

    habitSpendings[key] = habitSpendings[key].filter(s => s.id !== spendId);
    saveHabits();
    renderHabitsContent();
}

function exportSpendingsCSV(date) {
    const key = getDateKey(date || currentHabitDate);
    const rows = getSpendingsForDate(date || currentHabitDate);
    if (!rows || rows.length === 0) {
        showAlert('No spendings to export for this date.');
        return;
    }

    const header = ['Item', 'Category', 'Amount', 'Created At'];
    const csv = [header.join(',')].concat(rows.map(r => [
        `"${(r.item || '').replace(/"/g, '""')}"`,
        `"${(r.tag || '').replace(/"/g, '""')}"`,
        (parseFloat(r.amount) || 0).toFixed(2),
        new Date(r.createdAt).toISOString()
    ].join(','))).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spendings-${key}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function renderSpendingChart() {
    const canvas = document.getElementById('spendingChart');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    // compute last 7 days totals ending at currentHabitDate
    const totals = [];
    const labels = [];
    const end = new Date(currentHabitDate);
    for (let i = 6; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        totals.push(calculateSpendingTotal(d));
    }

    // drawing
    const width = canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    const height = canvas.height = 120 * (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, width, height);
    const padding = 24 * (window.devicePixelRatio || 1);
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const max = Math.max(...totals, 10);
    const barWidth = chartWidth / totals.length - 8 * (window.devicePixelRatio || 1);

    totals.forEach((val, idx) => {
        const x = padding + idx * (barWidth + 8 * (window.devicePixelRatio || 1));
        const h = (val / max) * chartHeight;
        const y = padding + (chartHeight - h);

        // bar
        ctx.fillStyle = 'rgba(33,128,206,0.85)';
        ctx.fillRect(x, y, barWidth, h);

        // value label
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `${12 * (window.devicePixelRatio || 1)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(totals[idx].toFixed(0), x + barWidth / 2, y - 6);

        // x-label
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `${11 * (window.devicePixelRatio || 1)}px sans-serif`;
        ctx.fillText(labels[idx], x + barWidth / 2, height - padding / 2);
    });
}

function getDateKey(date) {
    return date.toISOString().split('T')[0];
}

function formatHabitDate(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateKey = getDateKey(date);
    if (dateKey === getDateKey(today)) return 'Today';
    if (dateKey === getDateKey(yesterday)) return 'Yesterday';
    if (dateKey === getDateKey(tomorrow)) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function changeHabitDate(delta) {
    currentHabitDate.setDate(currentHabitDate.getDate() + delta);
    updateHabitDateDisplay();
    renderHabitsContent();
}

function updateHabitDateDisplay() {
    const display = document.getElementById('habitDateDisplay');
    if (display) {
        display.textContent = formatHabitDate(currentHabitDate);
    }
}

function isHabitCompletedOnDate(habitId, date) {
    const dateKey = getDateKey(date);
    return habitCompletions[dateKey]?.includes(habitId) || false;
}

async function toggleHabitCompletion(habitId) {
    const dateKey = getDateKey(currentHabitDate);

    if (!habitCompletions[dateKey]) {
        habitCompletions[dateKey] = [];
    }

    const index = habitCompletions[dateKey].indexOf(habitId);
    const isCompleting = index === -1;

    if (isCompleting) {
        habitCompletions[dateKey].push(habitId);
    } else {
        habitCompletions[dateKey].splice(index, 1);
    }

    saveHabits();
    renderHabitsContent();
    updateStreakDisplay();
}

function calculateHabitStreak(habitId) {
    let streak = 0;
    const today = new Date();
    let checkDate = new Date(today);

    // Check if habit was completed today, if not start from yesterday
    if (!isHabitCompletedOnDate(habitId, today)) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        if (isHabitCompletedOnDate(habitId, checkDate)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

function calculateOverallStreak() {
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    if (habits.length === 0) return { current: 0, best: 0 };

    const today = new Date();
    let checkDate = new Date(today);

    // Go back up to 365 days to find best streak
    for (let i = 0; i < 365; i++) {
        const dateKey = getDateKey(checkDate);
        const completedCount = habitCompletions[dateKey]?.length || 0;
        const totalHabits = habits.length;

        // Consider a day successful if at least 50% of habits are completed
        if (completedCount >= totalHabits * 0.5 && totalHabits > 0) {
            tempStreak++;
            if (i === 0 || (i > 0 && tempStreak > 0)) {
                // Only count current streak if today/recent days are included
            }
        } else {
            if (tempStreak > bestStreak) bestStreak = tempStreak;
            tempStreak = 0;
        }

        checkDate.setDate(checkDate.getDate() - 1);
    }

    if (tempStreak > bestStreak) bestStreak = tempStreak;

    // Calculate current streak (consecutive days from today/yesterday)
    checkDate = new Date(today);
    const todayKey = getDateKey(today);
    const todayCompletions = habitCompletions[todayKey]?.length || 0;

    // If today is not complete, start checking from yesterday
    if (todayCompletions < habits.length * 0.5) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        const dateKey = getDateKey(checkDate);
        const completedCount = habitCompletions[dateKey]?.length || 0;

        if (completedCount >= habits.length * 0.5 && habits.length > 0) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return { current: currentStreak, best: Math.max(bestStreak, currentStreak) };
}

function updateStreakDisplay() {
    const streaks = calculateOverallStreak();
    const currentEl = document.getElementById('currentStreak');
    const bestEl = document.getElementById('bestStreak');

    if (currentEl) currentEl.textContent = streaks.current;
    if (bestEl) bestEl.textContent = streaks.best;
}

function openNewHabitModal(category = 'physical') {
    document.getElementById('habitNameInput').value = '';
    document.getElementById('habitCategoryInput').value = category;
    document.getElementById('habitIconInput').value = '';
    document.getElementById('newHabitModal').classList.add('active');
}

async function createHabit(event) {
    event.preventDefault();

    const name = document.getElementById('habitNameInput').value.trim();
    const category = document.getElementById('habitCategoryInput').value;
    const icon = document.getElementById('habitIconInput').value.trim();

    if (!name) return;

    const habit = {
        id: Date.now().toString(),
        name: name,
        category: category,
        icon: icon || getDefaultIcon(category),
        createdAt: new Date().toISOString()
    };

    habits.push(habit);

    saveHabits();
    closeModal('newHabitModal');
    renderHabitsContent();
}

function getDefaultIcon(category) {
    const defaults = {
        physical: '🏃‍♂️',
        mental: '📚',
        financial: '💵'
    };
    return defaults[category] || '✨';
}

async function deleteHabit(habitId) {
    showDialog('Are you sure you want to delete this habit? All tracking data will be lost.', 'Delete Habit?')
        .then(async (confirmed) => {
            if (confirmed) {
                habits = habits.filter(h => h.id !== habitId);
                // Also remove from completions
                Object.keys(habitCompletions).forEach(dateKey => {
                    habitCompletions[dateKey] = habitCompletions[dateKey].filter(id => id !== habitId);
                });

                saveHabits();
                renderHabitsContent();
                updateStreakDisplay();
            }
        });
}

function renderHabitsContent() {
    const content = document.getElementById('content');
    const dateKey = getDateKey(currentHabitDate);

    // Calculate progress
    const totalHabits = habits.length;
    const completedToday = habits.filter(h => isHabitCompletedOnDate(h.id, currentHabitDate)).length;
    const progressPercent = totalHabits > 0 ? (completedToday / totalHabits) * 100 : 0;

    // Group habits by category
    const habitsByCategory = {
        physical: habits.filter(h => h.category === 'physical'),
        mental: habits.filter(h => h.category === 'mental'),
        financial: habits.filter(h => h.category === 'financial')
    };

    content.innerHTML = `
        <div class="habits-container">
            <div class="habits-header">
                <h2>Today's Goals</h2>
                <button class="btn-primary" onclick="openNewHabitModal()">+ Add Habit</button>
            </div>
            
            <div class="habits-progress-bar">
                <div class="habits-progress-fill" style="width: ${progressPercent}%"></div>
            </div>
            
            <div class="habits-summary">
                <div class="summary-card">
                    <div class="summary-value">${completedToday}/${totalHabits}</div>
                    <div class="summary-label">Completed Today</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${Math.round(progressPercent)}%</div>
                    <div class="summary-label">Progress</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${habits.length}</div>
                    <div class="summary-label">Total Habits</div>
                </div>
            </div>
            
            <div class="habit-categories">
                ${renderHabitCategory('physical', habitsByCategory.physical)}
                ${renderHabitCategory('mental', habitsByCategory.mental)}
                ${renderHabitCategory('financial', habitsByCategory.financial)}
            </div>
        </div>
    `;
}

function renderHabitCategory(categoryKey, categoryHabits) {
    const category = HABIT_CATEGORIES[categoryKey];
    const completedCount = categoryHabits.filter(h => isHabitCompletedOnDate(h.id, currentHabitDate)).length;

    const habitsHtml = categoryHabits.length > 0
        ? categoryHabits.map(habit => renderHabitItem(habit)).join('')
        : `<div class="habit-empty">No habits in this category yet</div>`;

    return `
        <div class="habit-category category-${categoryKey}">
            <div class="category-header">
                <div class="category-title">
                    <span class="category-icon">${category.icon}</span>
                    <span>${category.name}</span>
                </div>
                <span class="category-count">${completedCount}/${categoryHabits.length}</span>
            </div>
            <div class="habit-list">
                ${habitsHtml}
                <button class="btn-add-habit" onclick="openNewHabitModal('${categoryKey}')">
                    + Add ${category.name.split(' ')[0]} Habit
                </button>
                ${categoryKey === 'financial' ? renderFinancialSpendingSection() : ''}
            </div>
        </div>
    `;
}

function renderHabitItem(habit) {
    const isCompleted = isHabitCompletedOnDate(habit.id, currentHabitDate);
    const streak = calculateHabitStreak(habit.id);

    return `
        <div class="habit-item ${isCompleted ? 'completed' : ''}" onclick="toggleHabitCompletion('${habit.id}')">
            <div class="habit-checkbox ${isCompleted ? 'checked' : ''}"></div>
            <div class="habit-info">
                <div class="habit-name">${habit.icon} ${escapeHtml(habit.name)}</div>
                ${streak > 0 ? `<div class="habit-streak">🔥 ${streak} day streak</div>` : ''}
            </div>
            <div class="habit-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); deleteHabit('${habit.id}')" title="Delete habit">🗑️</button>
            </div>
        </div>
    `;
}

function renderFinancialSpendingSection() {
    const dateKey = getDateKey(currentHabitDate);
    const items = getSpendingsForDate(currentHabitDate);
    const rows = items.length > 0 ? items.map(s => `
            <tr onclick="event.stopPropagation()">
                <td>${escapeHtml(s.item)}</td>
                <td style="text-align:right">${parseFloat(s.amount).toFixed(2)}</td>
                <td style="text-align:right"><button class="btn-icon" onclick="event.stopPropagation(); deleteSpending('${s.id}')">🗑️</button></td>
            </tr>
        `).join('') : `<tr><td colspan="3" style="text-align:center;color:var(--color-text-light)">No spendings yet</td></tr>`;

    const total = calculateSpendingTotal(currentHabitDate).toFixed(2);

    return `
        <div class="spending-section" onclick="event.stopPropagation()">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;">
                <div style="font-weight:700">Daily Spendings</div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button class="btn-secondary" onclick="exportSpendingsCSV(currentHabitDate)">Export CSV</button>
                </div>
            </div>
            <table class="spending-table" aria-label="Daily spendings for ${dateKey}">
                <thead>
                    <tr>
                        <th style="text-align:left">Item</th>
                        <th style="text-align:left">Category</th>
                        <th style="text-align:right">Amount</th>
                        <th style="text-align:right"></th>
                    </tr>
                </thead>
                <tbody id="spendingsBody-${dateKey}">
                    ${rows}
                </tbody>
                <tfoot>
                    <tr>
                        <td style="font-weight:700">Total</td>
                        <td></td>
                        <td style="text-align:right;font-weight:700">${total}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <div class="add-spending-row">
                <input id="spendingItemInput" class="form-input" placeholder="Item (e.g., coffee)" onkeydown="if(event.key==='Enter') addSpendingFromForm(event)" />
                <select id="spendingTagInput" class="form-input" onchange="if(event.key==='Enter') addSpendingFromForm(event)">
                    <option value="Food">Food</option>
                    <option value="Transport">Transport</option>
                    <option value="Coffee">Coffee</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Other">Other</option>
                </select>
                <input id="spendingAmountInput" type="number" step="0.01" class="form-input" placeholder="Amount" onkeydown="if(event.key==='Enter') addSpendingFromForm(event)" />
                <button class="btn-primary" onclick="addSpendingFromForm(event)">Add</button>
            </div>

            <div style="margin-top:16px;">
                <canvas id="spendingChart" style="width:100%;height:120px;background:transparent;border-radius:8px;"></canvas>
            </div>
        </div>
    `;
}

// Update switchView to handle habits view
const originalSwitchView = switchView;
switchView = function (view) {
    // when switching views, remove any lingering note save keyboard handler
    removeNoteSaveShortcut();
    currentView = view;
    currentProjectId = null;
    expandedTasks.clear();

    // Update tab styling
    document.getElementById('activeTab').classList.toggle('active', view === 'active');
    document.getElementById('archivedTab').classList.toggle('active', view === 'archived');
    document.getElementById('habitsTab').classList.toggle('active', view === 'habits');

    // Show/hide projects section vs habits sidebar
    const projectsSection = document.getElementById('projectsSection');
    const habitsSidebar = document.getElementById('habitsSidebar');

    if (view === 'habits') {
        projectsSection.style.display = 'none';
        habitsSidebar.style.display = 'flex';

        // Reset to today's date when switching to habits view
        currentHabitDate = new Date();
        updateHabitDateDisplay();
        updateStreakDisplay();

        document.getElementById('projectTitle').textContent = 'Daily Habit Tracker';
        renderHabitsContent();
    } else {
        projectsSection.style.display = 'block';
        habitsSidebar.style.display = 'none';

        renderProjectList();

        document.getElementById('projectTitle').textContent = view === 'active' ? 'Select a Project' : 'Select an Archived Project';
        document.getElementById('content').innerHTML = `
            <div class="task-list">
                <div class="empty-state">
                    <span class="icon-dot icon-dot-success"></span>
                    <p> Select a project to get started</p>
                </div>
            </div>
        `;
    }
};

// Initialize habits on load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize streaks display
    updateStreakDisplay();
});
