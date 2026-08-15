import { randomBytes } from 'node:crypto';

const accounts = [
  ['STUDENT', 'DPS202601', '2010-04-15', 'Student'],
  ['PARENT', 'DPS202601', '2010-04-15', 'Parent'],
  ['TEACHER', 'DPST001', '1985-01-15', 'Teacher'],
  ['ACCOUNTANT', 'DPSA001', '1988-06-20', 'Accountant'],
  ['ADMIN_STAFF', 'DPSS001', '1990-02-10', 'Admin Staff'],
  ['ADMINISTRATOR', 'DPSADM001', '1982-09-05', 'Administrator'],
  ['SUPER_ADMIN', 'DPSSA001', '1980-01-01', 'Super Admin'],
];

const state = globalThis.__dpsErpState || (globalThis.__dpsErpState = {
  sessions: new Map(),
  nextId: 5,
  nextAttachmentId: 1,
  records: [
    { id: 1, module: 'Students', title: 'Aarav Sharma', subtitle: 'Class X-A · DPS202601', status: 'Active', amount: 0 },
    { id: 2, module: 'Homework', title: 'Algebra practice set', subtitle: 'Class X-A · Mathematics', status: 'Pending', amount: 0 },
    { id: 3, module: 'Attendance', title: 'August attendance', subtitle: '22 present · 1 absent', status: '94%', amount: 0 },
    { id: 4, module: 'Fees', title: 'Quarter II fee', subtitle: 'Tuition and activity fee', status: 'Paid', amount: 18500 },
  ],
  attachments: new Map(),
  imports: [],
});

function send(res, status, value) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  return res.send(JSON.stringify(value));
}

function pathFor(req) {
  const value = req.query?.path;
  return '/' + (Array.isArray(value) ? value.join('/') : value || '');
}

function signedInUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = state.sessions.get(token);
  if (!session || session.expiresAt < Date.now()) return null;
  return session.user;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    const path = pathFor(req);

    if (path === '/health') return send(res, 200, { ok: true, runtime: 'vercel-serverless', database: 'temporary' });

    if (path === '/auth/login' && req.method === 'POST') {
      const rawRole = String(req.body?.role || '').toUpperCase();
      const [role, suppliedId = ''] = rawRole.split(':');
      const account = accounts.find(([r, id]) => r === role && (!suppliedId || id === suppliedId));
      if (!account || String(req.body?.password || '') !== account[2]) {
        return send(res, 401, { error: 'Invalid admission number/school ID or date of birth' });
      }
      const token = randomBytes(32).toString('hex');
      const user = { name: account[3], email: `${role.toLowerCase()}:${account[1].toLowerCase()}@dps.demo`, role, loginId: account[1] };
      state.sessions.set(token, { user, expiresAt: Date.now() + 86_400_000 });
      return send(res, 200, { token, user });
    }

    const user = signedInUser(req);
    if (!user) return send(res, 401, { error: 'Please sign in' });

    if (path === '/records' && req.method === 'GET') {
      const moduleName = String(req.query?.module || 'Homework');
      return send(res, 200, { records: state.records.filter((record) => record.module === moduleName).reverse() });
    }

    if (path === '/records' && req.method === 'POST') {
      if (!['TEACHER', 'ACCOUNTANT', 'ADMIN_STAFF', 'ADMINISTRATOR', 'SUPER_ADMIN'].includes(user.role)) {
        return send(res, 403, { error: 'Not permitted' });
      }
      const record = { id: state.nextId++, amount: 0, status: 'Active', ...req.body, owner_role: user.role };
      state.records.push(record);
      return send(res, 201, record);
    }

    const recordMatch = path.match(/^\/records\/(\d+)$/);
    if (recordMatch && req.method === 'DELETE') {
      if (!['ADMIN_STAFF', 'ADMINISTRATOR', 'SUPER_ADMIN'].includes(user.role)) return send(res, 403, { error: 'Not permitted' });
      const index = state.records.findIndex((record) => record.id === Number(recordMatch[1]));
      if (index >= 0) state.records.splice(index, 1);
      return send(res, 200, { ok: true });
    }

    if (path === '/homework' && req.method === 'POST') {
      if (!['TEACHER', 'ADMINISTRATOR', 'SUPER_ADMIN'].includes(user.role)) return send(res, 403, { error: 'Only teachers can publish homework' });
      const data = req.body || {};
      if (!data.title || !data.className || !data.subject || !data.due) return send(res, 400, { error: 'Class, subject, title and deadline are required' });
      let attachment = null;
      if (data.file) {
        const bytes = Buffer.from(data.file.data || '', 'base64');
        if (data.file.type !== 'application/pdf' || bytes.subarray(0, 4).toString() !== '%PDF') return send(res, 400, { error: 'Only valid PDF files are allowed' });
        if (bytes.length > 3_500_000) return send(res, 400, { error: 'PDF must be 3.5 MB or smaller on the hosted version' });
        attachment = { id: state.nextAttachmentId++, file_name: data.file.name || 'homework.pdf', size_bytes: bytes.length };
        state.attachments.set(attachment.id, { ...attachment, data: bytes });
      }
      const record = { id: state.nextId++, module: 'Homework', title: data.title, subtitle: `${data.className} · ${data.subject}${data.instructions ? ` · ${data.instructions}` : ''}`, status: 'Published', due_date: data.due, owner_role: 'STUDENT', ...(attachment ? { attachment_id: attachment.id, file_name: attachment.file_name, size_bytes: attachment.size_bytes } : {}) };
      state.records.push(record);
      return send(res, 201, { recordId: record.id, attachment });
    }

    const fileMatch = path.match(/^\/files\/(\d+)$/);
    if (fileMatch && req.method === 'GET') {
      const file = state.attachments.get(Number(fileMatch[1]));
      if (!file) return send(res, 404, { error: 'File not found' });
      res.status(200).setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${file.file_name.replace(/"/g, '')}"`);
      return res.send(file.data);
    }

    if (path === '/import' && req.method === 'POST') {
      if (!['ADMINISTRATOR', 'SUPER_ADMIN'].includes(user.role)) return send(res, 403, { error: 'Only administrators can import data' });
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      if (!rows.length || rows.length > 5000) return send(res, 400, { error: 'Import requires 1–5000 rows' });
      for (const row of rows) state.records.push({ id: state.nextId++, module: req.body.module, title: String(row.title || row.name || ''), subtitle: String(row.subtitle || row.details || row.class || ''), status: String(row.status || 'Active'), amount: Number(row.amount || 0), due_date: String(row.due_date || row.date || ''), owner_role: String(row.owner_role || 'ALL') });
      state.imports.unshift({ id: Date.now(), module: req.body.module, row_count: rows.length, created_at: new Date().toISOString() });
      return send(res, 201, { imported: rows.length, module: req.body.module });
    }

    if (path === '/imports' && req.method === 'GET') return send(res, 200, { imports: state.imports.slice(0, 20) });
    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    return send(res, 400, { error: error?.message || 'Server error' });
  }
}
