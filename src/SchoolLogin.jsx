import{useEffect,useState}from'react';
import{useNavigate}from'react-router-dom';
import{GraduationCap,Presentation,Calculator,ShieldCheck,Sparkles,X}from'lucide-react';
import{loginWithSchoolId}from'./services/loginApi';

const IMG='/dps-logo.jpeg';
const roles=[
  {key:'STUDENT',name:'Student',hint:'Admission number',icon:GraduationCap},
  {key:'TEACHER',name:'Teacher',hint:'Teacher ID',icon:Presentation},
  {key:'ACCOUNTANT',name:'Accountant',hint:'Teacher ID',icon:Calculator},
  {key:'ADMINISTRATOR',name:'Administration',hint:'Teacher ID',icon:ShieldCheck},
];
const adminRoles={ADMIN_STAFF:'Administrative Staff',ADMINISTRATOR:'Administrator',SUPER_ADMIN:'Super Administrator'};
const ids={STUDENT:'',TEACHER:'',ACCOUNTANT:'',ADMIN_STAFF:'',ADMINISTRATOR:'',SUPER_ADMIN:''};
const dobs={STUDENT:'',TEACHER:'',ACCOUNTANT:'',ADMIN_STAFF:'',ADMINISTRATOR:'',SUPER_ADMIN:''};

export default function SchoolLogin(){
  const[role,setRole]=useState('STUDENT'),[loginId,setLoginId]=useState(ids.STUDENT),[dob,setDob]=useState(dobs.STUDENT),[error,setError]=useState(''),[busy,setBusy]=useState(false),[showMotivation,setShowMotivation]=useState(true),nav=useNavigate();
  useEffect(()=>{const timer=setTimeout(()=>setShowMotivation(false),7000);return()=>clearTimeout(timer)},[]);
  function change(v){setRole(v);setLoginId(ids[v]);setDob(dobs[v]);setError('')}
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const d=await loginWithSchoolId(role,loginId,dob);sessionStorage.removeItem('dps-token');sessionStorage.setItem('dps-user',JSON.stringify(d.user));nav('/erp')}catch(e){setError(e.message)}finally{setBusy(false)}}
  const selected=roles.find(item=>item.key===role)||roles[3],isAdmin=Object.hasOwn(adminRoles,role),SelectedIcon=selected.icon;
  return <main className="login rolelogin">
    {showMotivation?<aside className="motivationpop" role="status" aria-live="polite"><span aria-hidden="true"><Sparkles/></span><div><small>A little reminder</small><strong>Every login is a new chance to learn, grow and shine! ✨</strong></div><button type="button" aria-label="Close motivational message" onClick={()=>setShowMotivation(false)}><X/></button></aside>:null}
    <div className="loginbrand"><a href="/">← Back to website</a><img src={IMG}/><span className="kicker lighttxt">Secure school access</span><h1>Choose your <em>school portal.</em></h1><p>Separate, secure access for every member of the DPS community.</p><a className="fwdcredit" href="https://www.wetakefwd.online" target="_blank" rel="noopener noreferrer" aria-label="Created and designed by WeTakeFwd"><span className="fwdmark" aria-hidden="true"><i/><i/><i/></span><span><b>WE TAKE<br/>FWD</b><small>Created and designed by WeTakeFwd</small><strong>www.wetakefwd.online</strong></span></a></div>
    <section className="loginpanel">
      <div className="portalhead"><img src={IMG}/><div><h2>Welcome back</h2><p>Select your portal to continue</p></div></div>
      <div className="rolecards" role="tablist" aria-label="Choose login portal">{roles.map(({key,name,hint,icon:Icon},index)=><button type="button" key={key} role="tab" aria-selected={(key===role)||(key==='ADMINISTRATOR'&&isAdmin)} className={`rolecard ${(key===role)||(key==='ADMINISTRATOR'&&isAdmin)?'active':''}`} style={{'--delay':`${index*70}ms`}} onClick={()=>change(key)}><span><Icon/></span><strong>{name}</strong><small>{hint}</small></button>)}</div>
      <form className="portalform" onSubmit={submit}>
        <div className="selectedportal"><SelectedIcon/><span><small>Signing in as</small><b>{isAdmin?'Administration':selected.name}</b></span></div>
        {isAdmin&&<label>Administration role<select value={role} onChange={e=>change(e.target.value)}>{Object.entries(adminRoles).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>}
        <label>{role==='STUDENT'?'Admission Number':'Teacher ID'}<input value={loginId} onChange={e=>setLoginId(e.target.value.toUpperCase())} required autoComplete="username" placeholder={role==='STUDENT'?'Enter your admission number':'Enter your assigned teacher ID'}/></label>
        <label>Registered Date of Birth<input value={dob} onChange={e=>setDob(e.target.value)} required type="date" autoComplete="bday"/></label>
        {error&&<p className="formerror" role="alert">{error}</p>}
        <button disabled={busy} className="btn full">{busy?'Verifying…':`Continue as ${isAdmin?'Administration':selected.name}`}</button>
        <p className="demo">{role==='STUDENT'?'Only the student’s registered Admission Number and Date of Birth can open this portal.':isAdmin?'Enter the Teacher ID assigned to your administration role and registered DOB.':'Enter your assigned Teacher ID and registered DOB.'}</p>
      </form>
      <a className="fwdcredit mobilefwd" href="https://www.wetakefwd.online" target="_blank" rel="noopener noreferrer" aria-label="Created and designed by WeTakeFwd"><span className="fwdmark" aria-hidden="true"><i/><i/><i/></span><span><b>WE TAKE<br/>FWD</b><small>Created and designed by WeTakeFwd</small><strong>www.wetakefwd.online</strong></span></a>
    </section>
  </main>
}
