import { useCallback, useEffect, useState } from "react";
import { MoonIcon, PlusIcon, SunIcon, Trash2Icon } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  MultiSelect,
  SearchableSelect,
  TooltipProvider,
  type SelectOption,
} from "nakomponents";
import { api, extractErrorMessage } from "./lib/api.ts";
import { detectPlatform } from "./lib/platform.ts";

type ItemStatus = "todo" | "doing" | "done";

type Item = NonNullable<Awaited<ReturnType<typeof api.api.items.get>>["data"]>["items"][number];

const STATUS_OPTIONS: readonly SelectOption<ItemStatus>[] = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "done", label: "Done" },
];

const TAG_OPTIONS: readonly SelectOption[] = [
  { value: "web", label: "Web" },
  { value: "desktop", label: "Desktop" },
  { value: "android", label: "Android" },
  { value: "api", label: "API" },
];

const STATUS_LABELS: Record<ItemStatus, string> = {
  todo: "To do",
  doing: "In progress",
  done: "Done",
};

type ItemModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
};

function CreateItemModal({ open, onOpenChange, onCreated }: ItemModalProps) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ItemStatus>("todo");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Enter a title.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.api.items.post({
        title: trimmed,
        status,
        tags,
      });
      if (res.error) {
        setError(extractErrorMessage(res.error));
        return;
      }
      setTitle("");
      setStatus("todo");
      setTags([]);
      onOpenChange(false);
      await onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New item"
      description="Validated by Elysia and typed end-to-end with Eden."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-item-form" disabled={submitting}>
            {submitting ? "Saving..." : "Create"}
          </Button>
        </>
      }
    >
      <form id="create-item-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-1.5">
          <label htmlFor="item-title" className="text-xs font-medium text-muted-foreground">
            Title
          </label>
          <Input
            id="item-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ship unified Electron shell"
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <SearchableSelect
            value={status}
            onValueChange={(next) => {
              if (next) setStatus(next);
            }}
            options={STATUS_OPTIONS}
            placeholder="Status"
            searchPlaceholder="Filter status..."
            label="Item status"
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Targets</span>
          <MultiSelect
            value={tags}
            onValueChange={setTags}
            options={TAG_OPTIONS}
            placeholder="Select platforms..."
            searchPlaceholder="Search tags..."
            label="Item targets"
          />
        </div>
      </form>
    </Modal>
  );
}

export function App() {
  const [light, setLight] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const platform = detectPlatform();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", light);
    root.classList.toggle("dark", !light);
  }, [light]);

  const fetchItems = useCallback(async () => {
    const res = await api.api.items.get({
      query: {
        status: statusFilter ?? undefined,
        q: query.trim() || undefined,
      },
    });
    if (res.error) {
      return { error: extractErrorMessage(res.error), items: null };
    }
    return { error: null, items: res.data.items };
  }, [query, statusFilter]);

  const reloadItems = useCallback(async () => {
    const result = await fetchItems();
    setLoading(false);
    setError(result.error);
    if (result.items) setItems(result.items);
  }, [fetchItems]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const result = await fetchItems();
      if (cancelled) return;
      setLoading(false);
      setError(result.error);
      if (result.items) setItems(result.items);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [fetchItems]);

  const cycleStatus = async (item: Item) => {
    const next: ItemStatus =
      item.status === "todo" ? "doing" : item.status === "doing" ? "done" : "todo";
    const res = await api.api.items({ id: item.id }).patch({ status: next });
    if (res.error) {
      setError(extractErrorMessage(res.error));
      return;
    }
    await reloadItems();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await api.api.items({ id: deleteTarget.id }).delete();
    if (res.error) {
      setError(extractErrorMessage(res.error));
      return;
    }
    setDeleteTarget(null);
    await reloadItems();
  };

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold tracking-tight">Nakokit</h1>
            <Badge variant="outline">{platform}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
              onClick={() => setLight((v) => !v)}
            >
              {light ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              New item
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            aria-label="Search items"
            className="sm:flex-1"
          />
          <SearchableSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            searchPlaceholder="Filter status..."
            label="Filter by status"
            clearable
            className="sm:w-44"
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="divide-y divide-border rounded-lg border border-border">
          {loading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No items yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  {item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void cycleStatus(item)}
                    aria-label={`Change status for ${item.title}`}
                  >
                    {STATUS_LABELS[item.status]}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <CreateItemModal open={createOpen} onOpenChange={setCreateOpen} onCreated={reloadItems} />

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title="Delete item"
          description={
            deleteTarget ? `Remove "${deleteTarget.title}" permanently?` : undefined
          }
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={confirmDelete}
        />
      </div>
    </TooltipProvider>
  );
}
