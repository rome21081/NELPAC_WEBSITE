import { Plus, Trash2 } from "lucide-react";

const fieldTypes = [
  ["text", "Short text"],
  ["textarea", "Long text"],
  ["number", "Number"],
  ["date", "Date"],
  ["tel", "Phone number"],
  ["email", "Email"],
];

function createConfigId(prefix) {
  const randomId = globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function CustomFormSectionsEditor({ sections = [], onChange, tone = "blue" }) {
  const addButtonClass =
    tone === "violet"
      ? "border-violet-200 text-violet-700"
      : "border-blue-200 text-blue-700";
  const addFieldClass =
    tone === "violet"
      ? "bg-violet-50 text-violet-700"
      : "bg-blue-50 text-blue-700";
  const addSection = () =>
    onChange([
      ...sections,
      {
        id: createConfigId("section"),
        title: "",
        description: "",
        fields: [],
      },
    ]);
  const updateSection = (index, updates) =>
    onChange(
      sections.map((section, row) =>
        row === index ? { ...section, ...updates } : section,
      ),
    );
  const addField = (sectionIndex) => {
    const section = sections[sectionIndex];
    updateSection(sectionIndex, {
      fields: [
        ...(section.fields || []),
        {
          id: createConfigId("field"),
          label: "",
          type: "text",
          placeholder: "",
          required: false,
        },
      ],
    });
  };
  const updateField = (sectionIndex, fieldIndex, updates) => {
    const section = sections[sectionIndex];
    updateSection(sectionIndex, {
      fields: (section.fields || []).map((field, row) =>
        row === fieldIndex ? { ...field, ...updates } : field,
      ),
    });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-900">
            Additional Form Sections
          </h3>
          <p className="text-xs text-slate-500">
            Add instructions and input fields that users must answer after the
            main form section.
          </p>
        </div>
        <button
          type="button"
          onClick={addSection}
          className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${addButtonClass}`}
        >
          <Plus size={14} /> Add section
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {sections.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No additional sections configured.
          </p>
        )}
        {sections.map((section, sectionIndex) => (
          <div
            key={section.id || sectionIndex}
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input
                placeholder="Section title"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={section.title || ""}
                onChange={(event) =>
                  updateSection(sectionIndex, { title: event.target.value })
                }
              />
              <input
                placeholder="Instructions or details"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={section.description || ""}
                onChange={(event) =>
                  updateSection(sectionIndex, {
                    description: event.target.value,
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  onChange(sections.filter((_, row) => row !== sectionIndex))
                }
                className="rounded-xl border border-red-200 bg-white p-2 text-red-600"
                title="Remove section"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {(section.fields || []).map((field, fieldIndex) => (
                <div
                  key={field.id || fieldIndex}
                  className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 lg:grid-cols-[1.3fr_.8fr_1.2fr_auto_auto]"
                >
                  <input
                    placeholder="Field label"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={field.label || ""}
                    onChange={(event) =>
                      updateField(sectionIndex, fieldIndex, {
                        label: event.target.value,
                      })
                    }
                  />
                  <select
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={field.type || "text"}
                    onChange={(event) =>
                      updateField(sectionIndex, fieldIndex, {
                        type: event.target.value,
                      })
                    }
                  >
                    {fieldTypes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Placeholder or hint"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={field.placeholder || ""}
                    onChange={(event) =>
                      updateField(sectionIndex, fieldIndex, {
                        placeholder: event.target.value,
                      })
                    }
                  />
                  <label className="flex items-center gap-2 whitespace-nowrap text-xs font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(event) =>
                        updateField(sectionIndex, fieldIndex, {
                          required: event.target.checked,
                        })
                      }
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateSection(sectionIndex, {
                        fields: (section.fields || []).filter(
                          (_, row) => row !== fieldIndex,
                        ),
                      })
                    }
                    className="rounded-lg border border-red-200 p-2 text-red-600"
                    title="Remove field"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addField(sectionIndex)}
              className={`mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold ${addFieldClass}`}
            >
              <Plus size={13} /> Add input field
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CustomFormSections({
  sections = [],
  values = {},
  onChange,
  tone = "blue",
}) {
  const ringClass =
    tone === "violet"
      ? "focus:border-violet-400 focus:ring-violet-100"
      : "focus:border-blue-400 focus:ring-blue-100";
  const inputClass = `mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-4 ${ringClass}`;

  return sections
    .filter(
      (section) =>
        section.title || section.description || (section.fields || []).length,
    )
    .map((section, sectionIndex) => (
      <section
        key={section.id || sectionIndex}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <h2 className="font-extrabold text-slate-900">
          {section.title || `Additional information ${sectionIndex + 1}`}
        </h2>
        {section.description && (
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
            {section.description}
          </p>
        )}
        {(section.fields || []).length > 0 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(section.fields || []).map((field, fieldIndex) => {
              const fieldId = field.id || `legacy-${sectionIndex}-${fieldIndex}`;
              const commonProps = {
                required: Boolean(field.required),
                value: values[fieldId] || "",
                placeholder: field.placeholder || "",
                onChange: (event) => onChange(fieldId, event.target.value),
                className: inputClass,
              };
              return (
                <label
                  key={fieldId}
                  className={`text-sm font-semibold text-slate-700 ${field.type === "textarea" ? "sm:col-span-2" : ""}`}
                >
                  {field.label || `Field ${fieldIndex + 1}`}
                  {field.required && <span className="text-red-500"> *</span>}
                  {field.type === "textarea" ? (
                    <textarea rows="4" {...commonProps} />
                  ) : (
                    <input type={field.type || "text"} {...commonProps} />
                  )}
                </label>
              );
            })}
          </div>
        )}
      </section>
    ));
}

export { CustomFormSections, CustomFormSectionsEditor };
