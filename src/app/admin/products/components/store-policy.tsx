'use client';
import { useEffect, useState } from 'react';
import axios from '@/lib/axios';
type Policy = {published:boolean;online_purchase:boolean;contact_enabled:boolean};
const labels: [keyof Policy,string][] = [['published','แสดงบนหน้าร้าน'],['online_purchase','อนุญาตซื้อออนไลน์'],['contact_enabled','อนุญาตติดต่อกลับ']];
export default function StorePolicy({id,editable}:{id:string;editable:boolean}) {
 const [policy,setPolicy]=useState<Policy|null>(null);
 const [pending,setPending]=useState(false);
 const [message,setMessage]=useState('');
 const [reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setPolicy(null);setMessage('');
  axios.get<Policy>(`/product/${id}/store-policy`).then(r=>{if(active)setPolicy(r.data);})
   .catch(()=>{if(active)setMessage('โหลดการตั้งค่าไม่สำเร็จ');});
  return ()=>{active=false;};
 },[id,reload]);
 async function toggle(key:keyof Policy,value:boolean){
  setPending(true);setMessage('');
  try {const r=await axios.patch<Policy>(`/product/${id}/store-policy`,{[key]:value});setPolicy(r.data);setMessage('บันทึกแล้ว');}
  catch {setMessage('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');}
  finally{setPending(false);}
 }
 return <fieldset aria-busy={pending} className="min-w-48 space-y-2 text-sm">
  <legend className="sr-only">ช่องทางหน้าร้าน</legend>
  {policy?labels.map(([key,label])=><label key={key} className="flex min-h-11 items-center gap-2 text-[var(--color-text-primary)]">
    <input type="checkbox" disabled={!editable||pending} checked={policy[key]} onChange={e=>void toggle(key,e.target.checked)} />{label}
   </label>):!message&&<span>กำลังโหลดการตั้งค่า</span>}
  <p role="status" aria-live="polite">{pending?'กำลังบันทึก…':message}</p>
  {!policy && message && <button type="button" onClick={()=>setReload(n=>n+1)}>ลองใหม่</button>}
 </fieldset>;
}
