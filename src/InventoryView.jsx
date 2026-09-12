import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

const money = value =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

const emptyForm = {
  sku: '',
  name: '',
  category: '',
  compatible_models: '',
  supplier: '',
  quantity: '',
  minimum_stock: '',
  cost_price: '',
  sale_price: '',
  notes: ''
}

const itemToForm = item => ({
  sku: item?.sku || '',
  name: item?.name || '',
  category: item?.category || '',
  compatible_models: item?.compatible_models || '',
  supplier: item?.supplier || '',
  minimum_stock: String(item?.minimum_stock ?? 0),
  cost_price: String(item?.cost_price ?? 0),
  sale_price: String(item?.sale_price ?? 0),
  notes: item?.notes || ''
})

export default function InventoryView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState(itemToForm(null))
  const [editPhotoFile, setEditPhotoFile] = useState(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false)
  const [stockChange, setStockChange] = useState('1')
  const [busyEdit, setBusyEdit] = useState(false)

  async function loadPermission() {
    const { data, error } = await supabase.rpc('is_supervisor')

    if (error) {
      console.error('Erro ao verificar permissão do estoque:', error)
      setCanManage(false)
      return
    }

    setCanManage(Boolean(data))
  }

  async function signedImage(item) {
    if (!item?.image_path) {
      return { ...item, image_url: '' }
    }

    const { data, error } = await supabase.storage
      .from('inventory-photos')
      .createSignedUrl(item.image_path, 60 * 60 * 24 * 7)

    if (error) {
      console.error('Erro ao carregar foto do estoque:', error)
      return { ...item, image_url: '' }
    }

    return {
      ...item,
      image_url: data?.signedUrl || ''
    }
  }

  async function loadItems() {
    setLoading(true)

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name')

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    const withImages = await Promise.all(
      (data || []).map(signedImage)
    )

    setItems(withImages)
    setLoading(false)
  }

  useEffect(() => {
    loadPermission()
    loadItems()
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview)
    }
  }, [photoPreview, editPhotoPreview])

  function validatePhoto(file) {
    if (!file) return false

    if (!file.type?.startsWith('image/')) {
      alert('Selecione uma imagem válida.')
      return false
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A foto deve ter no máximo 5 MB.')
      return false
    }

    return true
  }

  function resetPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview('')
  }

  function choosePhoto(file) {
    if (!file || !validatePhoto(file)) return

    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function resetForm() {
    resetPhoto()
    setForm(emptyForm)
  }

  function resetEditPhoto() {
    if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview)
    setEditPhotoFile(null)
    setEditPhotoPreview('')
  }

  function chooseEditPhoto(file) {
    if (!file || !validatePhoto(file)) return

    if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview)
    setEditPhotoFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
    setRemoveExistingPhoto(false)
  }

  function closeEdit() {
    resetEditPhoto()
    setEditingItem(null)
    setEditForm(itemToForm(null))
    setRemoveExistingPhoto(false)
    setStockChange('1')
  }

  function openEdit(item) {
    if (!canManage) return

    resetEditPhoto()
    setEditingItem(item)
    setEditForm(itemToForm(item))
    setRemoveExistingPhoto(false)
    setStockChange('1')
  }

  async function uploadPhoto(item, file) {
    if (!file) return null

    const originalExt =
      (file.name?.split('.').pop() || 'jpg').toLowerCase()

    const ext = /^[a-z0-9]+$/.test(originalExt)
      ? originalExt
      : 'jpg'

    const token = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const path = `${item.company_id}/${item.id}/${token}.${ext}`

    const { error } = await supabase.storage
      .from('inventory-photos')
      .upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false
      })

    if (error) throw error
    return path
  }

  async function saveItem(e) {
    e.preventDefault()

    if (!canManage) {
      alert('Somente supervisor ou administrador master pode cadastrar itens.')
      return
    }

    if (!form.name.trim()) {
      alert('Informe o nome da peça.')
      return
    }

    setSaving(true)

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        sku: form.sku || null,
        name: form.name,
        category: form.category || null,
        compatible_models: form.compatible_models || null,
        supplier: form.supplier || null,
        minimum_stock: Number(form.minimum_stock || 0),
        cost_price: Number(form.cost_price || 0),
        sale_price: Number(form.sale_price || 0),
        notes: form.notes || null
      })
      .select()
      .single()

    if (error) {
      setSaving(false)
      alert(error.message)
      return
    }

    let newPath = null

    try {
      if (photoFile) {
        newPath = await uploadPhoto(data, photoFile)

        const { error: photoUpdateError } = await supabase
          .from('inventory_items')
          .update({ image_path: newPath })
          .eq('id', data.id)

        if (photoUpdateError) throw photoUpdateError
      }

      const quantity = Number(form.quantity || 0)

      if (quantity > 0) {
        const { error: stockError } = await supabase.rpc(
          'add_inventory_stock',
          {
            p_inventory_item_id: data.id,
            p_quantity: quantity,
            p_unit_cost: Number(form.cost_price || 0),
            p_notes: 'Estoque inicial'
          }
        )

        if (stockError) throw stockError
      }

      resetForm()
      setShowForm(false)
      await loadItems()
    } catch (saveError) {
      alert(
        `O item foi criado, mas houve erro em uma etapa complementar: ${saveError.message}`
      )
    } finally {
      setSaving(false)
    }
  }

  async function saveEditedItem(e) {
    e.preventDefault()

    if (!canManage || !editingItem) return

    if (!editForm.name.trim()) {
      alert('Informe o nome da peça.')
      return
    }

    setBusyEdit(true)

    let uploadedPath = null
    const oldPath = editingItem.image_path || null

    try {
      let nextImagePath = oldPath

      if (editPhotoFile) {
        uploadedPath = await uploadPhoto(editingItem, editPhotoFile)
        nextImagePath = uploadedPath
      } else if (removeExistingPhoto) {
        nextImagePath = null
      }

      const { data, error } = await supabase
        .from('inventory_items')
        .update({
          sku: editForm.sku || null,
          name: editForm.name,
          category: editForm.category || null,
          compatible_models: editForm.compatible_models || null,
          supplier: editForm.supplier || null,
          minimum_stock: Number(editForm.minimum_stock || 0),
          cost_price: Number(editForm.cost_price || 0),
          sale_price: Number(editForm.sale_price || 0),
          notes: editForm.notes || null,
          image_path: nextImagePath
        })
        .eq('id', editingItem.id)
        .select()
        .single()

      if (error) throw error

      if (oldPath && oldPath !== nextImagePath) {
        await supabase.storage
          .from('inventory-photos')
          .remove([oldPath])
      }

      const refreshed = await signedImage(data)
      setEditingItem(refreshed)
      setEditForm(itemToForm(refreshed))
      resetEditPhoto()
      setRemoveExistingPhoto(false)
      await loadItems()
      alert('Item atualizado com sucesso.')
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage
          .from('inventory-photos')
          .remove([uploadedPath])
      }

      alert(error.message || 'Não foi possível atualizar o item.')
    } finally {
      setBusyEdit(false)
    }
  }

  async function changeStock(direction) {
    if (!canManage || !editingItem) return

    const quantity = Number(stockChange || 0)

    if (!Number.isInteger(quantity) || quantity <= 0) {
      alert('Informe uma quantidade inteira maior que zero.')
      return
    }

    setBusyEdit(true)

    try {
      const rpcName =
        direction === 'in'
          ? 'add_inventory_stock'
          : 'remove_inventory_stock'

      const args =
        direction === 'in'
          ? {
              p_inventory_item_id: editingItem.id,
              p_quantity: quantity,
              p_unit_cost: Number(editForm.cost_price || 0),
              p_notes: 'Entrada manual pelo gerenciamento do item'
            }
          : {
              p_inventory_item_id: editingItem.id,
              p_quantity: quantity,
              p_notes: 'Saída manual pelo gerenciamento do item'
            }

      const { data, error } = await supabase.rpc(rpcName, args)

      if (error) throw error

      const row = Array.isArray(data) ? data[0] : data
      const refreshed = await signedImage({
        ...editingItem,
        ...(row || {})
      })

      setEditingItem(refreshed)
      setStockChange('1')
      await loadItems()
    } catch (error) {
      alert(error.message || 'Não foi possível ajustar o estoque.')
    } finally {
      setBusyEdit(false)
    }
  }

  async function deleteItem() {
    if (!canManage || !editingItem) return

    if (!confirm(
      `Excluir definitivamente o item "${editingItem.name}"?\n\nEssa ação não pode ser desfeita.`
    )) {
      return
    }

    setBusyEdit(true)

    try {
      const imagePath = editingItem.image_path || null

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', editingItem.id)

      if (error) throw error

      if (imagePath) {
        await supabase.storage
          .from('inventory-photos')
          .remove([imagePath])
      }

      closeEdit()
      await loadItems()
      alert('Item excluído do estoque.')
    } catch (error) {
      const linked =
        error?.code === '23503' ||
        String(error?.message || '').toLowerCase().includes('foreign key')

      alert(
        linked
          ? 'Este item já foi usado ou reservado em uma OS e não pode ser excluído, pois precisamos preservar o histórico. Você ainda pode editar os dados, a foto e ajustar a quantidade.'
          : (error.message || 'Não foi possível excluir o item.')
      )
    } finally {
      setBusyEdit(false)
    }
  }

  const totalItems = items.length

  const totalUnits = items.reduce(
    (total, item) => total + Number(item.quantity_on_hand || 0),
    0
  )

  const lowStock = items.filter(item => {
    const available =
      Number(item.quantity_on_hand || 0) -
      Number(item.quantity_reserved || 0)

    return available <= Number(item.minimum_stock || 0)
  }).length

  function PhotoControls({
    preview,
    currentUrl,
    onChoose,
    onRemove,
    removeLabel = 'Remover foto'
  }) {
    return (
      <div className="border rounded-2xl p-4 space-y-3 bg-slate-50">
        {preview ? (
          <img
            src={preview}
            alt="Prévia da foto"
            className="w-full max-h-64 object-contain rounded-xl bg-white border"
          />
        ) : currentUrl ? (
          <img
            src={currentUrl}
            alt="Foto atual"
            className="w-full max-h-64 object-contain rounded-xl bg-white border"
          />
        ) : (
          <div className="h-36 rounded-xl border border-dashed grid place-items-center text-sm text-slate-500 bg-white">
            Nenhuma foto cadastrada
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer text-center">
            📷 Tirar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => {
                onChoose(e.target.files?.[0])
                e.target.value = ''
              }}
              className="hidden"
            />
          </label>

          <label className="px-4 py-3 rounded-xl border font-semibold cursor-pointer text-center bg-white">
            🖼️ Galeria
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                onChoose(e.target.files?.[0])
                e.target.value = ''
              }}
              className="hidden"
            />
          </label>
        </div>

        {(preview || currentUrl) && (
          <button
            type="button"
            onClick={onRemove}
            className="w-full px-4 py-3 rounded-xl border border-red-200 text-red-600 font-semibold bg-white"
          >
            {removeLabel}
          </button>
        )}

        <p className="text-xs text-slate-500">Imagem de até 5 MB.</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex justify-between items-center gap-3">
        <div>
          <p className="text-sm text-slate-500">Peças e materiais</p>
          <h1 className="text-2xl font-bold">Estoque</h1>

          {!canManage && (
            <p className="text-xs text-slate-500 mt-1">
              Visualização do estoque. Alterações são restritas ao Supervisor e ao Painel Master.
            </p>
          )}
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="btn-primary"
          >
            + Novo item
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="surface p-4">
          <p className="text-sm text-slate-500">Itens</p>
          <p className="text-2xl font-bold">{totalItems}</p>
        </div>

        <div className="surface p-4">
          <p className="text-sm text-slate-500">Unidades</p>
          <p className="text-2xl font-bold">{totalUnits}</p>
        </div>

        <div className="surface p-4">
          <p className="text-sm text-slate-500">Estoque baixo</p>
          <p className="text-2xl font-bold text-amber-600">{lowStock}</p>
        </div>
      </div>

      {showForm && canManage && (
        <form onSubmit={saveItem} className="surface p-5 md:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold">Cadastrar novo item</h2>
            <p className="text-sm text-slate-500">
              Cadastre a peça, a foto e o estoque inicial.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label>
              <span className="label">Nome da peça *</span>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required
                placeholder="Ex.: Tela iPhone 11"
              />
            </label>

            <label>
              <span className="label">Código / SKU</span>
              <input
                className="input"
                value={form.sku}
                onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
              />
            </label>

            <label>
              <span className="label">Categoria</span>
              <input
                className="input"
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                placeholder="Tela, bateria, conector..."
              />
            </label>

            <label>
              <span className="label">Modelos compatíveis</span>
              <input
                className="input"
                value={form.compatible_models}
                onChange={e => setForm(p => ({ ...p, compatible_models: e.target.value }))}
              />
            </label>

            <label>
              <span className="label">Fornecedor</span>
              <input
                className="input"
                value={form.supplier}
                onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
              />
            </label>

            <label>
              <span className="label">Quantidade inicial</span>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
              />
            </label>

            <label>
              <span className="label">Estoque mínimo</span>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.minimum_stock}
                onChange={e => setForm(p => ({ ...p, minimum_stock: e.target.value }))}
              />
            </label>

            <label>
              <span className="label">Custo unitário</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.cost_price}
                onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))}
              />
            </label>

            <label>
              <span className="label">Preço de venda</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.sale_price}
                onChange={e => setForm(p => ({ ...p, sale_price: e.target.value }))}
              />
            </label>

            <div className="md:col-span-2">
              <span className="label">Foto do item</span>
              <PhotoControls
                preview={photoPreview}
                currentUrl=""
                onChoose={choosePhoto}
                onRemove={resetPhoto}
                removeLabel="Remover foto selecionada"
              />
            </div>
          </div>

          <label className="block">
            <span className="label">Observações</span>
            <textarea
              className="input min-h-24"
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            />
          </label>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="px-4 py-3 border rounded-xl font-semibold"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar item'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading && <div className="surface p-5">Carregando estoque...</div>}

        {!loading && items.length === 0 && (
          <div className="surface p-8 text-center">
            <p className="font-semibold">Nenhum item cadastrado.</p>
            <p className="text-sm text-slate-500 mt-1">
              Cadastre sua primeira peça.
            </p>
          </div>
        )}

        {items.map(item => {
          const available =
            Number(item.quantity_on_hand || 0) -
            Number(item.quantity_reserved || 0)

          const low =
            available <= Number(item.minimum_stock || 0)

          return (
            <div key={item.id} className="surface p-4">
              <div className="flex gap-3">
                {item.image_url ? (
                  <a
                    href={item.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                  >
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-20 h-20 rounded-xl object-cover border bg-white"
                    />
                  </a>
                ) : (
                  <div className="w-20 h-20 shrink-0 rounded-xl border bg-slate-50 grid place-items-center text-xs text-slate-400 text-center px-2">
                    Sem foto
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{item.name}</h3>
                      <p className="text-sm text-slate-500">
                        {item.sku || 'Sem código'}
                        {item.category ? ` • ${item.category}` : ''}
                      </p>

                      {item.compatible_models && (
                        <p className="text-sm mt-2">
                          Compatível: {item.compatible_models}
                        </p>
                      )}
                    </div>

                    {low && (
                      <span className="h-fit text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-1 shrink-0">
                        Estoque baixo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">Físico</p>
                  <b>{item.quantity_on_hand || 0}</b>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">Reservado</p>
                  <b>{item.quantity_reserved || 0}</b>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">Disponível</p>
                  <b>{available}</b>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="border rounded-xl p-3">
                  <p className="text-xs text-slate-500">Custo</p>
                  <b>{money(item.cost_price)}</b>
                </div>

                <div className="border rounded-xl p-3">
                  <p className="text-xs text-slate-500">Venda</p>
                  <b>{money(item.sale_price)}</b>
                </div>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="w-full mt-3 py-3 bg-slate-900 text-white rounded-xl font-semibold"
                >
                  Editar / Gerenciar item
                </button>
              )}
            </div>
          )
        })}
      </div>

      {editingItem && canManage && (
        <div className="fixed inset-0 z-[100] bg-black/50 p-3 md:p-6 overflow-auto">
          <div className="max-w-3xl mx-auto bg-white rounded-3xl p-5 md:p-7 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Gerenciamento do estoque</p>
                <h2 className="text-2xl font-bold">{editingItem.name}</h2>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                className="px-4 py-2 border rounded-xl font-semibold"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Físico</p>
                <b>{editingItem.quantity_on_hand || 0}</b>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Reservado</p>
                <b>{editingItem.quantity_reserved || 0}</b>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Disponível</p>
                <b>
                  {Number(editingItem.quantity_on_hand || 0) -
                    Number(editingItem.quantity_reserved || 0)}
                </b>
              </div>
            </div>

            <div className="border rounded-2xl p-4 space-y-3">
              <div>
                <p className="font-semibold">Ajustar quantidade</p>
                <p className="text-sm text-slate-500">
                  Registre entrada ou saída manual sem alterar reservas de OS.
                </p>
              </div>

              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={stockChange}
                onChange={e => setStockChange(e.target.value)}
                placeholder="Quantidade"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => changeStock('in')}
                  disabled={busyEdit}
                  className="py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"
                >
                  + Entrada
                </button>

                <button
                  type="button"
                  onClick={() => changeStock('out')}
                  disabled={busyEdit}
                  className="py-3 rounded-xl bg-amber-600 text-white font-semibold disabled:opacity-50"
                >
                  − Retirar
                </button>
              </div>
            </div>

            <form onSubmit={saveEditedItem} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <label>
                  <span className="label">Nome da peça *</span>
                  <input
                    className="input"
                    value={editForm.name}
                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </label>

                <label>
                  <span className="label">Código / SKU</span>
                  <input
                    className="input"
                    value={editForm.sku}
                    onChange={e => setEditForm(p => ({ ...p, sku: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="label">Categoria</span>
                  <input
                    className="input"
                    value={editForm.category}
                    onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="label">Modelos compatíveis</span>
                  <input
                    className="input"
                    value={editForm.compatible_models}
                    onChange={e => setEditForm(p => ({ ...p, compatible_models: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="label">Fornecedor</span>
                  <input
                    className="input"
                    value={editForm.supplier}
                    onChange={e => setEditForm(p => ({ ...p, supplier: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="label">Estoque mínimo</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.minimum_stock}
                    onChange={e => setEditForm(p => ({ ...p, minimum_stock: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="label">Custo unitário</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.cost_price}
                    onChange={e => setEditForm(p => ({ ...p, cost_price: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="label">Preço de venda</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.sale_price}
                    onChange={e => setEditForm(p => ({ ...p, sale_price: e.target.value }))}
                  />
                </label>

                <div className="md:col-span-2">
                  <span className="label">Foto do item</span>

                  <PhotoControls
                    preview={editPhotoPreview}
                    currentUrl={
                      removeExistingPhoto
                        ? ''
                        : editingItem.image_url
                    }
                    onChoose={chooseEditPhoto}
                    onRemove={() => {
                      if (editPhotoFile) {
                        resetEditPhoto()
                        setRemoveExistingPhoto(false)
                      } else {
                        setRemoveExistingPhoto(true)
                      }
                    }}
                    removeLabel={
                      editPhotoFile
                        ? 'Cancelar nova foto'
                        : 'Excluir foto atual'
                    }
                  />

                  {removeExistingPhoto && !editPhotoFile && (
                    <button
                      type="button"
                      onClick={() => setRemoveExistingPhoto(false)}
                      className="mt-2 text-sm font-semibold text-blue-600"
                    >
                      Manter foto atual
                    </button>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="label">Observações</span>
                <textarea
                  className="input min-h-24"
                  value={editForm.notes}
                  onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                />
              </label>

              <button
                type="submit"
                disabled={busyEdit}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                {busyEdit ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </form>

            <div className="border-t pt-5">
              <button
                type="button"
                onClick={deleteItem}
                disabled={busyEdit}
                className="w-full py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold disabled:opacity-50"
              >
                Excluir item do estoque
              </button>

              <p className="text-xs text-slate-500 mt-2 text-center">
                Itens já vinculados a uma OS não podem ser apagados para preservar o histórico.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
