import React, { useEffect, useMemo, useState } from 'react'
import {
  Home, FileText, Users, Settings, Plus, Search, Smartphone, Wrench,
  CheckCircle, Clock, Menu, X, DollarSign, MessageCircle, Printer,
  Package, Trash2, ShieldCheck, LogOut, RefreshCw, AlertCircle, Save
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'

const statusLabels = {
  pending: 'Aguardando',
  in_progress: 'Em análise',
  awaiting_part: 'Aguardando peça',
  completed: 'Finalizado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}
const statusClasses = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  awaiting_part: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
}

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function dateBR(v) {
  if (!v) return '-'
  return new Date(v).toLocaleDateString('pt-BR')
}
function StatusBadge({ status }) {
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusClasses[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{statusLabels[status] || status}</span>
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [tab, setTab] = useState('dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setLoadingAuth(false)
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoadingAuth(false)
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (session?.user) loadAll()
  }, [session?.user?.id])

  async function loadAll() {
    setLoading(true); setError('')
    try {
      const [p, c, s, o] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, company_id').eq('id', session.user.id).single(),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('services').select('*').order('name'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
      ])
      if (p.error) throw p.error
      if (c.error) throw c.error
      if (s.error) throw s.error
      if (o.error) throw o.error
      setProfile(p.data)
      setClients(c.data || [])
      setServices(s.data || [])
      setOrders(o.data || [])
      if (p.data?.company_id) {
        const { data: co, error: ce } = await supabase.from('companies').select('*').eq('id', p.data.company_id).single()
        if (ce) throw ce
        setCompany(co)
      }
    } catch (e) {
      setError(e.message || 'Não foi possível carregar os dados.')
    } finally { setLoading(false) }
  }

  async function signOut() { await supabase.auth.signOut(); setOrders([]); setClients([]); setServices([]); setProfile(null); setCompany(null) }

  async function createOrder(form) {
    setError('')
    const { data, error: e } = await supabase.from('orders').insert({
      client_id: form.client_id || null,
      client_name: form.client_name,
      client_phone: form.client_phone,
      device: form.device,
      imei: form.imei,
      issue: form.issue,
      diagnosis: form.diagnosis,
      password_notes: form.password_notes,
      accessories: form.accessories,
      status: 'pending',
      total: Number(form.total || 0),
      warranty: form.warranty,
      notes: form.notes,
    }).select().single()
    if (e) { setError(e.message); return false }
    setOrders(prev => [data, ...prev])
    setTab('orders')
    return true
  }

  async function updateOrder(id, patch) {
    const { data, error: e } = await supabase.from('orders').update(patch).eq('id', id).select().single()
    if (e) { setError(e.message); return false }
    setOrders(prev => prev.map(x => x.id === id ? data : x))
    return true
  }

  async function addClient(form) {
    const { data, error: e } = await supabase.from('clients').insert(form).select().single()
    if (e) { setError(e.message); return false }
    setClients(prev => [data, ...prev]); return true
  }

  async function deleteClient(id) {
    if (!confirm('Excluir este cliente?')) return
    const { error: e } = await supabase.from('clients').delete().eq('id', id)
    if (e) { setError(e.message); return }
    setClients(prev => prev.filter(x => x.id !== id))
  }

  async function addService(form) {
    const { data, error: e } = await supabase.from('services').insert({ ...form, price: Number(form.price || 0) }).select().single()
    if (e) { setError(e.message); return false }
    setServices(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name))); return true
  }

  async function deleteService(id) {
    if (!confirm('Excluir este serviço?')) return
    const { error: e } = await supabase.from('services').delete().eq('id', id)
    if (e) { setError(e.message); return }
    setServices(prev => prev.filter(x => x.id !== id))
  }

  if (loadingAuth) return <FullScreen message="Carregando TechOS Pro..." />
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} />

  const pending = orders.filter(x => ['pending','in_progress','awaiting_part'].includes(x.status)).length
  const completed = orders.filter(x => ['completed','delivered'].includes(x.status)).length
  const revenue = orders.filter(x => ['completed','delivered'].includes(x.status)).reduce((a,b) => a + Number(b.total || 0), 0)

  const nav = [
    ['dashboard', <Home size={19}/>, 'Dashboard'],
    ['orders', <FileText size={19}/>, 'Ordens de Serviço'],
    ['clients', <Users size={19}/>, 'Clientes'],
    ['catalog', <Package size={19}/>, 'Catálogo'],
    ['settings', <Settings size={19}/>, 'Configurações'],
  ]

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl">
        <Brand />
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {nav.map(([id, icon, label]) => <NavItem key={id} icon={icon} label={label} active={tab === id} onClick={() => setTab(id)} />)}
        </nav>
        <div className="p-4 bg-slate-800 m-4 rounded-xl text-sm">
          <p className="text-slate-400 mb-1">Plano</p>
          <p className="font-semibold text-green-400">MVP Gratuito</p>
          <p className="text-xs text-slate-400 mt-2 truncate">{company?.name || 'Sua assistência'}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setMobileMenu(v => !v)}>{mobileMenu ? <X/> : <Menu/>}</button>
            <h2 className="font-semibold hidden sm:block">{tab === 'new-order' ? 'Nova OS' : nav.find(x => x[0] === tab)?.[2] || 'TechOS Pro'}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadAll} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Atualizar"><RefreshCw size={18}/></button>
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">{(profile?.full_name || session.user.email || 'T')[0].toUpperCase()}</div>
          </div>
        </header>

        {mobileMenu && <div className="md:hidden absolute top-16 left-0 right-0 z-50 bg-slate-900 p-4 space-y-2 shadow-xl">
          {nav.map(([id, icon, label]) => <NavItem key={id} icon={icon} label={label} active={tab === id} onClick={() => {setTab(id);setMobileMenu(false)}} />)}
          <button onClick={signOut} className="w-full flex gap-3 items-center px-4 py-3 text-red-300"><LogOut size={19}/> Sair</button>
        </div>}

        <main className="flex-1 overflow-auto p-4 md:p-8">
          {error && <div className="max-w-7xl mx-auto mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 flex items-center gap-2"><AlertCircle size={18}/><span className="text-sm">{error}</span><button className="ml-auto" onClick={() => setError('')}><X size={17}/></button></div>}
          {loading && <div className="max-w-7xl mx-auto mb-4 text-sm text-slate-500">Sincronizando...</div>}
          {tab === 'dashboard' && <Dashboard orders={orders} pending={pending} completed={completed} revenue={revenue} onNew={() => setTab('new-order')} />}
          {tab === 'orders' && <Orders orders={orders} onNew={() => setTab('new-order')} onUpdate={updateOrder} />}
          {tab === 'new-order' && <NewOrder clients={clients} services={services} onSave={createOrder} onCancel={() => setTab('orders')} />}
          {tab === 'clients' && <Clients clients={clients} onAdd={addClient} onDelete={deleteClient} />}
          {tab === 'catalog' && <Catalog services={services} onAdd={addService} onDelete={deleteService} />}
          {tab === 'settings' && <SettingsView company={company} profile={profile} session={session} onSignOut={signOut} />}
        </main>
      </div>
    </div>
  )
}

