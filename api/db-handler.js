import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const allowedWriters=['TEACHER','ACCOUNTANT','ADMIN_STAFF','ADMINISTRATOR','SUPER_ADMIN'];
const administrators=['ADMIN_STAFF','ADMINISTRATOR','SUPER_ADMIN'];

function send(res,status,value){res.status(status).setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');return res.send(JSON.stringify(value))}
function routePath(req){const pathname=new URL(req.url||'/','https://dps.local').pathname;return pathname.replace(/^\/api(?=\/|$)/,'')||'/'}
function tokenHash(token){return createHash('sha256').update(token).digest('hex')}
function db(){if(!process.env.DATABASE_URL)throw new Error('Database connection is not configured');return neon(process.env.DATABASE_URL)}
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
      const rows=await sql`SELECT r.id,r.module,r.title,r.subtitle,r.status,r.amount,r.due_date,r.owner_role,a.id attachment_id,a.file_name,a.size_bytes FROM records r LEFT JOIN attachments a ON a.record_id=r.id WHERE r.module=${moduleName} ORDER BY r.created_at DESC`;
      return send(res,200,{records:rows});
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
