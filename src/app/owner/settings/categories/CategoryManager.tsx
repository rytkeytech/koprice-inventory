"use client";

import { ArrowDown, ArrowUp, Check, Eye, EyeOff } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import type { Category } from "@/lib/catalogue";
import { addCategory, updateCategory, type CategoryState } from "./actions";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [addState, addAction] = useActionState<CategoryState, FormData>(addCategory, {});
  const [rowState, setRowState] = useState<CategoryState>({});
  const [pending, startTransition] = useTransition();

  const run = (id: string, patch: Parameters<typeof updateCategory>[1]) =>
    startTransition(async () => setRowState(await updateCategory(id, patch)));

  // Move a category up/down by swapping sort order with its neighbour.
  const move = (index: number, direction: -1 | 1) => {
    const a = categories[index];
    const b = categories[index + direction];
    if (!a || !b) return;
    startTransition(async () => {
      const first = await updateCategory(a.id, { sort_order: b.sort_order });
      const second = await updateCategory(b.id, { sort_order: a.sort_order === b.sort_order ? a.sort_order + direction : a.sort_order });
      setRowState(first.error ? first : second);
    });
  };

  return (
    <div className="space-y-4">
      <form action={addAction} className="space-y-3 rounded-card border border-line bg-card p-4">
        <label htmlFor="new-category" className="block font-semibold">
          New category
        </label>
        <input id="new-category" name="name" className="h-12 w-full rounded-control border border-input px-3 text-base" placeholder="e.g. Baby Care" />
        <FormAlert error={addState.error} message={addState.done} />
        <SubmitButton pendingText="Adding…">Add category</SubmitButton>
      </form>

      <FormAlert error={rowState.error} />

      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card" aria-busy={pending}>
        {categories.map((c, i) => (
          <CategoryRow
            key={c.id}
            category={c}
            first={i === 0}
            last={i === categories.length - 1}
            disabled={pending}
            onRename={(name) => run(c.id, { name })}
            onToggle={() => run(c.id, { is_active: !c.is_active })}
            onMove={(d) => move(i, d)}
          />
        ))}
      </ul>
    </div>
  );
}

function CategoryRow({
  category,
  first,
  last,
  disabled,
  onRename,
  onToggle,
  onMove,
}: {
  category: Category;
  first: boolean;
  last: boolean;
  disabled: boolean;
  onRename: (name: string) => void;
  onToggle: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [name, setName] = useState(category.name);
  const changed = name.trim() !== category.name;
  const iconButton = "flex size-11 items-center justify-center rounded-full text-muted hover:bg-bg disabled:opacity-30";

  return (
    <li className={`flex items-center gap-1 px-2 py-2 ${category.is_active ? "" : "bg-bg"}`}>
      <label className="sr-only" htmlFor={`cat-${category.id}`}>
        Category name
      </label>
      <input
        id={`cat-${category.id}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`h-11 min-w-0 flex-1 rounded-control border border-transparent px-2 text-base hover:border-input focus:border-brand ${category.is_active ? "" : "text-muted line-through"}`}
      />
      {changed && (
        <button type="button" aria-label="Save name" className={`${iconButton} text-brand`} disabled={disabled} onClick={() => onRename(name)}>
          <Check aria-hidden="true" className="size-5" />
        </button>
      )}
      <button type="button" aria-label="Move up" className={iconButton} disabled={disabled || first} onClick={() => onMove(-1)}>
        <ArrowUp aria-hidden="true" className="size-5" />
      </button>
      <button type="button" aria-label="Move down" className={iconButton} disabled={disabled || last} onClick={() => onMove(1)}>
        <ArrowDown aria-hidden="true" className="size-5" />
      </button>
      <button
        type="button"
        aria-label={category.is_active ? "Hide category" : "Show category"}
        title={category.is_active ? "Hide" : "Show"}
        className={iconButton}
        disabled={disabled}
        onClick={onToggle}
      >
        {category.is_active ? <Eye aria-hidden="true" className="size-5" /> : <EyeOff aria-hidden="true" className="size-5" />}
      </button>
    </li>
  );
}
