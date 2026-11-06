import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useDB } from '../data/store';
import { Button, DataTable, FormModal, IconButton, confirmDialog, toast } from './ui';

/**
 * Generic list + create/edit/delete screen for a store collection.
 */
export default function CrudPage({
  collection,
  noun = 'record',
  columns,
  fields,
  rows: rowsOverride,
  defaults = {},
  toRecord = (v) => v,
  canEdit = true,
  canDelete = true,
  onRowClick,
  toolbar,
  searchText,
  initialSort,
  pageSize,
  modalSize,
  onSaved,
  onDelete, // (ids) => void — custom delete (e.g. also removes linked records); default removes the rows
  deleteNote, // (rows) => string — extra line for the confirmation
  bulkDelete = true,
  canAdd = true,
}) {
  const all = useDB((s) => s[collection]);
  const add = useDB((s) => s.add);
  const update = useDB((s) => s.update);
  const remove = useDB((s) => s.remove);
  const [editing, setEditing] = useState(null);
  const rows = rowsOverride || all;

  const save = (v) => {
    // Fields starting with "_" (e.g. a photo) belong to the form, not the stored record.
    const rec = toRecord(Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('_'))));
    let saved;
    if (editing?.id) {
      update(collection, editing.id, rec);
      saved = { ...editing, ...rec };
      toast.success(`${cap(noun)} updated`);
    } else {
      saved = add(collection, rec);
      toast.success(`${cap(noun)} added`);
    }
    onSaved?.(saved, v);
    setEditing(null);
  };

  const removeMany = useDB((s) => s.removeMany);
  const delRows = async (list, done) => {
    const many = list.length > 1;
    const what = many ? `${list.length} ${plural(noun)}` : noun;
    const note = deleteNote?.(list);
    if (!(await confirmDialog(`Delete ${what}?`, `${note ? note + ' ' : ''}This cannot be undone.`, { confirmLabel: 'Delete' }))) return;
    const ids = list.map((r) => r.id);
    if (onDelete) onDelete(ids);
    else if (many) removeMany(collection, ids);
    else remove(collection, ids[0]);
    toast.success(many ? `${list.length} ${plural(noun)} deleted` : `${cap(noun)} deleted`);
    done?.();
  };
  const del = (row) => delRows([row]);

  const cols = canEdit
    ? [
        ...columns,
        {
          key: '_actions',
          label: '',
          nosort: true,
          className: 'w-px text-right',
          render: (row) => (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(row)} />
              {canDelete && <IconButton icon={Trash2} label="Delete" tone="ghost" className="hover:!bg-accent-50 hover:!text-accent-600" onClick={() => del(row)} />}
            </div>
          ),
        },
      ]
    : columns;

  return (
    <>
      <DataTable
        columns={cols}
        rows={rows}
        onRowClick={onRowClick}
        searchText={searchText}
        initialSort={initialSort}
        pageSize={pageSize}
        bulk={canEdit && canDelete && bulkDelete ? (list, clear) => <Button size="sm" variant="soft-red" icon={Trash2} onClick={() => delRows(list, clear)}>Delete {list.length}</Button> : undefined}
        toolbar={
          <>
            {toolbar}
            {canEdit && canAdd && fields && (
              <Button icon={Plus} onClick={() => setEditing({ ...defaults })}>
                Add {noun}
              </Button>
            )}
          </>
        }
      />
      {fields && (
        <FormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title={editing?.id ? `Edit ${noun}` : `New ${noun}`}
          fields={fields}
          initial={editing}
          onSubmit={save}
          size={modalSize}
        />
      )}
    </>
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n) => (/(s|sh|ch|x)$/.test(n) ? n + 'es' : /[^aeiou]y$/.test(n) ? n.slice(0, -1) + 'ies' : n + 's');
