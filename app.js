// ─── Firebase Setup ───────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyBz7kD6N0o4U4JkBz1rfhb9biCeuT5QIXM",
    authDomain: "followup-sheet-7c03c.firebaseapp.com",
    projectId: "followup-sheet-7c03c",
    storageBucket: "followup-sheet-7c03c.firebasestorage.app",
    messagingSenderId: "491806130922",
    appId: "1:491806130922:web:8b6de77c56a1923d3c4d93",
    measurementId: "G-8B034FPTCT"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ─── App State ────────────────────────────────────────────────────────────────
let currentUser = null;
let state = { classes: [] };
let currentClassId = null;
let currentTermId = null;
let currentWeekId = null;

// ─── Auth ─────────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('activeTeacherName').textContent = user.email.split('@')[0];
        showUI(true);
        loadState();
    } else {
        currentUser = null;
        state = { classes: [] };
        showUI(false);
    }
});

function showUI(loggedIn) {
    const loginView = document.getElementById('loginView');
    const header = document.getElementById('mainHeader');
    if (loggedIn) {
        loginView.classList.add('hidden'); loginView.classList.remove('flex');
        header.classList.remove('hidden'); header.classList.add('flex');
    } else {
        loginView.classList.remove('hidden'); loginView.classList.add('flex');
        header.classList.add('hidden'); header.classList.remove('flex');
        document.getElementById('rootDashboard').classList.add('hidden');
        document.getElementById('classDashboard').classList.add('hidden');
        document.getElementById('weekView').classList.add('hidden');
    }
}

async function executeLogin() {
    const errorEl = document.getElementById('loginError');
    const statusEl = document.getElementById('loginStatus');
    const email = document.getElementById('emailInput').value.trim();
    const pass = document.getElementById('passwordInput').value.trim();

    if (!email || !pass) {
        errorEl.textContent = 'Please enter both email and password.';
        errorEl.classList.remove('hidden');
        return;
    }

    errorEl.classList.add('hidden');
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Signing in…';

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-email') {
            // Try to register
            try {
                statusEl.textContent = 'Creating new account…';
                await auth.createUserWithEmailAndPassword(email, pass);
            } catch (regErr) {
                statusEl.classList.add('hidden');
                errorEl.textContent = regErr.message;
                errorEl.classList.remove('hidden');
            }
        } else {
            statusEl.classList.add('hidden');
            errorEl.textContent = e.message;
            errorEl.classList.remove('hidden');
        }
    }
}

function logout() {
    auth.signOut();
    currentClassId = null; currentTermId = null; currentWeekId = null;
}

// ─── Firestore Persistence ────────────────────────────────────────────────────
function userDoc() {
    return db.collection('teachers').doc(currentUser.uid);
}

async function loadState() {
    try {
        const doc = await userDoc().get();
        state.classes = doc.exists ? (doc.data().classes || []) : [];
    } catch (e) {
        console.error('Load error:', e);
        state.classes = [];
    }
    goToHome();
}

let lastSaveFailed = false;

function setSaveStatus(status) {
    const dot = document.getElementById('saveStatusDot');
    const text = document.getElementById('saveStatusText');
    if (!dot || !text) return;
    const styles = {
        saving: { dot: 'bg-amber-400 animate-pulse', label: 'Saving…', text: 'text-amber-600' },
        saved: { dot: 'bg-emerald-500', label: 'Saved', text: 'text-slate-500' },
        error: { dot: 'bg-red-500', label: 'Save failed — tap to retry', text: 'text-red-600 font-semibold' }
    }[status];
    dot.className = `w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles.dot}`;
    text.className = `whitespace-nowrap ${styles.text}`;
    text.textContent = styles.label;
}

async function saveState() {
    if (!currentUser) return;
    setSaveStatus('saving');
    try {
        await userDoc().set({ classes: state.classes });
        lastSaveFailed = false;
        setSaveStatus('saved');
    } catch (e) {
        console.error('Save error:', e);
        lastSaveFailed = true;
        setSaveStatus('error');
    }
}

function retrySave() {
    if (!lastSaveFailed) return;
    saveState();
}

