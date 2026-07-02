import { useState } from "react";
import {
  Edit2,
  ExternalLink,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import {
  listMerchForms,
  saveMerchForm,
  uploadStorageImage,
} from "../../lib/supabaseServices";
import { useSupabaseData } from "../../lib/useSupabaseData";

const emptyForm = {
  title: "",
  description: "",
  preorder_date: "",
  deadline: "",
  image_url: "",
  merch_type: "Shirt",
  custom_merch_name: "",
  item_fee: 0,
  slug: "",
  status: "Draft",
  guide_text:
    "Pre-order must be filled out by one representative only, preferably the Local Church President.",
  gcash_details: "",
  gcash_recipient_name: "",
  gcash_number: "",
  form_config: { custom_sections: [], shirt_colors: [] },
};
const inputClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100";

function MerchPreordersManagement() {
  const { profile } = useAuth();
  const {
    data: forms,
    loading,
    error,
    reload,
  } = useSupabaseData(() => listMerchForms(), []);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const reset = () => {
    setForm(emptyForm);
    setImageFile(null);
    setPreview("");
  };
  const edit = (item) => {
    setForm({
      ...emptyForm,
      ...item,
      deadline: item.deadline?.slice(0, 16) || "",
      form_config: {
        custom_sections: item.form_config?.custom_sections || [],
        shirt_colors: item.form_config?.shirt_colors || [],
      },
    });
    setImageFile(null);
    setPreview(item.image_url || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!form.gcash_recipient_name.trim() || !form.gcash_number.trim()) {
      setMessage(
        "Unable to save: enter both the GCash recipient name and GCash number.",
      );
      return;
    }
    if (
      form.merch_type === "Shirt" &&
      !(form.form_config?.shirt_colors || []).some((color) => color.trim())
    ) {
      setMessage("Unable to save: add at least one available shirt color.");
      return;
    }
    setSaving(true);
    try {
      const imageUrl = imageFile
        ? await uploadStorageImage(
            "merch-images",
            imageFile,
            "merch",
            profile.id,
          )
        : form.image_url;
      const generatedSlug = form.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const shirtColors = [
        ...new Set(
          (form.form_config?.shirt_colors || [])
            .map((color) => color.trim())
            .filter(Boolean),
        ),
      ];
      const formConfig = {
        ...(form.form_config || {}),
        shirt_colors: form.merch_type === "Shirt" ? shirtColors : [],
      };
      await saveMerchForm({
        ...form,
        deadline: form.deadline || null,
        custom_merch_name:
          form.merch_type === "Others" ? form.custom_merch_name : null,
        item_fee: Number(form.item_fee),
        slug: form.slug || generatedSlug,
        image_url: imageUrl || null,
        created_by: form.created_by || profile.id,
        form_config: formConfig,
      });
      const edited = Boolean(form.id);
      reset();
      await reload();
      setMessage(edited ? "Merch form updated." : "Merch form created.");
    } catch (err) {
      setMessage(
        `Unable to save merch form: ${err.message || "Please try again."}`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading merch forms..." />;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Merch Pre-Order Forms
        </h1>
        <p className="text-sm text-slate-500">
          Create shirt, lace, or custom merch order forms.
        </p>
      </div>
      <ErrorState
        message={
          error || (message.toLowerCase().includes("unable") ? message : "")
        }
      />
      {message && !message.toLowerCase().includes("unable") && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-extrabold text-violet-950">
              Additional merch form sections
            </p>
            <p className="text-xs text-violet-700">
              Add or remove instructions that appear above the church order
              form.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                form_config: {
                  ...f.form_config,
                  custom_sections: [
                    ...(f.form_config?.custom_sections || []),
                    { title: "", description: "" },
                  ],
                },
              }))
            }
            className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-violet-700"
          >
            <Plus size={13} /> Add section
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {(form.form_config?.custom_sections || []).map((section, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-violet-100 bg-white p-3 sm:grid-cols-[1fr_2fr_auto]"
            >
              <input
                placeholder="Section title"
                className="rounded-lg border px-3 py-2 text-sm"
                value={section.title}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    form_config: {
                      ...f.form_config,
                      custom_sections: f.form_config.custom_sections.map(
                        (item, row) =>
                          row === index
                            ? { ...item, title: e.target.value }
                            : item,
                      ),
                    },
                  }))
                }
              />
              <input
                placeholder="Instructions or details"
                className="rounded-lg border px-3 py-2 text-sm"
                value={section.description}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    form_config: {
                      ...f.form_config,
                      custom_sections: f.form_config.custom_sections.map(
                        (item, row) =>
                          row === index
                            ? { ...item, description: e.target.value }
                            : item,
                      ),
                    },
                  }))
                }
              />
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    form_config: {
                      ...f.form_config,
                      custom_sections: f.form_config.custom_sections.filter(
                        (_, row) => row !== index,
                      ),
                    },
                  }))
                }
                className="rounded-lg border border-red-200 p-2 text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-extrabold text-slate-900">
          Merch price applies to every template type
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Choose Shirt, Lace, or Others below, then enter its price in{" "}
          <strong>Price per Item</strong>. Shirt displays color and XS–XXL
          fields; Lace displays total quantity; Others displays the custom merch
          name and total quantity.
        </p>
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-extrabold text-emerald-950">
          GCash Account Details
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          These details will be displayed to users in the merch payment section.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-emerald-900">
            Name of the Recipient
            <input
              className={inputClass}
              value={form.gcash_recipient_name}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  gcash_recipient_name: e.target.value,
                }))
              }
            />
          </label>
          <label className="text-xs font-bold text-emerald-900">
            GCash Number
            <input
              inputMode="numeric"
              className={inputClass}
              value={form.gcash_number}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  gcash_number: e.target.value,
                }))
              }
            />
          </label>
        </div>
      </div>
      {form.merch_type === "Shirt" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-blue-950">
                Available Shirt Colors
              </p>
              <p className="text-xs text-blue-700">
                Users can select only the colors entered here.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  form_config: {
                    ...current.form_config,
                    shirt_colors: [
                      ...(current.form_config?.shirt_colors || []),
                      "",
                    ],
                  },
                }))
              }
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-700"
            >
              <Plus size={13} /> Add color
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(form.form_config?.shirt_colors || []).map((color, index) => (
              <div key={index} className="flex gap-2">
                <input
                  placeholder={`Color ${index + 1}, e.g. Navy Blue`}
                  className={inputClass}
                  value={color}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      form_config: {
                        ...current.form_config,
                        shirt_colors: current.form_config.shirt_colors.map(
                          (item, row) =>
                            row === index ? e.target.value : item,
                        ),
                      },
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      form_config: {
                        ...current.form_config,
                        shirt_colors: current.form_config.shirt_colors.filter(
                          (_, row) => row !== index,
                        ),
                      },
                    }))
                  }
                  className="mt-1.5 rounded-xl border border-red-200 bg-white p-2.5 text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {(form.form_config?.shirt_colors || []).length === 0 && (
            <p className="mt-3 rounded-xl bg-white p-3 text-xs text-blue-700">
              No colors added yet. Add at least one color before saving a Shirt
              form.
            </p>
          )}
        </div>
      )}
      <form
        onSubmit={save}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-2 text-violet-700">
            <ShoppingBag size={20} />
          </div>
          <h2 className="font-extrabold">
            {form.id ? "Edit merch form" : "Create merch form"}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-bold text-slate-600">
            Title
            <input
              required
              className={`mt-1 ${inputClass}`}
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Date
            <input
              required
              type="date"
              className={`mt-1 ${inputClass}`}
              value={form.preorder_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, preorder_date: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Deadline
            <input
              type="datetime-local"
              className={`mt-1 ${inputClass}`}
              value={form.deadline}
              onChange={(e) =>
                setForm((f) => ({ ...f, deadline: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Merch Type
            <select
              className={`mt-1 ${inputClass}`}
              value={form.merch_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, merch_type: e.target.value }))
              }
            >
              <option>Shirt</option>
              <option>Lace</option>
              <option>Others</option>
            </select>
          </label>
          {form.merch_type === "Others" && (
            <label className="text-xs font-bold text-slate-600">
              Custom Merch Name
              <input
                required
                className={`mt-1 ${inputClass}`}
                value={form.custom_merch_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, custom_merch_name: e.target.value }))
                }
              />
            </label>
          )}
          <label className="text-xs font-bold text-slate-600">
            Price per Item
            <input
              required
              min="0"
              step="0.01"
              type="number"
              className={`mt-1 ${inputClass}`}
              value={form.item_fee}
              onChange={(e) =>
                setForm((f) => ({ ...f, item_fee: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Status
            <select
              className={`mt-1 ${inputClass}`}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
            >
              <option>Draft</option>
              <option>Published</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Page Slug
            <input
              placeholder="Generated from title"
              className={`mt-1 ${inputClass}`}
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                }))
              }
            />
          </label>
          <label className="text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-3">
            Description
            <textarea
              rows="3"
              className={`mt-1 ${inputClass}`}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-3">
            Form Guide
            <textarea
              rows="2"
              className={`mt-1 ${inputClass}`}
              value={form.guide_text}
              onChange={(e) =>
                setForm((f) => ({ ...f, guide_text: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-3">
            Merch Image
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setImageFile(file);
                setPreview(file ? URL.createObjectURL(file) : form.image_url);
              }}
            />
            {preview && (
              <img
                src={preview}
                alt="Preview"
                className="mt-3 max-h-72 w-full rounded-2xl bg-slate-50 object-contain"
              />
            )}
          </label>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {message.toLowerCase().includes("unable") && (
            <p className="mr-auto rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {message}
            </p>
          )}
          {form.id && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm"
            >
              <X size={16} /> Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />{" "}
            {saving ? "Saving..." : form.id ? "Update Form" : "Create Form"}
          </button>
        </div>
      </form>
      {forms.length === 0 ? (
        <EmptyState label="No merch forms yet." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {forms.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="h-44 w-full object-cover"
                />
              )}
              <div className="p-5">
                <div className="flex justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-violet-700">
                      {item.merch_type === "Others"
                        ? item.custom_merch_name
                        : item.merch_type}
                    </span>
                    <h2 className="font-extrabold text-slate-900">
                      {item.title}
                    </h2>
                  </div>
                  <strong>₱{Number(item.item_fee).toLocaleString()}</strong>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {item.preorder_date} · {item.status}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => edit(item)}
                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  {item.status === "Published" && (
                    <a
                      href={`/user/merch-preorders/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-700"
                    >
                      <ExternalLink size={14} /> Open Form
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export { MerchPreordersManagement };
