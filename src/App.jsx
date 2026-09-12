import React, { useEffect, useState } from 'react'
import {
  Home, FileText, Users, Settings, Plus, Search, Wrench,
  CheckCircle, Clock, Menu, X, DollarSign, MessageCircle,
  Printer, Package, Trash2, LogOut, RefreshCw, AlertCircle,
  Save, ChevronRight, Pencil, Camera, Upload, Download, ShieldCheck
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import InventoryView from './InventoryView'
import OrderPartsSelector from './OrderPartsSelector'
import MasterAdminView from './MasterAdminView'
import TeamManagementView from './TeamManagementView'
import * as XLSX from 'xlsx'

const statusLabels = {
  pending: 'Aguardando',
  in_progress: 'Em análise',
  awaiting_part: 'Aguardando peça',
  completed: 'Finalizado',
  delivered: 'Entregue',
  cancelled: 'Cancelado'
}

const statusClasses = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  awaiting_part: 'bg-violet-50 text-violet-700 border-violet-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200'
}

const money = v =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

const dateBR = v => v ? new Date(v).toLocaleDateString('pt-BR') : '-'

function getSubscriptionAccess(company) {
  if (!company) {
    return {
      active: true,
      status: '',
      label: '',
      endsAt: null
    }
  }

  const status =
    String(company.subscription_status || '').toLowerCase()

  const endsAt =
    status === 'trial'
      ? company.trial_ends_at
      : status === 'active'
        ? company.subscription_ends_at
        : null

  const dateValid =
    Boolean(endsAt) &&
    new Date(endsAt).getTime() > Date.now()

  const active =
    ['trial', 'active'].includes(status) &&
    dateValid

  const labels = {
    trial: 'Período de teste expirado',
    active: 'Assinatura expirada',
    past_due: 'Pagamento pendente',
    expired: 'Assinatura expirada',
    cancelled: 'Assinatura cancelada',
    suspended: 'Acesso bloqueado'
  }

  return {
    active,
    status,
    endsAt,
    label:
      labels[status] ||
      'Assinatura inativa'
  }
}

