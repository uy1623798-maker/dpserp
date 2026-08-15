import{useState}from'react';
import{useNavigate}from'react-router-dom';
import{GraduationCap,Presentation,Calculator,ShieldCheck}from'lucide-react';
import{loginWithSchoolId}from'./services/loginApi';

const IMG='/dps-logo.jpeg';
const roles=[
  {key:'STUDENT',name:'Student',hint:'Admission number',icon:GraduationCap},
  {key:'TEACHER',name:'Teacher',hint:'Teacher ID',icon:Presentation},
  {key:'ACCOUNTANT',name:'Accountant',hint:'Accountant ID',icon:Calculator},
  {key:'ADMINISTRATOR',name:'Administration',hint:'Staff ID',icon:ShieldCheck},
];
const adminRoles={ADMIN_STAFF:'Administrative Staff',ADMINISTRATOR:'Administrator',SUPER_ADMIN:'Super Administrator'};
const ids={STUDENT:'DPS202601',TEACHER:'DPST001',ACCOUNTANT:'DPSA001',ADMIN_STAFF:'DPSS001',ADMINISTRATOR:'DPSADM001',SUPER_ADMIN:'DPSSA001'};
const dobs={STUDENT:'2010-04-15',TEACHER:'1985-01-15',ACCOUNTANT:'1988-06-20',ADMIN_STAFF:'1990-02-10',ADMINISTRATOR:'1982-09-05',SUPER_ADMIN:'1980-01-01'};

export default function SchoolLogin(){
  const[role,setRole]=useState('STUDENT'),[loginId,setLoginId]=useState(ids.STUDENT),[dob,setDob]=useState(dobs.STUDENT),[error,setError]=useState(''),[busy,setBusy]=useState(false),nav=useNavigate();
  function change(v){setRole(v);setLoginId(ids[v]);setDob(dobs[v]);setError('')}
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const d=await loginWithSchoolId(role,loginId,dob);sessionStorage.setItem('dps-token',d.token);sessionStorage.setItem('dps-user',JSON.stringify(d.user));nav('/erp')}catch(e){setError(e.message)}finally{setBusy(false)}}
  const selected=roles.find(item=>item.key===role)||roles[3],isAdmin=Object.hasOwn(adminRoles,role),SelectedIcon=selected.icon;
  return <main className="login rolelogin">
    <div className="loginbrand"><a href="/">← Back to website</a><img src={IMG}/><span className="kicker lighttxt">Secure school access</span><h1>Choose your <em>school portal.</em></h1><p>Separate, secure access for every member of the DPS community.</p></div>
    <section className="loginpanel">
      <div className="portalhead"><img src={IMG}/><div><h2>Welcome back</h2><p>Select your portal to continue</p></div></div>
      <div className="rolecards" role="tablist" aria-label="Choose login portal">{roles.map(({key,name,hint,icon:Icon},index)=><button type="button" key={key} role="tab" aria-selected={(key===role)||(key==='ADMINISTRATOR'&&isAdmin)} className={`rolecard ${(key===role)||(key==='ADMINISTRATOR'&&isAdmin)?'active':''}`} style={{'--delay':`${index*70}ms`}} onClick={()=>change(key)}><span><Icon/></span><strong>{name}</strong><small>{hint}</small></button>)}</div>
      <form className="portalform" onSubmit={submit}>
        <div className="selectedportal"><SelectedIcon/><span><small>Signing in as</small><b>{isAdmin?'Administration':selected.name}</b></span></div>
        {isAdmin&&<label>Administration role<select value={role} onChange={e=>change(e.target.value)}>{Object.entries(adminRoles).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>}
        <label>{role==='STUDENT'?'Username (Admission Number)':role==='TEACHER'?'Username (Teacher ID)':'Username (School Staff ID)'}<input value={loginId} onChange={e=>setLoginId(e.target.value.toUpperCase())} required autoComplete="username"/></label>
        <label>Password (Date of Birth)<input value={dob} onChange={e=>setDob(e.target.value)} required type="date" autoComplete="bday"/></label>
        {error&&<p className="formerror" role="alert">{error}</p>}
        <button disabled={busy} className="btn full">{busy?'Verifying…':`Continue as ${isAdmin?'Administration':selected.name}`}</button>
        <p className="demo">Student login: Admission Number as username and registered DOB as password.</p>
      </form>
    </section>
  </main>
}
