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

async function saveState() {
    if (!currentUser) return;
    try {
        await userDoc().set({ classes: state.classes });
    } catch (e) {
        console.error('Save error:', e);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateId() { return Math.random().toString(36).substring(2, 9); }
function parseNum(val) { return (!val && val !== 0) ? 0 : parseFloat(val) || 0; }

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
    term.weeks.push({
        id: generateId(), name: `Week ${term.weeks.length + 1}`,
        maxWkQuiz: 20,
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            .map(d => ({ id: generateId(), title: d, maxHW: 2, maxCW: 10 })),
        records: {}
    });
    saveState(); renderClassDashboard();
}

function addDayToWeek() {
    const term = state.classes.find(c => c.id === currentClassId).terms.find(t => t.id === currentTermId);
    const week = term.weeks.find(w => w.id === currentWeekId);
    week.days.push({ id: generateId(), title: 'New Day', maxHW: 2, maxCW: 10 });
    saveState(); renderWeekGrid();
}

function updateQuizMaxWk() {
    const term = state.classes.find(c => c.id === currentClassId).terms.find(t => t.id === currentTermId);
    const week = term.weeks.find(w => w.id === currentWeekId);
    const newMax = prompt(`Max score for this Week's Quiz:`, week.maxWkQuiz);
    if (newMax && !isNaN(newMax)) { week.maxWkQuiz = parseInt(newMax); saveState(); renderWeekGrid(); }
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function calculateTermAnalytics(cls, termId) {
    const term = cls.terms.find(t => t.id === termId);
    return cls.students.map(stu => {
        let hwE = 0, hwM = 0, qzE = 0, qzM = 0;
        term.weeks.forEach(w => {
            w.days.forEach(d => {
                const r = (w.records[stu.id] || {})[d.id] || {};
                hwE += parseNum(r.hw); hwM += d.maxHW;
            });
            const wR = w.records[stu.id] || {};
            if (wR.quiz !== undefined) qzE += parseNum(wR.quiz);
            qzM += w.maxWkQuiz;
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
                <button class="delete-class text-slate-300 hover:text-red-500 hidden group-hover:block"><i class="ph ph-trash text-xl"></i></button>
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
                <button class="del-w text-slate-300 hover:text-red-500 hidden group-hover:block"><i class="ph ph-trash text-xl"></i></button>
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
        thG.className = 'border-b border-x border-slate-200 bg-slate-50 p-2 min-w-[210px] text-center relative group';
        thG.innerHTML = `
            <input type="text" class="day-header-input text-base text-slate-800" value="${day.title}">
            <button class="del-day absolute top-2 right-2 text-slate-300 hover:text-red-500 hidden group-hover:block"><i class="ph ph-trash text-base"></i></button>
        `;
        thG.querySelector('input').addEventListener('change', e => { day.title = e.target.value; saveState(); });
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
            if (!sRec[d.id]) sRec[d.id] = { att: false, hw: '', cw: 0 };
            const r = sRec[d.id];
            const hwDisplay = r.hw === '' ? '-' : r.hw;

            tr.innerHTML += `
                <td class="p-0 border-b border-r border-slate-200 bg-indigo-50/30 text-center select-none cursor-pointer hw-cycle-btn hover:bg-indigo-100/60 transition-colors"
                    data-sid="${stu.id}" data-did="${d.id}" data-val="${r.hw}">
                    <span class="font-extrabold text-indigo-700 text-base pointer-events-none">${hwDisplay}</span>
                </td>
                <td class="p-0 border-b border-r border-slate-200 bg-amber-50/20">
                    <input type="text" class="editable-input text-amber-700" value="${r.cw === 0 ? '' : r.cw}" data-sid="${stu.id}" data-did="${d.id}" data-f="cw">
                </td>
                <td class="p-0 border-b border-r border-slate-200 bg-emerald-50/20 text-center align-middle">
                    <input type="checkbox" class="w-5 h-5 accent-emerald-500 attend-check" data-sid="${stu.id}" data-did="${d.id}" ${r.att ? 'checked' : ''}>
                </td>
            `;
        });

        const qzVal = sRec.quiz || 0;
        tr.innerHTML += `
            <td class="p-0 border-b border-l-4 border-purple-200 bg-purple-50/80">
                <input type="text" class="editable-input text-purple-700 font-bold text-base" value="${qzVal === 0 ? '' : qzVal}" data-sid="${stu.id}" data-f="quiz">
            </td>
        `;
        tbody.appendChild(tr);
    });

    // HW cycling: - → 2 → 1 → 0 → -
    tbody.addEventListener('click', e => {
        const btn = e.target.closest('.hw-cycle-btn');
        if (!btn) return;
        const sid = btn.getAttribute('data-sid');
        const did = btn.getAttribute('data-did');
        const curr = btn.getAttribute('data-val');
        let next = curr === '' ? 2 : curr == '2' ? 1 : curr == '1' ? 0 : '';
        week.records[sid][did].hw = next;
        saveState();
        renderWeekGrid();
    });

    tbody.addEventListener('change', e => {
        if (!e.target.classList.contains('editable-input') && !e.target.classList.contains('attend-check')) return;
        const sid = e.target.getAttribute('data-sid');
        const did = e.target.getAttribute('data-did');
        const f = e.target.getAttribute('data-f');

        if (e.target.type === 'checkbox') {
            week.records[sid][did].att = e.target.checked;
        } else if (f === 'quiz') {
            let val = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), week.maxWkQuiz);
            e.target.value = val === 0 ? '' : val;
            week.records[sid].quiz = val;
        } else {
            const day = week.days.find(d => d.id === did);
            let val = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), f === 'cw' ? day.maxCW : day.maxHW);
            e.target.value = val === 0 ? '' : val;
            week.records[sid][did][f] = val;
        }
        saveState();
    });
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
            <td class="p-4 text-center"><button class="text-slate-300 hover:text-red-500"><i class="ph ph-trash text-xl"></i></button></td>
        `;
        tr.querySelector('input').addEventListener('change', e => { stu.name = e.target.value; saveState(); });
        tr.querySelector('button').addEventListener('click', () => {
            if (confirm('Remove student?')) { cls.students = cls.students.filter(s => s.id !== stu.id); saveState(); renderRosterList(); }
        });
        tbody.appendChild(tr);
    });
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
function exportExcel(mode) {
    const cls = state.classes.find(c => c.id === currentClassId);
    const term = cls.terms.find(t => t.id === currentTermId);
    const wb = XLSX.utils.book_new();

    const weeksToExport = mode === 'term' ? term.weeks : [term.weeks.find(w => w.id === currentWeekId)];
    if (!weeksToExport.length) return alert('Nothing to export.');

    weeksToExport.forEach(w => {
        const h1 = ['Student Name'];
        const h2 = [''];
        w.days.forEach(d => { h1.push(d.title, '', ''); h2.push('HW', 'CW', 'ATT'); });
        h1.push('Final Quiz'); h2.push('Score');

        const rows = [h1, h2];
        cls.students.forEach(stu => {
            const rObj = w.records[stu.id] || {};
            const row = [stu.name];
            w.days.forEach(d => {
                const r = rObj[d.id] || { att: false, hw: 0, cw: 0 };
                row.push(r.hw === '' ? '' : parseNum(r.hw), parseNum(r.cw), r.att ? '✔' : '✗');
            });
            row.push(parseNum(rObj.quiz));
            rows.push(row);
        });

        const sheet = XLSX.utils.aoa_to_sheet(rows);
        if (!sheet['!merges']) sheet['!merges'] = [];
        let col = 1;
        w.days.forEach(() => { sheet['!merges'].push({ s: { r: 0, c: col }, e: { r: 0, c: col + 2 } }); col += 3; });
        sheet['!cols'] = [{ wch: 25 }, ...Array(w.days.length * 3).fill({ wch: 8 }), { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, sheet, w.name.substring(0, 31));
    });

    XLSX.writeFile(wb, `FollowUp_${cls.name}_${term.name}.xlsx`);
}
