import React, { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Save, Trash2, UserCheck, UserX, X } from 'lucide-react'
import { supabase } from './lib/supabaseClient'

const roleLabel = member =>
  member?.is_platform_admin_member
    ? 'Administrador Master'
    : member?.role === 'supervisor'
      ? 'Supervisor'
      : 'Técnico'

const dateTimeBR = value =>
  value
    ? new Date(value).toLocaleString('pt-BR')
    : 'Nunca'

export default function TeamManagementView({
  company,
  invites = [],
  currentUserId,
  onCreateInvite,
  onDeleteInvite
}) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('technician')
  const [busy, setBusy] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)

  async function loadMembers() {
    setLoading(true)
    const { data, error } = await supabase.rpc('team_list_members')

    if (error) {
      alert(error.message)
      setMembers([])
    } else {
      setMembers(data || [])

      if (selected) {
        const refreshed = (data || []).find(
          item => item.user_id === selected.user_id
        )

        if (refreshed) {
          setSelected(refreshed)
          setName(refreshed.full_name || '')
          setRole(refreshed.role || 'technician')
        }
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    loadMembers()
  }, [company?.id])

  function openMember(member) {
    setSelected(member)
    setName(member.full_name || '')
    setRole(member.role || 'technician')
  }

  function closeMember() {
    setSelected(null)
    setName('')
    setRole('technician')
  }

  async function saveMember(e) {
    e.preventDefault()
    if (!selected) return

    setBusy(true)
    const { error } = await supabase.rpc('team_update_member', {
      p_user_id: selected.user_id,
      p_full_name: name,
      p_role: selected.is_platform_admin_member ? selected.role : role
    })
    setBusy(false)

    if (error) {
      alert(error.message)
      return
    }

    await loadMembers()
    alert('Acesso atualizado com sucesso.')
  }

  async function setMemberActive(active) {
    if (!selected) return

    const text = active
      ? `Reativar o acesso de ${selected.full_name || selected.email}?`
      : `Excluir o acesso de ${selected.full_name || selected.email}?

O histórico de OS e movimentações será preservado.`

    if (!confirm(text)) return

    setBusy(true)
    const { error } = await supabase.rpc('team_set_member_active', {
      p_user_id: selected.user_id,
      p_active: active
    })
    setBusy(false)

    if (error) {
      alert(error.message)
      return
    }

    await loadMembers()
    alert(active ? 'Acesso reativado.' : 'Acesso removido. O histórico foi preservado.')
  }

  async function createInvite(e) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()

    if (!email) {
      alert('Informe o e-mail do técnico.')
      return
    }

    setInviteBusy(true)
    try {
      const result = await onCreateInvite?.(email)
      if (result !== false) setInviteEmail('')
    } finally {
      setInviteBusy(false)
    }
  }

  const activeCount = useMemo(
    () => members.filter(member => member.is_active).length,
    [members]
  )

  const supervisors = useMemo(
    () => members.filter(member => member.is_active && member.role === 'supervisor').length,
    [members]
  )

  const technicians = useMemo(
    () => members.filter(member => member.is_active && member.role === 'technician').length,
    [members]
  )

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <p className="text-sm text-slate-500">Administração</p>
        <h1 className="text-2xl font-bold">Equipe e Plano</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="surface p-4">
          <p className="text-sm text-slate-500">Plano atual</p>
          <p className="text-lg font-bold capitalize">{company?.plan || 'Starter'}</p>
        </div>
        <div className="surface p-4">
          <p className="text-sm text-slate-500">Usuários</p>
          <p className="text-lg font-bold">{activeCount} / {company?.max_users || '-'}</p>
        </div>
        <div className="surface p-4">
          <p className="text-sm text-slate-500">Supervisores</p>
          <p className="text-lg font-bold">{supervisors}</p>
        </div>
        <div className="surface p-4">
          <p className="text-sm text-slate-500">Técnicos</p>
          <p className="text-lg font-bold">{technicians}</p>
        </div>
      </div>

      <form onSubmit={createInvite} className="surface p-5 space-y-3">
        <div>
          <h2 className="font-bold text-lg">Adicionar Técnico</h2>
          <p className="text-sm text-slate-500">
            Informe o e-mail do técnico. O sistema criará um código de convite.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            className="input flex-1"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="tecnico@email.com"
          />

          <button
            type="submit"
            disabled={inviteBusy}
            className="btn-primary justify-center disabled:opacity-50"
          >
            {inviteBusy ? 'Criando...' : '+ Criar convite'}
          </button>
        </div>
      </form>

      {invites.some(invite => !invite.used_at) && (
        <div className="surface overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-bold">Convites pendentes</h2>
          </div>

          {invites.filter(invite => !invite.used_at).map(invite => (
            <div
              key={invite.id}
              className="p-4 border-b last:border-0 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{invite.email}</p>
                <p className="text-sm text-slate-500">Código: {invite.invite_code}</p>
              </div>

              <button
                type="button"
                onClick={() => onDeleteInvite?.(invite.id)}
                className="px-3 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-semibold"
              >
                Cancelar convite
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="surface overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Usuários da assistência</h2>
            <p className="text-sm text-slate-500 mt-1">
              Toque em um usuário para revisar ou editar o acesso.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMembers}
            className="px-3 py-2 border rounded-xl text-sm font-semibold"
          >
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando equipe...</div>
        ) : members.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum usuário encontrado.</div>
        ) : (
          members.map(member => (
            <button
              key={member.user_id}
              type="button"
              onClick={() => openMember(member)}
              className={`w-full p-4 border-b last:border-0 flex items-center gap-3 text-left hover:bg-slate-50 active:bg-slate-100 ${member.is_active ? '' : 'opacity-60 bg-slate-50'}`}
            >
              <div className="w-11 h-11 rounded-full bg-slate-900 text-white grid place-items-center font-bold shrink-0">
                {(member.full_name || member.email || 'U')[0].toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold truncate">{member.full_name || 'Usuário'}</p>
                  {!member.is_active && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold">
                      Acesso removido
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 truncate">{member.email || 'Sem e-mail'}</p>
              </div>

              <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                member.is_platform_admin_member
                  ? 'bg-amber-50 text-amber-700'
                  : member.role === 'supervisor'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {roleLabel(member)}
              </span>

              <ChevronRight size={20} className="text-slate-400 shrink-0" />
            </button>
          ))
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] bg-black/50 p-3 md:p-6 overflow-auto">
          <div className="max-w-xl mx-auto bg-white rounded-3xl p-5 md:p-7 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Gerenciar acesso</p>
                <h2 className="text-2xl font-bold">{selected.full_name || selected.email}</h2>
              </div>

              <button
                type="button"
                onClick={closeMember}
                className="w-10 h-10 rounded-xl border grid place-items-center"
                aria-label="Fechar"
              >
                <X size={19} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Status</p>
                <p className="font-semibold mt-1">{selected.is_active ? 'Ativo' : 'Acesso removido'}</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Nível atual</p>
                <p className="font-semibold mt-1">{roleLabel(selected)}</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                <p className="text-xs text-slate-500">E-mail</p>
                <p className="font-semibold mt-1 break-all">{selected.email || '-'}</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Criado em</p>
                <p className="font-semibold mt-1">{dateTimeBR(selected.created_at)}</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Último acesso</p>
                <p className="font-semibold mt-1">{dateTimeBR(selected.last_sign_in_at)}</p>
              </div>
            </div>

            <form onSubmit={saveMember} className="space-y-4">
              <label className="block">
                <span className="label">Nome</span>
                <input className="input" value={name} onChange={e => setName(e.target.value)} required />
              </label>

              <label className="block">
                <span className="label">Nível de acesso</span>
                {selected.is_platform_admin_member ? (
                  <div className="input bg-slate-50 flex items-center">Administrador Master</div>
                ) : (
                  <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                    <option value="supervisor">Supervisor</option>
                    <option value="technician">Técnico</option>
                  </select>
                )}
              </label>

              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                <Save size={18} />
                {busy ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </form>

            {!selected.is_platform_admin_member && selected.user_id !== currentUserId && (
              <div className="border-t pt-5">
                {selected.is_active ? (
                  <button
                    type="button"
                    onClick={() => setMemberActive(false)}
                    disabled={busy}
                    className="w-full py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 size={18} />
                    Excluir acesso
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMemberActive(true)}
                    disabled={busy}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <UserCheck size={18} />
                    Reativar acesso
                  </button>
                )}

                <p className="text-xs text-slate-500 mt-2 text-center">
                  Ao excluir o acesso, o usuário deixa de usar o sistema, mas seu histórico de OS e movimentações permanece preservado.
                </p>
              </div>
            )}

            {selected.user_id === currentUserId && !selected.is_platform_admin_member && (
              <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-xl p-3 text-sm flex gap-2">
                <UserX size={18} className="shrink-0 mt-0.5" />
                Você não pode excluir o seu próprio acesso por esta tela.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
