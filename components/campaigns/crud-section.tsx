"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Controller,
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from "react-hook-form";

import { FormField } from "@/components/campaigns/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { EmptyState } from "@/components/empty-state";

type Row = { id: string };

export type FieldConfig<TForm extends FieldValues> = {
  name: Path<TForm>;
  label: string;
  control?: "input" | "number" | "textarea" | "datetime" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export type CrudSectionProps<TRow extends Row, TForm extends FieldValues> = {
  title: string;
  itemLabel: string;
  initialItems: TRow[];
  resolver: Resolver<TForm>;
  fields: FieldConfig<TForm>[];
  emptyDefaults: DefaultValues<TForm>;
  toDefaults: (row: TRow) => DefaultValues<TForm>;
  rowTitle: (row: TRow) => string;
  rowMeta?: (row: TRow) => string | null;
  createFn: (values: TForm) => Promise<TRow>;
  updateFn: (id: string, values: TForm) => Promise<TRow>;
  deleteFn: (id: string) => Promise<unknown>;
};

const emptyToUndefined = (v: string) => (v === "" ? undefined : v);
const toLocalDateTime = (d: Date) => new Date(d).toISOString().slice(0, 16);

// Generic section: lists rows, optimistic delete, and a create/edit dialog whose form is
// validated by the SAME shared Zod schema the procedure uses. Render-only content is
// plain text (React escapes it) — no dangerouslySetInnerHTML anywhere.
export function CrudSection<TRow extends Row, TForm extends FieldValues>({
  title,
  itemLabel,
  initialItems,
  resolver,
  fields,
  emptyDefaults,
  toDefaults,
  rowTitle,
  rowMeta,
  createFn,
  updateFn,
  deleteFn,
}: CrudSectionProps<TRow, TForm>) {
  const router = useRouter();
  const [items, setItems] = useState<TRow[]>(initialItems);
  const [editing, setEditing] = useState<TRow | null>(null);
  const [open, setOpen] = useState(false);

  const form = useForm<TForm>({
    resolver,
    defaultValues: emptyDefaults,
  });

  function openCreate() {
    setEditing(null);
    form.reset(emptyDefaults);
    setOpen(true);
  }

  function openEdit(row: TRow) {
    setEditing(row);
    form.reset(toDefaults(row));
    setOpen(true);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        const updated = await updateFn(editing.id, values);
        setItems((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r)),
        );
        toast({ title: `${itemLabel} updated` });
      } else {
        const created = await createFn(values);
        setItems((prev) => [...prev, created]);
        toast({ title: `${itemLabel} created` });
      }
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: `Could not save ${itemLabel}`, variant: "destructive" });
    }
  });

  async function onDelete(row: TRow) {
    // Optimistic remove; restore on error.
    const prev = items;
    setItems((cur) => cur.filter((r) => r.id !== row.id));
    try {
      await deleteFn(row.id);
      toast({ title: `${itemLabel} deleted` });
      router.refresh();
    } catch {
      setItems(prev);
      toast({ title: `Could not delete ${itemLabel}`, variant: "destructive" });
    }
  }

  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus aria-hidden="true" />
              Add {itemLabel}
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {editing ? `Edit ${itemLabel}` : `New ${itemLabel}`}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {fields.map((field) => (
                <FormField
                  key={String(field.name)}
                  label={field.label}
                  error={form.formState.errors[field.name]?.message as string}
                >
                  {(props) =>
                    field.control === "textarea" ? (
                      <Textarea
                        {...props}
                        placeholder={field.placeholder}
                        {...form.register(field.name, {
                          setValueAs: emptyToUndefined,
                        })}
                      />
                    ) : field.control === "select" ? (
                      <Controller
                        control={form.control}
                        name={field.name}
                        render={({ field: f }) => (
                          <Select
                            value={(f.value as string) ?? ""}
                            onValueChange={f.onChange}
                          >
                            <SelectTrigger
                              id={props.id}
                              aria-invalid={props["aria-invalid"]}
                              aria-describedby={props["aria-describedby"]}
                            >
                              <SelectValue placeholder={field.placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options ?? []).map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    ) : field.control === "datetime" ? (
                      <Controller
                        control={form.control}
                        name={field.name}
                        render={({ field: f }) => {
                          const raw: unknown = f.value;
                          return (
                          <Input
                            {...props}
                            type="datetime-local"
                            value={
                              raw instanceof Date
                                ? toLocalDateTime(raw)
                                : typeof raw === "string"
                                  ? raw
                                  : ""
                            }
                            onBlur={f.onBlur}
                            ref={f.ref}
                            onChange={(e) =>
                              f.onChange(
                                e.target.value === ""
                                  ? undefined
                                  : new Date(e.target.value),
                              )
                            }
                          />
                          );
                        }}
                      />
                    ) : (
                      <Input
                        {...props}
                        type={field.control === "number" ? "number" : "text"}
                        placeholder={field.placeholder}
                        {...form.register(field.name, {
                          setValueAs:
                            field.control === "number"
                              ? undefined
                              : emptyToUndefined,
                        })}
                      />
                    )
                  }
                </FormField>
              ))}
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Save changes" : `Add ${itemLabel}`}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{rowTitle(row)}</p>
                {rowMeta?.(row) ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {rowMeta(row)}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit ${rowTitle(row)}`}
                  onClick={() => openEdit(row)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${rowTitle(row)}`}
                  onClick={() => onDelete(row)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