function FullScreen({message}) { return <div className="min-h-screen grid place-items-center bg-slate-900 text-white"><div className="text-center"><Wrench className="mx-auto mb-3 text-blue-400" size={42}/><p>{message}</p></div></div> }
function Brand() { return <div className="p-6 flex items-center gap-3"><div className="bg-blue-500 p-2 rounded-lg"><Wrench size={24}/></div><h1 className="text-2xl font-bold">TechOS<span className="text-blue-400">Pro</span></h1></div> }
function NavItem({icon,label,active,onClick}) { return <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>{icon}<span className="font-medium">{label}</span></button> }

function AuthScreen({mode,setMode}) {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [name,setName]=useState(''); const [company,setCompany]=useState(''); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState(''); const [err,setErr]=useState('')
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    try {
      if (mode === 'register') {
        if (!name || !company) throw new Error('Informe seu nome e o nome da assistência.')
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, company_name: company } } })
        if (error) throw error
        setMsg('Cadastro criado. Verifique seu e-mail se a confirmação estiver habilitada no Supabase.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch(e) { setErr(e.message || 'Não foi possível continuar.') } finally { setBusy(false) }
  }
  return <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7">
      <div className="flex items-center gap-3 mb-7"><div className="bg-blue-600 p-2.5 rounded-xl text-white"><Wrench/></div><div><h1 className="text-2xl font-bold">TechOS<span className="text-blue-600">Pro</span></h1><p className="text-sm text-slate-500">Gestão para assistência técnica</p></div></div>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{err}</div>}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm mb-4">{msg}</div>}
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && <>
          <Field label="Seu nome" value={name} onChange={setName} placeholder="João da Silva" required/>
          <Field label="Nome da assistência" value={company} onChange={setCompany} placeholder="Minha Assistência" required/>
        </>}
        <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@email.com" required/>
        <Field label="Senha" type="password" value={password} onChange={setPassword} placeholder="Mínimo recomendado: 8 caracteres" required/>
        <button disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold">{busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
      </form>
      <button onClick={() => {setMode(mode==='login'?'register':'login');setErr('');setMsg('')}} className="w-full mt-4 text-sm text-blue-600 hover:underline">{mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho uma conta'}</button>
      <p className="text-xs text-center text-slate-400 mt-6">TechOS Pro • MVP</p>
    </div>
  </div>
}
function Field({label,value,onChange,type='text',placeholder,required}) { return <label className="block"><span className="block text-sm font-medium mb-1">{label}</span><input required={required} type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"/></label> }

function Dashboard({orders,pending,completed,revenue,onNew}) {
  return <div className="max-w-7xl mx-auto space-y-6">
    <div className="flex flex-col sm:flex-row justify-between gap-4"><div><h1 className="text-2xl font-bold">Olá, Técnico 👋</h1><p className="text-slate-500">Resumo da sua assistência.</p></div><button onClick={onNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex gap-2 items-center font-medium"><Plus size={20}/> Nova OS</button></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <Stat title="OS em andamento" value={pending} icon={<Clock/>} cls="bg-yellow-50 text-yellow-700"/>
      <Stat title="OS concluídas" value={completed} icon={<CheckCircle/>} cls="bg-green-50 text-green-700"/>
      <Stat title="Faturamento concluído" value={money(revenue)} icon={<DollarSign/>} cls="bg-blue-50 text-blue-700"/>
    </div>
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"><div className="p-6 border-b font-bold">Últimas OS</div>
      {orders.length===0 ? <Empty text="Nenhuma OS cadastrada."/> : orders.slice(0,5).map(o=><div key={o.id} className="p-4 border-b last:border-0 flex flex-col sm:flex-row gap-3 sm:items-center justify-between"><div><b>{o.client_name || 'Cliente'}</b><p className="text-sm text-slate-500">OS #{o.number} • {o.device}</p></div><div className="flex items-center gap-3"><StatusBadge status={o.status}/><b>{money(o.total)}</b></div></div>)}
    </div>
  </div>
}
function Stat({title,value,icon,cls}) { return <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center"><div><p className="text-sm text-slate-500">{title}</p><p className="text-2xl font-bold mt-1">{value}</p></div><div className={`p-3 rounded-xl ${cls}`}>{icon}</div></div> }

function Orders({orders,onNew,onUpdate}) {
  const [q,setQ]=useState('')
  const filtered=orders.filter(o => `${o.number} ${o.client_name} ${o.device}`.toLowerCase().includes(q.toLowerCase()))
  return <div className="max-w-7xl mx-auto space-y-5"><div className="flex flex-col sm:flex-row justify-between gap-3"><h1 className="text-2xl font-bold">Ordens de Serviço</h1><button onClick={onNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex gap-2 items-center"><Plus size={20}/> Nova OS</button></div>
    <div className="bg-white rounded-2xl border shadow-sm p-3 flex items-center gap-2"><Search size={18} className="text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar OS, cliente ou aparelho..." className="outline-none w-full"/></div>
    <div className="bg-white rounded-2xl border shadow-sm overflow-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-sm text-slate-500"><tr>{['OS','Cliente','Aparelho','Status','Data','Total','Ações'].map(h=><th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{filtered.map(o=><tr key={o.id} className="border-t hover:bg-slate-50"><td className="p-4 font-bold text-blue-600">#{o.number}</td><td className="p-4">{o.client_name}</td><td className="p-4">{o.device}</td><td className="p-4"><select value={o.status} onChange={e=>onUpdate(o.id,{status:e.target.value})} className="border rounded-lg p-2 text-sm"><option value="pending">Aguardando</option><option value="in_progress">Em análise</option><option value="awaiting_part">Aguardando peça</option><option value="completed">Finalizado</option><option value="delivered">Entregue</option><option value="cancelled">Cancelado</option></select></td><td className="p-4 text-slate-500">{dateBR(o.created_at)}</td><td className="p-4 font-bold">{money(o.total)}</td><td className="p-4"><div className="flex gap-2"><button onClick={()=>whatsapp(o)} title="WhatsApp" className="p-2 rounded-lg hover:bg-green-50 text-green-600"><MessageCircle size={18}/></button><button onClick={()=>printOrder(o)} title="Imprimir" className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"><Printer size={18}/></button></div></td></tr>)}</tbody></table>{filtered.length===0&&<Empty text="Nenhuma OS encontrada."/>}</div>
  </div>
}
function whatsapp(o){ const text=`Olá, ${o.client_name || ''}! Sua OS #${o.number} - ${o.device} está com status: ${statusLabels[o.status] || o.status}.`; const phone=(o.client_phone||'').replace(/\D/g,''); window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank') }
function printOrder(o){ const w=window.open('','_blank','width=800,height=900'); if(!w)return; w.document.write(`<html><head><title>OS #${o.number} - TechOS Pro</title><style>body{font-family:Arial;padding:35px}h1{color:#2563eb}hr{border:0;border-top:1px solid #ddd}p{margin:8px 0}</style></head><body><h1>TechOS Pro</h1><h2>Ordem de Serviço #${o.number}</h2><hr><p><b>Cliente:</b> ${o.client_name||''}</p><p><b>WhatsApp:</b> ${o.client_phone||''}</p><p><b>Aparelho:</b> ${o.device||''}</p><p><b>IMEI:</b> ${o.imei||''}</p><p><b>Defeito:</b> ${o.issue||''}</p><p><b>Diagnóstico:</b> ${o.diagnosis||''}</p><p><b>Acessórios:</b> ${o.accessories||''}</p><p><b>Status:</b> ${statusLabels[o.status]||o.status}</p><p><b>Total:</b> ${money(o.total)}</p><br><p>Assinatura do cliente: __________________________</p><script>window.print()</script></body></html>`); w.document.close() }

function NewOrder({clients,services,onSave,onCancel}) {
  const [f,setF]=useState({client_id:'',client_name:'',client_phone:'',device:'',imei:'',issue:'',diagnosis:'',password_notes:'',accessories:'',total:'',warranty:'',notes:''})
  const [saving,setSaving]=useState(false)
  function set(k,v){setF(x=>({...x,[k]:v}))}
  function selectClient(id){ const c=clients.find(x=>String(x.id)===String(id)); setF(x=>({...x,client_id:id,client_name:c?.name||'',client_phone:c?.phone||''}))}
  function selectService(id){ const s=services.find(x=>String(x.id)===String(id)); if(s) setF(x=>({...x,total:s.price,warranty:s.warranty||''}))}
  async function submit(e){e.preventDefault();setSaving(true);await onSave(f);setSaving(false)}
  return <div className="max-w-4xl mx-auto"><div className="flex items-center gap-3 mb-5"><button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full"><X/></button><h1 className="text-2xl font-bold">Nova Ordem de Serviço</h1></div>
    <form onSubmit={submit} className="bg-white rounded-2xl border shadow-sm p-5 md:p-8 space-y-7">
      <Section title="1. Cliente"><div className="grid md:grid-cols-2 gap-4"><label className="block md:col-span-2"><span className="label">Cliente cadastrado</span><select value={f.client_id} onChange={e=>selectClient(e.target.value)} className="input"><option value="">Novo cliente / digite abaixo</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name} — {c.phone||''}</option>)}</select></label><Field label="Nome *" value={f.client_name} onChange={v=>set('client_name',v)} required/><Field label="WhatsApp" value={f.client_phone} onChange={v=>set('client_phone',v)} placeholder="(12) 99999-9999"/></div></Section>
      <Section title="2. Aparelho"><div className="grid md:grid-cols-2 gap-4"><Field label="Modelo *" value={f.device} onChange={v=>set('device',v)} required/><Field label="IMEI" value={f.imei} onChange={v=>set('imei',v)}/><Field label="Defeito relatado" value={f.issue} onChange={v=>set('issue',v)} area/><Field label="Diagnóstico" value={f.diagnosis} onChange={v=>set('diagnosis',v)} area/></div></Section>
      <Section title="3. Segurança / entrega"><div className="grid md:grid-cols-2 gap-4"><Field label="Senha / padrão" value={f.password_notes} onChange={v=>set('password_notes',v)}/><Field label="Acessórios recebidos" value={f.accessories} onChange={v=>set('accessories',v)}/></div></Section>
      <Section title="4. Serviço e valores"><div className="grid md:grid-cols-3 gap-4"><label><span className="label">Serviço do catálogo</span><select onChange={e=>selectService(e.target.value)} className="input"><option value="">Selecione...</option>{services.map(s=><option key={s.id} value={s.id}>{s.name} — {money(s.price)}</option>)}</select></label><Field label="Valor total" type="number" step="0.01" value={f.total} onChange={v=>set('total',v)}/><Field label="Garantia" value={f.warranty} onChange={v=>set('warranty',v)}/></div><Field label="Observações" value={f.notes} onChange={v=>set('notes',v)} area/></Section>
      <div className="flex justify-end gap-3"><button type="button" onClick={onCancel} className="px-5 py-3 rounded-xl border">Cancelar</button><button disabled={saving} className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold flex items-center gap-2"><Save size={18}/>{saving?'Salvando...':'Salvar OS'}</button></div>
    </form>
  </div>
}
function Section({title,children}){return <section><h2 className="text-sm uppercase tracking-wider text-slate-400 font-bold mb-4">{title}</h2>{children}</section>}
function Field({label,value,onChange,type='text',placeholder='',required=false,area=false}){return <label className="block"><span className="label">{label}</span>{area?<textarea required={required} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="input min-h-24"/>:<input required={required} type={type} step={type==='number'?'0.01':undefined} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="input"/>}</label>}

function Clients({clients,onAdd,onDelete}) {
  const [open,setOpen]=useState(false); const [f,setF]=useState({name:'',phone:'',email:'',notes:''})
  async function save(e){e.preventDefault();if(await onAdd(f)){setF({name:'',phone:'',email:'',notes:''});setOpen(false)}}
  return <div className="max-w-7xl mx-auto space-y-5"><div className="flex justify-between items-center"><h1 className="text-2xl font-bold">Clientes</h1><button onClick={()=>setOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex gap-2"><Plus size={20}/> Novo cliente</button></div>
    {open&&<Modal title="Novo cliente" onClose={()=>setOpen(false)}><form onSubmit={save} className="space-y-4"><Field label="Nome *" value={f.name} onChange={v=>setF({...f,name:v})} required/><Field label="WhatsApp" value={f.phone} onChange={v=>setF({...f,phone:v})}/><Field label="E-mail" value={f.email} onChange={v=>setF({...f,email:v})}/><Field label="Observações" value={f.notes} onChange={v=>setF({...f,notes:v})} area/><button className="w-full bg-blue-600 text-white py-3 rounded-xl">Salvar</button></form></Modal>}
    <div className="bg-white rounded-2xl border shadow-sm overflow-auto"><table className="w-full min-w-[650px]"><thead className="bg-slate-50 text-left text-sm text-slate-500"><tr><th className="p-4">Nome</th><th className="p-4">WhatsApp</th><th className="p-4">E-mail</th><th className="p-4">Cadastro</th><th className="p-4"></th></tr></thead><tbody>{clients.map(c=><tr key={c.id} className="border-t"><td className="p-4 font-semibold">{c.name}</td><td className="p-4">{c.phone||'-'}</td><td className="p-4">{c.email||'-'}</td><td className="p-4">{dateBR(c.created_at)}</td><td className="p-4 text-right"><button onClick={()=>onDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button></td></tr>)}</tbody></table>{clients.length===0&&<Empty text="Nenhum cliente cadastrado."/>}</div>
  </div>
}
function Catalog({services,onAdd,onDelete}) {
  const [open,setOpen]=useState(false); const [f,setF]=useState({name:'',price:'',warranty:'3 meses',description:''})
  async function save(e){e.preventDefault();if(await onAdd(f)){setF({name:'',price:'',warranty:'3 meses',description:''});setOpen(false)}}
  return <div className="max-w-7xl mx-auto space-y-5"><div className="flex justify-between items-center"><h1 className="text-2xl font-bold">Catálogo</h1><button onClick={()=>setOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex gap-2"><Plus size={20}/> Novo serviço</button></div>
    {open&&<Modal title="Novo serviço" onClose={()=>setOpen(false)}><form onSubmit={save} className="space-y-4"><Field label="Nome *" value={f.name} onChange={v=>setF({...f,name:v})} required/><Field label="Preço" type="number" value={f.price} onChange={v=>setF({...f,price:v})}/><Field label="Garantia" value={f.warranty} onChange={v=>setF({...f,warranty:v})}/><Field label="Descrição" value={f.description} onChange={v=>setF({...f,description:v})} area/><button className="w-full bg-blue-600 text-white py-3 rounded-xl">Salvar</button></form></Modal>}
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{services.map(s=><div key={s.id} className="bg-white border rounded-2xl p-5 shadow-sm"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{s.name}</h3><p className="text-sm text-slate-500 mt-1">{s.description||'Sem descrição'}</p></div><button onClick={()=>onDelete(s.id)} className="text-red-500 p-2 h-fit hover:bg-red-50 rounded-lg"><Trash2 size={17}/></button></div><div className="mt-5 flex justify-between items-center"><b className="text-xl">{money(s.price)}</b><span className="text-xs bg-slate-100 px-2 py-1 rounded">{s.warranty||'Sem garantia'}</span></div></div>)}</div>{services.length===0&&<Empty text="Nenhum serviço cadastrado."/>}
  </div>
}
function SettingsView({company,profile,session,onSignOut}){return <div className="max-w-3xl mx-auto space-y-5"><h1 className="text-2xl font-bold">Configurações</h1><div className="bg-white border rounded-2xl p-6 space-y-5"><div><p className="text-sm text-slate-500">Empresa</p><p className="text-lg font-semibold">{company?.name||'TechOS Pro'}</p></div><div><p className="text-sm text-slate-500">Usuário</p><p className="font-medium">{profile?.full_name||'-'}</p><p className="text-sm text-slate-500">{session.user.email}</p></div><div><p className="text-sm text-slate-500">Perfil</p><p className="font-medium">{profile?.role||'admin'}</p></div><button onClick={onSignOut} className="bg-red-600 text-white px-5 py-3 rounded-xl flex items-center gap-2"><LogOut size={18}/> Sair da conta</button></div><div className="bg-blue-50 border border-blue-100 rounded-2xl p-5"><div className="flex gap-3"><ShieldCheck className="text-blue-600 shrink-0"/><div><b>TechOS Pro preparado para SaaS</b><p className="text-sm text-slate-600 mt-1">Os dados são isolados por empresa usando RLS no Supabase.</p></div></div></div></div>}
function Modal({title,onClose,children}){return <div className="fixed inset-0 bg-black/40 z-[60] grid place-items-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl"><div className="flex justify-between items-center mb-5"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X/></button></div>{children}</div></div>}
function Empty({text}){return <div className="p-10 text-center text-slate-500">{text}</div>}
