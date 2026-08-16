import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const allowedWriters=['TEACHER','ACCOUNTANT','ADMIN_STAFF','ADMINISTRATOR','SUPER_ADMIN'];
const administrators=['ADMIN_STAFF','ADMINISTRATOR','SUPER_ADMIN'];

function send(res,status,value){res.status(status).setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');return res.send(JSON.stringify(value))}
function routePath(req){const pathname=new URL(req.url||'/','https://dps.local').pathname;return pathname.replace(/^\/api(?=\/|$)/,'')||'/'}
function tokenHash(token){return createHash('sha256').update(token).digest('hex')}
function db(){if(!process.env.DATABASE_URL)throw new Error('Database connection is not configured');return neon(process.env.DATABASE_URL)}
function schoolDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
async function currentUser(sql,req){const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token)return null;const rows=await sql`SELECT u.id,u.login_id,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() AND u.active=true`;return rows[0]||null}

export default async function handler(req,res){
  try{
    if(req.method==='OPTIONS')return send(res,204,{});
    const path=routePath(req),sql=db();
    if(path==='/health')return send(res,200,{ok:true,runtime:'vercel-serverless',database:'postgresql'});
    if(path==='/auth/login'&&req.method==='POST'){
      const rawRole=String(req.body?.role||'').toUpperCase(),[role,loginId='']=rawRole.split(':'),password=String(req.body?.password||'');
      const users=await sql`SELECT id,login_id,name,role FROM users WHERE role=${role} AND login_id=${loginId} AND active=true AND password_hash=crypt(${password},password_hash) LIMIT 1`;
      const user=users[0];if(!user)return send(res,401,{error:'Invalid admission number/school ID or date of birth'});
      const token=randomBytes(32).toString('hex');
      await sql`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(${tokenHash(token)},${user.id},now()+interval '1 day')`;
      return send(res,200,{token,user:{name:user.name,email:`${role.toLowerCase()}:${user.login_id.toLowerCase()}@dps.demo`,role:user.role,loginId:user.login_id}});
    }
    const user=await currentUser(sql,req);if(!user)return send(res,401,{error:'Please sign in again'});
    if(path==='/records'&&req.method==='GET'){
      const moduleName=String(req.query?.module||'Homework');
      if(moduleName==='Exams & Results'&&user.role==='STUDENT')return send(res,403,{error:'Use the private student results section'});
      if(moduleName==='Students'&&!['TEACHER','ACCOUNTANT','ADMIN_STAFF','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Student directory access is restricted'});
      const rows=await sql`SELECT r.id,r.module,r.title,r.subtitle,r.status,r.amount,r.due_date,r.owner_role,a.id attachment_id,a.file_name,a.size_bytes FROM records r LEFT JOIN attachments a ON a.record_id=r.id WHERE r.module=${moduleName} ORDER BY r.created_at DESC`;
      return send(res,200,{records:rows});
    }
    if(path==='/attendance'&&req.method==='GET'){
      if(user.role==='STUDENT'){
        const rows=await sql`SELECT a.id,a.attendance_date,a.class_name,a.subject,a.status,a.updated_at,t.name teacher_name FROM student_attendance a LEFT JOIN users t ON t.id=a.teacher_id WHERE a.student_id=${user.id} ORDER BY a.attendance_date DESC`;
        return send(res,200,{attendance:rows,serverDate:schoolDate()});
      }
      if(!['TEACHER','ADMIN_STAFF','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Attendance records are restricted'});
      const className=String(req.query?.className||''),date=String(req.query?.date||'');
      const rows=await sql`SELECT a.id,u.login_id admission_id,u.name student_name,a.attendance_date,a.class_name,a.subject,a.status,a.updated_at,t.name teacher_name FROM student_attendance a JOIN users u ON u.id=a.student_id LEFT JOIN users t ON t.id=a.teacher_id WHERE (${className}='' OR a.class_name=${className}) AND (${date}='' OR a.attendance_date=${date||null}::date) ORDER BY u.name`;
      return send(res,200,{attendance:rows,serverDate:schoolDate()});
    }
    if(path==='/attendance'&&req.method==='POST'){
      if(!['TEACHER','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Only teachers can submit attendance'});
      const d=req.body||{},className=String(d.className||'').trim(),date=String(d.date||''),subject=String(d.subject||'School Day').trim(),entries=Array.isArray(d.entries)?d.entries:[];
      if(!className||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`))||!subject||!entries.length||entries.length>200)return send(res,400,{error:'Class, date, subject and student attendance are required'});
      const clean=entries.map(entry=>({login_id:String(entry.admissionId||'').trim(),status:String(entry.status||'')}));
      if(new Set(clean.map(entry=>entry.login_id)).size!==clean.length||clean.some(entry=>!entry.login_id||!['Present','Absent','Late'].includes(entry.status)))return send(res,400,{error:'Every student must have one valid attendance status'});
      const ids=clean.map(entry=>entry.login_id),matched=await sql`SELECT count(*)::int count FROM users WHERE role='STUDENT' AND active=true AND login_id=ANY(${ids})`;
      if(Number(matched[0]?.count)!==clean.length)return send(res,400,{error:'One or more student admission numbers are invalid'});
      const rows=await sql`WITH input AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(clean)}::jsonb) AS x(login_id text,status text)) INSERT INTO student_attendance(student_id,attendance_date,class_name,subject,status,teacher_id) SELECT u.id,${date}::date,${className},${subject},i.status,${user.id} FROM input i JOIN users u ON u.role='STUDENT' AND u.active=true AND u.login_id=i.login_id ON CONFLICT(student_id,attendance_date) DO UPDATE SET class_name=EXCLUDED.class_name,subject=EXCLUDED.subject,status=EXCLUDED.status,teacher_id=EXCLUDED.teacher_id,updated_at=now() RETURNING id`;
      return send(res,200,{saved:rows.length,date});
    }
    if(path==='/exam-results'&&req.method==='GET'){
      if(user.role==='STUDENT'){
        const rows=await sql`SELECT e.id,e.class_name,e.exam_name,e.subject,e.marks,e.max_marks,e.status,e.updated_at,t.name teacher_name FROM exam_results e LEFT JOIN users t ON t.id=e.teacher_id WHERE e.student_id=${user.id} AND e.status='Published' ORDER BY e.updated_at DESC`;
        return send(res,200,{results:rows});
      }
      if(!['TEACHER','ADMIN_STAFF','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Not permitted'});
      const className=String(req.query?.className||''),examName=String(req.query?.examName||''),subject=String(req.query?.subject||'');
      const rows=await sql`SELECT e.id,u.login_id admission_id,u.name student_name,e.class_name,e.exam_name,e.subject,e.marks,e.max_marks,e.status,e.updated_at FROM exam_results e JOIN users u ON u.id=e.student_id WHERE (${className}='' OR e.class_name=${className}) AND (${examName}='' OR e.exam_name=${examName}) AND (${subject}='' OR e.subject=${subject}) ORDER BY u.name`;
      return send(res,200,{results:rows});
    }
    if(path==='/exam-results'&&req.method==='POST'){
      if(!['TEACHER','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Only teachers can upload marks'});
      const d=req.body||{},className=String(d.className||'').trim(),examName=String(d.examName||'').trim(),subject=String(d.subject||'').trim(),maxMarks=Number(d.maxMarks),status=d.status==='Published'?'Published':'Draft',results=Array.isArray(d.results)?d.results:[];
      if(!className||!examName||!subject||!Number.isFinite(maxMarks)||maxMarks<=0||!results.length||results.length>200)return send(res,400,{error:'Class, exam, subject, maximum marks and student marks are required'});
      const clean=results.map(r=>({login_id:String(r.admissionId||'').trim(),marks:Number(r.marks)}));
      if(clean.some(r=>!r.login_id||!Number.isFinite(r.marks)||r.marks<0||r.marks>maxMarks))return send(res,400,{error:'Every mark must be between zero and the maximum marks'});
      const ids=clean.map(r=>r.login_id),matched=await sql`SELECT count(*)::int count FROM users WHERE role='STUDENT' AND active=true AND login_id=ANY(${ids})`;
      if(Number(matched[0]?.count)!==clean.length)return send(res,400,{error:'One or more student admission numbers are invalid'});
      const rows=await sql`WITH input AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(clean)}::jsonb) AS x(login_id text,marks numeric)) INSERT INTO exam_results(student_id,class_name,exam_name,subject,marks,max_marks,status,teacher_id) SELECT u.id,${className},${examName},${subject},i.marks,${maxMarks},${status},${user.id} FROM input i JOIN users u ON u.role='STUDENT' AND u.login_id=i.login_id ON CONFLICT(student_id,class_name,exam_name,subject) DO UPDATE SET marks=EXCLUDED.marks,max_marks=EXCLUDED.max_marks,status=EXCLUDED.status,teacher_id=EXCLUDED.teacher_id,updated_at=now() RETURNING id`;
      return send(res,200,{saved:rows.length,status});
    }
    if(path==='/fees'&&req.method==='GET'){
      if(user.role==='STUDENT'){
        const rows=await sql`SELECT id,class_name,fee_month,amount_due,amount_paid,(amount_due-amount_paid) balance,paid_on,updated_at FROM student_fees WHERE student_id=${user.id} ORDER BY fee_month`;
        return send(res,200,{fees:rows});
      }
      if(!['ACCOUNTANT','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Fee records are restricted'});
      const className=String(req.query?.className||''),month=String(req.query?.month||'');
      const rows=await sql`SELECT f.id,u.login_id admission_id,u.name student_name,f.class_name,f.fee_month,f.amount_due,f.amount_paid,(f.amount_due-f.amount_paid) balance,f.paid_on,f.updated_at FROM student_fees f JOIN users u ON u.id=f.student_id WHERE (${className}='' OR f.class_name=${className}) AND (${month}='' OR f.fee_month=(${month}||'-01')::date) ORDER BY u.name`;
      return send(res,200,{fees:rows});
    }
    if(path==='/fees'&&req.method==='POST'){
      if(!['ACCOUNTANT','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Only accountants can save monthly fees'});
      const d=req.body||{},className=String(d.className||'').trim(),month=String(d.month||''),entries=Array.isArray(d.entries)?d.entries:[];
      if(!className||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!entries.length||entries.length>200)return send(res,400,{error:'Class, month and at least one student fee are required'});
      const clean=entries.map(entry=>({login_id:String(entry.admissionId||'').trim(),amount_due:Number(entry.amountDue),amount_paid:Number(entry.amountPaid||0)}));
      if(new Set(clean.map(entry=>entry.login_id)).size!==clean.length||clean.some(entry=>!entry.login_id||!Number.isFinite(entry.amount_due)||entry.amount_due<=0||!Number.isFinite(entry.amount_paid)||entry.amount_paid<0||entry.amount_paid>entry.amount_due))return send(res,400,{error:'Each fee must have a valid student, positive due amount and paid amount within the due total'});
      const ids=clean.map(entry=>entry.login_id),matched=await sql`SELECT count(*)::int count FROM users WHERE role='STUDENT' AND active=true AND login_id=ANY(${ids})`;
      if(Number(matched[0]?.count)!==clean.length)return send(res,400,{error:'One or more student admission numbers are invalid'});
      const rows=await sql`WITH input AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(clean)}::jsonb) AS x(login_id text,amount_due numeric,amount_paid numeric)) INSERT INTO student_fees(student_id,class_name,fee_month,amount_due,amount_paid,accountant_id,paid_on) SELECT u.id,${className},(${month}||'-01')::date,i.amount_due,i.amount_paid,${user.id},CASE WHEN i.amount_paid>0 THEN current_date ELSE NULL END FROM input i JOIN users u ON u.role='STUDENT' AND u.active=true AND u.login_id=i.login_id ON CONFLICT(student_id,fee_month) DO UPDATE SET class_name=EXCLUDED.class_name,amount_due=EXCLUDED.amount_due,amount_paid=EXCLUDED.amount_paid,accountant_id=EXCLUDED.accountant_id,paid_on=EXCLUDED.paid_on,updated_at=now() RETURNING id`;
      return send(res,200,{saved:rows.length,month});
    }
    if(path==='/transfer-certificates'&&req.method==='GET'){
      if(user.role==='STUDENT'){
        const rows=await sql`SELECT id,class_name,file_name,size_bytes,created_at,updated_at FROM student_transfer_certificates WHERE student_id=${user.id} ORDER BY updated_at DESC`;
        return send(res,200,{certificates:rows});
      }
      if(!['ACCOUNTANT','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Transfer certificates are restricted'});
      const className=String(req.query?.className||'');
      const rows=await sql`SELECT c.id,u.login_id admission_id,u.name student_name,c.class_name,c.file_name,c.size_bytes,c.created_at,c.updated_at FROM student_transfer_certificates c JOIN users u ON u.id=c.student_id WHERE (${className}='' OR c.class_name=${className}) ORDER BY u.name`;
      return send(res,200,{certificates:rows});
    }
    if(path==='/transfer-certificates'&&req.method==='POST'){
      if(!['ACCOUNTANT','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Only authorised accounts staff can upload transfer certificates'});
      const d=req.body||{},className=String(d.className||'').trim(),admissionId=String(d.admissionId||'').trim(),file=d.file||{},fileName=String(file.name||'transfer-certificate.pdf').replace(/[^a-zA-Z0-9._ -]/g,'_'),bytes=Buffer.from(String(file.data||''),'base64');
      if(!className||!admissionId||!file.data)return send(res,400,{error:'Class, student and TC PDF are required'});
      if(bytes.subarray(0,5).toString()!=='%PDF-'||bytes.length>3*1024*1024)return send(res,400,{error:'Please upload a valid TC PDF of 3 MB or smaller'});
      const students=await sql`SELECT id FROM users WHERE role='STUDENT' AND active=true AND login_id=${admissionId} LIMIT 1`,student=students[0];
      if(!student)return send(res,400,{error:'Student admission number is invalid'});
      const rows=await sql`INSERT INTO student_transfer_certificates(student_id,class_name,file_name,mime_type,size_bytes,content,uploaded_by) VALUES(${student.id},${className},${fileName},'application/pdf',${bytes.length},${bytes},${user.id}) ON CONFLICT(student_id) DO UPDATE SET class_name=EXCLUDED.class_name,file_name=EXCLUDED.file_name,mime_type=EXCLUDED.mime_type,size_bytes=EXCLUDED.size_bytes,content=EXCLUDED.content,uploaded_by=EXCLUDED.uploaded_by,updated_at=now() RETURNING id,file_name,size_bytes,updated_at`;
      return send(res,200,{certificate:rows[0]});
    }
    const certificateFileMatch=path.match(/^\/transfer-certificates\/(\d+)\/file$/);
    if(certificateFileMatch&&req.method==='GET'){
      const rows=user.role==='STUDENT'?await sql`SELECT file_name,mime_type,size_bytes,content FROM student_transfer_certificates WHERE id=${Number(certificateFileMatch[1])} AND student_id=${user.id}`:['ACCOUNTANT','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role)?await sql`SELECT file_name,mime_type,size_bytes,content FROM student_transfer_certificates WHERE id=${Number(certificateFileMatch[1])}`:[];
      const file=rows[0];if(!file)return send(res,404,{error:'Transfer certificate not found'});
      res.status(200).setHeader('Content-Type','application/pdf');res.setHeader('Content-Length',String(file.size_bytes));res.setHeader('Content-Disposition',`attachment; filename="${file.file_name.replace(/"/g,'')}"`);return res.send(Buffer.from(file.content));
    }
    if(path==='/records'&&req.method==='POST'){
      if(!allowedWriters.includes(user.role))return send(res,403,{error:'Not permitted'});const d=req.body||{},title=String(d.title||'').trim();if(!title)return send(res,400,{error:'Title is required'});
      const rows=await sql`INSERT INTO records(module,title,subtitle,status,amount,due_date,owner_role) VALUES(${String(d.module||'')},${title},${String(d.subtitle||'')},${String(d.status||'Active')},${Number(d.amount||0)},${d.due_date||null},${user.role}) RETURNING *`;
      return send(res,201,rows[0]);
    }
    const recordMatch=path.match(/^\/records\/(\d+)$/);
    if(recordMatch&&req.method==='DELETE'){if(!administrators.includes(user.role))return send(res,403,{error:'Not permitted'});await sql`DELETE FROM records WHERE id=${Number(recordMatch[1])}`;return send(res,200,{ok:true})}
    if(path==='/homework'&&req.method==='POST'){
      if(!['TEACHER','ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Only teachers can publish homework'});const d=req.body||{};if(!d.title||!d.className||!d.subject||!d.due)return send(res,400,{error:'Class, subject, title and deadline are required'});
      const moduleName=d.module==='Assignments'?'Assignments':'Homework',subtitle=`${d.className} · ${d.subject}${d.instructions?` · ${d.instructions}`:''}`;
      let bytes=null,fileName=null;if(d.file){bytes=Buffer.from(d.file.data||'','base64');fileName=String(d.file.name||'resource.pdf').replace(/[^a-zA-Z0-9._ -]/g,'_');if(bytes.subarray(0,5).toString()!=='%PDF-'||bytes.length>3*1024*1024)return send(res,400,{error:'Please upload a valid PDF file of 3 MB or smaller'})}
      const records=await sql`INSERT INTO records(module,title,subtitle,status,due_date,owner_role) VALUES(${moduleName},${String(d.title)},${subtitle},'Published',${d.due},'STUDENT') RETURNING id`;
      let attachment=null;if(bytes){const rows=await sql`INSERT INTO attachments(record_id,file_name,mime_type,size_bytes,content) VALUES(${records[0].id},${fileName},'application/pdf',${bytes.length},${bytes}) RETURNING id,file_name,size_bytes`;attachment=rows[0]}
      return send(res,201,{recordId:records[0].id,attachment});
    }
    const fileMatch=path.match(/^\/files\/(\d+)$/);
    if(fileMatch&&req.method==='GET'){const rows=await sql`SELECT file_name,mime_type,size_bytes,content FROM attachments WHERE id=${Number(fileMatch[1])}`;const file=rows[0];if(!file)return send(res,404,{error:'File not found'});res.status(200).setHeader('Content-Type',file.mime_type);res.setHeader('Content-Disposition',`attachment; filename="${file.file_name.replace(/"/g,'')}"`);return res.send(Buffer.from(file.content))}
    if(path==='/import'&&req.method==='POST'){if(!['ADMINISTRATOR','SUPER_ADMIN'].includes(user.role))return send(res,403,{error:'Only administrators can import data'});const d=req.body||{},rows=Array.isArray(d.rows)?d.rows:[];if(!rows.length||rows.length>5000)return send(res,400,{error:'Import requires 1–5000 rows'});for(const row of rows){const title=String(row.title||row.name||'').trim();if(!title)throw new Error('Every row needs a title or name');await sql`INSERT INTO records(module,title,subtitle,status,amount,due_date,owner_role) VALUES(${String(d.module)},${title},${String(row.subtitle||row.details||row.class||'')},${String(row.status||'Active')},${Number(row.amount||0)},${row.due_date||row.date||null},${String(row.owner_role||'ALL')}`};await sql`INSERT INTO import_batches(module,row_count,imported_by) VALUES(${String(d.module)},${rows.length},${user.id})`;return send(res,201,{imported:rows.length,module:d.module})}
    if(path==='/imports'&&req.method==='GET'){const rows=await sql`SELECT id,module,row_count,created_at FROM import_batches ORDER BY id DESC LIMIT 20`;return send(res,200,{imports:rows})}
    return send(res,404,{error:'Not found'});
  }catch(error){console.error('[api]',error);return send(res,500,{error:'Server error'})}
}
