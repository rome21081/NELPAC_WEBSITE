import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardPenLine,
  MapPin,
  Save,
} from "lucide-react";
import { useSearchParams } from "react-router";
import { CustomFormSectionsEditor } from "../../components/CustomFormSections";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import {
  listEvents,
  updateEventPreRegistration,
} from "../../lib/supabaseServices";
import { useSupabaseData } from "../../lib/useSupabaseData";

const defaultGuide =
  "Registration must be filled out by one representative only, preferably the Local Church President.";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

function PreRegistrationManagement({ onsite = false }) {
  const [params, setParams] = useSearchParams();
  const {
    data: events,
    loading,
    error,
    reload,
  } = useSupabaseData(() => listEvents(), []);
  const [selectedId, setSelectedId] = useState(params.get("event") || "");
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedId),
    [events, selectedId],
  );

  useEffect(() => {
    if (!selectedEvent) {
      setSettings(null);
      return;
    }
    setSettings({
      pre_registration_enabled: Boolean(onsite ? selectedEvent.onsite_registration_enabled : selectedEvent.pre_registration_enabled),
      pre_registration_slug: (onsite ? selectedEvent.onsite_registration_slug : selectedEvent.pre_registration_slug) || "",
      onsite_registration_mode: selectedEvent.onsite_registration_mode || "Automatic",
      registration_fee: selectedEvent.registration_fee || 0,
      registration_deadline:
        selectedEvent.registration_deadline?.slice(0, 16) || "",
      registration_guide: (onsite ? selectedEvent.onsite_registration_guide : selectedEvent.registration_guide) || defaultGuide,
      registration_gcash_details:
        selectedEvent.registration_gcash_details || "",
      registration_gcash_recipient_name:
        selectedEvent.registration_gcash_recipient_name || "",
      registration_gcash_number:
        selectedEvent.registration_gcash_number || "",
      section_one_title:
        (onsite ? selectedEvent.onsite_registration_form_config : selectedEvent.registration_form_config)?.section_one_title ||
        "Church and delegate information",
      section_two_title:
        (onsite ? selectedEvent.onsite_registration_form_config : selectedEvent.registration_form_config)?.section_two_title ||
        "Payment details",
      custom_sections:
        (onsite ? selectedEvent.onsite_registration_form_config : selectedEvent.registration_form_config)?.custom_sections || [],
    });
  }, [onsite, selectedEvent]);

  const chooseEvent = (eventId) => {
    setSelectedId(eventId);
    setParams({ type: onsite ? "onsite" : "registration", event: eventId });
    setMessage("");
  };

  const update = (field, value) =>
    setSettings((current) => ({ ...current, [field]: value }));

  const save = async (submitEvent) => {
    submitEvent.preventDefault();
    setMessage("");
    if (
      !onsite && settings.pre_registration_enabled &&
      (!settings.registration_gcash_recipient_name.trim() ||
        !settings.registration_gcash_number.trim())
    ) {
      setMessage(
        "Unable to save: enter both the GCash recipient name and GCash number.",
      );
      return;
    }
    if (
      settings.custom_sections.some((section) =>
        (section.fields || []).some((field) => !field.label?.trim()),
      )
    ) {
      setMessage("Unable to save: every custom input field needs a label.");
      return;
    }
    setSaving(true);
    try {
      const generatedSlug = selectedEvent.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await updateEventPreRegistration(selectedId, onsite ? {
        onsite_registration_enabled: settings.pre_registration_enabled,
        onsite_registration_mode: settings.onsite_registration_mode,
        onsite_registration_slug: settings.pre_registration_enabled ? settings.pre_registration_slug || `${generatedSlug}-onsite` : null,
        registration_fee: Number(settings.registration_fee || 0),
        onsite_registration_guide: settings.registration_guide,
        onsite_registration_form_config: {
          section_one_title: settings.section_one_title,
          section_two_title: settings.section_two_title,
          custom_sections: settings.custom_sections,
        },
      } : {
          pre_registration_enabled: settings.pre_registration_enabled,
          pre_registration_slug: settings.pre_registration_enabled ? settings.pre_registration_slug || generatedSlug : null,
          registration_fee: Number(settings.registration_fee || 0),
          registration_deadline: settings.registration_deadline || null,
          registration_guide: settings.registration_guide,
          registration_gcash_details: settings.registration_gcash_details || null,
          registration_gcash_recipient_name: settings.registration_gcash_recipient_name || null,
          registration_gcash_number: settings.registration_gcash_number || null,
          registration_form_config: {
            section_one_title: settings.section_one_title,
            section_two_title: settings.section_two_title,
            custom_sections: settings.custom_sections,
          },
        });
      await reload();
      setMessage(`${onsite ? "Onsite registration" : "Pre-registration"} settings saved for this event.`);
    } catch (saveError) {
      setMessage(
        saveError.message || "Unable to save pre-registration settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <LoadingState label={`Loading events for ${onsite ? "onsite registration" : "pre-registration"}...`} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Event {onsite ? "Onsite Registration" : "Pre-Registration"} Forms
        </h1>
        <p className="text-sm text-slate-500">
          Select an event, configure its {onsite ? "first-day onsite" : "pre-event"} registration form, and add optional user input sections.
        </p>
      </div>
      <ErrorState
        message={error || (message.includes("Unable") ? message : "")}
      />
      {message && !message.includes("Unable") && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 size={17} /> {message}
        </p>
      )}

      {events.length === 0 ? (
        <EmptyState label={`Create an event first before configuring ${onsite ? "onsite registration" : "pre-registration"}.`} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[20rem_1fr]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 px-2 text-xs font-black uppercase tracking-wide text-slate-400">
              Choose an existing event
            </p>
            <div className="space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => chooseEvent(event.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === event.id ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-sm text-slate-900">
                      {event.title}
                    </strong>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${(onsite ? event.onsite_registration_enabled : event.pre_registration_enabled) ? "bg-emerald-500" : "bg-slate-300"}`}
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays size={13} /> {event.event_date}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          {!selectedEvent || !settings ? (
            <div className="flex min-h-72 items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-center">
              <div>
                <ClipboardPenLine className="mx-auto text-blue-600" size={38} />
                <h2 className="mt-3 font-extrabold text-blue-950">
                  Select an event
                </h2>
              </div>
            </div>
          ) : (
            <form onSubmit={save} className="space-y-5">
              <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                {selectedEvent.image_url && (
                  <img
                    src={selectedEvent.image_url}
                    alt={selectedEvent.title}
                    className="h-48 w-full object-cover"
                  />
                )}
                <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                      Connected Event
                    </p>
                    <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                      {selectedEvent.title}
                    </h2>
                    <p className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={14} /> {selectedEvent.event_date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} /> {selectedEvent.venue || "Venue TBA"}
                      </span>
                    </p>
                  </div>
                  <label className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">
                    Open {onsite ? "Onsite Registration" : "Pre-Registration"}
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-blue-700"
                      checked={settings.pre_registration_enabled}
                      onChange={(event) =>
                        update("pre_registration_enabled", event.target.checked)
                      }
                    />
                  </label>
                </div>
              </header>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h3 className="font-extrabold text-slate-900">
                  Registration settings for {selectedEvent.title}
                </h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {onsite && <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    Opening Control
                    <select className={inputClass} value={settings.onsite_registration_mode} onChange={(event) => update("onsite_registration_mode", event.target.value)}>
                      <option value="Automatic">Automatic — opens on the first day of the event</option>
                      <option value="Manual">Manual — opens immediately when the switch is on</option>
                    </select>
                  </label>}
                  <label className="text-sm font-semibold text-slate-700">
                    Registration Fee per Delegate
                    <input required min="0" step="0.01" type="number" className={inputClass} value={settings.registration_fee} onChange={(event) => update("registration_fee", event.target.value)} />
                  </label>
                  {!onsite && <label className="text-sm font-semibold text-slate-700">
                    Registration Deadline
                    <input type="datetime-local" className={inputClass} value={settings.registration_deadline} onChange={(event) => update("registration_deadline", event.target.value)} />
                  </label>}
                  <label className="text-sm font-semibold text-slate-700">
                    Registration Page Slug
                    <input className={inputClass} placeholder="Generated from event title" value={settings.pre_registration_slug} onChange={(event) => update("pre_registration_slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
                  </label>
                  <div className="hidden sm:block" />
                  {!onsite && <label className="text-sm font-semibold text-slate-700">
                    Name of the GCash Recipient
                    <input className={inputClass} value={settings.registration_gcash_recipient_name} onChange={(event) => update("registration_gcash_recipient_name", event.target.value)} />
                  </label>}
                  {!onsite && <label className="text-sm font-semibold text-slate-700">
                    GCash Number
                    <input inputMode="numeric" className={inputClass} value={settings.registration_gcash_number} onChange={(event) => update("registration_gcash_number", event.target.value)} />
                  </label>}
                  <label className="text-sm font-semibold text-slate-700">
                    Section 1 Title
                    <input className={inputClass} value={settings.section_one_title} onChange={(event) => update("section_one_title", event.target.value)} />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Section 2 Title
                    <input className={inputClass} value={settings.section_two_title} onChange={(event) => update("section_two_title", event.target.value)} />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    Representative Guide
                    <textarea rows="3" className={inputClass} value={settings.registration_guide} onChange={(event) => update("registration_guide", event.target.value)} />
                  </label>
                </div>
              </section>

              <CustomFormSectionsEditor
                sections={settings.custom_sections}
                onChange={(sections) => update("custom_sections", sections)}
              />

              <button
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 text-sm font-extrabold text-white shadow-lg disabled:opacity-60"
              >
                <Save size={17} />
                {saving
                  ? "Saving event registration form..."
                  : `Save ${onsite ? "Onsite Registration" : "Pre-Registration"} Form`}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export { PreRegistrationManagement };
