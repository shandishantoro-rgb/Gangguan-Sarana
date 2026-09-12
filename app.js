const proyekKosong = () => ({ format: "TTC-Project", versi: 1, namaProyek: "Proyek TTC", stasiun: [], petakJalan: [] });
let proyek = proyekKosong();
let selectedStation = null;
let selectedPetak = null;
let toastTimer = null;

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function now(){return new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
function log(message, level="INFO"){
  const row=document.createElement("div"); row.className=`log-entry ${level.toLowerCase()}`;
  row.innerHTML=`<span class="time">${now()}</span><span class="level">${esc(level)}</span><span>${esc(message)}</span>`;
  $("log-list").prepend(row);
  while($("log-list").children.length>10) $("log-list").lastElementChild.remove();
}
function toast(message,error=false){const t=$("toast");t.textContent=message;t.classList.toggle("error",error);t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600)}
function setStatus(message){$("status-text").innerHTML=`<span class="status-dot"></span> ${esc(message)}`}
function formatKm(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString("id-ID",{minimumFractionDigits:0,maximumFractionDigits:3}):"—"}

function renderAll(){renderSummary();renderStationTable();renderPetakTable();renderNetwork();renderSelectors();renderProperties();}
function renderSummary(){
  const sc=proyek.stasiun.length, pc=proyek.petakJalan.length;
  $("jumlah-stasiun").textContent=sc; $("jumlah-petak").textContent=pc; $("badge-network").textContent=sc+pc;
  $("status-counts").textContent=`${sc} stasiun · ${pc} petak`;
  $("toolbar-nama-proyek").textContent=proyek.namaProyek||"Proyek TTC";
  $("nama-proyek").value=proyek.namaProyek||"Proyek TTC";
  $("map-subtitle").textContent=sc?`${sc} stasiun · ${pc} Petak Jalan`:`Belum ada stasiun. Tambahkan data atau muat contoh.`;
}
function renderStationTable(){
  const body=$("tabel-stasiun"); body.innerHTML=""; $("empty-stasiun").classList.toggle("hidden",proyek.stasiun.length>0);
  proyek.stasiun.forEach((s)=>{const tr=document.createElement("tr");tr.dataset.kode=s.kode;if(s.kode===selectedStation)tr.classList.add("selected");tr.innerHTML=`<td><b>${esc(s.kode)}</b></td><td>${esc(s.nama)}</td><td>${formatKm(s.km)}</td><td>${esc(s.jumlahJalur)}</td><td>${esc(s.jenis)}</td><td><span class="status-pill">Aktif</span></td>`;tr.addEventListener("click",()=>selectStation(s.kode));body.appendChild(tr)})
}
function renderPetakTable(){
  const body=$("tabel-petak"); body.innerHTML=""; $("empty-petak").classList.toggle("hidden",proyek.petakJalan.length>0);
  proyek.petakJalan.forEach((p,i)=>{const tr=document.createElement("tr");tr.dataset.index=i;if(i===selectedPetak)tr.classList.add("selected");tr.innerHTML=`<td><b>${esc(p.dari)}</b></td><td><b>${esc(p.ke)}</b></td><td>${formatKm(p.jarak)} km</td><td>${esc(p.jenisJalur)}</td><td>${esc(p.kecepatanMaks)} km/jam</td><td><span class="status-pill">Aktif</span></td>`;tr.addEventListener("click",()=>selectPetak(i));body.appendChild(tr)})
}
function renderSelectors(){
  const opts=proyek.stasiun.map(s=>`<option value="${esc(s.kode)}">${esc(s.kode)} — ${esc(s.nama)}</option>`).join("");
  $("petak-dari").innerHTML='<option value="">Pilih stasiun</option>'+opts; $("petak-ke").innerHTML='<option value="">Pilih stasiun</option>'+opts;
}
function renderNetwork(){
  const svg=$("network-svg");svg.innerHTML="";$("empty-map").classList.toggle("hidden",proyek.stasiun.length>0);
  if(!proyek.stasiun.length){$("scale-end").textContent="— km";return}
  const ordered=[...proyek.stasiun].sort((a,b)=>Number(a.km)-Number(b.km));
  const min=Math.min(...ordered.map(s=>Number(s.km)||0)),max=Math.max(...ordered.map(s=>Number(s.km)||0)); const span=Math.max(max-min,1);
  const pos={}; ordered.forEach((s,i)=>{const x=100+((Number(s.km)-min)/span)*800; const y=230+((i%2===0?1:-1)*(ordered.length>7?12:0));pos[s.kode]={x,y,s}});
  proyek.petakJalan.forEach((p,i)=>{const a=pos[p.dari],b=pos[p.ke];if(!a||!b)return;const cls=p.jenisJalur==="Ganda"?"track-double":"track-single";const base=document.createElementNS("http://www.w3.org/2000/svg","line");base.setAttribute("x1",a.x);base.setAttribute("y1",a.y);base.setAttribute("x2",b.x);base.setAttribute("y2",b.y);base.setAttribute("class",cls);svg.appendChild(base);if(p.jenisJalur==="Ganda"){const thin=base.cloneNode();thin.setAttribute("class","track-main");svg.appendChild(thin)}const hit=base.cloneNode();hit.setAttribute("class","petak-hit");hit.addEventListener("click",()=>selectPetak(i));svg.appendChild(hit);const hover=base.cloneNode();hover.setAttribute("class","petak-hover");svg.appendChild(hover)});
  if(!proyek.petakJalan.length&&ordered.length>1){for(let i=0;i<ordered.length-1;i++){const a=pos[ordered[i].kode],b=pos[ordered[i+1].kode];const l=document.createElementNS("http://www.w3.org/2000/svg","line");Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:"track-single"}).forEach(([k,v])=>l.setAttribute(k,v));l.setAttribute("opacity",".28");svg.appendChild(l)}}
  ordered.forEach((s)=>{const {x,y}=pos[s.kode];const g=document.createElementNS("http://www.w3.org/2000/svg","g");const c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("cx",x);c.setAttribute("cy",y);c.setAttribute("r",s.kode===selectedStation?10:8);c.setAttribute("class",`station-node${s.kode===selectedStation?" selected":""}`);c.addEventListener("click",()=>selectStation(s.kode));g.appendChild(c);const name=document.createElementNS("http://www.w3.org/2000/svg","text");name.setAttribute("x",x);name.setAttribute("y",y-30);name.setAttribute("text-anchor","middle");name.setAttribute("class","station-label");name.textContent=s.nama;g.appendChild(name);const code=document.createElementNS("http://www.w3.org/2000/svg","text");code.setAttribute("x",x);code.setAttribute("y",y-14);code.setAttribute("text-anchor","middle");code.setAttribute("class","station-code");code.textContent=`(${s.kode})`;g.appendChild(code);const km=document.createElementNS("http://www.w3.org/2000/svg","text");km.setAttribute("x",x);km.setAttribute("y",y+27);km.setAttribute("text-anchor","middle");km.setAttribute("class","station-km");km.textContent=`km ${formatKm(s.km)}`;g.appendChild(km);svg.appendChild(g)});
  $("scale-end").textContent=`${formatKm(max-min)} km`;
}
function renderProperties(){
  const s=proyek.stasiun.find(x=>x.kode===selectedStation);$("prop-title").textContent=s?`${s.kode} — ${s.nama}`:"Belum dipilih";$("prop-kode").value=s?.kode||"";$("prop-nama").value=s?.nama||"";$("prop-km").value=s?`${formatKm(s.km)} km`:"";$("prop-jalur").value=s?`${s.jumlahJalur} jalur`:"";$("prop-jenis").value=s?.jenis||"";
  const p=Number.isInteger(selectedPetak)?proyek.petakJalan[selectedPetak]:null;$("prop-petak-title").textContent=p?`${p.dari} — ${p.ke}`:"Belum dipilih";$("prop-dari").value=p?.dari||"";$("prop-ke").value=p?.ke||"";$("prop-jarak").value=p?`${formatKm(p.jarak)} km`:"";$("prop-jenis-jalur").value=p?.jenisJalur||"";$("prop-vmax").value=p?`${p.kecepatanMaks} km/jam`:"";
}
function selectStation(kode){selectedStation=kode;selectedPetak=null;switchProperty("stasiun");renderAll();setStatus(`Stasiun ${kode} dipilih`)}
function selectPetak(index){selectedPetak=index;selectedStation=null;switchProperty("petak");renderAll();const p=proyek.petakJalan[index];if(p)setStatus(`Petak ${p.dari}–${p.ke} dipilih`)}
function switchProperty(type){$$('.property-tab').forEach(b=>b.classList.toggle('active',b.dataset.property===type));$("property-stasiun").classList.toggle("hidden",type!=="stasiun");$("property-petak").classList.toggle("hidden",type!=="petak")}
function switchList(type){$$('.segment').forEach(b=>b.classList.toggle('active',b.dataset.list===type));$("table-stasiun-wrap").classList.toggle("hidden",type!=="stasiun");$("table-petak-wrap").classList.toggle("hidden",type!=="petak")}
function switchBottom(type){$$('.bottom-tab').forEach(b=>b.classList.toggle('active',b.dataset.bottom===type));["jaringan","kereta","proyek"].forEach(x=>$("bottom-"+x).classList.toggle("hidden",x!==type))}
function openModal(id){$(id).classList.remove("hidden")}
function closeModal(id){$(id).classList.add("hidden")}

