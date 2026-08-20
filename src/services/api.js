const wait=(data)=>new Promise(r=>setTimeout(()=>r(data),260));
export const schoolApi={notices:()=>wait([{title:'Unit Test II schedule published',date:'18 Aug'},{title:'Independence Day celebration',date:'15 Aug'},{title:'Parent–Teacher Meeting',date:'23 Aug'}]),events:()=>wait([{day:'22',month:'AUG',title:'Science & Innovation Expo',meta:'10:00 AM · Main Hall'},{day:'29',month:'AUG',title:'Inter-house Sports Meet',meta:'8:30 AM · School Ground'}])};

const API_BASE=(import.meta.env.VITE_API_BASE_URL||'/api').replace(/\/$/,'');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const request=async(path,options={})=>{
  const method=String(options.method||'GET').toUpperCase(),attempts=method==='GET'?2:1;
  for(let attempt=0;attempt<attempts;attempt+=1){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    let res;
    try{
      res=await fetch(`${API_BASE}${path}`,{...options,signal:controller.signal,credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})}});
    }catch(error){
      clearTimeout(timer);
      if(attempt+1<attempts){await pause(450);continue}
      throw new Error(error?.name==='AbortError'?'The module took too long to load. Please retry.':'Cannot connect to the school server. Please retry.');
    }
    clearTimeout(timer);
    if([429,502,503,504].includes(res.status)&&attempt+1<attempts){await res.text();await pause(450);continue}
    const type=res.headers.get('content-type')||'';
    if(!type.includes('application/json')){await res.text();if(res.status===413)throw new Error('The selected PDF is too large. Upload a file of 3 MB or smaller.');throw new Error(res.ok?'The school server returned an invalid response.':'The school server could not process this request. Please retry.')}
    const data=await res.json();
    if(res.status===401&&path!=='/auth/me')sessionStorage.removeItem('dps-user');
    if(!res.ok)throw new Error(data.error||'Request failed');
    return data;
  }
};

export const erpApi={me:()=>request('/auth/me'),logout:()=>request('/auth/logout',{method:'POST'}),records:module=>request(`/records?module=${encodeURIComponent(module)}`),create:data=>request('/records',{method:'POST',body:JSON.stringify(data)}),remove:id=>request(`/records/${id}`,{method:'DELETE'}),notices:()=>request('/notices'),publishNotice:data=>request('/notices',{method:'POST',body:JSON.stringify(data)}),import:(module,rows)=>request('/import',{method:'POST',body:JSON.stringify({module,rows})}),imports:()=>request('/imports'),attendance:filters=>request(`/attendance?${new URLSearchParams(filters||{})}`),saveAttendance:data=>request('/attendance',{method:'POST',body:JSON.stringify(data)}),examResults:filters=>request(`/exam-results?${new URLSearchParams(filters||{})}`),saveExamResults:data=>request('/exam-results',{method:'POST',body:JSON.stringify(data)}),fees:filters=>request(`/fees?${new URLSearchParams(filters||{})}`),saveFees:data=>request('/fees',{method:'POST',body:JSON.stringify(data)}),transferCertificates:filters=>request(`/transfer-certificates?${new URLSearchParams(filters||{})}`),uploadTransferCertificate:data=>request('/transfer-certificates',{method:'POST',body:JSON.stringify(data)}),characterCertificates:filters=>request(`/character-certificates?${new URLSearchParams(filters||{})}`),uploadCharacterCertificate:data=>request('/character-certificates',{method:'POST',body:JSON.stringify(data)}),publishHomework:data=>request('/homework',{method:'POST',body:JSON.stringify(data)}),download:async(id,name)=>{const res=await fetch(`${API_BASE}/files/${id}`,{credentials:'same-origin'});if(!res.ok)throw new Error('Download failed');const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download=name||'homework.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},downloadTransferCertificate:async(id,name)=>{const res=await fetch(`${API_BASE}/transfer-certificates/${id}/file`,{credentials:'same-origin'});if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||'TC download failed')}const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download=name||'transfer-certificate.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},downloadCharacterCertificate:async(id,name)=>{const res=await fetch(`${API_BASE}/character-certificates/${id}/file`,{credentials:'same-origin'});if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||'Character Certificate download failed')}const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download=name||'character-certificate.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}};
