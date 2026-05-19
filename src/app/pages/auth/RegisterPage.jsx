import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router";
import { Upload, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { getActiveLocalChurchesByDistrict } from "../../lib/localChurches";
import { supabase } from "../../lib/supabaseClient";
import nelpacLogo from "../../../../NELPAC-LOGO.jpg";
import {
  updateMyProfile,
  uploadProfileAvatar,
} from "../../lib/supabaseServices";

const steps = ["Personal Information", "Church Status", "Account Setup"];

function calculateAge(birthday) {
  if (!birthday) return "";
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  )
    age -= 1;
  return age;
}

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [localChurches, setLocalChurches] = useState([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    birthday: "",
    gender: "",
    contactNumber: "",
    address: "",
    parentGuardianName: "",
    emergencyContact: "",
    district: "",
    localChurchId: "",
    professingMember: "Yes",
    confirmationClassYear: "",
    confirmationClassStatus: "Not Started",
    activityStatus: "Active",
    email: "",
    password: "",
    confirmPassword: "",
    profilePhoto: null,
  });

  const computedAge = useMemo(
    () => calculateAge(form.birthday),
    [form.birthday],
  );

  useEffect(() => {
    let alive = true;
    if (!form.district) {
      setLocalChurches([]);
      return undefined;
    }

    getActiveLocalChurchesByDistrict(form.district)
      .then((churches) => {
        if (alive) setLocalChurches(churches);
      })
      .catch((error) => {
        if (alive) {
          setLocalChurches([]);
          setMessage(error.message || "Unable to load local churches.");
        }
      });

    return () => {
      alive = false;
    };
  }, [form.district]);

  const update = (field, value) => {
    setMessage("");
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "district" ? { localChurchId: "" } : {}),
    }));
  };

  const submitRegistration = async () => {
    const requiredFields = [
      ["name", "Name"],
      ["birthday", "Birthday"],
      ["gender", "Gender"],
      ["contactNumber", "Contact number"],
      ["address", "Address"],
      ["parentGuardianName", "Parent or guardian name"],
      ["emergencyContact", "Emergency contact"],
      ["district", "District"],
      ["localChurchId", "Local church"],
      ["professingMember", "Professing member"],
      ["confirmationClassStatus", "Confirmation class status"],
      ["activityStatus", "Activity status"],
      ["email", "Email"],
      ["password", "Password"],
      ["confirmPassword", "Confirm password"],
    ];
    const missing = requiredFields.find(
      ([field]) => !String(form[field] || "").trim(),
    );
    if (missing) {
      setMessage(`${missing[1]} is required.`);
      setStep(
        [
          "name",
          "birthday",
          "gender",
          "contactNumber",
          "address",
          "parentGuardianName",
          "emergencyContact",
        ].includes(missing[0])
          ? 0
          : ["district", "localChurchId", "professingMember", "confirmationClassStatus", "activityStatus"].includes(missing[0])
          ? 1
          : 2,
      );
      return;
    }

    if (form.password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setStep(2);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage("Passwords do not match.");
      setStep(2);
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.name,
            name: form.name,
            birthday: form.birthday,
            gender: form.gender,
            contact_number: form.contactNumber,
            address: form.address,
            parent_guardian_name: form.parentGuardianName,
            emergency_contact: form.emergencyContact,
            local_church_id: form.localChurchId,
            professing_member: form.professingMember,
            confirmation_class_year: form.confirmationClassYear,
            confirmation_class_status: form.confirmationClassStatus,
            activity_status: form.activityStatus,
          },
        },
      });
      if (error) throw error;

      if (!data.session) {
        setMessage(
          "Account and member application created. Please confirm your email, then sign in.",
        );
        return;
      }

      let avatarUrl = null;
      if (form.profilePhoto) {
        avatarUrl = await uploadProfileAvatar(form.profilePhoto, data.user.id);
      }

      await updateMyProfile({
        full_name: form.name,
        contact_number: form.contactNumber,
        avatar_url: avatarUrl,
      });
      navigate("/");
    } catch (error) {
      setMessage(error.message || "Unable to submit registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const validateStep = () => {
    const stepFields = [
      [
        ["name", "Name"],
        ["birthday", "Birthday"],
        ["gender", "Gender"],
        ["contactNumber", "Contact number"],
        ["address", "Address"],
        ["parentGuardianName", "Parent or guardian name"],
        ["emergencyContact", "Emergency contact"],
      ],
      [
        ["district", "District"],
        ["localChurchId", "Local church"],
        ["professingMember", "Professing member"],
        ["confirmationClassStatus", "Confirmation class status"],
        ["activityStatus", "Activity status"],
      ],
      [
        ["email", "Email"],
        ["password", "Password"],
        ["confirmPassword", "Confirm password"],
      ],
    ][step];
    const missing = stepFields.find(
      ([field]) => !String(form[field] || "").trim(),
    );
    if (missing) {
      setMessage(`${missing[1]} is required.`);
      return false;
    }
    if (step === 2 && form.password !== form.confirmPassword) {
      setMessage("Passwords do not match.");
      return false;
    }
    return true;
  };

  const continueOrSubmit = () => {
    if (!validateStep()) return;
    if (step < steps.length - 1) setStep(step + 1);
    else submitRegistration();
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50";
  const labelClass = "block text-slate-700 mb-1";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%)",
      }}
    >
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden bg-white"
          >
            <img src={nelpacLogo} alt="NELPAC logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <p
              className="text-white"
              style={{ fontWeight: 800, fontSize: "18px" }}
            >
              NELPAC SYSTEM
            </p>
            <p
              className="text-blue-300"
              style={{ fontSize: "10px", letterSpacing: "0.15em" }}
            >
              MEMBER REGISTRATION
            </p>
          </div>
        </div>

        <div
          className="rounded-3xl p-8"
          style={{
            background: "rgba(255,255,255,0.97)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex items-center mb-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                      i < step
                        ? "bg-emerald-500 text-white"
                        : i === step
                        ? "text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                    style={
                      i === step
                        ? {
                            background:
                              "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                            fontWeight: 700,
                          }
                        : { fontWeight: 600 }
                    }
                  >
                    {i < step ? (
                      <Check style={{ width: 14, height: 14 }} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`mt-1 text-center ${
                      i === step
                        ? "text-blue-600"
                        : i < step
                        ? "text-emerald-500"
                        : "text-slate-400"
                    }`}
                    style={{ fontSize: "10px", fontWeight: 600 }}
                  >
                    {s}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="h-px flex-1 mb-4"
                    style={{ background: i < step ? "#10b981" : "#e2e8f0" }}
                  />
                )}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <h2
                className="text-slate-800 mb-4"
                style={{ fontSize: "18px", fontWeight: 700 }}
              >
                Personal Information
              </h2>
              <div className="flex flex-col items-center mb-4">
                <label className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors bg-slate-50">
                  <Upload
                    className="text-slate-400 mb-1"
                    style={{ width: 20, height: 20 }}
                  />
                  <span
                    className="text-slate-400 text-center px-1"
                    style={{ fontSize: "10px" }}
                  >
                    {form.profilePhoto ? "Selected" : "Photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) =>
                      update("profilePhoto", e.target.files?.[0] || null)
                    }
                  />
                </label>
                <p className="text-slate-400 mt-1" style={{ fontSize: "11px" }}>
                  {form.profilePhoto?.name || "Upload Profile Photo"}
                </p>
              </div>
              <div>
                <label
                  className={labelClass}
                  style={{ fontSize: "13px", fontWeight: 600 }}
                >
                  Name *
                </label>
                <input
                  required
                  className={inputClass}
                  placeholder="Juan Dela Cruz"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className={labelClass}
                    style={{ fontSize: "13px", fontWeight: 600 }}
                  >
                    Birthday *
                  </label>
                  <input
                    required
                    type="date"
                    className={inputClass}
                    value={form.birthday}
                    onChange={(e) => update("birthday", e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className={labelClass}
                    style={{ fontSize: "13px", fontWeight: 600 }}
                  >
                    {" "}
                    Age
                  </label>
                  <input
                    readOnly
                    className={inputClass}
                    value={
                      computedAge === ""
                        ? "Select birthday"
                        : `${computedAge} years old`
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ fontSize: "13px", fontWeight: 600 }}>Gender *</label>
                  <select
                    className={inputClass}
                    value={form.gender}
                    onChange={(e) => update("gender", e.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass} style={{ fontSize: "13px", fontWeight: 600 }}>Contact number *</label>
                  <input
                    className={inputClass}
                    placeholder="Contact number"
                    value={form.contactNumber}
                    onChange={(e) => update("contactNumber", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ fontSize: "13px", fontWeight: 600 }}>Address *</label>
                <input
                  className={inputClass}
                  placeholder="Purok/Street, Barangay, City/Municipality"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} style={{ fontSize: "13px", fontWeight: 600 }}>Parent/guardian name *</label>
                <input
                  className={inputClass}
                  placeholder="Parent or guardian name"
                  value={form.parentGuardianName}
                  onChange={(e) => update("parentGuardianName", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} style={{ fontSize: "13px", fontWeight: 600 }}>Emergency contact *</label>
                <input
                  className={inputClass}
                  placeholder="Emergency contact"
                  value={form.emergencyContact}
                  onChange={(e) => update("emergencyContact", e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2
                className="text-slate-800 mb-4"
                style={{ fontSize: "18px", fontWeight: 700 }}
              >
                Church Status
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    District
                  </label>
                  <select
                    className={inputClass}
                    value={form.district}
                    onChange={(e) => update("district", e.target.value)}
                  >
                    <option value="">Select district</option>
                    <option>ISED</option>
                    <option>ISIED</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Local Church
                  </label>
                  <select
                    className={inputClass}
                    value={form.localChurchId}
                    onChange={(e) => update("localChurchId", e.target.value)}
                    disabled={!form.district}
                  >
                    <option value="">Select local church</option>
                    {localChurches.map((church) => (
                      <option key={church.id} value={church.id}>
                        {church.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Are you a professing member?
                  </label>
                  <select
                    className={inputClass}
                    value={form.professingMember}
                    onChange={(e) => update("professingMember", e.target.value)}
                  >
                    <option value="">Select answer</option>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Confirmation class year
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Confirmation class year"
                    value={form.confirmationClassYear}
                    onChange={(e) =>
                      update("confirmationClassYear", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Confirmation Class Status
                  </label>
                  <select
                    className={inputClass}
                    value={form.confirmationClassStatus}
                    onChange={(e) =>
                      update("confirmationClassStatus", e.target.value)
                    }
                  >
                    <option>Not Started</option>
                    <option>Ongoing</option>
                    <option>Completed</option>
                    <option>Dropped</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Activity Status
                  </label>
                  <select
                    className={inputClass}
                    value={form.activityStatus}
                    onChange={(e) => update("activityStatus", e.target.value)}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2
                className="text-slate-800 mb-4"
                style={{ fontSize: "18px", fontWeight: 700 }}
              >
                Account Setup
              </h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  className={inputClass}
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className={inputClass}
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                />
              </div>
              {form.confirmPassword &&
                form.password !== form.confirmPassword && (
                  <p className="text-red-500 mt-1" style={{ fontSize: "11px" }}>
                    Passwords do not match
                  </p>
                )}
              <div
                className="flex items-start gap-2 p-3 rounded-xl"
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
              >
                <input type="checkbox" className="mt-0.5" />
                <p
                  className="text-slate-600"
                  style={{ fontSize: "12px", lineHeight: 1.5 }}
                >
                  I agree to the NELPAC System{" "}
                  <span className="text-blue-600">Terms of Service</span> and{" "}
                  <span className="text-blue-600">Privacy Policy</span>.
                </p>
              </div>
            </div>
          )}

          {message && (
            <p className="mt-4 text-red-600" style={{ fontSize: "12px" }}>
              {message}
            </p>
          )}

          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm hover:bg-slate-50 transition-all"
                style={{ fontWeight: 500 }}
              >
                <ChevronLeft style={{ width: 16, height: 16 }} /> Back
              </button>
            )}
            <button
              onClick={continueOrSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm transition-all hover:opacity-90 disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                fontWeight: 600,
              }}
            >
              {step === steps.length - 1 ? (
                <>
                  <Check style={{ width: 16, height: 16 }} />{" "}
                  {submitting ? "Submitting..." : "Submit Registration"}
                </>
              ) : (
                <>
                  Continue <ChevronRight style={{ width: 16, height: 16 }} />
                </>
              )}
            </button>
          </div>

          <p
            className="text-center text-slate-500 mt-4"
            style={{ fontSize: "13px" }}
          >
            Already have an account?{" "}
            <Link to="/" className="text-blue-600" style={{ fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export { RegisterPage };
