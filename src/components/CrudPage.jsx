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
}) {
  const all = useDB((s) => s[collection]);
  const add = useDB((s) => s.add);
  const update = useDB((s) => s.update);
  const remove = useDB((s) => s.remove);
  const [editing, setEditing] = useState(null);
  const rows = rowsOverride || all;

  const save = (v) => {
    const rec = toRecord(v);
    if (editing?.id) {
      update(collection, editing.id, rec);
      toast.success(`${cap(noun)} updated`);
    } else {
      add(collection, rec);
      toast.success(`${cap(noun)} added`);
    }
    setEditing(null);
  };

  const del = async (row) => {
    if (await confirmDialog(`Delete ${noun}?`, 'This cannot be undone.', { confirmLabel: 'Delete' })) {
      remove(collection, row.id);
      toast.success(`${cap(noun)} deleted`);
    }
  };

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
        toolbar={
          <>
            {toolbar}
            {canEdit && fields && (
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