window.addEventListener('beforeunload', (e) => {
    if (lastSaveFailed) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateId() { return Math.random().toString(36).substring(2, 9); }
function parseNum(val) { return (!val && val !== 0) ? 0 : parseFloat(val) || 0; }

// toISOString() converts to UTC first — for any timezone ahead of UTC
// (e.g. Cairo, UTC+2/+3), generating a date late at night or early morning
// can silently roll it back to the previous calendar day. These two helpers
// stay in local time throughout, so the stored/displayed date always matches
// the date the teacher actually meant.
function toLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return '';
    const dt = new Date(y, m - 1, d); // constructed in local time — never parse a
    // 'YYYY-MM-DD' string directly with new Date(), that parses as UTC and can
    // shift the displayed date by a day in the exact same way as above.
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function goToHome() {
    show('rootDashboard'); hide('classDashboard'); hide('weekView');
    currentClassId = null; currentTermId = null; currentWeekId = null;
    renderRootDashboard();
}
function goToClass(classId) {
    currentClassId = classId || currentClassId;
    const cls = state.classes.find(c => c.id === currentClassId);
    if (!currentTermId && cls.terms.length > 0) currentTermId = cls.terms[0].id;
    currentWeekId = null;
    hide('rootDashboard'); hide('weekView'); show('classDashboard');
    renderClassDashboard();
}
function goToWeek(weekId) {
    currentWeekId = weekId;
    hide('classDashboard'); show('weekView');
    renderWeekGrid();
}
function show(id) { document.getElementById(id).classList.remove('hidden'); document.getElementById(id).classList.add('flex'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); document.getElementById(id).classList.remove('flex'); }

// ─── Modals ───────────────────────────────────────────────────────────────────
function openNewClassModal() { show('newClassModal'); document.getElementById('classNameInput').focus(); }
function closeNewClassModal() { hide('newClassModal'); document.getElementById('classNameInput').value = ''; }

function openRosterModal() { show('rosterModal'); renderRosterList(); }
function closeRosterModal() { hide('rosterModal'); renderClassDashboard(); }

// ─── Data Mutations ───────────────────────────────────────────────────────────
function saveClass() {
    const title = document.getElementById('classNameInput').value.trim();
    if (!title) return;
    state.classes.push({
        id: generateId(), name: title, students: [],
        terms: [{ id: generateId(), name: 'Term 1', weeks: [] }]
    });
    saveState(); closeNewClassModal(); renderRootDashboard();
}

function addStudent() {
    const input = document.getElementById('newStudentName');
    const name = input.value.trim();
    if (!name) return;
    state.classes.find(c => c.id === currentClassId).students.push({ id: generateId(), name });
    saveState(); input.value = ''; renderRosterList();
}

function addTermToClass() {
    const cls = state.classes.find(c => c.id === currentClassId);
    cls.terms.push({ id: generateId(), name: `Term ${cls.terms.length + 1}`, weeks: [] });
    saveState();
    currentTermId = cls.terms[cls.terms.length - 1].id;
    renderClassDashboard();
}

function addWeek() {
    const term = state.classes.find(c => c.id === currentClassId).terms.find(t => t.id === currentTermId);
    // Auto-generate Sunday–Thursday dates starting from next Sunday
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);

    const defaultDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    const days = defaultDays.map((name, i) => {
        const d = new Date(nextSunday);
        d.setDate(nextSunday.getDate() + i);
        const dateStr = toLocalDateStr(d);
        return { id: generateId(), title: name, date: dateStr, maxHW: 2, maxCW: 10 };
    });

    term.weeks.push({
        id: generateId(), name: `Week ${term.weeks.length + 1}`,
        maxWkQuiz: 20, days, records: {}
    });
    saveState(); renderClassDashboard();
}

function addDayToWeek() {
    const term = state.classes.find(c => c.id === currentClassId).terms.find(t => t.id === currentTermId);
    const week = term.weeks.find(w => w.id === currentWeekId);
    week.days.push({ id: generateId(), title: 'New Day', date: '', maxHW: 2, maxCW: 10 });
    saveState(); renderWeekGrid();
}

function updateQuizMaxWk() {
    const term = state.classes.find(c => c.id === currentClassId).terms.find(t => t.id === currentTermId);
    const week = term.weeks.find(w => w.id === currentWeekId);
    const newMax = prompt(`Max score for this Week's Quiz:`, week.maxWkQuiz);
    if (newMax && !isNaN(newMax)) { week.maxWkQuiz = parseInt(newMax); saveState(); renderWeekGrid(); }
}

// ─── Analytics ────────────────────────────────────────────────────────────────
// Accuracy rules (grades depend on this):
//  - A day only counts toward the HW average if HW was actually recorded for
//    it (blank/'' means "no HW that day" and is excluded entirely — it does
//    NOT count as a zero).
//  - A week only counts toward the Quiz average if a quiz score was actually
//    recorded (blank means "no quiz that week" and is excluded).
//  - Each day's own maxHW and each week's own maxWkQuiz are used as-is, so a
//    25-point quiz week and a 20-point quiz week are weighted correctly
//    relative to each other instead of assuming one fixed max.
//  - An explicit score of 0 (student did it and scored zero / got no marks)
//    IS included — only truly blank/ungraded entries are excluded.
function calculateTermAnalytics(cls, termId) {
    const term = cls.terms.find(t => t.id === termId);
    return cls.students.map(stu => {
        let hwE = 0, hwM = 0, qzE = 0, qzM = 0;
        term.weeks.forEach(w => {
            w.days.forEach(d => {
                const r = (w.records[stu.id] || {})[d.id] || {};
                if (r.hw !== '' && r.hw !== undefined && r.hw !== null) {
                    hwE += parseNum(r.hw);
                    hwM += d.maxHW;
                }
            });
            const wR = w.records[stu.id] || {};
            if (wR.quiz !== '' && wR.quiz !== undefined && wR.quiz !== null) {
                qzE += parseNum(wR.quiz);
                qzM += w.maxWkQuiz;
            }
        });
        return {
            id: stu.id, name: stu.name,
            hwPercent: hwM > 0 ? Math.round((hwE / hwM) * 100) : 0,
            qzPercent: qzM > 0 ? Math.round((qzE / qzM) * 100) : 0
        };
    });
}

// ─── Render Root ──────────────────────────────────────────────────────────────
function renderRootDashboard() {
    const grid = document.getElementById('classGrid');
    grid.innerHTML = '';
    if (!state.classes.length) {
        grid.innerHTML = `<div class="col-span-full py-16 text-center text-slate-400 glass-panel rounded-3xl border-2 border-dashed border-white">No active classes. Create one to begin.</div>`;
        return;
    }
    state.classes.forEach(cls => {
        const cd = document.createElement('div');
        cd.className = 'glass-panel rounded-3xl p-6 cursor-pointer hover-lift relative group border-t-4 border-t-primary';
        cd.innerHTML = `
            <div class="flex justify-between items-start mb-6">
                <h3 class="text-2xl font-extrabold text-slate-800 outfit">${cls.name}</h3>
                <button class="delete-class text-red-300 hover:text-red-600 hover:bg-red-50 transition-colors p-1.5 rounded-full"><i class="ph ph-trash text-xl"></i></button>
            </div>
            <div class="space-y-3">
                <div class="flex items-center space-x-3 text-slate-600 font-medium bg-white/50 px-3 py-2 rounded-xl"><i class="ph ph-users text-primary"></i><span>${cls.students.length} Enrolled</span></div>
                <div class="flex items-center space-x-3 text-slate-600 font-medium bg-white/50 px-3 py-2 rounded-xl"><i class="ph ph-folders text-accent"></i><span>${cls.terms.length} Terms</span></div>
            </div>
        `;
        cd.addEventListener('click', e => {
            if (e.target.closest('.delete-class')) {
                if (confirm('Delete class entirely?')) { state.classes = state.classes.filter(c => c.id !== cls.id); saveState(); renderRootDashboard(); }
                return;
            }
            goToClass(cls.id);
        });
        grid.appendChild(cd);
    });
}

// ─── Render Class Dashboard ───────────────────────────────────────────────────
function renderClassDashboard() {
    const cls = state.classes.find(c => c.id === currentClassId);
    document.getElementById('cdTitle').textContent = cls.name;
    document.getElementById('cdStats').textContent = `${cls.students.length} Students Enrolled`;

    // Term tabs
    const tc = document.getElementById('termTabContainer');
    tc.innerHTML = '';
    cls.terms.forEach(t => {
        const btn = document.createElement('button');
        btn.className = `px-4 py-1.5 rounded-xl font-bold text-sm transition-all ${t.id === currentTermId ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`;
        btn.textContent = t.name;
        btn.onclick = () => { currentTermId = t.id; renderClassDashboard(); };
        tc.appendChild(btn);
    });

    const term = cls.terms.find(t => t.id === currentTermId);
    document.getElementById('activeTermTitle').textContent = `${term.name} Weeks`;

    // Weeks list
    const wg = document.getElementById('weekGrid');
    wg.innerHTML = '';
    term.weeks.slice().reverse().forEach(w => {
        const el = document.createElement('div');
        el.className = 'glass-card rounded-2xl p-4 cursor-pointer hover-lift flex justify-between items-center group shadow-sm';
        el.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex justify-center items-center text-lg"><i class="ph ph-calendar-blank"></i></div>
                <h4 class="font-bold text-lg text-slate-700">${w.name}</h4>
            </div>
            <div class="flex items-center space-x-4">
                <span class="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-xl">${w.days.length} Days</span>
                <button class="del-w text-red-300 hover:text-red-600 hover:bg-red-50 transition-colors p-1.5 rounded-full"><i class="ph ph-trash text-xl"></i></button>
            </div>
        `;
        el.addEventListener('click', e => {
            if (e.target.closest('.del-w')) {
                if (confirm('Delete week?')) { term.weeks = term.weeks.filter(x => x.id !== w.id); saveState(); renderClassDashboard(); }
                return;
            }
            goToWeek(w.id);
        });
        wg.appendChild(el);
    });

    // Analytics
    const tbody = document.getElementById('analyticsList');
    tbody.innerHTML = '';
    const stats = calculateTermAnalytics(cls, currentTermId);
    if (!stats.length) { tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 italic">No students yet</td></tr>`; return; }
    stats.forEach(s => {
        const hC = s.hwPercent >= 80 ? 'text-emerald-600' : s.hwPercent >= 50 ? 'text-amber-600' : 'text-red-500';
        const qC = s.qzPercent >= 80 ? 'text-emerald-600' : s.qzPercent >= 50 ? 'text-amber-600' : 'text-red-500';
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 font-bold text-slate-700 border-r border-white">${s.name}</td>
                <td class="p-3 text-center font-extrabold ${hC} border-r border-white bg-indigo-50/50">${s.hwPercent}%</td>
                <td class="p-3 text-center font-extrabold ${qC} bg-purple-50/50">${s.qzPercent}%</td>
            </tr>`;
    });
}

// ─── Render Week Grid ─────────────────────────────────────────────────────────
function getCurrentWeek() {
    const cls = state.classes.find(c => c.id === currentClassId);
    const term = cls.terms.find(t => t.id === currentTermId);
    return term.weeks.find(w => w.id === currentWeekId);
}

function renderWeekGrid() {
    const cls = state.classes.find(c => c.id === currentClassId);
    const term = cls.terms.find(t => t.id === currentTermId);
    const week = term.weeks.find(w => w.id === currentWeekId);

    document.getElementById('weekViewTitle').textContent = week.name;
    document.getElementById('weekViewClassContext').textContent = `${cls.name} / ${term.name}`;

    const t1 = document.getElementById('tier1Headers');
    const t2 = document.getElementById('tier2Headers');
    const tbody = document.getElementById('bigPaperBody');

    t1.innerHTML = `<th class="p-4 w-12 border-b border-slate-200 bg-white sticky left-0 z-20" rowspan="2">#</th>
                    <th class="p-4 w-52 border-b border-r-2 border-slate-300 bg-white sticky left-[48px] z-20" rowspan="2">Student Name</th>`;
    t2.innerHTML = '';

    week.days.forEach(day => {
        const thG = document.createElement('th');
        thG.colSpan = 3;
        thG.className = 'border-b border-x border-slate-200 bg-slate-50 p-1.5 min-w-[200px] text-center relative group';
        thG.innerHTML = `
            <div class="flex flex-col items-center gap-0.5">
                <input type="date" class="day-date-input text-[10px] text-slate-400 bg-transparent border-none outline-none cursor-pointer w-full text-center" value="${day.date || ''}" title="Day date">
                <input type="text" class="day-header-input text-sm text-slate-800" value="${day.title}">
            </div>
            <button class="del-day absolute top-1 right-1 text-red-300 hover:text-red-600 hover:bg-red-50 transition-colors p-1 rounded-full"><i class="ph ph-trash text-sm"></i></button>
        `;
        thG.querySelector('.day-date-input').addEventListener('change', e => { day.date = e.target.value; saveState(); });
        thG.querySelector('.day-header-input').addEventListener('change', e => { day.title = e.target.value; saveState(); });
        thG.querySelector('.del-day').addEventListener('click', () => { if (confirm('Delete day?')) { week.days = week.days.filter(d => d.id !== day.id); saveState(); renderWeekGrid(); } });
        t1.appendChild(thG);

        t2.innerHTML += `
            <th class="p-2 border-r border-slate-200 w-16 bg-indigo-50/50"><span class="text-indigo-700">HW</span><br><span class="text-[10px] text-indigo-400">/${day.maxHW}</span></th>
            <th class="p-2 border-r border-slate-200 w-16 bg-amber-50/50"><span class="text-amber-700">CW</span><br><span class="text-[10px] text-amber-400">/${day.maxCW}</span></th>
            <th class="p-2 border-r border-slate-200 w-16 bg-emerald-50/50"><span class="text-emerald-700">ATT</span><br><span class="text-[10px]">✓/✗</span></th>
        `;
    });

    t1.innerHTML += `<th class="p-4 w-24 border-b border-l-4 border-purple-200 bg-purple-50 text-purple-600 text-center cursor-pointer hover:bg-purple-100 transition-colors" rowspan="2" onclick="updateQuizMaxWk()">
        Final Quiz<br><span class="text-[10px] text-purple-400">Max: ${week.maxWkQuiz}</span>
    </th>`;

    tbody.innerHTML = '';
    if (!cls.students.length) { tbody.innerHTML = `<tr><td colspan="100" class="p-8 text-center text-slate-500">No students found.</td></tr>`; return; }

    cls.students.forEach((stu, idx) => {
        if (!week.records[stu.id]) week.records[stu.id] = {};
        const sRec = week.records[stu.id];

        const tr = document.createElement('tr');
        tr.className = 'table-row-hover transition-colors';
        tr.innerHTML = `
            <td class="p-4 text-center border-b border-slate-200 bg-white sticky left-0 z-10 text-slate-400 text-xs">${idx + 1}</td>
            <td class="p-4 border-b border-r-2 border-slate-300 bg-white sticky left-[48px] z-10 font-bold text-slate-700">${stu.name}</td>
        `;

        week.days.forEach(d => {
            if (!sRec[d.id]) sRec[d.id] = { att: true, hw: '', cw: '' };
            const r = sRec[d.id];
            const hwDisplay = r.hw === '' ? '-' : r.hw;

            tr.innerHTML += `
                <td class="p-0 border-b border-r border-slate-200 bg-indigo-50/30 text-center select-none cursor-pointer hw-cycle-btn hover:bg-indigo-100/60 transition-colors"
                    data-sid="${stu.id}" data-did="${d.id}" data-val="${r.hw}">
                    <span class="font-extrabold text-indigo-700 text-base pointer-events-none">${hwDisplay}</span>
                </td>
                <td class="p-0 border-b border-r border-slate-200 bg-amber-50/20">
                    <input type="text" class="editable-input text-amber-700" value="${r.cw === '' || r.cw === undefined ? '' : r.cw}" data-sid="${stu.id}" data-did="${d.id}" data-f="cw">
                </td>
                <td class="p-0 border-b border-r border-slate-200 bg-emerald-50/20 text-center align-middle">
                    <input type="checkbox" class="w-5 h-5 accent-emerald-500 attend-check" data-sid="${stu.id}" data-did="${d.id}" ${r.att ? 'checked' : ''}>
                </td>
            `;
        });

        const qzVal = (sRec.quiz === '' || sRec.quiz === undefined) ? '' : sRec.quiz;
        tr.innerHTML += `
            <td class="p-0 border-b border-l-4 border-purple-200 bg-purple-50/80">
                <input type="text" class="editable-input text-purple-700 font-bold text-base" value="${qzVal}" data-sid="${stu.id}" data-f="quiz">
            </td>
        `;
        tbody.appendChild(tr);
    });

    // HW cycling: - → 2 → 1 → 0 → -
    // Attached ONCE — tbody is a persistent DOM node reused across every
    // re-render, so re-adding listeners here on every renderWeekGrid() call
    // was stacking duplicates (and since this handler itself calls
    // renderWeekGrid(), each click doubled the listener count — 1, 2, 4, 8...
    // exponential lag the longer a session runs). getCurrentWeek() is used
    // instead of the closed-over `week` var so this stays correct even after
    // switching weeks, since the handler is never re-attached.
    if (!tbody.dataset.listenersBound) {
        tbody.dataset.listenersBound = '1';

        tbody.addEventListener('click', e => {
            const btn = e.target.closest('.hw-cycle-btn');
            if (!btn) return;
            const sid = btn.getAttribute('data-sid');
            const did = btn.getAttribute('data-did');
            const curr = btn.getAttribute('data-val');
            let next = curr === '' ? 2 : curr == '2' ? 1 : curr == '1' ? 0 : '';
            getCurrentWeek().records[sid][did].hw = next;
            saveState();
            renderWeekGrid();
        });

        tbody.addEventListener('change', e => {
            if (!e.target.classList.contains('editable-input') && !e.target.classList.contains('attend-check')) return;
            const sid = e.target.getAttribute('data-sid');
            const did = e.target.getAttribute('data-did');
            const f = e.target.getAttribute('data-f');
            const liveWeek = getCurrentWeek();

            if (e.target.type === 'checkbox') {
                liveWeek.records[sid][did].att = e.target.checked;
            } else if (f === 'quiz') {
                const raw = e.target.value.trim();
                if (raw === '') {
                    liveWeek.records[sid].quiz = '';
                } else {
                    let val = Math.min(Math.max(parseFloat(raw) || 0, 0), liveWeek.maxWkQuiz);
                    e.target.value = val;
                    liveWeek.records[sid].quiz = val;
                }
            } else {
                const day = liveWeek.days.find(d => d.id === did);
                const raw = e.target.value.trim();
                if (raw === '') {
                    liveWeek.records[sid][did][f] = '';
                } else {
                    let val = Math.min(Math.max(parseFloat(raw) || 0, 0), f === 'cw' ? day.maxCW : day.maxHW);
                    e.target.value = val;
                    liveWeek.records[sid][did][f] = val;
                }
            }
            saveState();
        });
    }
}

// ─── Roster Render ────────────────────────────────────────────────────────────
function renderRosterList() {
    const cls = state.classes.find(c => c.id === currentClassId);
    const tbody = document.getElementById('rosterList');
    tbody.innerHTML = '';
    cls.students.forEach(stu => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-4"><input type="text" class="w-full bg-transparent outline-none font-bold" value="${stu.name}"></td>
            <td class="p-4 text-center"><button class="text-red-300 hover:text-red-600 hover:bg-red-50 transition-colors p-1.5 rounded-full"><i class="ph ph-trash text-xl"></i></button></td>
        `;
        tr.querySelector('input').addEventListener('change', e => { stu.name = e.target.value; saveState(); });
        tr.querySelector('button').addEventListener('click', () => {
            if (confirm('Remove student?')) { cls.students = cls.students.filter(s => s.id !== stu.id); saveState(); renderRosterList(); }
        });
        tbody.appendChild(tr);
    });
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
async function exportExcel(mode) {
    const cls = state.classes.find(c => c.id === currentClassId);
    const term = cls.terms.find(t => t.id === currentTermId);
    const weeksToExport = mode === 'term' ? term.weeks : [term.weeks.find(w => w.id === currentWeekId)];
    if (!weeksToExport.length) return alert('Nothing to export.');

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Follow-Up Sheet';
    wb.created = new Date();

    const thin = { style: 'thin', color: { argb: 'FFCBD5E1' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    const fillSubHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF0FF' } };
    const fillStripe = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const fontHeader = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const fontSubHeader = { bold: true, color: { argb: 'FF4338CA' }, size: 10 };
    const centerMid = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const leftMid = { vertical: 'middle', horizontal: 'left' };

    weeksToExport.forEach(w => {
        const safeName = w.name.substring(0, 31).replace(/[\\/?*[\]:]/g, '');
        const ws = wb.addWorksheet(safeName, { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });

        // Print setup — landscape, fit to one page wide, repeat the two
        // header rows and the Student Name column on every printed page.
        ws.pageSetup = {
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            showGridLines: false,
            margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
        };
        ws.pageSetup.printTitlesRow = '1:2';
        ws.pageSetup.printTitlesColumn = 'A:A';
        ws.headerFooter = {
            oddHeader: `&L&B${cls.name} — ${term.name}&R&D`,
            oddFooter: `&C${w.name}&RPage &P of &N`
        };

        const h1 = ['Student Name'];
        const h2 = [''];
        w.days.forEach(d => {
            const dateLabel = formatDateLabel(d.date);
            h1.push(dateLabel ? `${d.title}\n${dateLabel}` : d.title, '', '');
            h2.push('HW', 'CW', 'ATT');
        });
        h1.push('Final Quiz'); h2.push('Score');
        ws.addRow(h1);
        ws.addRow(h2);

        // Merge each day title across its 3 sub-columns, and the two single-column
        // headers (Student Name / Final Quiz) down across both header rows.
        let col = 2;
        w.days.forEach(() => { ws.mergeCells(1, col, 1, col + 2); col += 3; });
        const quizCol = col;
        ws.mergeCells(1, 1, 2, 1);
        ws.mergeCells(1, quizCol, 2, quizCol);

        [1, 2].forEach(r => {
            const row = ws.getRow(r);
            row.height = r === 1 ? 32 : 20;
            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = border;
                cell.alignment = centerMid;
                cell.fill = r === 1 ? fillHeader : fillSubHeader;
                cell.font = r === 1 ? fontHeader : fontSubHeader;
            });
        });
        ws.getCell(1, 1).alignment = leftMid;
        ws.getCell(1, 1).font = fontHeader;

        cls.students.forEach((stu, idx) => {
            const rObj = w.records[stu.id] || {};
            const rowData = [stu.name];
            w.days.forEach(d => {
                const r = rObj[d.id] || { att: true, hw: '', cw: '' };
                const hwOut = (r.hw === '' || r.hw === undefined) ? '' : parseNum(r.hw);
                const cwOut = (r.cw === '' || r.cw === undefined) ? '' : parseNum(r.cw);
                rowData.push(hwOut, cwOut, r.att ? '✔' : '✗');
            });
            const qzOut = (rObj.quiz === '' || rObj.quiz === undefined) ? '' : parseNum(rObj.quiz);
            rowData.push(qzOut);
            const excelRow = ws.addRow(rowData);
            excelRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
                cell.border = border;
                cell.alignment = colNum === 1 ? leftMid : centerMid;
                if (idx % 2 === 1) cell.fill = fillStripe;
            });
            excelRow.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
        });

        ws.getColumn(1).width = 24;
        for (let c = 2; c < quizCol; c++) ws.getColumn(c).width = 8;
        ws.getColumn(quizCol).width = 12;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FollowUp_${cls.name}_${term.name}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
