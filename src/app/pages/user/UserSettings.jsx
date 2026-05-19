import { useEffect, useState } from "react";

const STORAGE_KEY = "nelpac-user-preferences";

const defaultSettings = {
  darkMode: false,
  largerText: false,
  emailNotifications: true,
  eventReminders: true,
  rewardUpdates: true,
  reduceMotion: false,
  highContrast: false,
};

function UserSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
  }, []);

  const update = (field, value) => {
    const next = { ...settings, [field]: value };
    setSettings(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setMessage("Settings saved on this device.");
  };

  const toggle = (field, label) => <label className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm" key={field}>
    <span>{label}</span>
    <input type="checkbox" checked={settings[field]} onChange={(e) => update(field, e.target.checked)} />
  </label>;

  return <div className="space-y-5">
    <div>
      <h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Settings</h1>
      <p className="text-slate-500 text-sm">System preferences and accessibility options</p>
    </div>
    {message && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{message}</p>}
    <section className="bg-white rounded-2xl p-5 border border-slate-100 space-y-3">
      <h2 style={{ fontWeight: 700 }}>Appearance</h2>
      {toggle("darkMode", "Dark mode")}
      {toggle("largerText", "Larger text")}
      {toggle("highContrast", "High contrast")}
      {toggle("reduceMotion", "Reduce motion")}
    </section>
    <section className="bg-white rounded-2xl p-5 border border-slate-100 space-y-3">
      <h2 style={{ fontWeight: 700 }}>Notifications</h2>
      {toggle("emailNotifications", "Email notifications")}
      {toggle("eventReminders", "Event reminders")}
      {toggle("rewardUpdates", "Reward claim updates")}
    </section>
    <section className="bg-white rounded-2xl p-5 border border-slate-100 text-sm text-slate-600">
      <h2 className="text-slate-900 mb-2" style={{ fontWeight: 700 }}>App Information</h2>
      <p>NELPAC SYSTEM</p>
      <p>React + Vite + Supabase</p>
      <p>Connected using VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</p>
    </section>
  </div>;
}

export { UserSettings };
