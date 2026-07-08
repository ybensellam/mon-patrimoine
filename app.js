const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=new Intl.NumberFormat("fr-BE",{style:"currency",currency:"EUR"});
const compact=new Intl.NumberFormat("fr-BE",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const monthKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const storeKey="mon-patrimoine-v1";
const twelveDataKey="mon-patrimoine-twelve-data-key";
const demo={
  assets:[
    {id:uid(),name:"Bitcoin",symbol:"BTC",type:"crypto",quantity:.08,buyPrice:48200,price:53650,previousPrice:52920,apiId:"bitcoin"},
    {id:uid(),name:"MSCI World",symbol:"IWDA",type:"etf",quantity:14,buyPrice:78.4,price:93.2,previousPrice:92.7,twelveSymbol:"IWDA"},
    {id:uid(),name:"Or physique",symbol:"XAU",type:"gold",quantity:20,buyPrice:58.5,price:69.1,previousPrice:68.8,twelveSymbol:"XAU/EUR"}
  ],
  transactions:[
    {id:uid(),date:new Date().toISOString().slice(0,10),kind:"income",category:"Salaire",label:"Salaire mensuel",amount:2850},
    {id:uid(),date:new Date().toISOString().slice(0,10),kind:"expense",category:"Logement",label:"Loyer",amount:850},
    {id:uid(),date:new Date().toISOString().slice(0,10),kind:"investment",category:"ETF",label:"Versement ETF",amount:350}
  ],
  tasks:[
    {id:uid(),label:"Facture d’électricité",amount:82,date:`${monthKey()}-08`,direction:"pay",done:false,recurring:true},
    {id:uid(),label:"Remboursement",amount:120,date:`${monthKey()}-15`,direction:"receive",done:false,recurring:false}
  ],
  snapshots:[]
};
let state=JSON.parse(localStorage.getItem(storeKey)||"null")||demo;
state.assets.forEach(asset=>{if(asset.type==="gold"&&!asset.twelveSymbol)asset.twelveSymbol="XAU/USD"});
let taskCursor=new Date();
let assetFilter="all";
const save=()=>localStorage.setItem(storeKey,JSON.stringify(state));
const typeMeta={
  crypto:{label:"Crypto",color:"#59e391",icon:"₿"},
  etf:{label:"ETF",color:"#65a8ff",icon:"↗"},
  gold:{label:"Or",color:"#d9b45b",icon:"Au"},
  savings:{label:"Épargne",color:"#a78bfa",icon:"€"},
  cash:{label:"Espèces",color:"#45d0c1",icon:"¤"},
  debt:{label:"Emprunts",color:"#ff7777",icon:"−",negative:true}
};
const assetValue=asset=>(typeMeta[asset.type]?.negative?-1:1)*asset.quantity*asset.price;
const previousAssetValue=asset=>(typeMeta[asset.type]?.negative?-1:1)*asset.quantity*(asset.previousPrice??asset.price);
const currentMonthTx=()=>state.transactions.filter(t=>t.date.startsWith(monthKey()));
const totals=()=>{
  const value=state.assets.reduce((sum,asset)=>sum+assetValue(asset),0);
  const invested=state.assets.reduce((sum,asset)=>sum+(typeMeta[asset.type]?.negative?-1:1)*asset.quantity*asset.buyPrice,0);
  const previous=state.assets.reduce((sum,asset)=>sum+previousAssetValue(asset),0);
  return {value,invested,previous,daily:value-previous,gain:value-invested};
};
function render(){
  const t=totals(),tx=currentMonthTx(),inc=sumKind(tx,"income"),exp=sumKind(tx,"expense"),inv=sumKind(tx,"investment"),remaining=inc-exp-inv;
  $("#netWorth").textContent=money.format(t.value); $("#totalInvested").textContent=money.format(t.invested);
  $("#totalGain").textContent=money.format(t.gain); $("#totalGain").className=t.gain>=0?"positive":"negative";
  const dp=t.previous?t.daily/t.previous*100:0;
  $("#dailyChange").textContent=`Aujourd’hui · ${t.daily>=0?"+":""}${money.format(t.daily)} (${dp>=0?"+":""}${dp.toFixed(2)} %)`;
  $("#dailyChange").className="daily "+(t.daily>=0?"positive":"negative");
  $("#monthIncome").textContent=compact.format(inc);$("#monthExpense").textContent=compact.format(exp);$("#monthInvested").textContent=compact.format(inv);$("#monthAvailable").textContent=compact.format(remaining);
  $("#budgetRemaining").textContent=money.format(remaining);
  $("#budgetProgress").style.width=`${inc?Math.min(100,(exp+inv)/inc*100):0}%`;
  $("#budgetCaption").textContent=inc?`${compact.format(exp+inv)} utilisés sur ${compact.format(inc)} de revenus`:"Ajoutez votre salaire pour commencer";
  $("#historyTotal").textContent=money.format(t.value);
  renderAssets();renderAllocation();renderTransactions();renderTasks();renderHistory();renderSpark();
  save();
}
const sumKind=(items,kind)=>items.filter(x=>x.kind===kind).reduce((s,x)=>s+Number(x.amount),0);
function assetHTML(a){
  const value=assetValue(a),day=value-previousAssetValue(a),m=typeMeta[a.type]||typeMeta.cash;
  const isAccount=["savings","cash","debt"].includes(a.type);
  const detail=isAccount?m.label:`${a.quantity} ${esc(a.symbol)} · PRU ${money.format(a.buyPrice)}`;
  return `<article class="asset-row" data-id="${a.id}"><div class="asset-icon" style="color:${m.color}">${m.icon}</div><div class="content"><b>${esc(a.name)}</b><span>${detail}</span></div><div class="value"><b class="${value<0?"negative":""}">${money.format(value)}</b><small class="${day>=0?"positive":"negative"}">${day>=0?"+":""}${money.format(day)}</small></div></article>`;
}
function renderAssets(){
  const items=state.assets.filter(a=>assetFilter==="all"||a.type===assetFilter);
  $("#assetList").innerHTML=items.length?items.map(assetHTML).join(""):empty("Aucun actif dans cette catégorie");
  $("#assetPreview").innerHTML=state.assets.length?state.assets.slice(0,3).map(assetHTML).join(""):empty("Ajoutez votre premier actif");
}
function renderAllocation(){
  const gross=state.assets.reduce((sum,asset)=>sum+Math.abs(assetValue(asset)),0)||1;let cursor=0,parts=[],legend=[];
  Object.keys(typeMeta).forEach(type=>{const value=Math.abs(state.assets.filter(a=>a.type===type).reduce((sum,asset)=>sum+assetValue(asset),0));if(!value)return;const pct=value/gross*100,meta=typeMeta[type];parts.push(`${meta.color} ${cursor}% ${cursor+pct}%`);cursor+=pct;legend.push(`<div><i style="background:${meta.color}"></i><span>${meta.label}</span><b>${pct.toFixed(0)} %</b></div>`)});
  $("#donut").style.background=parts.length?`conic-gradient(${parts.join(",")})`:"var(--panel2)";
  $("#donutCount").textContent=state.assets.length;$("#allocationLegend").innerHTML=legend.join("")||"<span>Aucune donnée</span>";
}
function renderTransactions(){
  const icons={income:"↓",expense:"↑",investment:"↗"};
  const items=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
  $("#transactionList").innerHTML=items.length?items.map(t=>`<article class="transaction-row"><div class="tx-icon ${t.kind==="expense"?"negative":"positive"}">${icons[t.kind]}</div><div class="content"><b>${esc(t.label)}</b><span>${esc(t.category)} · ${dateFr(t.date)}</span></div><div class="value"><b class="${t.kind==="income"?"positive":t.kind==="expense"?"negative":""}">${t.kind==="income"?"+":"−"}${money.format(t.amount)}</b></div></article>`).join(""):empty("Aucune transaction");
}
function renderTasks(){
  const mk=monthKey(taskCursor),items=state.tasks.filter(t=>t.date.startsWith(mk)).sort((a,b)=>a.date.localeCompare(b.date));
  $("#taskMonth").textContent=taskCursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  $("#toPay").textContent=compact.format(items.filter(t=>t.direction==="pay"&&!t.done).reduce((s,t)=>s+t.amount,0));
  $("#toReceive").textContent=compact.format(items.filter(t=>t.direction==="receive"&&!t.done).reduce((s,t)=>s+t.amount,0));
  $("#taskList").innerHTML=items.length?items.map(t=>`<article class="task-row ${t.done?"done":""}"><button class="check" data-task="${t.id}">${t.done?"✓":""}</button><div class="content"><b>${esc(t.label)}</b><span>${dateFr(t.date)}${t.recurring?" · Mensuel":""}</span></div><div class="value"><b class="${t.direction==="pay"?"negative":"positive"}">${t.direction==="pay"?"−":"+"}${money.format(t.amount)}</b></div></article>`).join(""):empty("Aucune échéance ce mois-ci");
}
function renderHistory(){
  const snaps=[...state.snapshots].sort((a,b)=>a.month.localeCompare(b.month)),max=Math.max(...snaps.map(s=>s.value),1);
  $("#historyChart").innerHTML=snaps.length?snaps.slice(-7).map(s=>`<div><i style="height:${Math.max(5,s.value/max*105)}px"></i><small>${s.month.slice(5)}</small></div>`).join(""):empty("Enregistrez votre premier mois");
  $("#historyList").innerHTML=snaps.length?[...snaps].reverse().map((s,i,a)=>{const previous=a[i+1]?.value,delta=previous==null?null:s.value-previous;return `<article class="asset-row"><div class="asset-icon">◷</div><div class="content"><b>${monthName(s.month)}</b><span>Valeur enregistrée</span></div><div class="value"><b>${money.format(s.value)}</b>${delta==null?"":`<small class="${delta>=0?"positive":"negative"}">${delta>=0?"+":""}${money.format(delta)}</small>`}</div></article>`}).join(""):empty("Le suivi mensuel apparaîtra ici");
}
function renderSpark(){const base=totals().value||100;$("#sparkline").innerHTML=Array.from({length:28},(_,i)=>`<i style="height:${Math.max(8,25+Math.sin(i/3)*13+i*1.1+(Math.random()-.5)*10)}px"></i>`).join("")}
function navigate(page){$$(".page").forEach(x=>x.classList.toggle("active",x.dataset.page===page));$$("nav button").forEach(x=>x.classList.toggle("active",x.dataset.nav===page));$("#pageTitle").textContent={home:"Vue d’ensemble",assets:"Mes actifs",budget:"Budget mensuel",tasks:"Mes échéances",history:"Suivi mensuel"}[page];scrollTo({top:0,behavior:"smooth"})}
function openModal(type,kind,editId){
  $("#modalForm").dataset.editId=editId||"";
  const fields={asset:[
    field("Nom","name","text","Bitcoin, compte épargne, prêt…"),select("Type","type",[["crypto","Crypto"],["etf","ETF"],["gold","Or"],["savings","Compte d’épargne"],["cash","Argent cash"],["debt","Argent emprunté"]]),field("Symbole","symbol","text","BTC, EUR, XAU…"),field("Quantité","quantity","number","1"),field("Prix d’achat ou montant initial (€)","buyPrice","number","0"),field("Prix ou montant actuel (€)","price","number","0"),optionalField("Identifiant CoinGecko (crypto)","apiId","bitcoin"),optionalField("Symbole Twelve Data (ETF / or)","twelveSymbol","IWDA ou XAU/EUR")
  ],transaction:[
    select("Type","kind",[["income","Revenu"],["expense","Dépense"],["investment","Investissement"]],kind),field("Libellé","label","text","Salaire, courses…"),field("Catégorie","category","text","Logement, ETF…"),field("Montant (€)","amount","number","0"),field("Date","date","date",new Date().toISOString().slice(0,10))
  ],task:[
    field("Échéance","label","text","Facture, amende, remboursement…"),select("Mouvement","direction",[["pay","À payer"],["receive","À recevoir"]]),field("Montant (€)","amount","number","0"),field("Date","date","date",`${monthKey(taskCursor)}-01`),select("Répétition","recurring",[["false","Une seule fois"],["true","Tous les mois"]])
  ],settings:[
    `<div class="field"><label>Clé API Twelve Data</label><input name="apiKey" type="password" autocomplete="off" placeholder="Votre clé API" value="${esc(localStorage.getItem(twelveDataKey)||"")}" required></div><p style="color:var(--muted);font-size:12px;line-height:1.5">La clé reste enregistrée uniquement sur cet appareil. Elle sert à actualiser les ETF et l’or.</p>`
  ]};
  $("#modalTitle").textContent=type==="asset"&&editId?"Modifier l’actif":{asset:"Ajouter un actif",transaction:"Ajouter une transaction",task:"Ajouter une échéance",settings:"Réglages API"}[type];
  $("#modalFields").innerHTML=fields[type].join("");$("#modalForm").dataset.type=type;$("#modal").showModal();
  if(type==="asset"){
    const typeSelect=$("#modalForm [name=type]"),symbol=$("#modalForm [name=symbol]"),quantity=$("#modalForm [name=quantity]");
    const apiId=$("#modalForm [name=apiId]"),twelveSymbol=$("#modalForm [name=twelveSymbol]");
    const syncAssetFields=()=>{
      const isAccount=["savings","cash","debt"].includes(typeSelect.value);
      symbol.required=!isAccount;quantity.required=!isAccount;
      if(isAccount){symbol.value="EUR";quantity.value="1"}
      apiId.closest(".field").hidden=isAccount;
      twelveSymbol.closest(".field").hidden=isAccount;
    };
    typeSelect.addEventListener("change",syncAssetFields);syncAssetFields();
    if(editId){
      const asset=state.assets.find(item=>item.id===editId);
      if(asset){
        Object.entries(asset).forEach(([name,value])=>{const input=$(`#modalForm [name="${name}"]`);if(input&&value!=null)input.value=value});
        syncAssetFields();
        $("#modalFields").insertAdjacentHTML("beforeend",'<button type="button" class="danger" id="deleteAsset">Supprimer cet actif</button>');
        $("#deleteAsset").addEventListener("click",()=>deleteAsset(editId));
      }
    }
  }
}
function field(label,name,type,placeholder){return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" placeholder="${placeholder}" ${type==="number"?'step="any" min="0"':''} ${type==="date"?`value="${placeholder}"`:""} required></div>`}
function optionalField(label,name,placeholder){return `<div class="field"><label>${label}</label><input name="${name}" type="text" placeholder="${placeholder}"></div>`}
function select(label,name,options,selected){return `<div class="field"><label>${label}</label><select name="${name}">${options.map(([v,l])=>`<option value="${v}" ${v===selected?"selected":""}>${l}</option>`).join("")}</select></div>`}
function submitModal(e){
  e.preventDefault();const type=e.currentTarget.dataset.type,data=Object.fromEntries(new FormData(e.currentTarget));
  if(type==="asset"){
    const editId=e.currentTarget.dataset.editId;
    const existing=state.assets.find(item=>item.id===editId);
    const normalized={...data,quantity:+data.quantity,buyPrice:+data.buyPrice,price:+data.price};
    if(existing)Object.assign(existing,normalized,{previousPrice:existing.price});
    else state.assets.push({...normalized,id:uid(),previousPrice:normalized.price});
  }
  if(type==="transaction")state.transactions.push({...data,id:uid(),amount:+data.amount});
  if(type==="task")state.tasks.push({...data,id:uid(),amount:+data.amount,done:false,recurring:data.recurring==="true"});
  if(type==="settings")localStorage.setItem(twelveDataKey,data.apiKey.trim());
  $("#modal").close();render();toast("Enregistré avec succès");
}
function deleteAsset(id){
  if(!confirm("Supprimer définitivement cet actif ?"))return;
  state.assets=state.assets.filter(asset=>asset.id!==id);
  $("#modal").close();render();toast("Actif supprimé");
}
async function refreshPrices(){
  const cryptoAssets=state.assets.filter(a=>a.type==="crypto"&&a.apiId);
  const marketAssets=state.assets.filter(a=>["etf","gold"].includes(a.type)&&(a.twelveSymbol||a.symbol));
  if(!cryptoAssets.length&&!marketAssets.length)return toast("Ajoutez un symbole à vos actifs");
  $("#refreshButton").classList.add("loading");
  let updated=0,failed=0;
  if(cryptoAssets.length)try{const ids=cryptoAssets.map(a=>a.apiId).join(","),r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=eur&include_24hr_change=true`);if(!r.ok)throw Error();const data=await r.json();cryptoAssets.forEach(a=>{const p=data[a.apiId];if(p?.eur){a.previousPrice=p.eur/(1+(p.eur_24h_change||0)/100);a.price=p.eur;updated++}})}catch{failed+=cryptoAssets.length}
  const apiKey=localStorage.getItem(twelveDataKey);
  if(marketAssets.length&&!apiKey){failed+=marketAssets.length;toast("Ajoutez votre clé Twelve Data dans ⚙")}
  const eurRates={EUR:[1,1]};
  async function ratesToEuro(currency){
    if(eurRates[currency])return eurRates[currency];
    const params=new URLSearchParams({symbol:`EUR/${currency}`,interval:"1day",outputsize:"2",apikey:apiKey});
    const response=await fetch(`https://api.twelvedata.com/time_series?${params}`);
    const data=await response.json();
    if(!response.ok||data.status==="error"||!data.values?.length)throw Error();
    return eurRates[currency]=[Number(data.values[0].close),Number(data.values[1]?.close??data.values[0].close)];
  }
  if(apiKey)for(const asset of marketAssets)try{
    const symbol=asset.twelveSymbol||asset.symbol;
    const params=new URLSearchParams({symbol,interval:"1day",outputsize:"2",apikey:apiKey});
    const response=await fetch(`https://api.twelvedata.com/time_series?${params}`);
    const data=await response.json();
    if(!response.ok||data.status==="error"||!data.values?.length)throw Error();
    let current=Number(data.values[0].close),previous=Number(data.values[1]?.close??current);
    if(!Number.isFinite(current))throw Error();
    const currency=data.meta?.currency||"EUR";
    if(currency!=="EUR"){const [currentRate,previousRate]=await ratesToEuro(currency);current/=currentRate;previous/=previousRate}
    if(asset.type==="gold"&&symbol.startsWith("XAU/")){current/=31.1034768;previous/=31.1034768}
    asset.previousPrice=previous;asset.price=current;updated++;
  }catch{failed++}
  render();
  toast(updated?`${updated} cours actualisé${updated>1?"s":""}${failed?` · ${failed} échec${failed>1?"s":""}`:""}`:"Aucun cours actualisé");
  $("#refreshButton").classList.remove("loading");
}
function recordSnapshot(){const mk=monthKey(),value=totals().value,old=state.snapshots.find(s=>s.month===mk);old?old.value=value:state.snapshots.push({month:mk,value});render();toast("Patrimoine du mois enregistré")}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function empty(s){return `<div style="padding:25px;text-align:center;color:var(--muted);font-size:13px">${s}</div>`}
function dateFr(s){return new Date(s+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}
function monthName(s){return new Date(s+"-02").toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}
function toast(s){$("#toast").textContent=s;$("#toast").classList.add("show");setTimeout(()=>$("#toast").classList.remove("show"),2200)}
$$("[data-nav]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.nav)));
$$("[data-open]").forEach(b=>b.addEventListener("click",()=>openModal(b.dataset.open,b.dataset.kind)));
$("#modalClose").addEventListener("click",()=>$("#modal").close());
["#assetList","#assetPreview"].forEach(selector=>$(selector).addEventListener("click",event=>{const row=event.target.closest(".asset-row[data-id]");if(row)openModal("asset",null,row.dataset.id)}));
$("#assetFilters").addEventListener("click",e=>{if(!e.target.dataset.filter)return;assetFilter=e.target.dataset.filter;$$("[data-filter]").forEach(b=>b.classList.toggle("active",b===e.target));renderAssets()});
$("#modalForm").addEventListener("submit",submitModal);$("#refreshButton").addEventListener("click",refreshPrices);$("#snapshotButton").addEventListener("click",recordSnapshot);
$("#prevMonth").addEventListener("click",()=>{taskCursor.setMonth(taskCursor.getMonth()-1);renderTasks()});$("#nextMonth").addEventListener("click",()=>{taskCursor.setMonth(taskCursor.getMonth()+1);renderTasks()});
$("#taskList").addEventListener("click",e=>{const id=e.target.dataset.task;if(!id)return;const task=state.tasks.find(t=>t.id===id);task.done=!task.done;render()});
$("#todayLabel").textContent=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js");
render();