$("form-stasiun").addEventListener("submit",e=>{e.preventDefault();const s={kode:$("st-kode").value.trim().toUpperCase(),nama:$("st-nama").value.trim(),km:Number($("st-km").value),jumlahJalur:Number($("st-jalur").value),jenis:$("st-jenis").value};if(!s.kode||!s.nama||!Number.isFinite(s.km)||!Number.isInteger(s.jumlahJalur)||s.jumlahJalur<1){toast("Lengkapi data stasiun dengan benar.",true);return}proyek.stasiun.push(s);e.target.reset();$("st-jalur").value=2;selectedStation=s.kode;closeModal("modal-stasiun");renderAll();log(`Stasiun ${s.kode} — ${s.nama} ditambahkan.`);toast(`Stasiun ${s.kode} ditambahkan.`)});
$("form-petak").addEventListener("submit",e=>{e.preventDefault();const p={dari:$("petak-dari").value,ke:$("petak-ke").value,jarak:Number($("petak-jarak").value),jenisJalur:$("petak-jenis").value,kecepatanMaks:Number($("petak-vmax").value)};if(!p.dari||!p.ke||p.dari===p.ke||!Number.isFinite(p.jarak)||p.jarak<=0||!Number.isFinite(p.kecepatanMaks)||p.kecepatanMaks<=0){toast("Lengkapi data Petak Jalan dan pilih dua stasiun berbeda.",true);return}proyek.petakJalan.push(p);e.target.reset();selectedPetak=proyek.petakJalan.length-1;closeModal("modal-petak");renderAll();log(`Petak Jalan ${p.dari}–${p.ke} ditambahkan.`);toast(`Petak ${p.dari}–${p.ke} ditambahkan.`)});
$("nama-proyek").addEventListener("input",e=>{proyek.namaProyek=e.target.value;renderSummary()});
$("btn-baru").addEventListener("click",()=>{if((proyek.stasiun.length||proyek.petakJalan.length)&&!confirm("Buat proyek baru? Data yang belum disimpan akan hilang dari layar."))return;proyek=proyekKosong();selectedStation=null;selectedPetak=null;renderAll();log("Proyek baru dibuat.");toast("Proyek baru siap.")});
$("btn-simpan").addEventListener("click",()=>{proyek.namaProyek=$("nama-proyek").value.trim()||proyek.namaProyek||"Proyek TTC";const blob=new Blob([JSON.stringify(proyek,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a"),name=proyek.namaProyek.replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"proyek-ttc";a.href=url;a.download=`${name}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);renderSummary();log(`Proyek disimpan sebagai ${name}.json.`);toast(`Proyek disimpan: ${name}.json`)});
$("file-buka").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.format!=="TTC-Project"||!Array.isArray(data.stasiun)||!Array.isArray(data.petakJalan))throw new Error("Format proyek TTC tidak dikenali.");proyek={format:"TTC-Project",versi:Number(data.versi)||1,namaProyek:String(data.namaProyek||"Proyek TTC"),stasiun:data.stasiun,petakJalan:data.petakJalan};selectedStation=proyek.stasiun[0]?.kode||null;selectedPetak=null;renderAll();log(`Proyek ${file.name} dibuka: ${proyek.stasiun.length} stasiun, ${proyek.petakJalan.length} petak.`);toast(`Proyek ${file.name} berhasil dibuka.`)}catch(err){log(`Gagal membuka proyek: ${err.message}`,"ERROR");toast(`Gagal membuka proyek: ${err.message}`,true)}finally{e.target.value=""}});
$("btn-contoh").addEventListener("click",()=>{proyek={format:"TTC-Project",versi:1,namaProyek:"Contoh Bogor–Manggarai",stasiun:[{kode:"BOO",nama:"Bogor",km:0,jumlahJalur:4,jenis:"Stasiun"},{kode:"BJD",nama:"Bojong Gede",km:9.2,jumlahJalur:2,jenis:"Stasiun"},{kode:"CTA",nama:"Citayam",km:13.7,jumlahJalur:3,jenis:"Stasiun"},{kode:"DP",nama:"Depok",km:20.2,jumlahJalur:4,jenis:"Stasiun"},{kode:"MRI",nama:"Manggarai",km:44.6,jumlahJalur:8,jenis:"Stasiun"}],petakJalan:[{dari:"BOO",ke:"BJD",jarak:9.2,jenisJalur:"Ganda",kecepatanMaks:70},{dari:"BJD",ke:"CTA",jarak:4.5,jenisJalur:"Ganda",kecepatanMaks:70},{dari:"CTA",ke:"DP",jarak:6.5,jenisJalur:"Ganda",kecepatanMaks:70},{dari:"DP",ke:"MRI",jarak:24.4,jenisJalur:"Ganda",kecepatanMaks:70}]};selectedStation="DP";selectedPetak=null;renderAll();log("5 stasiun contoh dimuat untuk pengujian Tahap 1.");toast("5 stasiun contoh dimuat.")});

$("btn-tambah-stasiun").addEventListener("click",()=>openModal("modal-stasiun"));$("btn-tambah-petak").addEventListener("click",()=>{renderSelectors();openModal("modal-petak")});$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));$$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
$$('.property-tab').forEach(b=>b.addEventListener('click',()=>switchProperty(b.dataset.property)));$$('.segment').forEach(b=>b.addEventListener('click',()=>switchList(b.dataset.list)));$$('.bottom-tab').forEach(b=>b.addEventListener('click',()=>switchBottom(b.dataset.bottom)));
$("btn-legenda").addEventListener("click",()=>$("legend-box").classList.toggle("hidden"));$("btn-fit").addEventListener("click",()=>{renderNetwork();toast("Peta disesuaikan ke seluruh jaringan.")});$("btn-clear-log").addEventListener("click",()=>$("log-list").innerHTML="");
$$('.disabled-action,.future').forEach(b=>b.addEventListener('click',()=>{const msg=b.dataset.message||`${b.textContent.trim()} belum diaktifkan (${b.dataset.future||"tahap berikutnya"}).`;toast(msg);log(msg,"WARN")}));
$$('.nav-item:not(.future)').forEach(b=>b.addEventListener('click',()=>{$$('.nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');const view=b.dataset.view;if(view==="stasiun"){switchBottom("jaringan");switchList("stasiun")}else if(view==="petak"){switchBottom("jaringan");switchList("petak")}else if(view==="proyek"){switchBottom("proyek")}else if(view==="peta"){switchBottom("jaringan")}else if(view==="beranda"){toast("Beranda akan diringkas pada pengembangan berikutnya.")} }));
$$('.module-tab:not(.disabled-action)').forEach(b=>b.addEventListener('click',()=>{$$('.module-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(b.dataset.module==="jaringan"){switchBottom("jaringan");toast("Data Jaringan aktif.")}else{switchBottom("jaringan")}}));

renderAll();log("TTC UI Preview dimuat.");log("Fungsi dasar Tahap 1 siap: Stasiun, Petak Jalan, Simpan/Buka JSON.");setStatus("Tahap 1 aktif · UI Preview");