function SubscriptionLockedScreen({
  company,
  onSignOut
}) {
  const access =
    getSubscriptionAccess(company)

  const [billingBusy, setBillingBusy] =
    useState('')

  const [billingError, setBillingError] =
    useState('')

  const sandboxBilling =
    company?.plan === 'starter_sandbox'

  async function openCheckout(mode) {
    setBillingBusy(mode)
    setBillingError('')

    try {
      const {
        data: sessionData,
        error: sessionError
      } = await supabase.auth.getSession()

      if (
        sessionError ||
        !sessionData?.session?.access_token
      ) {
        throw new Error(
          'Sua sessão expirou. Saia e entre novamente.'
        )
      }

      const supabaseUrl =
        import.meta.env.VITE_SUPABASE_URL

      const publishableKey =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

      const response = await fetch(
        `${supabaseUrl}/functions/v1/asaas-create-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${sessionData.session.access_token}`,
            apikey: publishableKey
          },
          body: JSON.stringify({ mode })
        }
      )

      let data = {}

      try {
        data = await response.json()
      } catch {
        data = {}
      }

      if (!response.ok) {
        const message = [
          data?.error,
          data?.details
        ]
          .filter(Boolean)
          .join(' — ')

        throw new Error(
          message ||
          `Falha ao iniciar pagamento (HTTP ${response.status}).`
        )
      }

      if (!data?.url) {
        throw new Error(
          'O pagamento foi criado, mas o link do checkout não foi retornado.'
        )
      }

      window.location.assign(data.url)
    } catch (e) {
      console.error(e)

      setBillingError(
        e.message ||
        'Falha ao iniciar pagamento.'
      )
    } finally {
      setBillingBusy('')
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-5">

      <div className="w-full max-w-lg bg-white rounded-3xl p-7 shadow-2xl">

        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-5">
          <AlertCircle size={30}/>
        </div>

        <p className="text-sm font-bold text-red-600">
          ACESSO SUSPENSO
        </p>

        <h1 className="text-2xl font-bold mt-1">
          {access.label}
        </h1>

        <p className="text-slate-500 mt-3">
          O acesso da assistência
          {' '}
          <b className="text-slate-700">
            {company?.name}
          </b>
          {' '}
          está temporariamente bloqueado.
        </p>

        <div className="bg-slate-50 rounded-2xl p-4 mt-6 space-y-3">

          <div className="flex justify-between gap-4">
            <span className="text-slate-500">
              Plano
            </span>

            <b className="capitalize">
              {company?.plan || 'Starter'}
            </b>
          </div>

          {access.endsAt && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">
                Vencimento
              </span>

              <b>
                {dateBR(access.endsAt)}
              </b>
            </div>
          )}

        </div>

        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          Regularize sua assinatura com a administração
          do Automatize OS para continuar utilizando o sistema.
          Seus dados permanecem armazenados.
        </div>

        {sandboxBilling && (
          <div className="mt-6 border-2 border-dashed border-blue-200 bg-blue-50 rounded-2xl p-4">
            <p className="font-bold text-blue-900">
              Teste de pagamento — Sandbox
            </p>

            <p className="text-sm text-blue-700 mt-1">
              Valor temporário de homologação: R$ 5,00.
              Nenhum dinheiro real será movimentado.
            </p>

            {billingError && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                {billingError}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                disabled={Boolean(billingBusy)}
                onClick={() => openCheckout('pix')}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"
              >
                {billingBusy === 'pix'
                  ? 'Abrindo...'
                  : 'Pagar R$ 5 com PIX'}
              </button>

              <button
                type="button"
                disabled={Boolean(billingBusy)}
                onClick={() => openCheckout('card')}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
              >
                {billingBusy === 'card'
                  ? 'Abrindo...'
                  : 'Assinar R$ 5 no cartão'}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-primary w-full justify-center mt-6"
        >
          <RefreshCw size={18}/>
          Já regularizei — verificar acesso
        </button>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full py-3 border rounded-xl font-semibold mt-3"
        >
          <LogOut size={18} className="inline mr-2"/>
          Sair
        </button>

        <p className="text-xs text-center text-slate-400 mt-6">
          Powered by Automatize OS
        </p>

      </div>

    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  area = false
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {area ? (
        <textarea
          required={required}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input min-h-24"
        />
      ) : (
        <input
          required={required}
          type={type}
          step={type === 'number' ? '0.01' : undefined}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input"
        />
      )}
    </label>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusClasses[status] || ''}`}>
      {statusLabels[status] || status}
    </span>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => new URLSearchParams(window.location.search).get('reset') === '1'
  )
  const [tab, setTab] = useState('dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)

  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])
  const [team, setTeam] = useState([])
  const [invites, setInvites] = useState([])

  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [companyLogoUrl, setCompanyLogoUrl] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [clientProfileId, setClientProfileId] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [supportContext, setSupportContext] = useState(null)
  const [adminReady, setAdminReady] = useState(false)

  function success(text) {
    setNotice(text)
    setTimeout(() => setNotice(''), 3000)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoadingAuth(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
      }

      setSession(next)
      setLoadingAuth(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      bootstrapSession()
    } else {
      setAdminReady(false)
      setIsPlatformAdmin(false)
      setSupportContext(null)
    }
  }, [session?.user?.id])

  async function bootstrapSession() {
    setAdminReady(false)

    try {
      const {
        data: adminFlag,
        error: adminError
      } = await supabase.rpc(
        'is_platform_admin'
      )

      if (adminError) throw adminError

      const master =
        Boolean(adminFlag)

      if (!master) {
        const {
          data: accessActive,
          error: accessError
        } = await supabase.rpc('my_access_active')

        if (accessError) throw accessError

        if (!accessActive) {
          alert('Seu acesso a esta assistência foi removido pelo Supervisor.')
          await supabase.auth.signOut()
          return
        }
      }

      setIsPlatformAdmin(master)

      let context = null

      if (master) {
        const {
          data: contextData,
          error: contextError
        } = await supabase.rpc(
          'admin_get_support_context'
        )

        if (contextError) {
          throw contextError
        }

        context =
          Array.isArray(contextData)
            ? contextData[0] || null
            : contextData || null

        setSupportContext(context)
      } else {
        setSupportContext(null)
      }

      await loadAll({
        platformAdmin: master,
        supportCompany: context
      })

    } catch (e) {
      console.error(e)

      setError(
        e.message ||
        'Erro ao iniciar o sistema.'
      )
    } finally {
      setAdminReady(true)
    }
  }

  async function loadCompanyLogo(companyData) {
    if (!companyData?.logo_path) {
      setCompanyLogoUrl('')
      return
    }

    const { data, error } = await supabase.storage
      .from('company-logos')
      .createSignedUrl(companyData.logo_path, 60 * 60 * 24 * 7)

    if (error) {
      console.error(error)
      setCompanyLogoUrl('')
      return
    }

    setCompanyLogoUrl(data?.signedUrl || '')
  }

  async function loadAll(options = {}) {
    if (!session?.user) return

    const platformAdmin =
      options.platformAdmin ??
      isPlatformAdmin

    const effectiveSupport =
      Object.prototype.hasOwnProperty.call(
        options,
        'supportCompany'
      )
        ? options.supportCompany
        : supportContext

    setLoading(true)
    setError('')

    try {
      const profileRequest =
        platformAdmin &&
        effectiveSupport?.company_id
          ? Promise.resolve({
              data: {
                id: session.user.id,
                company_id:
                  effectiveSupport.company_id,
                full_name:
                  'Administrador Master',
                role: 'supervisor'
              },
              error: null
            })
          : supabase
              .from('profiles')
              .select('*')
              .eq(
                'id',
                session.user.id
              )
              .single()

      const [p, c, s, o] =
        await Promise.all([
          profileRequest,

        supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
          .from('services')
          .select('*')
          .order('name'),

        supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
      ])

      if (p.error) throw p.error
      if (c.error) throw c.error
      if (s.error) throw s.error
      if (o.error) throw o.error

      setProfile(p.data)
      setClients(c.data || [])
      setServices(s.data || [])
      setOrders(o.data || [])

      const { data: teamData, error: teamError } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .order('created_at', { ascending: true })

      if (teamError) throw teamError

      setTeam(teamData || [])

      if (p.data?.role === 'supervisor') {
        const { data: inviteData, error: inviteError } = await supabase
          .from('team_invites')
          .select('*')
          .order('created_at', { ascending: false })

        if (inviteError) throw inviteError

        setInvites(inviteData || [])
      } else {
        setInvites([])
      }

      if (p.data?.company_id) {
        const { data: co, error: ce } = await supabase
          .from('companies')
          .select('*')
          .eq('id', p.data.company_id)
          .single()

        if (ce) throw ce
        setCompany(co)
        await loadCompanyLogo(co)
      }
    } catch (e) {
      setError(e.message || 'Erro ao carregar os dados.')
    } finally {
      setLoading(false)
    }
  }

  async function addClient(form) {
    setError('')

    const { data, error: e } = await supabase
      .from('clients')
      .insert({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null
      })
      .select()
      .single()

    if (e) {
      setError(e.message)
      return false
    }

    setClients(prev => [data, ...prev])
    success('Cliente salvo com sucesso.')
    return true
  }

  async function importClients(items) {
    setError('')

    if (!items?.length) {
      setError('Nenhum cliente válido encontrado na planilha.')
      return false
    }

    const payload = items.map(item => ({
      name: item.name?.trim(),
      phone: item.phone?.trim() || null,
      email: item.email?.trim() || null,
      address: item.address?.trim() || null,
      notes: item.notes?.trim() || null
    })).filter(item => item.name)

    const { data, error: e } = await supabase
      .from('clients')
      .insert(payload)
      .select()

    if (e) {
      setError(e.message)
      return false
    }

    setClients(prev => [...(data || []), ...prev])
    success(`${data?.length || 0} cliente(s) importado(s) com sucesso.`)
    return true
  }

  async function updateClient(id, form) {
    setError('')

    const { data, error: e } = await supabase
      .from('clients')
      .update({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null
      })
      .eq('id', id)
      .select()
      .single()

    if (e) {
      setError(e.message)
      return false
    }

    setClients(prev => prev.map(c => c.id === id ? data : c))
    success('Cliente atualizado.')
    return true
  }

  async function deleteClient(id) {
    if (!confirm('Excluir este cliente?')) return

    const { error: e } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)

    if (e) {
      setError(e.message)
      return
    }

    setClients(prev => prev.filter(c => c.id !== id))
    success('Cliente excluído.')
  }

  async function addService(form) {
    setError('')

    const { data, error: e } = await supabase
      .from('services')
      .insert({
        name: form.name,
        price: Number(form.price || 0),
        warranty: form.warranty || null,
        description: form.description || null
      })
      .select()
      .single()

    if (e) {
      setError(e.message)
      return false
    }

    setServices(prev =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )

    success('Serviço salvo.')
    return true
  }

  async function updateService(id, form) {
    setError('')

    const { data, error: e } = await supabase
      .from('services')
      .update({
        name: form.name,
        price: Number(form.price || 0),
        warranty: form.warranty || null,
        description: form.description || null
      })
      .eq('id', id)
      .select()
      .single()

    if (e) {
      setError(e.message)
      return false
    }

    setServices(prev =>
      prev
        .map(service => service.id === id ? data : service)
        .sort((a, b) => a.name.localeCompare(b.name))
    )

    success('Serviço atualizado com sucesso.')
    return true
  }

  async function deleteService(id) {
    if (!confirm('Excluir este serviço?')) return

    const { error: e } = await supabase
      .from('services')
      .delete()
      .eq('id', id)

    if (e) {
      setError(e.message)
      return
    }

    setServices(prev => prev.filter(s => s.id !== id))
    success('Serviço excluído.')
  }

  async function createOrder(form) {
    setError('')

    const { data, error: e } = await supabase
      .from('orders')
      .insert({
        client_id: form.client_id || null,
        client_name: form.client_name,
        client_phone: form.client_phone || null,
        device: form.device,
        imei: form.imei || null,
        issue: form.issue || null,
        diagnosis: form.diagnosis || null,
        password_notes: form.password_notes || null,
        accessories: form.accessories || null,
        status: 'pending',
        labor_amount: Number(form.labor_amount || 0),
        total:
          Number(form.labor_amount || 0) +
          (form.parts || []).reduce(
            (sum, part) =>
              sum +
              Number(part.unit_price || 0) *
              Number(part.quantity || 0),
            0
          ),
        warranty: form.warranty || null,
        notes: form.notes || null
      })
      .select()
      .single()

    if (e) {
      setError(e.message)
      return false
    }

    if (form.parts?.length) {
      for (const part of form.parts) {
        const { error: partError } = await supabase.rpc(
          'reserve_order_part',
          {
            p_order_id: data.id,
            p_inventory_item_id: part.inventory_item_id,
            p_quantity: Number(part.quantity || 0),
            p_unit_price: Number(part.unit_price || 0)
          }
        )

        if (partError) {
          const { data: reservedRows } = await supabase
            .from('order_parts')
            .select('id')
            .eq('order_id', data.id)
            .eq('status', 'reserved')

          for (const reserved of reservedRows || []) {
            await supabase.rpc(
              'release_order_part',
              {
                p_order_part_id: reserved.id
              }
            )
          }

          await supabase
            .from('orders')
            .delete()
            .eq('id', data.id)

          setError(
            `Não foi possível reservar as peças: ${partError.message}`
          )

          return false
        }
      }
    }

    let fotosComErro = 0

    if (form.photos?.length) {
      for (const file of form.photos) {
        try {
          const originalExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
          const ext = /^[a-z0-9]+$/.test(originalExt) ? originalExt : 'jpg'
          const token = globalThis.crypto?.randomUUID?.()
            || `${Date.now()}-${Math.random().toString(36).slice(2)}`

          const path = `${profile.company_id}/${data.id}/${token}.${ext}`

          const { error: uploadError } = await supabase.storage
            .from('order-photos')
            .upload(path, file, {
              contentType: file.type || 'image/jpeg',
              upsert: false
            })

          if (uploadError) throw uploadError

          const { error: photoError } = await supabase
            .from('order_photos')
            .insert({
              order_id: data.id,
              storage_path: path,
              file_name: file.name
            })

          if (photoError) {
            await supabase.storage.from('order-photos').remove([path])
            throw photoError
          }
        } catch (fotoErro) {
          console.error('Erro ao enviar foto:', fotoErro)
          fotosComErro++
        }
      }
    }

    setOrders(prev => [data, ...prev])

    if (fotosComErro) {
      setError(`OS #${data.number} foi salva, mas ${fotosComErro} foto(s) não foram enviadas.`)
    } else {
      success(`OS #${data.number} criada com sucesso${form.photos?.length ? ` com ${form.photos.length} foto(s)` : ''}.`)
    }

    setTab('orders')
    return true
  }

  async function updateOrder(id, patch) {
    const { data, error: e } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (e) {
      setError(e.message)
      return false
    }

    setOrders(prev => prev.map(o => o.id === id ? data : o))
    success('OS atualizada.')
    return true
  }

  async function saveCompanyBranding(form, logoFile) {
    if (!company?.id) return false

    setError('')

    try {
      let logoPath = company.logo_path || null

      if (logoFile) {
        if (!logoFile.type?.startsWith('image/')) {
          throw new Error('Selecione uma imagem válida para a logo.')
        }

        if (logoFile.size > 3 * 1024 * 1024) {
          throw new Error('A logo deve ter no máximo 3 MB.')
        }

        const extOriginal = (logoFile.name.split('.').pop() || 'png').toLowerCase()
        const ext = /^[a-z0-9]+$/.test(extOriginal) ? extOriginal : 'png'

        const newPath = `${company.id}/logo-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(newPath, logoFile, {
            contentType: logoFile.type,
            upsert: false
          })

        if (uploadError) throw uploadError

        if (company.logo_path && company.logo_path !== newPath) {
          await supabase.storage
            .from('company-logos')
            .remove([company.logo_path])
        }

        logoPath = newPath
      }

      const { data, error } = await supabase
        .from('companies')
        .update({
          name: form.name.trim(),
          logo_path: logoPath
        })
        .eq('id', company.id)
        .select()
        .single()

      if (error) throw error

      setCompany(data)
      await loadCompanyLogo(data)

      success('Identidade da assistência atualizada.')
      return true

    } catch (e) {
      setError(e.message || 'Não foi possível salvar a identidade.')
      return false
    }
  }

  async function createTeamInvite(email) {
    setError('')

    if (profile?.role !== 'supervisor') {
      setError('Somente o supervisor pode adicionar técnicos.')
      return null
    }

    if (team.length >= Number(company?.max_users || 1)) {
      setError('O limite de usuários do plano foi atingido.')
      return null
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Informe o e-mail do técnico.')
      return null
    }

    const { data, error: e } = await supabase
      .from('team_invites')
      .insert({
        company_id: profile.company_id,
        email: normalizedEmail,
        created_by: session.user.id
      })
      .select()
      .single()

    if (e) {
      setError(e.message)
      return null
    }

    setInvites(prev => [data, ...prev])
    success('Convite para técnico criado.')

    return data
  }

  async function deleteTeamInvite(id) {
    const { error: e } = await supabase
      .from('team_invites')
      .delete()
      .eq('id', id)

    if (e) {
      setError(e.message)
      return
    }

    setInvites(prev => prev.filter(x => x.id !== id))
    success('Convite cancelado.')
  }

  async function enterSupport(companyData) {
    setError('')

    const {
      data,
      error
    } = await supabase.rpc(
      'admin_set_support_company',
      {
        p_company_id:
          companyData.company_id
      }
    )

    if (error) {
      setError(error.message)
      return
    }

    const context =
      Array.isArray(data)
        ? data[0] || null
        : data || null

    setSupportContext(context)
    setTab('dashboard')
    setMobileMenu(false)

    await loadAll({
      platformAdmin: true,
      supportCompany: context
    })
  }

  async function exitSupport() {
    setError('')

    const { error } =
      await supabase.rpc(
        'admin_clear_support_company'
      )

    if (error) {
      setError(error.message)
      return
    }

    setSupportContext(null)
    setTab('master')
    setMobileMenu(false)

    await loadAll({
      platformAdmin: true,
      supportCompany: null
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#0B1220] grid place-items-center text-white">
        <div className="text-center">
          <img
            src="/automatize-os.png"
            alt="Automatize OS"
            className="w-44 mx-auto mb-3 rounded-xl"
          />
          <p>Carregando Automatize OS...</p>
        </div>
      </div>
    )
  }

  if (passwordRecovery && session) {
    return (
      <PasswordRecoveryScreen
        onDone={() => {
          setPasswordRecovery(false)

          window.history.replaceState(
            {},
            document.title,
            window.location.origin + window.location.pathname
          )
        }}
      />
    )
  }

  if (!session) return <AuthScreen />

  if (!adminReady) {
    return (
      <div className="min-h-screen bg-[#0B1220] grid place-items-center text-white">
        <div className="text-center">
          <img
            src="/automatize-os.png"
            alt="Automatize OS"
            className="w-44 mx-auto mb-3 rounded-xl"
          />
          <p>Preparando Automatize OS...</p>
        </div>
      </div>
    )
  }

  const subscriptionAccess =
    getSubscriptionAccess(company)

  if (
    company &&
    !isPlatformAdmin &&
    !subscriptionAccess.active
  ) {
    return (
      <SubscriptionLockedScreen
        company={company}
        onSignOut={signOut}
      />
    )
  }

  const pending = orders.filter(o =>
    ['pending', 'in_progress', 'awaiting_part'].includes(o.status)
  ).length

  const completed = orders.filter(o =>
    ['completed', 'delivered'].includes(o.status)
  ).length

  const revenue = orders
    .filter(o => ['completed', 'delivered'].includes(o.status))
    .reduce((a, b) => a + Number(b.total || 0), 0)

  const isSupervisor = profile?.role === 'supervisor'

  const nav = [
    ['dashboard', <Home size={19}/>, isSupervisor ? 'Painel Supervisor' : 'Painel Técnico'],
    ...(isPlatformAdmin ? [[
      'master',
      <ShieldCheck size={19}/>,
      'Painel Master'
    ]] : []),
    ['orders', <FileText size={19}/>, 'Ordens de Serviço'],
    ['clients', <Users size={19}/>, 'Clientes'],
    ...(isSupervisor ? [
      ['catalog', <Package size={19}/>, 'Catálogo'],
      ['inventory', <Package size={19}/>, 'Estoque'],
      ['finance', <DollarSign size={19}/>, 'Financeiro'],
      ['team', <Users size={19}/>, 'Equipe']
    ] : []),
    ['settings', <Settings size={19}/>, 'Minha conta']
  ]

  return (
    <div
      className="flex h-screen bg-[#F6F7F9] text-slate-800"
      style={{ '--brand-color': '#F4B63A' }}
    >

      <aside className="hidden md:flex flex-col w-64 bg-[#0B1220] text-white">
        <div className="p-6 flex items-center gap-3">
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt="Logo"
              className="w-11 h-11 rounded-xl object-contain bg-white p-1"
            />
          ) : (
            <div
              className="p-2.5 rounded-xl text-white"
              style={{ backgroundColor: 'var(--brand-color)' }}
            >
              <Wrench size={23}/>
            </div>
          )}

          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">
              {company?.name || 'Assistência Técnica'}
            </h1>
            <p className="text-[11px] text-slate-400">
              Powered by Automatize OS
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {nav.map(([id, icon, label]) => (
            <NavItem
              key={id}
              icon={icon}
              label={label}
              active={tab === id}
              onClick={() => setTab(id)}
            />
          ))}
        </nav>

        <div className="m-4 p-4 bg-white/5 rounded-2xl">
          <p className="text-xs text-slate-400">Empresa</p>
          <p className="font-semibold truncate mt-1">
            {company?.name || 'Automatize OS'}
          </p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">

        <header className="h-16 bg-white/95 border-b border-slate-200 flex items-center justify-between px-4 md:px-7">

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenu(v => !v)}
          >
            {mobileMenu ? <X/> : <Menu/>}
          </button>

          <div className="hidden md:block">
            <p className="font-semibold">
              {tab === 'new-order'
                ? 'Nova Ordem de Serviço'
                : nav.find(n => n[0] === tab)?.[2]}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAll}
              className="p-2.5 rounded-xl hover:bg-slate-100"
            >
              <RefreshCw size={18}/>
            </button>

            <button
              onClick={() => setTab('settings')}
              className="w-10 h-10 rounded-full bg-slate-900 text-white font-semibold overflow-hidden"
            >
              {companyLogoUrl ? (
                <img
                  src={companyLogoUrl}
                  alt="Logo da assistência"
                  className="w-full h-full object-contain bg-white p-1"
                />
              ) : (
                (profile?.full_name || session.user.email || 'T')[0].toUpperCase()
              )}
            </button>
          </div>
        </header>

        {isPlatformAdmin && supportContext && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 md:px-7 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-700">
                MODO SUPORTE
              </p>

              <p className="text-sm text-amber-900">
                Você está acessando:
                {' '}
                <b>
                  {supportContext.company_name}
                </b>
              </p>
            </div>

            <button
              type="button"
              onClick={exitSupport}
              className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold"
            >
              Voltar ao Painel Master
            </button>
          </div>
        )}

        {mobileMenu && (
          <div className="md:hidden absolute top-16 left-0 right-0 z-50 bg-[#0B1220] p-4 space-y-1 shadow-2xl">
            {nav.map(([id, icon, label]) => (
              <NavItem
                key={id}
                icon={icon}
                label={label}
                active={tab === id}
                onClick={() => {
                  setTab(id)
                  setMobileMenu(false)
                }}
              />
            ))}

            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-300"
            >
              <LogOut size={19}/> Sair
            </button>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-7">

          {notice && (
            <div className="max-w-7xl mx-auto mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3">
              <CheckCircle size={18} className="inline mr-2"/>
              {notice}
            </div>
          )}

          {error && (
            <div className="max-w-7xl mx-auto mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex gap-2">
              <AlertCircle size={18}/>
              <span className="text-sm">{error}</span>
              <button onClick={() => setError('')} className="ml-auto">
                <X size={17}/>
              </button>
            </div>
          )}

          {loading && (
            <p className="text-sm text-slate-500 mb-3">
              Sincronizando...
            </p>
          )}

          {tab === 'master' && isPlatformAdmin && (
            <MasterAdminView
              onEnterSupport={enterSupport}
            />
          )}

          {tab === 'dashboard' && (
            <Dashboard
              orders={orders}
              pending={pending}
              completed={completed}
              revenue={revenue}
              isSupervisor={isSupervisor}
              onNew={() => setTab('new-order')}
              onClient={id => setClientProfileId(id)}
              onEdit={id => setSelectedOrderId(id)}
              company={company}
              companyLogoUrl={companyLogoUrl}
            />
          )}

          {tab === 'orders' && (
            <Orders
              orders={orders}
              onNew={() => setTab('new-order')}
              onUpdate={updateOrder}
              onEdit={id => setSelectedOrderId(id)}
            />
          )}

          {tab === 'new-order' && (
            <NewOrder
              clients={clients}
              services={services}
              onSave={createOrder}
              onCancel={() => setTab('orders')}
            />
          )}

          {tab === 'clients' && (
            <Clients
              clients={clients}
              orders={orders}
              onAdd={addClient}
              onImport={importClients}
              onUpdate={updateClient}
              onDelete={deleteClient}
            />
          )}

          {tab === 'catalog' && (
            <Catalog
              services={services}
              onAdd={addService}
              onUpdate={updateService}
              onDelete={deleteService}
            />
          )}

          {tab === 'inventory' && isSupervisor && (
            <InventoryView />
          )}

          {tab === 'finance' && isSupervisor && (
            <FinanceView
              orders={orders}
              clients={clients}
            />
          )}

          {tab === 'team' && isSupervisor && (
            <TeamManagementView
              company={company}
              invites={invites}
              currentUserId={session?.user?.id}
              onCreateInvite={createTeamInvite}
              onDeleteInvite={deleteTeamInvite}
            />
          )}

          {tab === 'settings' && (
            isSupervisor ? (
              <SettingsView
                company={company}
                profile={profile}
                session={session}
                isPlatformAdmin={isPlatformAdmin}
                onSignOut={signOut}
                companyLogoUrl={companyLogoUrl}
                onSaveCompany={saveCompanyBranding}
              />
            ) : (
              <TechnicianSettings
                company={company}
                profile={profile}
                session={session}
                onSignOut={signOut}
              />
            )
          )}

        </main>
      </div>

      {selectedOrderId && orders.find(o => o.id === selectedOrderId) && (
        <EditOrderModal
          order={orders.find(o => o.id === selectedOrderId)}
          clients={clients}
          services={services}
          onSave={updateOrder}
          onClose={() => setSelectedOrderId(null)}
        />
      )}

      {clientProfileId && clients.find(c => c.id === clientProfileId) && (
        <ClientProfile
          client={clients.find(c => c.id === clientProfileId)}
          orders={orders.filter(o => o.client_id === clientProfileId)}
          onUpdate={updateClient}
          onDelete={deleteClient}
          onClose={() => setClientProfileId(null)}
        />
      )}
    </div>
  )
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:bg-white/10'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  )
}


function PasswordRecoveryScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setMsg('')

    if (password.length < 8) {
      setErr('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErr('As senhas não coincidem.')
      return
    }

    setBusy(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password
      })

      if (error) throw error

      setMsg('Senha alterada com sucesso.')

      setTimeout(() => {
        onDone?.()
      }, 700)
    } catch (e) {
      setErr(
        e.message ||
        'Não foi possível alterar a senha.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[28px] shadow-2xl p-7">

        <div className="mb-7 text-center">
          <div className="bg-black rounded-2xl p-3 mb-4">
            <img
              src="/automatize-os.png"
              alt="Automatize OS"
              className="w-full max-w-[240px] mx-auto rounded-xl"
            />
          </div>

          <h1 className="text-xl font-bold">
            Criar nova senha
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Digite uma nova senha para sua conta.
          </p>
        </div>

        {err && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm">
            {err}
          </div>
        )}

        {msg && (
          <div className="bg-green-50 text-green-700 p-3 rounded-xl mb-4 text-sm">
            {msg}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Nova senha"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Mínimo de 8 caracteres"
            required
          />

          <Field
            label="Confirmar nova senha"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Digite a senha novamente"
            required
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold disabled:opacity-50"
          >
            {busy ? 'Salvando...' : 'Alterar senha'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-400 mt-6">
          Powered by Automatize OS
        </p>
      </div>
    </div>
  )
}

function AuthScreen() {
  const inviteParams = new URLSearchParams(window.location.search)
  const initialInviteCode = inviteParams.get('invite') || ''
  const initialInviteEmail = inviteParams.get('email') || ''

  const [register, setRegister] = useState(Boolean(initialInviteCode))
  const [email, setEmail] = useState(initialInviteEmail)
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function sendPasswordReset() {
    setErr('')
    setMsg('')

    const targetEmail = email.trim()

    if (!targetEmail) {
      setErr('Informe seu e-mail para recuperar a senha.')
      return
    }

    setBusy(true)

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          targetEmail,
          {
            redirectTo:
              `${window.location.origin}/?reset=1`
          }
        )

      if (error) throw error

      setMsg(
        'Se este e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.'
      )
    } catch (e) {
      setErr(
        e.message ||
        'Não foi possível solicitar a recuperação da senha.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')

    try {
      if (register) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              company_name: company,
              invite_code: inviteCode.trim()
            }
          }
        })

        if (error) throw error
        setMsg(
          inviteCode.trim()
            ? 'Acesso de técnico criado. Verifique seu e-mail se solicitado.'
            : 'Conta de supervisor criada. Verifique seu e-mail se solicitado.'
        )
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4">

      <div className="w-full max-w-md bg-white rounded-[28px] shadow-2xl p-7">

        <div className="mb-7 text-center">
          <div className="bg-black rounded-2xl p-3 mb-4">
            <img
              src="/automatize-os.png"
              alt="Automatize OS"
              className="w-full max-w-[240px] mx-auto rounded-xl"
            />
          </div>

          <p className="text-sm text-slate-500">
            Gestão para assistência técnica
          </p>
        </div>

        {err && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm">
            {err}
          </div>
        )}

        {msg && (
          <div className="bg-green-50 text-green-700 p-3 rounded-xl mb-4 text-sm">
            {msg}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">

          {register && (
            <>
              <Field
                label="Seu nome"
                value={name}
                onChange={setName}
                required
              />

              <Field
                label="Código de convite da equipe"
                value={inviteCode}
                onChange={setInviteCode}
                placeholder="Opcional para técnicos"
              />

              {!inviteCode.trim() && (
                <Field
                  label="Nome da assistência"
                  value={company}
                  onChange={setCompany}
                  placeholder="Nome da sua empresa"
                  required
                />
              )}

              {inviteCode.trim() && (
                <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm p-3 rounded-xl">
                  Você está criando um acesso de Técnico para uma assistência existente.
                </div>
              )}
            </>
          )}

          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="Digite seu e-mail"
            required
          />

          <Field
            label="Senha"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Digite sua senha"
            required
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold disabled:opacity-50"
          >
            {busy
              ? 'Aguarde...'
              : register
                ? 'Criar conta'
                : 'Entrar'}
          </button>
        </form>

        {!register && (
          <button
            type="button"
            onClick={sendPasswordReset}
            disabled={busy}
            className="w-full mt-4 text-sm font-semibold text-slate-600 disabled:opacity-50"
          >
            Esqueci minha senha
          </button>
        )}

        <button
          type="button"
          onClick={() => setRegister(v => !v)}
          className="w-full mt-5 text-sm text-blue-600"
        >
          {register
            ? 'Já tenho uma conta'
            : 'Ainda não tenho conta'}
        </button>
      </div>
    </div>
  )
}

function Dashboard({ orders, pending, completed, revenue, isSupervisor, onNew, onClient, onEdit }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-sm text-slate-500">Visão geral</p>
          <h1 className="text-2xl font-bold">
            {isSupervisor ? 'Painel do Supervisor' : 'Painel do Técnico'}
          </h1>
        </div>

        <button onClick={onNew} className="btn-primary">
          <Plus size={19}/> Nova OS
        </button>
      </div>

      <div className={`grid ${isSupervisor ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        <Stat
          title="OS em andamento"
          value={pending}
          icon={<Clock/>}
        />

        <Stat
          title="OS concluídas"
          value={completed}
          icon={<CheckCircle/>}
        />

        {isSupervisor && (
          <Stat
            title="Faturamento"
            value={money(revenue)}
            icon={<DollarSign/>}
          />
        )}
      </div>

      <div className="surface overflow-hidden">
        <div className="p-5 border-b font-semibold">Últimas OS</div>

        {orders.length === 0 ? (
          <Empty text="Nenhuma OS cadastrada."/>
        ) : (
          orders.slice(0, 5).map(o => (
            <div
              key={o.id}
              onClick={() => onEdit(o.id)}
              className="p-4 border-b last:border-0 flex justify-between gap-3 cursor-pointer hover:bg-slate-50 active:bg-slate-100"
            >
              <div>
                {o.client_id ? (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      onClient(o.client_id)
                    }}
                    className="font-bold text-left hover:text-blue-600 active:text-blue-700"
                  >
                    {o.client_name || 'Cliente'}
                  </button>
                ) : (
                  <b>{o.client_name || 'Cliente'}</b>
                )}
                <p className="text-sm text-slate-500">
                  OS #{o.number} • {o.device}
                </p>
              </div>

              <StatusBadge status={o.status}/>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Stat({ title, value, icon }) {
  return (
    <div className="surface p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>

      <div className="p-3 bg-slate-100 rounded-xl text-blue-600">
        {icon}
      </div>
    </div>
  )
}

function Clients({ clients, orders, onAdd, onImport, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [importing, setImporting] = useState(false)

  function normalizeHeader(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  }

  function text(value) {
    if (value === null || value === undefined) return ''
    return String(value).trim()
  }

  async function handleImport(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('A planilha deve ter no máximo 5 MB.')
      return
    }

    setImporting(true)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })

      const firstSheet = workbook.SheetNames[0]

      if (!firstSheet) {
        throw new Error('A planilha está vazia.')
      }

      const rawRows = XLSX.utils.sheet_to_json(
        workbook.Sheets[firstSheet],
        { defval: '' }
      )

      if (!rawRows.length) {
        throw new Error('Nenhuma linha encontrada na planilha.')
      }

      if (rawRows.length > 2000) {
        throw new Error('Importe no máximo 2.000 clientes por vez.')
      }

      const rows = rawRows.map(row => {
        const normalized = {}

        Object.entries(row).forEach(([key, value]) => {
          normalized[normalizeHeader(key)] = value
        })

        const get = (...keys) => {
          for (const key of keys) {
            const value = normalized[normalizeHeader(key)]
            if (value !== undefined && value !== null && text(value)) {
              return text(value)
            }
          }
          return ''
        }

        return {
          name: get('Nome', 'Cliente', 'Name'),
          phone: get(
            'WhatsApp',
            'Telefone',
            'Celular',
            'Fone',
            'Phone'
          ),
          email: get('E-mail', 'Email'),
          address: get(
            'Endereço',
            'Endereco',
            'Endereço completo',
            'Endereco completo',
            'Address'
          ),
          notes: get(
            'Observações',
            'Observacoes',
            'Observação',
            'Observacao',
            'Obs',
            'Notes'
          )
        }
      }).filter(row => row.name)

      if (!rows.length) {
        throw new Error(
          'Não encontrei a coluna Nome. Use uma coluna chamada Nome ou Cliente.'
        )
      }

      const ok = await onImport(rows)

      if (ok) {
        alert(`${rows.length} cliente(s) importado(s) com sucesso.`)
      }
    } catch (error) {
      alert(error.message || 'Não foi possível importar a planilha.')
    } finally {
      setImporting(false)
    }
  }

  function exportClients() {
    if (!clients.length) {
      alert('Não há clientes para exportar.')
      return
    }

    const rows = clients.map(client => ({
      'Nome': client.name || '',
      'WhatsApp': client.phone || '',
      'E-mail': client.email || '',
      'Endereço': client.address || '',
      'Observações': client.notes || ''
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)

    worksheet['!cols'] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 32 },
      { wch: 45 },
      { wch: 45 }
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes')

    const date = new Date().toISOString().slice(0, 10)

    XLSX.writeFile(
      workbook,
      `clientes-automatize-os-${date}.xlsx`
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <p className="text-sm text-slate-500">Cadastros</p>
          <h1 className="text-2xl font-bold">Clientes</h1>
        </div>

        <div className="flex flex-wrap gap-2">

          <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border bg-white font-medium cursor-pointer hover:bg-slate-50">
            <Upload size={18}/>
            {importing ? 'Importando...' : 'Importar'}

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={exportClients}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border bg-white font-medium hover:bg-slate-50"
          >
            <Download size={18}/>
            Exportar
          </button>

          <button
            onClick={() => setOpen(true)}
            className="btn-primary"
          >
            <Plus size={19}/> Novo
          </button>

        </div>
      </div>

      <div className="surface overflow-hidden">

        {clients.length === 0 ? (
          <Empty text="Nenhum cliente cadastrado."/>
        ) : (
          clients.map(client => (
            <button
              key={client.id}
              onClick={() => setSelected(client)}
              className="w-full p-4 border-b last:border-0 flex items-center text-left hover:bg-slate-50"
            >
              <div className="w-11 h-11 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center font-bold mr-3">
                {client.name?.[0]?.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{client.name}</p>
                <p className="text-sm text-slate-500 truncate">
                  {client.phone || 'Sem telefone'}
                </p>
              </div>

              <ChevronRight size={20} className="text-slate-400"/>
            </button>
          ))
        )}
      </div>

      {open && (
        <NewClientModal
          onClose={() => setOpen(false)}
          onSave={onAdd}
        />
      )}

      {selected && (
        <ClientProfile
          client={clients.find(c => c.id === selected.id) || selected}
          orders={orders.filter(o => o.client_id === selected.id)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function NewClientModal({ onClose, onSave }) {
  const [f, setF] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  })

  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)

    const ok = await onSave(f)

    setSaving(false)

    if (ok) onClose()
  }

  return (
    <Modal title="Novo cliente" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">

        <Field
          label="Nome *"
          value={f.name}
          onChange={v => setF({...f, name:v})}
          required
        />

        <Field
          label="WhatsApp"
          value={f.phone}
          onChange={v => setF({...f, phone:v})}
        />

        <Field
          label="E-mail"
          type="email"
          value={f.email}
          onChange={v => setF({...f, email:v})}
        />

        <Field
          label="Endereço completo"
          value={f.address}
          onChange={v => setF({...f, address:v})}
          placeholder="Rua, número, bairro, cidade - UF"
          area
        />

        <Field
          label="Observações"
          value={f.notes}
          onChange={v => setF({...f, notes:v})}
          area
        />

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full justify-center"
        >
          <Save size={18}/>
          {saving ? 'Salvando...' : 'Salvar cliente'}
        </button>
      </form>
    </Modal>
  )
}

function ClientProfile({
  client,
  orders,
  onUpdate,
  onDelete,
  onClose
}) {
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)

  const [f, setF] = useState({
    name: client.name || '',
    phone: client.phone || '',
    email: client.email || '',
    address: client.address || '',
    notes: client.notes || ''
  })

  async function save() {
    setSaving(true)
    const ok = await onUpdate(client.id, f)
    setSaving(false)

    if (ok) setEdit(false)
  }

  return (
    <Modal title="Perfil do cliente" onClose={onClose}>

      <div className="space-y-5">

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 text-white rounded-full grid place-items-center text-xl font-bold">
            {client.name?.[0]?.toUpperCase()}
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-lg">{client.name}</h3>
            <p className="text-sm text-slate-500">
              Cliente desde {dateBR(client.created_at)}
            </p>
          </div>

          <button
            onClick={() => setEdit(v => !v)}
            className="p-2 rounded-xl border"
          >
            <Pencil size={18}/>
          </button>
        </div>

        {edit ? (
          <div className="space-y-3">
            <Field
              label="Nome"
              value={f.name}
              onChange={v => setF({...f, name:v})}
            />

            <Field
              label="WhatsApp"
              value={f.phone}
              onChange={v => setF({...f, phone:v})}
            />

            <Field
              label="E-mail"
              value={f.email}
              onChange={v => setF({...f, email:v})}
            />

            <Field
              label="Endereço completo"
              value={f.address}
              onChange={v => setF({...f, address:v})}
              placeholder="Rua, número, bairro, cidade - UF"
              area
            />

            <Field
              label="Observações"
              value={f.notes}
              onChange={v => setF({...f, notes:v})}
              area
            />

            <button
              onClick={save}
              disabled={saving}
              className="btn-primary w-full justify-center"
            >
              <Save size={18}/>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-500">WhatsApp</p>
              <p>{client.phone || '-'}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">E-mail</p>
              <p>{client.email || '-'}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Endereço</p>
              <p>{client.address || '-'}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Observações</p>
              <p>{client.notes || '-'}</p>
            </div>
          </div>
        )}

        <div>
          <h4 className="font-semibold mb-3">
            Histórico de OS ({orders.length})
          </h4>

          {orders.length === 0 ? (
            <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl">
              Nenhuma OS para este cliente.
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <div
                  key={o.id}
                  className="border rounded-xl p-3 flex justify-between gap-3"
                >
                  <div>
                    <b>OS #{o.number}</b>
                    <p className="text-sm text-slate-500">{o.device}</p>
                  </div>

                  <StatusBadge status={o.status}/>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={async () => {
            await onDelete(client.id)
            onClose()
          }}
          className="w-full py-3 text-red-600 border border-red-200 rounded-xl"
        >
          Excluir cliente
        </button>
      </div>
    </Modal>
  )
}


function EditOrderModal({ order, clients, services, onSave, onClose }) {
  const [saving, setSaving] = useState(false)

  const [f, setF] = useState({
    client_id: order.client_id || '',
    client_name: order.client_name || '',
    client_phone: order.client_phone || '',
    device: order.device || '',
    imei: order.imei || '',
    issue: order.issue || '',
    diagnosis: order.diagnosis || '',
    password_notes: order.password_notes || '',
    accessories: order.accessories || '',
    status: order.status || 'pending',
    labor_amount:
      order.labor_amount ?? order.total ?? '',
    parts_total: 0,
    total: order.total || '',
    warranty: order.warranty || '',
    notes: order.notes || ''
  })

  function set(k, v) {
    setF(prev => ({ ...prev, [k]: v }))
  }

  function selectClient(id) {
    const c = clients.find(x => String(x.id) === String(id))

    setF(prev => ({
      ...prev,
      client_id: id,
      client_name: c?.name || prev.client_name,
      client_phone: c?.phone || prev.client_phone
    }))
  }

  function setLaborAmount(value) {
    setF(prev => ({
      ...prev,
      labor_amount: value,
      total:
        Number(value || 0) +
        Number(prev.parts_total || 0)
    }))
  }

  function setPartsTotal(value) {
    setF(prev => ({
      ...prev,
      parts_total: Number(value || 0),
      total:
        Number(prev.labor_amount || 0) +
        Number(value || 0)
    }))
  }

  function selectService(id) {
    const service = services.find(x => String(x.id) === String(id))

    if (service) {
      setF(prev => ({
        ...prev,
        labor_amount: service.price,
        total:
          Number(service.price || 0) +
          Number(prev.parts_total || 0),
        warranty: service.warranty || ''
      }))
    }
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)

    const ok = await onSave(order.id, {
      client_id: f.client_id || null,
      client_name: f.client_name,
      client_phone: f.client_phone || null,
      device: f.device,
      imei: f.imei || null,
      issue: f.issue || null,
      diagnosis: f.diagnosis || null,
      password_notes: f.password_notes || null,
      accessories: f.accessories || null,
      status: f.status,
      labor_amount: Number(f.labor_amount || 0),
      total:
        Number(f.labor_amount || 0) +
        Number(f.parts_total || 0),
      warranty: f.warranty || null,
      notes: f.notes || null
    })

    setSaving(false)

    if (ok) onClose()
  }

  return (
    <Modal title={`Editar OS #${order.number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">

        <label>
          <span className="label">Cliente cadastrado</span>
          <select
            value={f.client_id}
            onChange={e => selectClient(e.target.value)}
            className="input"
          >
            <option value="">Sem vínculo / cliente digitado</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <Field
          label="Nome do cliente *"
          value={f.client_name}
          onChange={v => set('client_name', v)}
          required
        />

        <Field
          label="WhatsApp"
          value={f.client_phone}
          onChange={v => set('client_phone', v)}
        />

        <Field
          label="Aparelho / modelo *"
          value={f.device}
          onChange={v => set('device', v)}
          required
        />

        <Field
          label="IMEI"
          value={f.imei}
          onChange={v => set('imei', v)}
        />

        <Field
          label="Defeito relatado"
          value={f.issue}
          onChange={v => set('issue', v)}
          area
        />

        <Field
          label="Diagnóstico"
          value={f.diagnosis}
          onChange={v => set('diagnosis', v)}
          area
        />

        <label>
          <span className="label">Status</span>
          <select
            value={f.status}
            onChange={e => set('status', e.target.value)}
            className="input"
          >
            <option value="pending">Aguardando</option>
            <option value="in_progress">Em análise</option>
            <option value="awaiting_part">Aguardando peça</option>
            <option value="completed">Finalizado</option>
            <option value="delivered">Entregue</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>

        <label>
          <span className="label">Serviço do catálogo</span>
          <select
            onChange={e => selectService(e.target.value)}
            className="input"
          >
            <option value="">Selecionar serviço...</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name} — {money(service.price)}
              </option>
            ))}
          </select>
        </label>

        <Field
          label="Mão de obra"
          type="number"
          value={f.labor_amount}
          onChange={setLaborAmount}
        />

        <OrderPartsSelector
          orderId={order.id}
          onTotalChange={setPartsTotal}
        />

        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex justify-between items-center gap-3">
          <div>
            <p className="text-sm text-emerald-700">
              Total da OS
            </p>
            <p className="text-xs text-emerald-600">
              Mão de obra + peças
            </p>
          </div>

          <p className="text-xl font-bold text-emerald-700">
            {money(f.total)}
          </p>
        </div>

        <Field
          label="Garantia"
          value={f.warranty}
          onChange={v => set('warranty', v)}
        />

        <Field
          label="Senha / padrão"
          value={f.password_notes}
          onChange={v => set('password_notes', v)}
        />

        <Field
          label="Acessórios recebidos"
          value={f.accessories}
          onChange={v => set('accessories', v)}
        />

        <Field
          label="Observações"
          value={f.notes}
          onChange={v => set('notes', v)}
          area
        />

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full justify-center"
        >
          <Save size={18}/>
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>

      </form>
    </Modal>
  )
}

function Orders({ orders, onNew, onUpdate, onEdit, company, companyLogoUrl }) {
  const [q, setQ] = useState('')

  const filtered = orders.filter(o =>
    `${o.number} ${o.client_name || ''} ${o.device || ''}`
      .toLowerCase()
      .includes(q.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-500">Atendimentos</p>
          <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
        </div>

        <button onClick={onNew} className="btn-primary">
          <Plus size={19}/> Nova OS
        </button>
      </div>

      <div className="surface p-3 flex gap-2 items-center">
        <Search size={18} className="text-slate-400"/>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full outline-none"
          placeholder="Buscar OS, cliente ou aparelho..."
        />
      </div>

      <div className="space-y-3">

        {filtered.length === 0 ? (
          <div className="surface">
            <Empty text="Nenhuma OS encontrada."/>
          </div>
        ) : (
          filtered.map(o => (
            <div
              key={o.id}
              onClick={() => onEdit(o.id)}
              className="surface p-4 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition"
            >

              <div className="flex justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm text-blue-600 font-semibold">
                    OS #{o.number}
                  </p>

                  <h3 className="font-bold">{o.client_name}</h3>

                  <p className="text-sm text-slate-500">
                    {o.device} • {dateBR(o.created_at)}
                  </p>
                </div>

                <b>{money(o.total)}</b>
              </div>

              <select
                value={o.status}
                onClick={e => e.stopPropagation()}
                onChange={e => onUpdate(o.id, {status:e.target.value})}
                className="input"
              >
                <option value="pending">Aguardando</option>
                <option value="in_progress">Em análise</option>
                <option value="awaiting_part">Aguardando peça</option>
                <option value="completed">Finalizado</option>
                <option value="delivered">Entregue</option>
                <option value="cancelled">Cancelado</option>
              </select>

              <div className="grid grid-cols-3 gap-2 mt-3">

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onEdit(o.id)
                  }}
                  className="py-2.5 border rounded-xl text-sm font-medium text-blue-600"
                >
                  <Pencil size={17} className="inline mr-1"/>
                  Editar
                </button>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    whatsapp(o)
                  }}
                  className="py-2.5 border rounded-xl text-sm"
                >
                  <MessageCircle size={17} className="inline mr-1"/>
                  WhatsApp
                </button>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    printOrder(o, company, companyLogoUrl)
                  }}
                  className="py-2.5 border rounded-xl text-sm"
                >
                  <Printer size={17} className="inline mr-1"/>
                  Imprimir
                </button>

              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function whatsapp(o) {
  const phone = (o.client_phone || '').replace(/\D/g, '')

  const text =
    `Olá, ${o.client_name || ''}! Sua OS #${o.number} - ${o.device} está com status: ${statusLabels[o.status]}.`

  window.open(
    `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`,
    '_blank'
  )
}

async function printOrder(o, company, logoUrl) {
  const w = window.open('', '_blank')
  if (!w) return

  const { data: partsData, error: partsError } = await supabase
    .from('order_parts')
    .select(`
      quantity,
      unit_price,
      status,
      inventory_items (
        name
      )
    `)
    .eq('order_id', o.id)
    .neq('status', 'cancelled')

  if (partsError) {
    console.error('Erro ao carregar peças da OS:', partsError)
  }

  const parts = partsError ? [] : (partsData || [])

  const partsTotal = parts.reduce(
    (total, part) =>
      total +
      Number(part.unit_price || 0) *
      Number(part.quantity || 0),
    0
  )

  const partsRows = parts
    .map(part => {
      const name =
        part.inventory_items?.name || 'Peça'

      return (
        '<tr>' +
          '<td>' + name + '</td>' +
          '<td style="text-align:center">' +
            Number(part.quantity || 0) +
          '</td>' +
          '<td style="text-align:right">' +
            money(part.unit_price) +
          '</td>' +
          '<td style="text-align:right">' +
            money(
              Number(part.unit_price || 0) *
              Number(part.quantity || 0)
            ) +
          '</td>' +
        '</tr>'
      )
    })
    .join('')

  const partsHtml = parts.length
    ? (
        '<div class="box">' +
          '<p><b>Peças / materiais</b></p>' +
          '<table style="width:100%;border-collapse:collapse;margin-top:10px">' +
            '<thead>' +
              '<tr>' +
                '<th style="text-align:left">Item</th>' +
                '<th style="text-align:center">Qtd.</th>' +
                '<th style="text-align:right">Unit.</th>' +
                '<th style="text-align:right">Total</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              partsRows +
            '</tbody>' +
          '</table>' +
        '</div>'
      )
    : ''

  const companyName = company?.name || 'Assistência Técnica'
  const brandColor = '#F4B63A'

  w.document.write(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>OS #${o.number} - ${companyName}</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 32px;
            color: #172033;
          }

          .header {
            display: flex;
            align-items: center;
            gap: 18px;
            padding-bottom: 20px;
            border-bottom: 3px solid ${brandColor};
            margin-bottom: 25px;
          }

          .logo {
            max-width: 95px;
            max-height: 65px;
            object-fit: contain;
          }

          h1 {
            margin: 0;
            font-size: 25px;
          }

          .sub {
            color: #64748b;
            margin-top: 5px;
          }

          .title {
            font-size: 22px;
            margin: 25px 0 18px;
          }

          .box {
            border: 1px solid #dbe1e8;
            border-radius: 10px;
            padding: 18px;
            margin-bottom: 15px;
          }

          p {
            margin: 9px 0;
          }

          .total {
            font-size: 20px;
            font-weight: bold;
          }

          .assinatura {
            margin-top: 60px;
          }

          .footer {
            margin-top: 50px;
            color: #94a3b8;
            font-size: 10px;
            text-align: center;
          }
        </style>
      </head>

      <body>

        <div class="header">
          ${logoUrl ? `<img class="logo" src="${logoUrl}">` : ''}

          <div>
            <h1>${companyName}</h1>
            <div class="sub">Assistência Técnica</div>
          </div>
        </div>

        <div class="title">
          Ordem de Serviço #${o.number}
        </div>

        <div class="box">
          <p><b>Cliente:</b> ${o.client_name || ''}</p>
          <p><b>WhatsApp:</b> ${o.client_phone || ''}</p>
          <p><b>Aparelho:</b> ${o.device || ''}</p>
          <p><b>IMEI:</b> ${o.imei || ''}</p>
        </div>

        <div class="box">
          <p><b>Defeito relatado:</b> ${o.issue || '-'}</p>
          <p><b>Diagnóstico:</b> ${o.diagnosis || '-'}</p>
          <p><b>Acessórios:</b> ${o.accessories || '-'}</p>
          <p><b>Garantia:</b> ${o.warranty || '-'}</p>
          <p><b>Status:</b> ${statusLabels[o.status] || o.status}</p>
        </div>

        ${partsHtml}

        <div class="box">
          <p>
            <b>Mão de obra:</b>
            ${money(o.labor_amount)}
          </p>

          <p>
            <b>Peças:</b>
            ${money(partsTotal)}
          </p>

          <p class="total">
            Total da OS: ${money(o.total)}
          </p>
        </div>

        <div class="assinatura">
          Assinatura do cliente:
          _______________________________________
        </div>

        <div class="footer">
          Documento gerado pelo sistema de gestão da assistência.
        </div>

        <script>
          setTimeout(() => window.print(), 400)
        </script>

      </body>
    </html>
  `)

  w.document.close()
}

function NewOrder({ clients, services, onSave, onCancel }) {
  const [saving, setSaving] = useState(false)

  const [f, setF] = useState({
    client_id: '',
    client_name: '',
    client_phone: '',
    device: '',
    imei: '',
    issue: '',
    diagnosis: '',
    password_notes: '',
    accessories: '',
    labor_amount: '',
    parts_total: 0,
    parts: [],
    total: '',
    warranty: '',
    notes: '',
    photos: []
  })

  function set(k, v) {
    setF(prev => ({...prev, [k]:v}))
  }

  function selectClient(id) {
    const c = clients.find(x => String(x.id) === String(id))

    setF(prev => ({
      ...prev,
      client_id: id,
      client_name: c?.name || '',
      client_phone: c?.phone || ''
    }))
  }

  function selectService(id) {
    const s = services.find(x => String(x.id) === String(id))

    if (s) {
      setF(prev => ({
        ...prev,
        labor_amount: s.price,
        total: Number(s.price || 0) + Number(prev.parts_total || 0),
        warranty: s.warranty || ''
      }))
    }
  }

  function setLaborAmount(value) {
    setF(prev => ({
      ...prev,
      labor_amount: value,
      total: Number(value || 0) + Number(prev.parts_total || 0)
    }))
  }

  function setParts(parts) {
    setF(prev => ({
      ...prev,
      parts
    }))
  }

  function setPartsTotal(value) {
    setF(prev => ({
      ...prev,
      parts_total: Number(value || 0),
      total:
        Number(prev.labor_amount || 0) +
        Number(value || 0)
    }))
  }

  async function submit(e) {
    e.preventDefault()

    setSaving(true)
    await onSave(f)
    setSaving(false)
  }

  return (
    <div className="max-w-3xl mx-auto">

      <button
        onClick={onCancel}
        className="mb-4 text-sm text-slate-500"
      >
        ← Voltar
      </button>

      <form onSubmit={submit} className="surface p-5 md:p-7 space-y-6">

        <h1 className="text-2xl font-bold">Nova Ordem de Serviço</h1>

        <div className="space-y-4">

          <label>
            <span className="label">Cliente cadastrado</span>
            <select
              value={f.client_id}
              onChange={e => selectClient(e.target.value)}
              className="input"
            >
              <option value="">Novo cliente / digite abaixo</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Nome do cliente *"
            value={f.client_name}
            onChange={v => set('client_name',v)}
            required
          />

          <Field
            label="WhatsApp"
            value={f.client_phone}
            onChange={v => set('client_phone',v)}
          />

          <Field
            label="Aparelho / modelo *"
            value={f.device}
            onChange={v => set('device',v)}
            required
          />

          <Field
            label="IMEI"
            value={f.imei}
            onChange={v => set('imei',v)}
          />

          <Field
            label="Defeito relatado"
            value={f.issue}
            onChange={v => set('issue',v)}
            area
          />

          <Field
            label="Diagnóstico"
            value={f.diagnosis}
            onChange={v => set('diagnosis',v)}
            area
          />

          <Field
            label="Senha / padrão"
            value={f.password_notes}
            onChange={v => set('password_notes',v)}
          />

          <Field
            label="Acessórios recebidos"
            value={f.accessories}
            onChange={v => set('accessories',v)}
          />

          <div>
            <span className="label">Fotos do aparelho</span>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-2 min-h-[58px] px-3 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-700 font-semibold active:bg-slate-100 cursor-pointer">
                <Camera size={21} className="text-blue-600"/>
                <span>Tirar foto</span>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files || [])
                    e.target.value = ''
                    set('photos', [...f.photos, ...files])
                  }}
                />
              </label>

              <label className="flex items-center justify-center gap-2 min-h-[58px] px-3 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-700 font-semibold active:bg-slate-100 cursor-pointer">
                <Upload size={21} className="text-blue-600"/>
                <span>Galeria</span>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files || [])
                    e.target.value = ''
                    set('photos', [...f.photos, ...files])
                  }}
                />
              </label>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Tire uma foto na hora ou selecione uma ou mais imagens da galeria.
            </p>

            {f.photos.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-sm font-semibold text-blue-700">
                  {f.photos.length} foto(s) selecionada(s)
                </p>

                <div className="mt-2 space-y-1">
                  {f.photos.slice(0, 5).map((foto, index) => (
                    <p key={index} className="text-xs text-slate-600 truncate">
                      • {foto.name}
                    </p>
                  ))}

                  {f.photos.length > 5 && (
                    <p className="text-xs text-slate-500">
                      + {f.photos.length - 5} outra(s)
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => set('photos', [])}
                  className="mt-3 text-xs font-semibold text-red-600"
                >
                  Remover fotos selecionadas
                </button>
              </div>
            )}
          </div>

          <label>
            <span className="label">Serviço do catálogo</span>
            <select
              onChange={e => selectService(e.target.value)}
              className="input"
            >
              <option value="">Selecione...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {money(s.price)}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Mão de obra"
            type="number"
            value={f.labor_amount}
            onChange={setLaborAmount}
          />

          <OrderPartsSelector
            value={f.parts}
            onChange={setParts}
            onTotalChange={setPartsTotal}
          />

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex justify-between items-center gap-3">
            <div>
              <p className="text-sm text-emerald-700">
                Total da OS
              </p>
              <p className="text-xs text-emerald-600">
                Mão de obra + peças
              </p>
            </div>

            <p className="text-xl font-bold text-emerald-700">
              {money(f.total)}
            </p>
          </div>

          <Field
            label="Garantia"
            value={f.warranty}
            onChange={v => set('warranty',v)}
          />

          <Field
            label="Observações"
            value={f.notes}
            onChange={v => set('notes',v)}
            area
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full justify-center"
        >
          <Save size={18}/>
          {saving ? 'Salvando...' : 'Salvar OS'}
        </button>
      </form>
    </div>
  )
}

function Catalog({ services, onAdd, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-500">Produtos e serviços</p>
          <h1 className="text-2xl font-bold">Catálogo</h1>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="btn-primary"
        >
          <Plus size={19}/> Novo
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">

        {services.map(s => (
          <div key={s.id} className="surface p-5">

            <div className="flex justify-between">
              <div>
                <h3 className="font-bold">{s.name}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {s.description || 'Sem descrição'}
                </p>
              </div>

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="w-10 h-10 grid place-items-center rounded-xl bg-blue-50 text-blue-600 active:bg-blue-100"
                  title="Editar serviço"
                >
                  <Pencil size={18}/>
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  className="w-10 h-10 grid place-items-center rounded-xl bg-red-50 text-red-500 active:bg-red-100"
                  title="Excluir serviço"
                >
                  <Trash2 size={18}/>
                </button>

              </div>
            </div>

            <div className="mt-5 flex justify-between">
              <b className="text-xl">{money(s.price)}</b>
              <span className="text-sm text-slate-500">
                {s.warranty || 'Sem garantia'}
              </span>
            </div>
          </div>
        ))}

        {services.length === 0 && (
          <div className="surface md:col-span-2">
            <Empty text="Nenhum serviço cadastrado."/>
          </div>
        )}
      </div>

      {open && (
        <ServiceModal
          onSave={onAdd}
          onClose={() => setOpen(false)}
        />
      )}

      {editing && (
        <EditServiceModal
          service={editing}
          onSave={onUpdate}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ServiceModal({ onSave, onClose }) {
  const [saving, setSaving] = useState(false)

  const [f, setF] = useState({
    name:'',
    price:'',
    warranty:'3 meses',
    description:''
  })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)

    const ok = await onSave(f)

    setSaving(false)

    if (ok) onClose()
  }

  return (
    <Modal title="Novo serviço" onClose={onClose}>

      <form onSubmit={submit} className="space-y-4">

        <Field
          label="Nome *"
          value={f.name}
          onChange={v => setF({...f,name:v})}
          required
        />

        <Field
          label="Preço"
          type="number"
          value={f.price}
          onChange={v => setF({...f,price:v})}
        />

        <Field
          label="Garantia"
          value={f.warranty}
          onChange={v => setF({...f,warranty:v})}
        />

        <Field
          label="Descrição"
          value={f.description}
          onChange={v => setF({...f,description:v})}
          area
        />

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full justify-center"
        >
          <Save size={18}/>
          {saving ? 'Salvando...' : 'Salvar serviço'}
        </button>
      </form>
    </Modal>
  )
}

function EditServiceModal({ service, onSave, onClose }) {
  const [saving, setSaving] = useState(false)

  const [f, setF] = useState({
    name: service.name || '',
    price: service.price || '',
    warranty: service.warranty || '',
    description: service.description || ''
  })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)

    const ok = await onSave(service.id, f)

    setSaving(false)

    if (ok) onClose()
  }

  return (
    <Modal title="Editar serviço" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">

        <Field
          label="Nome do serviço *"
          value={f.name}
          onChange={v => setF({...f, name:v})}
          required
        />

        <Field
          label="Preço"
          type="number"
          value={f.price}
          onChange={v => setF({...f, price:v})}
        />

        <Field
          label="Garantia"
          value={f.warranty}
          onChange={v => setF({...f, warranty:v})}
        />

        <Field
          label="Descrição"
          value={f.description}
          onChange={v => setF({...f, description:v})}
          area
        />

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full justify-center"
        >
          <Save size={18}/>
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>

      </form>
    </Modal>
  )
}



function FinanceView({ orders, clients }) {
  const [payments, setPayments] = useState([])
  const [sessions, setSessions] = useState([])
  const [movements, setMovements] = useState([])
  const [orderParts, setOrderParts] = useState([])
  const [loading, setLoading] = useState(true)

  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNotes, setOpeningNotes] = useState('')

  const [closingAmount, setClosingAmount] = useState('')
  const [closingNotes, setClosingNotes] = useState('')

  const [paymentForm, setPaymentForm] = useState({
    order_id: '',
    amount: '',
    method: 'pix',
    notes: ''
  })

  const [movementForm, setMovementForm] = useState({
    type: 'out',
    amount: '',
    description: ''
  })

  const methodLabels = {
    pix: 'Pix',
    cash: 'Dinheiro',
    debit_card: 'Cartão débito',
    credit_card: 'Cartão crédito',
    bank_transfer: 'Transferência',
    other: 'Outro'
  }

  async function loadFinance() {
    setLoading(true)

    const [p, c, m, parts] = await Promise.all([
      supabase
        .from('payments')
        .select('*')
        .order('paid_at', { ascending: false }),

      supabase
        .from('cash_sessions')
        .select('*')
        .order('opened_at', { ascending: false }),

      supabase
        .from('cash_movements')
        .select('*')
        .order('created_at', { ascending: false })
,

      supabase
        .from('order_parts')
        .select('order_id, quantity, unit_cost, unit_price, status')
    ])

    if (p.error) alert(p.error.message)
    if (c.error) alert(c.error.message)
    if (m.error) alert(m.error.message)
    if (parts.error) alert(parts.error.message)

    setPayments(p.data || [])
    setSessions(c.data || [])
    setMovements(m.data || [])
    setOrderParts(parts.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadFinance()
  }, [])

  const openSession = sessions.find(s => s.status === 'open')

  const todayKey = new Date().toLocaleDateString('en-CA')

  const todayPayments = payments.filter(p =>
    p.status === 'paid' &&
    new Date(p.paid_at).toLocaleDateString('en-CA') === todayKey
  )

  const sum = items =>
    items.reduce((total, item) => total + Number(item.amount || 0), 0)

  const receivedToday = sum(todayPayments)

  const pixToday = sum(
    todayPayments.filter(p => p.method === 'pix')
  )

  const cardToday = sum(
    todayPayments.filter(p =>
      p.method === 'debit_card' ||
      p.method === 'credit_card'
    )
  )

  const cashToday = sum(
    todayPayments.filter(p => p.method === 'cash')
  )

  const sessionPayments = openSession
    ? payments.filter(p =>
        p.status === 'paid' &&
        Number(p.cash_session_id) === Number(openSession.id)
      )
    : []

  const sessionMovements = openSession
    ? movements.filter(m =>
        Number(m.cash_session_id) === Number(openSession.id)
      )
    : []

  const cashPayments = sum(
    sessionPayments.filter(p => p.method === 'cash')
  )

  const cashIn = sum(
    sessionMovements.filter(m => m.type === 'in')
  )

  const cashOut = sum(
    sessionMovements.filter(m => m.type === 'out')
  )

  const expectedCash = openSession
    ? Number(openSession.opening_amount || 0) +
      cashPayments +
      cashIn -
      cashOut
    : 0

  const completedOrders = orders.filter(
    order =>
      order.status === 'completed' ||
      order.status === 'delivered'
  )

  const completedOrderIds = new Set(
    completedOrders.map(order => Number(order.id))
  )

  const completedRevenue = completedOrders.reduce(
    (total, order) =>
      total + Number(order.total || 0),
    0
  )

  const usedPartsCost = orderParts
    .filter(
      part =>
        part.status === 'used' &&
        completedOrderIds.has(Number(part.order_id))
    )
    .reduce(
      (total, part) =>
        total +
        Number(part.unit_cost || 0) *
        Number(part.quantity || 0),
      0
    )

  const grossProfit =
    completedRevenue - usedPartsCost

  const grossMargin =
    completedRevenue > 0
      ? (grossProfit / completedRevenue) * 100
      : 0

  async function openCash(e) {
    e.preventDefault()

    const value = Number(openingAmount || 0)

    if (value < 0) return

    const { error } = await supabase
      .from('cash_sessions')
      .insert({
        opening_amount: value,
        notes: openingNotes.trim() || null
      })

    if (error) {
      alert(error.message)
      return
    }

    setOpeningAmount('')
    setOpeningNotes('')
    await loadFinance()
  }

  async function closeCash(e) {
    e.preventDefault()

    if (!openSession) return

    if (closingAmount === '') {
      alert('Informe o valor contado no caixa.')
      return
    }

    const counted = Number(closingAmount)

    if (counted < 0) return

    const {
      data: { user }
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('cash_sessions')
      .update({
        status: 'closed',
        closed_by: user?.id || null,
        closed_at: new Date().toISOString(),
        closing_amount: counted,
        expected_amount: expectedCash,
        difference: counted - expectedCash,
        notes: closingNotes.trim() || openSession.notes || null
      })
      .eq('id', openSession.id)

    if (error) {
      alert(error.message)
      return
    }

    setClosingAmount('')
    setClosingNotes('')
    await loadFinance()
  }

  function selectOrder(value) {
    const order = orders.find(o => String(o.id) === String(value))

    let amount = ''

    if (order) {
      const alreadyPaid = payments
        .filter(p =>
          p.status === 'paid' &&
          String(p.order_id) === String(order.id)
        )
        .reduce((t, p) => t + Number(p.amount || 0), 0)

      amount = String(
        Math.max(0, Number(order.total || 0) - alreadyPaid)
      )
    }

    setPaymentForm(prev => ({
      ...prev,
      order_id: value,
      amount
    }))
  }

  async function savePayment(e) {
    e.preventDefault()

    if (!openSession) {
      alert('Abra o caixa antes de registrar pagamentos.')
      return
    }

    const amount = Number(paymentForm.amount || 0)

    if (amount <= 0) {
      alert('Informe um valor válido.')
      return
    }

    const order = orders.find(
      o => String(o.id) === String(paymentForm.order_id)
    )

    const { error } = await supabase
      .from('payments')
      .insert({
        order_id: order?.id || null,
        client_id: order?.client_id || null,
        cash_session_id: openSession.id,
        amount,
        method: paymentForm.method,
        notes: paymentForm.notes.trim() || null
      })

    if (error) {
      alert(error.message)
      return
    }

    setPaymentForm({
      order_id: '',
      amount: '',
      method: 'pix',
      notes: ''
    })

    await loadFinance()
  }

  async function saveMovement(e) {
    e.preventDefault()

    if (!openSession) {
      alert('Abra o caixa primeiro.')
      return
    }

    const amount = Number(movementForm.amount || 0)

    if (amount <= 0 || !movementForm.description.trim()) {
      alert('Informe valor e descrição.')
      return
    }

    const { error } = await supabase
      .from('cash_movements')
      .insert({
        cash_session_id: openSession.id,
        type: movementForm.type,
        amount,
        description: movementForm.description.trim()
      })

    if (error) {
      alert(error.message)
      return
    }

    setMovementForm({
      type: 'out',
      amount: '',
      description: ''
    })

    await loadFinance()
  }

  function exportReport() {
    if (!payments.length) {
      alert('Ainda não existem pagamentos.')
      return
    }

    const rows = payments.map(payment => {
      const order = orders.find(
        o => String(o.id) === String(payment.order_id)
      )

      const client =
        clients.find(
          c => String(c.id) === String(payment.client_id)
        )

      return {
        Data: new Date(payment.paid_at).toLocaleString('pt-BR'),
        OS: order ? `#${order.number}` : '',
        Cliente: order?.client_name || client?.name || '',
        'Forma de pagamento':
          methodLabels[payment.method] || payment.method,
        Valor: Number(payment.amount || 0),
        Situação:
          payment.status === 'paid' ? 'Pago' : 'Cancelado',
        Observações: payment.notes || ''
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)

    ws['!cols'] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 30 },
      { wch: 22 },
      { wch: 15 },
      { wch: 15 },
      { wch: 40 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Financeiro')

    const date = new Date().toISOString().slice(0, 10)

    XLSX.writeFile(
      wb,
      `financeiro-automatize-os-${date}.xlsx`
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Controle financeiro</p>
          <h1 className="text-2xl font-bold">Financeiro</h1>
        </div>

        <button
          type="button"
          onClick={exportReport}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border bg-white font-medium"
        >
          <Download size={18}/>
          Exportar relatório
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          title="Recebido hoje"
          value={money(receivedToday)}
          icon={<DollarSign/>}
        />

        <Stat
          title="Pix"
          value={money(pixToday)}
          icon={<DollarSign/>}
        />

        <Stat
          title="Cartão"
          value={money(cardToday)}
          icon={<DollarSign/>}
        />

        <Stat
          title="Dinheiro"
          value={money(cashToday)}
          icon={<DollarSign/>}
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          title="Faturamento concluído"
          value={money(completedRevenue)}
          icon={<DollarSign/>}
        />

        <Stat
          title="Custo de peças"
          value={money(usedPartsCost)}
          icon={<Package/>}
        />

        <Stat
          title="Lucro bruto"
          value={money(grossProfit)}
          icon={<DollarSign/>}
        />

        <Stat
          title="Margem bruta"
          value={`${grossMargin.toFixed(1)}%`}
          icon={<DollarSign/>}
        />
      </div>

      {!openSession ? (
        <form
          onSubmit={openCash}
          className="surface p-5 space-y-4"
        >
          <div>
            <h2 className="text-lg font-bold">Abrir caixa</h2>
            <p className="text-sm text-slate-500">
              Informe o valor inicial disponível no caixa.
            </p>
          </div>

          <Field
            label="Valor de abertura"
            type="number"
            value={openingAmount}
            onChange={setOpeningAmount}
            placeholder="0,00"
          />

          <Field
            label="Observações"
            value={openingNotes}
            onChange={setOpeningNotes}
            area
          />

          <button
            type="submit"
            className="btn-primary w-full justify-center"
          >
            Abrir caixa
          </button>
        </form>
      ) : (
        <div className="surface p-5 space-y-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="text-sm text-slate-500">Situação</p>
              <h2 className="text-xl font-bold text-emerald-600">
                Caixa aberto
              </h2>
            </div>

            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold">
              Aberto
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">Abertura</p>
              <b>{money(openSession.opening_amount)}</b>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">Dinheiro recebido</p>
              <b>{money(cashPayments)}</b>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">Saídas</p>
              <b>{money(cashOut)}</b>
            </div>

            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-700">
                Esperado no caixa
              </p>
              <b>{money(expectedCash)}</b>
            </div>
          </div>
        </div>
      )}

      {openSession && (
        <>
          <div className="grid lg:grid-cols-2 gap-5">

            <form
              onSubmit={savePayment}
              className="surface p-5 space-y-4"
            >
              <div>
                <h2 className="font-bold text-lg">
                  Registrar pagamento
                </h2>
                <p className="text-sm text-slate-500">
                  Vincule o recebimento a uma ordem de serviço.
                </p>
              </div>

              <label className="block">
                <span className="label">Ordem de serviço</span>
                <select
                  className="input"
                  value={paymentForm.order_id}
                  onChange={e => selectOrder(e.target.value)}
                >
                  <option value="">Pagamento sem OS</option>

                  {orders
                    .filter(o => o.status !== 'cancelled')
                    .map(order => (
                      <option key={order.id} value={order.id}>
                        OS #{order.number} - {order.client_name || 'Cliente'}
                      </option>
                    ))}
                </select>
              </label>

              <Field
                label="Valor"
                type="number"
                value={paymentForm.amount}
                onChange={value =>
                  setPaymentForm(prev => ({
                    ...prev,
                    amount: value
                  }))
                }
                required
              />

              <label className="block">
                <span className="label">Forma de pagamento</span>
                <select
                  className="input"
                  value={paymentForm.method}
                  onChange={e =>
                    setPaymentForm(prev => ({
                      ...prev,
                      method: e.target.value
                    }))
                  }
                >
                  <option value="pix">Pix</option>
                  <option value="cash">Dinheiro</option>
                  <option value="debit_card">Cartão débito</option>
                  <option value="credit_card">Cartão crédito</option>
                  <option value="bank_transfer">Transferência</option>
                  <option value="other">Outro</option>
                </select>
              </label>

              <Field
                label="Observações"
                value={paymentForm.notes}
                onChange={value =>
                  setPaymentForm(prev => ({
                    ...prev,
                    notes: value
                  }))
                }
              />

              <button
                type="submit"
                className="btn-primary w-full justify-center"
              >
                <Save size={18}/>
                Registrar pagamento
              </button>
            </form>

            <form
              onSubmit={saveMovement}
              className="surface p-5 space-y-4"
            >
              <div>
                <h2 className="font-bold text-lg">
                  Movimento de caixa
                </h2>
                <p className="text-sm text-slate-500">
                  Registre suprimentos ou retiradas em dinheiro.
                </p>
              </div>

              <label className="block">
                <span className="label">Tipo</span>
                <select
                  className="input"
                  value={movementForm.type}
                  onChange={e =>
                    setMovementForm(prev => ({
                      ...prev,
                      type: e.target.value
                    }))
                  }
                >
                  <option value="in">Entrada</option>
                  <option value="out">Saída / retirada</option>
                </select>
              </label>

              <Field
                label="Valor"
                type="number"
                value={movementForm.amount}
                onChange={value =>
                  setMovementForm(prev => ({
                    ...prev,
                    amount: value
                  }))
                }
                required
              />

              <Field
                label="Descrição"
                value={movementForm.description}
                onChange={value =>
                  setMovementForm(prev => ({
                    ...prev,
                    description: value
                  }))
                }
                placeholder="Ex.: compra de material"
                required
              />

              <button
                type="submit"
                className="w-full py-3 rounded-xl border font-semibold"
              >
                Registrar movimento
              </button>
            </form>

          </div>

          <form
            onSubmit={closeCash}
            className="surface p-5 space-y-4"
          >
            <div>
              <h2 className="font-bold text-lg">
                Fechamento de caixa
              </h2>

              <p className="text-sm text-slate-500">
                Sistema espera {money(expectedCash)} em dinheiro.
              </p>
            </div>

            <Field
              label="Valor contado no caixa"
              type="number"
              value={closingAmount}
              onChange={setClosingAmount}
              required
            />

            <Field
              label="Observações do fechamento"
              value={closingNotes}
              onChange={setClosingNotes}
              area
            />

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-semibold"
            >
              Fechar caixa
            </button>
          </form>
        </>
      )}

      <div className="surface overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-bold">Últimos pagamentos</h2>
        </div>

        {loading ? (
          <div className="p-5 text-slate-500">Carregando...</div>
        ) : payments.length === 0 ? (
          <Empty text="Nenhum pagamento registrado."/>
        ) : (
          payments.slice(0, 30).map(payment => {
            const order = orders.find(
              o => String(o.id) === String(payment.order_id)
            )

            const client = clients.find(
              c => String(c.id) === String(payment.client_id)
            )

            return (
              <div
                key={payment.id}
                className="p-4 border-b last:border-0 flex justify-between gap-3"
              >
                <div>
                  <p className="font-semibold">
                    {order?.client_name || client?.name || 'Pagamento'}
                  </p>

                  <p className="text-sm text-slate-500">
                    {order ? `OS #${order.number} • ` : ''}
                    {methodLabels[payment.method] || payment.method}
                    {' • '}
                    {new Date(payment.paid_at).toLocaleString('pt-BR')}
                  </p>
                </div>

                <b className="whitespace-nowrap">
                  {money(payment.amount)}
                </b>
              </div>
            )
          })
        )}
      </div>

      {sessions.filter(s => s.status === 'closed').length > 0 && (
        <div className="surface overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-bold">Histórico de caixas</h2>
          </div>

          {sessions
            .filter(s => s.status === 'closed')
            .slice(0, 10)
            .map(session => (
              <div
                key={session.id}
                className="p-4 border-b last:border-0"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {dateBR(session.opened_at)}
                    </p>

                    <p className="text-sm text-slate-500">
                      Esperado {money(session.expected_amount)}
                      {' • '}
                      Contado {money(session.closing_amount)}
                    </p>
                  </div>

                  <span
                    className={
                      Number(session.difference || 0) === 0
                        ? 'text-emerald-600 font-semibold'
                        : 'text-amber-600 font-semibold'
                    }
                  >
                    Dif. {money(session.difference)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

    </div>
  )
}


function TeamView({
  team,
  invites,
  company,
  onCreateInvite,
  onDeleteInvite
}) {
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)

  const activeInvites = invites.filter(x => !x.used_at)

  async function create(e) {
    e.preventDefault()

    setCreating(true)

    const result = await onCreateInvite(email)

    setCreating(false)

    if (result) setEmail('')
  }

  const used = team.length
  const max = Number(company?.max_users || 1)

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <div>
        <p className="text-sm text-slate-500">Administração</p>
        <h1 className="text-2xl font-bold">Equipe e Plano</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4">

        <div className="surface p-5">
          <p className="text-sm text-slate-500">Plano atual</p>
          <p className="text-xl font-bold mt-1 capitalize">
            {company?.plan || 'Starter'}
          </p>
        </div>

        <div className="surface p-5">
          <p className="text-sm text-slate-500">Usuários</p>
          <p className="text-xl font-bold mt-1">
            {used} / {max}
          </p>
        </div>

        <div className="surface p-5">
          <p className="text-sm text-slate-500">Assinatura</p>
          <p className="text-xl font-bold mt-1 capitalize">
            {company?.subscription_status === 'trial'
              ? 'Período de teste'
              : company?.subscription_status || '-'}
          </p>

          {company?.trial_ends_at && company?.subscription_status === 'trial' && (
            <p className="text-xs text-slate-500 mt-1">
              Até {dateBR(company.trial_ends_at)}
            </p>
          )}
        </div>

      </div>

      <div className="surface p-5">

        <h2 className="text-lg font-bold">Adicionar Técnico</h2>

        <p className="text-sm text-slate-500 mt-1 mb-4">
          Informe o e-mail do técnico. O sistema criará um código de convite.
        </p>

        <form onSubmit={create} className="flex flex-col sm:flex-row gap-3">

          <div className="flex-1">
            <Field
              label="E-mail do técnico"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="tecnico@email.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={creating || used >= max}
            className="btn-primary sm:self-end justify-center min-h-[50px]"
          >
            <Plus size={18}/>
            {creating ? 'Criando...' : 'Criar convite'}
          </button>

        </form>

        {used >= max && (
          <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-xl text-sm">
            Limite de usuários do plano atingido.
          </div>
        )}
      </div>

      {activeInvites.length > 0 && (
        <div className="surface overflow-hidden">

          <div className="p-5 border-b">
            <h2 className="font-bold">Convites pendentes</h2>
          </div>

          {activeInvites.map(invite => (
            <div
              key={invite.id}
              className="p-4 border-b last:border-0"
            >

              <p className="font-semibold">{invite.email}</p>

              <p className="text-xs text-slate-500 mt-1">
                Código do técnico
              </p>

              <div className="mt-2 space-y-2">

                <code className="block w-full bg-slate-100 rounded-xl p-3 font-bold tracking-wider text-blue-700">
                  {invite.invite_code}
                </code>

                <div className="grid grid-cols-2 gap-2">

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(invite.invite_code)
                      } catch {}
                    }}
                    className="px-3 py-3 border rounded-xl text-sm font-medium"
                  >
                    Copiar código
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const linkConvite =
                        `${window.location.origin}/?invite=${encodeURIComponent(invite.invite_code)}&email=${encodeURIComponent(invite.email)}`

                      const mensagem =
`Você foi convidado para acessar ${company?.name || 'a assistência'} no Automatize OS.

Acesse o link abaixo para criar sua conta:
${linkConvite}

E-mail do acesso:
${invite.email}

Código de convite:
${invite.invite_code}

O link já abre o cadastro com o e-mail e código preenchidos.

Seu acesso será criado como Técnico.`

                      try {
                        if (navigator.share) {
                          await navigator.share({
                            title: 'Convite para equipe',
                            text: mensagem
                          })
                        } else {
                          window.open(
                            `https://wa.me/?text=${encodeURIComponent(mensagem)}`,
                            '_blank'
                          )
                        }
                      } catch (erro) {
                        if (erro?.name !== 'AbortError') {
                          window.open(
                            `https://wa.me/?text=${encodeURIComponent(mensagem)}`,
                            '_blank'
                          )
                        }
                      }
                    }}
                    className="px-3 py-3 rounded-xl text-sm font-semibold text-white"
                    style={{backgroundColor: 'var(--brand-color, #2563eb)'}}
                  >
                    Compartilhar convite
                  </button>

                </div>

              </div>

              <div className="flex justify-between items-center mt-3">

                <p className="text-xs text-slate-500">
                  Expira em {dateBR(invite.expires_at)}
                </p>

                <button
                  type="button"
                  onClick={() => onDeleteInvite(invite.id)}
                  className="text-xs font-semibold text-red-600"
                >
                  Cancelar convite
                </button>

              </div>
            </div>
          ))}
        </div>
      )}

      <div className="surface overflow-hidden">

        <div className="p-5 border-b">
          <h2 className="font-bold">Usuários da assistência</h2>
        </div>

        {team.map(member => (
          <div
            key={member.id}
            className="p-4 border-b last:border-0 flex items-center gap-3"
          >

            <div className="w-11 h-11 rounded-full bg-slate-900 text-white grid place-items-center font-bold">
              {(member.full_name || 'U')[0].toUpperCase()}
            </div>

            <div className="flex-1">
              <p className="font-semibold">
                {member.full_name || 'Usuário'}
              </p>

              <p className="text-sm text-slate-500">
                {member.role === 'supervisor'
                  ? 'Supervisor'
                  : 'Técnico'}
              </p>
            </div>

            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              member.role === 'supervisor'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {member.role === 'supervisor' ? 'Supervisor' : 'Técnico'}
            </span>

          </div>
        ))}

      </div>
    </div>
  )
}

function TechnicianSettings({
  company,
  profile,
  session,
  onSignOut
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-5">

      <div>
        <p className="text-sm text-slate-500">Meu acesso</p>
        <h1 className="text-2xl font-bold">Perfil do Técnico</h1>
      </div>

      <div className="surface p-6 space-y-5">

        <div>
          <p className="text-xs text-slate-500">Assistência</p>
          <p className="font-semibold text-lg">
            {company?.name || '-'}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Nome</p>
          <p className="font-semibold">
            {profile?.full_name || '-'}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">E-mail</p>
          <p>{session.user.email}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Nível de acesso</p>

          <span className="inline-block mt-1 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-semibold">
            Técnico
          </span>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-700">
          Seu acesso é operacional. Alterações de catálogo, preços,
          identidade visual e equipe são exclusivas do Supervisor.
        </div>

        <button
          onClick={onSignOut}
          className="w-full bg-red-600 text-white py-3 rounded-xl"
        >
          <LogOut size={18} className="inline mr-2"/>
          Sair da conta
        </button>

      </div>
    </div>
  )
}

function SettingsView({
  company,
  profile,
  session,
  isPlatformAdmin = false,
  onSignOut,
  companyLogoUrl,
  onSaveCompany
}) {
  const [name, setName] = useState(company?.name || '')
  const [logoFile, setLogoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(company?.name || '')
    setLogoFile(null)
  }, [company?.id, company?.name])

  useEffect(() => {
    if (!logoFile) {
      setPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(logoFile)
    setPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  async function save(e) {
    e.preventDefault()

    if (!name.trim()) return

    setSaving(true)

    const ok = await onSaveCompany(
      { name },
      logoFile
    )

    setSaving(false)

    if (ok) setLogoFile(null)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      <div>
        <p className="text-sm text-slate-500">Personalização</p>
        <h1 className="text-2xl font-bold">Configurações da assistência</h1>
      </div>

      <div className="bg-[#0B1220] rounded-3xl p-5 text-white">
        <div className="flex items-center gap-4">
          <img
            src="/automatize-os.png"
            alt="Automatize OS"
            className="w-24 h-24 object-contain rounded-2xl"
          />

          <div>
            <h2 className="text-xl font-bold text-[#F4B63A]">
              Automatize OS
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Gestão para assistência técnica
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="surface p-5 space-y-5">

        <div>
          <h2 className="font-bold text-lg">
            Identidade da sua assistência
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Personalize apenas o nome e a logo da sua empresa.
          </p>
        </div>

        <Field
          label="Nome da assistência"
          value={name}
          onChange={setName}
          placeholder="Ex.: Nil Cell Assistência Técnica"
          required
        />

        <div>
          <span className="label">Logo da assistência</span>

          <div className="flex items-center gap-4 mt-2">

            {(previewUrl || companyLogoUrl) ? (
              <img
                src={previewUrl || companyLogoUrl}
                alt="Logo da assistência"
                className="w-20 h-20 rounded-2xl border bg-white object-contain p-2"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl border bg-slate-50 grid place-items-center text-slate-400">
                <Wrench size={28}/>
              </div>
            )}

            <label className="flex-1">
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center cursor-pointer hover:bg-slate-50">
                <Camera size={22} className="mx-auto mb-2 text-slate-500"/>

                <p className="text-sm font-semibold">
                  Escolher logo
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  PNG, JPG ou WEBP • até 3 MB
                </p>
              </div>

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => setLogoFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {logoFile && (
            <p className="text-xs text-slate-500 mt-2">
              Nova logo: {logoFile.name}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full justify-center"
        >
          <Save size={18}/>
          {saving ? 'Salvando...' : 'Salvar identidade'}
        </button>
      </form>

      <div className="surface p-5">
        <h2 className="font-bold mb-4">Minha conta</h2>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-slate-500">E-mail</p>
            <p>{session?.user?.email || '-'}</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Acesso</p>
            <p className="font-semibold">
              {isPlatformAdmin
                ? 'Administrador Master'
                : profile?.role === 'supervisor'
                  ? 'Supervisor'
                  : 'Técnico'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full mt-5 py-3 border border-red-200 text-red-600 rounded-xl font-medium"
        >
          <LogOut size={18} className="inline mr-2"/>
          Sair da conta
        </button>
      </div>

    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">

      <div className="bg-white w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[92vh] overflow-auto">

        <div className="sticky top-0 bg-white flex justify-between items-center px-5 py-4 border-b z-10">

          <h2 className="text-xl font-bold">{title}</h2>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100"
          >
            <X size={20}/>
          </button>
        </div>

        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

function Empty({ text }) {
  return (
    <div className="p-10 text-center text-slate-500">
      {text}
    </div>
  )
}
